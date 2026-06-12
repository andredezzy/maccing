// Pure unit tests for the views renderer — no Notion API. Run with `bun test`.

import { expect, test } from "bun:test";

import { formatViews, type IdToName, type RawView } from "./format-views";

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
  const out = formatViews([gallery], idToName);
  expect(out).toContain("# Views (1)");
  expect(out).toContain("## Gallery · gallery");
  expect(out).toContain("sorts: Net worth (last month) ↓");
});

test("dumps the full configuration with every visual prop and resolves property ids", () => {
  const out = formatViews([gallery], idToName);
  expect(out).toContain('"cover_size": "medium"'); // card size preserved
  expect(out).toContain('"cover_aspect": "cover"'); // preview/fit preserved
  expect(out).toContain('"type": "page_cover"'); // cover/preview source
  expect(out).toContain('"property_name": "Name"'); // title resolved
  expect(out).toContain('"property_name": "Net worth (last month)"'); // raw id resolved
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
  const out = formatViews([chart], idToName);
  expect(out).toContain('"chart_type": "line"');
  expect(out).toContain('"property_name": "Name"');
  expect(out).toContain('"property_name": "Net worth (R$)"');
});
