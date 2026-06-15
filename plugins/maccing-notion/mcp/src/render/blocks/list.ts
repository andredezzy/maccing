// List view renderer — one line per row: `• [icon] Title   meta`.

import { register } from "../engine";
import type { ListBlock } from "../model";
import { clip } from "../text";
import { databaseHeader } from "./database-header";

function renderList(block: ListBlock, total: number): string[] {
  const lines = [databaseHeader(block.name, block.views, total)];
  if (block.items.length === 0) {
    return [...lines, "(empty)"];
  }
  for (const item of block.items) {
    const head = `• ${item.icon ? `${item.icon} ` : ""}${item.title}`;
    lines.push(item.meta ? clip(`${head}   ${item.meta}`, total) : clip(head, total));
  }
  return lines;
}

register("list", (block, width) => renderList(block, width));
