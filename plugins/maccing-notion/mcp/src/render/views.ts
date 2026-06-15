// Database-view renderers — the tab-bar header plus table/gallery/board/list and the Phase-2 views
// (calendar · timeline · chart · form · map · dashboard), and the standalone-database driver. Each
// registers itself with the engine; dashboards and inline databases recurse through engine.renderBlock.

import { box, COVER, cardsPerRow, GAP, hcat, header, MEDIUM_CARD, renderTableGrid, SMALL_CARD } from "./box";
import { register, renderBlock } from "./engine";
import type {
  BoardBlock,
  CalendarBlock,
  ChartBlock,
  DashboardBlock,
  DatabaseModel,
  FormBlock,
  GalleryBlock,
  ListViewBlock,
  MapBlock,
  TimelineBlock,
} from "./model";
import { clip, displayWidth, padRight, spread } from "./text";

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
    const head = box([`${group.name}  (${group.total ?? group.cards.length})`], colInner);
    const cards = group.cards.flatMap((card) =>
      box([card.icon ? `${card.icon} ${card.name}` : card.name, ...(card.lines ?? [])], colInner),
    );
    return [...head, ...cards];
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

/** Render a standalone database body (header + the selected view, or all views stacked). */
export function renderDatabaseLines(db: DatabaseModel, total: number): string[] {
  const out = header(db.icon, db.title, undefined, db.description, total);
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

// ── registrations ──────────────────────────────────────────────────────────────
register("table", (block, width) => [
  dbHeader(block.name, block.views, width),
  ...renderTableGrid(block.columns, block.rows, width, "─"),
]);
register("gallery", (block, width) => renderGallery(block, width));
register("board", (block, width) => renderBoard(block, width));
register("list", (block, width) => renderListView(block, width));
register("calendar", (block, width) => renderCalendar(block, width));
register("timeline", (block, width) => renderTimeline(block, width));
register("chart", (block, width) => renderChart(block, width));
register("form", (block, width) => renderForm(block, width));
register("map", (block, width) => renderMap(block, width));
register("dashboard", (block, width) => renderDashboard(block, width));
register("database", (block, width) => renderDatabaseLines(block.database, width));
