// Tests for renderPropertyValue — the database-cell display formatter. Fixtures use canonical official
// PropertyValue shapes; this matrix pins one assertion per value type (including the relation count case).

import { expect, test } from "bun:test";
import { renderPropertyValue } from "./property-value";

test("renderPropertyValue: title and rich_text", () => {
  expect(
    renderPropertyValue({ type: "title", title: [{ type: "text", text: { content: "Hi" }, plain_text: "Hi" }] }),
  ).toBe("Hi");
  expect(
    renderPropertyValue({
      type: "rich_text",
      rich_text: [{ type: "text", text: { content: "hi" }, plain_text: "hi" }],
    }),
  ).toBe("hi");
});

test("renderPropertyValue: number, select, status, multi_select, checkbox", () => {
  expect(renderPropertyValue({ type: "number", number: 42 })).toBe("42");
  expect(renderPropertyValue({ type: "number", number: null })).toBe("");
  expect(renderPropertyValue({ type: "select", select: { name: "Done", color: "green" } })).toBe("Done");
  expect(renderPropertyValue({ type: "select", select: null })).toBe("");
  expect(renderPropertyValue({ type: "status", status: { name: "In progress", color: "blue" } })).toBe("In progress");
  expect(renderPropertyValue({ type: "status", status: null })).toBe("");
  expect(renderPropertyValue({ type: "multi_select", multi_select: [{ name: "a" }, { name: "b" }] })).toBe("a, b");
  expect(renderPropertyValue({ type: "checkbox", checkbox: true })).toBe("☑");
  expect(renderPropertyValue({ type: "checkbox", checkbox: false })).toBe("☐");
});

test("renderPropertyValue: date (plain, range, null)", () => {
  expect(renderPropertyValue({ type: "date", date: { start: "2025-06-09" } })).toBe("2025-06-09");
  expect(renderPropertyValue({ type: "date", date: { start: "2025-06-09", end: "2025-06-11" } })).toBe(
    "2025-06-09 → 2025-06-11",
  );
  expect(renderPropertyValue({ type: "date", date: null })).toBe("");
});

test("renderPropertyValue: people, url, email, phone_number", () => {
  expect(
    renderPropertyValue({
      type: "people",
      people: [
        { object: "user", id: "u1", type: "person", name: "Ana" },
        { object: "user", id: "u2", type: "person", name: "Bo" },
      ],
    }),
  ).toBe("Ana, Bo");
  expect(renderPropertyValue({ type: "url", url: "https://x" })).toBe("https://x");
  expect(renderPropertyValue({ type: "url", url: null })).toBe("");
  expect(renderPropertyValue({ type: "email", email: "a@b.com" })).toBe("a@b.com");
  expect(renderPropertyValue({ type: "email", email: null })).toBe("");
  expect(renderPropertyValue({ type: "phone_number", phone_number: "555" })).toBe("555");
  expect(renderPropertyValue({ type: "phone_number", phone_number: null })).toBe("");
});

test("renderPropertyValue: files", () => {
  expect(
    renderPropertyValue({
      type: "files",
      files: [{ type: "external", name: "doc.pdf", external: { url: "https://example.com/doc.pdf" } }],
    }),
  ).toBe("doc.pdf");
});

test("renderPropertyValue: created_time, last_edited_time, created_by, last_edited_by", () => {
  expect(renderPropertyValue({ type: "created_time", created_time: "2025-01-01T00:00:00Z" })).toBe(
    "2025-01-01T00:00:00Z",
  );
  expect(renderPropertyValue({ type: "last_edited_time", last_edited_time: "2025-02-02T00:00:00Z" })).toBe(
    "2025-02-02T00:00:00Z",
  );
  expect(renderPropertyValue({ type: "created_by", created_by: { object: "user", id: "u1", name: "Alice" } })).toBe(
    "Alice",
  );
  expect(renderPropertyValue({ type: "created_by", created_by: { object: "user", id: "u1" } })).toBe("");
  expect(
    renderPropertyValue({ type: "last_edited_by", last_edited_by: { object: "user", id: "u2", name: "Bob" } }),
  ).toBe("Bob");
  expect(renderPropertyValue({ type: "last_edited_by", last_edited_by: { object: "user", id: "u2" } })).toBe("");
});

test("renderPropertyValue: unique_id (with prefix, no prefix)", () => {
  expect(renderPropertyValue({ type: "unique_id", unique_id: { prefix: "TASK", number: 42 } })).toBe("TASK-42");
  expect(renderPropertyValue({ type: "unique_id", unique_id: { number: 7 } })).toBe("7");
});

test("renderPropertyValue: rollup (number, array)", () => {
  expect(renderPropertyValue({ type: "rollup", rollup: { type: "number", number: 5 } })).toBe("5");
  expect(renderPropertyValue({ type: "rollup", rollup: { type: "array", array: [{}, {}] } })).toBe("2 item(s)");
});

test("renderPropertyValue: formula (number, boolean, string, date)", () => {
  expect(renderPropertyValue({ type: "formula", formula: { type: "number", number: 190 } })).toBe("190");
  expect(renderPropertyValue({ type: "formula", formula: { type: "boolean", boolean: true } })).toBe("☑");
  expect(renderPropertyValue({ type: "formula", formula: { type: "boolean", boolean: false } })).toBe("☐");
  expect(renderPropertyValue({ type: "formula", formula: { type: "string", string: "hello" } })).toBe("hello");
  expect(renderPropertyValue({ type: "formula", formula: { type: "date", date: { start: "2025-06-09" } } })).toBe(
    "2025-06-09",
  );
  expect(
    renderPropertyValue({
      type: "formula",
      formula: { type: "date", date: { start: "2025-06-09", end: "2025-06-11" } },
    }),
  ).toBe("2025-06-09 → 2025-06-11");
});

test("renderPropertyValue: relation — count or empty string", () => {
  expect(renderPropertyValue({ type: "relation", relation: [{ id: "p1" }, { id: "p2" }] })).toBe("2 linked");
  expect(renderPropertyValue({ type: "relation", relation: [{ id: "p1" }] })).toBe("1 linked");
  expect(renderPropertyValue({ type: "relation", relation: [] })).toBe("");
});

test("renderPropertyValue: verification, button, and unknown types all return empty string", () => {
  // verification, button — future/newer Notion property types not handled in propertyToString's switch;
  // they fall to the default branch which returns "". Cast to exercise the runtime default branch.
  expect(
    renderPropertyValue({ type: "verification", verification: { state: "verified" } } as unknown as Parameters<
      typeof renderPropertyValue
    >[0]),
  ).toBe("");
  expect(
    renderPropertyValue({ type: "button", button: {} } as unknown as Parameters<typeof renderPropertyValue>[0]),
  ).toBe("");
  // An unknown future type also falls to default
  expect(
    renderPropertyValue({ type: "some_future_type" } as unknown as Parameters<typeof renderPropertyValue>[0]),
  ).toBe("");
});
