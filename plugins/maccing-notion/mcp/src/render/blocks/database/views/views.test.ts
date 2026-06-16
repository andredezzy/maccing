// View-engine tests — standalone rendering of every DatabaseView type. These were skipped in
// index.test.ts while views still dispatched through the block registry; now they are tested
// directly via renderView (and asserting displayWidth from the text module).

import "../../.."; // registers all block renderers (and transitively the view renderers)
import { expect, test } from "bun:test";
import { displayWidth } from "../../../text";
import { renderView } from "./engine";

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

test("a gallery view with no cards renders an (empty) box", () => {
  const out = renderView({ type: "gallery", name: "G", views: ["V"], cardSize: "small", cards: [] }, 70, 0, 0).join(
    "\n",
  );
  expect(out).toContain("(empty)");
  assertSingleBoxesClose(out, 70);
});

test("over-long gallery content is truncated with … so the box still closes", () => {
  const out = renderView(
    {
      type: "gallery",
      name: "Areas",
      cardSize: "small",
      cards: [{ name: "Mindset and lifestyle", lines: ["Document your professional projects"] }],
    },
    70,
    0,
    0,
  ).join("\n");
  assertSingleBoxesClose(out, 70);
  expect(out).toContain("…"); // the long name/description got clipped
  // no content line is wider than its box
  const topLine = out.split("\n").find((line) => line.startsWith("┌"));
  for (const line of out.split("\n").filter((line) => line.startsWith("│"))) {
    expect(displayWidth(line)).toBeLessThanOrEqual(displayWidth(topLine ?? ""));
  }
});

test("a calendar view honors leap-year February (29 days in Feb 2024)", () => {
  const out = renderView(
    { type: "calendar", name: "C", views: ["V"], year: 2024, month: 2, events: [{ day: 29, title: "Leap day" }] },
    70,
    0,
    0,
  ).join("\n");
  expect(out).toContain("February 2024");
  expect(out).toContain("29"); // the leap day is a real cell — not clamped to 28
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
});

test("render edge branches: group-less board, data-less chart, every form widget", () => {
  const board = renderView({ type: "board", name: "B", views: ["V"], groups: [] }, 70, 0, 0).join("\n");
  expect(board).toContain("(no groups)");

  const chart = renderView({ type: "chart", name: "C", views: ["V"], chartType: "bar", data: [] }, 70, 0, 0).join("\n");
  expect(chart).toContain("(no data)");

  const form = renderView(
    {
      type: "form",
      name: "F",
      views: ["V"],
      fields: [
        { label: "When", fieldType: "date" },
        { label: "Who", fieldType: "person" },
        { label: "Free", fieldType: "text" },
      ],
    },
    70,
    0,
    0,
  ).join("\n");
  expect(form).toContain("[ 📅 ]"); // date widget
  expect(form).toContain("[ @ ]"); // person widget
  expect(form).toContain("[ _____ ]"); // text/default widget
});

test("render fallback branch: empty list view", () => {
  const out = renderView({ type: "list", name: "L", views: ["V"], items: [] }, 70, 0, 0).join("\n");
  expect(out).toContain("(empty)");
});

test("a table view falls back to the default width (70) when rendered at width 70", () => {
  // Verifies the table spans the full width (the previous test used render(…, 0) to exercise the
  // default-width fallback in render(); here we pass width=70 directly to renderView).
  const out = renderView(
    { type: "table", name: "T", views: ["All"], columns: ["Name", "Status"], rows: [["X", "Y"]] },
    70,
    0,
    0,
  ).join("\n");
  const topRule = out.split("\n").find((line) => line.startsWith("┌─") && line.includes("┬"));
  expect(topRule).toBeTruthy();
  expect(displayWidth(topRule ?? "")).toBe(70);
});

test("feed view renders a single-column stack of post cards with the database header", () => {
  const out = renderView(
    {
      type: "feed",
      name: "Announcements",
      views: ["Feed"],
      posts: [
        { icon: "📣", title: "Launch", preview: "We shipped it", meta: "2d ago" },
        { title: "Hiring", preview: "Two roles open" },
      ],
    },
    70,
    0,
    0,
  ).join("\n");
  expect(out).toContain("◷ Announcements"); // view tab-bar header
  expect(out).toContain("📣 Launch");
  expect(out).toContain("We shipped it");
  expect(out).toContain("2d ago");
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
});

test("Phase-2 views (calendar/timeline/chart/form/map/dashboard) render aligned, no overflow", () => {
  const views = [
    renderView(
      {
        type: "calendar",
        name: "Sessions",
        views: ["Calendar"],
        year: 2025,
        month: 6,
        events: [
          { day: 9, title: "Push" },
          { day: 14, title: "Legs" },
        ],
      },
      70,
      0,
      0,
    ),
    renderView(
      {
        type: "timeline",
        name: "Roadmap",
        views: ["Timeline"],
        axis: "Jun — Aug",
        rows: [
          { label: "Cut", start: 0, end: 0.4 },
          { label: "Bulk", start: 0.6, end: 1 },
        ],
      },
      70,
      0,
      0,
    ),
    renderView(
      {
        type: "chart",
        name: "Volume",
        views: ["Chart"],
        chartType: "bar",
        data: [
          { label: "Legs", value: 14 },
          { label: "Chest", value: 6 },
        ],
      },
      70,
      0,
      0,
    ),
    renderView(
      { type: "chart", name: "Total", views: ["Number"], chartType: "number", value: "1,302", unit: "sets" },
      70,
      0,
      0,
    ),
    renderView(
      {
        type: "form",
        name: "New log",
        views: ["Form"],
        fields: [
          { label: "Exercise", fieldType: "select" },
          { label: "Done", fieldType: "checkbox" },
        ],
      },
      70,
      0,
      0,
    ),
    renderView({ type: "map", name: "Gyms", views: ["Map"], pins: 3 }, 70, 0, 0),
    renderView(
      {
        type: "dashboard",
        name: "Overview",
        views: ["Dashboard"],
        widgets: [
          {
            title: "Volume",
            view: { type: "chart", name: "V", chartType: "bar", data: [{ label: "Legs", value: 14 }] },
          },
        ],
      },
      70,
      0,
      0,
    ),
  ];

  const out = views.map((lines) => lines.join("\n")).join("\n\n");
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
  expect(out).toContain("June 2025"); // calendar month header
  expect(out).toContain("█"); // timeline/chart bars drawn
  expect(out).toContain("[ Submit ]"); // form
  expect(out).toContain("Su"); // calendar weekday header
});
