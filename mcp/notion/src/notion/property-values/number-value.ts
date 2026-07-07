// mirrors developers.notion.com/reference/page-property-values — number property value
import { z } from "zod";

export const numberValue = z.object({
  id: z.string().optional(),
  type: z.literal("number"),
  number: z.number().nullable(),
});
