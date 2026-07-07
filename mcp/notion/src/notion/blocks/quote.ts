import { z } from "zod";
import { richText } from "../rich-text";
import { blockMeta } from "./_envelope";
import type { BlockObject } from "./block";

export const quote = (blockChild: z.ZodType<BlockObject>) =>
  z.object({
    ...blockMeta,
    type: z.literal("quote"),
    quote: z.object({
      rich_text: z.array(richText),
      color: z.string().optional(),
      children: z.array(blockChild).optional(),
    }),
  });
