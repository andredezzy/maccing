import { z } from "zod";
import { blockMeta } from "./_envelope";

// Childless — no factory needed; pass this schema directly to z.union in block.ts.
export const divider = z.object({
  ...blockMeta,
  type: z.literal("divider"),
  divider: z.object({}).passthrough(),
});
