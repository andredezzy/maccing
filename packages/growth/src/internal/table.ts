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

/** A column the caller named by hand is not in the file's header. Its own error rather than a
 *  fallback, because falling back to another column reads every row as a value that did not
 *  convert — which is indistinguishable from a cell whose people genuinely never signed up. */
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

/** A header carrying one name twice, where something in this run reads that name. Refused rather
 *  than resolved, because the record built from such a header holds only the last column of that
 *  name — so a caller checking that its bound columns are present passes, reads the wrong one of
 *  the two, and gets whatever the second query put there. A join column shadowed this way matches
 *  nothing and reads as a cell that never converted, which is the one wrong answer this engine
 *  spends everything to avoid.
 *
 *  Only the names something reads. A person export headed `id,phone,created_at,note,note` under a
 *  map that binds the first three loses nothing anybody was going to look at, and refusing it sent
 *  the reader into the map to hunt for a binding on `note` that was never there. What reads the
 *  column is carried in the message for that reason: it is what makes the sentence true of the
 *  file that triggered it, and it points at the declaration the fix belongs in. */
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

/** A quoted field that never closes. The scanner would otherwise swallow every remaining line
 *  into that one field: no parse error, no short row, just a file that ends after the last row
 *  before the stray quote and a cell measured against a fraction of the list it named. */
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

/** A `.txt` list declared with a column or a filter. Refused rather than ignored: a cell whose
 *  filter never runs measures the whole file instead of the slice it named, and reports that
 *  wider population under the narrower cell's name. */
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
 * The path is carried only so an unterminated quote can name the file it is in. That case is the
 * one place this scanner refuses: a quote nobody closed is not a malformed row the reader can skip
 * over, it is the rest of the document disappearing into one field.
 */
function scan(text: string, path: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  // Distinguishes a blank line from a row holding one empty field, so a trailing newline does
  // not become a phantom record.
  let occupied = false;
  // Physical lines, counted for the unterminated-quote message alone. `quote_line` is where the
  // quote currently open was opened, which is the line a reader has to go and look at — the end
  // of the file, where the fault surfaces, says nothing about where it started.
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
 * Called with one column at a time, by whoever knows what it is for: `read_export` walks the
 * columns its role binds, and a list is read on its own `column` and narrowed on its own
 * `filter.column`. That set is the whole of what makes a repeat dangerous, and it is the one thing
 * `read_rows` cannot see — which is why the check lives out here beside the callers rather than
 * inside the reader, where it refused files whose duplicate nothing was ever going to read.
 */
export function assert_unshadowed(path: string, header: readonly string[], column: string, read_by: string): void {
  if (header.indexOf(column) !== header.lastIndexOf(column)) {
    throw new DuplicateColumnError(path, column, header, read_by);
  }
}

/**
 * Read a CSV into its header and its records. A short row leaves the missing columns empty rather
 * than absent, because a caller reading a bound column should not have to distinguish "column not
 * in this row" from "column empty on this row".
 *
 * The header comes back as an array beside the records rather than being recovered from a record's
 * keys later. A key that looks like an array index is enumerated before every other key on a plain
 * object, so a file whose first column is headed `1` would report a different column as its first
 * one — and that column would still contain plausible-looking text. It is exported for the same
 * reason: a caller holding a map's bound column names can only check that the file still carries
 * them against the header as scanned, and a header recovered from the records cannot be trusted to
 * be that.
 *
 * A repeated name is not refused here, and the loss it causes does happen here: the second column
 * of that name overwrites the first as the record is built, so every later check asks whether the
 * name is present, finds that it is, and reads the second column's values. What this function
 * cannot know is whether anything reads that name at all, and a duplicate nobody reads costs
 * nobody anything. So the refusal is `assert_unshadowed`, and whoever reads a record built here
 * owes it one call for every column they read by name.
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
 * Read the identifiers a list file carries, as raw text — deriving a join key from them is the
 * caller's business and depends on a format this file knows nothing about.
 *
 * A `.txt` is one identifier per line, and a `.txt` declared with a column or a filter is refused
 * rather than read without them: a file has no columns to narrow, so honouring the declaration is
 * impossible and ignoring it measures a wider population under the narrower cell's name. A `.csv`
 * is read as a table: the named column, or the first column when none is named, which is what a
 * bare export of one column looks like. A name that the header does not carry is an error and not
 * a fall back to the first column — the fall back reads a column of the wrong kind, every value of
 * which fails to convert, and a file that converts nothing is indistinguishable from a cell whose
 * people never signed up. `filter` cuts one cell out of a file holding several, so the mapping from
 * identifier to cell stays in the single frozen file the attribution depends on instead of being
 * copied into derived files free to drift from it; its column is checked against the header for
 * the same reason the identifier column is, and separately, so the error names the one that moved.
 * Both are then checked for a twin, which is the same fault one step later: a header naming the
 * identifier column twice reads the second of the two, and a list of the right people read on the
 * wrong column of them matches nobody.
 */
export async function read_identifiers(
  path: string,
  column?: string,
  filter?: { column: string; value: string },
): Promise<string[]> {
  const dot = path.lastIndexOf(".");
  const extension = dot === -1 ? "" : path.slice(dot).toLowerCase();

  if (extension === ".txt") {
    // A text list has no columns, so neither of these can be honoured. Ignoring them is the
    // dangerous reading: the cell was declared as one slice of a file and would be measured as
    // all of it, under the slice's name.
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
  // The filter column is asserted against the header exactly like the identifier column. Left
  // unchecked, a renamed filter column matches no row, the cell comes out empty, and the error
  // that eventually surfaces names the phone column — sending the reader to the one binding that
  // was right.
  if (filter !== undefined && !header.includes(filter.column)) {
    throw new MissingColumnError(path, filter.column, header);
  }
  if (records.length === 0) {
    return [];
  }
  const name = column ?? (header[0] as string);
  // After the row count, and only for the two columns this read touches. A header-only file was
  // read on neither of them, so a twin in it has misled nobody and the empty cell downstream is
  // the honest report; a `note` column repeated beside them is not read here at all.
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
