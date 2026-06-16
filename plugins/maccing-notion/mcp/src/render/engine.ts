// The render dispatch engine — it owns the block CONTRACT (the recursive `MockupBlock` union) plus a
// type→renderer registry and the recursive walker. Each block's SHAPE lives with its renderer (in ./blocks/*)
// and is imported here type-only to assemble the union; each renderer registers itself via register(). So the
// RUNTIME graph stays a clean DAG (renderers → engine; the type imports erase), and adding a block type =
// one new shape + one register() call in its own file, never a switch edit. EVERYTHING is a block: content,
// a standalone `database`, a whole `page`, and every db view all flow through here keyed by `type`.

import type { BoardBlock, GalleryBlock } from "./blocks/cards";
import type { ChartBlock, DashboardBlock, FormBlock, MapBlock, TableBlock } from "./blocks/data";
import type { DatabaseBlock } from "./blocks/database";
import type { ColumnDef } from "./blocks/layout";
import type { ListBlock } from "./blocks/list";
import type { PageBlock } from "./blocks/page";
import type { CalendarBlock, TimelineBlock } from "./blocks/time";

export type MockupBlock =
  | { type: "paragraph"; text?: string; children?: MockupBlock[] }
  | { type: "heading"; text: string } // legacy: bare heading
  | { type: "heading_1" | "heading_2" | "heading_3"; text: string; toggle?: boolean; children?: MockupBlock[] }
  | { type: "bulleted_list_item"; text: string; children?: MockupBlock[] }
  | { type: "numbered_list_item"; text: string; children?: MockupBlock[] }
  | { type: "to_do"; text: string; checked?: boolean; children?: MockupBlock[] }
  | { type: "toggle"; text: string; children?: MockupBlock[] }
  | { type: "quote"; text: string; children?: MockupBlock[] }
  | { type: "callout"; icon?: string; lines: string[]; children?: MockupBlock[] }
  | { type: "divider" }
  | { type: "code"; language?: string; text: string; caption?: string }
  | { type: "equation"; expression: string }
  | { type: "image" | "video" | "audio" | "file" | "pdf"; url?: string; name?: string; caption?: string }
  | { type: "bookmark" | "link_preview"; url: string; caption?: string }
  | { type: "embed"; label: string }
  | { type: "column_list"; columns: ColumnDef[] }
  | { type: "simple_table"; rows: string[][]; hasColumnHeader?: boolean }
  | { type: "breadcrumb"; path?: string[] }
  | { type: "table_of_contents"; headings?: string[] }
  | { type: "synced_block"; from?: string; children?: MockupBlock[] }
  | { type: "page_link"; icon?: string; title: string; note?: string }
  | DatabaseBlock
  | PageBlock
  | TableBlock
  | GalleryBlock
  | BoardBlock
  | ListBlock
  | CalendarBlock
  | TimelineBlock
  | ChartBlock
  | FormBlock
  | MapBlock
  | DashboardBlock
  | { type: "unsupported"; label?: string };

/** A renderer for one block/view type. `T` narrows the block to that type at the registration site. */
export type BlockRenderer<T extends MockupBlock = MockupBlock> = (
  block: T,
  width: number,
  depth: number,
  ordinal: number,
) => string[];

const registry = new Map<string, BlockRenderer>();

/** Register the renderer for a block/view `type`. The handler receives the block already narrowed to it. */
export function register<T extends MockupBlock["type"]>(
  type: T,
  render: BlockRenderer<Extract<MockupBlock, { type: T }>>,
): void {
  registry.set(type, render as BlockRenderer);
}

/** Dispatch one block to its registered renderer; an unregistered type renders nothing. */
export function renderBlock(block: MockupBlock, width: number, depth: number, ordinal: number): string[] {
  return registry.get(block.type)?.(block, width, depth, ordinal) ?? [];
}

const TIGHT = new Set(["bulleted_list_item", "numbered_list_item", "to_do"]);

/** Render a list of blocks, threading numbered-list ordinals and smart inter-block spacing. */
export function renderBlocks(blocks: MockupBlock[], width: number, depth: number): string[] {
  const out: string[] = [];
  let ordinal = 0;
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    ordinal = block.type === "numbered_list_item" ? ordinal + 1 : 0;
    if (index > 0) {
      const prev = blocks[index - 1];
      const tight = TIGHT.has(prev.type) && TIGHT.has(block.type);
      if (!tight) {
        out.push("");
      }
    }
    out.push(...renderBlock(block, width, depth, ordinal));
  }
  return out;
}
