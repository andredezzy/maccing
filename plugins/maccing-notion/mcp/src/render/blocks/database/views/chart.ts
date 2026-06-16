// Chart view renderer — bar, line, donut, or number.

import { box } from "../../../box";
import { displayWidth, padRight } from "../../../text";
import { databaseHeader } from "../header";
import { registerView } from "./engine";

interface ChartDatum {
  label: string;
  value: number;
}
export interface ChartBlock {
  type: "chart";
  name: string;
  views?: string[];
  chartType: "bar" | "line" | "donut" | "number";
  data?: ChartDatum[];
  value?: string; // for chartType "number"
  unit?: string;
}

function renderChart(block: ChartBlock, total: number): string[] {
  const lines = [databaseHeader(block.name, block.views, total)];
  if (block.chartType === "number") {
    const value = block.value ?? String(block.data?.[0]?.value ?? 0);
    return [...lines, ...box([`  ${value}${block.unit ? ` ${block.unit}` : ""}`], total - 2)];
  }
  const data = block.data ?? [];
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
