// Pure unit tests for the row formatters — no Notion API. Run with `bun test`.

import { expect, test } from "bun:test";

import { formatRows } from "./format-rows";

const rows = [
  { Name: "A", Value: 10, Cat: "X" },
  { Name: "B", Value: 5, Cat: "Y" },
  { Name: "C", Value: 20, Cat: "X" },
];
const cols = ["Name", "Value", "Cat"];

test("table renders a GFM pipe table with a header + separator", () => {
  const out = formatRows(rows, cols, "table");
  expect(out).toContain("| Name | Value | Cat |");
  expect(out).toContain("|---|---|---|");
  expect(out).toContain("| A | 10 | X |");
});

test("tsv is tab-separated with a header row", () => {
  const out = formatRows(rows, cols, "tsv");
  expect(out.split("\n")[0]).toBe("Name\tValue\tCat");
  expect(out).toContain("A\t10\tX");
});

test("kv emits key: value lines, skipping empty values", () => {
  const out = formatRows([{ Name: "A", Value: 10, Cat: null }], cols, "kv");
  expect(out).toContain("Name: A");
  expect(out).toContain("Value: 10");
  expect(out).not.toContain("Cat:");
});

test("summary groups by the given column and sums numeric columns + total", () => {
  const out = formatRows(rows, cols, "summary", "Cat");
  expect(out).toContain("group by: Cat");
  expect(out).toContain("30"); // X = 10 + 20
  expect(out).toMatch(/Total\s+35/); // 10 + 5 + 20
});

test("table on no rows still emits the header + separator", () => {
  expect(formatRows([], cols, "table")).toBe("| Name | Value | Cat |\n|---|---|---|");
});
