// render_page — turn a structured page_model into the canonical fixed-width ASCII "page mockup":
// a faithful, COMPOUNDING (recursive, width-flowing) visual of how a Notion page looks / WILL look —
// cover · icon · title · every block type (text, lists, to-do, toggle, quote, callout, code, equation,
// media, bookmark, embed, columns, simple table, breadcrumb, TOC, synced) with nesting · inline DBs as
// table/gallery/board/list · full-page-DB & sub-page links. The renderer owns all alignment (display-width
// padding, truncation, word-wrap), so the caller supplies only structure. See lib/render-mockup.ts.

import { type PageModel, renderPage } from "../lib/render-mockup";
import { pageModelSchema } from "../lib/render-schema";
import { err, ok, type ToolModule } from "../tool";

export const renderPageTool: ToolModule = {
  name: "render_page",
  config: {
    title: "Render a Notion page mockup",
    description:
      "Render a structured `page_model` into the canonical fixed-width ASCII PAGE MOCKUP — a faithful, " +
      "recursive picture of how a Notion page looks / WILL look. The renderer OWNS all alignment (pads/" +
      "truncates by display width, word-wraps, emoji-safe), so you supply only structure and never count " +
      "characters — hand-typed mockups drift, rendered ones never do. `page_model`: { title, icon?, cover?, " +
      "description?, blocks[] }. Each block is one of (with optional `children` for nesting): paragraph · " +
      "heading_1|2|3 (toggle?) · bulleted_list_item · numbered_list_item · to_do (checked?) · toggle · quote · " +
      "callout {icon?,lines[]} · divider · code {language?,text,caption?} · equation {expression} · " +
      "image|video|audio|file|pdf {url?,name?,caption?} · bookmark|link_preview {url} · embed {label} · " +
      "column_list {columns[{ratio?,children[]}]} · simple_table {rows[][],hasColumnHeader?} · breadcrumb {path[]} · " +
      "table_of_contents {headings[]} · synced_block {children[]} · page_link {icon?,title,note?} · " +
      "table {name,views?,columns[],rows[][]} · gallery {name,views?,cardSize?,cards[]} · " +
      "board {name,views?,groups[{name,cards[]}]} · list {name,views?,items[{icon?,title,meta?}]} · unsupported. " +
      "Use this to SHOW a page's resulting shape in a proposal (how it will become) and the live result after a write.",
    annotations: { title: "Render a Notion page mockup", readOnlyHint: true },
    inputSchema: { page_model: pageModelSchema },
  },
  handler: async (args) => {
    try {
      const model = pageModelSchema.parse(args.page_model) as PageModel;
      return ok(renderPage(model));
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
