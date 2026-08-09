import { make_key, type PhoneFormat } from "./phone.ts";

/**
 * The map reader, and the shape of what it reads.
 *
 * Four roles are the whole vocabulary: a `person`, `revenue` arriving, `churn` leaving, a
 * `conversion` committing. Nothing here names a product, a market or a country. Which tables and
 * columns fill those roles is the map's business, and the map lives in the project rather than in
 * this package — that separation is what lets one engine measure projects that share no domain.
 *
 * The map itself is a markdown file a person reads and a parser reads, and most of it is neither
 * section nor table: it is the prose explaining why a join goes through one table rather than
 * another, and why one status means money actually arrived. That prose is the half of the document
 * that keeps the bindings honest, so the format puts it first and the parser ignores it entirely,
 * reading only the pipe tables under headings it knows.
 *
 * Two rules here are stricter than markdown would need, and both come from the same failure. An
 * unknown key inside a table is an error rather than a warning, because a mistyped key parses as
 * silence and a binding goes missing with nothing to notice it. And a fenced block is skipped
 * outright — either fence CommonMark defines, backticks or tildes — so an example table inside a
 * code fence never reads as the real one.
 */

/** Which file and which columns carry a role. `at_fallback` covers a nullable timestamp. */
export type RoleBinding = {
  export: string;
  columns: Record<string, string>;
  /** Only on the conversion role: statuses that count as committed. */
  valid_statuses?: readonly string[];
  /** Only on the conversion role, and optional there: the value of the `split` column meaning
   *  recycled rather than new. It travels with `columns.split` — both are declared or neither is,
   *  and the pair being absent says the product has no recycled-balance concept to split on, not
   *  that it has one measuring zero. Forcing every project to name a split would make it invent
   *  a distinction its product does not have. */
  recycled_when?: string;
};

export type DatabaseMap = {
  phone: PhoneFormat;
  person: RoleBinding;
  conversion: RoleBinding;
  /** Absent in a project with nothing to collect. The record omits the role rather than
   *  reporting it as zero, because unbound and empty are different facts. */
  revenue?: RoleBinding;
  churn?: RoleBinding;
  /** `models` names the schema blocks the hash covers. A block is a `model` or an `enum`: the
   *  statuses a map counts as committed and the value marking recycled money are enum values, and
   *  a rename there changes what every binding means while leaving every model untouched. */
  fingerprint: { schema: string; models: readonly string[]; sha256: string };
};

const SECTION_PHONE = "## Phone format";
const SECTION_FINGERPRINT = "## Fingerprint";
const SECTION_PERSON = "## Role: person";
const SECTION_REVENUE = "## Role: revenue";
const SECTION_CHURN = "## Role: churn";
const SECTION_CONVERSION = "## Role: conversion";

/** No map at the path given, or a map naming a schema file that is not there. */
export class MapMissingError extends Error {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`${path} is not there. ${reason}`);
    this.name = "MapMissingError";
    this.path = path;
  }
}

/** A section the map must carry is absent, or a block it names cannot be found. */
export class MapSectionError extends Error {
  readonly section: string;

  constructor(section: string, reason: string) {
    super(`${section}: ${reason}`);
    this.name = "MapSectionError";
    this.section = section;
  }
}

/** A key inside a read table is missing, unreadable, or not one the section defines. */
export class MapFieldError extends Error {
  readonly section: string;
  readonly key: string;

  constructor(section: string, key: string, reason: string) {
    super(`${section} · ${key}: ${reason}`);
    this.name = "MapFieldError";
    this.section = section;
    this.key = key;
  }
}

/**
 * Two roles bound to one export through the same columns.
 *
 * Revenue and churn are opposite directions, so a row cannot be both. Bound identically they are
 * not two roles at all: the same file is opened twice, the same rows are indexed twice, and the
 * record publishes churn as an exact copy of revenue — money arriving and the same money leaving,
 * from the same people at the same instants. Nothing downstream can tell that from a project
 * where inflow and outflow really did match to the cent.
 *
 * The guard is deliberately narrow: all four of the export and the three columns have to match.
 * A shared export with any one column different has an honest reading and is left alone — a
 * monthly statement per member carrying `deposited` and `withdrew` differs in the amount column,
 * a position table carrying `opened_at` and `closed_at` against one amount differs in the
 * timestamp, and a transfer table read from `payer` on one side and `payee` on the other differs
 * in the person. Only the identical quadruple has no reading, which is why it is the whole test.
 */
export class MapDuplicateBindingError extends Error {
  readonly roles: readonly [string, string];
  readonly export: string;

  constructor(roles: readonly [string, string], binding: RoleBinding) {
    super(
      `${roles[0]} and ${roles[1]} both bind ${binding.export} through the same person, at and ` +
        `amount columns (${binding.columns.person}, ${binding.columns.at}, ${binding.columns.amount}). ` +
        "Money arriving and money leaving are not the same rows, so one of the two is pointing at " +
        "the wrong file — usually because the second section was written by copying the first and " +
        "changing only the heading. Bind it to the export that holds it, or delete the section if " +
        "this project has no file for that role: an unbound role is omitted from the record, which " +
        "is the truthful answer and not the same as reporting zero.",
    );
    this.name = "MapDuplicateBindingError";
    this.roles = roles;
    this.export = binding.export;
  }
}

/** The schema moved under the map. Thrown by the caller that checks, never swallowed: a map
 *  describing a shape the database no longer has produces columns that read as empty. */
export class MapStaleError extends Error {
  readonly schema: string;
  readonly expected: string;
  readonly actual: string;

  constructor(schema: string, expected: string, actual: string) {
    super(
      `${schema} has changed since the map was written. Recorded sha256 ${expected}, current ${actual}. ` +
        "Re-read the changed blocks, correct any binding they invalidate, then record the new hash.",
    );
    this.name = "MapStaleError";
    this.schema = schema;
    this.expected = expected;
    this.actual = actual;
  }
}

/** One read table: key to raw value, in declaration order. */
type Table = Map<string, string>;

/** Which character a fence is written with, how long its run is, and the column its container's
 *  content begins at. A closer has to match the character and the width, and is measured against
 *  the same container its opener was, so all three travel together rather than as a bare depth. */
type Fence = { char: string; width: number; base: number };

/** Three or more backticks or three or more tildes and whatever info string follows, and the same
 *  run followed by nothing but whitespace. Neither pattern carries an indent bound of its own,
 *  because indentation is measured in columns against the containing block by `block_position`
 *  below and a regular expression cannot count columns; both are matched from the offset that scan
 *  returns. Both absorb the carriage return a map written on Windows leaves at the end of every
 *  line, which the rest of this reader absorbs the same way: the heading pattern takes it as
 *  trailing whitespace and a table cell is trimmed. It is spelled out rather than assumed, because
 *  `.` does not cross a carriage return and `$` does not sit before one, so an info string
 *  anchored the obvious way makes every fence in a CRLF document invisible and every illustration
 *  in it a binding. */
const FENCE_OPEN = /(`{3,}|~{3,})(.*)/y;
const FENCE_CLOSE = /(`{3,}|~{3,})[ \t]*\r?$/y;

/** A bullet or an ordered-list marker, matched where a container's content begins. A marker is
 *  the character and the space after it, so the space is looked at rather than consumed: `-`
 *  alone on a line is a marker, and `0.25 is the ceiling`, `-3 marks an absent column` and
 *  `*the market this map does not describe*` are prose. Without the lookahead each of those opens
 *  a container one or two columns wide, and a block indented four columns under it stops being
 *  the code a renderer draws — measured, an illustration under a line of ordinary prose bound
 *  `999/2/8` with a `shared_account_ceiling` of 99. `---` is prose here too, but no longer only
 *  because of the lookahead: `THEMATIC_BREAK` below reaches it first, along with the spaced
 *  spellings no lookahead can. */
const LIST_MARKER = /([-+*]|\d{1,9}[.)])(?=[ \t]|\r?$)/y;

/** A thematic break written with a character that also spells a bullet: three or more `-`, or
 *  three or more `*`, with nothing but whitespace between them and after the last. CommonMark
 *  gives the break precedence over the list item the same line could open, and the collision is
 *  the ordinary shape of a map correcting itself — a rule above the table that replaced the
 *  correction. Read as markers instead, `- - -` opens three nested items and carries the content
 *  column out to four, which turns the indented block under it from the code a renderer draws
 *  into a live table: measured, an illustration indented four columns under `- - -` bound
 *  `999/2/8` with a `shared_account_ceiling` of 99 where markdown-it drew no table at all.
 *  `_` gets no entry here because it opens no list, so nothing can mistake it for one, and `+`
 *  is deliberately absent: `+ + +` is three nested items to CommonMark and not a break. */
const THEMATIC_BREAK = /(?:-[ \t]*){3,}\r?$|(?:\*[ \t]*){3,}\r?$/y;

/** Nothing but whitespace. A blank line closes no list item, so the block scan leaves it alone. */
const BLANK = /^[ \t]*\r?$/;

/** A section heading, matched where its containing block's content begins rather than at the
 *  margin. Anchoring it at column zero was the one rule in this reader that measured indentation
 *  from the page instead of from the container, and CommonMark measures none of them there: one,
 *  two or three spaces in front of a `##` is still a heading a renderer draws, and only a fourth
 *  column makes the line the indented code `split_sections` has already dropped by the time this
 *  pattern is reached. So the bound is not spelled here either — `CODE_INDENT` is checked once,
 *  in columns, against the container, exactly as it is for a fence — and this pattern is matched
 *  from the offset that scan returns. Adding a leading `\s*` instead would have read an
 *  illustrated `## Role: revenue` indented four columns under a bullet as the live section.
 *
 *  What the margin anchor cost is a heading that is invisible here while being visible on the
 *  page, and invisible is the expensive kind of wrong, because a section that failed to parse and
 *  a section nobody wrote arrive at the same place: `event_role` finds no `## Role: revenue` and
 *  reports a project that collects none, which reads as a fact rather than as a parse. Placed
 *  after an existing section the same misindent is worse than silent — its rows are read as more
 *  of the section above, and the author is refused by name for the *preceding* heading carrying a
 *  second table, a true sentence about the wrong section that sends them to correct a part of the
 *  file that is already right.
 *
 *  The `(?!#)` guard stays. `###` and deeper are the prose headings the explanation is written
 *  under, and a reader that took them for sections would split that prose away from the bindings
 *  it justifies. */
const HEADING = /##(?!#)\s*(.+?)\s*$/y;

/**
 * How far past its containing block's content column a line may sit and still be read at all.
 * Four columns is an indented code block in CommonMark, and this is the only place the number
 * appears. The three-space allowance a fence opener is usually quoted with is the same rule from
 * the other side — a fourth column makes the run code rather than a fence — so spelling it a
 * second time inside the opener pattern would leave one of the two spellings unreachable, and an
 * unreachable bound is one nothing can test.
 */
const CODE_INDENT = 4;

/** Where the text on a line begins, walking from `offset` at `column`: the character offset it
 *  starts at and the column that offset sits at. A tab advances to the next four-column stop,
 *  which is how CommonMark counts one. */
function text_start(line: string, offset: number, column: number): { offset: number; column: number } {
  let at = offset;
  let col = column;
  for (; at < line.length; at++) {
    const char = line[at];
    if (char === " ") {
      col += 1;
      continue;
    }
    if (char === "\t") {
      col += 4 - (col % 4);
      continue;
    }
    break;
  }
  return { offset: at, column: col };
}

/**
 * Where a line sits in the document's block structure: the column its innermost open container's
 * content begins at, and the offset and column its own text begins at. `open` is the stack of
 * content columns of the list items still open, mutated in place as items close and start.
 *
 * CommonMark measures both of this reader's indent rules — the three-space allowance on a fence
 * opener, and the four columns that make an indented code block — from the containing block's
 * content column rather than from the left margin. A reader carrying no block structure has to
 * substitute a constant, and both constants are wrong in a way that costs something:
 *
 *   - Bounded absolutely at three, a correctly written fence inside a list item is not a fence.
 *     The illustration it holds is read as live content, and where it is the only
 *     `| field | value |` table under its heading it is installed as the binding with nothing
 *     said. Measured: an illustration declaring `999/2/8` with a `shared_account_ceiling` of 99,
 *     fenced at column four under a nested bullet, bound over a live `997/3/6` plan of ceiling 3.
 *   - Unbounded, a run of backticks that CommonMark says is indented code opens a fence instead,
 *     and everything up to its closer — or to the end of the document, where an indented example
 *     has none — is skipped. A table the reader can see is then not there for the parser, which
 *     is the same silent bind wearing the other shoe: the live table is what gets swallowed, and
 *     an illustration below it is what is left to bind.
 *
 * Neither direction is safe, so choosing between them is only a guess about which document is
 * rarer. Tracking the container removes the guess for the price of the scan below: list items are
 * the containers a map written by a person actually uses, and once their content columns are
 * known both rules are measured where the spec measures them.
 *
 * Where this stays approximate it is approximate towards refusing, which is the direction that
 * fails out loud. A paragraph continued lazily under a list item closes the item here where a
 * renderer keeps it open, so a fence written after one is measured against the margin and can be
 * read as content — a second table, refused by name, and an author told which section to correct.
 * Block quotes are not containers here at all, and that is the one gap measured rather than
 * argued. A differential of 288 generated documents — six containers, four fence spellings, six
 * indents, with and without a live table — against markdown-it agreed on 276, and every one of the
 * twelve disagreements is an *unfenced* table inside a quote. Not one fenced quoted document
 * disagreed, in either spelling or at any indent: a `>`-prefixed opener is invisible to this scan,
 * but so is everything it would have hidden, because `cells_of` refuses a `>`-prefixed line. What
 * the twelve cost is the second-table refusal — a quoted illustration beside a live table is not a
 * second table here, so the live one binds and nobody is told to fence the quote. Reading quoted
 * content would mean making `>` a container in `cells_of` as well, which is a larger change than
 * the fault it closes.
 */
function block_position(line: string, open: number[]): { base: number; offset: number; column: number } {
  let at = text_start(line, 0, 0);
  while (open.length > 0 && at.column < (open[open.length - 1] as number)) {
    open.pop();
  }
  let base = open.length > 0 ? (open[open.length - 1] as number) : 0;

  // Markers are walked off the front rather than stepped over, so a fence opened on the marker's
  // own line — `- ~~~markdown`, which is how a short illustration gets written — is a fence, and
  // so is the inner one in `- - ~~~`.
  while (at.column - base < CODE_INDENT) {
    // The break wins the tie, as it does in CommonMark, and it is checked at every depth: `- - -`
    // reads as a break at the margin, and so does the `- - -` a bullet introduces.
    THEMATIC_BREAK.lastIndex = at.offset;
    if (THEMATIC_BREAK.test(line)) {
      break;
    }
    LIST_MARKER.lastIndex = at.offset;
    const marker = LIST_MARKER.exec(line);
    if (marker === null) {
      break;
    }
    const marker_end = at.column + (marker[0] as string).length;
    const after = text_start(line, LIST_MARKER.lastIndex, marker_end);
    // An item holding nothing, or holding something five or more columns along, starts its content
    // one column past the marker: in the second case what follows is an indented code block, and
    // measuring the item from it would turn that code into ordinary content.
    const empty = after.offset >= line.length || line[after.offset] === "\r";
    base = empty || after.column - marker_end > CODE_INDENT ? marker_end + 1 : after.column;
    open.push(base);
    if (empty) {
      return { base, offset: after.offset, column: base };
    }
    at = after;
  }
  return { base, offset: at.offset, column: at.column };
}

/**
 * The fence a line opens, or null where it opens none. `at` is the line's place in the block
 * structure, already known to be content rather than code.
 *
 * Both spellings CommonMark defines are read here. A map written with tildes has to parse the same
 * as one written with backticks, or the instruction to fence an illustration is true of half the
 * fences a renderer honours: an author who tilde-fences a worked example is told to fence it and
 * then refused for the second table anyway, and where the tilde-fenced example is the only table
 * under its heading it is installed as the binding with nothing said.
 *
 * The info string is free text with one exception: a backtick fence's may not contain a backtick,
 * because a line of prose carrying inline code is not the start of a block. A tilde fence has no
 * such collision and its info string may hold backticks. That exception is not pedantry — the
 * whole point of matching the spec here is that the parser reads the document the way the renderer
 * draws it, so an author who checks the preview and sees a code block is not looking at something
 * this reader treats as a binding, nor the reverse.
 */
function fence_opened_by(line: string, at: { base: number; offset: number }): Fence | null {
  FENCE_OPEN.lastIndex = at.offset;
  const opener = FENCE_OPEN.exec(line);
  if (opener === null) {
    return null;
  }
  const run = opener[1] as string;
  const char = run[0] as string;
  if (char === "`" && (opener[2] as string).includes("`")) {
    return null;
  }
  return { char, width: run.length, base: at.base };
}

/**
 * Whether this line closes the fence that is open.
 *
 * Four conditions, and every one of them is a way a fence ends too early — which is the direction
 * that costs something, because everything after a premature close reads as the document's own
 * content and an illustrated table becomes a binding. The closer is written with the same
 * character, so `~~~` inside a backtick block is content and ``` inside a tilde block is too. It
 * is at least as long as the opener, so ``` does not close ````. It carries nothing after the run
 * but whitespace, so ````markdown inside a ``` block is content rather than a close. And it stands
 * within three columns of the same container its opener was measured against, so a run indented
 * into code inside the block is content.
 *
 * Its indent is otherwise its own business inside those bounds: the opener's constrains nothing,
 * so a fence opened at its container's content column can be closed by a closer two columns
 * further in, and the other way round. A run standing further out than the container never
 * reaches here, because `split_sections` has already ended the block by the time it is read — a
 * line that outdents past a list item ends the item, and the fenced block the item was holding
 * ends with it. Such a run is then read as a line of the document like any other, which is where
 * a renderer puts it too: it opens a fence rather than closing one.
 *
 * `at` is where the line's own text begins, already scanned by the caller.
 */
function fence_closed_by(line: string, at: { offset: number; column: number }, open: Fence): boolean {
  if (at.column - open.base >= CODE_INDENT) {
    return false;
  }
  FENCE_CLOSE.lastIndex = at.offset;
  const closer = FENCE_CLOSE.exec(line);
  if (closer === null) {
    return false;
  }
  const run = closer[1] as string;
  return run[0] === open.char && run.length >= open.width;
}

/**
 * Split the document into the lines under each `##` heading, dropping everything a renderer draws
 * as code. Fences are matched by character and by length, so a fence demonstrating another fence
 * closes where the renderer closes it and not before, and by indent against the containing block,
 * so a fence nested under a list item is one.
 *
 * A line standing four or more columns past its container's content is dropped for the same
 * reason: it is an indented code block, or the continuation of a paragraph, and a renderer draws
 * no table out of either. Dropping rather than keeping is what makes the illustration somebody
 * indented instead of fencing invisible here as well as on the page. It joins the table rows
 * either side of it, which is what dropping a fenced block between two tables has always done in
 * this reader.
 *
 * A fenced block ends at its closer or with the block that contains it, whichever comes first.
 * CommonMark closes a list item on the first line that outdents past its content column, and
 * everything the item was holding closes with it — the fence included, closer or no closer. A
 * reader that watches only for the closer keeps swallowing: under a bullet, an illustration whose
 * fence a `##` at the margin has already ended reads on to the next run of backticks, and the
 * table below that run — which a renderer draws inside `<pre><code>`, because the outdented run
 * opened a second fence rather than closing the first — is read as live content and installed as
 * the binding. Measured against markdown-it in commonmark mode, sixteen of twenty-four generated
 * shapes bound `illustration.csv` that way, in both fence spellings, under bullet and ordered
 * markers, and for four kinds of outdented line including ordinary prose at the margin.
 *
 * A heading declared twice is refused rather than merged or overwritten. Two `## Role: person`
 * sections is what a map edited by two people, or copied from another project and half-adjusted,
 * looks like; the second silently wins, so the bindings a reader sees at the top of the file are
 * not the ones the run uses, and every column in between reads as correct while pointing at the
 * wrong table.
 */
function split_sections(text: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  const open: number[] = [];
  let current: string[] | null = null;
  let fence: Fence | null = null;

  for (const line of text.split("\n")) {
    const blank = BLANK.test(line);
    if (fence !== null) {
      // A blank line closes no container, so it ends no fence either.
      if (blank) {
        continue;
      }
      const start = text_start(line, 0, 0);
      if (start.column >= fence.base) {
        if (fence_closed_by(line, start, fence)) {
          fence = null;
        }
        continue;
      }
      // The line begins before the content column the fence was measured against, so it has
      // outdented past the container holding the block and ended both. It is a line of the
      // document rather than of the block, and falls through to be read as one.
      fence = null;
    }
    if (blank) {
      if (current !== null) {
        current.push(line);
      }
      continue;
    }

    const at = block_position(line, open);
    if (at.column - at.base >= CODE_INDENT) {
      continue;
    }
    const opened = fence_opened_by(line, at);
    if (opened !== null) {
      fence = opened;
      continue;
    }

    HEADING.lastIndex = at.offset;
    const heading = HEADING.exec(line);
    if (heading !== null) {
      const name = `## ${heading[1] as string}`;
      if (sections.has(name)) {
        throw new MapSectionError(
          name,
          "declared twice in this map. The later one silently replaces the earlier, so the binding " +
            "a reader checks is not the binding the run uses. Merge the two into one section, or " +
            "rename whichever of them describes something else",
        );
      }
      current = [];
      sections.set(name, current);
      continue;
    }
    if (current !== null) {
      current.push(line);
    }
  }
  return sections;
}

/** Cells of a markdown pipe row, or null where the line is not one. */
function cells_of(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    return null;
  }
  const inner = trimmed.slice(1, trimmed.endsWith("|") ? -1 : undefined);
  return inner.split("|").map((cell) => cell.trim());
}

/**
 * The one `| field | value |` table under a heading, or null where the section carries none.
 *
 * A second table under the same heading is refused. This is the unfenced sibling of the case the
 * fence guard closes, and the worse spelling of it, because nothing about a plain table above the
 * real one looks like a trick: measured end to end, an unfenced worked example above the live
 * `## Phone format` block installed the example's dialling plan and the run published
 * `matched_accounts` 1 with `conversions {count: 1, value: 10}` where the same exports under the
 * honest table give 3 and `{count: 3, value: 30}` — a third of the truth, and no error anywhere.
 *
 * Reading the last table rather than the first would relocate the fault instead of closing it: an
 * example above the real block is silent under first-wins, and a correction appended below a
 * superseded block is silent under last-wins, so whichever end the parser picks, somebody read the
 * other. Refusing is also what the guards either side of this one do — the duplicate-heading guard
 * refuses rather than merging, the duplicate-key guard below refuses rather than resolving — and
 * this would be the only one of the three where the parser still picks. The cost is that a map
 * documenting an example has to fence it, which is the convention the fence guard already set.
 *
 * The whole section is scanned for headers before any row is read, so a section carrying both a
 * second table and a bad key inside the first reports the second table: which table binds is not
 * a question the key-level errors can be read against.
 */
function read_table_of(lines: string[], heading: string): Table | null {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const header = cells_of(lines[i] as string);
    if (header === null || header.length !== 2) {
      continue;
    }
    if (header[0]?.toLowerCase() !== "field" || header[1]?.toLowerCase() !== "value") {
      continue;
    }
    if (start !== -1) {
      throw new MapSectionError(
        heading,
        "carries a second `| field | value |` table. Only one of them can be the binding and " +
          "neither end is safe to pick: an example above the real table wins if the first is " +
          "read, a correction below a superseded one wins if the last is, and either way somebody " +
          "read the table that does not run. Fence whichever of them is illustration — three or " +
          "more backticks or three or more tildes, and nothing inside one is read here — or " +
          "delete it",
      );
    }
    start = i;
  }
  if (start === -1) {
    return null;
  }

  const table: Table = new Map();
  for (let r = start + 1; r < lines.length; r++) {
    const row = cells_of(lines[r] as string);
    if (row === null) {
      break;
    }
    const key = row[0] as string;
    // The alignment row carries no data; every cell is dashes and colons.
    if (/^:?-{1,}:?$/.test(key)) {
      continue;
    }
    // A key written twice is refused rather than resolved, for the reason the duplicate-heading
    // guard one level up already gives: a `Map` keeps the last write, and the reader looking at
    // the document sees the first. So the binding that runs is the one nobody read. Measured
    // before this refused: an `at` declared as `signed_at` and then again as `row_created_at`
    // published `conversions {count: 0, value: 0}` where the visible first binding gives
    // `{count: 1, value: 500}` — no error, and a row of zeros is this engine's cheapest wrong
    // answer. Editing a map by copying a line and forgetting to change its key is how it arrives.
    if (table.has(key)) {
      throw new MapFieldError(
        heading,
        key,
        "declared twice in this table. Only the second row would be read, while a person reading " +
          "the document sees the first, so the binding that runs is the one nobody checked. " +
          "Delete the row that does not belong.",
      );
    }
    table.set(key, row.slice(1).join("|").trim());
  }
  return table;
}

function section_table(sections: Map<string, string[]>, heading: string): Table {
  const lines = sections.get(heading);
  if (lines === undefined) {
    throw new MapSectionError(heading, "the map does not declare this section, and it is required");
  }
  const table = read_table_of(lines, heading);
  if (table === null) {
    throw new MapSectionError(heading, "no `| field | value |` table under this heading — only prose");
  }
  return table;
}

/** Read and consume a key. What is left in the table afterwards is by definition unknown. */
function take(table: Table, section: string, key: string): string {
  const value = table.get(key);
  if (value === undefined) {
    throw new MapFieldError(section, key, "required, and the section does not declare it");
  }
  table.delete(key);
  return value;
}

function take_number(table: Table, section: string, key: string, whole: boolean): number {
  const raw = take(table, section, key);
  const value = Number(raw);
  const acceptable = whole ? Number.isInteger(value) : Number.isFinite(value);
  if (raw.trim() === "" || !acceptable) {
    throw new MapFieldError(
      section,
      key,
      `expected ${whole ? "a whole number" : "a number"}, got ${JSON.stringify(raw)}`,
    );
  }
  return value;
}

function reject_unknown(table: Table, section: string): void {
  const [unknown] = table.keys();
  if (unknown === undefined) {
    return;
  }
  throw new MapFieldError(
    section,
    unknown,
    "not a key this section defines. A typo that parses as silence is how a binding goes missing with nothing to notice it",
  );
}

/** Revenue and churn bind identically; only which events they hold differs. */
function event_role(sections: Map<string, string[]>, heading: string): RoleBinding | undefined {
  if (!sections.has(heading)) {
    return undefined;
  }
  const table = section_table(sections, heading);
  const binding: RoleBinding = {
    export: take(table, heading, "export"),
    columns: {
      person: take(table, heading, "person"),
      at: take(table, heading, "at"),
      amount: take(table, heading, "amount"),
    },
  };
  reject_unknown(table, heading);
  return binding;
}

/**
 * Read a map. Structure only: this never opens the schema file, so a map naming one that has moved
 * still parses and the drift check stays a separate, reportable failure rather than a parse error.
 */
export async function load_map(path: string): Promise<DatabaseMap> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new MapMissingError(
      path,
      "Measuring without a map means guessing which column holds what, and a guess that parses " +
        "produces numbers nobody can trace back to a table.",
    );
  }
  const sections = split_sections(await file.text());

  const phone_table = section_table(sections, SECTION_PHONE);
  const phone: PhoneFormat = {
    country_code: take(phone_table, SECTION_PHONE, "country_code"),
    area_digits: take_number(phone_table, SECTION_PHONE, "area_digits", true),
    subscriber_digits: take_number(phone_table, SECTION_PHONE, "subscriber_digits", true),
    max_unparseable_rate: take_number(phone_table, SECTION_PHONE, "max_unparseable_rate", false),
    shared_account_ceiling: take_number(phone_table, SECTION_PHONE, "shared_account_ceiling", true),
  };
  const area_codes = phone_table.get("area_codes");
  if (area_codes !== undefined) {
    phone_table.delete("area_codes");
    phone.area_codes = area_codes
      .split(",")
      .map((code) => code.trim())
      .filter((code) => code !== "");
  }
  reject_unknown(phone_table, SECTION_PHONE);
  // Building the deriver validates the format once, here, where the failure can still name the
  // map instead of surfacing as an index that matches nothing.
  make_key(phone);

  const fingerprint_table = section_table(sections, SECTION_FINGERPRINT);
  const fingerprint = {
    schema: take(fingerprint_table, SECTION_FINGERPRINT, "schema"),
    models: take(fingerprint_table, SECTION_FINGERPRINT, "models")
      .split(",")
      .map((model) => model.trim())
      .filter((model) => model !== ""),
    sha256: take(fingerprint_table, SECTION_FINGERPRINT, "sha256"),
  };
  reject_unknown(fingerprint_table, SECTION_FINGERPRINT);
  if (fingerprint.models.length === 0) {
    throw new MapFieldError(SECTION_FINGERPRINT, "models", "lists no blocks, so the hash would cover nothing");
  }

  const person_table = section_table(sections, SECTION_PERSON);
  const person: RoleBinding = {
    export: take(person_table, SECTION_PERSON, "export"),
    columns: {
      id: take(person_table, SECTION_PERSON, "id"),
      phone: take(person_table, SECTION_PERSON, "phone"),
      created_at: take(person_table, SECTION_PERSON, "created_at"),
    },
  };
  reject_unknown(person_table, SECTION_PERSON);

  const conversion_table = section_table(sections, SECTION_CONVERSION);
  const conversion: RoleBinding = {
    export: take(conversion_table, SECTION_CONVERSION, "export"),
    columns: {
      person: take(conversion_table, SECTION_CONVERSION, "person"),
      at: take(conversion_table, SECTION_CONVERSION, "at"),
      amount: take(conversion_table, SECTION_CONVERSION, "amount"),
      status: take(conversion_table, SECTION_CONVERSION, "status"),
    },
    valid_statuses: take(conversion_table, SECTION_CONVERSION, "valid_statuses")
      .split(",")
      .map((status) => status.trim())
      .filter((status) => status !== ""),
  };
  const at_fallback = conversion_table.get("at_fallback");
  if (at_fallback !== undefined) {
    conversion_table.delete("at_fallback");
    conversion.columns.at_fallback = at_fallback;
  }
  // The split is optional, and the two keys that express it are one declaration. A project whose
  // product has no recycled balance leaves both out and the record omits the breakdown rather
  // than reporting zeros for a distinction that does not exist. Half of it is neither: it is a
  // binding somebody started and stopped, and reading it as "no split" would silently drop a
  // distinction the map says exists.
  const split = conversion_table.get("split");
  const recycled_when = conversion_table.get("recycled_when");
  conversion_table.delete("split");
  conversion_table.delete("recycled_when");
  if (split !== undefined && recycled_when === undefined) {
    throw new MapFieldError(
      SECTION_CONVERSION,
      "recycled_when",
      "missing while `split` is declared. The two are declared together or not at all: a split " +
        "column with no value marking the recycled side cannot be read, and treating the pair as " +
        "absent would drop a distinction this map says the product has",
    );
  }
  if (recycled_when !== undefined && split === undefined) {
    throw new MapFieldError(
      SECTION_CONVERSION,
      "split",
      "missing while `recycled_when` is declared. The two are declared together or not at all: a " +
        "value marking the recycled side names no column to read it from, and treating the pair " +
        "as absent would drop a distinction this map says the product has",
    );
  }
  if (split !== undefined && recycled_when !== undefined) {
    conversion.columns.split = split;
    conversion.recycled_when = recycled_when;
  }
  reject_unknown(conversion_table, SECTION_CONVERSION);
  if (conversion.valid_statuses?.length === 0) {
    throw new MapFieldError(
      SECTION_CONVERSION,
      "valid_statuses",
      "names no status, so nothing would ever count as committed and every cell would report zero",
    );
  }

  const map: DatabaseMap = { phone, person, conversion, fingerprint };
  const revenue = event_role(sections, SECTION_REVENUE);
  const churn = event_role(sections, SECTION_CHURN);
  // Both bindings are in hand here and nowhere later: by the time the indices are built the two
  // roles have been separated into two arguments and the reader that could compare them is gone.
  if (
    revenue !== undefined &&
    churn !== undefined &&
    revenue.export === churn.export &&
    revenue.columns.person === churn.columns.person &&
    revenue.columns.at === churn.columns.at &&
    revenue.columns.amount === churn.columns.amount
  ) {
    throw new MapDuplicateBindingError([SECTION_REVENUE, SECTION_CHURN], revenue);
  }
  if (revenue !== undefined) {
    map.revenue = revenue;
  }
  if (churn !== undefined) {
    map.churn = churn;
  }
  return map;
}

/**
 * Hash the schema blocks the map claims to describe and compare against the hash it recorded.
 *
 * The schema path is resolved against the map's own directory, not against a configured root. A
 * map that has to be told where the repository starts is a map that needs configuration to guard
 * anything, and a guard nobody configures is a guard nobody runs. The map already knows where its
 * schema is; that is the only fact needed.
 *
 * Reports rather than throws on a mismatch, and both outcomes carry both hashes, because the
 * caller with a difference in hand still has to say what it means. A missing file and an unfindable
 * block do throw, and they throw as different errors: a hash that differs and a file that is not
 * there are different problems, and merging them teaches people to ignore the check.
 *
 * A listed name may be a `model` or an `enum`, and an enum is not a nicety. The status list a map
 * declares under `valid_statuses`, and the value it declares under `recycled_when`, are values of
 * an enum that lives outside every model block — so a migration renaming one of them leaves every
 * hashed block byte-identical while the run it guards silently counts nothing, or moves a whole
 * sum from one side of the split to the other. Those are the two drifts this check exists for and
 * the two it could not see, so a map that names its status enum among its blocks now gets what it
 * asked for instead of an error.
 */
export async function verify_fingerprint(
  map: DatabaseMap,
  map_path: string,
): Promise<{ ok: boolean; expected: string; actual: string }> {
  const cut = Math.max(map_path.lastIndexOf("/"), map_path.lastIndexOf("\\"));
  const directory = cut === -1 ? "." : map_path.slice(0, cut) || "/";
  const schema_path = map.fingerprint.schema.startsWith("/")
    ? map.fingerprint.schema
    : `${directory}/${map.fingerprint.schema}`;

  const file = Bun.file(schema_path);
  if (!(await file.exists())) {
    throw new MapMissingError(
      schema_path,
      "The map points its fingerprint at this file. A hash cannot be checked against a file that " +
        "is not there, and an unchecked hash is a written date.",
    );
  }

  const lines = (await file.text()).split("\n");
  const blocks: string[] = [];
  for (const block of map.fingerprint.models) {
    // `model` or `enum`: a schema declares the two the same way, and a map lists a name rather
    // than a kind, so the reader does not have to know which it is to hash it.
    const opener = new RegExp(`^\\s*(?:model|enum)\\s+${block.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (opener.test(lines[i] as string)) {
        start = i;
        break;
      }
    }
    if (start === -1) {
      throw new MapSectionError(
        block,
        `no model or enum block declaring it in ${schema_path}, though the map's fingerprint lists it`,
      );
    }
    let end = -1;
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i] === "}") {
        end = i;
        break;
      }
    }
    if (end === -1) {
      throw new MapSectionError(
        block,
        `its block in ${schema_path} never closes, so there is nothing definite to hash`,
      );
    }
    blocks.push(lines.slice(start, end + 1).join("\n"));
  }

  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(blocks.join("\n"));
  const actual = hasher.digest("hex");
  const expected = map.fingerprint.sha256;
  return { ok: actual === expected.trim().toLowerCase(), expected, actual };
}
