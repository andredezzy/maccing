/**
 * Reading the two file shapes a list or an export arrives in, with no dependency added for either.
 *
 * The CSV reader is a real one rather than a split on commas. Every field this engine joins on is
 * either a phone number or an identifier, and a quoted field containing a comma — a name, an
 * address, a note column nobody asked for — shifts every column after it by one on that row alone.
 * The result is not a parse error; it is a handful of rows that quietly join against nothing, which
 * reads as "these people never signed up".
 */

/** A list in a format this engine will not guess at. */
export class UnsupportedListFormatError extends Error {
  readonly path: string;

  constructor(path: string, extension: string) {
    super(
      `cannot read ${path}: the ${extension} extension is not a supported list format. ` +
        "Convert spreadsheets to CSV before measuring — a spreadsheet reader would have to " +
        "guess at typed cells, merged headers and hidden rows, and each guess silently changes " +
        "which identifiers are counted.",
    );
    this.name = "UnsupportedListFormatError";
    this.path = path;
  }
}

/**
 * RFC 4180 field scanner. Quoted fields may hold commas, newlines and doubled quotes; rows end at
 * either line terminator. Returns rows of raw field text, header row included.
 */
function scan(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  // Distinguishes a blank line from a row holding one empty field, so a trailing newline does
  // not become a phantom record.
  let occupied = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;

    if (quoted) {
      if (ch !== '"') {
        field += ch;
      } else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
      occupied = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      occupied = true;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") {
        i++;
      }
      if (occupied || field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
      }
      row = [];
      field = "";
      occupied = false;
    } else {
      field += ch;
      occupied = true;
    }
  }

  if (occupied || field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Read a CSV into its header and its records. A short row leaves the missing columns empty rather
 * than absent, because a caller reading a bound column should not have to distinguish "column not
 * in this row" from "column empty on this row".
 *
 * The header comes back as an array beside the records rather than being recovered from a record's
 * keys later. A key that looks like an array index is enumerated before every other key on a plain
 * object, so a file whose first column is headed `1` would report a different column as its first
 * one — and that column would still contain plausible-looking text.
 */
async function read_rows(path: string): Promise<{ header: string[]; records: Record<string, string>[] }> {
  const text = (await Bun.file(path).text()).replace(/^\uFEFF/, "");
  const rows = scan(text);
  const header = rows[0];
  if (header === undefined) {
    return { header: [], records: [] };
  }

  const records: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as string[];
    const record: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      record[header[c] as string] = row[c] ?? "";
    }
    records.push(record);
  }
  return { header, records };
}

/** Read a CSV as records keyed by its header row. */
export async function read_table(path: string): Promise<Record<string, string>[]> {
  return (await read_rows(path)).records;
}

/**
 * Read the identifiers a list file carries, as raw text — deriving a join key from them is the
 * caller's business and depends on a format this file knows nothing about.
 *
 * A `.txt` is one identifier per line. A `.csv` is read as a table: the named column when the
 * header carries it, the first column otherwise, which is what a bare export of one column looks
 * like. `filter` cuts one cell out of a file holding several, so the mapping from identifier to
 * cell stays in the single frozen file the attribution depends on instead of being copied into
 * derived files free to drift from it.
 */
export async function read_identifiers(
  path: string,
  column?: string,
  filter?: { column: string; value: string },
): Promise<string[]> {
  const dot = path.lastIndexOf(".");
  const extension = dot === -1 ? "" : path.slice(dot).toLowerCase();

  if (extension === ".txt") {
    const text = await Bun.file(path).text();
    return text
      .split("\n")
      .map((line) => line.replace(/\r$/, ""))
      .filter((line) => line.trim() !== "");
  }

  if (extension !== ".csv") {
    throw new UnsupportedListFormatError(path, extension === "" ? "missing" : extension);
  }

  const { header, records } = await read_rows(path);
  if (records.length === 0) {
    return [];
  }
  const name = column !== undefined && header.includes(column) ? column : (header[0] as string);

  const out: string[] = [];
  for (const row of records) {
    if (filter !== undefined && row[filter.column] !== filter.value) {
      continue;
    }
    out.push(row[name] ?? "");
  }
  return out;
}
