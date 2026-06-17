// Chart view renderer — bar chart grouping rows by a property, or a count total.

import { buildIdToName } from "../../../../readers/views";
import { box } from "../../../box";
import { displayWidth, padRight } from "../../../text";
import { databaseHeader } from "../header";
import { registerView, type ViewRenderNode } from "./engine";
import { cellValue } from "./helpers";

function renderChart(node: ViewRenderNode, total: number): string[] {
  const lines = [databaseHeader(node.dbTitle, node.tabs, node.view.name, total)];
  const schema = node.dataSource.properties ?? {};
  const config = node.view.configuration ?? {};
  const idToName = buildIdToName(schema);

  // Resolve group-by column from view configuration.
  const groupByPropId = (config.group_by as { property_id?: string } | undefined)?.property_id;
  const groupByName = groupByPropId ? (idToName[groupByPropId] ?? groupByPropId) : undefined;

  if (!groupByName || node.rows.length === 0) {
    // No group-by or no data — show total count.
    return [...lines, ...box([`  ${node.rows.length} rows`], total - 2)];
  }

  // Count rows per group value.
  const counts = new Map<string, number>();
  for (const row of node.rows) {
    const key = cellValue(row, groupByName) || "(empty)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const data = [...counts].map(([label, value]) => ({ label, value }));
  if (data.length === 0) {
    return [...lines, ...box(["(no data)"], total - 2)];
  }

  const labelWidth = Math.min(20, Math.max(...data.map((point) => displayWidth(point.label))));
  const valueStrings = data.map((point) => String(point.value));
  const valueWidth = Math.max(...valueStrings.map(displayWidth));
  const barWidth = Math.max(1, total - labelWidth - valueWidth - 2);
  const max = Math.max(1, ...data.map((point) => point.value));

  for (let index = 0; index < data.length; index++) {
    const filled = Math.round((data[index].value / max) * barWidth);
    const bar = "█".repeat(filled) + "·".repeat(Math.max(0, barWidth - filled));
    lines.push(`${padRight(data[index].label, labelWidth)} ${bar} ${padRight(valueStrings[index], valueWidth)}`);
  }
  return lines;
}

registerView("chart", renderChart);
