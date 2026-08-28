import { expect, test } from "bun:test";
import { get as httpGet } from "node:http";

import { Client } from "#sdk/client/index";
import { StreamableHTTPClientTransport } from "#sdk/client/streamableHttp";
import { startHttpServer } from "./http-server";

const EXPECTED_TOOLS = [
  "describe",
  "order_properties",
  "private_request",
  "read_agents_md",
  "read_database",
  "read_page",
  "request",
  "search",
  "upsert_property",
];

test("HTTP transport binds to loopback and serves independent MCP sessions", async () => {
  const server = startHttpServer({ port: 0 });
  const endpoint = new URL(`http://127.0.0.1:${server.port}/mcp`);
  const clients = [
    new Client({ name: "http-test-a", version: "0.0.0" }),
    new Client({ name: "http-test-b", version: "0.0.0" }),
  ];

  try {
    expect(server.hostname).toBe("127.0.0.1");

    const health = await fetch(`http://127.0.0.1:${server.port}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.text()).toBe("ok");

    await Promise.all(
      clients.map((client) => client.connect(new StreamableHTTPClientTransport(endpoint))),
    );

    const toolLists = await Promise.all(clients.map((client) => client.listTools()));
    for (const { tools } of toolLists) {
      expect(tools.map((tool) => tool.name).sort()).toEqual(EXPECTED_TOOLS);
    }
  } finally {
    await Promise.allSettled(clients.map((client) => client.close()));
    await server.stop(true);
  }
});

test(
  "HTTP transport keeps its standalone SSE stream open past Bun's idle timeout",
  async () => {
    const server = startHttpServer({ port: 0 });
    const client = new Client({ name: "http-sse-test", version: "0.0.0" });
    const endpoint = new URL(`http://127.0.0.1:${server.port}/mcp`);
    const transport = new StreamableHTTPClientTransport(endpoint);
    let request: ReturnType<typeof httpGet> | undefined;

    try {
      await client.connect(transport);
      const sessionId = transport.sessionId;
      expect(sessionId).toBeTruthy();
      await client.close();
      await Bun.sleep(25);

      let connectionReset = false;
      request = httpGet(endpoint, {
        agent: false,
        headers: {
          Accept: "text/event-stream",
          "mcp-session-id": sessionId!,
          "mcp-protocol-version": "2025-11-25",
        },
      });
      request.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "ECONNRESET") {
          connectionReset = true;
        }
      });

      await Bun.sleep(12_000);

      expect(connectionReset).toBe(false);
    } finally {
      request?.destroy();
      await server.stop(true);
    }
  },
  20_000,
);
