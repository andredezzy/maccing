// The database header — two lines, shared by every view renderer:
//   ◷ Title
//   Views: *Selected*, Other, Other, +N more                              + New
// The title is on its own line; the views line lists the tabs comma-separated (the SELECTED view in
// *bold*), as many as fit, then a "+N more" count, with "+ New" right-aligned. Mirrors Notion's header.

import { clip, displayWidth, spread } from "../../text";

export function databaseHeader(
  name: string,
  views: string[] | undefined,
  selected: string | undefined,
  total: number,
): string {
  const titleLine = clip(`◷ ${name}`, total);

  const list = views ?? [];
  if (list.length === 0) {
    return titleLine;
  }

  const right = "+ New";
  const prefix = "Views: ";
  // Bold the selected view with *…*; the asterisks count toward width, so build tokens first.
  const tokens = list.map((view) => (view === selected ? `*${view}*` : view));

  // The list must fit between the "Views: " prefix and "+ New" (≥1 space before it); reserve room for a
  // ", +N more" suffix whenever tabs remain unshown so the count never itself overflows.
  const budget = total - displayWidth(right) - 1 - displayWidth(prefix);
  let shown = 0;
  for (let count = 1; count <= tokens.length; count++) {
    const hidden = tokens.length - count;
    const candidate = tokens.slice(0, count).join(", ") + (hidden > 0 ? `, +${hidden} more` : "");
    if (displayWidth(candidate) <= budget) {
      shown = count;
    } else {
      break;
    }
  }

  let strip: string;
  if (shown === 0) {
    // Even the first view + count won't fit — show it clipped so the selected/default view is never hidden.
    const moreSuffix = tokens.length > 1 ? `, +${tokens.length - 1} more` : "";
    strip = clip(tokens[0], Math.max(1, budget - displayWidth(moreSuffix))) + moreSuffix;
  } else {
    const hidden = tokens.length - shown;
    strip = tokens.slice(0, shown).join(", ") + (hidden > 0 ? `, +${hidden} more` : "");
  }

  const left = clip(`${prefix}${strip}`, total - displayWidth(right) - 1);
  return `${titleLine}\n${spread(left, right, total)}`;
}
