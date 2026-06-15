// Pure unit tests for the row formatters — no Notion API. Run with `bun test`.

import { expect, test } from "bun:test";

import { formatRows } from "./rows";

const rows = [
  { Name: "A", Value: 10, Cat: "X" },
  { Name: "B", Value: 5, Cat: "Y" },
  { Name: "C", Value: 20, Cat: "X" },
];
const columns = ["Name", "Value", "Cat"];

test("table renders a GFM pipe table with a header + separator", () => {
  const output = formatRows(rows, columns, "table");
  expect(output).toContain("| Name | Value | Cat |");
  expect(output).toContain("|---|---|---|");
  expect(output).toContain("| A | 10 | X |");
});

test("tsv is tab-separated with a header row", () => {
  const output = formatRows(rows, columns, "tsv");
  expect(output.split("\n")[0]).toBe("Name\tValue\tCat");
  expect(output).toContain("A\t10\tX");
});

test("kv emits key: value lines, skipping empty values", () => {
  const output = formatRows([{ Name: "A", Value: 10, Cat: null }], columns, "kv");
  expect(output).toContain("Name: A");
  expect(output).toContain("Value: 10");
  expect(output).not.toContain("Cat:");
});

test("summary groups by the given column and sums numeric columns + total", () => {
  const output = formatRows(rows, columns, "summary", "Cat");
  expect(output).toContain("group by: Cat");
  expect(output).toContain("30"); // X = 10 + 20
  expect(output).toMatch(/Total\s+35/); // 10 + 5 + 20
});

test("table on no rows still emits the header + separator", () => {
  expect(formatRows([], columns, "table")).toBe("| Name | Value | Cat |\n|---|---|---|");
});
