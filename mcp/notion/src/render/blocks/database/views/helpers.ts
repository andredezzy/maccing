// Shared pure helpers used by all view renderers — column resolution, cell value extraction, board group seeding.
// These read from official ViewObject / PageObject / DataSourceObject; no simplified intermediate shapes.

import type { DataSourceObject } from "../../../../notion/data-source";
import type { PageObject } from "../../../../notion/page";
import type { ViewObject } from "../../../../notion/view";
import { buildIdToName } from "../../../../readers/views";
import { renderPropertyValue } from "../../../property-value";

/** Resolve the ordered list of VISIBLE column names for a view.
 *  Uses the view's configuration.properties list (filtered to visible, mapped id→name via dataSource).
 *  Falls back to [titleColumn] when the view has no column config. */
export function visibleColumns(view: ViewObject, dataSource: DataSourceObject, titleColumn: string): string[] {
  const schema = dataSource.properties ?? {};
  const idToName = buildIdToName(schema);
  const props = view.configuration?.properties ?? [];
  const names = props
    .filter((property) => property.visible !== false)
    .map((property) => idToName[property.property_id] ?? property.property_id)
    .filter((name): name is string => Boolean(name));
  return names.length ? names : [titleColumn];
}

/** The display string for one cell: property value for that column, or "" if absent. */
export function cellValue(row: PageObject, column: string): string {
  const value = row.properties?.[column];
  if (!value) {
    return "";
  }
  return renderPropertyValue(value);
}

/** The title cell for a row (the title-typed property). */
export function rowTitle(row: PageObject, titleColumn: string): string {
  return cellValue(row, titleColumn) || "(untitled)";
}
