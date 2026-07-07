import { expect, test } from "bun:test";

import { queryResult } from "./query";
import { view } from "./view";

// Board view fixture — mirrors the shape returned by GET /v1/views/{id}.
// `sorts`, `filter`, and `quick_filters` are top-level (readers/views.ts RawView confirms this);
// `configuration` carries the remaining view-specific config blob.
const boardViewFixture = {
  object: "view",
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  name: "Sprint Board",
  type: "board",
  url: "https://www.notion.so/view/a1b2c3d4e5f67890abcdef1234567890",
  parent: { database_id: "48f8fee9-cd79-4180-bc2f-ec0398253bb7" },
  data_source_id: "248104cd-477e-80af-bc30-000bd28de8f9",
  sorts: [{ property: "status", direction: "ascending" }],
  filter: null,
  quick_filters: {},
  configuration: {
    properties: [
      { property_id: "title", visible: true },
      { property_id: "status", visible: true, width: 200 },
      { property_id: "assignee", visible: false },
    ],
    group_by: { property_id: "status" },
  },
};

// Minimal view — only the required fields.
const minimalViewFixture = {
  name: "Table view",
  type: "table",
};

// queryResult fixture — mirrors POST /v1/data_sources/{id}/query response (paginated page list).
const queryResultFixture = {
  object: "list",
  type: "data_source_rows",
  results: [
    {
      object: "page",
      id: "b55c9c91-384d-452b-81db-d1ef79372b75",
      properties: {
        Name: {
          id: "title",
          type: "title",
          title: [
            {
              type: "text",
              text: { content: "Task Alpha" },
              plain_text: "Task Alpha",
            },
          ],
        },
      },
    },
  ],
  has_more: false,
  next_cursor: null,
};

// view tests

test("view parses a board view fixture (round-trip)", () => {
  expect(() => view.parse(boardViewFixture)).not.toThrow();
});

test("view — type is accessible after parse", () => {
  const parsed = view.parse(boardViewFixture);
  // `type` is the discriminant; board views should come through as "board".
  expect(parsed.type).toBe("board");
});

test("view — configuration.properties are accessible after parse", () => {
  const parsed = view.parse(boardViewFixture);
  expect(parsed.configuration?.properties?.[0]?.property_id).toBe("title");
  expect(parsed.configuration?.properties?.[1]?.width).toBe(200);
});

test("view — top-level sorts array is preserved", () => {
  const parsed = view.parse(boardViewFixture);
  expect(Array.isArray(parsed.sorts)).toBe(true);
  expect(parsed.sorts?.[0]).toMatchObject({ property: "status" });
});

test("view accepts a minimal fixture (only name + type required)", () => {
  expect(() => view.parse(minimalViewFixture)).not.toThrow();
});

test("view — all 11 official types are accepted", () => {
  const types = [
    "table",
    "board",
    "gallery",
    "list",
    "calendar",
    "timeline",
    "chart",
    "form",
    "map",
    "dashboard",
    "feed",
  ];
  for (const type of types) {
    expect(() => view.parse({ name: "test", type })).not.toThrow();
  }
});

// Rejection: `type` is required — the discriminant must be present.
test("view rejects an object missing the required `type` field", () => {
  expect(() => view.parse({ name: "Nameless" })).toThrow();
});

// Rejection: `name` is required — a view must have a label.
test("view rejects an object missing the required `name` field", () => {
  expect(() => view.parse({ type: "table" })).toThrow();
});

// Rejection: unknown view type should not be accepted.
test("view rejects an unknown type string", () => {
  expect(() => view.parse({ name: "Bad", type: "kanban" })).toThrow();
});

// queryResult tests

test("queryResult parses the query response fixture (round-trip)", () => {
  expect(() => queryResult.parse(queryResultFixture)).not.toThrow();
});

test("queryResult — results[0] title property is accessible after parse", () => {
  const parsed = queryResult.parse(queryResultFixture);
  const firstRow = parsed.results[0];
  const nameProperty = firstRow?.properties.Name;
  // Narrow to title type.
  expect(nameProperty?.type).toBe("title");
  if (nameProperty?.type === "title") {
    expect(nameProperty.title[0]?.plain_text).toBe("Task Alpha");
  }
});

test("queryResult — has_more is false", () => {
  const parsed = queryResult.parse(queryResultFixture);
  expect(parsed.has_more).toBe(false);
});

test("queryResult — next_cursor null is preserved", () => {
  const parsed = queryResult.parse(queryResultFixture);
  expect(parsed.next_cursor).toBeNull();
});

// Rejection: results must contain valid page objects — a non-page should throw.
test("queryResult rejects results containing a non-page object", () => {
  expect(() =>
    queryResult.parse({
      results: [
        {
          // Not a valid page: it has the wrong object literal and no required `properties` map.
          object: "database",
          id: "bad-id",
        },
      ],
    }),
  ).toThrow();
});

// Edge case: empty results array is valid (no rows in view).
test("queryResult accepts an empty results array", () => {
  expect(() => queryResult.parse({ results: [] })).not.toThrow();
});
