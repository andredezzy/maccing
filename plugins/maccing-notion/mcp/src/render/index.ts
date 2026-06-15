// Deterministic ASCII "page mockup" renderer — a COMPOUNDING (recursive, width-flowing) renderer that
// turns a structured model into a faithful, fixed-width visual of how a Notion page / database / block
// subtree looks. The renderer OWNS all alignment: it pads/truncates by DISPLAY width (emoji = 2 cells,
// ZWJ/skin/VS grapheme clusters = one glyph) and word-wraps long text, so callers supply only STRUCTURE
// and never count a character. Every bordered box closes; that invariant holds under recursion (children
// shrink width), columns (width splits + hcat), and database views (table/gallery/board/list).
//
// This file is the thin entry: renderPage(PageModel) · renderDatabase(DatabaseModel) · renderBlocks.
// The model lives in ./model, primitives in ./text + ./box, dispatch in ./engine, and the renderers in
// ./blocks + ./views (imported here only so their register() calls run). `renderMockup` aliases renderPage.

import "./blocks"; // side-effect: registers the block-leaf renderers
import { header } from "./box";
import { renderBlocks } from "./engine";
import type { DatabaseModel, PageModel } from "./model";
import { renderDatabaseLines } from "./views"; // also registers the database-view renderers

export { renderBlocks } from "./engine";
export * from "./model";
export { displayWidth } from "./text";

const DEFAULT_WIDTH = 70;

/** Render a full page (header + recursive body). */
export function renderPage(model: PageModel): string {
  const total = model.width ?? DEFAULT_WIDTH;
  const out = [
    ...header(model.icon, model.title, model.cover, model.description, total),
    ...renderBlocks(model.blocks, total, 0),
  ];
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}
/** @deprecated alias of renderPage — kept for back-compat. */
export const renderMockup = renderPage;

/** Render a standalone database (its own header + selected view, or all views). */
export function renderDatabase(db: DatabaseModel): string {
  const total = db.width ?? DEFAULT_WIDTH;
  return renderDatabaseLines(db, total)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}
