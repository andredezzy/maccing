// Pure renderer for read_database's include_views output — turns raw Notion view objects into
// agent-ready text with EVERY config field shown (cover, card size, layout, group_by, chart axes,
// visible properties, sorts, filters) and opaque property ids resolved to names. No API calls.

export type IdToName = Record<string, string>;

export interface RawView {
  id?: string;
  name?: string;
  type?: string;
  url?: string;
  sorts?: SortEntry[] | null;
  filter?: unknown;
  quick_filters?: unknown;
  configuration?: Record<string, unknown> | null;
}

interface SortEntry {
  property?: string;
  direction?: string;
}

const short = (id: string): string => `${id.slice(0, 8)}…${id.slice(-4)}`;

/** Resolve a property id (raw or url-encoded) to its name, falling back to the id itself. */
function nameFor(id: string, idToName: IdToName): string {
  if (idToName[id]) {
    return idToName[id];
  }
  for (const variant of idVariants(id)) {
    if (idToName[variant]) {
      return idToName[variant];
    }
  }
  return id;
}

/** The decoded and encoded forms of an id — Notion stores property ids in either form across endpoints. */
function idVariants(id: string): string[] {
  const variants: string[] = [];
  try {
    variants.push(decodeURIComponent(id));
  } catch {
    // not url-encoded
  }
  try {
    variants.push(encodeURIComponent(id));
  } catch {
    // unencodable — skip
  }
  return variants;
}

/** Deep-clone a config value, annotating every `property_id` with a resolved `property_name`. */
function resolveDeep(value: unknown, idToName: IdToName): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveDeep(item, idToName));
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = resolveDeep(inner, idToName);
      if (key === "property_id" && typeof inner === "string") {
        out.property_name = nameFor(inner, idToName);
      }
    }
    return out;
  }

  return value;
}

function renderSorts(sorts: SortEntry[] | null | undefined, idToName: IdToName): string {
  if (!sorts || sorts.length === 0) {
    return "—";
  }
  return sorts
    .map((sort) => `${nameFor(String(sort.property ?? ""), idToName)} ${sort.direction === "descending" ? "↓" : "↑"}`)
    .join(", ");
}

/** Render every view with its complete, id-resolved configuration. */
export function formatViews(views: RawView[], idToName: IdToName): string {
  if (views.length === 0) {
    return "# Views (0)\n(none — or the integration can't read them)";
  }

  const blocks = views.map((view) => {
    const lines = [
      `## ${view.name ?? "(untitled)"} · ${view.type ?? "?"}  (id: ${view.id ? short(view.id) : "?"})`,
      `sorts: ${renderSorts(view.sorts, idToName)}`,
    ];

    if (view.url) {
      lines.push(`url: ${view.url}`);
    }
    if (view.filter) {
      lines.push(`filter: ${JSON.stringify(resolveDeep(view.filter, idToName))}`);
    }
    if (view.quick_filters) {
      lines.push(`quick_filters: ${JSON.stringify(resolveDeep(view.quick_filters, idToName))}`);
    }
    if (view.configuration) {
      lines.push("configuration:");
      lines.push(JSON.stringify(resolveDeep(view.configuration, idToName), null, 2));
    }

    return lines.join("\n");
  });

  return `# Views (${views.length})\n\n${blocks.join("\n\n")}`;
}
