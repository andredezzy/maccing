// The render dispatch engine — a type→renderer registry plus the recursive block walker. This is the
// seam that keeps the block-renderer families from importing each other: each registers here, and
// dispatch is a Map lookup, so the dependency graph stays a DAG (renderers → engine → model). Adding a
// block type (content, container, or view — all blocks) = one register() call + its renderer, never a switch edit.

import type { MockupBlock } from "./model";

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
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    ordinal = block.type === "numbered_list_item" ? ordinal + 1 : 0;
    if (i > 0) {
      const prev = blocks[i - 1];
      const tight = TIGHT.has(prev.type) && TIGHT.has(block.type);
      if (!tight) {
        out.push("");
      }
    }
    out.push(...renderBlock(block, width, depth, ordinal));
  }
  return out;
}
