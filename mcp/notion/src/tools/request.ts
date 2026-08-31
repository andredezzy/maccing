// Public-API passthrough tool — call any Notion REST endpoint (api.notion.com/v1).

import { z } from "zod";
import { mapWithConcurrency } from "../notion/concurrency";
import { hasPublicToken, publicRequest, VERSION } from "../notion/public-client";
import { pickPaths } from "../pick";
import { err, type ToolModule } from "../tool";

const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

// How many batched calls are in flight at once. Notion's general limit is ~3
// requests/second averaged, and `publicRequest` already retries a 429 with
// backoff — but a retry storm gives back the time the fan-out saved, so the
// window stays narrow enough that it rarely triggers one.
const BATCH_CONCURRENCY = 4;

export const request: ToolModule = {
  name: "request",
  config: {
    title: "Notion REST API request",
    description:
      "Call any Notion REST API endpoint with full control. Always sends Notion-Version " +
      VERSION +
      ", so the entire current API surface is reachable: views (/v1/views and /v1/views/{id}/query), " +
      "data sources (/v1/data_sources/{id} and /query), databases (/v1/databases/{id}), pages " +
      "(/v1/pages), blocks (/v1/blocks/{id}/children), search (/v1/search), comments, users, and file " +
      "uploads. Configure properties, filters, sorts, and groupings through the relevant " +
      "database/data-source/view bodies. Endpoint reference: https://developers.notion.com/reference . " +
      "Returns { status, ok, body }. Pass `pick` to shrink a large body down to just the fields you need. " +
      "Pass `bodies` INSTEAD of `body` to send the same method+path once per entry — the way to create or " +
      "update many rows without paying a separate tool call for each one.",
    annotations: { title: "Notion REST API request", openWorldHint: true },
    inputSchema: {
      method: z.enum(METHODS).describe("HTTP method."),
      path: z.string().describe("API path starting with '/', e.g. /v1/views or /v1/databases/{id}/query."),
      body: z.record(z.string(), z.unknown()).optional().describe("JSON request body for POST/PATCH/PUT."),
      bodies: z
        .array(z.record(z.string(), z.unknown()))
        .optional()
        .describe(
          "Batch: send this method+path once per entry, concurrently. Use for bulk row creation " +
            "(N × POST /v1/pages) instead of N separate tool calls. Mutually exclusive with `body`. " +
            "Reports per-index results so a partial failure names the entries that failed.",
        ),
      query: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Query-string params for GET, e.g. { page_size: 50 }."),
      pick: z
        .array(z.string())
        .optional()
        .describe(
          "Dot/bracket paths to project from the response body, e.g. 'results[].id' ('[]' maps over an " +
            "array). When set, body becomes { '<path>': value | null } per path instead of the full body.",
        ),
    },
  },

  handler: async (args) => {
    if (!hasPublicToken()) {
      return err("NOTION_TOKEN is not set.");
    }

    const path = args.path;
    if (typeof path !== "string" || !path.startsWith("/")) {
      return err("Invalid 'path' — must start with '/', e.g. /v1/search");
    }

    const pick = Array.isArray(args.pick) ? (args.pick as string[]) : undefined;
    const project = (body: unknown) => (pick && pick.length > 0 ? pickPaths(body, pick) : body);
    const bodies = Array.isArray(args.bodies) ? (args.bodies as Record<string, unknown>[]) : undefined;

    if (bodies && args.body !== undefined) {
      return err("Pass 'body' or 'bodies', not both.");
    }

    if (bodies) {
      if (bodies.length === 0) {
        return err("'bodies' is empty — nothing to send.");
      }

      const results = await mapWithConcurrency(bodies, BATCH_CONCURRENCY, async (body) =>
        publicRequest(String(args.method), path, body, args.query as Record<string, unknown> | undefined),
      );

      const succeeded = results.filter((result) => result.ok).length;
      // Index every entry, not just the failures: the caller needs to map a
      // result back to the row it sent, and a bare count cannot do that.
      const detail = results.map((result, index) => ({
        index,
        status: result.status,
        ok: result.ok,
        body: project(result.body),
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { summary: `${succeeded} of ${results.length} succeeded`, results: detail },
              null,
              2,
            ),
          },
        ],
        isError: succeeded !== results.length,
      };
    }

    // `method` is validated against METHODS by the SDK before we get here.
    const response = await publicRequest(
      String(args.method),
      path,
      args.body,
      args.query as Record<string, unknown> | undefined,
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ status: response.status, ok: response.ok, body: project(response.body) }, null, 2),
        },
      ],
      isError: !response.ok,
    };
  },
};
