// render_mockup — the one renderer tool. Turn structure into the canonical fixed-width ASCII "mockup":
// a faithful COMPOUNDING (recursive, width-flowing) visual of how a Notion item looks / WILL look. The
// input is a page render bundle ({ page, blocks[] } using official API shapes), a single block (official
// Notion API block JSON), or an array of blocks. A `database` block holds its pre-built views[] — views
// are NOT top-level, they only live inside a database's views[]. The node's own `type` decides what it
// is; the renderer OWNS all alignment (pads/truncates by display width, word-wraps, emoji-safe), so the
// caller supplies only STRUCTURE and never counts a character.

import { z } from "zod";
import type { Mockup } from "../render";
import { mockupSchema, render } from "../render";
import { err, errorMessage, ok, type ToolModule } from "../tool";

export const renderMockup: ToolModule = {
  name: "render_mockup",
  config: {
    title: "Render a Notion mockup",
    description:
      "Render `mockup` into the canonical fixed-width ASCII MOCKUP. The renderer OWNS all alignment " +
      "(pads/truncates by display width, word-wraps, emoji-safe), so you supply only structure and never " +
      "count characters. Accepts:\n" +
      "• Official PageRender: { page: PageObject, blocks: BlockObject[] } — a full page with cover/icon/title.\n" +
      "• Official block: any Notion BlockObject (paragraph, heading_1|2|3|4, bulleted_list_item, " +
      "numbered_list_item, to_do, toggle, quote, callout, divider, code, equation, image, video, audio, " +
      "file, pdf, bookmark, link_preview, embed, column_list, table, breadcrumb, table_of_contents, " +
      "synced_block, child_page, child_database, link_to_page, template, tab, unsupported).\n" +
      "• Array of blocks.\n" +
      "• Inline database block: { type: 'database', database: { title, icon?, views[], view? } } — " +
      "wraps pre-built view objects (table/gallery/board/list/calendar/timeline/chart/form/map/dashboard/feed).\n" +
      "Optional top-level `width` (default 70) sets the canvas for bare blocks.",
    annotations: { title: "Render a Notion mockup", readOnlyHint: true },
    inputSchema: {
      mockup: mockupSchema,
      width: z.number().optional().describe("canvas columns for bare blocks (default 70)"),
    },
  },
  handler: async (args) => {
    try {
      const parsed = mockupSchema.parse(args.mockup);
      const width = typeof args.width === "number" && args.width > 0 ? args.width : undefined;
      return ok(render(parsed as Mockup, width));
    } catch (error) {
      return err(errorMessage(error));
    }
  },
};
