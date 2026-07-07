// Page — the top-level root concept for a Notion page. Distinct from Block (a page is not a block;
// it has its own chrome: cover band · icon · title · body). renderPage draws the chrome then delegates
// the body to renderBlocks.

import type { BlockObject } from "../notion/blocks/block";
import type { PageObject } from "../notion/page";
import { iconGlyph } from "../readers/object";
import { titleOf } from "../readers/page";
import type { Block } from "./blocks/engine";
import { renderBlocks } from "./blocks/engine";
import { header } from "./box";

export function renderPage(page: PageObject, blocks: BlockObject[], width: number): string[] {
  const icon = iconGlyph(page.icon);
  const title = titleOf(page);
  const cover = page.cover ? "cover" : undefined;
  return [...header(icon, title, cover, undefined, width), ...renderBlocks(blocks as Block[], width, 0)];
}
