// Dashboard view renderer — renders each sibling view as a widget stack.
// For official data, stacks all rows through the table renderer as a summary widget.

import { registerView, renderView, type ViewRenderNode } from "./engine";

function renderDashboard(node: ViewRenderNode, total: number): string[] {
  // A dashboard renders its own data as a table widget. The table renderer handles the full grid;
  // show it as the default widget under a labelled heading.
  const tableNode: ViewRenderNode = { ...node, type: "table" };
  return [`▸ ${node.dbTitle}`, ...renderView(tableNode, total, 0, 0)];
}

registerView("dashboard", renderDashboard);
