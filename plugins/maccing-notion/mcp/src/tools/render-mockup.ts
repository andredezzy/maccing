// render_mockup — the one renderer tool. Turn structure into the canonical fixed-width ASCII "mockup":
// a faithful COMPOUNDING (recursive, width-flowing) visual of how a Notion item looks / WILL look. The
// input is completely flexible — a single block, or an array of blocks — because EVERY renderable is a
// block: a whole `page` and a standalone `database` are blocks too (with their own chrome), so one
// recursive type renders a page, a database, a single view, bare content, or any nesting of them. The
// block's own `type` decides what it is; the renderer OWNS all alignment (pads/truncates by display
// width, word-wraps, emoji-safe), so the caller supplies only STRUCTURE and never counts a character —
// hand-typed mockups drift, rendered ones never do.

import { z } from "zod";
import { type MockupBlock, renderBlocksMockup } from "../render";
import { mockupSchema } from "../render/schema";
import { err, ok, type ToolModule } from "../tool";

export const renderMockupTool: ToolModule = {
  name: "render_mockup",
  config: {
    title: "Render a Notion mockup",
    description:
      "Render `mockup` — a single block OR an array of blocks — into the canonical fixed-width ASCII " +
      "MOCKUP. The renderer OWNS all alignment (pads/truncates by display width, word-wraps, emoji-safe), " +
      "so you supply only structure and never count characters. EVERYTHING is a block, identified by its " +
      "`type`; most accept `children` for nesting, and they compose to any depth (a page holding an inline " +
      "database holding a board, etc.):\n" +
      "• page { title, icon?, cover?, description?, width?, children[] } — a whole page (cover band + " +
      "icon/title header + recursive body).\n" +
      "• database { database: { title, icon?, description?, width?, views[], view? } } — a standalone " +
      "database (icon+title header + view tabs). `view` = an index (default 0) or 'all' to stack every view.\n" +
      "• view blocks (also usable on their own): table {name,views?,columns[],rows[][]} · gallery " +
      "{name,views?,cardSize?,cards[]} · board {name,views?,groups[{name,cards[]}]} · list " +
      "{name,views?,items[{icon?,title,meta?}]} · calendar · timeline · chart · form · map.\n" +
      "• content blocks: paragraph · heading_1|2|3 (toggle?) · bulleted_list_item · numbered_list_item · " +
      "to_do (checked?) · toggle · quote · callout {icon?,lines[]} · divider · code {language?,text,caption?} · " +
      "equation {expression} · image|video|audio|file|pdf {url?,name?,caption?} · bookmark|link_preview {url} · " +
      "embed {label} · column_list {columns[{ratio?,children[]}]} · simple_table {rows[][],hasColumnHeader?} · " +
      "breadcrumb {path[]} · table_of_contents {headings[]} · synced_block {children[]} · page_link " +
      "{icon?,title,note?} · unsupported.\n" +
      "Optional top-level `width` (default 70) sets the canvas for bare blocks. Use this to SHOW an item's " +
      "resulting shape in a proposal (how it will become) and the live result after a write.",
    annotations: { title: "Render a Notion mockup", readOnlyHint: true },
    inputSchema: {
      mockup: mockupSchema,
      width: z.number().optional().describe("canvas columns for bare blocks (default 70)"),
    },
  },
  handler: async (args) => {
    try {
      const parsed = mockupSchema.parse(args.mockup);
      const blocks = (Array.isArray(parsed) ? parsed : [parsed]) as MockupBlock[];
      const width = typeof args.width === "number" && args.width > 0 ? args.width : undefined;
      return ok(renderBlocksMockup(blocks, width));
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
