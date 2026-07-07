// Pure unit tests for the property-order reorder planners — no Notion API. Run with `bun test`.

import { expect, test } from "bun:test";

import {
  reorderPageProperties,
  reorderViewProperties,
  seedPageOrderFromSchema,
  type ViewProperty,
} from "./reorder-properties";

test("seedPageOrderFromSchema: every property, default-visible, with its id url-decoded", () => {
  expect(seedPageOrderFromSchema({ Name: { id: "title" }, Value: { id: "%3F~%5CG" } })).toEqual([
    { property: "title", visible: true },
    { property: "?~\\G", visible: true }, // %3F~%5CG → ?~\G
  ]);
});

test("an empty current list returns [] (nothing to reorder)", () => {
  expect(reorderViewProperties([], ["A", "B"])).toEqual([]);
  expect(reorderPageProperties([], ["A"])).toEqual([]);
});

test("no title entry + title not in order → nothing is prepended, remainder keeps relative order", () => {
  const current: ViewProperty[] = [{ property_id: "A" }, { property_id: "B" }];
  expect(reorderViewProperties(current, ["B"]).map((property) => property.property_id)).toEqual(["B", "A"]);
});

test("reorderPageProperties reorders the canonical {property, visible} list, title first, visibility preserved", () => {
  const current = [
    { property: "title", visible: true },
    { property: "sshZ", visible: true },
    { property: "ftuP", visible: false },
  ];
  const reordered = reorderPageProperties(current, ["ftuP", "sshZ"]);
  expect(reordered).toEqual([
    { property: "title", visible: true },
    { property: "ftuP", visible: false }, // moved up, stays hidden
    { property: "sshZ", visible: true },
  ]);
});

test("reorders to the requested order, title pinned first, remainder appended (stable)", () => {
  const current: ViewProperty[] = [
    { property_id: "title", visible: true },
    { property_id: "sshZ", visible: true }, // Value
    { property_id: "DmQd", visible: true }, // Is USD
    { property_id: "YZcD", visible: true }, // Real Value (R$)
    { property_id: "ftuP", visible: false }, // Category (hidden)
  ];
  const reordered = reorderViewProperties(current, ["YZcD", "sshZ"]); // Real Value (R$), Value
  expect(reordered.map((viewProperty) => viewProperty.property_id)).toEqual(["title", "YZcD", "sshZ", "DmQd", "ftuP"]);
});

test("preserves each column's visibility and width", () => {
  const current: ViewProperty[] = [
    { property_id: "title", visible: true, width: 280 },
    { property_id: "A", visible: true, width: 100 },
    { property_id: "B", visible: false, width: 160 },
  ];
  const reordered = reorderViewProperties(current, ["B", "A"]);
  expect(reordered.find((viewProperty) => viewProperty.property_id === "B")?.visible).toBe(false); // stays hidden
  expect(reordered.find((viewProperty) => viewProperty.property_id === "A")?.width).toBe(100); // width kept
});

test("title stays first when absent from the order list (the default)", () => {
  const current: ViewProperty[] = [{ property_id: "title" }, { property_id: "A" }, { property_id: "B" }];
  expect(reorderViewProperties(current, ["B"]).map((viewProperty) => viewProperty.property_id)).toEqual([
    "title",
    "B",
    "A",
  ]);
});

test("title is reorderable when explicitly listed — it moves to the requested spot, NOT pinned first", () => {
  // Notion lets the title column be moved in a table view (live-verified 2026-06-14: Training Log
  // "Note" title placed after "Hard sets" and rendered there). Listing "title" in `order` positions it.
  const current: ViewProperty[] = [
    { property_id: "title" },
    { property_id: "A" },
    { property_id: "B" },
    { property_id: "C" },
  ];
  expect(
    reorderViewProperties(current, ["A", "B", "title", "C"]).map((viewProperty) => viewProperty.property_id),
  ).toEqual(["A", "B", "title", "C"]);
});

test("matches encoding-insensitively (view uses decoded ids, order may be encoded)", () => {
  const current: ViewProperty[] = [
    { property_id: "title" },
    { property_id: "?~\\G", visible: false },
    { property_id: "sshZ" },
  ];
  // order passed url-ENCODED (%3F~%5CG) must still match the decoded view id "?~\\G"
  const reordered = reorderViewProperties(current, ["%3F~%5CG"]);
  expect(reordered.map((viewProperty) => viewProperty.property_id)).toEqual(["title", "?~\\G", "sshZ"]);
});

test("an order id not present in the view is skipped, not crashed", () => {
  const current: ViewProperty[] = [{ property_id: "title" }, { property_id: "A" }];
  expect(reorderViewProperties(current, ["ZZZ", "A"]).map((viewProperty) => viewProperty.property_id)).toEqual([
    "title",
    "A",
  ]);
});
