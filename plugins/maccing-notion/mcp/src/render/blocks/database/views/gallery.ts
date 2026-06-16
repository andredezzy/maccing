// Gallery view renderer — cover cards in a row-flow.

import { box, COVER, cardsPerRow, GAP, hcat, MEDIUM_CARD, SMALL_CARD } from "../../../box";
import { databaseHeader } from "../header";
import { registerView } from "./engine";

export interface GalleryCard {
  icon?: string;
  name: string;
  lines?: string[];
}
export interface GalleryBlock {
  type: "gallery";
  name: string;
  views?: string[];
  cardSize?: "small" | "medium";
  cards: GalleryCard[];
}

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
  for (let index = 0; index < cardBoxes.length; index += perRow) {
    lines.push(...hcat(cardBoxes.slice(index, index + perRow), GAP));
  }
  return lines;
}

registerView("gallery", renderGallery);
