// Pure renderer for read_database's include_views output — turns raw Notion view objects into
// agent-ready text with EVERY config field shown (cover, card size, layout, group_by, chart axes,
// visible properties, sorts, filters) and opaque property ids resolved to names. No API calls.

import { abbreviateId } from "./abbreviate-id";
import { idVariants } from "./id-variants";

export type IdToName = Record<string, string>;

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
    const byId = new Map(views.map((v) => [v.id, v]));
    const ordered = viewIds.map((id) => byId.get(id)).filter((v): v is RawView => Boolean(v));
    if (ordered.length) {
      return ordered;
    }
  }
  const own = views.filter((v) => v.parent?.database_id === databaseId);
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
export function viewQueryFilter(view: RawView): unknown | undefined {
  if (view.filter) {
    return view.filter;
  }
  const quick = Object.entries((view.quick_filters ?? {}) as Record<string, object>).map(
    ([propertyId, condition]) => ({ property: propertyId, ...condition }),
  );
  if (quick.length === 0) {
    return undefined;
  }
  return quick.length === 1 ? quick[0] : { and: quick };
}

/** Resolve a `view` selector (numeric index | exact name | id | partial name, case-insensitive) to an
 * index into the ordered views. Anything unmatched (or undefined) falls back to 0 (the default view). */
export function selectViewIndex(
  views: { name?: string; id?: string }[],
  selector: string | number | undefined,
): number {
  if (selector === undefined || views.length === 0) {
    return 0;
  }
  if (typeof selector === "number") {
    return selector >= 0 && selector < views.length ? selector : 0;
  }
  const needle = selector.toLowerCase();
  const exact = views.findIndex((v) => v.name?.toLowerCase() === needle || v.id === selector);
  if (exact >= 0) {
    return exact;
  }
  const partial = views.findIndex((v) => v.name?.toLowerCase().includes(needle));
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
  for (const variant of idVariants(id, false)) {
    if (idToName[variant]) {
      return idToName[variant];
    }
  }
  return id;
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
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
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
      `## ${view.name ?? "(untitled)"} · ${view.type ?? "?"}  (id: ${view.id ? abbreviateId(view.id) : "?"})`,
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
