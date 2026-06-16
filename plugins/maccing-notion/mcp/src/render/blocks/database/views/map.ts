// Map view renderer — placeholder with pin count.

import { box } from "../../../box";
import { databaseHeader } from "../header";
import { registerView } from "./engine";

export interface MapBlock {
  type: "map";
  name: string;
  views?: string[];
  pins?: number;
}

function renderMap(block: MapBlock, total: number): string[] {
  return [
    databaseHeader(block.name, block.views, total),
    ...box(["[ map view ]", `  ${block.pins ?? 0} pin(s)`], total - 2),
  ];
}

registerView("map", renderMap);
