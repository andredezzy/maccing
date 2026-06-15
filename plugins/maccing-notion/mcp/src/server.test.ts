// Integration tests: a real Client ↔ McpServer round-trip over InMemoryTransport — the SDK-idiomatic
// way to exercise tools/list and tools/call without spawning a subprocess. Plus unit tests for the
// secret-scrubbing middleware. Run with `bun test`.

import { expect, test } from "bun:test";

import { Client } from "#sdk/client/index";
import { InMemoryTransport } from "#sdk/inMemory";
import { McpServer } from "#sdk/server/mcp";
import { redact, withRedact } from "./notion/redact";
import { TOOLS } from "./server";
import { ok } from "./tool";

async function connectClient(): Promise<Client> {
  const server = new McpServer({ name: "notion-test", version: "0.0.0" });
  for (const tool of TOOLS) {
    server.registerTool(tool.name, tool.config, withRedact(tool.handler));
  }

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

test("tools/list exposes exactly the snake_case Notion tools", async () => {
  const client = await connectClient();
  const { tools } = await client.listTools();
  expect(tools.map((tool) => tool.name).sort()).toEqual([
    "describe",
    "order_properties",
    "private_request",
    "read_agents_md",
    "read_database",
    "read_page",
    "render_blocks",
    "render_database",
    "render_page",
    "request",
    "search",
    "upsert_property",
  ]);
});

test("every tool advertises a description and an object inputSchema", async () => {
  const client = await connectClient();
  const { tools } = await client.listTools();
  for (const tool of tools) {
    expect(typeof tool.description).toBe("string");
    expect(tool.inputSchema.type).toBe("object");
  }
});

test("annotations pass through — private + icon tools are flagged destructive, all open-world", async () => {
  const client = await connectClient();
  const { tools } = await client.listTools();
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  expect(byName.get("request")?.annotations?.openWorldHint).toBe(true);
  expect(byName.get("private_request")?.annotations?.destructiveHint).toBe(true);
  expect(byName.get("upsert_property")?.annotations?.destructiveHint).toBe(true);
});

test("invalid arguments are rejected without crashing the server", async () => {
  const client = await connectClient();
  // Missing required `method`/`path` → SDK input validation returns an error (or rejects); either is fine.
  const result = await client.callTool({ name: "request", arguments: {} }).catch(() => ({ isError: true }));
  expect(result.isError).toBe(true);
});

test("a malformed target_id yields a graceful error result, not a throw", async () => {
  const client = await connectClient();
  const result = await client.callTool({
    name: "upsert_property",
    arguments: { properties: [{ target_id: "not-a-uuid", property: "Status", icon: "cash" }] },
  });
  expect(result.isError).toBe(true);
});

test("redact replaces known secret values and passes clean text through", () => {
  expect(redact("nothing secret here")).toBe("nothing secret here");

  const token = process.env.NOTION_TOKEN;
  if (token && token.length >= 8) {
    expect(redact(`leak:${token}:end`)).toBe("leak:[REDACTED]:end");
  }
});

test("withRedact scrubs a secret a handler tries to return", async () => {
  const token = process.env.NOTION_TOKEN;
  if (!token || token.length < 8) {
    return;
  }

  const leaky = withRedact(async () => ok(`token=${token}`));
  const result = await leaky({});
  const text = (result.content[0] as { text: string }).text;

  expect(text).toContain("[REDACTED]");
  expect(text).not.toContain(token);
});

test("withRedact turns a thrown handler error into a graceful redacted error result", async () => {
  const throwing = withRedact(async () => {
    throw new Error("boom");
  });
  const result = await throwing({});

  expect(result.isError).toBe(true);
  expect((result.content[0] as { text: string }).text).toContain("boom");
});
