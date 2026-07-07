// Unit tests for the render_mockup tool handler — pure (no Notion API). Run with `bun test`.
// All fixtures use official Notion API shapes (rich-text items require `type: "text"`).

import { expect, test } from "bun:test";

import { renderMockup } from "./render-mockup";

interface RunResult {
  text: string;
  isError: boolean;
}

async function run(mockup: unknown): Promise<RunResult> {
  const result = await renderMockup.handler({ mockup });
  return { text: (result.content[0] as { text: string }).text, isError: result.isError ?? false };
}

// Official-shape rich-text item.
const rt = (content: string) => ({ type: "text", plain_text: content, text: { content } });

test("render_mockup renders a PageRender (official shape: page + blocks)", async () => {
  const { text, isError } = await run({
    page: {
      properties: { Name: { type: "title", title: [rt("P")] } },
    },
    blocks: [{ type: "paragraph", paragraph: { rich_text: [rt("hi")] } }],
  });
  expect(isError).toBe(false);
  expect(text).toContain("P");
  expect(text).toContain("hi");
});

test("render_mockup renders a bare array of BlockObjects", async () => {
  const { text, isError } = await run([
    {
      type: "callout",
      callout: {
        rich_text: [rt("note")],
        icon: { type: "emoji", emoji: "💡" },
      },
    },
  ]);
  expect(isError).toBe(false);
  expect(text).toContain("💡");
});

test("render_mockup renders a DatabaseRender (official bundle)", async () => {
  const { text, isError } = await run({
    database: {
      title: [rt("Tasks")],
    },
    dataSource: {
      properties: {
        Name: { id: "name", name: "Name", type: "title", title: {} },
        Status: { id: "status", name: "Status", type: "rich_text", rich_text: {} },
      },
    },
    views: [
      {
        name: "All",
        type: "table",
        configuration: {
          properties: [{ property_id: "name" }, { property_id: "status" }],
        },
      },
    ],
    rows: [
      {
        properties: {
          Name: { type: "title", title: [rt("Ship it")] },
          Status: { type: "rich_text", rich_text: [rt("Done")] },
        },
      },
    ],
  });
  expect(isError).toBe(false);
  expect(text).toContain("Tasks");
  expect(text).toContain("Ship it");
});

test("render_mockup returns isError on input that matches no valid shape", async () => {
  const { isError } = await run({ type: "bogus_block_type_xyz" });
  expect(isError).toBe(true); // zod parse throws → err()
});

test("render_mockup rejects old compact {type:'table', columns, rows} shape", async () => {
  const { isError } = await run({
    type: "table",
    columns: ["Name"],
    rows: [["Alice"]],
  });
  expect(isError).toBe(true); // old compact simplified shape is not a valid block or DatabaseRender
});

test("render_mockup errors when no input shape/id is provided", async () => {
  const result = await renderMockup.handler({});
  expect(result.isError ?? false).toBe(true);
  expect((result.content[0] as { text: string }).text).toContain("Provide exactly one");
});

test("render_mockup rejects a non-UUID page_id / database_id (live paths)", async () => {
  const page = await renderMockup.handler({ page_id: "not-a-uuid" });
  expect(page.isError ?? false).toBe(true);
  expect((page.content[0] as { text: string }).text).toMatch(/NOTION_TOKEN is not set|must be a UUID/);

  const db = await renderMockup.handler({ database_id: "also-not-a-uuid" });
  expect(db.isError ?? false).toBe(true);
  expect((db.content[0] as { text: string }).text).toMatch(/NOTION_TOKEN is not set|must be a UUID/);
});
