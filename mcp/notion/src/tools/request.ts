// Public-API passthrough tool — call any Notion REST endpoint (api.notion.com/v1).

import { z } from "zod";
import { hasPublicToken, publicRequest, VERSION } from "../notion/public-client";
import { pickPaths } from "../pick";
import { err, type ToolModule } from "../tool";

const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

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
      "Returns { status, ok, body }. Pass `pick` to shrink a large body down to just the fields you need.",
    annotations: { title: "Notion REST API request", openWorldHint: true },
    inputSchema: {
      method: z.enum(METHODS).describe("HTTP method."),
      path: z.string().describe("API path starting with '/', e.g. /v1/views or /v1/databases/{id}/query."),
      body: z.record(z.string(), z.unknown()).optional().describe("JSON request body for POST/PATCH/PUT."),
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

    // `method` is validated against METHODS by the SDK before we get here.
    const response = await publicRequest(
      String(args.method),
      path,
      args.body,
      args.query as Record<string, unknown> | undefined,
    );
    const pick = Array.isArray(args.pick) ? (args.pick as string[]) : undefined;
    const body = pick && pick.length > 0 ? pickPaths(response.body, pick) : response.body;
    return {
      content: [{ type: "text", text: JSON.stringify({ status: response.status, ok: response.ok, body }, null, 2) }],
      isError: !response.ok,
    };
  },
};
