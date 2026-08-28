import { isInitializeRequest } from "#sdk/types";
import { WebStandardStreamableHTTPServerTransport } from "#sdk/server/webStandardStreamableHttp";
import type { McpServer } from "#sdk/server/mcp";
import { VERSION } from "./notion/public-client";
import { assertNotionConfiguration, createMcpServer, TOOLS } from "./server";

type Session = {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
};

export type NotionHttpServer = {
  hostname: string;
  port: number;
  stop(closeActiveConnections?: boolean): Promise<void>;
};

export function startHttpServer({ port = 8765 }: { port?: number } = {}): NotionHttpServer {
  const sessions = new Map<string, Session>();

  const runtime = Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(request, runtime) {
      const url = new URL(request.url);
      if (url.pathname === "/healthz" && request.method === "GET") {
        return new Response("ok");
      }
      if (url.pathname !== "/mcp") {
        return new Response("Not found", { status: 404 });
      }

      // MCP POST handlers may legitimately run for minutes, while the
      // standalone SSE response is intentionally open-ended. Bun otherwise
      // resets either quiet request after its 10-second idle timeout.
      runtime.timeout(request, 0);

      const sessionId = request.headers.get("mcp-session-id");
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (!session) {
          return Response.json(
            { jsonrpc: "2.0", error: { code: -32001, message: "Unknown MCP session" }, id: null },
            { status: 404 },
          );
        }
        return session.transport.handleRequest(request);
      }

      if (request.method !== "POST") {
        return Response.json(
          { jsonrpc: "2.0", error: { code: -32000, message: "Missing MCP session" }, id: null },
          { status: 400 },
        );
      }

      const body = await request.json();
      if (!isInitializeRequest(body)) {
        return Response.json(
          { jsonrpc: "2.0", error: { code: -32000, message: "Expected initialize request" }, id: null },
          { status: 400 },
        );
      }

      const server = createMcpServer();
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized(id) {
          sessions.set(id, { server, transport });
        },
        onsessionclosed(id) {
          sessions.delete(id);
        },
      });

      try {
        await server.connect(transport);
        return await transport.handleRequest(request, { parsedBody: body });
      } catch (error) {
        await transport.close().catch(() => undefined);
        throw error;
      }
    },
  });

  if (runtime.hostname === undefined || runtime.port === undefined) {
    runtime.stop(true);
    throw new Error("Bun did not report the Notion MCP HTTP listener address");
  }

  return {
    hostname: runtime.hostname,
    port: runtime.port,
    async stop(closeActiveConnections = false) {
      await Promise.allSettled([...sessions.values()].map(({ transport }) => transport.close()));
      sessions.clear();
      await runtime.stop(closeActiveConnections);
    },
  };
}

async function main(): Promise<void> {
  assertNotionConfiguration();
  const rawPort = process.env.MACCING_NOTION_HTTP_PORT ?? "8765";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`MACCING_NOTION_HTTP_PORT must be an integer from 1 to 65535; received ${rawPort}`);
  }

  const server = startHttpServer({ port });
  console.error(
    `notion MCP HTTP up on http://${server.hostname}:${server.port}/mcp (Bun; Notion-Version ${VERSION}; tools: ${TOOLS.map((tool) => tool.name).join(", ")})`,
  );

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await server.stop(true);
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("notion MCP HTTP startup failed:", error);
    process.exit(1);
  });
}