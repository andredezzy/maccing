// Find a page or data source by name and get its id — the compact reader over POST /v1/search.
// Returns ranked hits as a few lines instead of the raw endpoint's tens-of-KB page objects.

import { z } from "zod";
import { hasPublicToken, publicRequest } from "../notion/public-client";
import { formatSearch, type RawSearchResult } from "../readers/search";
import { err, ok, type ToolModule } from "../tool";

const OBJECT_TYPES = ["page", "data_source"] as const;

interface SearchResponse {
  results?: RawSearchResult[];
  has_more?: boolean;
  next_cursor?: string | null;
}

export const search: ToolModule = {
  name: "search",
  config: {
    title: "Search Notion (name → id)",
    description:
      "Find a page or data source by name and get its id — the compact reader over POST /v1/search. Returns " +
      'ranked hits, one line each (object · "title" · short id · parent), instead of the raw endpoint\'s ' +
      "tens-of-KB page objects. Pass object_type to filter (page | data_source — NOT 'database'). Ranked by " +
      "relevance/last-edited and NOT exhaustive — set exhaust_all=true to page to the end. Use this to resolve " +
      "a name into an id for read_page / read_database / describe / read_agents_md.",
    annotations: { title: "Search Notion (name → id)", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      query: z.string().describe("Text to match against page / data-source titles."),
      object_type: z.enum(OBJECT_TYPES).optional().describe("Filter to 'page' or 'data_source' (not 'database')."),
      page_size: z.number().optional().describe("Max hits per page (default 20, max 100)."),
      exhaust_all: z.boolean().optional().describe("Page to the end and return every hit (default false)."),
    },
  },

  handler: async (args) => {
    if (!hasPublicToken()) {
      return err("NOTION_TOKEN is not set.");
    }
    const query = String(args.query ?? "").trim();
    if (!query) {
      return err("query is required.");
    }

    const pageSize = typeof args.page_size === "number" ? Math.min(Math.max(args.page_size, 1), 100) : 20;
    const exhaustAll = args.exhaust_all === true;
    const objectType = args.object_type === "page" || args.object_type === "data_source" ? args.object_type : null;

    try {
      const results: RawSearchResult[] = [];
      let cursor: string | undefined;

      do {
        const body: Record<string, unknown> = { query, page_size: pageSize };
        if (objectType) {
          body.filter = { property: "object", value: objectType };
        }
        if (cursor) {
          body.start_cursor = cursor;
        }

        const response = await publicRequest("POST", "/v1/search", body);
        if (!response.ok) {
          return err(JSON.stringify(response, null, 2));
        }

        const searchResponse = response.body as SearchResponse;
        results.push(...(searchResponse.results ?? []));
        cursor = exhaustAll && searchResponse.has_more ? (searchResponse.next_cursor ?? undefined) : undefined;
      } while (cursor);

      return ok(formatSearch(results));
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
