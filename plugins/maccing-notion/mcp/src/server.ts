// Custom Notion MCP server — built on the official MCP SDK (@modelcontextprotocol/sdk), run on Bun
// (TypeScript executed directly). Exposes a registry of tools over the MCP stdio transport. Adding
// a capability = create a file in tools/ and add it to the TOOLS array below — one line, no
// protocol plumbing to touch.
//
//   request           public REST API (api.notion.com/v1), Notion-Version 2026-03-11
//   private_request   UNOFFICIAL private app API (api/v3) escape hatch for UI-only features
//   upsert_property   create/update any property (data_source column + icon, or page value), batched
//
// Public token: NOTION_TOKEN. Private session cookie: NOTION_TOKEN_V2 + NOTION_SPACE_ID. All loaded
// by start.sh from ~/.config/maccing/notion.env (stable per-user) and/or mcp/.env.local (dev
// override), kept ONLY in this process. Secret values are scrubbed from every tool result by the
// withRedact middleware (redact.ts).

import { McpServer } from "#sdk/server/mcp";
import { StdioServerTransport } from "#sdk/server/stdio";
import { VERSION } from "./lib/notion-public";
import { withRedact } from "./redact";
import type { ToolModule } from "./tool";
import { describe } from "./tools/describe";
import { orderProperties } from "./tools/order-properties";
import { privateRequest } from "./tools/private-request";
import { readAgentsMd } from "./tools/read-agents-md";
import { readDatabase } from "./tools/read-database";
import { readPage } from "./tools/read-page";
import { request } from "./tools/request";
import { search } from "./tools/search";
import { upsertProperty } from "./tools/upsert-property";

// stdout is the JSON-RPC transport channel — route any stray console.log to stderr so it can't corrupt it.
console.log = console.error;

const SERVER_INFO = { name: "notion", version: "2.0.0" };

// Open/closed registry: a new tool is a new file in tools/ plus one line here.
export const TOOLS: ToolModule[] = [
  request,
  privateRequest,
  upsertProperty,
  orderProperties,
  search,
  describe,
  readAgentsMd,
  readPage,
  readDatabase,
];

async function main(): Promise<void> {
  // Fail-fast on startup: the public token is required; private-API vars are optional (graceful degrade).
  if (!process.env.NOTION_TOKEN) {
    console.error(
      "FATAL: NOTION_TOKEN is not set. Add it to ~/.config/maccing/notion.env (or mcp/.env.local). The notion MCP cannot start.",
    );
    process.exit(1);
  }
  const privateMissing = ["NOTION_TOKEN_V2", "NOTION_SPACE_ID"].filter((name) => !process.env[name]);
  if (privateMissing.length > 0) {
    console.error(
      `notion MCP: private app API disabled — set ${privateMissing.join(", ")} in ~/.config/maccing/notion.env (or mcp/.env.local) to enable the property-icon / private tools.`,
    );
  }

  const server = new McpServer(SERVER_INFO);

  for (const tool of TOOLS) {
    server.registerTool(tool.name, tool.config, withRedact(tool.handler));
  }

  await server.connect(new StdioServerTransport());
  console.error(
    `notion MCP up on the official MCP SDK (Bun; Notion-Version ${VERSION}; tools: ${TOOLS.map((tool) => tool.name).join(", ")})`,
  );
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("notion MCP startup failed:", error);
    process.exit(1);
  });
}
