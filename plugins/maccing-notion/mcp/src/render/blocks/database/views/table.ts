// Table view renderer — a full grid of rows and columns.

import { renderTableGrid } from "../../../box";
import { databaseHeader } from "../header";
import { registerView } from "./engine";

export interface TableBlock {
  type: "table";
  name: string;
  views?: string[];
  columns: string[];
  rows: string[][];
}

function renderTable(block: TableBlock, width: number): string[] {
  return [databaseHeader(block.name, block.views, width), ...renderTableGrid(block.columns, block.rows, width, "─")];
}

registerView("table", renderTable);
