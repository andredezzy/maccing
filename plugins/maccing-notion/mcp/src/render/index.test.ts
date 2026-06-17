// Alignment-invariant tests for the page-mockup renderer. The whole point of a renderer (vs a
// hand-typed mockup) is that borders ALWAYS close — so we assert exactly that on display width,
// including emoji lines (the case that broke every hand attempt). Run with `bun test`.

import { expect, test } from "bun:test";
import type { BlockObject } from "../notion/blocks/block";
import type { DataSourceObject } from "../notion/data-source";
import type { PageObject } from "../notion/page";
import type { DatabaseRender, PageRender } from "../notion/render-bundles";
import type { ViewObject } from "../notion/view";
import { type Block, displayWidth, render } from "./index";

// Helper: create a minimal rich-text array from a plain string.
function rt(text: string) {
  return [{ type: "text" as const, plain_text: text, text: { content: text } }];
}

// Helper: create a minimal PageRender from title, blocks, and optional chrome.
function mkPage(title: string, blocks: Block[], icon?: string, cover?: boolean): PageRender {
  const page: PageObject = {
    properties: { Name: { type: "title", title: rt(title) } },
    ...(icon ? { icon: { type: "emoji", emoji: icon } } : {}),
    ...(cover ? { cover: { type: "external", external: { url: "https://example.com" } } } : {}),
  };
  return { page, blocks: blocks as BlockObject[] };
}

// Helper: create a minimal PageObject row (a database "row").
function mkRow(titleColumn: string, title: string, extra?: Record<string, string>): PageObject {
  const props: Record<string, unknown> = {
    [titleColumn]: { type: "title", title: [{ plain_text: title }] },
  };
  for (const [name, value] of Object.entries(extra ?? {})) {
    props[name] = { type: "rich_text", rich_text: [{ plain_text: value }] };
  }
  return { properties: props as PageObject["properties"] };
}

// Helper: create a minimal DataSourceObject.
function mkSchema(columns: Array<{ name: string; type?: string; id?: string }>): DataSourceObject {
  const properties: Record<string, unknown> = {};
  for (const column of columns) {
    const type = column.type ?? "rich_text";
    properties[column.name] = { id: column.id ?? column.name, type, [type]: {} };
  }
  return { properties: properties as DataSourceObject["properties"] };
}

// Helper: create a minimal DatabaseRender with a table view.
function mkTableDb(title: string, columns: string[], data: string[][], icon?: string): DatabaseRender {
  const schema = mkSchema([
    { name: columns[0], type: "title", id: columns[0] },
    ...columns.slice(1).map((name) => ({ name, type: "rich_text", id: name })),
  ]);
  const rows: PageObject[] = data.map((row) =>
    mkRow(columns[0], row[0] ?? "", Object.fromEntries(columns.slice(1).map((col, i) => [col, row[i + 1] ?? ""]))),
  );
  const view: ViewObject = {
    name: title,
    type: "table",
    configuration: { properties: columns.map((name) => ({ property_id: name })) },
  };
  return {
    database: {
      title: [{ plain_text: title }],
      ...(icon ? { icon: { type: "emoji", emoji: icon } } : {}),
    } as DatabaseRender["database"],
    dataSource: schema,
    views: [view],
    rows,
  };
}

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
      if (line.startsWith("└")) {
        if (topWidth !== null) {
          expect(displayWidth(line)).toBe(topWidth);
        }
        topWidth = null;
      } else if (topWidth !== null && !line.includes("  ")) {
        expect(displayWidth(line)).toBe(topWidth);
      }
    }
  }
}

// A page fixture that uses only non-database blocks for box-close invariants.
const pageBlocks: Block[] = [
  {
    type: "callout",
    callout: {
      rich_text: rt("@andre.dezzy"),
      icon: { type: "emoji", emoji: "👦" },
    },
  },
  {
    type: "child_page",
    child_page: { title: "Training Log" },
  },
];

test("renders a full page with every box closing on display width (incl. emoji lines)", () => {
  assertBoxesClose(render(mkPage("Gym", pageBlocks, "🏋", true)));
});

test("the callout's emoji line has the SAME display width as its borders", () => {
  const lines = render(
    mkPage("X", [
      {
        type: "callout",
        callout: { rich_text: rt("@andre.dezzy"), icon: { type: "emoji", emoji: "👦" } },
      },
    ]),
  ).split("\n");
  const top = lines.find((line) => line.startsWith("┌"));
  const emojiLine = lines.find((line) => line.includes("@andre.dezzy"));
  const bottom = lines.find((line) => line.startsWith("└"));
  expect(top && emojiLine && bottom).toBeTruthy();
  expect(displayWidth(emojiLine ?? "")).toBe(displayWidth(top ?? ""));
  expect(displayWidth(bottom ?? "")).toBe(displayWidth(top ?? ""));
});

test("DatabaseRender header is PROSE (bold title + bold selected view); the grid sits in a code fence", () => {
  const bundle = mkTableDb("Sessions", ["Name", "Volume"], [["Push", "4 210"]]);
  const out = render(bundle);
  const lines = out.split("\n");
  // Title is markdown-bold PROSE (rendered OUTSIDE the fence → real bold in chat), not box-art.
  const titleLine = lines.find((line) => line.startsWith("◷ "));
  expect(titleLine).toBe("◷ **Sessions**");
  // The Views line is prose too; the selected view is wrapped in ** ** (real bold).
  const viewsLine = lines.find((line) => line.startsWith("Views: ")) ?? "";
  expect(viewsLine).toContain("**Sessions**"); // the only/selected view, in REAL markdown bold
  expect(viewsLine).not.toContain("+ New"); // no + New affordance — dropped
  // The box-art grid is fenced so it renders monospace (bold is impossible inside a fence).
  expect(lines).toContain("```");
});

test("over-long content is truncated with … so the box still closes", () => {
  const schema = mkSchema([
    { name: "Name", type: "title", id: "name" },
    { name: "Desc", type: "rich_text", id: "desc" },
  ]);
  const rows: PageObject[] = [mkRow("Name", "Mindset and lifestyle", { Desc: "Document your professional projects" })];
  const view: ViewObject = { name: "Areas", type: "gallery" };
  const bundle: DatabaseRender = {
    database: { title: [{ plain_text: "Areas" }] } as DatabaseRender["database"],
    dataSource: schema,
    views: [view],
    rows,
  };
  const out = render(bundle);
  assertBoxesClose(out);
  expect(out).toContain("…"); // the long name/description got clipped
  const top = out.split("\n").find((line) => line.startsWith("┌"));
  for (const line of out.split("\n").filter((line) => line.startsWith("│"))) {
    expect(displayWidth(line)).toBeLessThanOrEqual(displayWidth(top ?? ""));
  }
});

test("a table spans the full page width (DatabaseRender)", () => {
  const bundle = mkTableDb("Gym", ["Name", "Volume", "Sessions"], [["Jun 9-15 2025", "4 210", "3"]]);
  const out = render(bundle).split("\n");
  const topRule = out.find((line) => line.startsWith("┌─") && line.includes("┬"));
  expect(topRule).toBeTruthy();
  expect(displayWidth(topRule ?? "")).toBe(70);
});

// 360 coverage: every block type (no database blocks), recursion, columns.
const SINK: Block[] = [
  {
    type: "heading_1",
    heading_1: {
      rich_text: rt("H1 toggle"),
      is_toggleable: true,
      children: [{ type: "paragraph", paragraph: { rich_text: rt("inside") } }],
    },
  },
  { type: "heading_2", heading_2: { rich_text: rt("H2") } },
  { type: "heading_3", heading_3: { rich_text: rt("H3") } },
  { type: "heading_4", heading_4: { rich_text: rt("H4") } },
  { type: "child_database", child_database: { title: "Linked DB" } },
  { type: "link_to_page", link_to_page: { type: "page_id", page_id: "abc" } },
  {
    type: "paragraph",
    paragraph: {
      rich_text: rt(
        "A long paragraph that should word-wrap across multiple lines because it exceeds seventy display columns comfortably.",
      ),
      children: [{ type: "paragraph", paragraph: { rich_text: rt("nested child") } }],
    },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: rt("bullet"),
      children: [
        {
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: rt("nested"),
            children: [{ type: "bulleted_list_item", bulleted_list_item: { rich_text: rt("deep") } }],
          },
        },
      ],
    },
  },
  { type: "numbered_list_item", numbered_list_item: { rich_text: rt("first") } },
  { type: "numbered_list_item", numbered_list_item: { rich_text: rt("second") } },
  { type: "to_do", to_do: { rich_text: rt("done"), checked: true } },
  { type: "to_do", to_do: { rich_text: rt("todo"), checked: false } },
  {
    type: "toggle",
    toggle: {
      rich_text: rt("toggle"),
      children: [{ type: "paragraph", paragraph: { rich_text: rt("body") } }],
    },
  },
  {
    type: "quote",
    quote: {
      rich_text: rt("a quote that wraps onto a second line yes indeed it really does for sure"),
      children: [{ type: "paragraph", paragraph: { rich_text: rt("qc") } }],
    },
  },
  {
    type: "callout",
    callout: {
      rich_text: rt("c1"),
      icon: { type: "emoji", emoji: "💡" },
      children: [{ type: "bulleted_list_item", bulleted_list_item: { rich_text: rt("cc") } }],
    },
  },
  { type: "code", code: { rich_text: rt("const x = 1;\nconsole.log(x);"), caption: rt("snippet"), language: "ts" } },
  { type: "equation", equation: { expression: "E = mc^2" } },
  { type: "image", image: { type: "external", external: { url: "https://x/y.png" }, caption: rt("pic") } } as {
    type: "image";
    [k: string]: unknown;
  },
  { type: "bookmark", bookmark: { url: "https://example.com", caption: rt("bm") } },
  { type: "embed", embed: { url: "widget" } },
  { type: "divider", divider: {} },
  {
    type: "column_list",
    column_list: {
      children: [
        {
          type: "column",
          column: {
            width_ratio: 2,
            children: [
              { type: "paragraph", paragraph: { rich_text: rt("left wider") } },
              { type: "bulleted_list_item", bulleted_list_item: { rich_text: rt("l1") } },
            ],
          },
        },
        {
          type: "column",
          column: {
            width_ratio: 1,
            children: [{ type: "paragraph", paragraph: { rich_text: rt("right") } }],
          },
        },
      ],
    },
  },
  {
    type: "table",
    table: {
      table_width: 3,
      has_column_header: true,
      children: [
        { type: "table_row", table_row: { cells: [rt("A"), rt("B"), rt("C")] } },
        { type: "table_row", table_row: { cells: [rt("1"), rt("2"), rt("3")] } },
      ],
    },
  },
  { type: "breadcrumb", breadcrumb: {} },
  { type: "table_of_contents", table_of_contents: {} },
  {
    type: "synced_block",
    synced_block: {
      synced_from: { type: "block_id", block_id: "src" },
      children: [{ type: "paragraph", paragraph: { rich_text: rt("synced") } }],
    },
  },
  { type: "child_page", child_page: { title: "Backups" } },
  { type: "unsupported" },
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

test("renders EVERY block type with no overflow and every single box closed", () => {
  const out = render(mkPage("Kitchen Sink", SINK, "🧪", true));
  assertSingleBoxesClose(out, 70);
  // recursion: a nested bullet uses the depth-1 marker, indented
  expect(out).toContain("  ◦ nested");
  expect(out).toContain("    ▪ deep");
  // numbered ordinals thread
  expect(out).toContain("1. first");
  expect(out).toContain("2. second");
  // to_do checkbox state
  expect(out).toContain("[x] done");
  expect(out).toContain("[ ] todo");
});

test("DatabaseRender gallery with no rows renders an (empty) box", () => {
  const schema = mkSchema([{ name: "Name", type: "title", id: "name" }]);
  const bundle: DatabaseRender = {
    database: { title: [{ plain_text: "G" }] } as DatabaseRender["database"],
    dataSource: schema,
    views: [{ name: "G", type: "gallery" }],
    rows: [],
  };
  const out = render(bundle);
  expect(out).toContain("(empty)");
  assertSingleBoxesClose(out, 70);
});

test("DatabaseRender calendar honors leap-year February (29 days in Feb 2024)", () => {
  const schema = mkSchema([
    { name: "Name", type: "title", id: "name" },
    { name: "Date", type: "date", id: "date_id" },
  ]);
  const rows: PageObject[] = [
    {
      properties: {
        Name: { type: "title", title: [{ plain_text: "Leap day" }] },
        Date: { type: "date", date: { start: "2024-02-29" } },
      } as unknown as PageObject["properties"],
    },
  ];
  const view: ViewObject = { name: "C", type: "calendar", configuration: { date_property_id: "date_id" } };
  const bundle: DatabaseRender = {
    database: { title: [{ plain_text: "C" }] } as DatabaseRender["database"],
    dataSource: schema,
    views: [view],
    rows,
  };
  const out = render(bundle);
  expect(out).toContain("February 2024");
  expect(out).toContain("29"); // the leap day is a real cell
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
});

test("render edge branches: empty column_list, empty board, empty list", () => {
  expect(render([{ type: "column_list", column_list: { children: [] } }] as Block[])).toBe(""); // no columns → nothing

  const boardSchema = mkSchema([{ name: "Name", type: "title", id: "name" }]);
  const emptyBoard: DatabaseRender = {
    database: { title: [{ plain_text: "B" }] } as DatabaseRender["database"],
    dataSource: boardSchema,
    views: [{ name: "B", type: "board" }],
    rows: [],
  };
  expect(render(emptyBoard)).toContain("(no groups)");

  const emptyList: DatabaseRender = {
    database: { title: [{ plain_text: "L" }] } as DatabaseRender["database"],
    dataSource: boardSchema,
    views: [{ name: "L", type: "list" }],
    rows: [],
  };
  expect(render(emptyList)).toContain("(empty)");
});

test("render fallback branches: bare breadcrumb / toc / synced_block", () => {
  expect(render([{ type: "breadcrumb", breadcrumb: {} }] as Block[])).toContain("…"); // no path → the … placeholder
  expect(render([{ type: "table_of_contents", table_of_contents: {} }] as Block[])).toContain("[ Table of contents ]");
  expect(render([{ type: "synced_block", synced_block: { synced_from: null } }] as Block[])).toContain(
    "[ synced block ]",
  );
});

test("a tab too long to fit on its own is shown in FULL (prose wraps); only the fenced grid stays within width", () => {
  const schema = mkSchema([{ name: "Name", type: "title", id: "name" }]);
  const longTabName = "A view name so long that not even the active tab fits the budget, which forces a wrap";
  const view: ViewObject = {
    name: longTabName,
    type: "table",
    configuration: { properties: [{ property_id: "name" }] },
  };
  const bundle: DatabaseRender = {
    database: { title: [{ plain_text: "T" }] } as DatabaseRender["database"],
    dataSource: schema,
    views: [view, { name: "B", type: "table" }, { name: "C", type: "table" }],
    rows: [mkRow("Name", "x")],
  };
  const out = render(bundle);
  // The prose header is NOT clipped — the over-long active tab appears in full, bold, and wraps in chat.
  expect(out).toContain(`**${longTabName}**`);
  expect(out).toContain("+2 more"); // the other two tabs still collapse into a count
  // The width invariant applies to the FENCED box-art grid, not the free-flowing prose header.
  const lines = out.split("\n");
  const open = lines.indexOf("```");
  const close = lines.lastIndexOf("```");
  for (const line of lines.slice(open + 1, close)) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
});

test("render renders a bare block subtree (no page chrome) and honors the given width", () => {
  const blocks: Block[] = [
    { type: "heading_2", heading_2: { rich_text: rt("Section") } },
    { type: "bulleted_list_item", bulleted_list_item: { rich_text: rt("alpha") } },
  ];
  const bare = render(blocks, 50);
  const page = render(mkPage("My Page", blocks));

  expect(page).toContain("My Page"); // the page has its title header…
  expect(bare).not.toContain("My Page"); // …the bare subtree has no page chrome
  expect(bare).toContain("alpha"); // but the blocks themselves render
  for (const line of bare.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(50);
  }
});

test("a page mockup is self-fencing — the box-art is wrapped in a code fence, paste-ready as-is", () => {
  const out = render(mkPage("Demo", [{ type: "paragraph", paragraph: { rich_text: rt("hi") } }], "📄"));
  expect(out.startsWith("```\n")).toBe(true); // opens with a fence
  expect(out.endsWith("\n```")).toBe(true); // closes with a fence
  expect(out).toContain("📄 Demo"); // the box-art lives inside the fence
});

test("a bare block subtree is self-fencing too", () => {
  const out = render([{ type: "paragraph", paragraph: { rich_text: rt("alpha") } }] as Block[]);
  expect(out.startsWith("```")).toBe(true);
  expect(out.trimEnd().endsWith("```")).toBe(true);
  expect(out).toContain("alpha");
});

test("a code block whose content contains ``` gets a longer outer fence so it can't break out", () => {
  const out = render([{ type: "code", code: { language: "markdown", rich_text: rt("```js\nx\n```") } }] as Block[]);
  expect(out.startsWith("````")).toBe(true); // 4+ backticks — longer than the embedded run of 3
});

test("an empty render stays empty — nothing to fence", () => {
  expect(render([{ type: "column_list", column_list: { children: [] } }] as Block[])).toBe("");
});

test("a code block labels its language with a '› ' prefix (no wrapping angle brackets)", () => {
  const out = render([{ type: "code", code: { language: "bash", rich_text: rt("echo hi") } }] as Block[]);
  expect(out).toContain("› bash"); // leading chevron + language
  expect(out).not.toContain("‹"); // the old wrapping ‹…› form is gone
});

test("render falls back to the default width (70) on a non-positive width", () => {
  const bundle = mkTableDb("T", ["Name", "Status"], [["X", "Y"]]);
  const out = render(bundle, 0);
  const top = out.split("\n").find((line) => line.startsWith("┌"));
  expect(displayWidth(top ?? "")).toBe(70);
});

test("a `page` renders full page chrome (cover · icon · title) — Page is a root concept", () => {
  const out = render(mkPage("Demo", [{ type: "paragraph", paragraph: { rich_text: rt("hi") } }], "📄", true));
  expect(out).toContain("▒"); // cover band
  expect(out).toContain("📄 Demo"); // icon + title
  expect(out).toContain("hi"); // recursive body
});

test("blocks compose to any depth — a page nesting content blocks", () => {
  const out = render(
    mkPage(
      "Workspace",
      [
        { type: "heading_2", heading_2: { rich_text: rt("Tasks") } },
        { type: "paragraph", paragraph: { rich_text: rt("Ship it") } },
      ],
      "🗂",
    ),
  );
  assertSingleBoxesClose(out, 70);
  expect(out).toContain("🗂 Workspace"); // page chrome
  expect(out).toContain("## Tasks"); // heading in the page body
});

test("DatabaseRender renders selected view (default view 0)", () => {
  const schema = mkSchema([
    { name: "Name", type: "title", id: "name" },
    { name: "Max", type: "rich_text", id: "max" },
  ]);
  const rows: PageObject[] = [mkRow("Name", "45° Leg Press", { Max: "80" })];
  const bundle: DatabaseRender = {
    database: {
      title: [{ plain_text: "Exercises" }],
      icon: { type: "emoji", emoji: "🏋" },
    } as DatabaseRender["database"],
    dataSource: schema,
    views: [
      { name: "All", type: "table", configuration: { properties: [{ property_id: "name" }, { property_id: "max" }] } },
      { name: "Gallery", type: "gallery" },
    ],
    rows,
  };
  const out = render(bundle);
  assertSingleBoxesClose(out, 70);
  expect(out).toContain("◷ **Exercises**"); // title line, bold prose
  expect(out).toContain("Views: **All**"); // the selected (default view 0) is bold on the Views line
});

test("DatabaseRender renders all views stacked when selectedView='all'", () => {
  const schema = mkSchema([
    { name: "Name", type: "title", id: "name" },
    { name: "Max", type: "rich_text", id: "max" },
  ]);
  const rows: PageObject[] = [mkRow("Name", "45° Leg Press", { Max: "80" })];
  const bundle: DatabaseRender & { viewIndex?: number } = {
    database: {
      title: [{ plain_text: "Exercises" }],
      icon: { type: "emoji", emoji: "🏋" },
    } as DatabaseRender["database"],
    dataSource: schema,
    views: [
      { name: "All", type: "table", configuration: { properties: [{ property_id: "name" }, { property_id: "max" }] } },
      { name: "Gallery", type: "gallery" },
    ],
    rows,
  };
  // renderDatabase(bundle, 70, "all") is not directly exposed — test via render with viewIndex
  const { renderDatabase } = require("./blocks/database/database");
  const out = (renderDatabase as (b: DatabaseRender, w: number, s: "all") => string[])(bundle, 70, "all").join("\n");
  assertSingleBoxesClose(out, 70);
  // Both views stacked — the ◷ title + a Views line appear once per view; each view bolds itself.
  const titleLines = out.split("\n").filter((line) => line.startsWith("◷ "));
  expect(titleLines.length).toBeGreaterThanOrEqual(2);
  const viewsLines = out.split("\n").filter((line) => line.startsWith("Views: "));
  expect(viewsLines[0]).toContain("**All**"); // first stacked view: All selected → real bold
  expect(viewsLines[0]).toContain("Gallery"); // sibling tab listed (plain)
  expect(viewsLines[1]).toContain("**Gallery**"); // second stacked view: Gallery selected → real bold
});

test("Phase-2 DatabaseRender views (calendar/timeline/chart/form/map/dashboard) render aligned, no overflow", () => {
  const schema = mkSchema([
    { name: "Name", type: "title", id: "name" },
    { name: "Date", type: "date", id: "date_id" },
    { name: "Status", type: "status", id: "status_id" },
  ]);
  (schema.properties.Status as Record<string, unknown>).status = {
    options: [{ name: "Done" }, { name: "To do" }],
  };
  const rows: PageObject[] = [
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

  const views: ViewObject[] = [
    { name: "Calendar", type: "calendar", configuration: { date_property_id: "date_id" } },
    { name: "Timeline", type: "timeline", configuration: { date_property_id: "date_id" } },
    { name: "Chart", type: "chart", configuration: { group_by: { property_id: "status_id" } } },
    { name: "Form", type: "form" },
    { name: "Map", type: "map" },
    { name: "Dashboard", type: "dashboard" },
  ];

  const results = views.map((view) => {
    const bundle: DatabaseRender = {
      database: { title: [{ plain_text: view.name }] } as DatabaseRender["database"],
      dataSource: schema,
      views: [view],
      rows,
    };
    return render(bundle);
  });

  for (const out of results) {
    assertSingleBoxesClose(out, 70);
    for (const line of out.split("\n")) {
      expect(displayWidth(line)).toBeLessThanOrEqual(70);
    }
  }

  expect(results[0]).toContain("June 2025"); // calendar month header
  expect(results[1]).toContain("█"); // timeline bars
  expect(results[2]).toContain("█"); // chart bars
  expect(results[3]).toContain("[ Submit ]"); // form
  expect(results[0]).toContain("Su"); // calendar weekday header
});

test("the Views line bolds the selected view and collapses overflowing tabs to '+N more'", () => {
  const schema = mkSchema([{ name: "Name", type: "title", id: "name" }]);
  const tabNames = ["Board", "Backlog", "Calendar", "Timeline", "Table", "Open tasks (Status ≠ Done)"];
  const bundle: DatabaseRender = {
    database: { title: [{ plain_text: "Personal Tasks" }] } as DatabaseRender["database"],
    dataSource: schema,
    views: tabNames.map((name) => ({ name, type: "table" as const })),
    rows: [mkRow("Name", "Ship it")],
  };
  const out = render(bundle);
  // The raw header includes the ** markers; the collapse budget reserves room for them so even the raw
  // string stays within the canvas width (the markers render to nothing, so on screen it's narrower still).
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
  const viewsLine = out.split("\n").find((line) => line.startsWith("Views: ")) ?? "";
  expect(viewsLine).toContain("**Board**"); // the selected/default (first) view in REAL bold, always shown
  expect(viewsLine).toMatch(/\+\d+ more/); // the rest collapse into a count
  expect(viewsLine).not.toContain("+ New"); // no + New affordance — dropped
});
