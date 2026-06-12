// Pure row formatters for read_database — no API calls, fully unit-testable.
// A row is a flat record of scalar property values (the tool flattens Notion props + resolves relations first).

import type { Scalar } from "./notion-page";

export type RowFormat = "table" | "kv" | "tsv" | "summary";
export type FlatRow = Record<string, Scalar>;

const cell = (value: Scalar): string =>
  value === null ? "" : value === true ? "true" : value === false ? "false" : String(value);

const isNumber = (value: Scalar): value is number => typeof value === "number";

export function formatRows(rows: FlatRow[], columns: string[], format: RowFormat, groupBy?: string): string {
  switch (format) {
    case "table":
      return renderTable(rows, columns);
    case "kv":
      return renderKv(rows, columns);
    case "tsv":
      return renderTsv(rows, columns);
    case "summary":
      return renderSummary(rows, columns, groupBy);
  }
}

function renderTable(rows: FlatRow[], columns: string[]): string {
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const header = `| ${columns.join(" | ")} |`;
  const separator = `|${columns.map(() => "---").join("|")}|`;
  const body = rows.map((row) => `| ${columns.map((c) => esc(cell(row[c]))).join(" | ")} |`).join("\n");
  return rows.length > 0 ? `${header}\n${separator}\n${body}` : `${header}\n${separator}`;
}

function renderKv(rows: FlatRow[], columns: string[]): string {
  return rows
    .map((row) =>
      columns
        .filter((c) => cell(row[c]) !== "")
        .map((c) => `${c}: ${cell(row[c])}`)
        .join("\n"),
    )
    .join("\n\n");
}

function renderTsv(rows: FlatRow[], columns: string[]): string {
  const esc = (s: string) => s.replace(/[\t\n]/g, " ");
  const lines = [columns.join("\t"), ...rows.map((row) => columns.map((c) => esc(cell(row[c]))).join("\t"))];
  return lines.join("\n");
}

/** Distinct non-empty string values of a column. */
function distinct(rows: FlatRow[], column: string): Set<string> {
  const values = new Set<string>();
  for (const row of rows) {
    const text = cell(row[column]);
    if (text !== "") {
      values.add(text);
    }
  }
  return values;
}

/** Pick the best group-by column: explicit, else the lowest-but->1-cardinality non-numeric column. */
function pickGroupColumn(rows: FlatRow[], columns: string[], groupBy?: string): string | undefined {
  if (groupBy && columns.includes(groupBy)) {
    return groupBy;
  }
  let best: { column: string; count: number } | undefined;
  for (const column of columns) {
    if (rows.some((row) => isNumber(row[column]))) {
      continue; // numeric column — not a group key
    }
    const count = distinct(rows, column).size;
    if (count >= 2 && count < rows.length && (!best || count < best.count)) {
      best = { column, count };
    }
  }
  return best?.column;
}

function renderSummary(rows: FlatRow[], columns: string[], groupBy?: string): string {
  const numericColumns = columns.filter((c) => rows.some((row) => isNumber(row[c])));
  const group = pickGroupColumn(rows, columns, groupBy);

  if (!group || numericColumns.length === 0) {
    // Fallback: per-column distribution (non-numeric) / sum (numeric).
    const lines = columns.map((column) => {
      if (numericColumns.includes(column)) {
        const sum = rows.reduce((acc, row) => acc + (isNumber(row[column]) ? row[column] : 0), 0);
        return `${column}: sum ${round(sum)}`;
      }
      const dist = [...countBy(rows, column).entries()].map(([k, n]) => `${k}(${n})`).join(" ");
      return `${column}: ${dist}`;
    });
    return `${rows.length} rows\n${lines.join("\n")}`;
  }

  const groups = new Map<string, { count: number; sums: Map<string, number> }>();
  for (const row of rows) {
    const key = cell(row[group]) || "(empty)";
    const bucket = groups.get(key) ?? { count: 0, sums: new Map(numericColumns.map((c) => [c, 0])) };
    bucket.count += 1;
    for (const column of numericColumns) {
      if (isNumber(row[column])) {
        bucket.sums.set(column, (bucket.sums.get(column) ?? 0) + row[column]);
      }
    }
    groups.set(key, bucket);
  }

  const sumColLabel = numericColumns.join(", ");
  const lines = [...groups.entries()]
    .sort((a, b) => (b[1].sums.get(numericColumns[0]) ?? 0) - (a[1].sums.get(numericColumns[0]) ?? 0))
    .map(
      ([key, b]) =>
        `  ${key.padEnd(18)} ${numericColumns.map((c) => round(b.sums.get(c) ?? 0)).join(" · ")}   (${b.count})`,
    );

  const totals = numericColumns.map((c) => round(rows.reduce((acc, row) => acc + (isNumber(row[c]) ? row[c] : 0), 0)));
  return (
    `${rows.length} rows · group by: ${group} · sum: ${sumColLabel}\n${lines.join("\n")}\n` +
    `  ${"Total".padEnd(18)} ${totals.join(" · ")}   (${rows.length})`
  );
}

function countBy(rows: FlatRow[], column: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = cell(row[column]) || "(empty)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const round = (n: number): number => Math.round(n * 100) / 100;
