// View-layer utilities: fetch a data source's view ids then each view's full config (listViewIds +
// fetchViews — the two network calls here), then PURE transforms over raw Notion view objects — order
// them as Notion shows (orderViews), pick one
// (selectViewIndex), derive a row-sampling filter (viewQueryFilter), and render every config field with
// opaque property ids resolved to names (formatViews).

import { decodePropertyId, idVariants } from "../notion/ids";
import { publicRequest } from "../notion/public-client";
import type { PropertiesMap } from "./schema";

// View resolution (pure)

/** A view with its property IDs already resolved to names by the caller. */
export interface ResolvedView {
  name: string;
  type: string;
  columns: string[]; // visible column NAMES (title first)
  groupBy?: string; // board group-by column name
  groupOptions?: string[]; // board: every group-by option name, in order (seeds empty columns too)
  dateProperty?: string; // calendar/timeline date column name
}

interface ViewConfigProperty {
  property_id?: string;
  property_name?: string;
  visible?: boolean;
}
interface ViewConfig {
  properties?: ViewConfigProperty[];
  group_by?: { property_id?: string };
  date_property_id?: string;
  date_property_name?: string;
}

/**
 * Resolve a raw Notion view's config (property ids → names) into a ResolvedView the mapper consumes.
 *
 * NOTE — two-step contract for board views: `groupOptions` is always `undefined` on return.
 * After calling this, assign `resolved.groupOptions = groupOptionsFor(resolved.groupBy, schema)`
 * to seed the board's option columns. Schema is not taken here to keep the function pure and
 * independently testable — see the `groupOptionsFor` export.
 */
export function resolveView(view: RawView, idToName: IdToName): ResolvedView {
  const config = (view.configuration ?? {}) as ViewConfig;
  const resolve = (id: string | undefined): string | undefined =>
    id ? (idToName[id] ?? idToName[decodePropertyId(id)]) : undefined;
  const columns = (config.properties ?? [])
    .filter((viewProperty) => viewProperty.visible !== false)
    .map((viewProperty) => resolve(viewProperty.property_id) ?? viewProperty.property_name)
    .filter((name): name is string => Boolean(name));
  return {
    name: view.name ?? "View",
    type: view.type ?? "table",
    columns,
    groupBy: resolve(config.group_by?.property_id),
    dateProperty: resolve(config.date_property_id) ?? config.date_property_name,
  };
}

/** A board's columns are its group-by property's options — return them in schema order so the mockup
 * draws every status/select column (even empty ones), matching how Notion lays out the board. */
export function groupOptionsFor(groupBy: string | undefined, schema: PropertiesMap): string[] | undefined {
  if (!groupBy) {
    return undefined;
  }
  const property = schema[groupBy];
  const options = property?.status?.options ?? property?.select?.options ?? property?.multi_select?.options;
  const names = (options ?? []).map((option) => option.name).filter((name): name is string => Boolean(name));
  return names.length ? names : undefined;
}

/** Concurrent GET /v1/views/{id} per batch — conservative vs the general rate limit (cf. PAGE_FETCH_BATCH_SIZE). */
const VIEW_FETCH_BATCH_SIZE = 10;

export type IdToName = Record<string, string>;

/** Invert a data-source schema into a property-id → name map, keyed by BOTH the raw and decoded id forms. */
export function buildIdToName(schema: PropertiesMap): IdToName {
  const idToName: IdToName = {};
  for (const [name, property] of Object.entries(schema)) {
    if (!property.id) {
      continue;
    }
    idToName[property.id] = name;
    idToName[decodePropertyId(property.id)] = name; // also key by the decoded form (idempotent if unencoded)
  }
  return idToName;
}

interface ViewIdListResponse {
  results?: { id: string }[];
  has_more?: boolean;
  next_cursor?: string | null;
}

/** List a data source's view ids, paginated to the end (the public API caps each page at 100).
 * Throws on a non-ok response mid-pagination (consistent with resolveRelations throwing on 429). */
export async function listViewIds(dataSourceId: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const query: Record<string, unknown> = { data_source_id: dataSourceId, page_size: 100 };
    if (cursor) {
      query.start_cursor = cursor;
    }
    const response = await publicRequest("GET", "/v1/views", undefined, query);
    if (!response.ok) {
      throw new Error(
        `Failed to list views for data source ${dataSourceId} (status ${response.status ?? "unknown"}): ${JSON.stringify(response.body).slice(0, 200)}`,
      );
    }
    const body = response.body as ViewIdListResponse;
    ids.push(...(body.results ?? []).map((view) => view.id));
    cursor = body.has_more ? (body.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return ids;
}

export interface RawView {
  id?: string;
  name?: string;
  type?: string;
  url?: string;
  parent?: { database_id?: string };
  sorts?: SortEntry[] | null;
  filter?: unknown;
  quick_filters?: unknown;
  configuration?: Record<string, unknown> | null;
}

/** List a data source's view ids (paginated), then fetch each view's full configuration. */
export async function fetchViews(dataSourceId: string): Promise<RawView[]> {
  const ids = await listViewIds(dataSourceId);

  const views: RawView[] = [];
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

/**
 * Order a data source's views the way Notion shows them, dropping views that belong to OTHER linked-DB
 * containers sharing this data source (a different `parent.database_id`). `viewIds` is the container
 * block's `view_ids` (private api/v3) — its order IS the tab order and `viewIds[0]` is the default view;
 * it also defines membership, so foreign views fall away. When `viewIds` is null (token_v2 absent / private
 * read failed), fall back to filtering by `parent.database_id`, preserving the public list order; if that
 * filter would empty the set, keep the unfiltered views rather than render nothing.
 */
export function orderViews(views: RawView[], viewIds: string[] | null, databaseId: string): RawView[] {
  if (viewIds) {
    const byId = new Map(views.map((view) => [view.id, view]));
    const ordered = viewIds.map((id) => byId.get(id)).filter((view): view is RawView => Boolean(view));
    if (ordered.length) {
      return ordered;
    }
  }
  const own = views.filter((view) => view.parent?.database_id === databaseId);
  return own.length ? own : views;
}

/**
 * The Notion `/query` filter that reproduces a view's rows, so a mockup samples what the VIEW shows.
 * A view's saved `filter` is already a valid (≤2-level) filter — pass it VERBATIM. Do NOT wrap it in an
 * extra `and` to fold in quick_filters: Notion caps filter nesting at 2 levels, so `and → (saved or/and)`
 * → 400. Quick_filters are therefore a FALLBACK used only when there's no saved filter (they're leaf
 * conditions — AND-ing several stays at 1 level). The caller falls back to an unfiltered sample if Notion
 * still rejects the shape. Returns undefined when the view has no filter at all.
 */
export function viewQueryFilter(view: RawView): unknown {
  if (view.filter) {
    return view.filter;
  }
  const quick = Object.entries((view.quick_filters ?? {}) as Record<string, unknown>).map(
    ([propertyId, condition]) => ({
      property: propertyId,
      ...(condition as Record<string, unknown>),
    }),
  );
  if (quick.length === 0) {
    return undefined;
  }
  return quick.length === 1 ? quick[0] : { and: quick };
}

/** The fields selectViewIndex matches a `view` selector against. */
interface ViewSelector {
  name?: string;
  id?: string;
}

/** Resolve a `view` selector (numeric index | exact name | id | partial name, case-insensitive) to an
 * index into the ordered views. Anything unmatched (or undefined) falls back to 0 (the default view). */
export function selectViewIndex(views: ViewSelector[], selector: string | number | undefined): number {
  if (selector === undefined || views.length === 0) {
    return 0;
  }
  if (typeof selector === "number") {
    return selector >= 0 && selector < views.length ? selector : 0;
  }
  const needle = selector.toLowerCase();
  const exact = views.findIndex((view) => view.name?.toLowerCase() === needle || view.id === selector);
  if (exact >= 0) {
    return exact;
  }
  const partial = views.findIndex((view) => view.name?.toLowerCase().includes(needle));
  return partial >= 0 ? partial : 0;
}

interface SortEntry {
  property?: string;
  direction?: string;
}

/** Resolve a property id (raw or url-encoded) to its name, falling back to the id itself.
 * `nameFor` guards with a direct lookup first, then calls idVariants with includeRaw=false
 * to avoid a redundant second lookup of the raw id. */
function nameFor(id: string, idToName: IdToName): string {
  if (idToName[id]) {
    return idToName[id];
  }
  const variant = idVariants(id, false).find((candidate) => idToName[candidate]);
  return variant ? idToName[variant] : id;
}

/**
 * Deep-clone a config/filter value, annotating every property reference with a resolved `property_name`.
 * Views reference properties two ways: `property_id` (in configuration) and `property` (in filters/sorts).
 */
function resolveDeep(value: unknown, idToName: IdToName): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveDeep(item, idToName));
  }

  if (value && typeof value === "object") {
    const annotated: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      annotated[key] = resolveDeep(inner, idToName);
      if ((key === "property_id" || key === "property") && typeof inner === "string") {
        annotated.property_name = nameFor(inner, idToName);
      }
    }
    return annotated;
  }

  return value;
}

function renderSorts(sorts: SortEntry[] | null | undefined, idToName: IdToName): string {
  if (!sorts || sorts.length === 0) {
    return "—";
  }
  return sorts
    .map((sort) => {
      const descending = sort.direction === "descending";
      const name = nameFor(String(sort.property ?? ""), idToName);

      // Arrow for the human; the full API word ("descending"/"ascending") so an agent
      // can lift it straight into a write payload's `direction` with no translation.
      return `${name} ${descending ? "↓ descending" : "↑ ascending"}`;
    })
    .join(", ");
}

/** Render every view with its complete, id-resolved configuration. */
export function formatViews(views: RawView[], idToName: IdToName): string {
  if (views.length === 0) {
    return "# Views (0)\n(none — or the integration can't read them)";
  }

  const blocks = views.map((view) => {
    const lines = [
      `## ${view.name ?? "(untitled)"} · ${view.type ?? "?"}  (id: ${view.id ? view.id : "?"})`,
      view.url ? `url: ${view.url}` : null,
      `sorts: ${renderSorts(view.sorts, idToName)}`,
      `filter: ${view.filter ? JSON.stringify(resolveDeep(view.filter, idToName)) : "—"}`,
      `quick_filters: ${view.quick_filters ? JSON.stringify(resolveDeep(view.quick_filters, idToName)) : "—"}`,
    ].filter((line): line is string => line !== null);

    if (view.configuration) {
      lines.push("configuration:");
      lines.push(JSON.stringify(resolveDeep(view.configuration, idToName), null, 2));
    }

    return lines.join("\n");
  });

  return `# Views (${views.length})\n\n${blocks.join("\n\n")}`;
}
