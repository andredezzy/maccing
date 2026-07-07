// mirrors developers.notion.com/reference/page-property-values — last_edited_by property value (read-only)
import { z } from "zod";
import { user } from "../user";

export const lastEditedByValue = z.object({
  id: z.string().optional(),
  type: z.literal("last_edited_by"),
  last_edited_by: user,
});
