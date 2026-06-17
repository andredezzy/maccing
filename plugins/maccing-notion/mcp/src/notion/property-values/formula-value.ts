// mirrors developers.notion.com/reference/page-property-values — formula property value (read-only)
// readers/page.ts flattenFormula reads: formula.type, then formula[formula.type], or formula.date.start
import { z } from "zod";

// A formula's date result can return a null/absent start, unlike datePayload (where start is required),
// so this is intentionally its own shape rather than a reuse of datePayload.
const formulaDateResult = z.object({
  start: z.string().nullable().optional(),
  end: z.string().nullable().optional(),
});

const formulaPayload = z.object({
  type: z.string(),
  string: z.string().nullable().optional(),
  number: z.number().nullable().optional(),
  boolean: z.boolean().nullable().optional(),
  date: formulaDateResult.nullable().optional(),
});

export const formulaValue = z.object({
  id: z.string().optional(),
  type: z.literal("formula"),
  formula: formulaPayload,
});

export type FormulaValue = z.infer<typeof formulaValue>;
