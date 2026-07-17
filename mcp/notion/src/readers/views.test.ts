// Pure unit tests for the views renderer — no Notion API. Run with `bun test`.

import { afterEach, expect, test } from "bun:test";
import { buildIdToName, fetchViews, formatViews, type IdToName, listViewIds, type RawView } from "./views";

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

test("listViewIds throws on a non-2xx response (no silent partial list)", async () => {
  globalThis.fetch = (async () => jsonResponse(500, {})) as unknown as typeof fetch;
  await expect(listViewIds("ds")).rejects.toThrow("Failed to list views for data source ds");
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

test("views='summary' renders one line per view ending with the full-mode hint", () => {
  const view: RawView = {
    name: "Gallery",
    type: "gallery",
    parent: { database_id: "37c99f0d-0a4a-8183-8b2c-000c97b6d0d0" },
    sorts: [{ property: "CtfH", direction: "descending" }],
    filter: { property: "CtfH", number: { greater_than: 0 } },
    configuration: { type: "gallery" },
  };
  const output = formatViews([view], idToName, "summary");
  expect(output).toContain("# Views (1)");
  expect(output).toContain("Gallery · gallery · container 37c99f0d · filter:");
  expect(output).toContain("sorts: Net worth (last month) ↓ descending");
  expect(output.trimEnd().endsWith('(full view configs — required before ANY view PATCH: pass views:"full")')).toBe(
    true,
  );
});

test("views='summary' omits configuration/quick_filters (kept out of the one-liner)", () => {
  const view: RawView = {
    name: "T",
    type: "table",
    quick_filters: { property: "x" },
    configuration: { type: "table" },
  };
  const output = formatViews([view], {}, "summary");
  expect(output).not.toContain("quick_filters");
  expect(output).not.toContain('"type": "table"');
});

test("views='summary' falls back to '?' when a view has no parent database_id", () => {
  const view: RawView = { name: "T", type: "table" };
  expect(formatViews([view], {}, "summary")).toContain("T · table · container ? ·");
});

test("views='summary' with no views reports zero, without the full-mode hint", () => {
  const output = formatViews([], {}, "summary");
  expect(output).toContain("# Views (0)");
  expect(output).not.toContain('views:"full"');
});

test("formatViews defaults to full mode when no mode is passed (back-compat)", () => {
  expect(formatViews([gallery], idToName)).toContain("## Gallery · gallery");
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
