// Unit tests for the render_mockup tool handler — pure (no Notion API). Run with `bun test`.

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

test("render_mockup renders a page block (chrome + body)", async () => {
  const { text, isError } = await run({ type: "page", title: "P", children: [{ type: "paragraph", text: "hi" }] });
  expect(isError).toBe(false);
  expect(text).toContain("P");
  expect(text).toContain("hi");
});

test("render_mockup renders a bare array of blocks", async () => {
  const { text } = await run([{ type: "callout", icon: "💡", lines: ["x"] }]);
  expect(text).toContain("💡");
});

test("render_mockup returns an error on input that matches no block shape", async () => {
  const { isError } = await run({ type: "nonsense_block" });
  expect(isError).toBe(true); // zod parse throws → err()
});

test("render_mockup accepts a database whose views include a dashboard (wire schema mirrors the ViewBlock type)", async () => {
  const { isError } = await run({
    type: "database",
    database: {
      title: "Ops",
      views: [
        {
          type: "dashboard",
          name: "Overview",
          widgets: [
            { title: "Volume", view: { type: "chart", name: "V", chartType: "bar", data: [{ label: "A", value: 1 }] } },
          ],
        },
      ],
    },
  });
  expect(isError).toBe(false); // dashboard is a valid ViewBlock — the zod viewBlock union must include it
});
