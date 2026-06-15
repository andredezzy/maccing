// order_properties — re-order a database's properties (ORDER only; visibility is upsert_property's
// canonical `visible`). One `order` list applied to a composable set of `targets`:
//   "all"      → every VIEW's column order — ALL view types, not just tables (public configuration.properties)
//   "page"     → the canonical property order (private collection.format.collection_page_properties)
//   <view_id>  → a specific view's column order (public)
// A "column" is a property rendered in a view — the property is the entity, hence order_properties.

import { z } from "zod";
import { abbreviateId } from "../notion/abbreviate-id";
import { normalizeUuid, UUID_PATTERN } from "../notion/normalize-uuid";
import {
  type PageOrderEntry,
  privateConfig,
  readCollectionPageProperties,
  writeCollectionFormat,
} from "../notion/private-client";
import { hasPublicToken, publicRequest } from "../notion/public-client";
import { err, ok, type ToolModule } from "../tool";
import {
  decodePropertyId,
  reorderPageProperties,
  reorderViewProperties,
  type ViewProperty,
} from "../writers/reorder-properties";
import {
  type DataSourceBody,
  describePrivateFailure,
  type SchemaBody,
  type SchemaPropertyRef,
} from "../writers/upsert-property";

interface ViewListBody {
  results?: { id: string }[];
  has_more?: boolean;
  next_cursor?: string | null;
}

interface ViewConfiguration {
  type?: string;
  properties?: ViewProperty[];
}

interface ViewBody {
  name?: string;
  configuration?: ViewConfiguration;
}

async function resolveDataSourceId(id: string): Promise<string | null> {
  const dataSource = await publicRequest("GET", `/v1/data_sources/${id}`);
  if (dataSource.ok) {
    return id;
  }
  const database = await publicRequest("GET", `/v1/databases/${id}`);
  if (database.ok) {
    return (database.body as DataSourceBody).data_sources?.[0]?.id ?? null;
  }
  return null;
}

function namesToDecodedIds(names: string[], schema: Record<string, SchemaPropertyRef>): string[] {
  const byName = new Map<string, string>();
  for (const propertyRef of Object.values(schema)) {
    byName.set(propertyRef.name, decodePropertyId(propertyRef.id));
  }
  return names.map((name) => byName.get(name) ?? decodePropertyId(name));
}

async function listViewIds(dataSourceId: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const query: Record<string, unknown> = { data_source_id: dataSourceId, page_size: 100 };
    if (cursor) {
      query.start_cursor = cursor;
    }
    const response = await publicRequest("GET", "/v1/views", undefined, query);
    if (!response.ok) {
      break;
    }
    const body = response.body as ViewListBody;
    ids.push(...(body.results ?? []).map((view) => view.id));
    cursor = body.has_more ? (body.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return ids;
}

/** Reorder one view's columns (public). */
async function reorderView(viewId: string, orderIds: string[]): Promise<string> {
  const viewResponse = await publicRequest("GET", `/v1/views/${viewId}`);
  if (!viewResponse.ok) {
    return `${abbreviateId(viewId)}: read failed`;
  }
  const view = viewResponse.body as ViewBody;
  const configuration = view.configuration ?? {};
  const newProperties = reorderViewProperties(configuration.properties ?? [], orderIds);

  const patch = await publicRequest("PATCH", `/v1/views/${viewId}`, {
    configuration: { ...configuration, properties: newProperties },
  });
  return patch.ok
    ? `${view.name ?? "(view)"} ${abbreviateId(viewId)}: reordered ✓`
    : `${view.name ?? "(view)"} ${abbreviateId(viewId)}: PATCH failed — ${JSON.stringify(patch.body).slice(0, 120)}`;
}

/** Reorder the canonical page-property order (private), preserving each property's default visibility. */
async function reorderPage(
  dataSourceId: string,
  orderIds: string[],
  schema: Record<string, SchemaPropertyRef>,
): Promise<string> {
  if (!privateConfig().ok) {
    return "skipped (private API not configured)";
  }
  try {
    const read = await readCollectionPageProperties(dataSourceId);
    if (read.status === "throttled") {
      return describePrivateFailure("throttled");
    }
    // Seed from the schema (all properties, default-visible) when the collection has no page order yet.
    const current: PageOrderEntry[] =
      read.pageProperties.length > 0
        ? read.pageProperties
        : Object.values(schema).map((propertyRef) => ({ property: decodePropertyId(propertyRef.id), visible: true }));

    const reordered = reorderPageProperties(current, orderIds);
    const setResponse = await writeCollectionFormat(dataSourceId, { collection_page_properties: reordered });
    return setResponse.ok ? "page order set ✓ (verify in Notion)" : describePrivateFailure(setResponse.body);
  } catch (error) {
    return describePrivateFailure(error instanceof Error ? error.message : String(error));
  }
}

export const orderProperties: ToolModule = {
  name: "order_properties",
  config: {
    title: "Order a database's properties",
    description:
      "Re-order a database's properties (ORDER only — visibility is a separate concern). One `order` list " +
      '(property names, desired left-to-right) applied to a composable set of `targets`: "all" = every ' +
      'view\'s column order — ALL view types (gallery/board/list card-property order too, not just tables), public; "page" = the canonical property order (the row-detail panel + new-view ' +
      'default — private app API); or a specific view id. Default targets = ["all"]. Title is kept first ONLY ' +
      'when unlisted — to MOVE it, list "title" (the Name property) in `order` at the desired spot; the title ' +
      "column IS reorderable in table views (live-verified 2026-06-14). Unlisted properties keep their relative " +
      "order; each target's existing VISIBILITY/width is PRESERVED " +
      "(filtered views keep their hidden columns). A column is a property rendered in a view — the property is " +
      "the entity. To change a property's default visibility, use upsert_property's `visible`; to redefine a " +
      "property, upsert_property.",
    annotations: { title: "Order a database's properties", openWorldHint: true, destructiveHint: true },
    inputSchema: {
      data_source_id: z.string().describe("The data source id (or a database id; auto-resolved)."),
      order: z.array(z.string()).describe("Property names (or ids) in the desired order."),
      targets: z
        .array(z.string())
        .optional()
        .describe('Where to apply: "all" (every view), "page" (canonical order), and/or view ids. Default ["all"].'),
    },
  },

  handler: async (args) => {
    if (!hasPublicToken()) {
      return err("NOTION_TOKEN is not set.");
    }
    const inputId = normalizeUuid(String(args.data_source_id ?? ""));
    if (!UUID_PATTERN.test(inputId)) {
      return err("data_source_id must be a UUID.");
    }
    const order = Array.isArray(args.order) ? (args.order as string[]) : null;
    if (!order || order.length === 0) {
      return err("`order` must be a non-empty array of property names.");
    }

    try {
      const dataSourceId = await resolveDataSourceId(inputId);
      if (!dataSourceId) {
        return err(`Could not resolve ${inputId} to a data source.`);
      }

      const schemaResponse = await publicRequest("GET", `/v1/data_sources/${dataSourceId}`);
      if (!schemaResponse.ok) {
        return err(`Could not read the data source ${dataSourceId} — check the id and that NOTION_TOKEN has access.`);
      }
      const schema = (schemaResponse.body as SchemaBody).properties ?? {};
      const orderIds = namesToDecodedIds(order, schema);

      const targets = Array.isArray(args.targets) && args.targets.length > 0 ? (args.targets as string[]) : ["all"];
      const wantsAll = targets.includes("all");
      const wantsPage = targets.includes("page");
      const explicitViewIds = targets.filter((target) => target !== "all" && target !== "page");
      const viewIds = wantsAll ? await listViewIds(dataSourceId) : explicitViewIds;

      const views: string[] = [];
      for (const viewId of viewIds) {
        views.push(await reorderView(viewId, orderIds));
      }

      const page = wantsPage ? await reorderPage(dataSourceId, orderIds, schema) : "not targeted";

      return ok({
        data_source: dataSourceId,
        views_reordered: views.length,
        views,
        page,
      });
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
