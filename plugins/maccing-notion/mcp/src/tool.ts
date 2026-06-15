// The tool contract shared by the server registry and every tool module.
// Lives in its own file so tools and server.ts both import it without a cycle.
//
// A ToolModule is `{ name, config, handler }`: `config` is passed verbatim to the SDK's
// server.registerTool (title/description/inputSchema/annotations), and `handler` runs the call.
// The SDK validates inputSchema (a Zod shape) and converts it to JSON Schema on the wire.
//
// IMPORT CONVENTION — KEEP THIS GOING FORWARD: import specifiers carry NO `.js`/`.ts` extension,
// anywhere in this server. Our own modules are imported extensionless (`./redact`,
// `../lib/notion-public`). The official SDK only publishes `.js` subpaths, so we reach them through
// the `#sdk/*` alias defined in package.json `imports` (e.g. `#sdk/server/mcp`, `#sdk/types`) — never
// import a raw `@modelcontextprotocol/sdk/….js` path and never append an extension to any import.
// New files and new SDK imports must follow this; it keeps every import statement extension-free.

import type { ZodRawShape } from "zod";
import type { CallToolResult, ToolAnnotations } from "#sdk/types";

// WIRE CASING — every author-defined identifier that crosses the MCP boundary is snake_case:
// the tool `name`, each `inputSchema` (argument) key, and any output field we emit. This is a hard
// compatibility rule, not a style preference: Claude Code normalizes outgoing argument names to
// snake_case before sending, so a camelCase key (`dataSourceId`) silently arrives as
// `data_source_id` and the original is dropped → 400s. Hence args like `data_source_id`, never
// `dataSourceId`. Two casings are deliberately NOT snake_case: spec-fixed protocol fields stay
// camelCase (the *Hint annotations, `isError`, `serverInfo`, … — owned by the SDK types), and keys
// mirroring Notion's API keep Notion's casing verbatim (`spaceId`, `requestId`, `saveTransactions`).
// Internal TS identifiers remain camelCase — they never serialize.
interface ToolConfig {
  title?: string;
  description: string;
  inputSchema: ZodRawShape;
  annotations?: ToolAnnotations;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<CallToolResult>;

export interface ToolModule {
  name: string;
  config: ToolConfig;
  handler: ToolHandler;
}

/** Success result — objects are pretty-printed JSON, strings pass through. */
export function ok(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

/** Error result carrying a human-readable message. */
export function err(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
