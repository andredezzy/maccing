// Structural block renderers — dividers, columns, simple tables, breadcrumbs, tables of contents,
// synced blocks, page links, and the unsupported-block fallback.

import { renderTableGrid } from "../box";
import { clip, displayWidth, padRight } from "../text";
import { type Block, registerBlock, renderBlocks } from "./engine";

export interface ColumnDef {
  ratio?: number;
  children: Block[];
}

/** Render column_list children side by side, each padded to its ratio-allocated width, joined by " │ ". */
function renderColumns(columns: ColumnDef[], total: number): string[] {
  const count = columns.length;
  if (count === 0) {
    return [];
  }
  const separator = " │ ";
  const content = total - (count - 1) * displayWidth(separator);
  const totalRatio = columns.reduce((acc, column) => acc + (column.ratio ?? 1), 0);
  const widths = columns.map((column) => Math.max(3, Math.floor((content * (column.ratio ?? 1)) / totalRatio)));
  const rendered = columns.map((column, index) =>
    renderBlocks(column.children, widths[index], 0).map((line) => padRight(line, widths[index])),
  );
  const height = Math.max(0, ...rendered.map((columnLines) => columnLines.length));
  const out: string[] = [];
  for (let rowIndex = 0; rowIndex < height; rowIndex++) {
    out.push(rendered.map((columnLines, index) => columnLines[rowIndex] ?? " ".repeat(widths[index])).join(separator));
  }
  return out;
}

registerBlock("divider", (_block, width) => ["─".repeat(width)]);
registerBlock("column_list", (block, width) => renderColumns(block.columns, width));
registerBlock("simple_table", (block, width) =>
  renderTableGrid(block.rows[0] ?? [], block.rows.slice(1), width, block.hasColumnHeader === false ? "─" : "═"),
);
registerBlock("breadcrumb", (block, width) => [clip((block.path ?? ["…"]).join("  /  "), width)]);
registerBlock("table_of_contents", (block, width) =>
  block.headings?.length ? block.headings.map((heading) => clip(`  • ${heading}`, width)) : ["[ Table of contents ]"],
);
registerBlock("synced_block", (block, width) =>
  block.children?.length
    ? renderBlocks(block.children, width, 0)
    : [`[ synced block${block.from ? ` ← ${block.from}` : ""} ]`],
);
registerBlock("page_link", (block) => [
  `${block.icon ? `${block.icon} ` : "▤ "}${block.title}${block.note ? `     (${block.note})` : ""}`,
]);
registerBlock("unsupported", (block) => [`[ ${block.label ?? "unsupported block"} ]`]);
