// Structural block renderers — dividers, columns, simple tables, breadcrumbs, tables of contents,
// synced blocks, page links, and the unsupported-block fallback.

import { renderTableGrid } from "../box";
import { register, renderBlocks } from "../engine";
import { clip } from "../text";
import { renderColumns } from "./helpers";

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
