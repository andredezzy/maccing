// Box-drawing layout primitives — bordered boxes, horizontal concat, fixed-width grids, and the
// page/database chrome (cover band · title · divider). All width math is display-aware via ./text.

import { displayWidth, fitWidth } from "./text";

export const GAP = 2;
export const SMALL_CARD = 14;
export const MEDIUM_CARD = 20;
export const COVER = " COVER";

export function box(lines: string[], inner: number): string[] {
  const out = [`┌${"─".repeat(inner)}┐`];
  for (const line of lines) {
    out.push(line === COVER ? `│${"▒".repeat(inner)}│` : `│${fitWidth(` ${line}`, inner)}│`);
  }
  out.push(`└${"─".repeat(inner)}┘`);
  return out;
}
export function hcat(boxes: string[][], gap: number): string[] {
  if (boxes.length === 0) {
    return [];
  }
  const height = Math.max(...boxes.map((boxLines) => boxLines.length));
  const padded = boxes.map((boxLines) => {
    const width = boxLines.length > 0 ? displayWidth(boxLines[0]) : 0;
    return [...boxLines, ...Array(height - boxLines.length).fill(" ".repeat(width))];
  });
  const rows: string[] = [];
  for (let rowIndex = 0; rowIndex < height; rowIndex++) {
    rows.push(padded.map((boxLines) => boxLines[rowIndex]).join(" ".repeat(gap)));
  }
  return rows;
}
export function cardsPerRow(inner: number, total: number): number {
  let count = 1;
  while ((count + 1) * (inner + 2) + count * GAP <= total) {
    count++;
  }
  return count;
}
function fitColumns(natural: number[], total: number): number[] {
  // Each column gets ` content ` (2 padding) and the grid has n+1 vertical borders, so the content widths
  // share this budget. budget = total - (3·columns + 1).
  const budget = total - (3 * natural.length + 1);
  const sum = natural.reduce((acc, width) => acc + width, 0);

  if (sum <= budget) {
    // Slack: widen columns round-robin (from index 0) so the grid fills the canvas.
    const widths = [...natural];
    for (let index = 0, extra = budget - sum; extra > 0; index = (index + 1) % widths.length, extra--) {
      widths[index]++;
    }
    return widths;
  }

  // Natural widths overflow the canvas — shrink proportionally (min 1/column), then trim rounding drift so
  // the row never exceeds `total`. renderTableGrid's fitWidth clips each cell to its width, so boxes stay closed.
  const widths = natural.map((width) => Math.max(1, Math.round((width / sum) * budget)));
  for (let over = widths.reduce((acc, width) => acc + width, 0) - budget; over > 0; over--) {
    const widest = widths.indexOf(Math.max(...widths));
    if (widths[widest] <= 1) {
      break; // degenerate: more columns than the canvas can hold even at 1 col each
    }
    widths[widest]--;
  }
  return widths;
}
export function renderTableGrid(columns: string[], rows: string[][], total: number, headerSep: string): string[] {
  const natural = columns.map((column, index) =>
    Math.max(displayWidth(column), ...rows.map((row) => displayWidth(row[index] ?? ""))),
  );
  const widths = fitColumns(natural, total);
  const rule = (left: string, junction: string, right: string, fillChar: string): string =>
    left + widths.map((width) => fillChar.repeat(width + 2)).join(junction) + right;
  const line = (cells: string[]): string =>
    `│${widths.map((width, index) => ` ${fitWidth(cells[index] ?? "", width)} `).join("│")}│`;
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
