// order_columns — re-order the COLUMNS of a database's table views (the per-view layer:
// configuration.properties), distinct from a property's schema order. Lists a data source's views and
// reorders each to the requested sequence, PRESERVING every view's own column visibility/width. The
// view-write-dual of read_database's # Views section. Public API only (no private/throttle dependency).

import { z } from "zod";

import { hasPublicToken, publicRequest } from "../lib/notion-public";
import { reorderViewProperties, type ViewProp } from "../lib/view-columns";
import { err, ok, type ToolModule } from "../tool";

const UUID = /^[0-9a-f-]{32,36}$/i;

interface SchemaProp {
  id: string;
  name: string;
}

interface SchemaBody {
  properties?: Record<string, SchemaProp>;
}

interface DatabaseBody {
  data_sources?: { id: string }[];
}

interface ViewListBody {
  results?: { id: string }[];
  has_more?: boolean;
  next_cursor?: string | null;
}

interface ViewBody {
  name?: string;
  configuration?: { type?: string; properties?: ViewProp[] };
}

const short = (id: string): string => (id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id);
const decode = (id: string): string => {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
};

/** Resolve a database id to its data source id (or pass through a data_source_id). */
async function resolveDataSourceId(id: string): Promise<string | null> {
  const dataSource = await publicRequest("GET", `/v1/data_sources/${id}`);
  if (dataSource.ok) {
    return id;
  }
  const database = await publicRequest("GET", `/v1/databases/${id}`);
  if (database.ok) {
    return (database.body as DatabaseBody).data_sources?.[0]?.id ?? null;
  }
  return null;
}

/** Map property NAMES (or ids) to their DECODED schema ids. */
function namesToDecodedIds(names: string[], schema: Record<string, SchemaProp>): string[] {
  const byName = new Map<string, string>();
  for (const def of Object.values(schema)) {
    byName.set(def.name, decode(def.id));
  }
  return names.map((name) => byName.get(name) ?? decode(name));
}

/** Every view id of a data source (paginated; the list is id-only). */
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

export const orderColumns: ToolModule = {
  name: "order_columns",
  config: {
    title: "Order a database's view columns",
    description:
      "Re-order the COLUMNS of a database's table views (the per-view layer — configuration.properties), " +
      "distinct from a property's schema order. `order` = property names in the desired left-to-right order; " +
      "applies to ALL views of the data source by default (or the given `views` ids). Title is pinned first; " +
      "columns you don't list keep their current relative order at the end. Each view's column VISIBILITY and " +
      "width are PRESERVED (filtered views keep their hidden columns) — pass `hide`/`show` to override " +
      "visibility across the targeted views. The view-write-dual of read_database's # Views section.",
    annotations: { title: "Order a database's view columns", openWorldHint: true, destructiveHint: true },
    inputSchema: {
      data_source_id: z.string().describe("The data source id (or a database id; auto-resolved)."),
      order: z.array(z.string()).describe("Property names (or ids) in the desired left-to-right order."),
      views: z.array(z.string()).optional().describe("Specific view ids; default = every view of the data source."),
      hide: z.array(z.string()).optional().describe("Property names to hide across the targeted views."),
      show: z.array(z.string()).optional().describe("Property names to show across the targeted views."),
    },
  },

  handler: async (args) => {
    if (!hasPublicToken()) {
      return err("NOTION_TOKEN is not set.");
    }
    const inputId = String(args.data_source_id ?? "").trim();
    if (!UUID.test(inputId)) {
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
      const hide = new Set(namesToDecodedIds(Array.isArray(args.hide) ? (args.hide as string[]) : [], schema));
      const show = new Set(namesToDecodedIds(Array.isArray(args.show) ? (args.show as string[]) : [], schema));

      const viewIds =
        Array.isArray(args.views) && args.views.length > 0 ? (args.views as string[]) : await listViewIds(dataSourceId);

      const views: string[] = [];
      let reordered = 0;

      for (const viewId of viewIds) {
        const viewResponse = await publicRequest("GET", `/v1/views/${viewId}`);
        if (!viewResponse.ok) {
          views.push(`${short(viewId)}: read failed`);
          continue;
        }

        const view = viewResponse.body as ViewBody;
        const configuration = view.configuration ?? {};
        const newProperties = reorderViewProperties(configuration.properties ?? [], orderIds, { hide, show });

        const patch = await publicRequest("PATCH", `/v1/views/${viewId}`, {
          configuration: { ...configuration, properties: newProperties },
        });
        if (patch.ok) {
          reordered += 1;
          views.push(`${view.name ?? "(view)"} ${short(viewId)}: reordered ✓`);
        } else {
          views.push(
            `${view.name ?? "(view)"} ${short(viewId)}: PATCH failed — ${JSON.stringify(patch.body).slice(0, 120)}`,
          );
        }
      }

      return ok({ data_source: dataSourceId, reordered, of: viewIds.length, views });
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
