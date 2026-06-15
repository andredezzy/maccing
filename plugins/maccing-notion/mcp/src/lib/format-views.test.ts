// Pure unit tests for the views renderer — no Notion API. Run with `bun test`.

import { expect, test } from "bun:test";

import { formatViews, type IdToName, orderViews, type RawView, selectViewIndex, viewQueryFilter } from "./format-views";

const idToName: IdToName = { CtfH: "Net worth (last month)", "M>L>": "Net worth (R$)", title: "Name" };

const gallery: RawView = {
  id: "37c99f0d-0a4a-8183-8b2c-000c97b6d0d0",
  name: "Gallery",
  type: "gallery",
  sorts: [{ property: "CtfH", direction: "descending" }],
  filter: null,
  configuration: {
    type: "gallery",
    properties: [
      { property_id: "title", visible: true },
      { property_id: "CtfH", visible: false },
    ],
    cover: { type: "page_cover" },
    cover_size: "medium",
    cover_aspect: "cover",
  },
};

test("renders a header with name + type and resolved sorts", () => {
  const output = formatViews([gallery], idToName);
  expect(output).toContain("# Views (1)");
  expect(output).toContain("## Gallery · gallery");
  expect(output).toContain("sorts: Net worth (last month) ↓ descending");
});

test("renders the sort direction word (ascending) alongside the arrow", () => {
  const view: RawView = {
    name: "Oldest first",
    type: "table",
    sorts: [{ property: "title", direction: "ascending" }],
    configuration: { type: "table" },
  };
  expect(formatViews([view], idToName)).toContain("sorts: Name ↑ ascending");
});

test("dumps the full configuration with every visual prop and resolves property ids", () => {
  const output = formatViews([gallery], idToName);
  expect(output).toContain('"cover_size": "medium"'); // card size preserved
  expect(output).toContain('"cover_aspect": "cover"'); // preview/fit preserved
  expect(output).toContain('"type": "page_cover"'); // cover/preview source
  expect(output).toContain('"property_name": "Name"'); // title resolved
  expect(output).toContain('"property_name": "Net worth (last month)"'); // raw id resolved
});

test("resolves a raw view id against a url-encoded schema id (and vice versa)", () => {
  const encoded: IdToName = { "M%3EL%3E": "Net worth (R$)" };
  const view: RawView = {
    name: "T",
    type: "table",
    configuration: { type: "table", properties: [{ property_id: "M>L>", visible: true }] },
  };
  expect(formatViews([view], encoded)).toContain('"property_name": "Net worth (R$)"');
});

test("empty view list is reported, not crashed", () => {
  expect(formatViews([], idToName)).toContain("# Views (0)");
});

test("resolves the `property` id inside a view filter (and shows it)", () => {
  const view: RawView = {
    name: "Holdings",
    type: "table",
    sorts: [{ property: "IiYA", direction: "descending" }],
    filter: { property: "yKFr", relation: { contains: "page-123" } },
    configuration: { type: "table", properties: [] },
  };
  const map: IdToName = { yKFr: "Month", IiYA: "Real Value" };
  const output = formatViews([view], map);
  expect(output).toContain("sorts: Real Value ↓ descending");
  expect(output).toMatch(/property_name":\s*"Month"/); // filter property id resolved to name
  expect(output).toMatch(/contains":\s*"page-123"/); // filter value preserved verbatim
});

test("always shows filter and quick_filters lines (— when none)", () => {
  const view: RawView = {
    name: "T",
    type: "table",
    filter: null,
    quick_filters: null,
    configuration: { type: "table" },
  };
  const output = formatViews([view], {});
  expect(output).toContain("filter: —");
  expect(output).toContain("quick_filters: —");
});

test("a chart view's axes property ids resolve", () => {
  const chart: RawView = {
    name: "NW over time",
    type: "chart",
    configuration: {
      type: "chart",
      chart_type: "line",
      x_axis: { property_id: "title", group_by: "month" },
      y_axis: { property_id: "M>L>", aggregator: "sum" },
    },
  };
  const output = formatViews([chart], idToName);
  expect(output).toContain('"chart_type": "line"');
  expect(output).toContain('"property_name": "Name"');
  expect(output).toContain('"property_name": "Net worth (R$)"');
});

test("orderViews orders by the container view_ids and drops foreign-container views", () => {
  const raw: RawView[] = [
    { id: "cal", name: "Calendar", type: "calendar", parent: { database_id: "DB" } },
    { id: "board", name: "Board", type: "board", parent: { database_id: "DB" } },
    { id: "foreign", name: "Board", type: "board", parent: { database_id: "OTHER" } },
  ];
  // With the container's view_ids: exact tab order, foreign view excluded, view_ids[0] is the default.
  expect(orderViews(raw, ["board", "cal"], "DB").map((v) => v.id)).toEqual(["board", "cal"]);
  // Fallback (no view_ids — token_v2 absent): filter foreign by parent.database_id, keep public order.
  expect(orderViews(raw, null, "DB").map((v) => v.id)).toEqual(["cal", "board"]);
  // Defensive: if the parent filter would drop everything, keep the unfiltered set.
  expect(orderViews(raw, null, "MISSING").map((v) => v.id)).toEqual(["cal", "board", "foreign"]);
});

test("viewQueryFilter merges a view's filter + quick_filters into one /query filter (verbatim)", () => {
  expect(viewQueryFilter({ id: "v" })).toBeUndefined();
  expect(viewQueryFilter({ id: "v", filter: { property: "S", status: { equals: "Done" } } })).toEqual({
    property: "S",
    status: { equals: "Done" },
  });
  // a quick_filter { propId: condition } becomes { property: propId, ...condition }
  expect(viewQueryFilter({ id: "v", quick_filters: { tjUk: { checkbox: { equals: false } } } })).toEqual({
    property: "tjUk",
    checkbox: { equals: false },
  });
  // both present → AND them together
  expect(
    viewQueryFilter({
      id: "v",
      filter: { property: "S", status: { equals: "Done" } },
      quick_filters: { tjUk: { checkbox: { equals: false } } },
    }),
  ).toEqual({
    and: [
      { property: "S", status: { equals: "Done" } },
      { property: "tjUk", checkbox: { equals: false } },
    ],
  });
});

test("selectViewIndex resolves a view by index, exact name, id, or partial name (default 0)", () => {
  const views = [
    { id: "a", name: "Board" },
    { id: "b", name: "Backlog" },
    { id: "c", name: "Open tasks" },
  ];
  expect(selectViewIndex(views, undefined)).toBe(0); // default → the default view
  expect(selectViewIndex(views, 2)).toBe(2); // index
  expect(selectViewIndex(views, 9)).toBe(0); // out of range → default
  expect(selectViewIndex(views, "Backlog")).toBe(1); // exact name
  expect(selectViewIndex(views, "backlog")).toBe(1); // case-insensitive
  expect(selectViewIndex(views, "c")).toBe(2); // id match
  expect(selectViewIndex(views, "Open")).toBe(2); // partial name
  expect(selectViewIndex(views, "zzz")).toBe(0); // no match → default
});
