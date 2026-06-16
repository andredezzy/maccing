// Pure unit tests for the views renderer — no Notion API. Run with `bun test`.

import { afterEach, expect, test } from "bun:test";

import {
  buildIdToName,
  fetchViews,
  formatViews,
  type IdToName,
  listViewIds,
  orderViews,
  type RawView,
  selectViewIndex,
  viewQueryFilter,
} from "./views";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Build a fetch Response stub carrying a JSON body at the given status. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
    headers: { get: () => null },
  } as unknown as Response;
}

/** Replace fetch with a scripted sequence of 200 JSON bodies (the last repeats). */
function mockJsonBodies(bodies: unknown[]): void {
  let index = 0;
  globalThis.fetch = (async () => {
    const body = bodies[Math.min(index, bodies.length - 1)];
    index += 1;
    return jsonResponse(200, body);
  }) as unknown as typeof fetch;
}

test("listViewIds paginates to the end, threading next_cursor", async () => {
  mockJsonBodies([
    { results: [{ id: "v1" }, { id: "v2" }], has_more: true, next_cursor: "c1" },
    { results: [{ id: "v3" }], has_more: false },
  ]);
  expect(await listViewIds("ds")).toEqual(["v1", "v2", "v3"]);
});

test("listViewIds stops and returns the partial list on a non-2xx response", async () => {
  globalThis.fetch = (async () => jsonResponse(500, {})) as unknown as typeof fetch;
  expect(await listViewIds("ds")).toEqual([]); // first page failed → nothing collected
});

test("fetchViews lists the view ids, then batch-fetches each view's full config", async () => {
  mockJsonBodies([
    { results: [{ id: "v1" }, { id: "v2" }, { id: "v3" }], has_more: false }, // listViewIds page
    { id: "v1", name: "Board", type: "board" },
    { id: "v2", name: "Calendar", type: "calendar" },
    { id: "v3", name: "List", type: "list" },
  ]);
  const views = await fetchViews("ds");
  expect(views.map((view) => view.id)).toEqual(["v1", "v2", "v3"]);
  expect(views.map((view) => view.type)).toEqual(["board", "calendar", "list"]);
});

test("fetchViews silently drops a view whose individual fetch fails, keeping the rest in order", async () => {
  globalThis.fetch = (async (url: string | URL) => {
    const idMatch = String(url).match(/\/v1\/views\/([^?]+)$/);
    if (!idMatch) {
      return jsonResponse(200, { results: [{ id: "v1" }, { id: "v2" }, { id: "v3" }], has_more: false });
    }
    const id = idMatch[1];
    return id === "v2" ? jsonResponse(500, {}) : jsonResponse(200, { id, name: id, type: "table" });
  }) as unknown as typeof fetch;
  const views = await fetchViews("ds");
  expect(views.map((view) => view.id)).toEqual(["v1", "v3"]); // v2's failed fetch dropped; order preserved
});

const idToName: IdToName = { CtfH: "Net worth (last month)", "M>L>": "Net worth (R$)", title: "Name" };

test("buildIdToName: skips id-less entries and keys by both the raw and decoded id", () => {
  const map = buildIdToName({ Name: { id: "title" }, Value: { id: "%3F~%5CG" }, NoId: {} });
  expect(map.title).toBe("Name");
  expect(map["%3F~%5CG"]).toBe("Value"); // raw id key
  expect(map["?~\\G"]).toBe("Value"); // decoded id key (%3F~%5CG → ?~\G)
  expect("NoId" in map).toBe(false); // id-less entry skipped
});

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

test("formatViews renders a non-null quick_filters block, resolving its property ids", () => {
  const output = formatViews(
    [{ name: "T", type: "table", quick_filters: { property: "tjUk", checkbox: { equals: false } } }],
    { tjUk: "Done" },
  );
  expect(output).not.toContain("quick_filters: —"); // truthy branch, not the sentinel
  expect(output).toContain("property_name"); // resolveDeep annotated the `property` id → name
});

test("renderSorts resolves a sort property id via an encoded id variant", () => {
  // idToName is keyed by the ENCODED id; the sort's raw id "M>L>" resolves only through idVariants
  const output = formatViews([{ name: "T", type: "table", sorts: [{ property: "M>L>", direction: "ascending" }] }], {
    "M%3EL%3E": "Net worth (R$)",
  });
  expect(output).toContain("sorts: Net worth (R$) ↑ ascending");
});

test("renderSorts falls back to the raw id when it resolves to nothing", () => {
  expect(formatViews([{ name: "T", type: "table", sorts: [{ property: "UNRESOLVED" }] }], {})).toContain(
    "sorts: UNRESOLVED",
  );
});

test("formatViews shows the url line when a view carries a url", () => {
  const view: RawView = { name: "Board", type: "board", url: "https://notion.so/abc" };
  expect(formatViews([view], {})).toContain("url: https://notion.so/abc");
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
  expect(output).toContain("sorts: —"); // no sorts → the — sentinel
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
  expect(orderViews(raw, ["board", "cal"], "DB").map((view) => view.id)).toEqual(["board", "cal"]);
  // Fallback (no view_ids — token_v2 absent): filter foreign by parent.database_id, keep public order.
  expect(orderViews(raw, null, "DB").map((view) => view.id)).toEqual(["cal", "board"]);
  // Defensive: if the parent filter would drop everything, keep the unfiltered set.
  expect(orderViews(raw, null, "MISSING").map((view) => view.id)).toEqual(["cal", "board", "foreign"]);
  // Defensive: view_ids present but NONE match → fall through to the parent filter (same as the null path).
  expect(orderViews(raw, ["nonexistent"], "DB").map((view) => view.id)).toEqual(["cal", "board"]);
});

test("viewQueryFilter returns the saved filter VERBATIM (no re-wrapping) or falls back to quick_filters", () => {
  expect(viewQueryFilter({ id: "v" })).toBeUndefined();
  expect(viewQueryFilter({ id: "v", filter: { property: "S", status: { equals: "Done" } } })).toEqual({
    property: "S",
    status: { equals: "Done" },
  });
  // a single quick_filter { propId: condition } becomes { property: propId, ...condition }
  expect(viewQueryFilter({ id: "v", quick_filters: { tjUk: { checkbox: { equals: false } } } })).toEqual({
    property: "tjUk",
    checkbox: { equals: false },
  });
  // both present → the saved filter wins VERBATIM (an extra `and` wrapper would exceed Notion's 2-level
  // nesting limit and 400; the saved filter is already a valid ≤2-level filter)
  expect(
    viewQueryFilter({
      id: "v",
      filter: { property: "S", status: { equals: "Done" } },
      quick_filters: { tjUk: { checkbox: { equals: false } } },
    }),
  ).toEqual({ property: "S", status: { equals: "Done" } });
  // a nested saved filter passes through untouched
  const nested = { or: [{ and: [{ property: "S", status: { equals: "Complete" } }] }, { property: "S", status: {} }] };
  expect(viewQueryFilter({ id: "v", filter: nested })).toEqual(nested);
  // multiple quick_filters (no saved filter) → AND the leaf conditions (1 level, safe)
  expect(
    viewQueryFilter({
      id: "v",
      quick_filters: { tjUk: { checkbox: { equals: false } }, aB: { number: { equals: 1 } } },
    }),
  ).toEqual({
    and: [
      { property: "tjUk", checkbox: { equals: false } },
      { property: "aB", number: { equals: 1 } },
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
  expect(selectViewIndex([], "Backlog")).toBe(0); // empty views → default, regardless of selector
});
