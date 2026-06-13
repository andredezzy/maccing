// Pure planner for re-ordering a VIEW's columns — the per-view layer (a view's configuration.properties),
// distinct from a property's schema definition. Reorders to a requested sequence with the title pinned
// first and any unlisted columns appended in their current relative order, PRESERVING each column's
// visibility and width (the correctness trap: never silently un-hide a filtered column). No API calls.

export interface ViewProp {
  property_id: string;
  visible?: boolean;
  width?: number;
  property_name?: string;
}

export interface ReorderOptions {
  /** Decoded property ids to force-hide / force-show; everything else keeps its current visibility. */
  hide?: Set<string>;
  show?: Set<string>;
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
 * order follows; any remaining columns keep their current relative order at the end. Visibility/width
 * are preserved unless overridden by options.hide / options.show.
 */
export function reorderViewProperties(current: ViewProp[], order: string[], options: ReorderOptions = {}): ViewProp[] {
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

    let visible = prop.visible;
    if (options.hide?.has(id)) {
      visible = false;
    }
    if (options.show?.has(id)) {
      visible = true;
    }

    const entry: ViewProp = { property_id: prop.property_id };
    if (visible !== undefined) {
      entry.visible = visible;
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
