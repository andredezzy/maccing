// Deterministic ASCII "page mockup" renderer — a COMPOUNDING (recursive, width-flowing) renderer that
// turns a structured model into a faithful, fixed-width visual of how a Notion page / database / block
// subtree looks. The renderer OWNS all alignment: it pads/truncates by DISPLAY width (emoji = 2 cells,
// ZWJ/skin/VS grapheme clusters = one glyph) and word-wraps long text, so callers supply only STRUCTURE
// and never count a character. Every bordered box closes; that invariant holds under recursion (children
// shrink width), columns (width splits + hcat), and database views (table/gallery/board/list).
//
// This file is the thin entry — ONE renderer, render(mockup), because EVERYTHING is a block: a whole page
// and a standalone database are blocks too (with their own chrome). It resolves the canvas width, dispatches
// a single block (or a smart-spaced list) through the registry, and finishes the lines. The block shapes
// live in ./model, primitives in ./text + ./box, dispatch in ./engine, and EVERY renderer in ./blocks
// (content, page/database containers, and db views alike — they are all blocks).

import "./blocks"; // side-effect: registers every block renderer (content · page/database containers · db views)
import { type MockupBlock, renderBlock, renderBlocks } from "./engine";

export { databaseToModel, groupOptionsFor, resolveView } from "./database-model";
export type { MockupBlock } from "./engine";
export { pageToBlock, type RawBlock, type RawPage } from "./page-model";
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

/**
 * Render a mockup — a single block OR a list of blocks — to the finished fixed-width string. The one render
 * entry: EVERYTHING is a block (a page and a standalone database included), so it resolves the canvas width
 * (default DEFAULT_WIDTH), dispatches through the registry (one block, or a smart-spaced list), and finishes.
 */
export function render(mockup: MockupBlock | MockupBlock[], width?: number): string {
  const total = width && width > 0 ? width : DEFAULT_WIDTH;
  const lines = Array.isArray(mockup) ? renderBlocks(mockup, total, 0) : renderBlock(mockup, total, 0, 0);
  return finish(lines);
}
