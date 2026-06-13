// Pure planners for re-ordering a property list — used for BOTH a view's columns
// (configuration.properties: {property_id, visible, width}) and the canonical page order
// (collection.format.collection_page_properties: {property, visible}). Reorders to a requested
// sequence with the title pinned first and unlisted entries appended in their current relative order,
// PRESERVING each entry's visibility/width (the correctness trap: never silently un-hide a column).
// Ordering ONLY — visibility is a separate concern (upsert_property for the canonical default). No API.

export interface ViewProp {
  property_id: string;
  visible?: boolean;
  width?: number;
  property_name?: string;
}

export interface PageProp {
  property: string;
  visible?: boolean;
}

/** Property ids appear url-encoded on the schema but decoded in view configs — decode for matching. */
function decode(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

/**
 * Reorder a view's columns to `order` (ids, encoded or decoded). Title is pinned first; the requested
 * order follows; remaining columns keep their current relative order. Visibility/width are preserved.
 */
export function reorderViewProperties(current: ViewProp[], order: string[]): ViewProp[] {
  const byDecoded = new Map<string, ViewProp>();
  for (const prop of current) {
    byDecoded.set(decode(prop.property_id), prop);
  }

  const used = new Set<string>();
  const out: ViewProp[] = [];

  const push = (rawId: string): void => {
    const id = decode(rawId);
    if (used.has(id)) {
      return;
    }
    const prop = byDecoded.get(id);
    if (!prop) {
      return;
    }
    used.add(id);

    const entry: ViewProp = { property_id: prop.property_id };
    if (prop.visible !== undefined) {
      entry.visible = prop.visible;
    }
    if (prop.width !== undefined) {
      entry.width = prop.width;
    }
    out.push(entry);
  };

  push("title"); // Notion pins the title column first; keep it there
  for (const id of order) {
    push(id);
  }
  for (const prop of current) {
    push(prop.property_id); // remainder, in current relative order
  }

  return out;
}

/** The canonical-page-order analog: reorder a {property, visible} list, preserving visibility. */
export function reorderPageProperties(current: PageProp[], order: string[]): PageProp[] {
  const asView = current.map((prop) => ({ property_id: prop.property, visible: prop.visible }));
  return reorderViewProperties(asView, order).map((prop) => {
    const entry: PageProp = { property: prop.property_id };
    if (prop.visible !== undefined) {
      entry.visible = prop.visible;
    }
    return entry;
  });
}
