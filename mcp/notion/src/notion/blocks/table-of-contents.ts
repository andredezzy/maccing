import { z } from "zod";
import { blockMeta } from "./_envelope";

export const tableOfContents = z.object({
  ...blockMeta,
  type: z.literal("table_of_contents"),
  table_of_contents: z.object({ color: z.string().optional() }),
});
