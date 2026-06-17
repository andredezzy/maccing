import { expect, test } from "bun:test";
import { propertyValue } from "./property-value";

const cases: unknown[] = [
  // title
  {
    id: "a",
    type: "title",
    title: [{ type: "text", text: { content: "Hi" }, plain_text: "Hi" }],
  },
  // rich_text
  {
    id: "b",
    type: "rich_text",
    rich_text: [{ type: "text", text: { content: "Note" }, plain_text: "Note" }],
  },
  // number
  { id: "c", type: "number", number: 42 },
  // number null
  { id: "c2", type: "number", number: null },
  // select
  { id: "d", type: "select", select: { id: "s", name: "Done", color: "green" } },
  // select null
  { id: "d2", type: "select", select: null },
  // status
  { id: "e", type: "status", status: { id: "st", name: "In progress", color: "blue" } },
  // status null
  { id: "e2", type: "status", status: null },
  // multi_select
  {
    id: "f",
    type: "multi_select",
    multi_select: [
      { id: "o1", name: "Tag A", color: "red" },
      { id: "o2", name: "Tag B", color: "blue" },
    ],
  },
  // date
  { id: "g", type: "date", date: { start: "2025-06-09", end: null } },
  // date null
  { id: "g2", type: "date", date: null },
  // date with time_zone
  { id: "g3", type: "date", date: { start: "2025-06-09", end: "2025-06-10", time_zone: "America/New_York" } },
  // people
  {
    id: "h",
    type: "people",
    people: [{ object: "user", id: "u1", type: "person", name: "Ana" }],
  },
  // files
  {
    id: "i",
    type: "files",
    files: [{ name: "doc.pdf", type: "external", external: { url: "https://example.com/doc.pdf" } }],
  },
  // checkbox
  { id: "j", type: "checkbox", checkbox: true },
  // url
  { id: "k", type: "url", url: "https://notion.so" },
  // url null
  { id: "k2", type: "url", url: null },
  // email
  { id: "l", type: "email", email: "user@example.com" },
  // email null
  { id: "l2", type: "email", email: null },
  // phone_number
  { id: "m", type: "phone_number", phone_number: "+1-800-555-0100" },
  // phone_number null
  { id: "m2", type: "phone_number", phone_number: null },
  // formula — string
  { id: "n", type: "formula", formula: { type: "string", string: "hello" } },
  // formula — number
  { id: "n2", type: "formula", formula: { type: "number", number: 3.14 } },
  // formula — boolean
  { id: "n3", type: "formula", formula: { type: "boolean", boolean: true } },
  // formula — date
  { id: "n4", type: "formula", formula: { type: "date", date: { start: "2025-01-01", end: null } } },
  // relation
  { id: "o", type: "relation", relation: [{ id: "p1" }], has_more: false },
  // rollup — number
  { id: "p", type: "rollup", rollup: { type: "number", number: 5, function: "count" } },
  // rollup — date
  {
    id: "p2",
    type: "rollup",
    rollup: { type: "date", date: { start: "2025-01-01", end: null }, function: "earliest_date" },
  },
  // rollup — array
  { id: "p3", type: "rollup", rollup: { type: "array", array: [], function: "show_original" } },
  // created_time
  { id: "q", type: "created_time", created_time: "2024-01-01T00:00:00.000Z" },
  // created_by
  { id: "r", type: "created_by", created_by: { object: "user", id: "u", name: "Ana" } },
  // last_edited_time
  { id: "s", type: "last_edited_time", last_edited_time: "2024-06-01T12:00:00.000Z" },
  // last_edited_by
  { id: "t", type: "last_edited_by", last_edited_by: { object: "user", id: "u2", name: "Bob" } },
  // unique_id
  { id: "u", type: "unique_id", unique_id: { prefix: "TASK", number: 42 } },
  // unique_id — null prefix
  { id: "u2", type: "unique_id", unique_id: { prefix: null, number: 7 } },
  // verification — verified
  {
    id: "v",
    type: "verification",
    verification: {
      state: "verified",
      verified_by: { object: "user", id: "u3", name: "Ana" },
      date: { start: "2025-06-01", end: null },
    },
  },
  // verification null
  { id: "v2", type: "verification", verification: null },
  // button
  { id: "w", type: "button", button: {} },
];

test("propertyValue parses every documented value type", () => {
  for (const fixture of cases) {
    expect(() => propertyValue.parse(fixture), JSON.stringify(fixture)).not.toThrow();
  }
});

test("propertyValue rejects number field with a string value", () => {
  expect(() => propertyValue.parse({ type: "number", number: "not-a-number" })).toThrow();
});

test("propertyValue rejects checkbox field with null", () => {
  expect(() => propertyValue.parse({ type: "checkbox", checkbox: null })).toThrow();
});

test("propertyValue rejects title field with a string instead of array", () => {
  expect(() => propertyValue.parse({ type: "title", title: "not-an-array" })).toThrow();
});

test("propertyValue rejects date payload missing required start", () => {
  expect(() => propertyValue.parse({ type: "date", date: { end: "2025-01-01" } })).toThrow();
});

test("propertyValue surfaces the discriminated payload — number", () => {
  const parsed = propertyValue.parse({ type: "number", number: 7 });
  expect(parsed.type === "number" && parsed.number).toBe(7);
});

test("propertyValue surfaces the discriminated payload — select name", () => {
  const parsed = propertyValue.parse({ type: "select", select: { name: "Done", color: "green" } });
  expect(parsed.type === "select" && parsed.select?.name).toBe("Done");
});

test("propertyValue surfaces the discriminated payload — unique_id", () => {
  const parsed = propertyValue.parse({ type: "unique_id", unique_id: { prefix: "TASK", number: 10 } });
  expect(parsed.type === "unique_id" && parsed.unique_id.prefix).toBe("TASK");
  expect(parsed.type === "unique_id" && parsed.unique_id.number).toBe(10);
});

test("propertyValue surfaces the discriminated payload — relation ids + has_more", () => {
  const parsed = propertyValue.parse({ type: "relation", relation: [{ id: "abc" }], has_more: true });
  expect(parsed.type === "relation" && parsed.relation[0].id).toBe("abc");
  expect(parsed.type === "relation" && parsed.has_more).toBe(true);
});

test("propertyValue rejects an unknown type", () => {
  expect(() => propertyValue.parse({ type: "bogus" })).toThrow();
});

test("propertyValue rejects a missing type field", () => {
  expect(() => propertyValue.parse({ number: 42 })).toThrow();
});
