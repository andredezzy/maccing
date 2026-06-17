// mirrors developers.notion.com/reference/rich-text
import { z } from "zod";

const annotations = z.object({
  bold: z.boolean(),
  italic: z.boolean(),
  strikethrough: z.boolean(),
  underline: z.boolean(),
  code: z.boolean(),
  color: z.string(),
});

// Fields shared by every rich-text variant — all optional (server-set, or omittable in a proposal).
const richTextBase = {
  annotations: annotations.optional(),
  plain_text: z.string().optional(),
  href: z.string().nullable().optional(),
};

const textRichText = z.object({
  ...richTextBase,
  type: z.literal("text"),
  text: z.object({
    content: z.string(),
    link: z.object({ url: z.string() }).nullable().optional(),
  }),
});

const mentionRichText = z.object({
  ...richTextBase,
  type: z.literal("mention"),
  mention: z.record(z.string(), z.unknown()),
});

const equationRichText = z.object({
  ...richTextBase,
  type: z.literal("equation"),
  equation: z.object({ expression: z.string() }),
});

// A discriminated union on `type` keeps each variant's payload required and rejects cross-contamination
// (e.g. an `equation` payload under `type: "text"`); it also yields faster parses + clearer errors.
export const richText = z.discriminatedUnion("type", [textRichText, mentionRichText, equationRichText]);

export type RichTextObject = z.infer<typeof richText>;
