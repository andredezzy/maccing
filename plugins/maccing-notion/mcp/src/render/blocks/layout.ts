// Structural block renderers — dividers, columns, tables, breadcrumbs, tables of contents,
// synced blocks, child pages/databases, links, tabs, templates, meeting notes, and the unsupported fallback.
// Reads from the official BlockObject payload shapes.

import type { BlockObject } from "../../notion/blocks/block";
import type { RichTextObject } from "../../notion/rich-text";
import { richTextToPlain } from "../../readers/page";
import { renderTableGrid } from "../box";
import { displayWidth, padRight } from "../text";
import { type Block, registerBlock, renderBlocks } from "./engine";

interface ColumnDef {
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

registerBlock("column_list", (block, width) => {
  // Column children are in the column_list payload's nested column blocks.
  const payload = (block as Extract<BlockObject, { type: "column_list" }>).column_list as {
    children?: { type: "column"; column: { width_ratio?: number; children?: BlockObject[] } }[];
  };
  const cols: ColumnDef[] = (payload.children ?? []).map((col) => ({
    ratio: col.column.width_ratio,
    children: (col.column.children ?? []) as Block[],
  }));
  return renderColumns(cols, width);
});

registerBlock("table", (block, width) => {
  const data = (block as Extract<BlockObject, { type: "table" }>).table;
  const rows = (data.children ?? []) as Extract<BlockObject, { type: "table_row" }>[];
  const grid = rows.map((row) => (row.table_row?.cells ?? []).map((cell: RichTextObject[]) => richTextToPlain(cell)));
  const header = grid[0] ?? [];
  const body = grid.slice(1);
  return renderTableGrid(header, body, width, data.has_column_header === false ? "─" : "═");
});

// table_row is always rendered as part of `table`; register as no-op to avoid "unregistered" fallback
registerBlock("table_row", () => []);

registerBlock("breadcrumb", (_block, width) => {
  // breadcrumb in the official API carries no path — show the placeholder
  const clip = (str: string, maxWidth: number) => {
    const segments = [...str];
    let result = "";
    let total = 0;
    for (const char of segments) {
      const charWidth = displayWidth(char);
      if (total + charWidth > maxWidth) {
        return `${result}…`;
      }
      result += char;
      total += charWidth;
    }
    return result;
  };
  return [clip("…", width)];
});

registerBlock("table_of_contents", (_block) => ["[ Table of contents ]"]);

registerBlock("synced_block", (block, width) => {
  const data = (block as Extract<BlockObject, { type: "synced_block" }>).synced_block;
  const children = data.children as Block[] | undefined;
  const source = data.synced_from?.block_id;
  if (children?.length) {
    return renderBlocks(children, width, 0);
  }
  return [`[ synced block${source ? ` ← ${source}` : ""} ]`];
});

registerBlock("child_page", (block) => {
  const data = (block as Extract<BlockObject, { type: "child_page" }>).child_page;
  return [`▤ ${data.title || "(page)"}`];
});

registerBlock("child_database", (block) => {
  const data = (block as Extract<BlockObject, { type: "child_database" }>).child_database;
  return [`▦ ${data.title || "(database)"}`];
});

registerBlock("link_to_page", (_block) => ["▤ (linked page)"]);

registerBlock("template", (block, width) => {
  const data = (block as Extract<BlockObject, { type: "template" }>).template;
  const text = richTextToPlain(data.rich_text);
  const children = data.children as Block[] | undefined;
  const lines = text ? [text] : ["[template]"];
  return children?.length ? [...lines, ...renderBlocks(children, width, 0)] : lines;
});

registerBlock("tab", (block, width) => {
  const data = (block as Extract<BlockObject, { type: "tab" }>).tab;
  const children = data.children as Block[] | undefined;
  return children?.length ? renderBlocks(children, width, 0) : ["[tab]"];
});

registerBlock("meeting_notes", () => ["[ meeting notes ]"]);
registerBlock("transcription", () => ["[ transcription ]"]);
registerBlock("unsupported", () => ["[ unsupported block ]"]);
