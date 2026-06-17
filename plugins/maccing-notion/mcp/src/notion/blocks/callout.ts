import { z } from "zod";
import { icon } from "../file";
import { richText } from "../rich-text";
import { blockMeta } from "./_envelope";
import type { BlockObject } from "./block";

export const callout = (blockChild: z.ZodType<BlockObject>) =>
  z.object({
    ...blockMeta,
    type: z.literal("callout"),
    callout: z.object({
      rich_text: z.array(richText),
      icon: icon.optional(),
      color: z.string().optional(),
      children: z.array(blockChild).optional(),
    }),
  });
