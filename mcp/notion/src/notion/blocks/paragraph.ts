import { z } from "zod";
import { icon } from "../file";
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
      // Optional icon — only set when this paragraph is a direct child of a tab block.
      icon: icon.nullable().optional(),
      children: z.array(blockChild).optional(),
    }),
  });
