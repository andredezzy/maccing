// render_mockup — the ONE mockup tool. Turn structure into the canonical fixed-width ASCII "mockup": a
// faithful COMPOUNDING (recursive, width-flowing) visual of how a Notion item looks / WILL look. It renders
// either a hand-authored official shape OR a LIVE page/database by id (fetched + assembled, identical to the
// old read_* mockup output). The renderer OWNS all alignment (pads/truncates by display width, word-wraps,
// emoji-safe), so callers supply only STRUCTURE and never count a character.

import { z } from "zod";
import { normalizeUuid, UUID_PATTERN } from "../notion/ids";
import { hasPublicToken } from "../notion/public-client";
import { fetchDatabaseRender, fetchPageRender, SAMPLE_CAP } from "../readers/live-bundle";
import type { Mockup } from "../render";
import { mockupSchema, render } from "../render";
import { err, errorMessage, ok, type ToolModule } from "../tool";

export const renderMockup: ToolModule = {
  name: "render_mockup",
  config: {
    title: "Render a Notion mockup",
    description:
      "Render a Notion item into the canonical fixed-width ASCII MOCKUP — the one mockup renderer for ALL of " +
      "Notion. The renderer OWNS all alignment (pads/truncates by display width, word-wraps, emoji-safe), so you " +
      "supply only structure and never count characters. Provide EXACTLY ONE of:\n" +
      "• page_id — render a LIVE page by id (fetched + rendered: cover/icon/title + the full block tree).\n" +
      "• database_id — render a LIVE database by id: its DEFAULT view (or pass `view` by name/id/index), with the " +
      "views as tabs in Notion's real order and only the rows that view shows (its filter+sorts applied).\n" +
      "• mockup — a hand-authored or programmatically-built official shape: PageRender { page, blocks[] }, a single " +
      "BlockObject, an array of BlockObjects, or DatabaseRender { database, dataSource, views[], rows[] }. Use this " +
      "to preview how something WILL look before writing it.\n" +
      "Optional `width` (default 70) sets the canvas; `depth` (page_id only, default 3) the block-nesting depth.",
    annotations: { title: "Render a Notion mockup", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      mockup: mockupSchema
        .optional()
        .describe("a hand-authored official shape (PageRender | BlockObject | BlockObject[] | DatabaseRender)"),
      page_id: z.string().optional().describe("render a LIVE page by id"),
      database_id: z.string().optional().describe("render a LIVE database by id (its default view, or pass `view`)"),
      view: z
        .union([z.string(), z.number()])
        .optional()
        .describe("database_id only: render a specific view by name, id, or index (default: the DB's default view)"),
      width: z.number().optional().describe("canvas columns (default 70)"),
      depth: z.number().optional().describe("page_id only: block-nesting levels to render (default 3)"),
    },
  },
  handler: async (args) => {
    const width = typeof args.width === "number" && args.width > 0 ? args.width : undefined;

    try {
      if (args.page_id !== undefined) {
        if (!hasPublicToken()) {
          return err("NOTION_TOKEN is not set.");
        }
        const pageId = normalizeUuid(String(args.page_id));
        if (!UUID_PATTERN.test(pageId)) {
          return err("page_id must be a UUID.");
        }
        const depth = typeof args.depth === "number" && args.depth > 0 ? Math.min(args.depth, 5) : 3;
        const bundle = await fetchPageRender(pageId, depth);
        if (!bundle) {
          return err("Could not read the page — check the id and that NOTION_TOKEN has access.");
        }
        return ok(render(bundle, width));
      }

      if (args.database_id !== undefined) {
        if (!hasPublicToken()) {
          return err("NOTION_TOKEN is not set.");
        }
        const databaseId = normalizeUuid(String(args.database_id));
        if (!UUID_PATTERN.test(databaseId)) {
          return err("database_id must be a UUID.");
        }
        const viewSelector = typeof args.view === "string" || typeof args.view === "number" ? args.view : undefined;
        const live = await fetchDatabaseRender(databaseId, viewSelector);
        if (!live) {
          return err(`Could not read the database ${databaseId} — check the id and that NOTION_TOKEN has access.`);
        }
        const body = render(live.bundle, width, live.selectedIndex);
        return ok(
          live.truncated ? `${body}\n\n(mockup preview — first ${SAMPLE_CAP} rows; the database has more)` : body,
        );
      }

      if (args.mockup !== undefined) {
        const parsed = mockupSchema.parse(args.mockup);
        return ok(render(parsed as Mockup, width));
      }

      return err("Provide exactly one of: page_id, database_id, or mockup.");
    } catch (error) {
      return err(errorMessage(error));
    }
  },
};
