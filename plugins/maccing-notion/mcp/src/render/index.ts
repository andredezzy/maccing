// Deterministic ASCII "page mockup" renderer — a COMPOUNDING (recursive, width-flowing) renderer that
// turns a structured model into a faithful, fixed-width visual of how a Notion page / database / block
// subtree looks. The renderer OWNS all alignment: it pads/truncates by DISPLAY width (emoji = 2 cells,
// ZWJ/skin/VS grapheme clusters = one glyph) and word-wraps long text, so callers supply only STRUCTURE
// and never count a character. Every bordered box closes; that invariant holds under recursion (children
// shrink width), columns (width splits + hcat), and database views (table/gallery/board/list).
//
// Entry points: renderPage(PageModel) · renderDatabase(DatabaseModel) · renderBlocks(Block[], width).
// `renderMockup` is kept as an alias of renderPage for back-compat.

const DEFAULT_WIDTH = 70;
const GAP = 2;
const SMALL_CARD = 14;
const MEDIUM_CARD = 20;

import type {
  BoardBlock,
  CalendarBlock,
  ChartBlock,
  ColumnDef,
  DashboardBlock,
  DatabaseModel,
  FormBlock,
  GalleryBlock,
  ListViewBlock,
  MapBlock,
  MockupBlock,
  PageModel,
  TimelineBlock,
} from "./model";

export * from "./model";

import { clip, displayWidth, padRight, spread, wordWrap } from "./text";

export { displayWidth } from "./text";

// ── box primitives ────────────────────────────────────────────────────────────
const COVER = " COVER";

function box(lines: string[], inner: number): string[] {
  const out = [`┌${"─".repeat(inner)}┐`];
  for (const line of lines) {
    out.push(line === COVER ? `│${"▒".repeat(inner)}│` : `│${padRight(` ${line}`, inner)}│`);
  }
  out.push(`└${"─".repeat(inner)}┘`);
  return out;
}
function hcat(boxes: string[][], gap: number): string[] {
  if (boxes.length === 0) {
    return [];
  }
  const height = Math.max(...boxes.map((b) => b.length));
  const padded = boxes.map((b) => {
    const w = b.length > 0 ? displayWidth(b[0]) : 0;
    return [...b, ...Array(height - b.length).fill(" ".repeat(w))];
  });
  const rows: string[] = [];
  for (let r = 0; r < height; r++) {
    rows.push(padded.map((b) => b[r]).join(" ".repeat(gap)));
  }
  return rows;
}
function cardsPerRow(inner: number, total: number): number {
  let n = 1;
  while ((n + 1) * (inner + 2) + n * GAP <= total) {
    n++;
  }
  return n;
}
function fitColumns(natural: number[], total: number): number[] {
  const widths = [...natural];
  let extra = total - (3 * widths.length + 1) - widths.reduce((a, b) => a + b, 0);
  for (let i = 0; extra > 0; i = (i + 1) % widths.length, extra--) {
    widths[i]++;
  }
  return widths;
}

// ── recursive block rendering ──────────────────────────────────────────────────
const TIGHT = new Set(["bulleted_list_item", "numbered_list_item", "to_do"]);
const BULLETS = ["•", "◦", "▪"];

function indent(lines: string[], by: number): string[] {
  const pad = " ".repeat(by);
  return lines.map((l) => pad + l);
}
function childLines(children: MockupBlock[] | undefined, width: number, by: number, depth: number): string[] {
  if (!children || children.length === 0) {
    return [];
  }
  return indent(renderBlocks(children, Math.max(1, width - by), depth), by);
}
/** A marker + word-wrapped text, with continuation lines aligned under the text; then children. */
function flow(
  marker: string,
  text: string,
  width: number,
  children: MockupBlock[] | undefined,
  childIndent: number,
  childDepth: number,
): string[] {
  const mw = displayWidth(marker);
  const wrapped = wordWrap(text ?? "", Math.max(1, width - mw));
  const lines = wrapped.map((w, i) => (i === 0 ? marker : " ".repeat(mw)) + w);
  return [...lines, ...childLines(children, width, childIndent, childDepth)];
}

function renderTableGrid(columns: string[], rows: string[][], total: number, headerSep: string): string[] {
  const natural = columns.map((col, i) => Math.max(displayWidth(col), ...rows.map((r) => displayWidth(r[i] ?? ""))));
  const widths = fitColumns(natural, total);
  const rule = (l: string, m: string, r: string, ch: string): string =>
    l + widths.map((w) => ch.repeat(w + 2)).join(m) + r;
  const line = (cells: string[]): string => `│${widths.map((w, i) => ` ${padRight(cells[i] ?? "", w)} `).join("│")}│`;
  return [
    rule("┌", "┬", "┐", "─"),
    line(columns),
    rule("├", "┼", "┤", headerSep),
    ...rows.map(line),
    rule("└", "┴", "┘", "─"),
  ];
}

function dbHeader(name: string, views: string[] | undefined, total: number): string {
  const right = "+ New";
  const prefix = `◷ ${name}`;
  const tokens = (views ?? []).map((v) => `‹ ${v} ›`);
  if (tokens.length === 0) {
    return spread(prefix, right, total);
  }
  // Notion shows the active (first) tab, then as many as fit, then "N more…". Mirror that: the tab strip
  // must fit between the prefix (+3-space gap) and "+ New" (with ≥1 space before it). Reserve room for a
  // " +N more" token whenever tabs remain unshown so the count never itself overflows.
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
  const lines = [dbHeader(block.name, block.views, total)];
  if (cardBoxes.length === 0) {
    return [...lines, ...box(["(empty)"], total - 2)];
  }
  for (let i = 0; i < cardBoxes.length; i += perRow) {
    lines.push(...hcat(cardBoxes.slice(i, i + perRow), GAP));
  }
  return lines;
}
function renderBoard(block: BoardBlock, total: number): string[] {
  const lines = [dbHeader(block.name, block.views, total)];
  if (block.groups.length === 0) {
    return [...lines, ...box(["(no groups)"], total - 2)];
  }
  const colInner = Math.max(
    SMALL_CARD,
    Math.floor((total - (block.groups.length - 1) * GAP) / block.groups.length) - 2,
  );
  const columns = block.groups.map((group) => {
    const header = box([`${group.name}  (${group.total ?? group.cards.length})`], colInner);
    const cards = group.cards.flatMap((card) =>
      box([card.icon ? `${card.icon} ${card.name}` : card.name, ...(card.lines ?? [])], colInner),
    );
    return [...header, ...cards];
  });
  return [...lines, ...hcat(columns, GAP)];
}
function renderListView(block: ListViewBlock, total: number): string[] {
  const lines = [dbHeader(block.name, block.views, total)];
  if (block.items.length === 0) {
    return [...lines, "(empty)"];
  }
  for (const item of block.items) {
    const head = `• ${item.icon ? `${item.icon} ` : ""}${item.title}`;
    lines.push(item.meta ? clip(`${head}   ${item.meta}`, total) : clip(head, total));
  }
  return lines;
}
function renderColumns(columns: ColumnDef[], total: number): string[] {
  const n = columns.length;
  if (n === 0) {
    return [];
  }
  const sep = " │ ";
  const content = total - (n - 1) * displayWidth(sep);
  const totalRatio = columns.reduce((a, c) => a + (c.ratio ?? 1), 0);
  const widths = columns.map((c) => Math.max(3, Math.floor((content * (c.ratio ?? 1)) / totalRatio)));
  const rendered = columns.map((c, i) => renderBlocks(c.children, widths[i], 0).map((l) => padRight(l, widths[i])));
  const height = Math.max(0, ...rendered.map((r) => r.length));
  const out: string[] = [];
  for (let r = 0; r < height; r++) {
    out.push(rendered.map((col, i) => col[r] ?? " ".repeat(widths[i])).join(sep));
  }
  return out;
}

function mediaBox(
  label: string,
  url: string | undefined,
  name: string | undefined,
  caption: string | undefined,
  total: number,
): string[] {
  const body = [`${label}  ${name ?? url ?? ""}`.trim()];
  if (caption) {
    body.push(caption);
  }
  return box(body, total - 2);
}

// ── Phase-2 views (calendar / timeline / chart / form / map / dashboard) ─────────
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
/** Day of week (0=Sun) via Sakamoto — pure, no ambient Date. */
function dayOfWeek(year: number, month: number, day: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const y = month < 3 ? year - 1 : year;
  return (((y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[month - 1] + day) % 7) + 7) % 7;
}
function daysInMonth(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
function renderCalendar(block: CalendarBlock, total: number): string[] {
  const month = ((block.month - 1 + 12) % 12) + 1;
  const lines = [dbHeader(block.name, block.views, total), `${MONTHS[month - 1]} ${block.year}`];
  const first = dayOfWeek(block.year, month, 1);
  const days = daysInMonth(block.year, month);
  const eventDays = new Set((block.events ?? []).map((e) => e.day));
  const cells: string[] = [];
  for (let i = 0; i < first; i++) {
    cells.push("");
  }
  for (let d = 1; d <= days; d++) {
    cells.push(eventDays.has(d) ? `${d} •` : `${d}`);
  }
  while (cells.length % 7 !== 0) {
    cells.push("");
  }
  const weeks: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  lines.push(...renderTableGrid(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], weeks, total, "─"));
  for (const event of block.events ?? []) {
    lines.push(clip(`  • ${event.day} — ${event.title}`, total));
  }
  return lines;
}
function renderTimeline(block: TimelineBlock, total: number): string[] {
  const lines = [dbHeader(block.name, block.views, total)];
  const nameW = Math.max(8, Math.floor(total * 0.3));
  const barW = Math.max(1, total - nameW - 1);
  if (block.axis) {
    lines.push(`${padRight("", nameW)}│${padRight(block.axis, barW)}`);
  }
  for (const row of block.rows) {
    const s = Math.max(0, Math.min(barW, Math.round((row.start || 0) * barW)));
    const e = Math.max(s, Math.min(barW, Math.round((row.end || 0) * barW)));
    const bar = Array.from({ length: barW }, (_, i) => (i >= s && i < e ? "█" : "·")).join("");
    lines.push(`${padRight(row.label, nameW)}│${bar}`);
  }
  return lines;
}
function renderChart(block: ChartBlock, total: number): string[] {
  const lines = [dbHeader(block.name, block.views, total)];
  if (block.chartType === "number") {
    const value = block.value ?? String(block.data?.[0]?.value ?? 0);
    return [...lines, ...box([`  ${value}${block.unit ? ` ${block.unit}` : ""}`], total - 2)];
  }
  const data = block.data ?? [];
  if (data.length === 0) {
    return [...lines, ...box(["(no data)"], total - 2)];
  }
  const labelW = Math.min(20, Math.max(...data.map((d) => displayWidth(d.label))));
  const valStrs = data.map((d) => String(d.value));
  const valW = Math.max(...valStrs.map(displayWidth));
  const barW = Math.max(1, total - labelW - valW - 2);
  const max = Math.max(1, ...data.map((d) => d.value));
  for (let i = 0; i < data.length; i++) {
    const filled = Math.round((data[i].value / max) * barW);
    const bar = "█".repeat(filled) + "·".repeat(Math.max(0, barW - filled));
    lines.push(`${padRight(data[i].label, labelW)} ${bar} ${padRight(valStrs[i], valW)}`);
  }
  return lines;
}
function renderForm(block: FormBlock, total: number): string[] {
  const widget = (fieldType?: string): string =>
    fieldType === "checkbox"
      ? "[ ]"
      : fieldType === "select"
        ? "[ ▾ ]"
        : fieldType === "date"
          ? "[ 📅 ]"
          : fieldType === "person"
            ? "[ @ ]"
            : "[ _____ ]";
  const fields = block.fields.map((f) => clip(`${f.label}:  ${widget(f.fieldType)}`, total - 2));
  return [dbHeader(block.name, block.views, total), ...box([...fields, "", "[ Submit ]"], total - 2)];
}
function renderMap(block: MapBlock, total: number): string[] {
  return [dbHeader(block.name, block.views, total), ...box(["[ map view ]", `  ${block.pins ?? 0} pin(s)`], total - 2)];
}
function renderDashboard(block: DashboardBlock, total: number): string[] {
  const lines = [dbHeader(block.name, block.views, total)];
  for (const widget of block.widgets) {
    lines.push("", `▸ ${widget.title}`, ...renderBlock(widget.view, total, 0, 0));
  }
  return lines;
}

function renderBlock(block: MockupBlock, width: number, depth: number, ordinal: number): string[] {
  switch (block.type) {
    case "paragraph":
      return [...(block.text ? wordWrap(block.text, width) : [""]), ...childLines(block.children, width, 2, 0)];
    case "heading":
      return ["", block.text];
    case "heading_1":
    case "heading_2":
    case "heading_3": {
      const level = block.type === "heading_1" ? 1 : block.type === "heading_2" ? 2 : 3;
      const marker = `${"#".repeat(level)} ${block.toggle ? "▸ " : ""}`;
      const lines = flow(marker, block.text, width, block.toggle ? block.children : undefined, 2, 0);
      return ["", ...lines];
    }
    case "bulleted_list_item":
      return flow(`${BULLETS[Math.min(depth, 2)]} `, block.text, width, block.children, 2, depth + 1);
    case "numbered_list_item":
      return flow(`${ordinal || 1}. `, block.text, width, block.children, 3, 0);
    case "to_do":
      return flow(`[${block.checked ? "x" : " "}] `, block.text, width, block.children, 4, 0);
    case "toggle":
      return flow("▸ ", block.text, width, block.children, 2, 0);
    case "quote": {
      const wrapped = wordWrap(block.text, Math.max(1, width - 2)).map((l) => `│ ${l}`);
      const kids = childLines(block.children, width - 2, 0, 0).map((l) => `│ ${l}`);
      return [...wrapped, ...kids];
    }
    case "callout": {
      const head = block.icon ? `${block.icon} ${block.lines[0] ?? ""}` : (block.lines[0] ?? "");
      const body = [head, ...block.lines.slice(1)];
      const kids = block.children ? renderBlocks(block.children, width - 4, 0) : [];
      return box([...body, ...kids], width - 2);
    }
    case "divider":
      return ["─".repeat(width)];
    case "code":
      return [
        ...box([`‹${block.language ?? "code"}›`, ...block.text.split("\n")], width - 2),
        ...(block.caption ? [block.caption] : []),
      ];
    case "equation":
      return ["$$", block.expression, "$$"];
    case "image":
    case "video":
    case "audio":
    case "file":
    case "pdf":
      return mediaBox(`[${block.type.toUpperCase()}]`, block.url, block.name, block.caption, width);
    case "bookmark":
    case "link_preview":
      return mediaBox("🔖", block.url, undefined, block.caption, width);
    case "embed":
      return box([`▶ ${block.label}`], width - 2);
    case "column_list":
      return renderColumns(block.columns, width);
    case "simple_table":
      return renderTableGrid(
        block.rows[0] ?? [],
        block.rows.slice(1),
        width,
        block.hasColumnHeader === false ? "─" : "═",
      );
    case "breadcrumb":
      return [clip((block.path ?? ["…"]).join("  /  "), width)];
    case "table_of_contents":
      return block.headings?.length ? block.headings.map((h) => clip(`  • ${h}`, width)) : ["[ Table of contents ]"];
    case "synced_block":
      return block.children?.length
        ? renderBlocks(block.children, width, 0)
        : [`[ synced block${block.from ? ` ← ${block.from}` : ""} ]`];
    case "page_link":
      return [`${block.icon ? `${block.icon} ` : "▤ "}${block.title}${block.note ? `     (${block.note})` : ""}`];
    case "database":
      return renderDatabaseLines(block.database, width);
    case "table":
      return [dbHeader(block.name, block.views, width), ...renderTableGrid(block.columns, block.rows, width, "─")];
    case "gallery":
      return renderGallery(block, width);
    case "board":
      return renderBoard(block, width);
    case "list":
      return renderListView(block, width);
    case "calendar":
      return renderCalendar(block, width);
    case "timeline":
      return renderTimeline(block, width);
    case "chart":
      return renderChart(block, width);
    case "form":
      return renderForm(block, width);
    case "map":
      return renderMap(block, width);
    case "dashboard":
      return renderDashboard(block, width);
    case "unsupported":
      return [`[ ${block.label ?? "unsupported block"} ]`];
    default:
      return [];
  }
}

/** Render a list of blocks, threading numbered-list ordinals and smart inter-block spacing. */
export function renderBlocks(blocks: MockupBlock[], width: number, depth: number): string[] {
  const out: string[] = [];
  let ordinal = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    ordinal = block.type === "numbered_list_item" ? ordinal + 1 : 0;
    if (i > 0) {
      const prev = blocks[i - 1];
      const tight = TIGHT.has(prev.type) && TIGHT.has(block.type);
      if (!tight) {
        out.push("");
      }
    }
    out.push(...renderBlock(block, width, depth, ordinal));
  }
  return out;
}

function header(
  icon: string | undefined,
  title: string,
  cover: string | undefined,
  description: string | undefined,
  total: number,
): string[] {
  const out: string[] = [];
  if (cover) {
    const label = ` ${cover} `;
    const pad = total - displayWidth(label);
    const left = Math.max(0, Math.floor(pad / 2));
    out.push("▒".repeat(left) + label + "▒".repeat(Math.max(0, pad - left)));
  }
  out.push(icon ? `${icon} ${title}` : title);
  if (description) {
    out.push(`▤ Description    ${description}`);
  }
  out.push("─".repeat(total));
  return out;
}

/** Render a full page (header + recursive body). */
export function renderPage(model: PageModel): string {
  const total = model.width ?? DEFAULT_WIDTH;
  const out = [
    ...header(model.icon, model.title, model.cover, model.description, total),
    ...renderBlocks(model.blocks, total, 0),
  ];
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}
/** @deprecated alias of renderPage — kept for back-compat. */
export const renderMockup = renderPage;

function renderDatabaseLines(db: DatabaseModel, total: number): string[] {
  const out = header(db.icon, db.title, undefined, db.description, total).slice(db.icon || db.title ? 0 : 0);
  const which = db.view ?? 0;
  const views = which === "all" ? db.views : [db.views[typeof which === "number" ? which : 0]].filter(Boolean);
  for (let i = 0; i < views.length; i++) {
    if (i > 0) {
      out.push("");
    }
    out.push(...renderBlock(views[i], total, 0, 0));
  }
  return out;
}
/** Render a standalone database (its own header + selected view, or all views). */
export function renderDatabase(db: DatabaseModel): string {
  const total = db.width ?? DEFAULT_WIDTH;
  return renderDatabaseLines(db, total)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}
