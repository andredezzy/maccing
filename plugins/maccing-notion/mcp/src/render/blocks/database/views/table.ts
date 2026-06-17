// Table view renderer — a full grid of visible columns × rows.

import { renderTableGrid } from "../../../box";
import { databaseHeader } from "../header";
import { registerView, type ViewRenderNode } from "./engine";
import { cellValue, visibleColumns } from "./helpers";

function renderTable(node: ViewRenderNode, width: number): string[] {
  const columns = visibleColumns(node.view, node.dataSource, node.titleColumn);
  const rows = node.rows.map((row) => columns.map((column) => cellValue(row, column)));
  return [databaseHeader(node.dbTitle, node.tabs, width), ...renderTableGrid(columns, rows, width, "─")];
}

registerView("table", renderTable);
