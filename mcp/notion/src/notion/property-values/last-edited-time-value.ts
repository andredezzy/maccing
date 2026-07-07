// mirrors developers.notion.com/reference/page-property-values — last_edited_time property value (read-only)
import { z } from "zod";

export const lastEditedTimeValue = z.object({
  id: z.string().optional(),
  type: z.literal("last_edited_time"),
  last_edited_time: z.string(),
});
