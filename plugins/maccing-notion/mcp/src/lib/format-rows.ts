// Pure row formatters for read_database — no API calls, fully unit-testable.
// A row is a flat record of scalar property values (the tool flattens Notion props + resolves relations first).

import type { Scalar } from "./notion-page";

// String union (not an enum) because these values ARE the wire-facing read_database `format` parameter (z.enum(FORMATS), lowercase); an UPPERCASE-valued enum would break the wire contract. Input is validated by Zod before formatRows is called.
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
  const escapeCell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const header = `| ${columns.join(" | ")} |`;
  const separator = `|${columns.map(() => "---").join("|")}|`;
  const body = rows
    .map((row) => `| ${columns.map((column) => escapeCell(cell(row[column]))).join(" | ")} |`)
    .join("\n");
  return rows.length > 0 ? `${header}\n${separator}\n${body}` : `${header}\n${separator}`;
}

function renderKv(rows: FlatRow[], columns: string[]): string {
  return rows
    .map((row) =>
      columns
        .filter((column) => cell(row[column]) !== "")
        .map((column) => `${column}: ${cell(row[column])}`)
        .join("\n"),
    )
    .join("\n\n");
}

function renderTsv(rows: FlatRow[], columns: string[]): string {
  const escapeTsvCell = (text: string) => text.replace(/[\t\n]/g, " ");
  const lines = [
    columns.join("\t"),
    ...rows.map((row) => columns.map((column) => escapeTsvCell(cell(row[column]))).join("\t")),
  ];
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

interface BestGroupColumn {
  column: string;
  count: number;
}

interface GroupBucket {
  count: number;
  sums: Map<string, number>;
}

/** Pick the best group-by column: explicit, else the lowest-but->1-cardinality non-numeric column. */
function pickGroupColumn(rows: FlatRow[], columns: string[], groupBy?: string): string | undefined {
  if (groupBy && columns.includes(groupBy)) {
    return groupBy;
  }
  let best: BestGroupColumn | undefined;
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
  const numericColumns = columns.filter((column) => rows.some((row) => isNumber(row[column])));
  const group = pickGroupColumn(rows, columns, groupBy);

  if (!group || numericColumns.length === 0) {
    // Fallback: per-column distribution (non-numeric) / sum (numeric).
    const lines = columns.map((column) => {
      if (numericColumns.includes(column)) {
        const sum = rows.reduce((acc, row) => acc + (isNumber(row[column]) ? row[column] : 0), 0);
        return `${column}: sum ${round(sum)}`;
      }
      const distribution = [...countBy(rows, column).entries()].map(([label, count]) => `${label}(${count})`).join(" ");
      return `${column}: ${distribution}`;
    });
    return `${rows.length} rows\n${lines.join("\n")}`;
  }

  const groups = new Map<string, GroupBucket>();
  for (const row of rows) {
    const groupKey = cell(row[group]) || "(empty)";
    const bucket = groups.get(groupKey) ?? { count: 0, sums: new Map(numericColumns.map((column) => [column, 0])) };
    bucket.count += 1;
    for (const column of numericColumns) {
      if (isNumber(row[column])) {
        bucket.sums.set(column, (bucket.sums.get(column) ?? 0) + row[column]);
      }
    }
    groups.set(groupKey, bucket);
  }

  const sumColumnLabel = numericColumns.join(", ");
  const lines = [...groups.entries()]
    .sort(
      ([, bucketA], [, bucketB]) =>
        (bucketB.sums.get(numericColumns[0]) ?? 0) - (bucketA.sums.get(numericColumns[0]) ?? 0),
    )
    .map(
      ([groupKey, bucket]) =>
        `  ${groupKey.padEnd(18)} ${numericColumns.map((column) => round(bucket.sums.get(column) ?? 0)).join(" · ")}   (${bucket.count})`,
    );

  const totals = numericColumns.map((column) =>
    round(rows.reduce((acc, row) => acc + (isNumber(row[column]) ? row[column] : 0), 0)),
  );
  return (
    `${rows.length} rows · group by: ${group} · sum: ${sumColumnLabel}\n${lines.join("\n")}\n` +
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

const round = (value: number): number => Math.round(value * 100) / 100;
