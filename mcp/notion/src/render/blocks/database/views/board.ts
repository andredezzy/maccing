// Board view renderer — status columns side by side.

import { groupOptionsFor } from "../../../../readers/views";
import { box, GAP, hcat, SMALL_CARD } from "../../../box";
import { registerView, type ViewRenderNode } from "./engine";
import { cellValue, rowTitle } from "./helpers";

interface BoardGroup {
  name: string;
  cards: { name: string }[];
  total?: number;
}

const BOARD_CARD_CAP = 6;

function renderBoard(node: ViewRenderNode, total: number): string[] {
  const schema = node.dataSource.properties ?? {};
  const config = node.view.configuration ?? {};

  // Resolve group-by column name from the view's group_by property_id.
  const groupByPropId = (config.group_by as { property_id?: string } | undefined)?.property_id;
  const idToNameEntry = groupByPropId
    ? Object.entries(schema).find(([, property]) => property.id === groupByPropId)
    : undefined;
  const groupByName = idToNameEntry?.[0] ?? (groupByPropId ? groupByPropId : undefined);

  // Seed empty groups from the schema options, then fill with rows.
  const groups = new Map<string, { name: string }[]>();
  const options = groupByName ? groupOptionsFor(groupByName, schema) : undefined;
  for (const option of options ?? []) {
    groups.set(option, []);
  }
  for (const row of node.rows) {
    const key = groupByName ? cellValue(row, groupByName) || "(empty)" : "(empty)";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push({ name: rowTitle(row, node.titleColumn) });
  }

  const boardGroups: BoardGroup[] = [...groups].map(([name, cards]) => {
    if (cards.length <= BOARD_CARD_CAP) {
      return { name, cards };
    }
    return {
      name,
      total: cards.length,
      cards: [...cards.slice(0, BOARD_CARD_CAP), { name: `+${cards.length - BOARD_CARD_CAP} more` }],
    };
  });

  if (boardGroups.length === 0) {
    return box(["(no groups)"], total - 2);
  }
  const columnInner = Math.max(
    SMALL_CARD,
    Math.floor((total - (boardGroups.length - 1) * GAP) / boardGroups.length) - 2,
  );
  const columns = boardGroups.map((group) => {
    const head = box([`${group.name}  (${group.total ?? group.cards.length})`], columnInner);
    const cards = group.cards.flatMap((card) => box([card.name], columnInner));
    return [...head, ...cards];
  });
  return hcat(columns, GAP);
}

registerView("board", renderBoard);
