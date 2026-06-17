// Pure unit tests for the page/property readers — flattenProperty is the 18-branch switch behind every
// read_database/read_page output, so each branch is pinned here. Run with `bun test`.

import { expect, test } from "bun:test";

import { flattenProperty, type NotionPropertyValue, propertyToString, richTextToPlain, titleOf } from "./page";

const flat = (property: NotionPropertyValue) => flattenProperty(property).value;

test("richTextToPlain joins runs and tolerates non-arrays", () => {
  expect(richTextToPlain([{ plain_text: "Hello " }, { plain_text: "world" }])).toBe("Hello world");
  expect(richTextToPlain([])).toBe("");
  expect(richTextToPlain(undefined)).toBe("");
  expect(richTextToPlain("nope")).toBe("");
});

test("titleOf reads the title-type property, else (untitled)", () => {
  expect(titleOf({ properties: { Name: { type: "title", title: [{ plain_text: "Push day" }] } } })).toBe("Push day");
  expect(titleOf({ properties: { Status: { type: "status", status: { name: "Done" } } } })).toBe("(untitled)");
  expect(titleOf({})).toBe("(untitled)");
});

test("flattenProperty: text-like, number, boolean", () => {
  expect(flat({ type: "title", title: [{ plain_text: "Hi" }] })).toBe("Hi");
  expect(flat({ type: "rich_text", rich_text: [{ plain_text: "hi" }] })).toBe("hi");
  expect(flat({ type: "number", number: 42 })).toBe(42);
  expect(flat({ type: "number" })).toBeNull();
  expect(flat({ type: "checkbox", checkbox: true })).toBe(true);
  expect(flat({ type: "checkbox" })).toBe(false);
});

test("flattenProperty: select / status / multi_select", () => {
  expect(flat({ type: "select", select: { name: "Done" } })).toBe("Done");
  expect(flat({ type: "select", select: null })).toBeNull();
  expect(flat({ type: "status", status: { name: "In progress" } })).toBe("In progress");
  expect(flat({ type: "multi_select", multi_select: [{ name: "a" }, { name: "b" }] })).toBe("a, b");
  expect(flat({ type: "multi_select", multi_select: [] })).toBeNull();
});

test("flattenProperty: date (start, start→end, empty)", () => {
  expect(flat({ type: "date", date: { start: "2025-06-09" } })).toBe("2025-06-09");
  expect(flat({ type: "date", date: { start: "2025-06-09", end: "2025-06-11" } })).toBe("2025-06-09 → 2025-06-11");
  expect(flat({ type: "date", date: null })).toBeNull();
});

test("flattenProperty: people (name, id fallback, empty) + contact fields", () => {
  expect(flat({ type: "people", people: [{ name: "Ana" }, { id: "u2" }] })).toBe("Ana, u2");
  expect(flat({ type: "people", people: [] })).toBeNull();
  expect(flat({ type: "email", email: "a@b.com" })).toBe("a@b.com");
  expect(flat({ type: "phone_number", phone_number: "555" })).toBe("555");
  expect(flat({ type: "url", url: "https://x" })).toBe("https://x");
  expect(flat({ type: "files", files: [{ name: "doc.pdf" }] })).toBe("doc.pdf");
  expect(flat({ type: "files", files: [] })).toBeNull();
  expect(flat({ type: "created_time", created_time: "2025-01-01T00:00:00Z" })).toBe("2025-01-01T00:00:00Z");
  expect(flat({ type: "last_edited_time", last_edited_time: "2025-02-02T00:00:00Z" })).toBe("2025-02-02T00:00:00Z");
});

test("flattenProperty: relation returns ids (not a value) for later title resolution", () => {
  const result = flattenProperty({ type: "relation", relation: [{ id: "p1" }, { id: "p2" }] });
  expect(result.value).toBeNull();
  expect(result.relationIds).toEqual(["p1", "p2"]);
});

test("flattenProperty: rollup (number/date/array) and formula (number/date/string)", () => {
  expect(flat({ type: "rollup", rollup: { type: "number", number: 5 } })).toBe(5);
  expect(flat({ type: "rollup", rollup: { type: "date", date: { start: "2025-01-01" } } })).toBe("2025-01-01");
  expect(flat({ type: "rollup", rollup: { type: "array", array: [{}, {}] } })).toBe("[2 items]");
  expect(flat({ type: "rollup", rollup: { type: "incomplete" } })).toBeNull(); // unhandled rollup type → null
  expect(flat({ type: "formula", formula: { type: "number", number: 190 } })).toBe(190);
  expect(flat({ type: "formula", formula: { type: "date", date: { start: "2025-03-03" } } })).toBe("2025-03-03");
  expect(flat({ type: "formula", formula: { type: "string", string: "x" } })).toBe("x");
  expect(flat({ type: "formula", formula: {} })).toBeNull();
});

test("flattenProperty: unknown type → null", () => {
  expect(flat({ type: "some_future_type" })).toBeNull();
});

test("flattenProperty: unique_id with and without prefix", () => {
  expect(flat({ type: "unique_id", unique_id: { prefix: "TASK", number: 42 } })).toBe("TASK-42");
  expect(flat({ type: "unique_id", unique_id: { number: 7 } })).toBe("7");
  expect(flat({ type: "unique_id", unique_id: {} })).toBeNull();
});

test("flattenProperty: created_by and last_edited_by return user name", () => {
  expect(flat({ type: "created_by", created_by: { name: "Alice" } })).toBe("Alice");
  expect(flat({ type: "created_by", created_by: {} })).toBeNull();
  expect(flat({ type: "last_edited_by", last_edited_by: { name: "Bob" } })).toBe("Bob");
  expect(flat({ type: "last_edited_by", last_edited_by: {} })).toBeNull();
});

test("flattenProperty: relation with has_more sets truncated flag", () => {
  const withMore = flattenProperty({
    type: "relation",
    relation: [{ id: "p1" }, { id: "p2" }],
    has_more: true,
  });
  expect(withMore.value).toBeNull();
  expect(withMore.relationIds).toEqual(["p1", "p2"]);
  expect(withMore.truncated).toBe(true);

  const withoutMore = flattenProperty({ type: "relation", relation: [{ id: "p3" }] });
  expect(withoutMore.truncated).toBeUndefined();
});

test("propertyToString: covers unique_id, created_by, last_edited_by, rollup array, formula boolean", () => {
  expect(propertyToString({ type: "unique_id", unique_id: { prefix: "BUG", number: 1 } })).toBe("BUG-1");
  expect(propertyToString({ type: "unique_id", unique_id: { number: 5 } })).toBe("5");
  expect(propertyToString({ type: "created_by", created_by: { name: "Alice" } })).toBe("Alice");
  expect(propertyToString({ type: "last_edited_by", last_edited_by: { name: "Bob" } })).toBe("Bob");
  expect(propertyToString({ type: "rollup", rollup: { type: "array", array: [{}, {}] } })).toBe("2 item(s)");
  expect(propertyToString({ type: "formula", formula: { type: "boolean", boolean: true } })).toBe("☑");
  expect(propertyToString({ type: "formula", formula: { type: "boolean", boolean: false } })).toBe("☐");
});
