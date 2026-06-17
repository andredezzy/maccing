// mirrors developers.notion.com/reference/page-property-values — rollup property value (read-only)
// readers/page.ts flattenRollup reads: rollup.type, rollup.number, rollup.date.start, rollup.array
import { z } from "zod";
import { datePayload } from "./date-value";

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

export type RollupValue = z.infer<typeof rollupValue>;
