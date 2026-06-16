// The database tab-bar header — `◷ Title  ‹ View › ‹ View › +N more   + New`, shared by every view
// renderer. Mirrors Notion: the active (first) tab shows, then as many as fit, then a "+N more" count.

import { clip, displayWidth, spread } from "../../text";

export function databaseHeader(name: string, views: string[] | undefined, total: number): string {
  const right = "+ New";
  const prefix = `◷ ${name}`;
  const tokens = (views ?? []).map((view) => `‹ ${view} ›`);
  if (tokens.length === 0) {
    return spread(prefix, right, total);
  }
  // The tab strip must fit between the prefix (+3-space gap) and "+ New" (with ≥1 space before it).
  // Reserve room for a " +N more" token whenever tabs remain unshown so the count never itself overflows.
  const budget = total - displayWidth(right) - 1 - displayWidth(prefix) - 3;
  let shown = 0;
  for (let count = 1; count <= tokens.length; count++) {
    const hidden = tokens.length - count;
    const candidate = tokens.slice(0, count).join(" ") + (hidden > 0 ? ` +${hidden} more` : "");
    if (displayWidth(candidate) <= budget) {
      shown = count;
    } else {
      break;
    }
  }
  let strip: string;
  if (shown === 0) {
    // Even the active tab + count won't fit — show it clipped so the default view is never hidden.
    const moreSuffix = tokens.length > 1 ? ` +${tokens.length - 1} more` : "";
    strip = clip(tokens[0], Math.max(1, budget - displayWidth(moreSuffix))) + moreSuffix;
  } else {
    const hidden = tokens.length - shown;
    strip = tokens.slice(0, shown).join(" ") + (hidden > 0 ? ` +${hidden} more` : "");
  }
  const left = clip(`${prefix}   ${strip}`, total - displayWidth(right) - 1);
  return spread(left, right, total);
}
