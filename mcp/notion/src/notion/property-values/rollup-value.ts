// mirrors developers.notion.com/reference/page-property-values — rollup property value (read-only)
// readers/page.ts flattenRollup reads: rollup.type, rollup.number, rollup.date.start, rollup.array
import { z } from "zod";
import { datePayload } from "./date-value";

// Flat object by design (not a discriminatedUnion on `type`): a rollup VALUE is a read-only computed result
// the API returns well-formed and proposals never author, and readers/page.ts reads it via dynamic
// `rollup[rollup.type]` access — the flat optional shape supports that directly. (Same rationale as formula.)
const rollupPayload = z.object({
  type: z.string(),
  number: z.number().nullable().optional(),
  date: datePayload.nullable().optional(),
  array: z.array(z.unknown()).optional(),
  function: z.string().optional(),
});

export const rollupValue = z.object({
  id: z.string().optional(),
  type: z.literal("rollup"),
  rollup: rollupPayload,
});
