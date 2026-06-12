// Pure unit tests for the search-hit renderer — no Notion API. Run with `bun test`.

import { expect, test } from "bun:test";

import { formatSearch, type RawSearchResult } from "./format-search";

const results: RawSearchResult[] = [
  {
    object: "data_source",
    id: "b2479c20-380d-41f1-89f3-4449fb31caf9",
    title: [{ plain_text: "Months" }],
    parent: { type: "page_id", page_id: "3cf65cfc-3cda-4338-8c29-10e08ec0bdb4" },
  },
  {
    object: "page",
    id: "3cf65cfc-3cda-4338-8c29-10e08ec0bdb4",
    properties: { Name: { type: "title", title: [{ plain_text: "Investments" }] } },
    parent: { type: "data_source_id", data_source_id: "4fde42fa-d531-4595-b3a2-a5fc3cd3ef74" },
  },
];

test("renders one compact line per hit: object · title · short id · parent", () => {
  const out = formatSearch(results);
  expect(out).toContain("data_source");
  expect(out).toContain('"Months"');
  expect(out).toContain("b2479c20…caf9"); // short id
  expect(out).toContain("parent page 3cf65cfc…bdb4");
  expect(out).toContain("# 2 hits");
});

test("extracts a PAGE title from its title-type property", () => {
  expect(formatSearch(results)).toContain('"Investments"');
});

test("empty result set is reported, not crashed", () => {
  expect(formatSearch([])).toContain("# 0 hits");
});
