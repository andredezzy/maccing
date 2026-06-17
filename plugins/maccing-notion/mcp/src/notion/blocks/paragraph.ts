import { z } from "zod";
import { richText } from "../rich-text";
import { blockMeta } from "./_envelope";
import type { BlockObject } from "./block";

// Factory receives blockChild to avoid value-importing block.ts (which would create a runtime cycle).
// import type is erased at compile time — no runtime edge is created.
export const paragraph = (blockChild: z.ZodType<BlockObject>) =>
  z.object({
    ...blockMeta,
    type: z.literal("paragraph"),
    paragraph: z.object({
      rich_text: z.array(richText),
      color: z.string().optional(),
      children: z.array(blockChild).optional(),
    }),
  });
