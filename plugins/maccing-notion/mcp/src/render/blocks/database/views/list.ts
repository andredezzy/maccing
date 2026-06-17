// List view renderer — one line per row: `• Title   meta`.

import { clip } from "../../../text";
import { databaseHeader } from "../header";
import { registerView, type ViewRenderNode } from "./engine";
import { cellValue, rowTitle, visibleColumns } from "./helpers";

function renderList(node: ViewRenderNode, total: number): string[] {
  const lines = [databaseHeader(node.dbTitle, node.tabs, total)];
  if (node.rows.length === 0) {
    return [...lines, "(empty)"];
  }
  const columns = visibleColumns(node.view, node.dataSource, node.titleColumn);
  const otherColumns = columns.filter((column) => column !== node.titleColumn);
  for (const row of node.rows) {
    const title = rowTitle(row, node.titleColumn);
    const meta = otherColumns
      .map((column) => cellValue(row, column))
      .filter(Boolean)
      .join(" · ");
    const head = `• ${title}`;
    lines.push(meta ? clip(`${head}   ${meta}`, total) : clip(head, total));
  }
  return lines;
}

registerView("list", renderList);
