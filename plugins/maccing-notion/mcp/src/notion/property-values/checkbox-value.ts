// mirrors developers.notion.com/reference/page-property-values — checkbox property value
import { z } from "zod";

export const checkboxValue = z.object({
  id: z.string().optional(),
  type: z.literal("checkbox"),
  checkbox: z.boolean(),
});

export type CheckboxValue = z.infer<typeof checkboxValue>;
