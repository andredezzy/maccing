// Gallery view renderer — cover cards in a row-flow.

import { box, COVER, cardsPerRow, GAP, hcat, MEDIUM_CARD } from "../../../box";
import { registerView, type ViewRenderNode } from "./engine";
import { cellValue, rowTitle, visibleColumns } from "./helpers";

interface GalleryCard {
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

  if (cardBoxes.length === 0) {
    return box(["(empty)"], total - 2);
  }
  const lines: string[] = [];
  for (let index = 0; index < cardBoxes.length; index += perRow) {
    lines.push(...hcat(cardBoxes.slice(index, index + perRow), GAP));
  }
  return lines;
}

registerView("gallery", renderGallery);
