// Calendar view renderer — month grid with event dots.

import { buildIdToName } from "../../../../readers/views";
import { renderTableGrid } from "../../../box";
import { clip } from "../../../text";
import { databaseHeader } from "../header";
import { registerView, type ViewRenderNode } from "./engine";
import { cellValue, rowTitle, visibleColumns } from "./helpers";

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
  const monthOffsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;
  return (
    (((adjustedYear +
      Math.floor(adjustedYear / 4) -
      Math.floor(adjustedYear / 100) +
      Math.floor(adjustedYear / 400) +
      monthOffsets[month - 1] +
      day) %
      7) +
      7) %
    7
  );
}

function daysInMonth(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function parseDate(dateString: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString);
  return match ? { year: +match[1], month: +match[2], day: +match[3] } : null;
}

function renderCalendar(node: ViewRenderNode, total: number): string[] {
  const schema = node.dataSource.properties ?? {};
  const config = node.view.configuration ?? {};
  const idToName = buildIdToName(schema);

  // Resolve the date column: configuration.date_property_id → name, then fallback to first column
  // with a date-shaped value in the first row, then table fallback.
  const datePropId = config.date_property_id as string | undefined;
  const dateColName = datePropId ? (idToName[datePropId] ?? datePropId) : undefined;

  interface DatedRow {
    date: { year: number; month: number; day: number };
    title: string;
  }

  const allColumns = visibleColumns(node.view, node.dataSource, node.titleColumn);

  // Find a usable date column: from config, or first column whose first row value looks like a date.
  const resolvedDateCol =
    dateColName ?? allColumns.find((column) => parseDate(cellValue(node.rows[0] ?? {}, column)) !== null);

  if (!resolvedDateCol) {
    // No date column found — fall back to table.
    const rows = node.rows.map((row) => allColumns.map((column) => cellValue(row, column)));
    return [databaseHeader(node.dbTitle, node.tabs, total), ...renderTableGrid(allColumns, rows, total, "─")];
  }

  const dated = node.rows
    .map((row) => ({
      date: parseDate(cellValue(row, resolvedDateCol)),
      title: rowTitle(row, node.titleColumn),
    }))
    .filter((datedRow): datedRow is DatedRow => datedRow.date !== null);

  if (dated.length === 0) {
    // No parseable dates → table fallback.
    const rows = node.rows.map((row) => allColumns.map((column) => cellValue(row, column)));
    return [databaseHeader(node.dbTitle, node.tabs, total), ...renderTableGrid(allColumns, rows, total, "─")];
  }

  const { year, month } = dated[0].date;
  const lines = [databaseHeader(node.dbTitle, node.tabs, total), `${MONTHS[month - 1]} ${year}`];
  const first = dayOfWeek(year, month, 1);
  const days = daysInMonth(year, month);

  const events = dated
    .filter((datedRow) => datedRow.date.year === year && datedRow.date.month === month)
    .map((datedRow) => ({ day: datedRow.date.day, title: datedRow.title }));

  const eventDays = new Set(events.map((event) => event.day));
  const cells: string[] = [];
  for (let index = 0; index < first; index++) {
    cells.push("");
  }
  for (let day = 1; day <= days; day++) {
    cells.push(eventDays.has(day) ? `${day} •` : `${day}`);
  }
  while (cells.length % 7 !== 0) {
    cells.push("");
  }
  const weeks: string[][] = [];
  for (let weekStart = 0; weekStart < cells.length; weekStart += 7) {
    weeks.push(cells.slice(weekStart, weekStart + 7));
  }
  lines.push(...renderTableGrid(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], weeks, total, "─"));
  for (const event of events) {
    lines.push(clip(`  • ${event.day} — ${event.title}`, total));
  }
  return lines;
}

registerView("calendar", renderCalendar);
