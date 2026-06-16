// The render dispatch engine — it owns the block CONTRACT (the recursive `Block` union) plus a
// type→renderer registry and the recursive walker. Each block's SHAPE lives with its renderer (in ./*.ts)
// and is imported here type-only to assemble the union; each renderer registers itself via registerBlock().
// So the RUNTIME graph stays a clean DAG (renderers → engine; the type imports erase), and adding a block
// type = one new shape + one registerBlock() call in its own file, never a switch edit.

import { createRegistry, type Renderer } from "../registry";
import type { DatabaseBlock } from "./database/database";
import type { DatabaseView } from "./database/views/engine";
import type { ColumnDef } from "./layout";

export type { DatabaseView };

/** All content, media, and structural blocks (including DatabaseBlock). Children are always Blocks, never views. */
export type Block =
  | { type: "paragraph"; text?: string; children?: Block[] }
  | { type: "heading"; text: string } // legacy: bare heading
  | { type: "heading_1" | "heading_2" | "heading_3"; text: string; toggle?: boolean; children?: Block[] }
  | { type: "bulleted_list_item"; text: string; children?: Block[] }
  | { type: "numbered_list_item"; text: string; children?: Block[] }
  | { type: "to_do"; text: string; checked?: boolean; children?: Block[] }
  | { type: "toggle"; text: string; children?: Block[] }
  | { type: "quote"; text: string; children?: Block[] }
  | { type: "callout"; icon?: string; lines: string[]; children?: Block[] }
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
  | { type: "synced_block"; from?: string; children?: Block[] }
  | { type: "page_link"; icon?: string; title: string; note?: string }
  | DatabaseBlock
  | { type: "unsupported"; label?: string };

/** A renderer for one block type. `T` narrows the block to that type at the registration site. */
export type BlockRenderer<T extends Block = Block> = Renderer<T>;

const blockRegistry = createRegistry<Block>();

/** Register the renderer for a block `type`. The handler receives the block already narrowed to it. */
export const registerBlock = blockRegistry.register;

/** Dispatch one block to its registered renderer; an unregistered type renders nothing. */
export const renderBlock = blockRegistry.render;

const TIGHT = new Set(["bulleted_list_item", "numbered_list_item", "to_do"]);

/** Render a list of blocks, threading numbered-list ordinals and smart inter-block spacing. */
export function renderBlocks(blocks: Block[], width: number, depth: number): string[] {
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
