// Media + embed block renderers — image/video/audio/file/pdf, bookmarks, embeds, code, equations.

import { box } from "../box";
import { type Block, type BlockRenderer, registerBlock } from "./engine";

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

const media: BlockRenderer<Extract<Block, { type: "image" | "video" | "audio" | "file" | "pdf" }>> = (block, width) =>
  mediaBox(`[${block.type.toUpperCase()}]`, block.url, block.name, block.caption, width);
registerBlock("image", media);
registerBlock("video", media);
registerBlock("audio", media);
registerBlock("file", media);
registerBlock("pdf", media);

const bookmark: BlockRenderer<Extract<Block, { type: "bookmark" | "link_preview" }>> = (block, width) =>
  mediaBox("🔖", block.url, undefined, block.caption, width);
registerBlock("bookmark", bookmark);
registerBlock("link_preview", bookmark);

registerBlock("embed", (block, width) => box([`▶ ${block.label}`], width - 2));
registerBlock("code", (block, width) => [
  ...box([`‹${block.language ?? "code"}›`, ...block.text.split("\n")], width - 2),
  ...(block.caption ? [block.caption] : []),
]);
registerBlock("equation", (block) => ["$$", block.expression, "$$"]);
