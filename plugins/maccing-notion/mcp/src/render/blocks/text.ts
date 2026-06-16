// Rich-text block renderers — paragraphs, headings, lists, to-dos, toggles, quotes, callouts.

import { box } from "../box";
import { type BlockRenderer, type MockupBlock, register, renderBlocks } from "../engine";
import { displayWidth, wordWrap } from "../text";

const BULLETS = ["•", "◦", "▪"];

function indent(lines: string[], by: number): string[] {
  const pad = " ".repeat(by);
  return lines.map((line) => pad + line);
}
/** Render a block's children indented under it (the available width shrinks by the indent). */
function childLines(children: MockupBlock[] | undefined, width: number, by: number, depth: number): string[] {
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
  children: MockupBlock[] | undefined,
  childIndent: number,
  childDepth: number,
): string[] {
  const markerWidth = displayWidth(marker);
  const wrapped = wordWrap(text ?? "", Math.max(1, width - markerWidth));
  const lines = wrapped.map((line, index) => (index === 0 ? marker : " ".repeat(markerWidth)) + line);
  return [...lines, ...childLines(children, width, childIndent, childDepth)];
}

register("paragraph", (block, width) => [
  ...(block.text ? wordWrap(block.text, width) : [""]),
  ...childLines(block.children, width, 2, 0),
]);
register("heading", (block) => ["", block.text]);

const heading: BlockRenderer<Extract<MockupBlock, { type: "heading_1" | "heading_2" | "heading_3" }>> = (
  block,
  width,
) => {
  const level = block.type === "heading_1" ? 1 : block.type === "heading_2" ? 2 : 3;
  const marker = `${"#".repeat(level)} ${block.toggle ? "▸ " : ""}`;
  return ["", ...flow(marker, block.text, width, block.toggle ? block.children : undefined, 2, 0)];
};
register("heading_1", heading);
register("heading_2", heading);
register("heading_3", heading);

register("bulleted_list_item", (block, width, depth) =>
  flow(`${BULLETS[Math.min(depth, 2)]} `, block.text, width, block.children, 2, depth + 1),
);
register("numbered_list_item", (block, width, _depth, ordinal) =>
  flow(`${ordinal || 1}. `, block.text, width, block.children, 3, 0),
);
register("to_do", (block, width) => flow(`[${block.checked ? "x" : " "}] `, block.text, width, block.children, 4, 0));
register("toggle", (block, width) => flow("▸ ", block.text, width, block.children, 2, 0));
register("quote", (block, width) => {
  const wrapped = wordWrap(block.text, Math.max(1, width - 2)).map((line) => `│ ${line}`);
  const kids = childLines(block.children, width - 2, 0, 0).map((line) => `│ ${line}`);
  return [...wrapped, ...kids];
});
register("callout", (block, width) => {
  const head = block.icon ? `${block.icon} ${block.lines[0] ?? ""}` : (block.lines[0] ?? "");
  const body = [head, ...block.lines.slice(1)];
  const kids = block.children ? renderBlocks(block.children, width - 4, 0) : [];
  return box([...body, ...kids], width - 2);
});
