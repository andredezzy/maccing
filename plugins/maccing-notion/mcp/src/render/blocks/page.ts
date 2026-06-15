// The "page" container block — page chrome (cover · icon · title · description) above its recursive
// body. Registered like any other block, so a page composes anywhere a block can: at the top level
// (the common case — what renderPage wraps a PageModel into), or nested inside a column/toggle/etc.
// Mirrors the inline "database" block, which wraps a DatabaseModel the same way.

import { header } from "../box";
import { register, renderBlocks } from "../engine";

register("page", (block, width) => {
  const total = block.width ?? width;
  return [
    ...header(block.icon, block.title, block.cover, block.description, total),
    ...renderBlocks(block.children ?? [], total, 0),
  ];
});
