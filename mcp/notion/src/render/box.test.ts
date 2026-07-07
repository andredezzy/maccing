// Pure unit tests for the box-drawing primitives that render paths don't exercise directly. Run with `bun test`.

import { expect, test } from "bun:test";

import { hcat, renderTableGrid } from "./box";
import { displayWidth } from "./text";

test("hcat returns an empty array when given no boxes", () => {
  expect(hcat([], 2)).toEqual([]);
});

test("hcat lays boxes side by side, padding shorter ones to the tallest height", () => {
  const left = ["aa", "bb", "cc"];
  const right = ["xx"]; // shorter → padded with blank lines to match height
  expect(hcat([left, right], 1)).toEqual(["aa xx", "bb   ", "cc   "]);
});

// ── renderTableGrid / fitColumns tests (C) ────────────────────────────────

test("renderTableGrid: wide table shrinks proportionally — every line fits within the total width", () => {
  // Six columns with deliberately LONG values to force proportional shrink
  const columns = ["Title", "Assignee", "Status", "Priority", "Due date", "Project"];
  const rows = [
    [
      "This is a very long task title that exceeds the column budget",
      "Alexandra Johnson",
      "In progress",
      "Critical urgency",
      "2026-12-31",
      "Platform migration",
    ],
    [
      "Another extremely long description that overflows",
      "Mohammad Al-Rashid",
      "Not started",
      "High importance",
      "2026-06-15",
      "Frontend redesign",
    ],
  ];
  const total = 70;
  const lines = renderTableGrid(columns, rows, total, "─");

  // Every rendered line must fit within the total display width
  for (const line of lines) {
    expect(displayWidth(line)).toBeLessThanOrEqual(total);
  }

  // Box must close: top, all body rows, and bottom have the same width
  const [top, ...rest] = lines;
  const bottom = rest[rest.length - 1];
  const topWidth = displayWidth(top);

  expect(topWidth).toBeGreaterThan(0);

  for (const line of lines) {
    expect(displayWidth(line)).toBe(topWidth);
  }

  // Sanity: top starts with ┌ and ends with ┐; bottom starts with └ and ends with ┘
  expect(top.startsWith("┌")).toBe(true);
  expect(top.endsWith("┐")).toBe(true);
  expect(bottom.startsWith("└")).toBe(true);
  expect(bottom.endsWith("┘")).toBe(true);
});

test("renderTableGrid: under-budget table fills the total width exactly", () => {
  // Short values that don't fill the canvas — fitColumns should distribute the slack
  const columns = ["A", "B"];
  const rows = [["x", "y"]];
  const total = 30;
  const lines = renderTableGrid(columns, rows, total, "─");

  for (const line of lines) {
    expect(displayWidth(line)).toBe(total);
  }
});
