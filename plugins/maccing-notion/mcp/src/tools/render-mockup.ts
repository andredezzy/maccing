// render_mockup — the one renderer tool: turn a structured model into the canonical fixed-width ASCII
// "mockup", a faithful COMPOUNDING (recursive, width-flowing) visual of how a Notion item looks / WILL
// look. One `mockup` input tagged by `kind` covers every shape — a whole page, a standalone database,
// or a bare block subtree — and dispatches to the matching renderer. The renderer OWNS all alignment
// (pads/truncates by display width, word-wraps, emoji-safe), so the caller supplies only STRUCTURE and
// never counts a character — hand-typed mockups drift, rendered ones never do.

import { renderBlocksMockup, renderDatabase, renderPage } from "../render";
import { mockupSchema } from "../render/schema";
import { err, ok, type ToolModule } from "../tool";

export const renderMockupTool: ToolModule = {
  name: "render_mockup",
  config: {
    title: "Render a Notion mockup",
    description:
      "Render a structured `mockup` into the canonical fixed-width ASCII MOCKUP. The renderer OWNS all " +
      "alignment (pads/truncates by display width, word-wraps, emoji-safe), so you supply only structure " +
      "and never count characters. `mockup` is tagged by `kind`:\n" +
      "• kind:'page' — a whole page: { kind, title, icon?, cover?, description?, width?, blocks[] }. " +
      "Each block is one of (with optional `children` for nesting): paragraph · heading_1|2|3 (toggle?) · " +
      "bulleted_list_item · numbered_list_item · to_do (checked?) · toggle · quote · callout {icon?,lines[]} · " +
      "divider · code {language?,text,caption?} · equation {expression} · image|video|audio|file|pdf " +
      "{url?,name?,caption?} · bookmark|link_preview {url} · embed {label} · column_list {columns[{ratio?,children[]}]} · " +
      "simple_table {rows[][],hasColumnHeader?} · breadcrumb {path[]} · table_of_contents {headings[]} · " +
      "synced_block {children[]} · page_link {icon?,title,note?} · database {database} · the view blocks below · unsupported.\n" +
      "• kind:'database' — a STANDALONE database (its own icon+title header + a view): " +
      "{ kind, title, icon?, description?, width?, views[], view? }. `view` selects which to render: an index " +
      "(default 0) or 'all' to stack every view. Each view is one of: table {name,views?,columns[],rows[][]} · " +
      "gallery {name,views?,cardSize?,cards[]} · board {name,views?,groups[{name,cards[]}]} · " +
      "list {name,views?,items[{icon?,title,meta?}]} · calendar · timeline · chart · form · map.\n" +
      "• kind:'blocks' — a bare block subtree (no page/database chrome): { kind, blocks[], width? } — same " +
      "block shapes as kind:'page'. Useful for previewing a subtree or a synced block's children.\n" +
      "Use this to SHOW an item's resulting shape in a proposal (how it will become) and the live result after a write.",
    annotations: { title: "Render a Notion mockup", readOnlyHint: true },
    inputSchema: { mockup: mockupSchema },
  },
  handler: async (args) => {
    try {
      const mockup = mockupSchema.parse(args.mockup);
      switch (mockup.kind) {
        case "page":
          return ok(renderPage(mockup));
        case "database":
          return ok(renderDatabase(mockup));
        case "blocks":
          return ok(renderBlocksMockup(mockup.blocks, mockup.width));
      }
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
