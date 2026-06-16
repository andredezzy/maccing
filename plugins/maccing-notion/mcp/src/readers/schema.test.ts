// Pure unit tests for the schema renderer — no Notion API. Run with `bun test`.

import { expect, test } from "bun:test";

import { formatIconAssetPath, formatSchema, type IconsById, type PropertiesMap } from "./schema";

const properties: PropertiesMap = {
  Name: { id: "title", type: "title" },
  Value: { id: "sshZ", type: "number", number: { format: "number_with_commas" } },
  "Is USD": { id: "DmQd", type: "checkbox" },
  Month: { id: "yKFr", type: "relation", relation: { type: "dual_property" } },
  "USD Rate": {
    id: "%3F~%5CG",
    type: "rollup",
    rollup: { function: "max", rollup_property_name: "USD Rate", relation_property_name: "Month" },
  },
  "Real Value": {
    id: "IiYA",
    type: "formula",
    formula: { expression: "round(if({{notion:block_property:DmQd:b2479c20}}, x, y))" },
  },
};

test("renders the column count and every property name", () => {
  const output = formatSchema(properties);
  expect(output).toContain("# Schema (6 columns)");
  expect(output).toContain("Name");
  expect(output).toContain("Real Value");
});

test("elides the formula BODY — never leaks the compiled {{notion:…}} blob", () => {
  const output = formatSchema(properties);
  expect(output).toContain("formula");
  expect(output).not.toContain("notion:block_property");
  expect(output).not.toContain("round(if");
});

test("summarizes number format, relation arity, and rollup function", () => {
  const output = formatSchema(properties);
  expect(output).toContain("number · number_with_commas");
  expect(output).toContain("relation · dual");
  expect(output).toContain("rollup · max(USD Rate) via Month"); // full rollup detail incl. the `via <relation>` suffix
});

test("injects a column icon, matching a RAW private id to the url-encoded schema id", () => {
  // private icon map keys are RAW (url-decoded): decodeURIComponent("%3F~%5CG") === "?~\\G"
  const icons: IconsById = { "?~\\G": "/icons/arrows-swap-horizontally_gray.svg" };
  const output = formatSchema(properties, icons);
  expect(output).toContain("[icon arrows-swap-horizontally·gray]");
});

test("no icons map → no icon markers at all", () => {
  expect(formatSchema(properties)).not.toContain("[icon ");
});

test("an id-less property gets no icon even when the icons map is non-empty (the !id guard)", () => {
  // Name (id "title") resolves its icon; Computed has no id → iconFor short-circuits to null.
  const output = formatSchema(
    { Name: { id: "title", type: "title" }, Computed: { type: "checkbox" } },
    { title: "/icons/cash_gray.svg" },
  );
  expect(output).toContain("[icon cash·gray]"); // the id-bearing column resolved its icon
  const computedLine = output.split("\n").find((line) => line.startsWith("Computed"));
  expect(computedLine).not.toContain("[icon "); // id-less column → no icon marker
});

test("empty schema is reported, not crashed", () => {
  expect(formatSchema({})).toContain("# Schema (0 columns)");
});

test("typeDetail: option counts, single relation, suppressed plain number, function-less rollup", () => {
  const out = formatSchema({
    Tags: { id: "t", type: "select", select: { options: [{ name: "A" }, { name: "B" }, { name: "C" }] } },
    Labels: { id: "ms", type: "multi_select", multi_select: { options: [{ name: "P" }, { name: "Q" }] } },
    Stage: { id: "g", type: "status", status: { options: [{ name: "X" }, { name: "Y" }] } },
    Link: { id: "l", type: "relation", relation: { type: "single_property" } },
    Count: { id: "c", type: "number", number: { format: "number" } },
    Roll: { id: "r", type: "rollup", rollup: {} },
    RollCount: { id: "rc", type: "rollup", rollup: { function: "count_all" } },
    RollNoVia: { id: "rv", type: "rollup", rollup: { function: "max", rollup_property_name: "USD Rate" } },
  });
  expect(out).toContain("select · 3 options");
  expect(out).toContain("multi_select · 2 options");
  expect(out).toContain("status · 2 options");
  expect(out).toContain("relation · single");
  expect(out).toContain("rollup · count_all"); // function only — no parens (no rollup_property_name)
  expect(out).toContain("rollup · max(USD Rate)"); // function + target, no ` via` (no relation_property_name)
  const lines = out.split("\n");
  expect(
    lines
      .find((line) => line.startsWith("Count"))
      ?.trimEnd()
      .endsWith("number"),
  ).toBe(true); // format "number" → no suffix
  expect(
    lines
      .find((line) => line.startsWith("Roll"))
      ?.trimEnd()
      .endsWith("rollup"),
  ).toBe(true); // no function → no suffix
});

test("formatIconAssetPath splits color on the last underscore, else returns the stem as-is", () => {
  expect(formatIconAssetPath("/icons/arrows-swap-horizontally_gray.svg")).toBe("arrows-swap-horizontally·gray");
  expect(formatIconAssetPath("/icons/cash.svg")).toBe("cash"); // no underscore → no color separator
});
