// Data view renderers — table (grid), chart (bar/number), form (fields + submit), map (placeholder),
// and dashboard (a stack of titled widgets, each recursing through the engine).

import { box, renderTableGrid } from "../box";
import { type MockupBlock, register, renderBlock } from "../engine";
import { clip, displayWidth, padRight } from "../text";
import { databaseHeader } from "./database-header";

export interface TableBlock {
  type: "table";
  name: string;
  views?: string[];
  columns: string[];
  rows: string[][];
}
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
interface FormField {
  label: string;
  fieldType?: string; // text | checkbox | select | date | person | number
}
export interface FormBlock {
  type: "form";
  name: string;
  views?: string[];
  fields: FormField[];
}
export interface MapBlock {
  type: "map";
  name: string;
  views?: string[];
  pins?: number;
}
interface DashboardWidget {
  title: string;
  view: MockupBlock;
}
export interface DashboardBlock {
  type: "dashboard";
  name: string;
  views?: string[];
  widgets: DashboardWidget[];
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
  const fields = block.fields.map((field) => clip(`${field.label}:  ${widget(field.fieldType)}`, total - 2));
  return [databaseHeader(block.name, block.views, total), ...box([...fields, "", "[ Submit ]"], total - 2)];
}

function renderMap(block: MapBlock, total: number): string[] {
  return [
    databaseHeader(block.name, block.views, total),
    ...box(["[ map view ]", `  ${block.pins ?? 0} pin(s)`], total - 2),
  ];
}

function renderDashboard(block: DashboardBlock, total: number): string[] {
  const lines = [databaseHeader(block.name, block.views, total)];
  for (const widget of block.widgets) {
    lines.push("", `▸ ${widget.title}`, ...renderBlock(widget.view, total, 0, 0));
  }
  return lines;
}

register("table", (block, width) => [
  databaseHeader(block.name, block.views, width),
  ...renderTableGrid(block.columns, block.rows, width, "─"),
]);
register("chart", renderChart);
register("form", renderForm);
register("map", renderMap);
register("dashboard", renderDashboard);
