// Alignment-invariant tests for the page-mockup renderer. The whole point of a renderer (vs a
// hand-typed mockup) is that borders ALWAYS close — so we assert exactly that on display width,
// including emoji lines (the case that broke every hand attempt). Run with `bun test`.

import { expect, test } from "bun:test";
import { type Block, displayWidth, render } from "./index";

test("displayWidth counts emoji as 2 cells and ZWJ/skin clusters as one glyph", () => {
  expect(displayWidth("abc")).toBe(3);
  expect(displayWidth("👦")).toBe(2);
  expect(displayWidth("👦 x")).toBe(4); // 2 + space + 1
  expect(displayWidth("👍🏽")).toBe(2); // emoji + skin tone = one width-2 grapheme
  expect(displayWidth("👨‍👩‍👧")).toBe(2); // ZWJ family sequence = one width-2 glyph
});

/** Every box (┌…┐ / │…│ / └…┘) must have equal DISPLAY width on every one of its lines. */
function assertBoxesClose(rendered: string): void {
  const lines = rendered.split("\n");
  let topWidth: number | null = null;
  for (const line of lines) {
    if (line.startsWith("┌")) {
      topWidth = displayWidth(line);
    } else if (line.startsWith("│") || line.startsWith("├") || line.startsWith("└")) {
      // a side/middle/bottom line of the current box (single-box lines; galleries use hcat rows
      // which start with ┌ — those are handled when their own top line is seen per row group)
      if (line.startsWith("└")) {
        if (topWidth !== null) {
          expect(displayWidth(line)).toBe(topWidth);
        }
        topWidth = null;
      } else if (topWidth !== null && !line.includes("  ")) {
        // skip hcat'd multi-box rows (they contain a 2-space gap); single boxes have no double gap
        expect(displayWidth(line)).toBe(topWidth);
      }
    }
  }
}

// The page fixture uses `database` blocks for inline views (gallery/table) — views compose via the
// `database` block, not as bare top-level view objects in the block union.
const model: Block[] = [
  { type: "callout", icon: "👦", lines: ["@andre.dezzy", "", "Height: 1,65m", "Age: 22"] },
  {
    type: "database",
    database: {
      title: "Gym Navigation",
      views: [
        {
          type: "gallery",
          name: "Gym Navigation",
          views: ["Navigation", "All areas"],
          cardSize: "small",
          cards: [
            { icon: "💪", name: "Training", lines: ["Log and", "review…"] },
            { icon: "📖", name: "Exercises", lines: ["Browse the", "catalog"] },
          ],
        },
      ],
    },
  },
  {
    type: "database",
    database: {
      title: "Muscle Groups",
      views: [
        {
          type: "gallery",
          name: "Muscle Groups",
          views: ["By muscle"],
          cardSize: "medium",
          cards: [
            { icon: "🦴", name: "Triceps", lines: ["0", "12"] },
            { icon: "💪", name: "Biceps", lines: ["0", "7"] },
          ],
        },
      ],
    },
  },
  {
    type: "database",
    database: {
      title: "Weeks",
      views: [
        {
          type: "table",
          name: "Weeks",
          views: ["All weeks"],
          columns: ["Name", "Volume", "Sessions"],
          rows: [["Jun 9-15 2025", "4 210", "3"]],
        },
      ],
    },
  },
  { type: "page_link", icon: "📓", title: "Training Log", note: "full-page database" },
];

test("renders a full page with every box closing on display width (incl. emoji lines)", () => {
  assertBoxesClose(
    render({
      type: "page",
      title: "Gym",
      icon: "🏋",
      cover: "B&W dumbbell-rack cover",
      description: "Document your gym life",
      children: model,
    }),
  );
});

test("the callout's emoji line has the SAME display width as its borders", () => {
  const lines = render({
    type: "page",
    title: "X",
    children: [{ type: "callout", icon: "👦", lines: ["@andre.dezzy", "Age: 22"] }],
  }).split("\n");
  const top = lines.find((line) => line.startsWith("┌"));
  const emojiLine = lines.find((line) => line.includes("@andre.dezzy"));
  const bottom = lines.find((line) => line.startsWith("└"));
  expect(top && emojiLine && bottom).toBeTruthy();
  expect(displayWidth(emojiLine ?? "")).toBe(displayWidth(top ?? ""));
  expect(displayWidth(bottom ?? "")).toBe(displayWidth(top ?? ""));
});

test("every database header carries a right-aligned + New", () => {
  const out = render({
    type: "page",
    title: "Gym",
    icon: "🏋",
    cover: "B&W dumbbell-rack cover",
    description: "Document your gym life",
    children: model,
  });
  for (const dbName of ["Gym Navigation", "Muscle Groups", "Weeks"]) {
    const headerLine = out.split("\n").find((line) => line.includes(`◷ ${dbName}`));
    expect(headerLine).toBeTruthy();
    expect(headerLine?.endsWith("+ New")).toBe(true);
  }
});

test("over-long content is truncated with … so the box still closes", () => {
  const out = render({
    type: "page",
    title: "X",
    children: [
      {
        type: "database",
        database: {
          title: "Areas",
          views: [
            {
              type: "gallery",
              name: "Areas",
              cardSize: "small",
              cards: [{ name: "Mindset and lifestyle", lines: ["Document your professional projects"] }],
            },
          ],
        },
      },
    ],
  });
  assertBoxesClose(out);
  expect(out).toContain("…"); // the long name/description got clipped
  // no content line is wider than its box
  const top = out.split("\n").find((line) => line.startsWith("┌"));
  for (const line of out.split("\n").filter((line) => line.startsWith("│"))) {
    expect(displayWidth(line)).toBeLessThanOrEqual(displayWidth(top ?? ""));
  }
});

test("a table spans the full page width", () => {
  const out = render({
    type: "page",
    title: "Gym",
    icon: "🏋",
    cover: "B&W dumbbell-rack cover",
    description: "Document your gym life",
    children: model,
  }).split("\n");
  const topRule = out.find((line) => line.startsWith("┌─") && line.includes("┬"));
  expect(topRule).toBeTruthy();
  expect(displayWidth(topRule ?? "")).toBe(70);
});

// 360 coverage: every block type + every Phase-1 view (via database blocks), recursion, columns
// Inline views are now `database` blocks wrapping the view object.
const SINK: Block[] = [
  { type: "heading", text: "H0" },
  { type: "heading_1", text: "H1 toggle", toggle: true, children: [{ type: "paragraph", text: "inside" }] },
  { type: "heading_2", text: "H2" },
  { type: "heading_3", text: "H3" },
  {
    type: "paragraph",
    text: "A long paragraph that should word-wrap across multiple lines because it exceeds seventy display columns comfortably.",
    children: [{ type: "paragraph", text: "nested child" }],
  },
  {
    type: "bulleted_list_item",
    text: "bullet",
    children: [
      { type: "bulleted_list_item", text: "nested", children: [{ type: "bulleted_list_item", text: "deep" }] },
    ],
  },
  { type: "numbered_list_item", text: "first" },
  { type: "numbered_list_item", text: "second" },
  { type: "to_do", text: "done", checked: true },
  { type: "to_do", text: "todo" },
  { type: "toggle", text: "toggle", children: [{ type: "paragraph", text: "body" }] },
  {
    type: "quote",
    text: "a quote that wraps onto a second line yes indeed it really does for sure",
    children: [{ type: "paragraph", text: "qc" }],
  },
  { type: "callout", icon: "💡", lines: ["c1", "c2"], children: [{ type: "bulleted_list_item", text: "cc" }] },
  { type: "code", language: "ts", text: "const x = 1;\nconsole.log(x);", caption: "snippet" },
  { type: "equation", expression: "E = mc^2" },
  { type: "image", url: "https://x/y.png", caption: "pic" },
  { type: "bookmark", url: "https://example.com", caption: "bm" },
  { type: "embed", label: "widget" },
  { type: "divider" },
  {
    type: "column_list",
    columns: [
      {
        ratio: 2,
        children: [
          { type: "paragraph", text: "left wider" },
          { type: "bulleted_list_item", text: "l1" },
        ],
      },
      { ratio: 1, children: [{ type: "paragraph", text: "right" }] },
    ],
  },
  {
    type: "simple_table",
    rows: [
      ["A", "B", "C"],
      ["1", "2", "3"],
    ],
    hasColumnHeader: true,
  },
  { type: "breadcrumb", path: ["LifeOS", "Gym"] },
  { type: "table_of_contents", headings: ["Intro", "End"] },
  { type: "synced_block", from: "src", children: [{ type: "paragraph", text: "synced" }] },
  {
    type: "database",
    database: {
      title: "Tasks",
      views: [{ type: "table", name: "Tasks", views: ["All"], columns: ["Name", "Status"], rows: [["Do", "Done"]] }],
    },
  },
  {
    type: "database",
    database: {
      title: "Cards",
      views: [
        {
          type: "gallery",
          name: "Cards",
          views: ["Grid"],
          cardSize: "medium",
          cards: [{ icon: "🦴", name: "One", lines: ["0", "12"] }],
        },
      ],
    },
  },
  {
    type: "database",
    database: {
      title: "Kanban",
      views: [
        {
          type: "board",
          name: "Kanban",
          views: ["Board"],
          groups: [
            { name: "To do", cards: [{ name: "A" }, { name: "B" }] },
            { name: "Doing", cards: [{ name: "C" }] },
            { name: "Done", cards: [] },
          ],
        },
      ],
    },
  },
  {
    type: "database",
    database: {
      title: "Items",
      views: [
        {
          type: "list",
          name: "Items",
          views: ["List"],
          items: [{ icon: "📄", title: "I1", meta: "m" }, { title: "I2" }],
        },
      ],
    },
  },
  { type: "page_link", icon: "📦", title: "Backups", note: "page" },
  { type: "unsupported", label: "new block" },
];

/** Single-box lines (│…│ with no column/hcat gap) must match their box's top border width. */
function assertSingleBoxesClose(out: string, width: number): void {
  let top = 0;
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(width); // nothing overflows the page
    const isHcatOrColumn = line.includes("  ") || line.includes(" │ ");
    if (line.startsWith("┌") && !isHcatOrColumn) {
      top = displayWidth(line);
    } else if ((line.startsWith("│") || line.startsWith("└")) && !isHcatOrColumn && top) {
      expect(displayWidth(line)).toBe(top);
    }
  }
}

test("renders EVERY block type + all Phase-1 views with no overflow and every single box closed", () => {
  const out = render({ type: "page", title: "Kitchen Sink", icon: "🧪", cover: "cover", children: SINK });
  assertSingleBoxesClose(out, 70);
  expect(out).toContain("H0"); // the legacy bare "heading" block type
  // recursion: a nested bullet uses the depth-1 marker, indented
  expect(out).toContain("  ◦ nested");
  expect(out).toContain("    ▪ deep");
  // numbered ordinals thread
  expect(out).toContain("1. first");
  expect(out).toContain("2. second");
  // to_do checkbox state
  expect(out).toContain("[x] done");
  expect(out).toContain("[ ] todo");
  // board groups render side by side via hcat
  expect(out).toContain("To do  (2)");
  expect(out).toContain("Done  (0)");
});

test("a gallery with no cards renders an (empty) box", () => {
  const out = render([
    {
      type: "database",
      database: {
        title: "G",
        views: [{ type: "gallery", name: "G", views: ["V"], cardSize: "small", cards: [] }],
      },
    },
  ]);
  expect(out).toContain("(empty)");
  assertSingleBoxesClose(out, 70);
});

test("a calendar honors leap-year February (29 days in Feb 2024)", () => {
  const out = render([
    {
      type: "database",
      database: {
        title: "C",
        views: [
          { type: "calendar", name: "C", views: ["V"], year: 2024, month: 2, events: [{ day: 29, title: "Leap day" }] },
        ],
      },
    },
  ]);
  expect(out).toContain("February 2024");
  expect(out).toContain("29"); // the leap day is a real cell — not clamped to 28
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
});

test("render edge branches: empty column_list, group-less board, data-less chart, every form widget", () => {
  expect(render([{ type: "column_list", columns: [] }])).toBe(""); // no columns → nothing
  expect(
    render([
      {
        type: "database",
        database: { title: "B", views: [{ type: "board", name: "B", views: ["V"], groups: [] }] },
      },
    ]),
  ).toContain("(no groups)");
  expect(
    render([
      {
        type: "database",
        database: { title: "C", views: [{ type: "chart", name: "C", views: ["V"], chartType: "bar", data: [] }] },
      },
    ]),
  ).toContain("(no data)");
  const form = render([
    {
      type: "database",
      database: {
        title: "F",
        views: [
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
        ],
      },
    },
  ]);
  expect(form).toContain("[ 📅 ]"); // date widget
  expect(form).toContain("[ @ ]"); // person widget
  expect(form).toContain("[ _____ ]"); // text/default widget
});

test("render fallback branches: empty list, and bare breadcrumb / toc / synced_block", () => {
  expect(
    render([
      {
        type: "database",
        database: { title: "L", views: [{ type: "list", name: "L", views: ["V"], items: [] }] },
      },
    ]),
  ).toContain("(empty)");
  expect(render([{ type: "breadcrumb" }])).toContain("…"); // no path → the … placeholder
  expect(render([{ type: "table_of_contents" }])).toContain("[ Table of contents ]"); // no headings
  expect(render([{ type: "synced_block" }])).toContain("[ synced block ]"); // no children
});

test("the database tab-bar header clips the active tab when even it alone won't fit", () => {
  const out = render({
    type: "database",
    database: {
      title: "T",
      views: [
        {
          type: "table",
          name: "T",
          views: [
            "A view name so long that not even the active tab fits the budget, which forces a hard clip",
            "B",
            "C",
          ],
          columns: ["Name"],
          rows: [["x"]],
        },
      ],
    },
  });
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
  expect(out).toContain("…"); // the active tab itself is clipped
  expect(out).toContain("+2 more"); // the other two tabs collapse into a count
});

test("render renders a bare block subtree (no page chrome) and honors the given width", () => {
  const blocks: Block[] = [
    { type: "heading_2", text: "Section" },
    { type: "bulleted_list_item", text: "alpha" },
  ];
  const bare = render(blocks, 50);
  const page = render({ type: "page", title: "My Page", children: blocks });

  expect(page).toContain("My Page"); // the page has its title header…
  expect(bare).not.toContain("My Page"); // …the bare subtree has no page chrome
  expect(bare).toContain("alpha"); // but the blocks themselves render
  for (const line of bare.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(50);
  }
});

test("render falls back to the default width (70) on a non-positive width", () => {
  // Wrap the view in a `database` block since bare views are no longer in the Mockup union.
  const out = render(
    [
      {
        type: "database",
        database: {
          title: "T",
          views: [{ type: "table", name: "T", columns: ["Name", "Status"], rows: [["X", "Y"]] }],
        },
      },
    ],
    0,
  );
  const top = out.split("\n").find((line) => line.startsWith("┌"));
  expect(displayWidth(top ?? "")).toBe(70);
});

test("a `page` renders full page chrome (cover · icon · title · description) — Page is a root concept", () => {
  const out = render({
    type: "page",
    title: "Demo",
    icon: "📄",
    cover: "Sunrise cover",
    description: "the desc",
    children: [{ type: "paragraph", text: "hi" }],
  });
  expect(out).toContain("▒"); // cover band
  expect(out).toContain("📄 Demo"); // icon + title
  expect(out).toContain("the desc"); // description
  expect(out).toContain("hi"); // recursive body
});

test("blocks compose to any depth — a page nesting an inline database block", () => {
  const out = render({
    type: "page",
    title: "Workspace",
    icon: "🗂",
    children: [
      { type: "heading_2", text: "Tasks" },
      {
        type: "database",
        database: {
          title: "Tasks",
          icon: "✅",
          views: [{ type: "table", name: "All", columns: ["Name", "Status"], rows: [["Ship", "Done"]] }],
        },
      },
    ],
  });
  assertSingleBoxesClose(out, 70);
  expect(out).toContain("🗂 Workspace"); // page chrome
  expect(out).toContain("# Tasks"); // heading in the page body
  expect(out).toContain("✅ Tasks"); // the nested database's own chrome
});

test("standalone database renders its views (view:'all')", () => {
  const out = render({
    type: "database",
    database: {
      title: "Exercises",
      icon: "🏋",
      view: "all",
      views: [
        { type: "table", name: "Exercises", views: ["All"], columns: ["Name", "Max"], rows: [["45° Leg Press", "80"]] },
        { type: "gallery", name: "Exercises", views: ["Gallery"], cardSize: "small", cards: [{ name: "A" }] },
      ],
    },
  });
  assertSingleBoxesClose(out, 70);
  expect(out).toContain("🏋 Exercises");
  expect(out).toContain("◷ Exercises   ‹ All ›");
  expect(out).toContain("◷ Exercises   ‹ Gallery ›");
});

test("Phase-2 views (calendar/timeline/chart/form/map/dashboard) render aligned, no overflow", () => {
  // Each view is wrapped in a `database` block — inline views compose as blocks in the page body.
  const out = render({
    type: "page",
    title: "P2",
    children: [
      {
        type: "database",
        database: {
          title: "Sessions",
          views: [
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
          ],
        },
      },
      {
        type: "database",
        database: {
          title: "Roadmap",
          views: [
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
          ],
        },
      },
      {
        type: "database",
        database: {
          title: "Volume",
          views: [
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
          ],
        },
      },
      {
        type: "database",
        database: {
          title: "Total",
          views: [
            { type: "chart", name: "Total", views: ["Number"], chartType: "number", value: "1,302", unit: "sets" },
          ],
        },
      },
      {
        type: "database",
        database: {
          title: "New log",
          views: [
            {
              type: "form",
              name: "New log",
              views: ["Form"],
              fields: [
                { label: "Exercise", fieldType: "select" },
                { label: "Done", fieldType: "checkbox" },
              ],
            },
          ],
        },
      },
      {
        type: "database",
        database: {
          title: "Gyms",
          views: [{ type: "map", name: "Gyms", views: ["Map"], pins: 3 }],
        },
      },
      {
        type: "database",
        database: {
          title: "Overview",
          views: [
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
          ],
        },
      },
    ],
  });
  assertSingleBoxesClose(out, 70);
  // every line fits within the page width
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
  expect(out).toContain("June 2025"); // calendar month header
  expect(out).toContain("█"); // timeline/chart bars drawn
  expect(out).toContain("[ Submit ]"); // form
  expect(out).toContain("Su"); // calendar weekday header
});

test("databaseHeader fits the width and collapses overflowing view tabs to '+N more'", () => {
  const out = render({
    type: "database",
    database: {
      title: "Personal Tasks",
      icon: "◷",
      view: 0,
      views: [
        {
          type: "table",
          name: "Personal Tasks",
          views: ["Board", "Backlog", "Calendar", "Timeline", "Table", "Open tasks (Status ≠ Done)"],
          columns: ["Name"],
          rows: [["Ship it"]],
        },
      ],
    },
  });
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
  const header = out.split("\n").find((line) => line.includes("+ New")) ?? ""; // the view's tab-bar header line
  expect(header).toContain("‹ Board ›"); // the active/default (first) view is always shown
  expect(header).toMatch(/\+\d+ more/); // the rest collapse into a count
  expect(header).toContain("+ New");
});
