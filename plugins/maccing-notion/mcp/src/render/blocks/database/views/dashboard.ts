// Dashboard view renderer — a stack of titled widgets, each a database view.

import { databaseHeader } from "../header";
import { type DatabaseView, registerView, renderView } from "./engine";

interface DashboardWidget {
  title: string;
  view: DatabaseView;
}
export interface DashboardBlock {
  type: "dashboard";
  name: string;
  views?: string[];
  widgets: DashboardWidget[];
}

function renderDashboard(block: DashboardBlock, total: number): string[] {
  const lines = [databaseHeader(block.name, block.views, total)];
  for (const widget of block.widgets) {
    lines.push("", `▸ ${widget.title}`, ...renderView(widget.view, total, 0, 0));
  }
  return lines;
}

registerView("dashboard", renderDashboard);
