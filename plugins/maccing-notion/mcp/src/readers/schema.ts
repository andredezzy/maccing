// Pure renderer for a data source's SCHEMA — the column definitions as `name · type · detail`, with
// formula bodies ELIDED (never the compiled {{notion:…}} blob that bloats the raw GET) and
// relations/rollups summarized. Optional per-column icons are INJECTED, not fetched here, so this
// stays pure and unit-testable with zero network calls.

import { decodePropertyId, idVariants } from "../notion/ids";
import { publicRequest } from "../notion/public-client";

interface SchemaRollupConfig {
  function?: string;
  rollup_property_name?: string;
  relation_property_name?: string;
}

interface SchemaProperty {
  id?: string;
  name?: string;
  type?: string;
  number?: { format?: string };
  rollup?: SchemaRollupConfig;
  relation?: { type?: string };
  select?: { options?: { name?: string }[] };
  multi_select?: { options?: { name?: string }[] };
  status?: { options?: { name?: string }[] };
  formula?: unknown;
}

export type PropertiesMap = Record<string, SchemaProperty>;

/** Minimal id+name reference for a schema property — the projection the upsert/order tools map names↔ids with. */
export interface SchemaPropertyRef {
  id: string;
  name: string;
}

/** The GET /v1/data_sources/{id} response envelope, projected to the property id+name refs. */
export interface SchemaBody {
  properties?: Record<string, SchemaPropertyRef>;
}

/** The GET /v1/databases/{id} response envelope — links a database to its canonical data source(s). */
export interface DataSourceBody {
  data_sources?: { id: string }[];
}

/**
 * Scan a schema for a property matching by name, raw id, or decoded id.
 * Returns the DECODED internal id, or null if no match.
 *
 * Note on diverging fallbacks:
 *   - `namesToDecodedIds` (order-properties) falls back to `decodePropertyId(name)` when unmatched
 *     (treats the input as an already-id-like string).
 *   - `resolvePropertyId` (upsert-property) returns null when unmatched (strict: no fallback).
 *   Each caller preserves its own fallback logic; only the scan kernel is shared.
 */
export function findSchemaPropertyId(schema: Record<string, SchemaPropertyRef>, nameOrId: string): string | null {
  for (const propertyRef of Object.values(schema)) {
    const decoded = decodePropertyId(propertyRef.id);
    if (propertyRef.name === nameOrId || propertyRef.id === nameOrId || decoded === nameOrId) {
      return decoded;
    }
  }
  return null;
}

/** Extract the first data_source id from a GET /v1/databases/{id} response body (pure, no I/O). */
export function extractDataSourceId(body: unknown): string | undefined {
  return (body as DataSourceBody).data_sources?.[0]?.id;
}

/** GET /v1/databases/{id} → first data_source id, or undefined when absent / request failed. */
export async function databaseToDataSourceId(databaseId: string): Promise<string | undefined> {
  const response = await publicRequest("GET", `/v1/databases/${databaseId}`);
  if (!response.ok) {
    return undefined;
  }
  return extractDataSourceId(response.body as DataSourceBody);
}

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
