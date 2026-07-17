// Generic escape hatch for Notion's UNOFFICIAL private app API (www.notion.so/api/v3).
// Open/closed: any UI-only capability works by passing the right operations — no new server code.

import { z } from "zod";
import type { CallToolResult } from "#sdk/types";
import { privateCall, privateConfig, saveTransactions } from "../notion/private-client";
import { pickPaths } from "../pick";
import { err, errorMessage, type ToolModule } from "../tool";

// api/v3 endpoints are camelCase identifiers (getSpaces, saveTransactions, …). The allowlist
// pattern blocks path traversal / arbitrary-endpoint injection (e.g. from prompt-injected content).
const ENDPOINT_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;

interface Operation {
  command?: string;
  pointer?: { table?: string };
}

/** Schema mutations silently no-op without a trailing collection `update` commit op. */
function hasCommitOp(operations: Operation[]): boolean {
  const last = operations[operations.length - 1];
  return last?.command === "update" && last?.pointer?.table === "collection";
}

/** Serialize a { status, ok, body } response, projecting `body` through `pick` when given. */
function toResult(response: { status: number; ok: boolean; body: unknown }, pick?: string[]): CallToolResult {
  const body = pick && pick.length > 0 ? pickPaths(response.body, pick) : response.body;
  return {
    content: [{ type: "text", text: JSON.stringify({ status: response.status, ok: response.ok, body }, null, 2) }],
    isError: !response.ok,
  };
}

export const privateRequest: ToolModule = {
  name: "private_request",
  config: {
    title: "Notion private app API (unofficial)",
    description:
      "UNOFFICIAL private Notion app API (api/v3) for UI-only features the public API CANNOT do — e.g. " +
      "database property/column icons. Session-cookie auth lives in the server (NOTION_TOKEN_V2); never " +
      "exposed. RISKS: undocumented, against ToS, can break anytime, rate-limited. Use only when the public " +
      "`request` genuinely can't, for the user's own workspace, with approval. For `saveTransactions` " +
      "pass `operations` (auto-wrapped in the transaction envelope; the active-user header is injected) — and " +
      "include a trailing collection `update` commit op or the change silently no-ops (enforced here). Discover " +
      "operation formats via DevTools capture; full guide in the skill's references/private-api.md. Returns " +
      "{ status, ok, body }. Pass `pick` to shrink a large body (e.g. a getRecordValues recordMap) down to " +
      "just the fields you need.",
    annotations: { title: "Notion private app API (unofficial)", openWorldHint: true, destructiveHint: true },
    inputSchema: {
      endpoint: z
        .string()
        .describe("api/v3 endpoint name (camelCase), e.g. saveTransactions | getRecordValues | getSpaces."),
      operations: z
        .array(z.record(z.string(), z.unknown()))
        .optional()
        .describe(
          "For saveTransactions: the operations[] (auto-enveloped). Each op: { pointer:{table,id,spaceId}, command, path, args }. End with a collection `update` commit op.",
        ),
      body: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Raw request body for non-saveTransactions endpoints (e.g. getRecordValues { requests:[…] })."),
      pick: z
        .array(z.string())
        .optional()
        .describe(
          "Dot/bracket paths to project from the response body, e.g. " +
            "'recordMap.collection.<uuid>.value.value.schema' ('[]' maps over an array). When set, body " +
            "becomes { '<path>': value | null } per path instead of the full body.",
        ),
    },
  },

  handler: async (args) => {
    const config = privateConfig();
    if (!config.ok) {
      return err(`Private API not configured — missing ${config.missing.join(", ")} in the MCP env (mcp/.env.local).`);
    }

    const endpoint = String(args.endpoint);
    if (!ENDPOINT_PATTERN.test(endpoint)) {
      return err(`Invalid endpoint "${endpoint}" — must be a camelCase api/v3 identifier (e.g. saveTransactions).`);
    }

    const pick = Array.isArray(args.pick) ? (args.pick as string[]) : undefined;

    try {
      if (endpoint === "saveTransactions" && Array.isArray(args.operations)) {
        const operations = args.operations as Operation[];
        if (!hasCommitOp(operations)) {
          return err(
            "saveTransactions for a schema mutation needs a trailing collection `update` commit op, or it silently " +
              "no-ops — see references/private-api.md. Add it, or use upsert_property (icon / visible fields) which handles it.",
          );
        }
        const response = await saveTransactions(operations);
        return toResult(response, pick);
      }

      const response = await privateCall(endpoint, args.body ?? {});
      return toResult(response, pick);
    } catch (error) {
      return err(errorMessage(error));
    }
  },
};
