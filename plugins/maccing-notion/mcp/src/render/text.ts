// Display-width-aware text primitives — the renderer pads/truncates/wraps by GRAPHEME width
// (emoji = 2 cells, ZWJ/skin/VS clusters = one glyph), so callers never count characters. Pure leaf.

// ── display width (grapheme-cluster aware) ────────────────────────────────────
const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

function isZeroWidth(cp: number): boolean {
  return (
    cp === 0x200d ||
    (cp >= 0xfe00 && cp <= 0xfe0f) ||
    (cp >= 0x1f3fb && cp <= 0x1f3ff) ||
    (cp >= 0x0300 && cp <= 0x036f) ||
    cp === 0x00ad
  );
}
function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6)
  );
}
function isEmoji(cp: number): boolean {
  return (
    (cp >= 0x1f000 && cp <= 0x1faff) ||
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0x2b00 && cp <= 0x2bff) ||
    cp === 0x231a ||
    cp === 0x231b ||
    (cp >= 0x23e9 && cp <= 0x23fa) ||
    (cp >= 0x25fd && cp <= 0x25fe) ||
    cp === 0x2614 ||
    cp === 0x2615 ||
    (cp >= 0x1f1e6 && cp <= 0x1f1ff)
  );
}
function clusterWidth(cluster: string): number {
  let wide = false;
  let base = false;
  for (const ch of cluster) {
    const cp = ch.codePointAt(0) ?? 0;
    if (isZeroWidth(cp)) {
      continue;
    }
    if (isWide(cp) || isEmoji(cp)) {
      wide = true;
    }
    base = true;
  }
  return wide ? 2 : base ? 1 : 0;
}
export function displayWidth(text: string): number {
  let total = 0;
  for (const { segment } of segmenter.segment(text)) {
    total += clusterWidth(segment);
  }
  return total;
}
/** Truncate `text` to at most `width` display columns, appending `…` when it overflows. */
export function clip(text: string, width: number): string {
  if (displayWidth(text) <= width) {
    return text;
  }
  let out = "";
  let used = 0;
  for (const { segment } of segmenter.segment(text)) {
    const cw = clusterWidth(segment);
    if (used + cw > Math.max(0, width - 1)) {
      break;
    }
    out += segment;
    used += cw;
  }
  return `${out}…`;
}
/** Fit to exactly `width`: pad if short, truncate with `…` if long. Keeps every box closed. */
export function padRight(text: string, width: number): string {
  const clipped = clip(text, width);
  return clipped + " ".repeat(Math.max(0, width - displayWidth(clipped)));
}
/** Right-align `right` against `left` within `width` columns. */
export function spread(left: string, right: string, width: number): string {
  const room = width - displayWidth(left) - displayWidth(right);
  return left + " ".repeat(Math.max(1, room)) + right;
}
/** Word-wrap `text` to lines of at most `width` display columns (hard-breaks over-long words). */
export function wordWrap(text: string, width: number): string[] {
  const w = Math.max(1, width);
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para === "") {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (displayWidth(candidate) <= w) {
        line = candidate;
        continue;
      }
      if (line) {
        out.push(line);
        line = "";
      }
      let rest = word;
      while (displayWidth(rest) > w) {
        const head = clip(rest, w + 1).replace(/…$/, "");
        const piece = head === rest ? rest : clipHard(rest, w);
        out.push(piece);
        rest = rest.slice(piece.length);
      }
      line = rest;
    }
    if (line) {
      out.push(line);
    }
  }
  return out.length ? out : [""];
}
/** Take exactly `width` display columns off the front (no ellipsis) — for hard word breaks. */
function clipHard(text: string, width: number): string {
  let out = "";
  let used = 0;
  for (const { segment } of segmenter.segment(text)) {
    const cw = clusterWidth(segment);
    if (used + cw > width) {
      break;
    }
    out += segment;
    used += cw;
  }
  return out || text.slice(0, 1);
}
