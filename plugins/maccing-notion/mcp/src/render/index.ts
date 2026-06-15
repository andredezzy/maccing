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

// importing ./blocks runs every renderer's register() call (content · containers · db views).
import { renderDatabaseLines } from "./blocks";
import { renderBlocks } from "./engine";
import type { DatabaseModel, MockupBlock, PageModel } from "./model";

export { renderBlocks } from "./engine";
export * from "./model";
export { displayWidth } from "./text";

const DEFAULT_WIDTH = 70;

/** Join rendered lines, collapse runs of 3+ blank lines, and trim the trailing edge — the final mockup string. */
function finish(lines: string[]): string {
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

/** Render a full page. Wraps the model into the `page` block (blocks/page.ts owns the chrome) and renders it. */
export function renderPage(model: PageModel): string {
  return renderBlocksMockup([
    {
      type: "page",
      title: model.title,
      icon: model.icon,
      cover: model.cover,
      description: model.description,
      width: model.width,
      children: model.blocks,
    },
  ]);
}

/** Render a standalone database (its own header + selected view, or all views). */
export function renderDatabase(db: DatabaseModel): string {
  return finish(renderDatabaseLines(db, db.width ?? DEFAULT_WIDTH));
}

/** Render a bare block subtree — no page/database chrome. Non-positive widths fall back to the default. */
export function renderBlocksMockup(blocks: MockupBlock[], width?: number): string {
  return finish(renderBlocks(blocks, width && width > 0 ? width : DEFAULT_WIDTH, 0));
}
