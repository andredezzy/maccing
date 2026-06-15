// Defense-in-depth secret scrubbing. Two pieces in one file = the whole "no secret value ever
// reaches the MCP client" invariant in a single auditable place:
//   redact(text)        — replace known secret VALUES (token_v2 cookie, integration token) with [REDACTED]
//   withRedact(handler) — middleware wrapping every tool handler so ALL returned text AND any thrown
//                         error flow through redact() at the single registration chokepoint in server.ts.
// Lives at the server/middleware layer (beside tool.ts), NOT under notion/ — it wraps the tool contract,
// so keeping it here leaves notion/ a pure leaf with no upward edge into the contract.

import type { ToolHandler } from "./tool";

const SECRETS: string[] = ["NOTION_TOKEN_V2", "NOTION_TOKEN"]
  .map((name) => process.env[name])
  .filter((value): value is string => typeof value === "string" && value.length >= 8);

export function redact(text: string): string {
  let scrubbed = text;
  for (const secret of SECRETS) {
    scrubbed = scrubbed.split(secret).join("[REDACTED]");
  }
  return scrubbed;
}

export function withRedact(handler: ToolHandler): ToolHandler {
  return async (args) => {
    try {
      const result = await handler(args);
      return {
        ...result,
        content: result.content.map((block) =>
          block.type === "text" ? { ...block, text: redact(block.text) } : block,
        ),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: redact(`Request failed: ${errorMessage}`) }], isError: true };
    }
  };
}
