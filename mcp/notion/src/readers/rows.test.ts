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

test("kv/tsv/summary on no rows don't crash (empty kv, header-only tsv, 0-row summary)", () => {
  expect(formatRows([], columns, "kv")).toBe("");
  expect(formatRows([], columns, "tsv")).toBe("Name\tValue\tCat");
  expect(formatRows([], columns, "summary")).toContain("0 rows");
});

test("summary fallback (no numeric column): per-column value distribution", () => {
  const output = formatRows([{ Cat: "X" }, { Cat: "Y" }, { Cat: "X" }], ["Cat"], "summary");
  expect(output).toContain("3 rows");
  expect(output).toContain("Cat: X(2) Y(1)");
  expect(output).not.toContain("group by"); // fallback path, not the grouped path
});

test("summary fallback (group candidate is all-unique): numeric columns are summed", () => {
  const output = formatRows(
    [
      { Name: "A", Value: 10 },
      { Name: "B", Value: 20 },
    ],
    ["Name", "Value"],
    "summary",
  );
  expect(output).toContain("Value: sum 30");
  expect(output).toContain("Name: A(1) B(1)");
  expect(output).not.toContain("group by");
});

test("summary fallback (only numeric columns): sum with no grouping", () => {
  const output = formatRows([{ Value: 10 }, { Value: 20 }], ["Value"], "summary");
  expect(output).toContain("Value: sum 30");
  expect(output).not.toContain("group by");
});

test("summary: a null/empty group value lands in the (empty) bucket", () => {
  const output = formatRows(
    [
      { Cat: null, Value: 10 },
      { Cat: "X", Value: 5 },
    ],
    ["Cat", "Value"],
    "summary",
    "Cat",
  );
  expect(output).toContain("group by: Cat");
  expect(output).toContain("(empty)"); // the null Cat row groups under (empty)
});

test("summary: an explicit groupBy absent from columns is ignored → auto-detect", () => {
  const output = formatRows(rows, columns, "summary", "NotAColumn");
  expect(output).toContain("group by: Cat"); // falls back to the low-cardinality non-numeric column
});

test("table escapes pipes (\\|) and flattens newlines to spaces in cells", () => {
  expect(formatRows([{ Name: "A|B" }], ["Name"], "table")).toContain("A\\|B");
  expect(formatRows([{ Name: "A\nB" }], ["Name"], "table")).toContain("| A B |");
});

test("tsv flattens an embedded tab to a space (column structure stays intact)", () => {
  const dataRow = formatRows([{ Name: "A\tB" }], ["Name"], "tsv").split("\n")[1];
  expect(dataRow).toBe("A B"); // the in-cell tab became a space; only column-separator tabs remain
});

test("kv separates multiple rows with a blank line", () => {
  const output = formatRows(
    [
      { Name: "A", Value: 1, Cat: "X" },
      { Name: "B", Value: 2, Cat: "Y" },
    ],
    columns,
    "kv",
  );
  expect(output).toContain("\n\n"); // blank line between the two row blocks
});
