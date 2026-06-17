// Map view renderer — placeholder with pin count.

import { box } from "../../../box";
import { registerView, type ViewRenderNode } from "./engine";

function renderMap(node: ViewRenderNode, total: number): string[] {
  return box(["[ map view ]", `  ${node.rows.length} pin(s)`], total - 2);
}

registerView("map", renderMap);
