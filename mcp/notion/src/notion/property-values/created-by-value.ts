// mirrors developers.notion.com/reference/page-property-values — created_by property value (read-only)
import { z } from "zod";
import { user } from "../user";

export const createdByValue = z.object({
  id: z.string().optional(),
  type: z.literal("created_by"),
  created_by: user,
});
