// Table view renderer — a full grid of visible columns × rows.

import { renderTableGrid } from "../../../box";
import { registerView, type ViewRenderNode } from "./engine";
import { cellValue, visibleColumns } from "./helpers";

// A column needs ≈10 cols (≈7 content + 2 padding + 1 border) to stay readable; below that a wide table
// collapses into truncation soup. At width 70 this keeps ~6 columns — the readable sweet spot.
const MIN_COLUMN_CELL = 10;

function renderTable(node: ViewRenderNode, width: number): string[] {
  const allColumns = visibleColumns(node.view, node.dataSource, node.titleColumn);

  // Inline tables cap to the columns that stay readable; the standalone mockup (capColumns unset) shows all.
  const maxColumns = Math.max(1, Math.floor((width - 1) / MIN_COLUMN_CELL));
  const dropped = node.capColumns && allColumns.length > maxColumns ? allColumns.length - maxColumns : 0;
  const columns = dropped > 0 ? allColumns.slice(0, maxColumns) : allColumns;

  const rows = node.rows.map((row) => columns.map((column) => cellValue(row, column)));
  const grid = renderTableGrid(columns, rows, width, "─");

  return dropped > 0
    ? [...grid, `(+${dropped} more column${dropped === 1 ? "" : "s"} — open the database to see all)`]
    : grid;
}

registerView("table", renderTable);
