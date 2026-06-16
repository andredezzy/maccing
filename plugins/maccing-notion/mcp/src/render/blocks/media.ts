// Media + embed block renderers — image/video/audio/file/pdf, bookmarks, embeds, code, equations.

import { box } from "../box";
import { type BlockRenderer, type MockupBlock, register } from "../engine";

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

const media: BlockRenderer<Extract<MockupBlock, { type: "image" | "video" | "audio" | "file" | "pdf" }>> = (
  block,
  width,
) => mediaBox(`[${block.type.toUpperCase()}]`, block.url, block.name, block.caption, width);
register("image", media);
register("video", media);
register("audio", media);
register("file", media);
register("pdf", media);

const bookmark: BlockRenderer<Extract<MockupBlock, { type: "bookmark" | "link_preview" }>> = (block, width) =>
  mediaBox("🔖", block.url, undefined, block.caption, width);
register("bookmark", bookmark);
register("link_preview", bookmark);

register("embed", (block, width) => box([`▶ ${block.label}`], width - 2));
register("code", (block, width) => [
  ...box([`‹${block.language ?? "code"}›`, ...block.text.split("\n")], width - 2),
  ...(block.caption ? [block.caption] : []),
]);
register("equation", (block) => ["$$", block.expression, "$$"]);
