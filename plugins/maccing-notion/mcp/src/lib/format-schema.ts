// Pure renderer for a data source's SCHEMA — the column definitions as `name · type · detail`, with
// formula bodies ELIDED (never the compiled {{notion:…}} blob that bloats the raw GET) and
// relations/rollups summarized. Optional per-column icons are INJECTED, not fetched here, so this
// stays pure and unit-testable with zero network — exactly like format-views.

export interface SchemaProperty {
  id?: string;
  name?: string;
  type?: string;
  number?: { format?: string };
  rollup?: { function?: string; rollup_property_name?: string; relation_property_name?: string };
  relation?: { type?: string };
  select?: { options?: unknown[] };
  multi_select?: { options?: unknown[] };
  status?: { options?: unknown[] };
  formula?: unknown;
}

export type PropertiesMap = Record<string, SchemaProperty>;

/** property id (any variant — raw, url-decoded, or url-encoded) → "/icons/<file>_<color>.svg". */
export type IconsById = Record<string, string>;

/** The decoded and encoded forms of an id — Notion stores property ids in either form across endpoints. */
function idVariants(id: string): string[] {
  const variants = [id];
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

/** "/icons/arrows-swap-horizontally_gray.svg" → "arrows-swap-horizontally·gray" (color = the last _segment). */
function prettyIcon(asset: string): string {
  const file = asset.replace(/^\/icons\//, "").replace(/\.svg$/, "");
  const cut = file.lastIndexOf("_");
  return cut === -1 ? file : `${file.slice(0, cut)}·${file.slice(cut + 1)}`;
}

/** Find a column's icon by trying every id variant against the (raw-id-keyed) private icon map. */
function iconFor(id: string | undefined, icons: IconsById): string | null {
  if (!id) {
    return null;
  }
  for (const variant of idVariants(id)) {
    if (icons[variant]) {
      return prettyIcon(icons[variant]);
    }
  }
  return null;
}

/** One-line summary after the type — formula body is NEVER included, only the word "formula". */
function typeDetail(meta: SchemaProperty): string {
  switch (meta.type) {
    case "number": {
      const format = meta.number?.format;
      return format && format !== "number" ? format : "";
    }
    case "relation":
      return meta.relation?.type === "dual_property" ? "dual" : "single";
    case "rollup": {
      const rollup = meta.rollup;
      if (!rollup?.function) {
        return "";
      }
      const target = rollup.rollup_property_name ? `(${rollup.rollup_property_name})` : "";
      const via = rollup.relation_property_name ? ` via ${rollup.relation_property_name}` : "";
      return `${rollup.function}${target}${via}`;
    }
    case "select":
    case "multi_select":
    case "status": {
      const count = meta[meta.type]?.options?.length;
      return count ? `${count} options` : "";
    }
    default:
      return "";
  }
}

/** Render a data source's schema: one padded `name · type · detail` line per column, icons appended when known. */
export function formatSchema(properties: PropertiesMap, icons: IconsById = {}): string {
  const names = Object.keys(properties);
  if (names.length === 0) {
    return "# Schema (0 columns)";
  }

  const pad = Math.max(...names.map((name) => name.length)) + 2;

  const lines = names.map((name) => {
    const meta = properties[name];
    const detail = typeDetail(meta);
    const icon = iconFor(meta.id, icons);

    const typeCell = `${meta.type ?? "?"}${detail ? ` · ${detail}` : ""}`;
    const iconCell = icon ? `   [icon ${icon}]` : "";
    return `${name.padEnd(pad)}${typeCell}${iconCell}`;
  });

  return `# Schema (${names.length} columns)\n\n${lines.join("\n")}`;
}
