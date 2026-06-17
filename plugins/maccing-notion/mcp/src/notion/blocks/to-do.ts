import { z } from "zod";
import { richText } from "../rich-text";
import { blockMeta } from "./_envelope";
import type { BlockObject } from "./block";

export const toDo = (blockChild: z.ZodType<BlockObject>) =>
  z.object({
    ...blockMeta,
    type: z.literal("to_do"),
    to_do: z.object({
      rich_text: z.array(richText),
      checked: z.boolean().optional(),
      color: z.string().optional(),
      children: z.array(blockChild).optional(),
    }),
  });
