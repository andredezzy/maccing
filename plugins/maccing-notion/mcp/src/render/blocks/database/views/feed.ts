// Feed view renderer — single-column scrollable stack of page-preview cards.

import { box } from "../../../box";
import { clip } from "../../../text";
import { databaseHeader } from "../header";
import { registerView, type ViewRenderNode } from "./engine";
import { cellValue, rowTitle, visibleColumns } from "./helpers";

registerView("feed", (node: ViewRenderNode, width: number) => {
  const lines = [databaseHeader(node.dbTitle, node.tabs, node.view.name, width)];
  if (node.rows.length === 0) {
    return [...lines, ...box(["(empty)"], width - 2)];
  }

  const columns = visibleColumns(node.view, node.dataSource, node.titleColumn);
  const otherColumns = columns.filter((column) => column !== node.titleColumn);

  for (const row of node.rows) {
    const title = rowTitle(row, node.titleColumn);
    const meta = otherColumns
      .map((column) => cellValue(row, column))
      .filter(Boolean)
      .join(" · ");
    const body = [clip(title, width - 4), ...(meta ? [clip(meta, width - 4)] : [])];
    lines.push(...box(body, width - 2));
  }

  return lines;
});
