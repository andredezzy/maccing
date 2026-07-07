import { expect, test } from "bun:test";
import { cover, icon } from "./file";
import { parentRef } from "./parent";
import { richText } from "./rich-text";
import { user } from "./user";

// richText — text variant

test("richText parses a real text rich-text object", () => {
  const fixture = {
    type: "text",
    text: { content: "Hello", link: null },
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default",
    },
    plain_text: "Hello",
    href: null,
  };
  const parsed = richText.parse(fixture);
  expect(parsed.plain_text).toBe("Hello");
  expect(parsed.type === "text" && parsed.text.content).toBe("Hello");
  expect(parsed.annotations?.bold).toBe(false);
});

// richText — equation variant

test("richText parses an equation rich-text object", () => {
  const fixture = {
    type: "equation",
    equation: { expression: "e = mc^2" },
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default",
    },
    plain_text: "e = mc^2",
    href: null,
  };
  expect(() => richText.parse(fixture)).not.toThrow();
});

// richText — mention variant (page mention)

test("richText parses a mention rich-text object", () => {
  const fixture = {
    type: "mention",
    mention: { type: "page", page: { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" } },
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default",
    },
    plain_text: "My page",
    href: "https://www.notion.so/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  };
  expect(() => richText.parse(fixture)).not.toThrow();
});

// richText — rejection

test("richText rejects a missing discriminant", () => {
  expect(() => richText.parse({ text: { content: "x" } })).toThrow();
});

// user — person variant

test("user parses a person user", () => {
  const fixture = {
    object: "user",
    id: "d40e767c-d7af-4b18-a86d-55c61f1e39a4",
    type: "person",
    name: "Notion User",
    avatar_url: "https://example.com/avatar.png",
    person: { email: "user@example.com" },
  };
  expect(() => user.parse(fixture)).not.toThrow();
});

// user — bot variant

test("user parses a bot user", () => {
  const fixture = {
    object: "user",
    id: "9188c6a5-7381-452f-b3d9-c43438b13a17",
    type: "bot",
    name: "My Integration",
    avatar_url: null,
    bot: {
      owner: { type: "workspace", workspace: true },
      workspace_name: "Ada Lovelace's Notion",
    },
  };
  expect(() => user.parse(fixture)).not.toThrow();
});

// parentRef — page parent

test("parentRef parses a page parent", () => {
  expect(() => parentRef.parse({ type: "page_id", page_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" })).not.toThrow();
});

// parentRef — database parent

test("parentRef parses a database parent", () => {
  expect(() =>
    parentRef.parse({ type: "database_id", database_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }),
  ).not.toThrow();
});

// parentRef — workspace parent

test("parentRef parses a workspace parent", () => {
  expect(() => parentRef.parse({ type: "workspace", workspace: true })).not.toThrow();
});

// parentRef — data_source parent (carries both ids)

test("parentRef parses a data_source parent (carries both ids)", () => {
  const parsed = parentRef.parse({ type: "data_source_id", data_source_id: "ds-id", database_id: "db-id" });
  expect(parsed.data_source_id).toBe("ds-id");
  expect(parsed.database_id).toBe("db-id");
});

// parentRef — agent parent

test("parentRef parses an agent parent", () => {
  expect(() => parentRef.parse({ type: "agent_id", agent_id: "agent-id" })).not.toThrow();
});

// parentRef — loose by design: accepts a partial ref (it serves the defensive parentLabel during the
// AGENTS.md climb), but still type-checks the fields it does carry.

test("parentRef accepts a partial ref but rejects a wrong-typed field", () => {
  expect(() => parentRef.parse({ type: "page_id" })).not.toThrow(); // id may be absent for a defensive consumer
  expect(() => parentRef.parse({})).not.toThrow(); // an empty ref is tolerated, not rejected
  expect(() => parentRef.parse({ type: "workspace", workspace: "yes" })).toThrow(); // workspace must be a boolean
});

// icon — emoji

test("icon parses an emoji icon", () => {
  const parsed = icon.parse({ type: "emoji", emoji: "💡" });
  expect(parsed.type === "emoji" && parsed.emoji).toBe("💡");
});

// icon — native Notion icon (built-in icon set)

test("icon parses a native Notion icon", () => {
  const parsed = icon.parse({ type: "icon", icon: { name: "chart-mixed", color: "gray" } });
  expect(parsed.type === "icon" && parsed.icon.name).toBe("chart-mixed");
});

// icon — external file

test("icon parses an external file icon", () => {
  expect(() => icon.parse({ type: "external", external: { url: "https://example.com/icon.png" } })).not.toThrow();
});

// icon — notion-hosted file

test("icon parses a notion-hosted file icon", () => {
  expect(() =>
    icon.parse({
      type: "file",
      file: {
        url: "https://s3.us-west-2.amazonaws.com/example.png",
        expiry_time: "2025-04-24T22:49:22.765Z",
      },
    }),
  ).not.toThrow();
});

// cover — external file

test("cover parses an external file cover", () => {
  expect(() => cover.parse({ type: "external", external: { url: "https://example.com/cover.jpg" } })).not.toThrow();
});

// cover — rejection (no type)

test("cover rejects a missing type", () => {
  expect(() => cover.parse({ external: { url: "https://example.com/cover.jpg" } })).toThrow();
});
