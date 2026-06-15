// Shared block-rendering helpers — list/heading markers, child recursion, marker+wrap flow, multi-column
// layout, and media boxes. Used by the block family files (text/media/layout); recursion via the engine.

import { box } from "../box";
import { renderBlocks } from "../engine";
import type { ColumnDef, MockupBlock } from "../model";
import { displayWidth, padRight, wordWrap } from "../text";

export const BULLETS = ["•", "◦", "▪"];

function indent(lines: string[], by: number): string[] {
  const pad = " ".repeat(by);
  return lines.map((l) => pad + l);
}
export function childLines(children: MockupBlock[] | undefined, width: number, by: number, depth: number): string[] {
  if (!children || children.length === 0) {
    return [];
  }
  return indent(renderBlocks(children, Math.max(1, width - by), depth), by);
}
/** A marker + word-wrapped text, with continuation lines aligned under the text; then children. */
export function flow(
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
export function renderColumns(columns: ColumnDef[], total: number): string[] {
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
export function mediaBox(
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
