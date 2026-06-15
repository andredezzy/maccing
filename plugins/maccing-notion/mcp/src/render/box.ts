// Box-drawing layout primitives — bordered boxes, horizontal concat, fixed-width grids, and the
// page/database chrome (cover band · title · divider). All width math is display-aware via ./text.

import { displayWidth, padRight } from "./text";

export const GAP = 2;
export const SMALL_CARD = 14;
export const MEDIUM_CARD = 20;
export const COVER = " COVER";

export function box(lines: string[], inner: number): string[] {
  const out = [`┌${"─".repeat(inner)}┐`];
  for (const line of lines) {
    out.push(line === COVER ? `│${"▒".repeat(inner)}│` : `│${padRight(` ${line}`, inner)}│`);
  }
  out.push(`└${"─".repeat(inner)}┘`);
  return out;
}
export function hcat(boxes: string[][], gap: number): string[] {
  if (boxes.length === 0) {
    return [];
  }
  const height = Math.max(...boxes.map((b) => b.length));
  const padded = boxes.map((b) => {
    const w = b.length > 0 ? displayWidth(b[0]) : 0;
    return [...b, ...Array(height - b.length).fill(" ".repeat(w))];
  });
  const rows: string[] = [];
  for (let r = 0; r < height; r++) {
    rows.push(padded.map((b) => b[r]).join(" ".repeat(gap)));
  }
  return rows;
}
export function cardsPerRow(inner: number, total: number): number {
  let n = 1;
  while ((n + 1) * (inner + 2) + n * GAP <= total) {
    n++;
  }
  return n;
}
function fitColumns(natural: number[], total: number): number[] {
  const widths = [...natural];
  let extra = total - (3 * widths.length + 1) - widths.reduce((a, b) => a + b, 0);
  for (let i = 0; extra > 0; i = (i + 1) % widths.length, extra--) {
    widths[i]++;
  }
  return widths;
}
export function renderTableGrid(columns: string[], rows: string[][], total: number, headerSep: string): string[] {
  const natural = columns.map((col, i) => Math.max(displayWidth(col), ...rows.map((r) => displayWidth(r[i] ?? ""))));
  const widths = fitColumns(natural, total);
  const rule = (l: string, m: string, r: string, ch: string): string =>
    l + widths.map((w) => ch.repeat(w + 2)).join(m) + r;
  const line = (cells: string[]): string => `│${widths.map((w, i) => ` ${padRight(cells[i] ?? "", w)} `).join("│")}│`;
  return [
    rule("┌", "┬", "┐", "─"),
    line(columns),
    rule("├", "┼", "┤", headerSep),
    ...rows.map(line),
    rule("└", "┴", "┘", "─"),
  ];
}
export function header(
  icon: string | undefined,
  title: string,
  cover: string | undefined,
  description: string | undefined,
  total: number,
): string[] {
  const out: string[] = [];
  if (cover) {
    const label = ` ${cover} `;
    const pad = total - displayWidth(label);
    const left = Math.max(0, Math.floor(pad / 2));
    out.push("▒".repeat(left) + label + "▒".repeat(Math.max(0, pad - left)));
  }
  out.push(icon ? `${icon} ${title}` : title);
  if (description) {
    out.push(`▤ Description    ${description}`);
  }
  out.push("─".repeat(total));
  return out;
}
