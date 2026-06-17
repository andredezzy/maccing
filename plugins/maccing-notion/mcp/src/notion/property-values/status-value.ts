// mirrors developers.notion.com/reference/page-property-values — status property value
// Same option shape as select; nullable because the API can return null for an unset status.
import { z } from "zod";
import { selectOption } from "./select-value";

export const statusValue = z.object({
  id: z.string().optional(),
  type: z.literal("status"),
  status: selectOption.nullable(),
});
