import { expect, test } from "bun:test";
import { page } from "./page";

// Fixture mirrors the example from developers.notion.com/reference/page (tokens redacted).
// This is a database-child page with a title property and an emoji icon.
const fixture = {
  object: "page",
  id: "b55c9c91-384d-452b-81db-d1ef79372b75",
  created_time: "2022-03-01T19:05:00.000Z",
  last_edited_time: "2022-07-06T20:25:00.000Z",
  created_by: {
    object: "user",
    id: "ee5f0f84-409a-440f-983a-a5315961c6e4",
  },
  last_edited_by: {
    object: "user",
    id: "ee5f0f84-409a-440f-983a-a5315961c6e4",
  },
  cover: {
    type: "external",
    external: {
      url: "https://upload.wikimedia.org/wikipedia/commons/6/62/Tuscankale.jpg",
    },
  },
  icon: {
    type: "emoji",
    emoji: "🥬",
  },
  parent: {
    type: "database_id",
    database_id: "48f8fee9-cd79-4180-bc2f-ec0398253bb7",
  },
  archived: false,
  in_trash: false,
  properties: {
    Recipes: {
      id: "title",
      type: "title",
      title: [
        {
          type: "text",
          text: { content: "Tuscan Kale" },
          plain_text: "Tuscan Kale",
        },
      ],
    },
  },
  url: "https://www.notion.so/Tuscan-Kale-b55c9c91384d452b81dbd1ef79372b75",
  public_url: null,
};

test("page parses the doc's example fixture (round-trip)", () => {
  expect(() => page.parse(fixture)).not.toThrow();
});

test("page — title property value is accessible after parse", () => {
  const parsed = page.parse(fixture);
  const title = parsed.properties.Recipes;
  // Narrow to title type to access the title array.
  expect(title.type).toBe("title");
  if (title.type === "title") {
    expect(title.title[0]?.plain_text).toBe("Tuscan Kale");
  }
});

test("page — icon is parsed as emoji", () => {
  const parsed = page.parse(fixture);
  expect(parsed.icon?.type).toBe("emoji");
  if (parsed.icon?.type === "emoji") {
    expect(parsed.icon.emoji).toBe("🥬");
  }
});

test("page — cover is parsed as external file", () => {
  const parsed = page.parse(fixture);
  expect(parsed.cover?.type).toBe("external");
});

test("page — parent database_id is accessible after parse", () => {
  const parsed = page.parse(fixture);
  expect(parsed.parent?.type).toBe("database_id");
  expect(parsed.parent?.database_id).toBe("48f8fee9-cd79-4180-bc2f-ec0398253bb7");
});

// Rejection: `properties` is required — a page with no properties field at all should throw.
test("page rejects an object missing the required `properties` field", () => {
  expect(() =>
    page.parse({
      object: "page",
      id: "b55c9c91-384d-452b-81db-d1ef79372b75",
      // `properties` intentionally omitted
    }),
  ).toThrow();
});

// Rejection: `object` discriminant must be "page" when present.
test("page rejects a wrong `object` literal", () => {
  expect(() =>
    page.parse({
      object: "database",
      properties: {},
    }),
  ).toThrow();
});

// Edge case: a minimal hand-authored proposal (no server metadata) with an empty properties map.
test("page accepts a minimal hand-authored proposal with empty properties", () => {
  expect(() => page.parse({ properties: {} })).not.toThrow();
});
