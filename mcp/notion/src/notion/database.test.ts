import { expect, test } from "bun:test";

import { dataSource } from "./data-source";
import { database } from "./database";

// Fixture mirrors the example from developers.notion.com/reference/database (the 2026 wrapper model).
// The database carries a `data_sources` pointer array; the column schema lives on the data source.
const databaseFixture = {
  object: "database",
  id: "48f8fee9-cd79-4180-bc2f-ec0398253bb7",
  created_time: "2022-03-01T19:05:00.000Z",
  last_edited_time: "2022-07-06T20:25:00.000Z",
  created_by: { object: "user", id: "ee5f0f84-409a-440f-983a-a5315961c6e4" },
  last_edited_by: { object: "user", id: "ee5f0f84-409a-440f-983a-a5315961c6e4" },
  icon: { type: "emoji", emoji: "🛒" },
  cover: null,
  title: [{ type: "text", text: { content: "Grocery List" }, plain_text: "Grocery List" }],
  description: [],
  parent: { type: "page_id", page_id: "59833787-2cf9-4fdf-8782-e53db20768a5" },
  is_inline: false,
  archived: false,
  in_trash: false,
  url: "https://www.notion.so/48f8fee9cd79418081dbd1ef79372b75",
  public_url: null,
  data_sources: [{ id: "248104cd-477e-80af-bc30-000bd28de8f9", name: "Grocery list" }],
};

// Fixture mirrors the data source object — holds the column schema (properties), title as a rich
// text array, and a parent that references its database_id.
const dataSourceFixture = {
  object: "data_source",
  id: "248104cd-477e-80af-bc30-000bd28de8f9",
  created_time: "2022-03-01T19:05:00.000Z",
  last_edited_time: "2022-07-06T20:25:00.000Z",
  created_by: { object: "user", id: "ee5f0f84-409a-440f-983a-a5315961c6e4" },
  last_edited_by: { object: "user", id: "ee5f0f84-409a-440f-983a-a5315961c6e4" },
  icon: { type: "emoji", emoji: "🛒" },
  title: [{ type: "text", text: { content: "Grocery list" }, plain_text: "Grocery list" }],
  description: [{ type: "text", text: { content: "Weekly groceries" }, plain_text: "Weekly groceries" }],
  parent: { type: "database_id", database_id: "48f8fee9-cd79-4180-bc2f-ec0398253bb7" },
  archived: false,
  in_trash: false,
  properties: {
    Name: {
      id: "title",
      name: "Name",
      type: "title",
      title: {},
    },
    Category: {
      id: "cat%3A",
      name: "Category",
      type: "select",
      select: {
        options: [
          { id: "a1", name: "Produce", color: "green" },
          { id: "a2", name: "Dairy", color: "yellow" },
        ],
      },
    },
  },
};

test("database parses the doc's example fixture (round-trip)", () => {
  expect(() => database.parse(databaseFixture)).not.toThrow();
});

test("database — data_sources[0].name is accessible after parse", () => {
  const parsed = database.parse(databaseFixture);
  expect(parsed.data_sources?.[0]?.name).toBe("Grocery list");
});

test("database — icon is parsed as emoji", () => {
  const parsed = database.parse(databaseFixture);
  expect(parsed.icon?.type).toBe("emoji");
});

test("database — parent is a page_id reference", () => {
  const parsed = database.parse(databaseFixture);
  expect(parsed.parent?.type).toBe("page_id");
});

test("database — minimal hand-authored proposal (no server metadata) is accepted", () => {
  expect(() => database.parse({})).not.toThrow();
});

test("database rejects a wrong `object` literal", () => {
  expect(() => database.parse({ object: "page" })).toThrow();
});

test("dataSource parses the doc's example fixture (round-trip)", () => {
  expect(() => dataSource.parse(dataSourceFixture)).not.toThrow();
});

test("dataSource — properties title column type is accessible after parse", () => {
  const parsed = dataSource.parse(dataSourceFixture);
  expect(parsed.properties.Name?.type).toBe("title");
});

test("dataSource — properties select column type is accessible after parse", () => {
  const parsed = dataSource.parse(dataSourceFixture);
  expect(parsed.properties.Category?.type).toBe("select");
});

test("dataSource — title rich text is accessible after parse", () => {
  const parsed = dataSource.parse(dataSourceFixture);
  const firstTitle = parsed.title?.[0];
  expect(firstTitle?.type).toBe("text");
  if (firstTitle?.type === "text") {
    expect(firstTitle.text.content).toBe("Grocery list");
  }
});

test("dataSource — parent database_id reference is accessible after parse", () => {
  const parsed = dataSource.parse(dataSourceFixture);
  expect(parsed.parent?.type).toBe("database_id");
  expect(parsed.parent?.database_id).toBe("48f8fee9-cd79-4180-bc2f-ec0398253bb7");
});

// Rejection: `properties` is the substantive payload and is required on a data source.
test("dataSource rejects an object missing the required `properties` field", () => {
  expect(() =>
    dataSource.parse({
      object: "data_source",
      id: "248104cd-477e-80af-bc30-000bd28de8f9",
      // `properties` intentionally omitted
    }),
  ).toThrow();
});

test("dataSource rejects a wrong `object` literal", () => {
  expect(() =>
    dataSource.parse({
      object: "database",
      properties: {},
    }),
  ).toThrow();
});
