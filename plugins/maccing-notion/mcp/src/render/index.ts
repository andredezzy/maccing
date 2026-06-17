// Deterministic ASCII "page mockup" renderer — a COMPOUNDING (recursive, width-flowing) renderer that
// turns a structured model into a faithful, fixed-width visual of how a Notion page / database / block
// subtree looks. The renderer OWNS all alignment: it pads/truncates by DISPLAY width (emoji = 2 cells,
// ZWJ/skin/VS grapheme clusters = one glyph) and word-wraps long text, so callers supply only STRUCTURE
// and never count a character. Every bordered box closes; that invariant holds under recursion (children
// shrink width), columns (width splits + hcat), and database views (table/gallery/board/list).
//
// This file is the thin entry — ONE renderer, render(mockup). It resolves the canvas width, dispatches
// a PageRender, a single Block, a Block[], or a DatabaseRender through the appropriate renderer, and
// finishes the lines.

import "./blocks"; // side-effect: registers every block renderer (content · db views)

import type { BlockObject } from "../notion/blocks/block";
import type { DatabaseRender, PageRender } from "../notion/render-bundles";
import { renderDatabase } from "./blocks/database/database";
import { type Block, renderBlock, renderBlocks } from "./blocks/engine";
import { renderPage } from "./page";

export { mockupSchema } from "./mockup-schema";
export { displayWidth } from "./text";
export type { Block, DatabaseRender, PageRender };

export type Mockup = PageRender | Block | Block[] | DatabaseRender;

const DEFAULT_WIDTH = 70;

/** Join rendered lines, collapse runs of 3+ blank lines, and trim the trailing edge — the final mockup string. */
function finish(lines: string[]): string {
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

/**
 * Render a mockup — a PageRender, a single Block, a Block[], or a DatabaseRender — to the finished string.
 * Resolves the canvas width (default DEFAULT_WIDTH) and dispatches through the appropriate renderer.
 * `viewSelection` chooses which database view to render (index, "all", or default 0); it is ignored for
 * non-database mockups.
 */
export function render(mockup: Mockup, width?: number, viewSelection?: number | "all"): string {
  const total = width && width > 0 ? width : DEFAULT_WIDTH;

  if (Array.isArray(mockup)) {
    return finish(renderBlocks(mockup as Block[], total, 0));
  }

  if ("page" in mockup && "blocks" in mockup) {
    const bundle = mockup as PageRender;
    return finish(renderPage(bundle.page, bundle.blocks as BlockObject[], total));
  }

  if ("database" in mockup && "dataSource" in mockup) {
    return finish(renderDatabase(mockup as DatabaseRender, total, viewSelection));
  }

  // Single Block (BlockObject)
  return finish(renderBlock(mockup as Block, total, 0, 0));
}
