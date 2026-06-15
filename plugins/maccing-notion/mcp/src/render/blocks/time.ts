// Time-based view renderers — calendar (month grid with event dots) and timeline (proportional bars).

import { renderTableGrid } from "../box";
import { register } from "../engine";
import type { CalendarBlock, TimelineBlock } from "../model";
import { clip, padRight } from "../text";
import { dbHeader } from "./chrome";

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
    const startCol = Math.max(0, Math.min(barW, Math.round((row.start || 0) * barW)));
    const endCol = Math.max(startCol, Math.min(barW, Math.round((row.end || 0) * barW)));
    const bar = Array.from({ length: barW }, (_, col) => (col >= startCol && col < endCol ? "█" : "·")).join("");
    lines.push(`${padRight(row.label, nameW)}│${bar}`);
  }
  return lines;
}

register("calendar", (block, width) => renderCalendar(block, width));
register("timeline", (block, width) => renderTimeline(block, width));
