// Deterministic ASCII "page mockup" renderer — a COMPOUNDING (recursive, width-flowing) renderer that
// turns a structured model into a faithful, fixed-width visual of how a Notion page / database / block
// subtree looks. The renderer OWNS all alignment: it pads/truncates by DISPLAY width (emoji = 2 cells,
// ZWJ/skin/VS grapheme clusters = one glyph) and word-wraps long text, so callers supply only STRUCTURE
// and never count a character. Every bordered box closes; that invariant holds under recursion (children
// shrink width), columns (width splits + hcat), and database views (table/gallery/board/list).
//
// This file is the thin entry — three symmetric (model → finished string) renderers: renderPage(PageModel) ·
// renderDatabase(DatabaseModel) · renderBlocksMockup(MockupBlock[]). The model lives in ./model, primitives
// in ./text + ./box, dispatch in ./engine, and EVERY renderer in ./blocks (content, page/database
// containers, and db views alike — they are all blocks).

import "./blocks"; // side-effect: registers every block renderer (content · page/database containers · db views)
import { renderBlock, renderBlocks } from "./engine";
import type { DatabaseModel, MockupBlock, PageModel } from "./model";

export { databaseToModel, groupOptionsFor, resolveView } from "./database-model";
export * from "./model";
export { pageToModel, type RawBlock, type RawPage } from "./page-model";
export { mockupSchema } from "./schema";
export { displayWidth } from "./text";

const DEFAULT_WIDTH = 70;

/** Join rendered lines, collapse runs of 3+ blank lines, and trim the trailing edge — the final mockup string. */
function finish(lines: string[]): string {
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

/** Render a top-level container block (a page or a standalone database) at its width, through the registry. */
function renderRoot(block: MockupBlock, width: number | undefined): string {
  return finish(renderBlock(block, width ?? DEFAULT_WIDTH, 0, 0));
}

/** Render a full page. The page IS a block (blocks/page.ts owns the chrome) — wrap the model and dispatch it. */
export function renderPage(model: PageModel): string {
  return renderRoot(
    {
      type: "page",
      title: model.title,
      icon: model.icon,
      cover: model.cover,
      description: model.description,
      children: model.blocks,
    },
    model.width,
  );
}

/** Render a standalone database. A database IS a block too — wrap the model and dispatch it the same way. */
export function renderDatabase(db: DatabaseModel): string {
  return renderRoot({ type: "database", database: db }, db.width);
}

/** Render a bare block subtree — no page/database chrome. Non-positive widths fall back to the default. */
export function renderBlocksMockup(blocks: MockupBlock[], width?: number): string {
  return finish(renderBlocks(blocks, width && width > 0 ? width : DEFAULT_WIDTH, 0));
}
