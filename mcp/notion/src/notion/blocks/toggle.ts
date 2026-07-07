import { z } from "zod";
import { richText } from "../rich-text";
import { blockMeta } from "./_envelope";
import type { BlockObject } from "./block";

export const toggle = (blockChild: z.ZodType<BlockObject>) =>
  z.object({
    ...blockMeta,
    type: z.literal("toggle"),
    toggle: z.object({
      rich_text: z.array(richText),
      color: z.string().optional(),
      children: z.array(blockChild).optional(),
    }),
  });
