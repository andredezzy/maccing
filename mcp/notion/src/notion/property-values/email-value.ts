// mirrors developers.notion.com/reference/page-property-values — email property value
import { z } from "zod";

export const emailValue = z.object({
  id: z.string().optional(),
  type: z.literal("email"),
  email: z.string().nullable(),
});
