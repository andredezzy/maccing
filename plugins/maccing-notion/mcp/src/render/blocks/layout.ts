// Structural block renderers — dividers, columns, simple tables, breadcrumbs, tables of contents,
// synced blocks, page links, and the unsupported-block fallback.

import { renderTableGrid } from "../box";
import { register, renderBlocks } from "../engine";
import type { ColumnDef } from "../model";
import { clip, displayWidth, padRight } from "../text";

/** Render column_list children side by side, each padded to its ratio-allocated width, joined by " │ ". */
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

register("divider", (_block, width) => ["─".repeat(width)]);
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
