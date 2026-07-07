import { z } from "zod";
import { blockMeta } from "./_envelope";

// unsupported blocks represent Notion block types the API doesn't yet fully expose.
// block_type optionally identifies the underlying type (e.g. "form", "button").
export const unsupported = z.object({
  ...blockMeta,
  type: z.literal("unsupported"),
  unsupported: z.object({ block_type: z.string().optional() }).passthrough().optional(),
});
