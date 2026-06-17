// Media + embed block renderers — image/video/audio/file/pdf, bookmarks, embeds, code, equations.
// Reads from the official BlockObject payload shapes.

import type { BlockObject } from "../../notion/blocks/block";
import { richTextToPlain } from "../../readers/page";
import { box } from "../box";
import { registerBlock } from "./engine";

interface MediaPayload {
  type?: string;
  external?: { url?: string };
  file?: { url?: string };
  name?: string;
  caption?: unknown;
}

/** A captioned media/bookmark box: a label + name/url line, then an optional caption, inside the box. */
function mediaBox(
  label: string,
  url: string | undefined,
  name: string | undefined,
  caption: string | undefined,
  total: number,
): string[] {
  const body = [`${label}  ${name ?? url ?? ""}`.trim()];
  if (caption) {
    body.push(caption);
  }
  return box(body, total - 2);
}

function mediaUrl(payload: MediaPayload): string | undefined {
  return payload.external?.url ?? payload.file?.url ?? (payload.type === "file_upload" ? "(uploaded)" : undefined);
}

function mediaCaptionString(payload: MediaPayload): string | undefined {
  const cap = richTextToPlain(payload.caption);
  return cap || undefined;
}

for (const mediaType of ["image", "video", "audio", "file", "pdf"] as const) {
  registerBlock(mediaType, (block, width) => {
    const payload = ((block as Record<string, unknown>)[block.type] ?? {}) as MediaPayload;
    return mediaBox(
      `[${block.type.toUpperCase()}]`,
      mediaUrl(payload),
      payload.name,
      mediaCaptionString(payload),
      width,
    );
  });
}

registerBlock("bookmark", (block, width) => {
  const data = (block as Extract<BlockObject, { type: "bookmark" }>).bookmark;
  const caption = richTextToPlain(data.caption) || undefined;
  return mediaBox("🔖", data.url, undefined, caption, width);
});

registerBlock("link_preview", (block, width) => {
  const data = (block as Extract<BlockObject, { type: "link_preview" }>).link_preview;
  return mediaBox("🔖", data.url, undefined, undefined, width);
});

registerBlock("embed", (block, width) => {
  const data = (block as Extract<BlockObject, { type: "embed" }>).embed;
  return box([`▶ ${data.url}`], width - 2);
});

registerBlock("code", (block, width) => {
  const data = (block as Extract<BlockObject, { type: "code" }>).code;
  const text = richTextToPlain(data.rich_text);
  const caption = richTextToPlain(data.caption) || undefined;
  return [...box([`‹${data.language ?? "code"}›`, ...text.split("\n")], width - 2), ...(caption ? [caption] : [])];
});

registerBlock("equation", (block) => {
  const data = (block as Extract<BlockObject, { type: "equation" }>).equation;
  return ["$$", data.expression, "$$"];
});
