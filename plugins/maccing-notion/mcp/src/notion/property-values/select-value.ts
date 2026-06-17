// mirrors developers.notion.com/reference/page-property-values — select property value
// The option shape is shared with status and multi_select — id is optional (absent on hand-authored proposals).
import { z } from "zod";

export const selectOption = z.object({
  id: z.string().optional(),
  name: z.string(),
  color: z.string().optional(),
});

export const selectValue = z.object({
  id: z.string().optional(),
  type: z.literal("select"),
  select: selectOption.nullable(),
});

export type SelectOption = z.infer<typeof selectOption>;
export type SelectValue = z.infer<typeof selectValue>;
