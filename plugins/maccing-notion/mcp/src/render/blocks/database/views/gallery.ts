// Gallery view renderer — cover cards in a row-flow.

import { box, COVER, cardsPerRow, GAP, hcat, MEDIUM_CARD } from "../../../box";
import { databaseHeader } from "../header";
import { registerView, type ViewRenderNode } from "./engine";
import { cellValue, rowTitle, visibleColumns } from "./helpers";

export interface GalleryCard {
  icon?: string;
  name: string;
  lines?: string[];
}

function renderGallery(node: ViewRenderNode, total: number): string[] {
  const columns = visibleColumns(node.view, node.dataSource, node.titleColumn);
  const otherColumns = columns.filter((column) => column !== node.titleColumn);
  const inner = MEDIUM_CARD;
  const coverRows = 2;
  const perRow = cardsPerRow(inner, total);

  const cardBoxes = node.rows.map((row) => {
    const card: GalleryCard = {
      name: rowTitle(row, node.titleColumn),
      lines: otherColumns.map((column) => cellValue(row, column)).filter(Boolean),
    };
    return box(
      [...Array(coverRows).fill(COVER), card.icon ? `${card.icon} ${card.name}` : card.name, ...(card.lines ?? [])],
      inner,
    );
  });

  const lines = [databaseHeader(node.dbTitle, node.tabs, total)];
  if (cardBoxes.length === 0) {
    return [...lines, ...box(["(empty)"], total - 2)];
  }
  for (let index = 0; index < cardBoxes.length; index += perRow) {
    lines.push(...hcat(cardBoxes.slice(index, index + perRow), GAP));
  }
  return lines;
}

registerView("gallery", renderGallery);
