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
import { createRegistry, type Renderer } from "./registry";

/** The ten database-view block types — rendered as full data views, not as content blocks. */
export type DatabaseView =
  | TableBlock
  | GalleryBlock
  | BoardBlock
  | ListBlock
  | CalendarBlock
  | TimelineBlock
  | ChartBlock
  | FormBlock
  | MapBlock
  | DashboardBlock;

/** All content, media, and structural blocks (including DatabaseBlock and PageBlock). Children are always Blocks, never views. */
export type Block =
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
  | { type: "unsupported"; label?: string };

/** Transitional alias — existing code (blocks/*.ts, schema.ts, index.ts, etc.) still references MockupBlock. */
export type MockupBlock = Block | DatabaseView;

/** A renderer for one block/view type. `T` narrows the block to that type at the registration site. */
export type BlockRenderer<T extends MockupBlock = MockupBlock> = Renderer<T>;

const blocks = createRegistry<MockupBlock>();

/** Register the renderer for a block/view `type`. The handler receives the block already narrowed to it. */
export const registerBlock = blocks.register;

/** Temporary alias — existing block files import `register`; later tasks will migrate them. */
export const register = blocks.register;

/** Dispatch one block to its registered renderer; an unregistered type renders nothing. */
export const renderBlock = blocks.render;

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
