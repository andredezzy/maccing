// Query a Notion database into an agent-friendly format — relations resolved to titles, rollups/formulas
// flattened to scalars. format=table|kv|tsv|summary (required). Optional filter/sorts/fields projection,
// cursor pagination (or exhaust_all for counts/sums per the skill's pagination law).

import { z } from "zod";

import { type FlatRow, formatRows, type RowFormat } from "../lib/format-rows";
import { formatViews, type IdToName, type RawView } from "../lib/format-views";
import { flattenProperty, type RawProperty } from "../lib/notion-page";
import { hasPublicToken, publicRequest } from "../lib/notion-public";
import { resolveRelations } from "../lib/resolve-relations";
import { err, ok, type ToolModule } from "../tool";

const UUID = /^[0-9a-f-]{32,36}$/i;
const FORMATS = ["table", "kv", "tsv", "summary"] as const;

interface SchemaProp {
  id: string;
  type: string;
}

interface DataSourceSchema {
  properties?: Record<string, SchemaProp>;
}

interface DatabaseObject {
  data_sources?: { id: string }[];
}

interface QueryResponse {
  results?: { properties?: Record<string, RawProperty> }[];
  has_more?: boolean;
  next_cursor?: string | null;
}

interface ViewListResponse {
  results?: { id: string }[];
  has_more?: boolean;
  next_cursor?: string | null;
}

/** Resolve a database id to its data source id (falls back to treating the id as a data source). */
async function resolveDataSourceId(databaseId: string): Promise<string> {
  const response = await publicRequest("GET", `/v1/databases/${databaseId}`);
  if (response.ok) {
    const db = response.body as DatabaseObject;
    return db.data_sources?.[0]?.id ?? databaseId;
  }
  return databaseId; // the caller may have passed a data_source_id directly
}

/** Invert the data-source schema into a property-id → name map (covering raw + url-encoded ids). */
function buildIdToName(schema: Record<string, SchemaProp>): IdToName {
  const idToName: IdToName = {};
  for (const [name, meta] of Object.entries(schema)) {
    idToName[meta.id] = name;
    try {
      idToName[decodeURIComponent(meta.id)] = name;
    } catch {
      // id wasn't url-encoded — the raw mapping above is enough
    }
  }
  return idToName;
}

/** List a data source's view ids (paginated), then fetch each view's full configuration. */
async function fetchViews(dataSourceId: string): Promise<RawView[]> {
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
    const body = response.body as ViewListResponse;
    ids.push(...(body.results ?? []).map((view) => view.id));
    cursor = body.has_more ? (body.next_cursor ?? undefined) : undefined;
  } while (cursor);

  const views: RawView[] = [];
  const BATCH = 10;
  for (let start = 0; start < ids.length; start += BATCH) {
    const responses = await Promise.all(
      ids.slice(start, start + BATCH).map((id) => publicRequest("GET", `/v1/views/${id}`)),
    );
    for (const response of responses) {
      if (response.ok) {
        views.push(response.body as RawView);
      }
    }
  }
  return views;
}

export const readDatabase: ToolModule = {
  name: "read_database",
  config: {
    title: "Read a Notion database",
    description:
      "Query a Notion database and render it agent-friendly: relations resolved to titles, rollups/formulas " +
      "as scalars. format (required): table (GFM pipe table) | kv (key:value per row) | tsv | summary (grouped " +
      "totals, e.g. value-by-category — pass group_by). Optional filter/sorts (Notion objects, verbatim), fields " +
      "(project to these property names), page_size+cursor for paging, or exhaust_all=true to pull every row " +
      "(use for counts/sums per the pagination Iron Law). Set include_views=true to also dump every view's full " +
      "config (covers/preview, card size, layout, visible props, sorts, filters, chart axes), property ids resolved.",
    annotations: { title: "Read a Notion database", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      database_id: z.string().describe("The database id (or a data_source_id)."),
      format: z.enum(FORMATS).describe("table | kv | tsv | summary — required."),
      fields: z.array(z.string()).optional().describe("Project to these property names only (in this order)."),
      filter: z.record(z.string(), z.unknown()).optional().describe("Notion filter object, passed verbatim."),
      sorts: z.array(z.record(z.string(), z.unknown())).optional().describe("Notion sorts array, passed verbatim."),
      page_size: z.number().optional().describe("Rows per page (default 20, max 100)."),
      cursor: z.string().optional().describe("Opaque next_cursor from a prior call."),
      exhaust_all: z.boolean().optional().describe("Loop to the end and return every row (for counts/sums)."),
      group_by: z.string().optional().describe("summary only: the property to group by."),
      include_views: z
        .boolean()
        .optional()
        .describe(
          "Also append every view with its COMPLETE configuration — type, sorts, filter, and all visual props " +
            "(cover/preview, card size, aspect, layout, group_by, chart axes, visible/hidden columns) — with property " +
            "ids resolved to names. Use to inspect or replicate a database's view design.",
        ),
    },
  },

  handler: async (args) => {
    if (!hasPublicToken()) {
      return err("NOTION_TOKEN is not set.");
    }
    const databaseId = String(args.database_id ?? "").trim();
    if (!UUID.test(databaseId)) {
      return err("database_id must be a UUID.");
    }
    const format = String(args.format) as RowFormat;
    if (!FORMATS.includes(format)) {
      return err(`Invalid format "${String(args.format)}". One of: ${FORMATS.join(", ")}`);
    }

    try {
      const dataSourceId = await resolveDataSourceId(databaseId);

      const schemaResponse = await publicRequest("GET", `/v1/data_sources/${dataSourceId}`);
      if (!schemaResponse.ok) {
        return err(`Could not read the data source ${dataSourceId} — check the id and that NOTION_TOKEN has access.`);
      }
      const schema = (schemaResponse.body as DataSourceSchema).properties ?? {};

      const fields = Array.isArray(args.fields) ? (args.fields as string[]) : null;
      const columns = fields ?? Object.keys(schema);

      // filter_properties projects the returned columns — it needs INTERNAL property ids, not names.
      let path = `/v1/data_sources/${dataSourceId}/query`;
      if (fields) {
        const ids = fields.map((name) => schema[name]?.id).filter((id): id is string => Boolean(id));
        if (ids.length > 0) {
          path += `?${ids.map((id) => `filter_properties=${encodeURIComponent(id)}`).join("&")}`;
        }
      }

      const pageSize = typeof args.page_size === "number" ? Math.min(Math.max(args.page_size, 1), 100) : 20;
      const exhaust = args.exhaust_all === true;
      const rawRows: { properties?: Record<string, RawProperty> }[] = [];
      let cursor = typeof args.cursor === "string" ? args.cursor : undefined;

      do {
        const body: Record<string, unknown> = { page_size: pageSize };
        if (args.filter) {
          body.filter = args.filter;
        }
        if (args.sorts) {
          body.sorts = args.sorts;
        }
        if (cursor) {
          body.start_cursor = cursor;
        }
        const response = await publicRequest("POST", path, body);
        if (!response.ok) {
          return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }], isError: true };
        }
        const page = response.body as QueryResponse;
        rawRows.push(...(page.results ?? []));
        cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
      } while (exhaust && cursor);

      // Flatten + collect relation ids, resolve once, build display rows.
      const flattened = rawRows.map((row) => {
        const props = row.properties ?? {};
        const out: Record<string, ReturnType<typeof flattenProperty>> = {};
        for (const column of columns) {
          out[column] = props[column] ? flattenProperty(props[column]) : { value: null };
        }
        return out;
      });
      const relationIds = collectRelationIds(flattened);
      const titles = relationIds.length > 0 ? await resolveRelations(relationIds) : new Map<string, string>();

      const rows: FlatRow[] = flattened.map((flat) => {
        const row: FlatRow = {};
        for (const column of columns) {
          const f = flat[column];
          row[column] = f.relationIds ? f.relationIds.map((id) => titles.get(id) ?? id).join(", ") || null : f.value;
        }
        return row;
      });

      const rendered = formatRows(rows, columns, format, typeof args.group_by === "string" ? args.group_by : undefined);
      const more = cursor ? ` | next_cursor: ${cursor}` : exhaust ? "" : " | next_cursor: null";
      const trailer = `\n# ${rows.length} rows${more} | fields: [${columns.join(", ")}]`;

      let viewsSection = "";
      if (args.include_views === true) {
        const views = await fetchViews(dataSourceId);
        viewsSection = `\n\n${formatViews(views, buildIdToName(schema))}`;
      }

      return ok(rendered + trailer + viewsSection);
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};

/** Collect every relation target id across the flattened rows. */
function collectRelationIds(rows: Record<string, ReturnType<typeof flattenProperty>>[]): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    for (const flat of Object.values(row)) {
      if (flat.relationIds) {
        ids.push(...flat.relationIds);
      }
    }
  }
  return ids;
}
