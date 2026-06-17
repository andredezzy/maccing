// The render dispatch engine — it owns the block CONTRACT (the recursive `Block` union = BlockObject)
// plus a type→renderer registry and the recursive walker. Each block's SHAPE lives with its renderer (in ./*.ts)
// and is imported here type-only to assemble the union; each renderer registers itself via registerBlock().
// So the RUNTIME graph stays a clean DAG (renderers → engine; the type imports erase), and adding a block
// type = one new shape + one registerBlock() call in its own file, never a switch edit.

import type { BlockObject } from "../../notion/blocks/block";
import { createRegistry, type Renderer } from "../registry";

/** All content, media, and structural blocks. */
export type Block = BlockObject;

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
