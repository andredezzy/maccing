// Pure renderer for a data source's SCHEMA — the column definitions as `name · type · detail`, with
// formula bodies ELIDED (never the compiled {{notion:…}} blob that bloats the raw GET) and
// relations/rollups summarized. Optional per-column icons are INJECTED, not fetched here, so this
// stays pure and unit-testable with zero network — exactly like format-views.

import { idVariants } from "../notion/id-variants";

interface SchemaRollupConfig {
  function?: string;
  rollup_property_name?: string;
  relation_property_name?: string;
}

export interface SchemaProperty {
  id?: string;
  name?: string;
  type?: string;
  number?: { format?: string };
  rollup?: SchemaRollupConfig;
  relation?: { type?: string };
  select?: { options?: unknown[] };
  multi_select?: { options?: unknown[] };
  status?: { options?: unknown[] };
  formula?: unknown;
}

export type PropertiesMap = Record<string, SchemaProperty>;

/** property id (any variant — raw, url-decoded, or url-encoded) → "/icons/<file>_<color>.svg". */
export type IconsById = Record<string, string>;

/** "/icons/arrows-swap-horizontally_gray.svg" → "arrows-swap-horizontally·gray" (color = the last _segment). */
export function formatIconAssetPath(assetPath: string): string {
  const stem = assetPath.replace(/^\/icons\//, "").replace(/\.svg$/, "");
  const colorSeparatorIndex = stem.lastIndexOf("_");
  return colorSeparatorIndex === -1
    ? stem
    : `${stem.slice(0, colorSeparatorIndex)}·${stem.slice(colorSeparatorIndex + 1)}`;
}

/** Find a column's icon by trying every id variant against the (raw-id-keyed) private icon map.
 * `iconFor` has no direct-lookup guard, so idVariants must include the raw id (includeRaw=true). */
function iconFor(id: string | undefined, icons: IconsById): string | null {
  if (!id) {
    return null;
  }
  for (const variant of idVariants(id, true)) {
    if (icons[variant]) {
      return formatIconAssetPath(icons[variant]);
    }
  }
  return null;
}

/** One-line summary after the type — formula body is NEVER included, only the word "formula". */
function typeDetail(property: SchemaProperty): string {
  switch (property.type) {
    case "number": {
      const format = property.number?.format;
      return format && format !== "number" ? format : "";
    }
    case "relation":
      return property.relation?.type === "dual_property" ? "dual" : "single";
    case "rollup": {
      const rollup = property.rollup;
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
      const count = property[property.type]?.options?.length;
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
    const property = properties[name];
    const detail = typeDetail(property);
    const icon = iconFor(property.id, icons);

    const typeCell = `${property.type ?? "?"}${detail ? ` · ${detail}` : ""}`;
    const iconCell = icon ? `   [icon ${icon}]` : "";
    return `${name.padEnd(pad)}${typeCell}${iconCell}`;
  });

  return `# Schema (${names.length} columns)\n\n${lines.join("\n")}`;
}
