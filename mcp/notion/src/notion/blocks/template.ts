import { z } from "zod";
import { richText } from "../rich-text";
import { blockMeta } from "./_envelope";
import type { BlockObject } from "./block";

// template blocks are deprecated for creation (as of March 2023) but must still be parseable.
export const template = (blockChild: z.ZodType<BlockObject>) =>
  z.object({
    ...blockMeta,
    type: z.literal("template"),
    template: z.object({
      rich_text: z.array(richText),
      children: z.array(blockChild).optional(),
    }),
  });
