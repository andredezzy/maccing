// Dashboard view renderer — renders each sibling view as a widget stack.
// For official data, stacks all rows through the table renderer as a summary widget.

import { databaseHeader } from "../header";
import { registerView, renderView, type ViewRenderNode } from "./engine";

function renderDashboard(node: ViewRenderNode, total: number): string[] {
  const lines = [databaseHeader(node.dbTitle, node.tabs, total)];
  // A dashboard renders its own data as a table widget alongside the header.
  // The table renderer already handles the full grid; show it as the default widget.
  const tableNode: ViewRenderNode = { ...node, type: "table" };
  lines.push("", `▸ ${node.dbTitle}`, ...renderView(tableNode, total, 0, 0));
  return lines;
}

registerView("dashboard", renderDashboard);
