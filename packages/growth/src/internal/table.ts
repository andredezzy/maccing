/**
 * Reading the two file shapes a list or an export arrives in, with no dependency added for either.
 *
 * The CSV reader is a real scanner, not a split on commas: a quoted field holding a comma shifts
 * every column after it by one on that row alone, and the rows it breaks join against nothing
 * instead of failing to parse.
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

/** A column the caller named by hand is not in the file's header. Its own error rather than a
 *  fallback to another column, which would report every row of the file as unconvertible. */
export class MissingColumnError extends Error {
  readonly path: string;
  readonly column: string;

  constructor(path: string, column: string, header: readonly string[]) {
    super(
      `${path} has no column named ${JSON.stringify(column)}. Its header is ` +
        `${header.map((name) => JSON.stringify(name)).join(", ") || "(empty)"}. ` +
        "Reading a different column instead would report the whole file as unconvertible, so " +
        "the name has to be corrected in the declaration rather than guessed at here.",
    );
    this.name = "MissingColumnError";
    this.path = path;
    this.column = column;
  }
}

/** A header carrying one name twice, where something in this run reads that name. A record built
 *  from such a header holds only the *last* column of that name, so a presence check passes on the
 *  first while the read takes the second's values. Raised only for names something reads. */
export class DuplicateColumnError extends Error {
  readonly path: string;
  readonly column: string;

  /** `read_by` opens a sentence and names what reads the column: the role whose binding names it,
   *  or the part of a cell's declaration that does. */
  constructor(path: string, column: string, header: readonly string[], read_by: string) {
    super(
      `${path} names the column ${JSON.stringify(column)} twice in its header, which reads ` +
        `${header.map((name) => JSON.stringify(name)).join(", ")}. ${read_by}, and only the second ` +
        "column of that name survives into each row — so what it reads is the second one's values, " +
        "while the check that the column is present passes on the first. Re-export with the " +
        "duplicate renamed or dropped.",
    );
    this.name = "DuplicateColumnError";
    this.path = path;
    this.column = column;
  }
}

/** A quoted field that never closes, naming the line the quote was opened on. Otherwise the scanner
 *  swallows every line below it into that one field and the file silently ends there. */
export class UnterminatedQuoteError extends Error {
  readonly path: string;
  readonly line: number;

  constructor(path: string, line: number) {
    super(
      `${path} opens a quoted field on line ${line} and never closes it. Every line after that one ` +
        "reads as part of that single field rather than as rows of its own, so the file ends where " +
        "the stray quote begins and the identifiers below it are silently not measured. Close the " +
        "quote, or double it if the value genuinely contains one.",
    );
    this.name = "UnterminatedQuoteError";
    this.path = path;
    this.line = line;
  }
}

/** A `.txt` list declared with a column or a filter, which one identifier per line has nowhere to
 *  hold. Refused rather than ignored: a filter that never runs measures the whole file. */
export class TextListOptionError extends Error {
  readonly path: string;
  readonly options: readonly string[];

  constructor(path: string, options: readonly string[]) {
    super(
      `${path} is read as one identifier per line, and this cell declares ${options.join(" and ")}, ` +
        "which a text file has nowhere to hold. Ignoring them would measure every line in the file " +
        "under the name of the slice that was asked for — a filter that never runs reports the wrong " +
        "population, not a smaller one. Export the list as CSV with the column the declaration names, " +
        `or drop ${options.length === 1 ? "it" : "them"} and point the cell at a file already narrowed.`,
    );
    this.name = "TextListOptionError";
    this.path = path;
    this.options = options;
  }
}

/**
 * RFC 4180 field scanner. Quoted fields may hold commas, newlines and doubled quotes; rows end at
 * either line terminator. Returns rows of raw field text, header row included.
 *
 * `path` is carried so an unterminated quote can name its file — the one fault this scanner throws
 * on, since it is not a bad row but the rest of the document vanishing into one field.
 */
function scan(text: string, path: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  // Distinguishes a blank line from a row holding one empty field, so a trailing newline does not
  // become a phantom record.
  let occupied = false;
  // Physical lines, for the unterminated-quote message alone. `quote_line` is where the open quote
  // started, which is the line to go and look at; the end of the file says nothing about it.
  let line = 1;
  let quote_line = 0;

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
      quote_line = line;
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
      line++;
    } else {
      field += ch;
      occupied = true;
    }
  }

  if (quoted) {
    throw new UnterminatedQuoteError(path, quote_line);
  }
  if (occupied || field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** A CSV as this engine reads it: the scanned header beside the records it keys. */
export type Rows = { header: string[]; records: Record<string, string>[] };

/**
 * Refuse a header that repeats a name this run is about to read out of it.
 *
 * One column per call, from whoever knows what it is for: the columns a role binds, a list's own
 * `column`, a cell's `filter.column`. What reads a column is the whole of what makes a repeat
 * dangerous, and it is the one thing `read_rows` cannot see.
 */
export function assert_unshadowed(path: string, header: readonly string[], column: string, read_by: string): void {
  if (header.indexOf(column) !== header.lastIndexOf(column)) {
    throw new DuplicateColumnError(path, column, header, read_by);
  }
}

/**
 * Read a CSV into its header and its records. A short row leaves the missing columns empty rather
 * than absent, so a caller never distinguishes "column not in this row" from "column empty here".
 *
 * The header comes back as an array and must not be recovered from a record's keys: a key that looks
 * like an array index enumerates before every other key on a plain object, so a file whose first
 * column is headed `1` reports a different column as its first, holding plausible text.
 *
 * A repeated name is not refused here, and the loss happens here — the second column of that name
 * overwrites the first as the record is built. Whoever reads a record by name owes
 * `assert_unshadowed` one call per column.
 */
export async function read_rows(path: string): Promise<Rows> {
  const text = (await Bun.file(path).text()).replace(/^\uFEFF/, "");
  const rows = scan(text, path);
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

/**
 * Read the identifiers a list file carries, as raw text — deriving a join key from them belongs to
 * the caller and depends on a format this file knows nothing about.
 *
 * A `.txt` is one identifier per line and blank lines are dropped; declared with a column or a
 * filter it is `TextListOptionError`. A `.csv` is read on the named column, or on the first column
 * when none is named, which is what a bare export of one column looks like; a name the header does
 * not carry is `MissingColumnError`, never a fall back to the first column. `filter` cuts one cell
 * out of a file holding several, keeping the identifier-to-cell mapping in the single frozen file the
 * attribution depends on; its column is checked against the header separately from the identifier
 * column, so the error names the one that moved, and both are then checked for a twin. Any other
 * extension is `UnsupportedListFormatError`.
 */
export async function read_identifiers(
  path: string,
  column?: string,
  filter?: { column: string; value: string },
): Promise<string[]> {
  const dot = path.lastIndexOf(".");
  const extension = dot === -1 ? "" : path.slice(dot).toLowerCase();

  if (extension === ".txt") {
    const declared: string[] = [];
    if (column !== undefined) {
      declared.push(`column ${JSON.stringify(column)}`);
    }
    if (filter !== undefined) {
      declared.push(`filter on ${JSON.stringify(filter.column)}`);
    }
    if (declared.length > 0) {
      throw new TextListOptionError(path, declared);
    }
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
  if (column !== undefined && !header.includes(column)) {
    throw new MissingColumnError(path, column, header);
  }
  if (filter !== undefined && !header.includes(filter.column)) {
    throw new MissingColumnError(path, filter.column, header);
  }
  if (records.length === 0) {
    return [];
  }
  const name = column ?? (header[0] as string);
  // After the row count, and only for the two columns this read touches: a header-only file was read
  // on neither, and a `note` column repeated beside them is not read here at all.
  assert_unshadowed(path, header, name, "This cell reads its identifiers from it");
  if (filter !== undefined) {
    assert_unshadowed(path, header, filter.column, "This cell's filter matches on it");
  }

  const out: string[] = [];
  for (const row of records) {
    if (filter !== undefined && row[filter.column] !== filter.value) {
      continue;
    }
    out.push(row[name] ?? "");
  }
  return out;
}
