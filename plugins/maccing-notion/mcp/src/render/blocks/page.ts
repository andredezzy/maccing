// The "page" container block — page chrome (cover · icon · title · description) above its recursive
// body. Registered like any other block, so a page composes anywhere a block can: at the top level
// (the common case — read_page builds one via pageToBlock; render() dispatches it), or nested inside a
// column/toggle/etc. Mirrors the inline "database" block, which wraps a DatabaseModel the same way.

import { header } from "../box";
import { type MockupBlock, register, renderBlocks } from "../engine";

export interface PageBlock {
  type: "page";
  title: string;
  icon?: string;
  cover?: string;
  description?: string;
  width?: number;
  children?: MockupBlock[];
}

register("page", (block, width) => {
  const total = block.width ?? width;
  return [
    ...header(block.icon, block.title, block.cover, block.description, total),
    ...renderBlocks(block.children ?? [], total, 0),
  ];
});
