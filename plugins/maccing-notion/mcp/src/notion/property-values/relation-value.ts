// mirrors developers.notion.com/reference/page-property-values — relation property value
// has_more is a property-level flag (>25 relation refs truncated); readers/page.ts flattenProperty reads it at property.has_more
import { z } from "zod";

const relationRef = z.object({ id: z.string() });

export type RelationRef = z.infer<typeof relationRef>;

export const relationValue = z.object({
  id: z.string().optional(),
  type: z.literal("relation"),
  relation: z.array(relationRef),
  has_more: z.boolean().optional(),
});

export type RelationValue = z.infer<typeof relationValue>;
