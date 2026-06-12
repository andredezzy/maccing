// Pure unit tests for the schema renderer — no Notion API. Run with `bun test`.

import { expect, test } from "bun:test";

import { formatSchema, type IconsById, type PropertiesMap } from "./format-schema";

const props: PropertiesMap = {
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
  const out = formatSchema(props);
  expect(out).toContain("# Schema (6 columns)");
  expect(out).toContain("Name");
  expect(out).toContain("Real Value");
});

test("elides the formula BODY — never leaks the compiled {{notion:…}} blob", () => {
  const out = formatSchema(props);
  expect(out).toContain("formula");
  expect(out).not.toContain("notion:block_property");
  expect(out).not.toContain("round(if");
});

test("summarizes number format, relation arity, and rollup function", () => {
  const out = formatSchema(props);
  expect(out).toContain("number · number_with_commas");
  expect(out).toContain("relation · dual");
  expect(out).toContain("rollup · max(USD Rate)");
});

test("injects a column icon, matching a RAW private id to the url-encoded schema id", () => {
  // private icon map keys are RAW (url-decoded): decodeURIComponent("%3F~%5CG") === "?~\\G"
  const icons: IconsById = { "?~\\G": "/icons/arrows-swap-horizontally_gray.svg" };
  const out = formatSchema(props, icons);
  expect(out).toContain("[icon arrows-swap-horizontally·gray]");
});

test("no icons map → no icon markers at all", () => {
  expect(formatSchema(props)).not.toContain("[icon ");
});

test("empty schema is reported, not crashed", () => {
  expect(formatSchema({})).toContain("# Schema (0 columns)");
});
