// Display-width-aware text primitives — the renderer pads/truncates/wraps by GRAPHEME width
// (emoji = 2 cells, ZWJ/skin/VS clusters = one glyph), so callers never count characters. Pure leaf.

// display width (grapheme-cluster aware)
const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

function isZeroWidth(codePoint: number): boolean {
  return (
    codePoint === 0x200d ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff) ||
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    codePoint === 0x00ad
  );
}
function isWide(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0x303e) ||
    (codePoint >= 0x3041 && codePoint <= 0x33ff) ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xa000 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6)
  );
}
function isEmoji(codePoint: number): boolean {
  return (
    (codePoint >= 0x1f000 && codePoint <= 0x1faff) ||
    (codePoint >= 0x2600 && codePoint <= 0x27bf) ||
    (codePoint >= 0x2b00 && codePoint <= 0x2bff) ||
    codePoint === 0x231a ||
    codePoint === 0x231b ||
    (codePoint >= 0x23e9 && codePoint <= 0x23fa) ||
    (codePoint >= 0x25fd && codePoint <= 0x25fe) ||
    codePoint === 0x2614 ||
    codePoint === 0x2615 ||
    (codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff)
  );
}
function clusterWidth(cluster: string): number {
  let wide = false;
  let base = false;
  for (const char of cluster) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (isZeroWidth(codePoint)) {
      continue;
    }
    if (isWide(codePoint) || isEmoji(codePoint)) {
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
/**
 * Render text as REAL bold by mapping ASCII letters/digits to their Mathematical Sans-Serif Bold glyphs
 * (𝗖𝗮𝗹𝗲𝗻𝗱𝗮𝗿). Markdown `*…*` / `**…**` are literal inside a monospace code block — these glyphs render
 * bold there anyway, and each is one display column (clusterWidth counts them as 1), so alignment holds.
 * Non-alphanumeric characters pass through unchanged.
 */
export function bold(text: string): string {
  let out = "";
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code >= 0x41 && code <= 0x5a) {
      out += String.fromCodePoint(0x1d5d4 + code - 0x41); // A–Z → 𝗔–𝗭
    } else if (code >= 0x61 && code <= 0x7a) {
      out += String.fromCodePoint(0x1d5ee + code - 0x61); // a–z → 𝗮–𝘇
    } else if (code >= 0x30 && code <= 0x39) {
      out += String.fromCodePoint(0x1d7ec + code - 0x30); // 0–9 → 𝟬–𝟵
    } else {
      out += character;
    }
  }
  return out;
}
/** Truncate `text` to at most `width` display columns, appending `…` when it overflows. */
export function clip(text: string, width: number): string {
  if (displayWidth(text) <= width) {
    return text;
  }
  let out = "";
  let used = 0;
  for (const { segment } of segmenter.segment(text)) {
    const clusterColumns = clusterWidth(segment);
    if (used + clusterColumns > Math.max(0, width - 1)) {
      break;
    }
    out += segment;
    used += clusterColumns;
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
  const wrapWidth = Math.max(1, width);
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para === "") {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (displayWidth(candidate) <= wrapWidth) {
        line = candidate;
        continue;
      }
      if (line) {
        out.push(line);
        line = "";
      }
      let rest = word;
      while (displayWidth(rest) > wrapWidth) {
        const head = clip(rest, wrapWidth + 1).replace(/…$/, "");
        const piece = head === rest ? rest : clipHard(rest, wrapWidth);
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
    const clusterColumns = clusterWidth(segment);
    if (used + clusterColumns > width) {
      break;
    }
    out += segment;
    used += clusterColumns;
  }
  return out || text.slice(0, 1);
}
