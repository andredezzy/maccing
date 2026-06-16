// Calendar view renderer — month grid with event dots.

import { renderTableGrid } from "../../../box";
import { clip } from "../../../text";
import { databaseHeader } from "../header";
import { registerView } from "./engine";

interface CalendarEvent {
  day: number;
  title: string;
}
export interface CalendarBlock {
  type: "calendar";
  name: string;
  views?: string[];
  year: number;
  month: number; // 1-12
  events?: CalendarEvent[];
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

function renderCalendar(block: CalendarBlock, total: number): string[] {
  const month = ((block.month - 1 + 12) % 12) + 1;
  const lines = [databaseHeader(block.name, block.views, total), `${MONTHS[month - 1]} ${block.year}`];
  const first = dayOfWeek(block.year, month, 1);
  const days = daysInMonth(block.year, month);
  const eventDays = new Set((block.events ?? []).map((event) => event.day));
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
  for (const event of block.events ?? []) {
    lines.push(clip(`  • ${event.day} — ${event.title}`, total));
  }
  return lines;
}

registerView("calendar", renderCalendar);
