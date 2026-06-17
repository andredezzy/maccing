import type { PropertyValue } from "../notion/property-values/property-value";
import { propertyToString } from "../readers/page";

// The display string for one property-value cell in a database mockup. Delegates to propertyToString
// (the single source of truth shared with read_page's frontmatter) and handles the relation case, which
// propertyToString surfaces as ids — here a database cell shows the link count instead.
export function renderPropertyValue(value: PropertyValue): string {
  if (value.type === "relation") {
    const count = value.relation.length;
    return count > 0 ? `${count} linked` : "";
  }
  return propertyToString(value);
}
