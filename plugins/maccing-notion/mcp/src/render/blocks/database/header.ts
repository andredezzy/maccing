// The database header, emitted as PROSE markdown (NOT box-art) so the SELECTED view renders in REAL bold
// in chat — markdown bold is literal inside a code fence, model-emitted ANSI is stripped, and Unicode bold
// glyphs fall back to a different font, so the only reliable bold is `**…**` in prose OUTSIDE the fence.
// Two lines:
//   ◷ **Title**
//   Views: **Selected**, Other, Other, +N more · + New
// The title and the selected view are wrapped in ** ** (real bold). Tabs collapse to "+N more" once they'd
// exceed `width` (the budget counts the ** markers, so when the collapse succeeds even the RAW string fits
// the canvas — on screen the markers render to nothing, leaving it narrower still). A single tab too long to
// fit on its own is shown in FULL anyway (never clipped) and the prose simply wraps in chat — being prose is
// the whole point, since that is the only place bold renders. `+ New` trails INLINE: prose can't right-align
// (markdown eats runs of spaces), and ` · ` keeps it from reading as just another tab.

import { displayWidth } from "../../text";

const PREFIX = "Views: ";
const SEPARATOR = " · ";
const NEW = "+ New";

export function databaseHeader(
  name: string,
  views: string[] | undefined,
  selected: string | undefined,
  width: number,
): string[] {
  const titleLine = `◷ **${name}**`;

  const list = views ?? [];
  if (list.length === 0) {
    return [titleLine];
  }

  const tokens = list.map((view) => (view === selected ? `**${view}**` : view));

  // Reserve room for the "Views: " prefix and the trailing " · + New", plus a ", +N more" count whenever
  // tabs remain unshown — so the line never overflows even after the count is appended.
  const budget = width - displayWidth(PREFIX) - displayWidth(SEPARATOR) - displayWidth(NEW);
  let shown = tokens.length;
  for (let count = tokens.length; count >= 1; count--) {
    const hidden = tokens.length - count;
    const candidate = tokens.slice(0, count).join(", ") + (hidden > 0 ? `, +${hidden} more` : "");
    if (displayWidth(candidate) <= budget || count === 1) {
      shown = count;
      break;
    }
  }

  const hidden = tokens.length - shown;
  const tabs = tokens.slice(0, shown).join(", ") + (hidden > 0 ? `, +${hidden} more` : "");
  return [titleLine, `${PREFIX}${tabs}${SEPARATOR}${NEW}`];
}
