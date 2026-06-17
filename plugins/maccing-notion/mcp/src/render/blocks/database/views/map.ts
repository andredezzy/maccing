// Map view renderer — placeholder with pin count.

import { box } from "../../../box";
import { databaseHeader } from "../header";
import { registerView, type ViewRenderNode } from "./engine";

function renderMap(node: ViewRenderNode, total: number): string[] {
  return [
    databaseHeader(node.dbTitle, node.tabs, total),
    ...box(["[ map view ]", `  ${node.rows.length} pin(s)`], total - 2),
  ];
}

registerView("map", renderMap);
