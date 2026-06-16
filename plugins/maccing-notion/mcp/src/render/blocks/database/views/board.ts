// Board view renderer — status columns side by side.

import { box, GAP, hcat, SMALL_CARD } from "../../../box";
import { databaseHeader } from "../header";
import { registerView } from "./engine";
import type { GalleryCard } from "./gallery";

interface BoardGroup {
  name: string;
  cards: GalleryCard[];
  total?: number; // true card count when `cards` is capped (a "+N more" tail card stands in for the rest)
}
export interface BoardBlock {
  type: "board";
  name: string;
  views?: string[];
  groups: BoardGroup[];
}

function renderBoard(block: BoardBlock, total: number): string[] {
  const lines = [databaseHeader(block.name, block.views, total)];
  if (block.groups.length === 0) {
    return [...lines, ...box(["(no groups)"], total - 2)];
  }
  const columnInner = Math.max(
    SMALL_CARD,
    Math.floor((total - (block.groups.length - 1) * GAP) / block.groups.length) - 2,
  );
  const columns = block.groups.map((group) => {
    const head = box([`${group.name}  (${group.total ?? group.cards.length})`], columnInner);
    const cards = group.cards.flatMap((card) =>
      box([card.icon ? `${card.icon} ${card.name}` : card.name, ...(card.lines ?? [])], columnInner),
    );
    return [...head, ...cards];
  });
  return [...lines, ...hcat(columns, GAP)];
}

registerView("board", renderBoard);
