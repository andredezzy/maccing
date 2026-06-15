// Pure planners for re-ordering a property list — used for BOTH a view's columns
// (configuration.properties: {property_id, visible, width}) and the canonical page order
// (collection.format.collection_page_properties: {property, visible}). Reorders to a requested
// sequence — title kept first ONLY when unlisted (Notion now lets a table view's title column be
// reordered; list "title" in `order` to move it), unlisted entries appended in their current relative
// order, PRESERVING each entry's visibility/width (the correctness trap: never silently un-hide a column).
// Ordering ONLY — visibility is a separate concern (upsert_property for the canonical default). No API.

import { decodePropertyId } from "../notion/ids";

export interface ViewProperty {
  property_id: string;
  visible?: boolean;
  width?: number;
  property_name?: string;
}

interface PageProperty {
  property: string;
  visible?: boolean;
}

/**
 * Reorder a view's columns to `order` (ids, encoded or decoded). Title is kept first only when it is
 * NOT in `order` (it can now be moved — list "title" to position it); the requested order follows;
 * remaining columns keep their current relative order. Visibility/width are preserved.
 */
export function reorderViewProperties(current: ViewProperty[], order: string[]): ViewProperty[] {
  const byDecoded = new Map<string, ViewProperty>();
  for (const viewProperty of current) {
    byDecoded.set(decodePropertyId(viewProperty.property_id), viewProperty);
  }

  const used = new Set<string>();
  const reordered: ViewProperty[] = [];

  const appendDeduped = (rawId: string): void => {
    const id = decodePropertyId(rawId);
    if (used.has(id)) {
      return;
    }
    const viewProperty = byDecoded.get(id);
    if (!viewProperty) {
      return;
    }
    used.add(id);

    const entry: ViewProperty = { property_id: viewProperty.property_id };
    if (viewProperty.visible !== undefined) {
      entry.visible = viewProperty.visible;
    }
    if (viewProperty.width !== undefined) {
      entry.width = viewProperty.width;
    }
    reordered.push(entry);
  };

  // Notion USED to pin the title column first, but a table view now lets the title be reordered
  // (live-verified 2026-06-14: a Training Log "Note" title column placed after "Hard sets" rendered
  // there). So keep title first ONLY when the caller didn't explicitly place it; if "title" is in
  // `order`, honor that position like any other property.
  const titlePlacedExplicitly = order.some((rawId) => decodePropertyId(rawId) === "title");
  if (!titlePlacedExplicitly) {
    appendDeduped("title");
  }

  for (const id of order) {
    appendDeduped(id);
  }

  for (const viewProperty of current) {
    appendDeduped(viewProperty.property_id); // remainder, in current relative order
  }

  return reordered;
}

/** The canonical-page-order analog: reorder a {property, visible} list, preserving visibility. */
export function reorderPageProperties(current: PageProperty[], order: string[]): PageProperty[] {
  const asView = current.map((pageProperty) => ({ property_id: pageProperty.property, visible: pageProperty.visible }));
  return reorderViewProperties(asView, order).map((viewProperty) => {
    const entry: PageProperty = { property: viewProperty.property_id };
    if (viewProperty.visible !== undefined) {
      entry.visible = viewProperty.visible;
    }
    return entry;
  });
}

/** Seed a page-order list from a data-source schema: every property, default-visible — the starting
 * point when a collection has no saved page order yet (property ids decoded for the write payload). */
export function seedPageOrderFromSchema(schema: Record<string, { id: string }>): PageProperty[] {
  return Object.values(schema).map((property) => ({ property: decodePropertyId(property.id), visible: true }));
}
