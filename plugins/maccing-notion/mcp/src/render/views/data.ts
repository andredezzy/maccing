// Data view renderers — table (grid), chart (bar/number), form (fields + submit), map (placeholder),
// and dashboard (a stack of titled widgets, each recursing through the engine).

import { box, renderTableGrid } from "../box";
import { register, renderBlock } from "../engine";
import type { ChartBlock, DashboardBlock, FormBlock, MapBlock } from "../model";
import { clip, displayWidth, padRight } from "../text";
import { dbHeader } from "./chrome";

function renderChart(block: ChartBlock, total: number): string[] {
  const lines = [dbHeader(block.name, block.views, total)];
  if (block.chartType === "number") {
    const value = block.value ?? String(block.data?.[0]?.value ?? 0);
    return [...lines, ...box([`  ${value}${block.unit ? ` ${block.unit}` : ""}`], total - 2)];
  }
  const data = block.data ?? [];
  if (data.length === 0) {
    return [...lines, ...box(["(no data)"], total - 2)];
  }
  const labelW = Math.min(20, Math.max(...data.map((d) => displayWidth(d.label))));
  const valStrs = data.map((d) => String(d.value));
  const valW = Math.max(...valStrs.map(displayWidth));
  const barW = Math.max(1, total - labelW - valW - 2);
  const max = Math.max(1, ...data.map((d) => d.value));
  for (let i = 0; i < data.length; i++) {
    const filled = Math.round((data[i].value / max) * barW);
    const bar = "█".repeat(filled) + "·".repeat(Math.max(0, barW - filled));
    lines.push(`${padRight(data[i].label, labelW)} ${bar} ${padRight(valStrs[i], valW)}`);
  }
  return lines;
}
function renderForm(block: FormBlock, total: number): string[] {
  const widget = (fieldType?: string): string =>
    fieldType === "checkbox"
      ? "[ ]"
      : fieldType === "select"
        ? "[ ▾ ]"
        : fieldType === "date"
          ? "[ 📅 ]"
          : fieldType === "person"
            ? "[ @ ]"
            : "[ _____ ]";
  const fields = block.fields.map((f) => clip(`${f.label}:  ${widget(f.fieldType)}`, total - 2));
  return [dbHeader(block.name, block.views, total), ...box([...fields, "", "[ Submit ]"], total - 2)];
}
function renderMap(block: MapBlock, total: number): string[] {
  return [dbHeader(block.name, block.views, total), ...box(["[ map view ]", `  ${block.pins ?? 0} pin(s)`], total - 2)];
}
function renderDashboard(block: DashboardBlock, total: number): string[] {
  const lines = [dbHeader(block.name, block.views, total)];
  for (const widget of block.widgets) {
    lines.push("", `▸ ${widget.title}`, ...renderBlock(widget.view, total, 0, 0));
  }
  return lines;
}

register("table", (block, width) => [
  dbHeader(block.name, block.views, width),
  ...renderTableGrid(block.columns, block.rows, width, "─"),
]);
register("chart", (block, width) => renderChart(block, width));
register("form", (block, width) => renderForm(block, width));
register("map", (block, width) => renderMap(block, width));
register("dashboard", (block, width) => renderDashboard(block, width));
