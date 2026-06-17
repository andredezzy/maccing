// The live database-mapper is pure → tested on synthetic resolved views + rows, then rendered to prove
// the produced model is renderable and aligned. Run with `bun test`.

import { expect, test } from "bun:test";
import type { PropertiesMap } from "../readers/schema";
import type { IdToName, RawView } from "../readers/views";
import { databaseToModel, flattenValue, groupOptionsFor, type RawRow, resolveView } from "./database-model";
import { displayWidth, render } from "./index";

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
  expect(flattenValue({ type: "relation", relation: [] })).toBe(""); // empty relation → "" (falsy length branch)
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

test("flattenValue: date ranges, formula booleans, and null/unknown edge cases", () => {
  expect(flattenValue({ type: "date", date: { start: "2025-06-09", end: "2025-06-11" } })).toBe(
    "2025-06-09 → 2025-06-11",
  );
  expect(flattenValue({ type: "date", date: null })).toBe("");
  expect(flattenValue({ type: "number", number: null })).toBe("");
  expect(flattenValue({ type: "formula", formula: { type: "boolean", boolean: true } })).toBe("☑");
  expect(flattenValue({ type: "formula", formula: { type: "boolean", boolean: false } })).toBe("☐");
  expect(flattenValue({ type: "formula", formula: { type: "string", string: "hello" } })).toBe("hello");
  // A formula returning a DATE formats the date range (not "[object Object]") — the formula branch
  // routes its `date` sub-type through the shared formatDateRange, same as a plain date property.
  expect(flattenValue({ type: "formula", formula: { type: "date", date: { start: "2025-06-09" } } })).toBe(
    "2025-06-09",
  );
  expect(
    flattenValue({ type: "formula", formula: { type: "date", date: { start: "2025-06-09", end: "2025-06-11" } } }),
  ).toBe("2025-06-09 → 2025-06-11");
  expect(flattenValue({ type: "some_future_type" })).toBe(""); // unknown type → empty default
});

test("resolveView resolves visible columns (id → name) with decoded + property_name fallbacks", () => {
  const idToName: IdToName = { a: "Alpha", b: "Beta", ">": "Greater" };
  const view: RawView = {
    name: "My view",
    type: "table",
    configuration: {
      properties: [
        { property_id: "a" }, // direct id lookup
        { property_id: "b", visible: false }, // hidden → excluded
        { property_id: "%3E" }, // decoded variant ('%3E' → '>')
        { property_id: "z", property_name: "Zeta" }, // unknown id → property_name fallback
      ],
    },
  };
  const resolved = resolveView(view, idToName);
  expect(resolved.name).toBe("My view");
  expect(resolved.type).toBe("table");
  expect(resolved.columns).toEqual(["Alpha", "Greater", "Zeta"]); // Beta excluded (visible:false)
});

test("resolveView resolves group_by + dateProperty, falling back to date_property_name and 'View'", () => {
  const grouped = resolveView({ type: "board", configuration: { group_by: { property_id: "s" } } }, { s: "Status" });
  expect(grouped.groupBy).toBe("Status");

  // date_property_id present → resolved name wins over the verbatim date_property_name fallback
  const withDateId = resolveView(
    { configuration: { date_property_id: "d", date_property_name: "Fallback" } },
    { d: "When" },
  );
  expect(withDateId.dateProperty).toBe("When");

  // date_property_id absent → dateProperty falls back to date_property_name verbatim; no name → "View"; no type → "table"
  const dated = resolveView({ configuration: { date_property_name: "When" } }, {});
  expect(dated.dateProperty).toBe("When");
  expect(dated.name).toBe("View");
  expect(dated.type).toBe("table");
});

test("groupOptionsFor returns the group-by property's status/select options in order, else undefined", () => {
  const schema: PropertiesMap = {
    Status: { type: "status", status: { options: [{ name: "To do" }, { name: "Done" }] } },
    Tag: { type: "select", select: { options: [{ name: "A" }] } },
    Empty: { type: "status", status: { options: [] } },
  };
  expect(groupOptionsFor("Status", schema)).toEqual(["To do", "Done"]);
  expect(groupOptionsFor("Tag", schema)).toEqual(["A"]);
  expect(groupOptionsFor("Empty", schema)).toBeUndefined(); // present but no options
  expect(groupOptionsFor("Missing", schema)).toBeUndefined(); // not in the schema
  expect(groupOptionsFor(undefined, schema)).toBeUndefined(); // no group-by column
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
    { name: "Calendar", type: "calendar", columns: ["Name", "Date"], dateProperty: "Date" },
    { name: "Timeline", type: "timeline", columns: ["Name", "Date"] }, // unknown-for-mapping → table fallback
  ]) {
    const model = databaseToModel({ title: "Sessions", icon: "🏋", titleColumn: "Name", views: [view], rows });
    const out = render({ type: "database", database: model });
    for (const line of out.split("\n")) {
      expect(displayWidth(line)).toBeLessThanOrEqual(70);
    }
    expect(out).toContain("🏋 Sessions");
  }
});

test("a calendar view with no parseable dates falls through to a table", () => {
  const model = databaseToModel({
    title: "E",
    titleColumn: "Name",
    rows: [
      {
        properties: {
          Name: { type: "title", title: [{ plain_text: "X" }] },
          When: { type: "select", select: { name: "TBD" } },
        },
      },
    ],
    views: [{ name: "C", type: "calendar", columns: ["Name", "When"], dateProperty: "When" }],
  });
  expect(model.views[0].type).toBe("table");
});

test("databaseToModel with no views emits a single-column title table fallback", () => {
  const model = databaseToModel({
    title: "T",
    titleColumn: "Name",
    views: [],
    rows: [{ properties: { Name: { type: "title", title: [{ plain_text: "Row1" }] } } }],
  });
  expect(model.views).toHaveLength(1);
  expect(model.views[0].type).toBe("table");
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
  const board = render({
    type: "database",
    database: databaseToModel({
      title: "S",
      titleColumn: "Name",
      rows,
      views: [{ name: "B", type: "board", columns: ["Name", "Status"], groupBy: "Status" }],
    }),
  });
  expect(board).toContain("Done  (1)");
  expect(board).toContain("To do  (1)");

  const cal = render({
    type: "database",
    database: databaseToModel({
      title: "S",
      titleColumn: "Name",
      rows,
      views: [{ name: "C", type: "calendar", columns: ["Name", "Date"], dateProperty: "Date" }],
    }),
  });
  expect(cal).toContain("June 2025");
});

test("calendar auto-detects the date column via the regex fallback when no dateProperty is given", () => {
  // No dateProperty → viewToBlock scans the columns for the first date-shaped value (/^\d{4}-\d{2}/).
  const model = databaseToModel({
    title: "S",
    titleColumn: "Name",
    rows,
    views: [{ name: "C", type: "calendar", columns: ["Name", "Date"] }],
  });
  const view = model.views[0];
  expect(view.type).toBe("calendar");
  if (view.type === "calendar") {
    expect(view.year).toBe(2025);
    expect(view.month).toBe(6);
    expect((view.events ?? []).map((event) => event.day).sort((first, second) => first - second)).toEqual([9, 11]);
  }
});

test("board seeds every group-by option as a column (even empty), in order, and caps a dominant column", () => {
  const manyDone: RawRow[] = Array.from({ length: 9 }, (_, index) => ({
    properties: {
      Name: { type: "title", title: [{ plain_text: `Task ${index}` }] },
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
    expect(board.groups.map((group) => group.name)).toEqual(["Not started", "Next to-do", "In progress", "Done"]);
    const done = board.groups.find((group) => group.name === "Done");
    expect(done?.total).toBe(9); // header keeps the TRUE count
    expect(done?.cards.length).toBeLessThanOrEqual(7); // capped: 6 cards + a "+N more"
    expect(done?.cards.some((card) => card.name.includes("more"))).toBe(true);
  }
  const out = render({ type: "database", database: model });
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
  expect(out).toContain("Not started"); // empty columns still drawn
  expect(out).toContain("Done  (9)"); // true count in the header
});

test("flattenValue: created_by and last_edited_by return the user name", () => {
  expect(flattenValue({ type: "created_by", created_by: { name: "Alice" } })).toBe("Alice");
  expect(flattenValue({ type: "created_by", created_by: {} })).toBe("");
  expect(flattenValue({ type: "last_edited_by", last_edited_by: { name: "Bob" } })).toBe("Bob");
  expect(flattenValue({ type: "last_edited_by", last_edited_by: {} })).toBe("");
});
