import { z } from "zod";
import { richText } from "../rich-text";
import { blockMeta } from "./_envelope";

export const bookmark = z.object({
  ...blockMeta,
  type: z.literal("bookmark"),
  bookmark: z.object({
    url: z.string(),
    caption: z.array(richText).optional(),
  }),
});

// link_preview is read-only (cannot be created/updated via API) but must be parseable.
export const linkPreview = z.object({
  ...blockMeta,
  type: z.literal("link_preview"),
  link_preview: z.object({ url: z.string() }),
});

export const embed = z.object({
  ...blockMeta,
  type: z.literal("embed"),
  embed: z.object({ url: z.string() }),
});
