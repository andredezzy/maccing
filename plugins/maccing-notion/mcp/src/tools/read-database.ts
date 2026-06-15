// Query a Notion database into an agent-friendly format — relations resolved to titles, rollups/formulas
// flattened to scalars. format=table|kv|tsv|summary (required). Optional filter/sorts/fields projection,
// cursor pagination (or exhaust_all for counts/sums per the skill's pagination law).

import { z } from "zod";

import { type FlatRow, formatRows, type RowFormat } from "../lib/format-rows";
import { formatSchema, type PropertiesMap } from "../lib/format-schema";
import { formatViews, type IdToName, type RawView } from "../lib/format-views";
import { normalizeUuid, UUID_PATTERN } from "../lib/normalize-uuid";
import { flattenProperty, type NotionPropertyValue } from "../lib/notion-page";
import { hasPublicToken, publicRequest } from "../lib/notion-public";
import { databaseToModel, type RawRow, type ResolvedView } from "../lib/notion-to-database-model";
import { iconToString } from "../lib/notion-to-page-model";
import { renderDatabase } from "../lib/render-mockup";
import { resolveRelations } from "../lib/resolve-relations";
import { err, ok, type ToolModule } from "../tool";

const FORMATS = ["table", "kv", "tsv", "summary", "mockup"] as const;

interface DataSourceSchema {
  properties?: PropertiesMap;
}

interface DatabaseObject {
  data_sources?: { id: string }[];
}

interface QueryResponse {
  results?: { properties?: Record<string, NotionPropertyValue> }[];
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
    const database = response.body as DatabaseObject;
    return database.data_sources?.[0]?.id ?? databaseId;
  }
  return databaseId; // the caller may have passed a data_source_id directly
}

/** Invert the data-source schema into a property-id → name map (covering raw + url-encoded ids). */
function buildIdToName(schema: PropertiesMap): IdToName {
  const idToName: IdToName = {};
  for (const [name, property] of Object.entries(schema)) {
    if (!property.id) {
      continue;
    }
    idToName[property.id] = name;
    try {
      idToName[decodeURIComponent(property.id)] = name;
    } catch (error) {
      if (!(error instanceof URIError)) {
        throw error;
      }
      // expected: id was not percent-encoded
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
  const VIEW_FETCH_BATCH_SIZE = 10;
  for (let start = 0; start < ids.length; start += VIEW_FETCH_BATCH_SIZE) {
    const responses = await Promise.all(
      ids.slice(start, start + VIEW_FETCH_BATCH_SIZE).map((id) => publicRequest("GET", `/v1/views/${id}`)),
    );
    for (const response of responses) {
      if (response.ok) {
        views.push(response.body as RawView);
      }
    }
  }
  return views;
}

/** Resolve a view's config (property ids → names) into a ResolvedView the database-mapper consumes. */
function resolveView(view: RawView, idToName: IdToName): ResolvedView {
  const config = (view.configuration ?? {}) as {
    properties?: { property_id?: string; property_name?: string; visible?: boolean }[];
    group_by?: { property_id?: string };
    date_property_id?: string;
    date_property_name?: string;
  };
  const resolve = (id: string | undefined): string | undefined => {
    if (!id) {
      return undefined;
    }
    try {
      return idToName[id] ?? idToName[decodeURIComponent(id)];
    } catch {
      return idToName[id];
    }
  };
  const columns = (config.properties ?? [])
    .filter((p) => p.visible !== false)
    .map((p) => resolve(p.property_id) ?? p.property_name)
    .filter((name): name is string => Boolean(name));
  return {
    name: view.name ?? "View",
    type: view.type ?? "table",
    columns,
    groupBy: resolve(config.group_by?.property_id),
    dateProp: resolve(config.date_property_id) ?? config.date_property_name,
  };
}
/** Fetch + map a database to the ASCII mockup (title/icon + every view, rows as cards/cells). */
async function renderDatabaseMockup(databaseId: string, dataSourceId: string, schema: PropertiesMap): Promise<string> {
  const dbResponse = await publicRequest("GET", `/v1/databases/${databaseId}`);
  const database = dbResponse.ok ? (dbResponse.body as { title?: { plain_text?: string }[]; icon?: unknown }) : {};
  const title = (database.title ?? []).map((t) => t.plain_text ?? "").join("") || "(database)";
  const idToName = buildIdToName(schema);
  const titleColumn =
    Object.entries(schema).find(([, p]) => p.type === "title")?.[0] ?? Object.keys(schema)[0] ?? "Name";

  const views = (await fetchViews(dataSourceId)).map((view) => {
    const resolved = resolveView(view, idToName);
    resolved.columns = [titleColumn, ...resolved.columns.filter((c) => c !== titleColumn)];
    return resolved;
  });

  // Mockup is a compact preview, so we sample rather than exhaust — but never SILENTLY. Fetch one past
  // the cap to detect "there are more", slice to the cap, and surface the truncation as a footer line.
  const SAMPLE_CAP = 24;
  const query = await publicRequest("POST", `/v1/data_sources/${dataSourceId}/query`, { page_size: SAMPLE_CAP + 1 });
  const fetched = (query.ok ? ((query.body as QueryResponse).results ?? []) : []) as RawRow[];
  const truncated = fetched.length > SAMPLE_CAP;
  const rows = truncated ? fetched.slice(0, SAMPLE_CAP) : fetched;

  const body = renderDatabase(
    databaseToModel({
      title,
      icon: iconToString(database.icon as Parameters<typeof iconToString>[0]),
      titleColumn,
      views: views.length ? views : [{ name: "Table", type: "table", columns: [titleColumn] }],
      rows,
    }),
  );

  return truncated ? `${body}\n\n(mockup preview — showing the first ${SAMPLE_CAP} rows; the database has more)` : body;
}

/** Collect every relation target id across the flattened rows. */
function collectRelationIds(rows: Record<string, ReturnType<typeof flattenProperty>>[]): string[] {
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
      "as scalars. format (required): table | kv | tsv | summary | mockup (render the live DB as the ASCII view mockup). table=GFM, kv, tsv, summary=grouped " +
      "totals, e.g. value-by-category — pass group_by). Optional filter/sorts (Notion objects, verbatim), fields " +
      "(project to these property names), page_size+cursor for paging, or exhaust_all=true to pull every row " +
      "(use for counts/sums per the pagination Iron Law). The output ALSO appends a # Schema section (every " +
      "column as name · type · detail, formula bodies elided) and every view with its COMPLETE config — type, " +
      "sorts, filter, quick_filters, and all visual props (covers/preview, card size, aspect, layout, group_by, " +
      "chart axes, visible/hidden columns) — with property ids resolved to names. Schema + views always included. " +
      "For column ICONS, or to describe a page/data source on its own, use the `describe` tool.",
    annotations: { title: "Read a Notion database", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      database_id: z.string().describe("The database id (or a data_source_id)."),
      format: z.enum(FORMATS).describe("table | kv | tsv | summary | mockup — required."),
      fields: z.array(z.string()).optional().describe("Project to these property names only (in this order)."),
      filter: z.record(z.string(), z.unknown()).optional().describe("Notion filter object, passed verbatim."),
      sorts: z.array(z.record(z.string(), z.unknown())).optional().describe("Notion sorts array, passed verbatim."),
      page_size: z.number().optional().describe("Rows per page (default 20, max 100)."),
      cursor: z.string().optional().describe("Opaque next_cursor from a prior call."),
      exhaust_all: z.boolean().optional().describe("Loop to the end and return every row (for counts/sums)."),
      group_by: z.string().optional().describe("summary only: the property to group by."),
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
    const format = String(args.format);
    if (!FORMATS.includes(format as (typeof FORMATS)[number])) {
      return err(`Invalid format "${String(args.format)}". One of: ${FORMATS.join(", ")}`);
    }
    const rowFormat = format as RowFormat;

    try {
      const dataSourceId = await resolveDataSourceId(databaseId);

      const schemaResponse = await publicRequest("GET", `/v1/data_sources/${dataSourceId}`);
      if (!schemaResponse.ok) {
        return err(`Could not read the data source ${dataSourceId} — check the id and that NOTION_TOKEN has access.`);
      }
      const schema = (schemaResponse.body as DataSourceSchema).properties ?? {};

      if (format === "mockup") {
        return ok(await renderDatabaseMockup(databaseId, dataSourceId, schema));
      }

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
      const rawRows: { properties?: Record<string, NotionPropertyValue> }[] = [];
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
        const flatRow: Record<string, ReturnType<typeof flattenProperty>> = {};
        for (const column of columns) {
          flatRow[column] = properties[column] ? flattenProperty(properties[column]) : { value: null };
        }
        return flatRow;
      });
      const relationIds = collectRelationIds(flattenedRows);
      const titles = relationIds.length > 0 ? await resolveRelations(relationIds) : new Map<string, string>();

      const rows: FlatRow[] = flattenedRows.map((flatRow) => {
        const row: FlatRow = {};
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
        columns,
        rowFormat,
        typeof args.group_by === "string" ? args.group_by : undefined,
      );
      const paginationSuffix = cursor ? ` | next_cursor: ${cursor}` : exhaustAll ? "" : " | next_cursor: null";
      const rowsSummary = `\n# ${rows.length} rows${paginationSuffix} | fields: [${columns.join(", ")}]`;

      // Schema + views are always appended — every read_database dumps the database's full structure
      // (column definitions, formula bodies elided) and view design. The schema is free here: this
      // tool already fetched it above. Column ICONS are deliberately NOT fetched on this hot path
      // (they need a ToS-risk private call) — that lives in the dedicated `describe` tool.
      const schemaSection = `\n\n${formatSchema(schema)}`;

      const views = await fetchViews(dataSourceId);
      const viewsSection = `\n\n${formatViews(views, buildIdToName(schema))}`;

      return ok(rendered + rowsSummary + schemaSection + viewsSection);
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
