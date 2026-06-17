// Rich-text block renderers — paragraphs, headings, lists, to-dos, toggles, quotes, callouts.
// Reads from the official BlockObject payload shapes (block.<type>.rich_text, block.<type>.children, etc.)

import type { BlockObject } from "../../notion/blocks/block";
import { iconGlyph } from "../../readers/object";
import { richTextToPlain } from "../../readers/page";
import { box } from "../box";
import { displayWidth, wordWrap } from "../text";
import { type Block, type BlockRenderer, registerBlock, renderBlocks } from "./engine";

const BULLETS = ["•", "◦", "▪"];

function indent(lines: string[], by: number): string[] {
  const pad = " ".repeat(by);
  return lines.map((line) => pad + line);
}

/** Render a block's children indented under it (the available width shrinks by the indent). */
function childLines(children: Block[] | undefined, width: number, by: number, depth: number): string[] {
  if (!children || children.length === 0) {
    return [];
  }
  return indent(renderBlocks(children, Math.max(1, width - by), depth), by);
}

/** A marker + word-wrapped text, with continuation lines aligned under the text; then children. */
function flow(
  marker: string,
  text: string,
  width: number,
  children: Block[] | undefined,
  childIndent: number,
  childDepth: number,
): string[] {
  const markerWidth = displayWidth(marker);
  const wrapped = wordWrap(text ?? "", Math.max(1, width - markerWidth));
  const lines = wrapped.map((line, index) => (index === 0 ? marker : " ".repeat(markerWidth)) + line);
  return [...lines, ...childLines(children, width, childIndent, childDepth)];
}

registerBlock("paragraph", (block, width) => {
  const data = (block as Extract<BlockObject, { type: "paragraph" }>).paragraph;
  const text = richTextToPlain(data.rich_text);
  const children = data.children as Block[] | undefined;
  return [...(text ? wordWrap(text, width) : [""]), ...childLines(children, width, 2, 0)];
});

const heading: BlockRenderer<Extract<BlockObject, { type: "heading_1" | "heading_2" | "heading_3" | "heading_4" }>> = (
  block,
  width,
) => {
  const level = block.type === "heading_1" ? 1 : block.type === "heading_2" ? 2 : block.type === "heading_3" ? 3 : 4;
  const data = ((block as unknown as Record<string, Record<string, unknown>>)[block.type] ?? {}) as {
    rich_text: unknown;
    is_toggleable?: boolean;
    children?: Block[];
  };
  const text = richTextToPlain(data.rich_text);
  const toggle = data.is_toggleable ?? false;
  const children = data.children as Block[] | undefined;
  const marker = `${"#".repeat(level)} ${toggle ? "▸ " : ""}`;
  return ["", ...flow(marker, text, width, toggle ? children : undefined, 2, 0)];
};

registerBlock("heading_1", heading as BlockRenderer<Extract<Block, { type: "heading_1" }>>);
registerBlock("heading_2", heading as BlockRenderer<Extract<Block, { type: "heading_2" }>>);
registerBlock("heading_3", heading as BlockRenderer<Extract<Block, { type: "heading_3" }>>);
registerBlock("heading_4", heading as BlockRenderer<Extract<Block, { type: "heading_4" }>>);

registerBlock("bulleted_list_item", (block, width, depth) => {
  const data = (block as Extract<BlockObject, { type: "bulleted_list_item" }>).bulleted_list_item;
  const text = richTextToPlain(data.rich_text);
  const children = data.children as Block[] | undefined;
  return flow(`${BULLETS[Math.min(depth, 2)]} `, text, width, children, 2, depth + 1);
});

registerBlock("numbered_list_item", (block, width, _depth, ordinal) => {
  const data = (block as Extract<BlockObject, { type: "numbered_list_item" }>).numbered_list_item;
  const text = richTextToPlain(data.rich_text);
  const children = data.children as Block[] | undefined;
  return flow(`${ordinal || 1}. `, text, width, children, 3, 0);
});

registerBlock("to_do", (block, width) => {
  const data = (block as Extract<BlockObject, { type: "to_do" }>).to_do;
  const text = richTextToPlain(data.rich_text);
  const children = data.children as Block[] | undefined;
  return flow(`[${data.checked ? "x" : " "}] `, text, width, children, 4, 0);
});

registerBlock("toggle", (block, width) => {
  const data = (block as Extract<BlockObject, { type: "toggle" }>).toggle;
  const text = richTextToPlain(data.rich_text);
  const children = data.children as Block[] | undefined;
  return flow("▸ ", text, width, children, 2, 0);
});

registerBlock("quote", (block, width) => {
  const data = (block as Extract<BlockObject, { type: "quote" }>).quote;
  const text = richTextToPlain(data.rich_text);
  const children = data.children as Block[] | undefined;
  const wrapped = wordWrap(text, Math.max(1, width - 2)).map((line) => `│ ${line}`);
  const kids = childLines(children, width - 2, 0, 0).map((line) => `│ ${line}`);
  return [...wrapped, ...kids];
});

registerBlock("callout", (block, width) => {
  const data = (block as Extract<BlockObject, { type: "callout" }>).callout;
  const text = richTextToPlain(data.rich_text);
  const glyph = iconGlyph(data.icon);
  const head = glyph ? `${glyph} ${text}` : text;
  const kids = data.children ? renderBlocks(data.children as Block[], width - 4, 0) : [];
  return box([head, ...kids], width - 2);
});
