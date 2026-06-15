// The live database-mapper is pure → tested on synthetic resolved views + rows, then rendered to prove
// the produced model is renderable and aligned. Run with `bun test`.

import { expect, test } from "bun:test";
import { databaseToModel, flattenValue, type RawRow } from "./database-model";
import { displayWidth, renderDatabase } from "./index";

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

test("flattenValue handles the remaining property types", () => {
  expect(flattenValue({ type: "rich_text", rich_text: [{ plain_text: "hi" }] })).toBe("hi");
  expect(flattenValue({ type: "people", people: [{ name: "Ana" }, { name: "Bo" }] })).toBe("Ana, Bo");
  expect(flattenValue({ type: "url", url: "https://x" })).toBe("https://x");
  expect(flattenValue({ type: "email", email: "a@b.com" })).toBe("a@b.com");
  expect(flattenValue({ type: "phone_number", phone_number: "555" })).toBe("555");
  expect(flattenValue({ type: "created_time", created_time: "2025-01-01T00:00:00Z" })).toBe("2025-01-01T00:00:00Z");
  expect(flattenValue({ type: "last_edited_time", last_edited_time: "2025-02-02T00:00:00Z" })).toBe(
    "2025-02-02T00:00:00Z",
  );
  expect(flattenValue({ type: "unique_id", unique_id: { prefix: "TASK", number: 42 } })).toBe("TASK-42");
  expect(flattenValue({ type: "unique_id", unique_id: { number: 7 } })).toBe("7");
  expect(flattenValue({ type: "rollup", rollup: { type: "number", number: 5 } })).toBe("5");
  expect(flattenValue({ type: "rollup", rollup: { type: "array", array: [{}, {}] } })).toBe("2 item(s)");
  expect(flattenValue({ type: "checkbox", checkbox: false })).toBe("☐");
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

test("board seeds every group-by option as a column (even empty), in order, and caps a dominant column", () => {
  const manyDone: RawRow[] = Array.from({ length: 9 }, (_, i) => ({
    properties: {
      Name: { type: "title", title: [{ plain_text: `Task ${i}` }] },
      Status: { type: "status", status: { name: "Done" } },
    },
  }));
  const model = databaseToModel({
    title: "Tasks",
    titleColumn: "Name",
    rows: manyDone,
    views: [
      {
        name: "Board",
        type: "board",
        columns: ["Name", "Status"],
        groupBy: "Status",
        groupOptions: ["Not started", "Next to-do", "In progress", "Done"],
      },
    ],
  });
  const board = model.views[0];
  expect(board.type).toBe("board");
  if (board.type === "board") {
    // every status column appears, in option order — not just the ones present in the sample
    expect(board.groups.map((g) => g.name)).toEqual(["Not started", "Next to-do", "In progress", "Done"]);
    const done = board.groups.find((g) => g.name === "Done");
    expect(done?.total).toBe(9); // header keeps the TRUE count
    expect(done?.cards.length).toBeLessThanOrEqual(7); // capped: 6 cards + a "+N more"
    expect(done?.cards.some((c) => c.name.includes("more"))).toBe(true);
  }
  const out = renderDatabase(model);
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
  expect(out).toContain("Not started"); // empty columns still drawn
  expect(out).toContain("Done  (9)"); // true count in the header
});
