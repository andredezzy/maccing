import { z } from "zod";
import { richText } from "../rich-text";
import { blockMeta } from "./_envelope";
import type { BlockObject } from "./block";

export const bulletedListItem = (blockChild: z.ZodType<BlockObject>) =>
  z.object({
    ...blockMeta,
    type: z.literal("bulleted_list_item"),
    bulleted_list_item: z.object({
      rich_text: z.array(richText),
      color: z.string().optional(),
      children: z.array(blockChild).optional(),
    }),
  });

export const numberedListItem = (blockChild: z.ZodType<BlockObject>) =>
  z.object({
    ...blockMeta,
    type: z.literal("numbered_list_item"),
    numbered_list_item: z.object({
      rich_text: z.array(richText),
      color: z.string().optional(),
      // Present only on the first item of a list: a custom start index, and the numbering format.
      list_start_index: z.number().optional(),
      list_format: z.enum(["numbers", "letters", "roman"]).optional(),
      children: z.array(blockChild).optional(),
    }),
  });
