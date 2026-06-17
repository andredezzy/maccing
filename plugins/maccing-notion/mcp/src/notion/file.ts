// mirrors developers.notion.com/reference/file-object and developers.notion.com/reference/emoji-object
import { z } from "zod";

// External file — URL is required per the docs (never expires, returned as-is)
const externalFile = z.object({
  type: z.literal("external"),
  external: z.object({ url: z.string() }),
  name: z.string().optional(),
  caption: z.array(z.unknown()).optional(),
});

// Notion-hosted file — the server returns a temporary `url` plus an `expiry_time`; `expiry_time` stays
// optional here so a hand-authored proposal (which has no server timestamp) still validates.
const notionFile = z.object({
  type: z.literal("file"),
  file: z.object({
    url: z.string(),
    expiry_time: z.string().optional(),
  }),
  name: z.string().optional(),
  caption: z.array(z.unknown()).optional(),
});

// API-uploaded file (File Upload API)
const fileUpload = z.object({
  type: z.literal("file_upload"),
  file_upload: z.object({ id: z.string() }),
  name: z.string().optional(),
  caption: z.array(z.unknown()).optional(),
});

export const fileObject = z.discriminatedUnion("type", [externalFile, notionFile, fileUpload]);

export type FileObject = z.infer<typeof fileObject>;

// Icon: emoji | custom_emoji | any file object type
const emojiIcon = z.object({
  type: z.literal("emoji"),
  emoji: z.string(),
});

const customEmojiIcon = z.object({
  type: z.literal("custom_emoji"),
  custom_emoji: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    url: z.string().optional(),
  }),
});

// A native Notion icon from the built-in icon set (e.g. "chart-mixed", optionally with a color).
const nativeIcon = z.object({
  type: z.literal("icon"),
  icon: z.object({ name: z.string(), color: z.string().optional() }),
});

export const icon = z.discriminatedUnion("type", [
  emojiIcon,
  customEmojiIcon,
  nativeIcon,
  externalFile,
  notionFile,
  fileUpload,
]);

export type Icon = z.infer<typeof icon>;

// Cover: only external or notion-hosted files (not file_upload, not emoji)
export const cover = z.discriminatedUnion("type", [externalFile, notionFile]);

export type Cover = z.infer<typeof cover>;
