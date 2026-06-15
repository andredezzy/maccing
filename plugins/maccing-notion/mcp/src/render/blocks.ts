// Block-leaf renderers — paragraphs, headings, lists, quotes, callouts, code, media, columns, tables,
// and the rest of a page body. Each registers itself with the engine, so adding a block type is one
// register() call here (or in a new file) — no central switch to edit. Recursion goes through the engine.

import { box, renderTableGrid } from "./box";
import { type BlockRenderer, register, renderBlocks } from "./engine";
import type { ColumnDef, MockupBlock } from "./model";
import { clip, displayWidth, padRight, wordWrap } from "./text";

const BULLETS = ["•", "◦", "▪"];

function indent(lines: string[], by: number): string[] {
  const pad = " ".repeat(by);
  return lines.map((l) => pad + l);
}
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
  const mw = displayWidth(marker);
  const wrapped = wordWrap(text ?? "", Math.max(1, width - mw));
  const lines = wrapped.map((w, i) => (i === 0 ? marker : " ".repeat(mw)) + w);
  return [...lines, ...childLines(children, width, childIndent, childDepth)];
}
function renderColumns(columns: ColumnDef[], total: number): string[] {
  const n = columns.length;
  if (n === 0) {
    return [];
  }
  const sep = " │ ";
  const content = total - (n - 1) * displayWidth(sep);
  const totalRatio = columns.reduce((a, c) => a + (c.ratio ?? 1), 0);
  const widths = columns.map((c) => Math.max(3, Math.floor((content * (c.ratio ?? 1)) / totalRatio)));
  const rendered = columns.map((c, i) => renderBlocks(c.children, widths[i], 0).map((l) => padRight(l, widths[i])));
  const height = Math.max(0, ...rendered.map((r) => r.length));
  const out: string[] = [];
  for (let r = 0; r < height; r++) {
    out.push(rendered.map((col, i) => col[r] ?? " ".repeat(widths[i])).join(sep));
  }
  return out;
}
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

// ── registrations ──────────────────────────────────────────────────────────────
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
  const wrapped = wordWrap(block.text, Math.max(1, width - 2)).map((l) => `│ ${l}`);
  const kids = childLines(block.children, width - 2, 0, 0).map((l) => `│ ${l}`);
  return [...wrapped, ...kids];
});
register("callout", (block, width) => {
  const head = block.icon ? `${block.icon} ${block.lines[0] ?? ""}` : (block.lines[0] ?? "");
  const body = [head, ...block.lines.slice(1)];
  const kids = block.children ? renderBlocks(block.children, width - 4, 0) : [];
  return box([...body, ...kids], width - 2);
});
register("divider", (_block, width) => ["─".repeat(width)]);
register("code", (block, width) => [
  ...box([`‹${block.language ?? "code"}›`, ...block.text.split("\n")], width - 2),
  ...(block.caption ? [block.caption] : []),
]);
register("equation", (block) => ["$$", block.expression, "$$"]);

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
register("column_list", (block, width) => renderColumns(block.columns, width));
register("simple_table", (block, width) =>
  renderTableGrid(block.rows[0] ?? [], block.rows.slice(1), width, block.hasColumnHeader === false ? "─" : "═"),
);
register("breadcrumb", (block, width) => [clip((block.path ?? ["…"]).join("  /  "), width)]);
register("table_of_contents", (block, width) =>
  block.headings?.length ? block.headings.map((h) => clip(`  • ${h}`, width)) : ["[ Table of contents ]"],
);
register("synced_block", (block, width) =>
  block.children?.length
    ? renderBlocks(block.children, width, 0)
    : [`[ synced block${block.from ? ` ← ${block.from}` : ""} ]`],
);
register("page_link", (block) => [
  `${block.icon ? `${block.icon} ` : "▤ "}${block.title}${block.note ? `     (${block.note})` : ""}`,
]);
register("unsupported", (block) => [`[ ${block.label ?? "unsupported block"} ]`]);
