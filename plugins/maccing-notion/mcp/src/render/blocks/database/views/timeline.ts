// Timeline view renderer — proportional bars across a horizontal axis.

import { padRight } from "../../../text";
import { databaseHeader } from "../header";
import { registerView } from "./engine";

interface TimelineRow {
  label: string;
  start: number; // fraction 0-1 of the axis
  end: number; // fraction 0-1
}
export interface TimelineBlock {
  type: "timeline";
  name: string;
  views?: string[];
  axis?: string;
  rows: TimelineRow[];
}

function renderTimeline(block: TimelineBlock, total: number): string[] {
  const lines = [databaseHeader(block.name, block.views, total)];
  const nameWidth = Math.max(8, Math.floor(total * 0.3));
  const barWidth = Math.max(1, total - nameWidth - 1);
  if (block.axis) {
    lines.push(`${padRight("", nameWidth)}│${padRight(block.axis, barWidth)}`);
  }
  for (const row of block.rows) {
    const startColumn = Math.max(0, Math.min(barWidth, Math.round((row.start || 0) * barWidth)));
    const endColumn = Math.max(startColumn, Math.min(barWidth, Math.round((row.end || 0) * barWidth)));
    const bar = Array.from({ length: barWidth }, (_, column) =>
      column >= startColumn && column < endColumn ? "█" : "·",
    ).join("");
    lines.push(`${padRight(row.label, nameWidth)}│${bar}`);
  }
  return lines;
}

registerView("timeline", renderTimeline);
