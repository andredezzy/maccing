// The live database-mapper is pure → tested on synthetic resolved views + rows, then rendered to prove
// the produced model is renderable and aligned. Run with `bun test`.

import { expect, test } from "bun:test";
import { databaseToModel, flattenValue, type RawRow } from "./notion-to-database-model";
import { displayWidth, renderDatabase } from "./render-mockup";

test("flattenValue handles the common property types", () => {
  expect(flattenValue({ type: "title", title: [{ plain_text: "Hi" }] })).toBe("Hi");
  expect(flattenValue({ type: "number", number: 42 })).toBe("42");
  expect(flattenValue({ type: "select", select: { name: "Done" } })).toBe("Done");
  expect(flattenValue({ type: "status", status: { name: "In progress" } })).toBe("In progress");
  expect(flattenValue({ type: "multi_select", multi_select: [{ name: "a" }, { name: "b" }] })).toBe("a, b");
  expect(flattenValue({ type: "checkbox", checkbox: true })).toBe("☑");
  expect(flattenValue({ type: "date", date: { start: "2025-06-09" } })).toBe("2025-06-09");
  expect(flattenValue({ type: "formula", formula: { type: "number", number: 190 } })).toBe("190");
  expect(flattenValue({ type: "relation", relation: [{}, {}] })).toBe("2 linked");
  expect(flattenValue(undefined)).toBe("");
});

const rows: RawRow[] = [
  {
    properties: {
      Name: { type: "title", title: [{ plain_text: "Push day" }] },
      Status: { type: "status", status: { name: "Done" } },
      Date: { type: "date", date: { start: "2025-06-09" } },
    },
  },
  {
    properties: {
      Name: { type: "title", title: [{ plain_text: "Pull day" }] },
      Status: { type: "status", status: { name: "To do" } },
      Date: { type: "date", date: { start: "2025-06-11" } },
    },
  },
];

test("maps every resolved view type to a renderable, aligned DatabaseModel", () => {
  for (const view of [
    { name: "Table", type: "table", columns: ["Name", "Status", "Date"] },
    { name: "Gallery", type: "gallery", columns: ["Name", "Status"] },
    { name: "Board", type: "board", columns: ["Name", "Status"], groupBy: "Status" },
    { name: "List", type: "list", columns: ["Name", "Status"] },
    { name: "Calendar", type: "calendar", columns: ["Name", "Date"], dateProp: "Date" },
    { name: "Timeline", type: "timeline", columns: ["Name", "Date"] }, // unknown-for-mapping → table fallback
  ]) {
    const model = databaseToModel({ title: "Sessions", icon: "🏋", titleColumn: "Name", views: [view], rows });
    const out = renderDatabase(model);
    for (const line of out.split("\n")) {
      expect(displayWidth(line)).toBeLessThanOrEqual(70);
    }
    expect(out).toContain("🏋 Sessions");
  }
});

test("every view's tab bar lists all sibling view names, not just its own", () => {
  const model = databaseToModel({
    title: "Sessions",
    titleColumn: "Name",
    rows,
    views: [
      { name: "All logs", type: "table", columns: ["Name", "Status"] },
      { name: "By muscle", type: "gallery", columns: ["Name"] },
      { name: "By status", type: "board", columns: ["Name", "Status"], groupBy: "Status" },
    ],
  });
  for (const view of model.views) {
    expect(view.views).toEqual(["All logs", "By muscle", "By status"]);
  }
});

test("board groups by the group-by column; calendar derives its month from row dates", () => {
  const board = renderDatabase(
    databaseToModel({
      title: "S",
      titleColumn: "Name",
      rows,
      views: [{ name: "B", type: "board", columns: ["Name", "Status"], groupBy: "Status" }],
    }),
  );
  expect(board).toContain("Done  (1)");
  expect(board).toContain("To do  (1)");

  const cal = renderDatabase(
    databaseToModel({
      title: "S",
      titleColumn: "Name",
      rows,
      views: [{ name: "C", type: "calendar", columns: ["Name", "Date"], dateProp: "Date" }],
    }),
  );
  expect(cal).toContain("June 2025");
});
