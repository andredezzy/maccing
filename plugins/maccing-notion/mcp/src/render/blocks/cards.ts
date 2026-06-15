// Card-grid view renderers — gallery (cover cards in a row-flow) and board (status columns side by side).

import { box, COVER, cardsPerRow, GAP, hcat, MEDIUM_CARD, SMALL_CARD } from "../box";
import { register } from "../engine";
import type { BoardBlock, GalleryBlock } from "../model";
import { databaseHeader } from "./database-header";

function renderGallery(block: GalleryBlock, total: number): string[] {
  const inner = block.cardSize === "medium" ? MEDIUM_CARD : SMALL_CARD;
  const coverRows = block.cardSize === "medium" ? 2 : 1;
  const perRow = cardsPerRow(inner, total);
  const cardBoxes = block.cards.map((card) =>
    box(
      [...Array(coverRows).fill(COVER), card.icon ? `${card.icon} ${card.name}` : card.name, ...(card.lines ?? [])],
      inner,
    ),
  );
  const lines = [databaseHeader(block.name, block.views, total)];
  if (cardBoxes.length === 0) {
    return [...lines, ...box(["(empty)"], total - 2)];
  }
  for (let i = 0; i < cardBoxes.length; i += perRow) {
    lines.push(...hcat(cardBoxes.slice(i, i + perRow), GAP));
  }
  return lines;
}
function renderBoard(block: BoardBlock, total: number): string[] {
  const lines = [databaseHeader(block.name, block.views, total)];
  if (block.groups.length === 0) {
    return [...lines, ...box(["(no groups)"], total - 2)];
  }
  const colInner = Math.max(
    SMALL_CARD,
    Math.floor((total - (block.groups.length - 1) * GAP) / block.groups.length) - 2,
  );
  const columns = block.groups.map((group) => {
    const head = box([`${group.name}  (${group.total ?? group.cards.length})`], colInner);
    const cards = group.cards.flatMap((card) =>
      box([card.icon ? `${card.icon} ${card.name}` : card.name, ...(card.lines ?? [])], colInner),
    );
    return [...head, ...cards];
  });
  return [...lines, ...hcat(columns, GAP)];
}

register("gallery", (block, width) => renderGallery(block, width));
register("board", (block, width) => renderBoard(block, width));
