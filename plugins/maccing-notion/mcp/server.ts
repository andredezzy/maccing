// Custom Notion MCP server — zero dependencies, full control over the Notion API.
//
// Runs on Bun (TypeScript executed directly, no build step). Exposes ONE tool,
// `notion_request(method, path, body, query)`, that always sends Notion-Version
// 2026-03-11 — unlocking the entire current API surface: views (/v1/views), data
// sources (/v1/data_sources/{id}/query), databases, pages, blocks, search, comments,
// users, file uploads — properties/filters/sorts/groupings included.
//
// The MCP stdio protocol (JSON-RPC 2.0 over newline-delimited stdin/stdout) is
// implemented inline, so there is nothing to install. The token comes from
// NOTION_TOKEN, loaded by start.sh from the gitignored secrets.env.

import { createInterface } from "node:readline";

const TOKEN = process.env.NOTION_TOKEN;
const VERSION = process.env.NOTION_VERSION ?? "2026-03-11";
const BASE = "https://api.notion.com";

type RequestId = number | string | undefined;

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: RequestId;
  method?: string;
  params?: Record<string, unknown>;
}

interface NotionRequestArgs {
  method?: string;
  path?: string;
  body?: unknown;
  query?: Record<string, unknown>;
}

interface NotionCallOutcome {
  isError: boolean;
  text: string;
}

function send(message: object): void {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function reply(id: RequestId, result: object): void {
  send({ jsonrpc: "2.0", id, result });
}

function fail(id: RequestId, code: number, message: string): void {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

const NOTION_REQUEST_TOOL = {
  name: "notion_request",
  description:
    "Call any Notion REST API endpoint with full control. Always sends Notion-Version " +
    VERSION +
    ", so the entire current API surface is reachable: views (/v1/views and " +
    "/v1/views/{id}/query), data sources (/v1/data_sources/{id} and /query), databases " +
    "(/v1/databases/{id}), pages (/v1/pages), blocks (/v1/blocks/{id}/children), search " +
    "(/v1/search), comments, users, and file uploads. Configure properties, filters, sorts, " +
    "and groupings through the relevant database/data-source/view bodies. Endpoint reference: " +
    "https://developers.notion.com/reference . Returns { status, ok, body }.",
  inputSchema: {
    type: "object",
    properties: {
      method: {
        type: "string",
        enum: ["GET", "POST", "PATCH", "PUT", "DELETE"],
        description: "HTTP method.",
      },
      path: {
        type: "string",
        description: "API path starting with '/', e.g. /v1/views or /v1/databases/{id}/query.",
      },
      body: {
        type: "object",
        description: "JSON request body for POST/PATCH/PUT.",
        additionalProperties: true,
      },
      query: {
        type: "object",
        description: "Query-string params for GET, e.g. { page_size: 50 }.",
        additionalProperties: true,
      },
    },
    required: ["method", "path"],
  },
};

async function callNotion(args: NotionRequestArgs): Promise<NotionCallOutcome> {
  const method = (args.method ?? "GET").toUpperCase();
  const path = args.path;

  if (typeof path !== "string" || !path.startsWith("/")) {
    return { isError: true, text: "Invalid 'path' — must start with '/', e.g. /v1/search" };
  }

  let url = BASE + path;
  if (args.query && typeof args.query === "object") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(args.query)) params.append(key, String(value));
    const queryString = params.toString();
    if (queryString) url += (url.includes("?") ? "&" : "?") + queryString;
  }

  const headers: Record<string, string> = {
    Authorization: "Bearer " + TOKEN,
    "Notion-Version": VERSION,
  };
  const init: RequestInit = { method, headers };
  if (args.body !== undefined && method !== "GET" && method !== "DELETE") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(args.body);
  }

  const response = await fetch(url, init);
  const raw = await response.text();

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = raw;
  }

  return {
    isError: !response.ok,
    text: JSON.stringify({ status: response.status, ok: response.ok, body: payload }, null, 2),
  };
}

async function handle(message: JsonRpcMessage): Promise<void> {
  const { id, method, params } = message;

  if (method === "initialize") {
    reply(id, {
      protocolVersion: (params?.protocolVersion as string) ?? "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "notion", version: "1.0.0" },
    });
    return;
  }

  if (method === "ping") {
    reply(id, {});
    return;
  }

  if (method === "tools/list") {
    reply(id, { tools: [NOTION_REQUEST_TOOL] });
    return;
  }

  if (method === "tools/call") {
    const name = params?.name;
    if (name !== "notion_request") {
      fail(id, -32602, "Unknown tool: " + String(name));
      return;
    }
    if (!TOKEN) {
      reply(id, { content: [{ type: "text", text: "NOTION_TOKEN is not set" }], isError: true });
      return;
    }
    try {
      const outcome = await callNotion((params?.arguments as NotionRequestArgs) ?? {});
      reply(id, { content: [{ type: "text", text: outcome.text }], isError: outcome.isError });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      reply(id, { content: [{ type: "text", text: "Request failed: " + detail }], isError: true });
    }
    return;
  }

  // Notifications (no id) need no response; unknown requests get a standard error.
  if (id !== undefined) fail(id, -32601, "Method not found: " + method);
}

const reader = createInterface({ input: process.stdin });

reader.on("line", (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let message: JsonRpcMessage;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }

  Promise.resolve(handle(message)).catch((error) => {
    if (message.id !== undefined) {
      const detail = error instanceof Error ? error.message : String(error);
      fail(message.id, -32603, "Internal error: " + detail);
    }
  });
});

reader.on("close", () => process.exit(0));

console.error("notion custom MCP server up on Bun (Notion-Version " + VERSION + ")");
