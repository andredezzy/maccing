// Deterministic ASCII "page mockup" renderer — a COMPOUNDING (recursive, width-flowing) renderer that
// turns a structured model into a faithful, fixed-width visual of how a Notion page / database / block
// subtree looks. The renderer OWNS all alignment: it pads/truncates by DISPLAY width (emoji = 2 cells,
// ZWJ/skin/VS grapheme clusters = one glyph) and word-wraps long text, so callers supply only STRUCTURE
// and never count a character. Every bordered box closes; that invariant holds under recursion (children
// shrink width), columns (width splits + hcat), and database views (table/gallery/board/list).
//
// This file is the thin entry — ONE renderer, render(mockup). It resolves the canvas width, dispatches
// a Page, a single Block, or a list of Blocks through the registry, and finishes the lines.

import "./blocks"; // side-effect: registers every block renderer (content · database container · db views)
import { type Block, renderBlock, renderBlocks } from "./blocks/engine";
import { type Page, renderPage } from "./page";

export { databaseToModel, groupOptionsFor, resolveView } from "./database-model";
export { pageFromNotion, type RawBlock, type RawPage } from "./page-model";
export { mockupSchema } from "./schema";
export { displayWidth } from "./text";
export type { Block, Page };

export type Mockup = Page | Block | Block[];

const DEFAULT_WIDTH = 70;

/** Join rendered lines, collapse runs of 3+ blank lines, and trim the trailing edge — the final mockup string. */
function finish(lines: string[]): string {
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

/**
 * Render a mockup — a Page, a single Block, or a list of Blocks — to the finished fixed-width string.
 * A Page gets its own chrome (cover · icon · title · description · body). A Block (or array) renders
 * body-only. Resolves the canvas width (default DEFAULT_WIDTH) and dispatches through the registry.
 */
export function render(mockup: Mockup, width?: number): string {
  const total = width && width > 0 ? width : DEFAULT_WIDTH;
  const lines = Array.isArray(mockup)
    ? renderBlocks(mockup, total, 0)
    : mockup.type === "page"
      ? renderPage(mockup, total)
      : renderBlock(mockup, total, 0, 0);
  return finish(lines);
}
