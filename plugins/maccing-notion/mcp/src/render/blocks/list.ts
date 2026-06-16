// List view renderer — one line per row: `• [icon] Title   meta`.

import { register } from "../engine";
import { clip } from "../text";
import { databaseHeader } from "./database-header";

interface ListItem {
  icon?: string;
  title: string;
  meta?: string;
}
export interface ListBlock {
  type: "list";
  name: string;
  views?: string[];
  items: ListItem[];
}

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

register("list", renderList);
