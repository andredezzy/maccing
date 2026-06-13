// Pure unit tests for the view-column reorder planner — no Notion API. Run with `bun test`.

import { expect, test } from "bun:test";

import { reorderViewProperties, type ViewProp } from "./view-columns";

test("reorders to the requested order, title pinned first, remainder appended (stable)", () => {
  const current: ViewProp[] = [
    { property_id: "title", visible: true },
    { property_id: "sshZ", visible: true }, // Value
    { property_id: "DmQd", visible: true }, // Is USD
    { property_id: "YZcD", visible: true }, // Real Value (R$)
    { property_id: "ftuP", visible: false }, // Category (hidden)
  ];
  const out = reorderViewProperties(current, ["YZcD", "sshZ"]); // Real Value (R$), Value
  expect(out.map((p) => p.property_id)).toEqual(["title", "YZcD", "sshZ", "DmQd", "ftuP"]);
});

test("preserves each column's visibility and width", () => {
  const current: ViewProp[] = [
    { property_id: "title", visible: true, width: 280 },
    { property_id: "A", visible: true, width: 100 },
    { property_id: "B", visible: false, width: 160 },
  ];
  const out = reorderViewProperties(current, ["B", "A"]);
  expect(out.find((p) => p.property_id === "B")?.visible).toBe(false); // stays hidden
  expect(out.find((p) => p.property_id === "A")?.width).toBe(100); // width kept
});

test("title stays first even when absent from the order list", () => {
  const current: ViewProp[] = [{ property_id: "title" }, { property_id: "A" }, { property_id: "B" }];
  expect(reorderViewProperties(current, ["B"]).map((p) => p.property_id)).toEqual(["title", "B", "A"]);
});

test("matches encoding-insensitively (view uses decoded ids, order may be encoded)", () => {
  const current: ViewProp[] = [
    { property_id: "title" },
    { property_id: "?~\\G", visible: false },
    { property_id: "sshZ" },
  ];
  // order passed url-ENCODED (%3F~%5CG) must still match the decoded view id "?~\\G"
  const out = reorderViewProperties(current, ["%3F~%5CG"]);
  expect(out.map((p) => p.property_id)).toEqual(["title", "?~\\G", "sshZ"]);
});

test("hide/show override visibility for listed columns; others preserved", () => {
  const current: ViewProp[] = [
    { property_id: "title", visible: true },
    { property_id: "A", visible: true },
    { property_id: "B", visible: true },
  ];
  const out = reorderViewProperties(current, ["A"], { hide: new Set(["B"]) });
  expect(out.find((p) => p.property_id === "B")?.visible).toBe(false);
  expect(out.find((p) => p.property_id === "A")?.visible).toBe(true);
});

test("an order id not present in the view is skipped, not crashed", () => {
  const current: ViewProp[] = [{ property_id: "title" }, { property_id: "A" }];
  expect(reorderViewProperties(current, ["ZZZ", "A"]).map((p) => p.property_id)).toEqual(["title", "A"]);
});
