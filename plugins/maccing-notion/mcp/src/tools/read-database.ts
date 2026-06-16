// Query a Notion database into an agent-friendly format — relations resolved to titles, rollups/formulas
// flattened to scalars. format=table|kv|tsv|summary (required). Optional filter/sorts/fields projection,
// cursor pagination (or exhaust_all for counts/sums per the skill's pagination law).

import { z } from "zod";
import { normalizeUuid, UUID_PATTERN } from "../notion/ids";
import { readViewOrder } from "../notion/private-client";
import { hasPublicToken, publicRequest } from "../notion/public-client";
import { iconGlyph, type NotionIcon } from "../readers/object";
import { type FlattenedProperty, flattenProperty, type NotionPropertyValue, richTextToPlain } from "../readers/page";
import { resolveRelations } from "../readers/resolve-relations";
import { type FlatRow, formatRows, type RowFormat } from "../readers/rows";
import { type DataSourceBody, formatSchema, type PropertiesMap } from "../readers/schema";
import { buildIdToName, fetchViews, formatViews, orderViews, selectViewIndex, viewQueryFilter } from "../readers/views";
import { databaseToModel, groupOptionsFor, renderDatabase, resolveView } from "../render";
import { err, ok, type ToolModule } from "../tool";

const FORMATS = ["table", "kv", "tsv", "summary", "mockup"] as const;

/** Rows sampled for a mockup preview — one past this is fetched to flag "there are more". */
const SAMPLE_CAP = 24;

interface DataSourceSchema {
  properties?: PropertiesMap;
}

interface QueryResponse {
  results?: { properties?: Record<string, NotionPropertyValue> }[];
  has_more?: boolean;
  next_cursor?: string | null;
}

/** Resolve a database id to its data source id (falls back to treating the id as a data source). */
async function resolveDataSourceId(databaseId: string): Promise<string> {
  const response = await publicRequest("GET", `/v1/databases/${databaseId}`);
  if (response.ok) {
    const database = response.body as DataSourceBody;
    return database.data_sources?.[0]?.id ?? databaseId;
  }
  return databaseId; // the caller may have passed a data_source_id directly
}

interface DatabaseTitleBody {
  title?: { plain_text?: string }[];
  icon?: NotionIcon | null;
}

/** Fetch + map a database to the ASCII mockup (title/icon + the selected view, rows as cards/cells). */
async function renderDatabaseMockup(
  databaseId: string,
  dataSourceId: string,
  schema: PropertiesMap,
  viewSelector: string | number | undefined,
): Promise<string> {
  const dbResponse = await publicRequest("GET", `/v1/databases/${databaseId}`);
  const database = dbResponse.ok ? (dbResponse.body as DatabaseTitleBody) : {};
  const title = richTextToPlain(database.title) || "(database)";
  const idToName = buildIdToName(schema);
  const titleColumn =
    Object.entries(schema).find(([, property]) => property.type === "title")?.[0] ?? Object.keys(schema)[0] ?? "Name";

  // Order views the way Notion shows them. The public API exposes no tab order or default-view signal, so
  // we read the container block's `view_ids` via private api/v3 (databaseId IS the collection_view block
  // id); that order also excludes views belonging to OTHER linked-DB containers sharing this data source.
  // Falls back to public order if token_v2 is absent. `viewSelector` picks which view to render.
  const rawViews = await fetchViews(dataSourceId);
  const ordered = orderViews(rawViews, await readViewOrder(databaseId), databaseId);
  const views = ordered.map((view) => {
    const resolved = resolveView(view, idToName);
    resolved.columns = [titleColumn, ...resolved.columns.filter((column) => column !== titleColumn)];
    if (resolved.type === "board") {
      resolved.groupOptions = groupOptionsFor(resolved.groupBy, schema);
    }
    return resolved;
  });
  const selectedIndex = selectViewIndex(ordered, viewSelector);

  // Sample the rows the SELECTED view actually shows — apply its filter + sorts + quick_filters so the
  // mockup matches the live view (a board's filtered-out rows must NOT appear). Compact preview, so we
  // cap; fetch one past the cap to flag "there are more". A filter Notion rejects → unfiltered fallback.
  const selected = ordered[selectedIndex];
  const filter = selected ? viewQueryFilter(selected) : undefined;
  const sorts = selected?.sorts ?? undefined;
  const queryBody: Record<string, unknown> = { page_size: SAMPLE_CAP + 1 };
  if (filter) {
    queryBody.filter = filter;
  }
  if (sorts) {
    queryBody.sorts = sorts;
  }
  let query = await publicRequest("POST", `/v1/data_sources/${dataSourceId}/query`, queryBody);
  if (!query.ok && (filter || sorts)) {
    query = await publicRequest("POST", `/v1/data_sources/${dataSourceId}/query`, { page_size: SAMPLE_CAP + 1 });
  }
  const fetched = query.ok ? ((query.body as QueryResponse).results ?? []) : [];
  const truncated = fetched.length > SAMPLE_CAP;
  const rows = truncated ? fetched.slice(0, SAMPLE_CAP) : fetched;

  const model = databaseToModel({
    title,
    icon: iconGlyph(database.icon),
    titleColumn,
    views: views.length ? views : [{ name: "Table", type: "table", columns: [titleColumn] }],
    rows,
  });
  model.view = views.length ? selectedIndex : 0;
  const body = renderDatabase(model);

  return truncated ? `${body}\n\n(mockup preview — showing the first ${SAMPLE_CAP} rows; the database has more)` : body;
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
      "as scalars. format (required): table | kv | tsv | summary | mockup (render the live DB as the ASCII view mockup — its DEFAULT view, or pass `view` by name/id/index; samples the rows that view actually shows, with its filter+sorts applied). table=GFM, kv, tsv, summary=grouped " +
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
      view: z
        .union([z.string(), z.number()])
        .optional()
        .describe("mockup only: render a specific view by name, id, or index (default: the DB's default view)."),
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

    try {
      const dataSourceId = await resolveDataSourceId(databaseId);

      const schemaResponse = await publicRequest("GET", `/v1/data_sources/${dataSourceId}`);
      if (!schemaResponse.ok) {
        return err(`Could not read the data source ${dataSourceId} — check the id and that NOTION_TOKEN has access.`);
      }
      const schema = (schemaResponse.body as DataSourceSchema).properties ?? {};

      if (format === "mockup") {
        const viewSelector = typeof args.view === "string" || typeof args.view === "number" ? args.view : undefined;
        return ok(await renderDatabaseMockup(databaseId, dataSourceId, schema, viewSelector));
      }

      // Past the mockup early-return, format is one of the row formats — the cast is now sound.
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
        const flatRow: Record<string, FlattenedProperty> = {};
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
