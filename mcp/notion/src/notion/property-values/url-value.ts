// mirrors developers.notion.com/reference/page-property-values — url property value
import { z } from "zod";

export const urlValue = z.object({
  id: z.string().optional(),
  type: z.literal("url"),
  url: z.string().nullable(),
});
