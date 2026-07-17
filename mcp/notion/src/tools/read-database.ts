// Query a Notion database into an agent-friendly format — relations resolved to titles, rollups/formulas
// flattened to scalars. format=table|kv|tsv|summary (required). Optional filter/sorts/fields projection,
// cursor pagination (or exhaust_all for counts/sums per the skill's pagination law).

import { z } from "zod";
import { normalizeUuid, UUID_PATTERN } from "../notion/ids";
import { hasPublicToken, publicRequest } from "../notion/public-client";
import { type FlattenedProperty, flattenProperty, type NotionPropertyValue } from "../readers/page";
import { resolveRelations } from "../readers/resolve-relations";
import { type FlatRow, formatRows, type RowFormat } from "../readers/rows";
import { databaseToDataSourceId, formatSchema, type PropertiesMap } from "../readers/schema";
import { buildIdToName, fetchViews, formatViews, type ViewsMode } from "../readers/views";
import { err, errorMessage, ok, type ToolModule } from "../tool";

const FORMATS = ["table", "kv", "tsv", "summary"] as const;
const VIEWS_MODES = ["summary", "full"] as const;

interface DataSourceSchema {
  properties?: PropertiesMap;
}

interface QueryResponse {
  results?: { id?: string; properties?: Record<string, NotionPropertyValue> }[];
  has_more?: boolean;
  next_cursor?: string | null;
}

// One cheap GET, optimistic fallback: a READ can treat an unrecognized id as a data_source_id directly —
// a wrong id just yields a query error, no harm. (order-properties uses a STRICTER resolver — probes
// /data_sources first, returns null on failure — because a WRITE must validate the target before mutating.)
/** Resolve a database id to its data source id (falls back to treating the id as a data source). */
async function resolveDataSourceId(databaseId: string): Promise<string> {
  return (await databaseToDataSourceId(databaseId)) ?? databaseId;
}

/** Collect every relation target id across the flattened rows. */
function collectRelationIds(rows: Record<string, FlattenedProperty>[]): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    for (const flattenedProperty of Object.values(row)) {
      if (flattenedProperty.relationIds) {
        ids.push(...flattenedProperty.relationIds);
      }
    }
  }
  return ids;
}

export const readDatabase: ToolModule = {
  name: "read_database",
  config: {
    title: "Read a Notion database",
    description:
      "Query a Notion database and render it agent-friendly: relations resolved to titles, rollups/formulas " +
      "as scalars. format (required): table=GFM | kv | tsv | summary=grouped " +
      "totals, e.g. value-by-category — pass group_by. Optional filter/sorts (Notion objects, verbatim), fields " +
      "(project to these property names), page_size+cursor for paging, or exhaust_all=true to pull every row " +
      "(use for counts/sums per the pagination Iron Law). The output ALSO appends a # Schema section (every " +
      "column as name · type · detail, formula bodies elided) and a # Views section — views (default " +
      "summary): one line per view (name · type · container · filter/sorts digest); full: complete config " +
      "(type, sorts, filter, quick_filters, all visual props) with property ids resolved to names — pass " +
      'views:"full" before any view PATCH. Schema + views always included. include_ids=true prepends each ' +
      "row's page id as an _id column (table/tsv/kv only). For column ICONS, or to describe a page/data " +
      "source on its own, use the `describe` tool.",
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
      views: z
        .enum(VIEWS_MODES)
        .optional()
        .describe("summary (default) = one digest line per view; full = complete config dump."),
      include_ids: z
        .boolean()
        .optional()
        .describe("Prepend each row's page id as an _id column (default false; table/tsv/kv only)."),
    },
  },

  handler: async (args) => {
    if (!hasPublicToken()) {
      return err("NOTION_TOKEN is not set.");
    }
    const databaseId = normalizeUuid(String(args.database_id ?? ""));
    if (!UUID_PATTERN.test(databaseId)) {
      return err("database_id must be a UUID.");
    }
    const format = args.format as (typeof FORMATS)[number];
    const viewsMode: ViewsMode = args.views === "full" ? "full" : "summary";
    const includeIds = args.include_ids === true;

    try {
      const dataSourceId = await resolveDataSourceId(databaseId);

      const schemaResponse = await publicRequest("GET", `/v1/data_sources/${dataSourceId}`);
      if (!schemaResponse.ok) {
        return err(`Could not read the data source ${dataSourceId} — check the id and that NOTION_TOKEN has access.`);
      }
      const schema = (schemaResponse.body as DataSourceSchema).properties ?? {};

      const rowFormat = format as RowFormat;
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
      const exhaustAll = args.exhaust_all === true;
      const rawRows: { id?: string; properties?: Record<string, NotionPropertyValue> }[] = [];
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
          return err(JSON.stringify(response, null, 2));
        }
        const queryResponse = response.body as QueryResponse;
        rawRows.push(...(queryResponse.results ?? []));
        cursor = queryResponse.has_more ? (queryResponse.next_cursor ?? undefined) : undefined;
      } while (exhaustAll && cursor);

      // Flatten + collect relation ids, resolve once, build display rows.
      const flattenedRows = rawRows.map((row) => {
        const properties = row.properties ?? {};
        const flatRow: Record<string, FlattenedProperty> = {};
        for (const column of columns) {
          flatRow[column] = properties[column] ? flattenProperty(properties[column]) : { value: null };
        }
        return flatRow;
      });
      const relationIds = collectRelationIds(flattenedRows);
      const titles = relationIds.length > 0 ? await resolveRelations(relationIds) : new Map<string, string>();

      // include_ids prepends the page id as its own column — only meaningful for the row-oriented
      // formats; "summary" groups/sums rows and has no per-row line to prepend an id to.
      const showIds = includeIds && rowFormat !== "summary";
      const displayColumns = showIds ? ["_id", ...columns] : columns;

      const rows: FlatRow[] = flattenedRows.map((flatRow, index) => {
        const row: FlatRow = {};
        if (showIds) {
          row._id = rawRows[index]?.id ?? null;
        }
        for (const column of columns) {
          const flattenedProperty = flatRow[column];
          row[column] = flattenedProperty.relationIds
            ? flattenedProperty.relationIds.map((id) => titles.get(id) ?? id).join(", ") || null
            : flattenedProperty.value;
        }
        return row;
      });

      const rendered = formatRows(
        rows,
        displayColumns,
        rowFormat,
        typeof args.group_by === "string" ? args.group_by : undefined,
      );
      const paginationSuffix = cursor ? ` | next_cursor: ${cursor}` : exhaustAll ? "" : " | next_cursor: null";
      const rowsSummary = `\n# ${rows.length} rows${paginationSuffix} | fields: [${displayColumns.join(", ")}]`;

      // Schema + views are always appended — every read_database dumps the database's full structure
      // (column definitions, formula bodies elided) and view design. The schema is free here: this
      // tool already fetched it above. Column ICONS are deliberately NOT fetched on this hot path
      // (they need a ToS-risk private call) — that lives in the dedicated `describe` tool.
      const schemaSection = `\n\n${formatSchema(schema)}`;

      const views = await fetchViews(dataSourceId);
      const viewsSection = `\n\n${formatViews(views, buildIdToName(schema), viewsMode)}`;

      return ok(rendered + rowsSummary + schemaSection + viewsSection);
    } catch (error) {
      return err(errorMessage(error));
    }
  },
};
