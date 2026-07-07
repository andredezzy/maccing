// mirrors developers.notion.com/reference/page-property-values — people property value
import { z } from "zod";
import { user } from "../user";

export const peopleValue = z.object({
  id: z.string().optional(),
  type: z.literal("people"),
  people: z.array(user),
});
