// View-engine tests — standalone rendering of every ViewRenderNode type with official API shapes.
// Exercises renderView with real ViewObject + PageObject[] rows + DataSourceObject inputs.

import "../../.."; // registers all block renderers (and transitively the view renderers)
import { expect, test } from "bun:test";
import type { DataSourceObject } from "../../../../notion/data-source";
import type { PageObject } from "../../../../notion/page";
import type { ViewObject } from "../../../../notion/view";
import { displayWidth } from "../../../text";
import { databaseHeader } from "../header";
import { renderView, type ViewRenderNode } from "./engine";

/** Every box (┌…┐ / │…│ / └…┘) must have equal DISPLAY width on every one of its lines. */
function assertSingleBoxesClose(out: string, width: number): void {
  let top = 0;
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(width);
    const isHcatOrColumn = line.includes("  ") || line.includes(" │ ");
    if (line.startsWith("┌") && !isHcatOrColumn) {
      top = displayWidth(line);
    } else if ((line.startsWith("│") || line.startsWith("└")) && !isHcatOrColumn && top) {
      expect(displayWidth(line)).toBe(top);
    }
  }
}

// Fixtures

/** Build a minimal PageObject with a title property. */
function mkTitleRow(titleColumn: string, title: string, extra?: Record<string, string>): PageObject {
  const props: Record<string, unknown> = {
    [titleColumn]: { type: "title", title: [{ plain_text: title }] },
  };
  for (const [name, value] of Object.entries(extra ?? {})) {
    props[name] = { type: "rich_text", rich_text: [{ plain_text: value }] };
  }
  return { properties: props as PageObject["properties"] };
}

/** Build a minimal DataSourceObject with named columns. */
function mkSchema(columns: Array<{ name: string; type?: string; id?: string }>): DataSourceObject {
  const properties: Record<string, unknown> = {};
  for (const column of columns) {
    const type = column.type ?? "rich_text";
    properties[column.name] = { id: column.id ?? column.name, type, [type]: {} };
  }
  return { properties: properties as DataSourceObject["properties"] };
}

/** Build a minimal ViewObject. */
function mkView(type: ViewObject["type"], columnIds?: string[], options?: Partial<ViewObject>): ViewObject {
  const props = columnIds?.map((id) => ({ property_id: id }));
  return {
    name: type.charAt(0).toUpperCase() + type.slice(1),
    type,
    configuration: props ? { properties: props } : undefined,
    ...options,
  };
}

/** Wrap data into a ViewRenderNode. */
function mkNode(
  view: ViewObject,
  rows: PageObject[],
  dataSource: DataSourceObject,
  tabs?: string[],
  titleColumn?: string,
): ViewRenderNode {
  const schemaEntries = Object.entries(dataSource.properties ?? {});
  const derivedTitle =
    schemaEntries.find(([, property]) => property.type === "title")?.[0] ?? schemaEntries[0]?.[0] ?? "Name";
  return {
    type: view.type,
    view,
    rows,
    dataSource,
    dbTitle: "Test DB",
    tabs: tabs ?? [view.name],
    titleColumn: titleColumn ?? derivedTitle,
  };
}

// Simple test fixtures
const schema = mkSchema([
  { name: "Name", type: "title", id: "name" },
  { name: "Status", type: "status", id: "status" },
  { name: "Date", type: "date", id: "date" },
]);

const rows: PageObject[] = [
  mkTitleRow("Name", "Push day", { Status: "Done", Date: "2025-06-09" }),
  mkTitleRow("Name", "Pull day", { Status: "To do", Date: "2025-06-11" }),
];

// Tests

test("a gallery view with no rows renders an (empty) box", () => {
  const view = mkView("gallery", ["name"]);
  const node = mkNode(view, [], schema);
  const out = renderView(node, 70, 0, 0).join("\n");
  expect(out).toContain("(empty)");
  assertSingleBoxesClose(out, 70);
});

test("over-long gallery content is truncated with … so the box still closes", () => {
  const longSchema = mkSchema([
    { name: "Name", type: "title", id: "name" },
    { name: "Description", type: "rich_text", id: "desc" },
  ]);
  const longRows: PageObject[] = [
    mkTitleRow("Name", "Mindset and lifestyle", { Description: "Document your professional projects" }),
  ];
  const view = mkView("gallery", ["name", "desc"]);
  const node = mkNode(view, longRows, longSchema);
  const out = renderView(node, 70, 0, 0).join("\n");
  assertSingleBoxesClose(out, 70);
  expect(out).toContain("…"); // the long name/description got clipped
  const topLine = out.split("\n").find((line) => line.startsWith("┌"));
  for (const line of out.split("\n").filter((line) => line.startsWith("│"))) {
    expect(displayWidth(line)).toBeLessThanOrEqual(displayWidth(topLine ?? ""));
  }
});

test("a calendar view honors leap-year February (29 days in Feb 2024)", () => {
  const calSchema = mkSchema([
    { name: "Name", type: "title", id: "name" },
    { name: "When", type: "date", id: "when" },
  ]);
  const calRows: PageObject[] = [
    {
      properties: {
        Name: { type: "title", title: [{ plain_text: "Leap day" }] },
        When: { type: "date", date: { start: "2024-02-29" } },
      } as unknown as PageObject["properties"],
    },
  ];
  // View with date_property_id pointing to "when"
  const view: ViewObject = {
    name: "Calendar",
    type: "calendar",
    configuration: { date_property_id: "when" },
  };
  const node = mkNode(view, calRows, calSchema);
  const out = renderView(node, 70, 0, 0).join("\n");
  expect(out).toContain("February 2024");
  expect(out).toContain("29"); // the leap day is a real cell — not clamped to 28
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
});

test("render edge branches: group-less board, data-less chart, every form widget", () => {
  // Board with no rows and no group-by → no groups
  const boardView = mkView("board");
  const boardNode = mkNode(boardView, [], schema);
  const board = renderView(boardNode, 70, 0, 0).join("\n");
  expect(board).toContain("(no groups)");

  // Chart with no group-by → shows row count
  const chartView = mkView("chart");
  const chartNode = mkNode(chartView, [], schema);
  const chart = renderView(chartNode, 70, 0, 0).join("\n");
  expect(chart).toContain("rows"); // count placeholder

  // Form view — columns become labeled fields; widget type derived from schema type
  const formSchema = mkSchema([
    { name: "Name", type: "title", id: "name" },
    { name: "When", type: "date", id: "when" },
    { name: "Who", type: "people", id: "who" },
    { name: "Note", type: "rich_text", id: "note" },
  ]);
  const formView = mkView("form", ["name", "when", "who", "note"]);
  const formNode = mkNode(formView, [], formSchema);
  const form = renderView(formNode, 70, 0, 0).join("\n");
  expect(form).toContain("[ 📅 ]"); // date widget
  expect(form).toContain("[ @ ]"); // people widget
  expect(form).toContain("[ _____ ]"); // text/default widget
});

test("render fallback branch: empty list view", () => {
  const view = mkView("list");
  const node = mkNode(view, [], schema);
  const out = renderView(node, 70, 0, 0).join("\n");
  expect(out).toContain("(empty)");
});

test("a table view spans the full width (70) when rendered at width 70", () => {
  const view = mkView("table", ["name", "status"]);
  const node = mkNode(view, rows, schema);
  const out = renderView(node, 70, 0, 0).join("\n");
  const topRule = out.split("\n").find((line) => line.startsWith("┌─") && line.includes("┬"));
  expect(topRule).toBeTruthy();
  expect(displayWidth(topRule ?? "")).toBe(70);
});

test("feed view renders a single-column stack of post cards (grid only — header is added by the database renderer)", () => {
  const feedSchema = mkSchema([
    { name: "Name", type: "title", id: "name" },
    { name: "Meta", type: "rich_text", id: "meta" },
  ]);
  const feedRows: PageObject[] = [mkTitleRow("Name", "Launch", { Meta: "2d ago" }), mkTitleRow("Name", "Hiring")];
  const view = mkView("feed", ["name", "meta"]);
  const node: ViewRenderNode = {
    type: "feed",
    view,
    rows: feedRows,
    dataSource: feedSchema,
    dbTitle: "Announcements",
    tabs: ["Feed"],
    titleColumn: "Name",
  };
  const out = renderView(node, 70, 0, 0).join("\n");
  // renderView emits only the box-art grid now; the ◷ title / Views header is prose owned by renderDatabase.
  expect(out).not.toContain("◷"); // no header woven into the grid
  expect(out).toContain("Launch");
  expect(out).toContain("2d ago");
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
});

test("Phase-2 views (calendar/timeline/chart/form/map/dashboard) render aligned, no overflow", () => {
  const sessionSchema = mkSchema([
    { name: "Name", type: "title", id: "name" },
    { name: "Date", type: "date", id: "date" },
    { name: "Status", type: "status", id: "status" },
  ]);
  const sessionRows: PageObject[] = [
    {
      properties: {
        Name: { type: "title", title: [{ plain_text: "Push" }] },
        Date: { type: "date", date: { start: "2025-06-09" } },
        Status: { type: "status", status: { name: "Done" } },
      } as unknown as PageObject["properties"],
    },
    {
      properties: {
        Name: { type: "title", title: [{ plain_text: "Legs" }] },
        Date: { type: "date", date: { start: "2025-06-14" } },
        Status: { type: "status", status: { name: "To do" } },
      } as unknown as PageObject["properties"],
    },
  ];

  const calendarView: ViewObject = { name: "Calendar", type: "calendar", configuration: { date_property_id: "date" } };
  const timelineView: ViewObject = { name: "Timeline", type: "timeline", configuration: { date_property_id: "date" } };
  const chartView: ViewObject = {
    name: "Chart",
    type: "chart",
    configuration: { group_by: { property_id: "status" } },
  };
  const formView = mkView("form", ["name", "date", "status"]);
  const mapView = mkView("map");
  const dashboardView = mkView("dashboard");

  const viewOutputs = [
    renderView(mkNode(calendarView, sessionRows, sessionSchema, ["Calendar"], "Name"), 70, 0, 0),
    renderView(mkNode(timelineView, sessionRows, sessionSchema, ["Timeline"], "Name"), 70, 0, 0),
    renderView(mkNode(chartView, sessionRows, sessionSchema, ["Chart"], "Name"), 70, 0, 0),
    renderView(mkNode(formView, sessionRows, sessionSchema, ["Form"], "Name"), 70, 0, 0),
    renderView(mkNode(mapView, sessionRows, sessionSchema, ["Map"], "Name"), 70, 0, 0),
    renderView(mkNode(dashboardView, sessionRows, sessionSchema, ["Dashboard"], "Name"), 70, 0, 0),
  ];

  const out = viewOutputs.map((lines) => lines.join("\n")).join("\n\n");
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
  expect(out).toContain("June 2025"); // calendar month header
  expect(out).toContain("█"); // timeline/chart bars drawn
  expect(out).toContain("[ Submit ]"); // form
  expect(out).toContain("Su"); // calendar weekday header
});

test("board seeds every group-by option as a column (even empty), in order, and caps a dominant column", () => {
  const boardSchema = mkSchema([
    { name: "Name", type: "title", id: "name" },
    { name: "Status", type: "status", id: "status_id" },
  ]);
  // Add status options to the schema
  (boardSchema.properties.Status as Record<string, unknown>).status = {
    options: [{ name: "Not started" }, { name: "Next to-do" }, { name: "In progress" }, { name: "Done" }],
  };

  const manyDone: PageObject[] = Array.from({ length: 9 }, (_, index) => ({
    properties: {
      Name: { type: "title", title: [{ plain_text: `Task ${index}` }] },
      Status: { type: "status", status: { name: "Done" } },
    } as unknown as PageObject["properties"],
  }));

  const boardView: ViewObject = {
    name: "Board",
    type: "board",
    configuration: { group_by: { property_id: "status_id" } },
  };
  const node = mkNode(boardView, manyDone, boardSchema, ["Board"], "Name");
  const out = renderView(node, 70, 0, 0).join("\n");

  // Every status column appears including empty ones
  expect(out).toContain("Not started");
  expect(out).toContain("Next to-do");
  expect(out).toContain("In progress");
  expect(out).toContain("Done  (9)"); // true count

  // Capped: a "+N more" tail card for the overflowing Done column
  expect(out).toContain("more");
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
});

test("the Views line lists every sibling view name and bolds the selected one", () => {
  const tabs = ["All logs", "By status", "Timeline"];
  for (const selected of tabs) {
    const [titleLine, viewsLine] = databaseHeader("Sessions", tabs, selected, 70);
    expect(titleLine).toBe("◷ **Sessions**");
    for (const tab of tabs) {
      expect(viewsLine).toContain(tab); // every sibling tab is listed, not just the selected one
    }
    expect(viewsLine).toContain(`**${selected}**`); // the selected view is in real markdown bold
  }
});

test("calendar falls through to table when no date column is found", () => {
  const noDateSchema = mkSchema([
    { name: "Name", type: "title", id: "name" },
    { name: "Tag", type: "select", id: "tag" },
  ]);
  const calView = mkView("calendar", ["name", "tag"]);
  const node = mkNode(calView, [mkTitleRow("Name", "X", { Tag: "TBD" })], noDateSchema);
  const out = renderView(node, 70, 0, 0).join("\n");
  // Falls back to table — shows the grid lines
  const topRule = out.split("\n").find((line) => line.startsWith("┌─") && line.includes("┬"));
  expect(topRule).toBeTruthy();
});
