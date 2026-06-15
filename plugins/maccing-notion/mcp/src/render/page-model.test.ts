// The live page-mapper is pure → tested on a synthetic Notion block tree, then rendered to prove the
// produced model is renderable and aligned. Run with `bun test`.

import { expect, test } from "bun:test";
import { iconGlyph } from "../readers/object";
import { displayWidth, renderPage } from "./index";
import { pageToModel, type RawBlock } from "./page-model";

const rt = (s: string) => [{ plain_text: s }];

test("pageToModel: a page with no cover yields no cover band", () => {
  const model = pageToModel({ properties: { Name: { type: "title", title: rt("T") } } }, []);
  expect(model.cover).toBeUndefined();
  expect(renderPage(model)).not.toContain("▒"); // header draws no ▒ band without a cover
});

test("a file_upload media block resolves its url to (uploaded)", () => {
  const model = pageToModel({}, [{ type: "image", image: { type: "file_upload" } } as RawBlock]);
  const block = model.blocks[0];
  expect(block.type).toBe("image");
  if (block.type === "image") {
    expect(block.url).toBe("(uploaded)"); // no external/file url, but a file_upload → the (uploaded) sentinel
  }
});

test("mapBlock maps every raw Notion block type to its MockupBlock type", () => {
  const rt = (s: string) => ({ rich_text: [{ plain_text: s }] });
  const raw: RawBlock[] = [
    { type: "paragraph", paragraph: rt("p") },
    {
      type: "heading_1",
      heading_1: { ...rt("h1"), is_toggleable: true },
      children: [{ type: "paragraph", paragraph: rt("in") }],
    },
    { type: "heading_2", heading_2: rt("h2") },
    { type: "heading_3", heading_3: rt("h3") },
    { type: "bulleted_list_item", bulleted_list_item: rt("b") },
    { type: "numbered_list_item", numbered_list_item: rt("n") },
    { type: "to_do", to_do: { ...rt("t"), checked: true } },
    { type: "toggle", toggle: rt("tog") },
    { type: "quote", quote: rt("q") },
    { type: "callout", callout: { ...rt("c"), icon: { type: "emoji", emoji: "💡" } } },
    { type: "divider", divider: {} },
    { type: "code", code: { ...rt("x"), language: "ts", caption: [{ plain_text: "cap" }] } },
    { type: "equation", equation: { expression: "E=mc^2" } },
    {
      type: "image",
      image: { type: "external", external: { url: "https://x/i.png" }, caption: [{ plain_text: "pic" }] },
    },
    { type: "bookmark", bookmark: { url: "https://b", caption: [{ plain_text: "bm" }] } },
    { type: "link_preview", link_preview: { url: "https://lp" } },
    { type: "embed", embed: { url: "https://e" } },
    {
      type: "column_list",
      column_list: {},
      children: [{ type: "column", column: {}, children: [{ type: "paragraph", paragraph: rt("col") }] }],
    },
    {
      type: "table",
      table: { has_column_header: true },
      children: [{ type: "table_row", table_row: { cells: [[{ plain_text: "A" }]] } }],
    },
    { type: "breadcrumb", breadcrumb: {} },
    { type: "table_of_contents", table_of_contents: {} },
    { type: "synced_block", synced_block: {} },
    { type: "child_page", child_page: { title: "Sub" } },
    { type: "child_database", child_database: { title: "DB" } },
    { type: "future_unknown_block", future_unknown_block: {} },
  ] as RawBlock[];
  expect(pageToModel({}, raw).blocks.map((block) => block.type)).toEqual([
    "paragraph",
    "heading_1",
    "heading_2",
    "heading_3",
    "bulleted_list_item",
    "numbered_list_item",
    "to_do",
    "toggle",
    "quote",
    "callout",
    "divider",
    "code",
    "equation",
    "image",
    "bookmark",
    "link_preview",
    "embed",
    "column_list",
    "simple_table",
    "breadcrumb",
    "table_of_contents",
    "synced_block",
    "page_link",
    "page_link",
    "unsupported",
  ]);
});

test("a link_to_page block maps to a page_link (linked page)", () => {
  const model = pageToModel({}, [{ type: "link_to_page", link_to_page: {} } as RawBlock]);
  expect(model.blocks[0]).toEqual({ type: "page_link", title: "(linked page)", note: "link" });
});

test("iconGlyph maps emoji, named icon, and image icon", () => {
  expect(iconGlyph({ type: "emoji", emoji: "🏋" })).toBe("🏋");
  expect(iconGlyph({ type: "icon", icon: { name: "cash" } })).toBe("cash");
  expect(iconGlyph({ type: "external" })).toBe("🖼");
  expect(iconGlyph(null)).toBeUndefined();
});

const TREE: RawBlock[] = [
  { type: "heading_1", heading_1: { rich_text: rt("Title"), is_toggleable: false } },
  { type: "paragraph", paragraph: { rich_text: rt("Hello world") } },
  {
    type: "bulleted_list_item",
    has_children: true,
    bulleted_list_item: { rich_text: rt("parent") },
    children: [{ type: "bulleted_list_item", bulleted_list_item: { rich_text: rt("child") } }],
  },
  { type: "to_do", to_do: { rich_text: rt("done"), checked: true } },
  { type: "callout", callout: { rich_text: rt("note"), icon: { type: "emoji", emoji: "💡" } } },
  { type: "code", code: { rich_text: rt("const x = 1;"), language: "ts", caption: rt("cap") } },
  { type: "divider", divider: {} },
  {
    type: "column_list",
    has_children: true,
    column_list: {},
    children: [
      {
        type: "column",
        has_children: true,
        column: {},
        children: [{ type: "paragraph", paragraph: { rich_text: rt("L") } }],
      },
      {
        type: "column",
        has_children: true,
        column: {},
        children: [{ type: "paragraph", paragraph: { rich_text: rt("R") } }],
      },
    ],
  },
  {
    type: "table",
    has_children: true,
    table: { has_column_header: true, table_width: 2 },
    children: [
      { type: "table_row", table_row: { cells: [rt("A"), rt("B")] } },
      { type: "table_row", table_row: { cells: [rt("1"), rt("2")] } },
    ],
  },
  { type: "child_page", child_page: { title: "Sub page" } },
  { type: "child_database", child_database: { title: "Tasks" } },
  { type: "image", image: { type: "external", external: { url: "https://x/y.png" }, caption: rt("a pic") } },
  { type: "some_future_block", some_future_block: {} },
];

const PAGE = {
  icon: { type: "emoji", emoji: "🧪" },
  cover: { type: "external" },
  properties: { Name: { type: "title", title: rt("My Page") } },
};

test("maps a full block tree to a renderable, aligned PageModel", () => {
  const model = pageToModel(PAGE, TREE);
  expect(model.title).toBe("My Page");
  expect(model.icon).toBe("🧪");
  expect(model.cover).toBe("cover");
  const out = renderPage(model);
  // renders without throwing, nothing overflows the page
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
  expect(out).toContain("# Title");
  expect(out).toContain("• parent");
  expect(out).toContain("  ◦ child"); // recursion preserved
  expect(out).toContain("[x] done");
  expect(out).toContain("💡 note");
  expect(out).toContain("▦ Tasks     (database)"); // child_database → labeled link
  expect(out).toContain("[ some_future_block ]"); // unknown → unsupported
});
