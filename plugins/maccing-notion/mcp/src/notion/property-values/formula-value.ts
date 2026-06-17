// mirrors developers.notion.com/reference/page-property-values — formula property value (read-only)
// readers/page.ts flattenFormula reads: formula.type, then formula[formula.type], or formula.date.start
import { z } from "zod";

// A formula's date result can return a null/absent start, unlike datePayload (where start is required),
// so this is intentionally its own shape rather than a reuse of datePayload.
const formulaDateResult = z.object({
  start: z.string().nullable().optional(),
  end: z.string().nullable().optional(),
});

// Deliberately a flat object (not a z.discriminatedUnion on `type`, the canon convention elsewhere): a
// formula VALUE is a read-only computed result the API always returns well-formed and that proposals never
// author, and readers/page.ts consumes it via dynamic `formula[formula.type]` access — which the flat
// optional shape supports directly, whereas a discriminated union would force per-branch narrowing here.
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
