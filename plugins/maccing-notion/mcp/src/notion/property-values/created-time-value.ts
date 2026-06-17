// mirrors developers.notion.com/reference/page-property-values — created_time property value (read-only)
import { z } from "zod";

export const createdTimeValue = z.object({
  id: z.string().optional(),
  type: z.literal("created_time"),
  created_time: z.string(),
});
