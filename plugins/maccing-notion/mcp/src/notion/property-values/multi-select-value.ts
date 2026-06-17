// mirrors developers.notion.com/reference/page-property-values — multi_select property value
import { z } from "zod";
import { selectOption } from "./select-value";

export const multiSelectValue = z.object({
  id: z.string().optional(),
  type: z.literal("multi_select"),
  multi_select: z.array(selectOption),
});

export type MultiSelectValue = z.infer<typeof multiSelectValue>;
