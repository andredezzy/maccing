// Page — the top-level root concept for a Notion page. Distinct from Block (a page is not a block;
// it has its own chrome: cover band · icon · title · description · body). renderPage draws the chrome
// then delegates the body to renderBlocks.

import { type Block, renderBlocks } from "./blocks/engine";
import { header } from "./box";

export interface Page {
  type: "page";
  title: string;
  icon?: string;
  cover?: string;
  description?: string;
  width?: number;
  children: Block[];
}

export function renderPage(page: Page, width: number): string[] {
  const total = page.width ?? width;
  return [
    ...header(page.icon, page.title, page.cover, page.description, total),
    ...renderBlocks(page.children, total, 0),
  ];
}
