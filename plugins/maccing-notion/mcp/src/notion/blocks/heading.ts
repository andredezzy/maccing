import { z } from "zod";
import { richText } from "../rich-text";
import { blockMeta } from "./_envelope";
import type { BlockObject } from "./block";

// Shared payload for all heading levels: is_toggleable enables nested children.
// heading_4 is a confirmed real Notion API type per current docs.
const headingPayload = (blockChild: z.ZodType<BlockObject>) =>
  z.object({
    rich_text: z.array(richText),
    color: z.string().optional(),
    is_toggleable: z.boolean().optional(),
    children: z.array(blockChild).optional(),
  });

export const heading1 = (blockChild: z.ZodType<BlockObject>) =>
  z.object({ ...blockMeta, type: z.literal("heading_1"), heading_1: headingPayload(blockChild) });

export const heading2 = (blockChild: z.ZodType<BlockObject>) =>
  z.object({ ...blockMeta, type: z.literal("heading_2"), heading_2: headingPayload(blockChild) });

export const heading3 = (blockChild: z.ZodType<BlockObject>) =>
  z.object({ ...blockMeta, type: z.literal("heading_3"), heading_3: headingPayload(blockChild) });

export const heading4 = (blockChild: z.ZodType<BlockObject>) =>
  z.object({ ...blockMeta, type: z.literal("heading_4"), heading_4: headingPayload(blockChild) });
