// Timeline view renderer — proportional bars across a horizontal axis.

import { buildIdToName } from "../../../../readers/views";
import { padRight } from "../../../text";
import { databaseHeader } from "../header";
import { registerView, type ViewRenderNode } from "./engine";
import { cellValue, rowTitle, visibleColumns } from "./helpers";

function renderTimeline(node: ViewRenderNode, total: number): string[] {
  const lines = [databaseHeader(node.dbTitle, node.tabs, total)];
  const schema = node.dataSource.properties ?? {};
  const config = node.view.configuration ?? {};
  const idToName = buildIdToName(schema);

  // Resolve the date column from configuration.date_property_id or the first date-typed property.
  const datePropId = config.date_property_id as string | undefined;
  const dateColName = datePropId
    ? (idToName[datePropId] ?? datePropId)
    : Object.entries(schema).find(([, property]) => property.type === "date")?.[0];

  const nameWidth = Math.max(8, Math.floor(total * 0.3));
  const barWidth = Math.max(1, total - nameWidth - 1);

  // Collect raw date strings from all rows to determine the axis range.
  interface Entry {
    label: string;
    startMs: number;
    endMs: number;
  }

  const entries: Entry[] = [];
  for (const row of node.rows) {
    const dateStr = dateColName ? cellValue(row, dateColName) : "";
    // Date cells render as "YYYY-MM-DD" or "YYYY-MM-DD → YYYY-MM-DD" from renderPropertyValue.
    const parts = dateStr.split(" → ");
    const startMs = parts[0] ? Date.parse(parts[0]) : Number.NaN;
    if (Number.isNaN(startMs)) {
      continue;
    }
    const endMs = parts[1] ? Date.parse(parts[1]) || startMs : startMs;
    entries.push({ label: rowTitle(row, node.titleColumn), startMs, endMs });
  }

  if (entries.length === 0) {
    // No usable dates — fall back to a label list.
    const columns = visibleColumns(node.view, node.dataSource, node.titleColumn);
    for (const row of node.rows) {
      lines.push(
        `${padRight(rowTitle(row, node.titleColumn), nameWidth)}│${padRight(cellValue(row, columns[1] ?? node.titleColumn), barWidth)}`,
      );
    }
    return lines;
  }

  const minMs = Math.min(...entries.map((entry) => entry.startMs));
  const maxMs = Math.max(...entries.map((entry) => entry.endMs));
  const span = maxMs - minMs || 1;

  for (const entry of entries) {
    const startColumn = Math.max(0, Math.min(barWidth - 1, Math.round(((entry.startMs - minMs) / span) * barWidth)));
    const rawEnd = Math.round(((entry.endMs - minMs) / span) * barWidth);
    // Guarantee at least one filled cell so point-in-time events are visible.
    const endColumn = Math.min(barWidth, Math.max(startColumn + 1, rawEnd));
    const bar = Array.from({ length: barWidth }, (_, column) =>
      column >= startColumn && column < endColumn ? "█" : "·",
    ).join("");
    lines.push(`${padRight(entry.label, nameWidth)}│${bar}`);
  }
  return lines;
}

registerView("timeline", renderTimeline);
