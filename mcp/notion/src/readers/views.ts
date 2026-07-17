// View-layer utilities: fetch a data source's view ids then each view's full config (listViewIds +
// fetchViews — the two network calls here), invert a schema into a property-id → name map
// (buildIdToName), and render every view's complete config with ids resolved to names (formatViews).

import { decodePropertyId, idVariants } from "../notion/ids";
import { publicRequest } from "../notion/public-client";
import type { PropertiesMap } from "./schema";

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

/** One-line, id-resolved digest of a view's filter (or quick_filters); "—" when there is none. */
function renderFilter(filter: unknown, idToName: IdToName): string {
  return filter ? JSON.stringify(resolveDeep(filter, idToName)) : "—";
}

/** views="summary" render mode ONLY. First 8 hex chars (hyphens stripped) — a compact pointer back to
 * the view's container, not a usable id. Every other surface in this server shows ids in full; this is
 * the one deliberate exception, which is why the summary section — whenever it has at least one view to
 * show — ends by pointing at views:"full". */
function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}

const FULL_VIEWS_HINT = '(full view configs — required before ANY view PATCH: pass views:"full")';

/** views="summary": one line per view — name, type, container, filter/sorts digests — token-cheap. */
function formatViewsSummary(views: RawView[], idToName: IdToName): string {
  if (views.length === 0) {
    return "# Views (0)\n(none — or the integration can't read them)";
  }

  const lines = views.map((view) => {
    const container = view.parent?.database_id ? shortId(view.parent.database_id) : "?";
    return (
      `${view.name ?? "(untitled)"} · ${view.type ?? "?"} · container ${container} · ` +
      `filter: ${renderFilter(view.filter, idToName)} · sorts: ${renderSorts(view.sorts, idToName)}`
    );
  });

  return `# Views (${views.length})\n\n${lines.join("\n")}\n\n${FULL_VIEWS_HINT}`;
}

/** views="full": every view with its complete, id-resolved configuration. */
function formatViewsFull(views: RawView[], idToName: IdToName): string {
  if (views.length === 0) {
    return "# Views (0)\n(none — or the integration can't read them)";
  }

  const blocks = views.map((view) => {
    const lines = [
      `## ${view.name ?? "(untitled)"} · ${view.type ?? "?"}  (id: ${view.id ? view.id : "?"})`,
      view.url ? `url: ${view.url}` : null,
      `sorts: ${renderSorts(view.sorts, idToName)}`,
      `filter: ${renderFilter(view.filter, idToName)}`,
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

export type ViewsMode = "summary" | "full";

/** Render every view, in either mode (default "full" — the pre-existing complete-dump behavior). */
export function formatViews(views: RawView[], idToName: IdToName, mode: ViewsMode = "full"): string {
  return mode === "summary" ? formatViewsSummary(views, idToName) : formatViewsFull(views, idToName);
}
