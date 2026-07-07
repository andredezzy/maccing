import { z } from "zod";
import { richText } from "../rich-text";
import { blockMeta } from "./_envelope";

// language is a large string enum in the API; z.string() is used to avoid an exhaustive literal union
// that would break on new languages added by Notion without an API version bump.
export const code = z.object({
  ...blockMeta,
  type: z.literal("code"),
  code: z.object({
    rich_text: z.array(richText),
    caption: z.array(richText).optional(),
    language: z.string(),
  }),
});
