import type { CountryCode } from "../../../internal/phone.ts";
import { dominant_market, market_divergence, place } from "../../../internal/phone.ts";
import { round_half_even, round_or_null } from "../../../internal/round.ts";
import { median, two_proportion } from "../../../internal/stats.ts";
import { assert_unshadowed, read_identifiers } from "../../../internal/table.ts";
import {
  parse_ts,
  parse_ts_with_precision,
  TimestampError,
  type TimestampReading,
} from "../../../internal/timestamp.ts";
import type { RoleName, Source } from "./source.ts";
import { SourceError } from "./source.ts";

export { PhoneFormatError } from "../../../internal/phone.ts";
export {
  DuplicateColumnError,
  MissingColumnError,
  TextListOptionError,
  UnsupportedListFormatError,
  UnterminatedQuoteError,
} from "../../../internal/table.ts";
export { TimestampError } from "../../../internal/timestamp.ts";
export type { RoleName, Source } from "./source.ts";
export { files, postgres, SourceError, TimestampDriverError } from "./source.ts";

/**
 * The measurement pass, and the shape of what goes into and comes out of it.
 *
 * Every object below uses snake_case keys, because the emitted record is the public surface and it
 * is snake_case; a declaration in a different case would make every campaign script translate
 * between two conventions for no reason.
 *
 * None of these labels comes from a business. The engine computes four roles and names the record
 * after them, so the shape belongs to this package. The map says which tables and columns fill
 * those roles and stops there — it never learns that a campaign script exists.
 *
 * Every failure below is loud and named for one reason: this engine's cheapest wrong answer is
 * zero. A dialling plan that does not match the market, a list file that moved, a column someone
 * renamed, a cut set to a planning date instead of a send time — each of those produces a record
 * full of zeros that reads exactly like a campaign nobody responded to. So the pass refuses at
 * every point where the two are indistinguishable, and the error says which one happened.
 */

/** One measured group. A cell is a list plus the moment it was reached. */
export type Cell = {
  /** Join key for controls and for the emitted record. */
  name: string;
  /** ISO-8601 UTC. The real moment of contact — not midnight, not the planning date. A cut
   *  earlier than the truth counts people who arrived before anything reached them. A day its
   *  month does not have is refused rather than rolled forward: the runtime would answer
   *  `2030-02-30` with 2 March and the record would go on publishing 30 February. */
  cut: string;
  /** True while no confirmed contact time exists. Measuring against a placeholder is the
   *  documented way this kind of report once claimed arrivals that never happened. */
  cut_provisional?: boolean;
  /** Files holding the reached identifiers. Unioned, then de-duplicated by derived key. */
  lists: readonly string[];
  /** Column holding the phone. Defaults to the first column. */
  column?: string;
  /** Row filter, for one file holding several cells. Splitting it into derived files would
   *  create copies free to drift from the source the attribution depends on. */
  filter?: { column: string; value: string };
  /** `cold` has no counterfactual: nobody who never heard of the brand arrives unprompted, so
   *  arrival is the outcome. `own_base` already holds accounts, so arrival measures nothing
   *  and commitment is the outcome. The engine rejects a control pair that contradicts this. */
  audience: "cold" | "own_base";
  /** Identifiers to subtract before measuring: planted probes, internal numbers. Counting one
   *  as a member inflates the rate of whichever cell it landed in. */
  exclude?: readonly string[];
};

/** A treated cell measured against an untouched one. */
export type Control = {
  treated: string;
  control: string;
  /** Dotted path into the record, e.g. `acquired.accounts`. Resolved and validated rather
   *  than left as a bare string the reader has to interpret. */
  outcome: string;
};

/** A count and a sum. Both event roles carry the same shape; a flat form would name them four
 *  different things and hide that they are one. `value` is null where the role has no money. */
export type EventTotals = { leads: number; value: number | null };

export type AcquiredRevenue = EventTotals & {
  /** Share of the total held by the two largest contributors. Concentration hides in an
   *  average, and it has been found by hand more than once. */
  top2_share: number | null;
  /** Days from the **cut** to a person's first payment counted from it, medianed over the acquired
   *  accounts that paid and rounded to one decimal. From the cut, not from the account's creation:
   *  an account that arrives ten days after contact and pays the same afternoon reports ten, not
   *  nothing, because what this measures is how long the money took to follow the send. A median
   *  over people rather than a mean over events, so somebody paying weekly cannot drag it. Null
   *  where nobody in the group paid — there is no first payment to measure to. */
  median_lag_days: number | null;
};

export type ControlReading = {
  against: string;
  outcome: string;
  treated_rate: number;
  control_rate: number;
  lift: number | null;
  control_events: number;
  p: number | null;
  /** A comparison travelling without its uncertainty becomes a wrong decision in two days.
   *  False until the difference clears significance and the control carries enough events. */
  publishable: boolean;
};

export type CellRecord = {
  cell: string;
  cut_utc: string;
  /** Present and true only where the declaration called the cut a placeholder. Mirrored onto the
   *  record so the caveat travels with the numbers: whoever opens this JSON weeks later reads on
   *  the same line that the moment everything is measured from was a guess. */
  cut_provisional?: boolean;
  /** When this reading was taken. Every reading is self-dating, because an undated number
   *  misleads someone two weeks later. */
  measured_utc: string;
  /** Hours between the cut and the reading. Makes the floor mechanical instead of prose. */
  window_hours: number;
  audience: { listed: number; matched_phones: number; matched_accounts: number };
  acquired: {
    accounts: number;
    within: { h24: number; d7: number; d30: number };
    revenue?: AcquiredRevenue;
    churn?: EventTotals;
  };
  pre_existing: { accounts: number; revenue?: EventTotals; churn?: EventTotals };
  /** `new_money` and `recycled` are present only where the map declares the split. A product
   *  with no recycled balance has no such distinction, and reporting it as two zeros would
   *  invent one. */
  conversions: { count: number; value: number; new_money?: number; recycled?: number };
  control?: ControlReading;
};

export type MeasureOptions = {
  /** Where the four roles' rows come from. A database, a directory of exports, anything that can
   *  answer with rows — see `Source`. The engine never learns which. */
  source: Source;
  cells: readonly Cell[];
  controls?: readonly Control[];
  /** How far a cell's markets may diverge from the lead index's before the run refuses it, as a
   *  total-variation distance in `0..1`. Defaults to 0.5, which passes a list drawn from the same
   *  base and refuses one drawn from somewhere else entirely. See `market_divergence` for why a
   *  parse-rate ceiling cannot do this job. */
  max_market_divergence?: number;
  /** Overrides the reading time. Only a test has a reason to set this. */
  now?: Date;
};

/** Readings below this are never publishable, whatever the p-value says. Seven days, because that
 *  is longer than the tail of any response this engine has been pointed at: a shorter window has
 *  not finished collecting the thing it is being asked about. */
export const WINDOW_FLOOR_HOURS = 24 * 7;

/** Below this many events in the control, one outlier flips the sign of the comparison. */
export const MIN_CONTROL_EVENTS = 10;

/** The conventional two-sided significance threshold. Exported rather than written inline so an
 *  old reading can be re-checked against the number that produced it. */
export const MAX_P = 0.05;

/**
 * The gate on a published comparison: significance, and the two conditions significance cannot
 * speak for.
 *
 * The p read here is the unrounded one, because rounding first would let a value sitting just
 * above the threshold cross it on presentation alone, and the comparison is `<` rather than `<=`
 * — a reading exactly on the threshold has not cleared it. The other two are `>=`: a control
 * carrying exactly `MIN_CONTROL_EVENTS`, and a window standing exactly on `WINDOW_FLOOR_HOURS`,
 * are inside. Below the minimum one outlier in the control flips the sign of the comparison.
 * Below the floor the window is younger than the tail of any response, and an early reading that
 * clears p is the most confidently wrong number this engine can produce — so the floor outranks
 * the p-value rather than qualifying it.
 *
 * A named export rather than an expression inside the record literal, because this is the one
 * boolean deciding whether a number leaves the building, and it is the shape of the decision
 * rather than a rename: three thresholds, one of them strict and two of them not. Inline it could
 * only be exercised through data, and no arrangement of integer counts puts a p-value exactly on
 * the threshold — whether that comparison was inclusive could not be pinned at all, and a
 * mutation pass moved it with the suite still green. A caller holding a stored reading can also
 * ask it directly whether a longer window would publish that reading.
 */
export function is_publishable(p: number | null, control_events: number, window_hours: number): boolean {
  return p !== null && p < MAX_P && control_events >= MIN_CONTROL_EVENTS && window_hours >= WINDOW_FLOOR_HOURS;
}

/**
 * More of a file's identifiers are unreadable than the map permits.
 *
 * Raised against the person export and against a cell's own lists, because the fault has opposite
 * signs on the two sides and both mislead. Unreadable people shrink the index, so the audience
 * looks like it never registered; unreadable list entries shrink the denominator every rate is
 * divided by, so the audience looks like it converted brilliantly.
 */
export class UnparseablePhonesError extends Error {
  readonly source: string;

  constructor(unreadable: number, total: number, rate: number, ceiling: number, source = "the person export") {
    super(
      `${unreadable} of ${total} distinct identifiers in ${source} could not be read ` +
        `(${(rate * 100).toFixed(1)}%), ` +
        `above the ${(ceiling * 100).toFixed(1)}% the map allows. A dialling plan that does not match this ` +
        "market and a list of people who genuinely never registered produce the same zero, and only one of " +
        "them is a result — so the run stops instead of reporting it. Either the map's phone format is wrong " +
        "for this data, or the file is.",
    );
    this.name = "UnparseablePhonesError";
    this.source = source;
  }
}

/** A bound export, or a file a cell lists, is not where it was said to be. */
export class MissingExportError extends Error {
  readonly path: string;

  constructor(path: string, wanted_by: string) {
    super(
      `${wanted_by} needs ${path}, and it is not there. Produce the export before measuring: a missing ` +
        "file measured as absent is a campaign credited with nothing.",
    );
    this.name = "MissingExportError";
    this.path = path;
  }
}

/** A bound amount column that is empty on a row, or holding something that is not a number. The
 *  two have different fixes, so the message names which one happened.
 *
 *  A third case used to be named here — the column absent from the file — and it could not
 *  happen. `read_export` asserts every column the map binds against the header before a single
 *  row is indexed, and `read_rows` fills a short row's missing columns with an empty string
 *  rather than leaving them off, so nothing reaching this class can be absent rather than blank.
 *  An absent column is `ExportColumnError`, which says so with the header beside it. */
export class ExportValueError extends Error {
  constructor(path: string, column: string, raw: string) {
    const found =
      raw.trim() === ""
        ? "is empty on one row, and an amount nobody wrote is not an amount of zero — fill the row " +
          "at the source, or narrow the export to the rows that carry a value"
        : `holds ${JSON.stringify(raw)}, which is not a number — look for a currency symbol, a ` +
          "thousands separator, or a decimal comma the export left in";
    super(
      `${path} column ${JSON.stringify(column)} ${found}. Treating it as zero would quietly shrink a ` +
        "total that someone will publish.",
    );
    this.name = "ExportValueError";
  }
}

/** A column the map binds for a role is not in that role's export. */
export class ExportColumnError extends Error {
  readonly path: string;
  readonly role: string;
  readonly column: string;

  constructor(path: string, role: string, column: string, header: readonly string[]) {
    super(
      `the ${role} role binds column ${JSON.stringify(column)}, and ${path} does not carry it. Its ` +
        `header is ${header.map((name) => JSON.stringify(name)).join(", ") || "(empty)"}. Either the map ` +
        "names a column that has since been renamed, or this export came from the wrong query — the " +
        "header above says which, and without it the reader goes looking in the wrong file. Correct the " +
        "binding or re-export, then measure again.",
    );
    this.name = "ExportColumnError";
    this.path = path;
    this.role = role;
    this.column = column;
  }
}

/** What a blanked-out column was bound for, and the silence that follows when nothing reads. */
const BLANK_COLUMN_CONSEQUENCE = {
  timestamp: "every event then falls out of the accumulator silently: a full file of real events reports as none",
  "phone number":
    "every row then fails to reach the index silently: a full base of real accounts matches nobody, " +
    "and every cell reports an audience that was never there",
};

/** What a bound column holds. Spelled out at every throw site rather than defaulted: the wording
 *  fault this exists to prevent is a message describing the wrong kind of column, and a default is
 *  how three of four call sites would inherit the wrong one without a test able to see it.
 *
 *  A kind must read as a singular noun phrase — the message interpolates it twice, as "binds X for
 *  its <kind>" and "bind the one that now holds the <kind>". The type catches a kind with no
 *  sentence and a sentence with no kind; that a sentence describes its kind truthfully is the one
 *  thing left to a reader, and the reachability test each kind carries is where it gets read. */
type BlankColumnKind = keyof typeof BLANK_COLUMN_CONSEQUENCE;

/** A bound column that is in the header and empty, or unreadable, on every row. */
export class ExportBlankColumnError extends Error {
  readonly path: string;
  readonly role: string;
  readonly columns: readonly string[];

  constructor(path: string, role: string, columns: readonly string[], rows: number, what: BlankColumnKind) {
    const named = columns.map((name) => JSON.stringify(name)).join(" or ");
    super(
      `the ${role} role binds ${named} for its ${what}, and not one of the ${rows} rows in ${path} ` +
        `carries a readable one. The column is in the header, so the binding passes and ` +
        `${BLANK_COLUMN_CONSEQUENCE[what]}. A ` +
        "column renamed at the source often leaves the old one behind, present and blank on every row, " +
        `which is exactly this. Re-export with the column populated, or bind the one that now holds the ` +
        `${what}. A file with no rows at all is a fact and passes here — this is a file with rows and ` +
        "nothing readable in them, which is a fault.",
    );
    this.name = "ExportBlankColumnError";
    this.path = path;
    this.role = role;
    this.columns = columns;
  }
}

/**
 * A column the contract reads as a boolean, holding something that is neither `true` nor `false`.
 *
 * Kept apart from `ExportValueError`, which is about amounts and says so. The likely cause here is
 * a query passing its own vocabulary straight through — a status, a payment method — where the
 * contract asked for the answer to a question. Reading an unrecognised value as `false` is exactly
 * the silent-zero this boundary exists to prevent.
 */
export class ExportFlagError extends Error {
  readonly role: string;
  readonly column: string;
  readonly raw: string;

  constructor(role: string, column: string, raw: string) {
    super(
      `the ${role} role's ${JSON.stringify(column)} column holds ${JSON.stringify(raw)}, and the ` +
        "contract reads it as a boolean: the literal `true` or the literal `false`, nothing else. " +
        (raw === ""
          ? "It is empty on this row, and an unanswered question is not an answer of no."
          : "This looks like a value from the source's own vocabulary being passed through where " +
            "the query should have answered the question instead - `(status in (...)) as committed` " +
            "rather than `status as committed`.") +
        " Reading it as false would drop the row from every count without a word.",
    );
    this.name = "ExportFlagError";
    this.role = role;
    this.column = column;
    this.raw = raw;
  }
}

/**
 * A conversion role with rows, not one of which is marked committed.
 *
 * This is the renamed-value trap, caught at measurement time. The predicate lives in the source's
 * own query, so a value it compares against — a status, a state, whatever the product calls it —
 * can be renamed in a migration while the query stays valid and simply stops matching. The rows
 * arrive, every one is dropped, and the cell reports no conversions at all, which reads exactly
 * like a campaign nobody committed to.
 *
 * It cannot name the values it saw, and that is deliberate: they are the product's vocabulary and
 * this package is published. The author of the predicate has the context this message would only
 * be guessing at.
 */
export class ExportStatusError extends Error {
  readonly rows: number;

  constructor(rows: number) {
    super(
      `the conversion role answered ${rows} rows and marked none of them committed. Every row is ` +
        "then dropped and the cell reports no conversions at all, which is indistinguishable from a " +
        "campaign nobody committed to. The usual cause is a value the `committed` predicate compares " +
        "against having been renamed, leaving the query valid and matching nothing — read the " +
        "predicate against the values the column actually holds. A role with no rows at all is a " +
        "fact and passes here; this is rows with nothing countable in them, which is a fault.",
    );
    this.name = "ExportStatusError";
    this.rows = rows;
  }
}

/** A role's export that references nobody in the person export. Every row can be well-formed while
 *  the join is against the wrong kind of identifier, so the whole file falls out of every cell. */
export class ExportJoinError extends Error {
  readonly path: string;
  readonly role: string;
  readonly column: string;

  constructor(path: string, role: string, column: string, sample: string, person_sample: string, identifiers: number) {
    super(
      `the ${role} role binds ${JSON.stringify(column)} to reference a person, and not one of the ` +
        `${identifiers} distinct identifiers in ${path} appears in the person export. One of them reads ` +
        `${JSON.stringify(sample)}; the person export's first id is ${JSON.stringify(person_sample)}. ` +
        "Every row in it can be well-formed and still reference nobody, so every event here falls out " +
        "of every cell and the run reports a matched audience that did nothing. A column holding the " +
        "wrong kind of id — a wallet, an order, a row's own primary key where the person's was meant " +
        "— is what this looks like, and it is silent in every other check. Bind the column that " +
        "carries the person, or re-export through the join that resolves it.",
    );
    this.name = "ExportJoinError";
    this.path = path;
    this.role = role;
    this.column = column;
  }
}

/** A person export carrying the same identifier on more than one row. Every copy becomes its own
 *  account in the index, and both the money loop and the conversion loop look each account's id up
 *  once per copy, so one person arrives, pays and commits as many times as the file repeats them.
 *  A file fanned out two ways publishes twice the acquisitions, twice the revenue and twice the
 *  commitments, and an acquisition rate at double the truth — twenty percent published as forty.
 *
 *  It is the inflating direction, and nothing else here can see it. `matched_accounts` above
 *  `matched_phones` is also what a base whose people genuinely hold two accounts looks like, which
 *  the record documents as ordinary; and the narrower shape, one person landing on two phone rows,
 *  does not move `matched_accounts` off `matched_phones` at all. A fan-out as wide as the declared
 *  switchboard ceiling is worse again: every phone reaches the ceiling, the eviction empties the
 *  index, and the run publishes a campaign that reached nobody. */
export class ExportRepeatedPersonError extends Error {
  readonly path: string;
  readonly rows: number;
  readonly identifiers: number;

  constructor(path: string, rows: number, identifiers: number) {
    super(
      `${rows} rows of ${path} carry a person identifier and there are only ${identifiers} distinct ` +
        "ones among them. This export is one row per person, and a repeated identifier is counted " +
        "once per row: that person's arrival, their money and their commitments are added as many " +
        "times as they appear, so every figure this run publishes comes out multiplied and the " +
        "acquisition rate with it. Nothing downstream tells that apart from a base whose people " +
        "really do hold several accounts. The export is missing a `distinct`, or it joins a table " +
        "that fans out — a wallet table above all, since a person holds one per type and currency, " +
        "which is the join the map warns at length about for the money roles. Re-export one row " +
        "per person.",
    );
    this.name = "ExportRepeatedPersonError";
    this.path = path;
    this.rows = rows;
    this.identifiers = identifiers;
  }
}

/** A cell whose declaration cannot be measured as written. */
export class CellDeclarationError extends Error {
  readonly cell: string;

  constructor(cell: string, reason: string) {
    super(`cell ${JSON.stringify(cell)}: ${reason}`);
    this.name = "CellDeclarationError";
    this.cell = cell;
  }
}

/** An exclusion entry that cannot be read as a number in the format the map declares.
 *
 *  This is the one refusal in the pass that guards against overstatement rather than a silent
 *  zero. An entry that yields no key subtracts nobody: the probe or internal handset it names
 *  stays in the population, and everything that account did is counted as the campaign's. One
 *  planted number carrying a single large conversion is enough to move a small cell by two orders
 *  of magnitude, and an inflated reading is the kind that gets published rather than questioned.
 *  A mistyped digit, an extension that pushes the string past a national length, and an empty
 *  string all land here. What does not is a value that yields a well-formed key for somebody
 *  else, since nothing in it distinguishes that from a number this cell could really hold. */
export class CellExclusionError extends Error {
  readonly cell: string;
  readonly entries: readonly string[];

  constructor(cell: string, entries: readonly string[]) {
    const listed = entries.map((entry) => JSON.stringify(entry)).join(", ");
    const count = entries.length === 1 ? "an exclusion" : `${entries.length} exclusions`;
    super(
      `cell ${JSON.stringify(cell)} lists ${count} that cannot be read as a number in the format ` +
        `the map declares: ${listed}. An entry that yields no key subtracts nobody, so the account ` +
        "it names stays in the cell and everything that account did is counted as this campaign's " +
        "— the reading comes out too high rather than empty, which is the failure that survives " +
        "review. Correct the spelling, or drop the entry if the number it meant to remove is not " +
        "one this cell could reach.",
    );
    this.name = "CellExclusionError";
    this.cell = cell;
    this.entries = entries;
  }
}

/** A cell's lists yielded nothing usable, either as read or after its exclusions were subtracted. */
export class EmptyCellError extends Error {
  readonly cell: string;
  /** Which of the two emptinesses this is, for the same reason `UnparseablePhonesError` carries
   *  `source`: one class covers two faults with different remedies, and a caller should not have
   *  to match on the sentence to tell an over-narrow filter from an over-broad `exclude`. */
  readonly after_exclusions: boolean;

  constructor(cell: string, lists: readonly string[], column: string | undefined, after_exclusions: boolean) {
    const where = `${lists.join(", ")}${column === undefined ? "" : ` (column ${JSON.stringify(column)})`}`;
    super(
      after_exclusions
        ? `cell ${JSON.stringify(cell)} has nothing left once its exclusions are subtracted: every ` +
            `identifier read from ${where} is also listed in \`exclude\`. Narrow the exclusions, or point ` +
            "the cell at the list it was meant to measure. A cell that is entirely probes has no members " +
            "to attribute anything to, and emitting it would publish a row of zeros for an audience that " +
            "was never there."
        : `cell ${JSON.stringify(cell)} yielded no usable identifier from ${where}. Check that this is ` +
            "the file that was sent, and that its numbers are written in the format the map declares. An " +
            "empty cell reads as 'nothing converted' when the truth is that the file is the wrong one or " +
            "every number in it was unreadable, so it stops the run rather than emitting a row of zeros.",
    );
    this.name = "EmptyCellError";
    this.cell = cell;
    this.after_exclusions = after_exclusions;
  }
}

/** An `own_base` cell not one of whose listed identifiers answers for an account.
 *
 *  The declaration is the claim. `own_base` says these people already hold accounts, which is why
 *  arrival measures nothing about them and commitment is the outcome instead. Matching none of them
 *  contradicts the claim, and every count on the record then comes back zero — a base that was
 *  listed, reached, and did nothing, which is exactly what an indifferent base looks like. The same
 *  zeros on a `cold` cell are left alone: nobody who had never heard of the brand registered, and
 *  that is the number a cold send exists to produce rather than a fault in how it was measured.
 *
 *  It sits past the cell's own two guards rather than between them, because neither asks this
 *  question. The unreadable-share ceiling asks whether the identifiers could be keyed, and three
 *  well-formed numbers pass it; `EmptyCellError` asks whether the list yielded any keys at all, and
 *  three keys pass that too. Nothing else compares the keys against the index they are matched in.
 *
 *  Three faults land here and the message names all three, because the record cannot separate them:
 *  a list of the wrong people, a `column` holding numbers that are not phones, and a person export
 *  cut narrower than the list — to a window, to a segment, or to a market whose numbers key
 *  differently on the two sides. */
export class UnmatchedBaseError extends Error {
  readonly cell: string;
  readonly listed: number;

  constructor(cell: string, listed: number) {
    super(
      `cell ${JSON.stringify(cell)} is declared own_base, and not one of its ${listed} listed ` +
        "identifiers answers for an account in the lead role. own_base is the claim that these " +
        "people already hold accounts, so nothing matched is not a reading: every count on the " +
        "record comes back zero and publishes as a base that was reached and did nothing. The list " +
        "names people this export does not cover, or the cell's `column` holds numbers that are not " +
        "phones, or the export was cut to a window or a segment narrower than the list. Take one " +
        "listed number and look for it in the export by hand before changing either of them. A cold " +
        "cell matching nobody is measured, because there it is the finding; this one contradicts " +
        "its own declaration.",
    );
    this.name = "UnmatchedBaseError";
    this.cell = cell;
    this.listed = listed;
  }
}

/**
 * A cell whose list is drawn from a different set of markets than the base it is measured against.
 *
 * Every number in such a list can be perfectly valid, so no per-number check sees anything wrong:
 * the parse rate is clean, the keys are well-formed, and the join simply misses. For a cold list
 * that is also what a campaign that did not land looks like, and the two are indistinguishable
 * downstream — which is why this is measured as a distribution rather than caught per row.
 */
export class MarketDivergenceError extends Error {
  readonly cell: string;
  readonly divergence: number;

  constructor(cell: string, divergence: number, ceiling: number) {
    super(
      `cell ${JSON.stringify(cell)} draws from markets that share ` +
        `${((1 - divergence) * 100).toFixed(1)}% of their distribution with the base being measured, ` +
        `and the run refuses below ${((1 - ceiling) * 100).toFixed(1)}%. Every number in the list may ` +
        "be valid; the point is that they are numbers from somewhere else, so the join misses for a " +
        "reason no per-number check can see. On a cold list that reads as a campaign nobody answered. " +
        "Either the wrong file is named here, or this campaign genuinely ran in another market and " +
        "`max_market_divergence` should say so.",
    );
    this.name = "MarketDivergenceError";
    this.cell = cell;
    this.divergence = divergence;
  }
}

/** A control pair that cannot be read, or that reads the wrong outcome for its audience. */
export class ControlError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ControlError";
  }
}

/** Outcomes counted against a cut the declaration itself calls a placeholder. */
export class ProvisionalCutError extends Error {
  readonly cells: readonly { cell: string; counted: readonly { outcome: string; count: number }[] }[];

  constructor(cells: readonly { cell: string; counted: readonly { outcome: string; count: number }[] }[]) {
    const named = cells
      .map(
        (entry) =>
          `${JSON.stringify(entry.cell)} (${entry.counted.map((one) => `${one.outcome} ${one.count}`).join(", ")})`,
      )
      .join("; ");
    super(
      `outcomes counted against a cut that is declared provisional: ${named}. A provisional cut stands ` +
        "in for a send whose real moment is not known yet, so every count above is dated against a guess " +
        "and none of them can be attributed to anything. Put the confirmed send time in `cut` and drop " +
        "`cut_provisional`, or leave the cell out of this reading.",
    );
    this.name = "ProvisionalCutError";
    this.cells = cells;
  }
}

/** A published money total that summed past the range a number here can hold.
 *
 *  Every row that went into it was finite and passed the per-row check; the sum is what left the
 *  range. `JSON.stringify` writes a non-finite number as `null`, and that is the same `null` the
 *  record already uses for a total nobody measured — `EventTotals.value` is `number | null` exactly
 *  so a role the map never bound reads as absent instead of as zero. An overflowed total is
 *  therefore indistinguishable from a documented, legitimate absence, which is the half of this
 *  that misleads in silence. `conversions.value` is the louder half: it is typed a plain `number`,
 *  so the null it publishes is not a value its own type admits.
 *
 *  Two overflows of opposite sign sum to `NaN` rather than to `Infinity` — a group of refunds
 *  against a group of payments, both past the range — and `NaN` publishes as the same `null`. So the
 *  test is for finiteness, and infinity alone would miss it. */
export class OverflowedTotalError extends Error {
  readonly cell: string;
  readonly field: string;

  constructor(cell: string, field: string) {
    super(
      `cell ${JSON.stringify(cell)} summed ${field} past the largest number this engine can hold, so ` +
        "the field would publish as JSON null — the same null the record uses for a total it never " +
        "measured, which reads as a role the map does not bind rather than as arithmetic that came " +
        "apart. Every row behind it is a finite number and each one passed the per-row check, so the " +
        "fault is in the magnitudes rather than in any single value: an amount column exported in a " +
        "unit the map does not assume, or a planted row left in from a test. Sort that export by " +
        "amount and read the top of it.",
    );
    this.name = "OverflowedTotalError";
    this.cell = cell;
    this.field = field;
  }
}

type Account = { id: string; created: Date | null };
type MoneyEvent = { at: Date | null; amount: number };
/** `committed` and `recycled` are answers, not statuses. Which values of a product's own
 *  lifecycle count as a commitment, and which mean value was recycled rather than new, are
 *  properties of that product; the source answers them and the engine only counts them. `recycled`
 *  is absent where the source does not answer it, which says the product has no such distinction
 *  rather than that it measured zero. */
type ConversionEvent = MoneyEvent & { committed: boolean; recycled?: boolean };

/** Share of a corpus's distinct identifiers allowed to be unreadable before a run stops. A
 *  misconfigured plan and a genuinely unmatched list both produce zero matches, and only one of
 *  them is a result. Five percent was this project's declared tolerance and is kept as the
 *  engine's default now that no map declares one. */
const MAX_UNPARSEABLE_RATE = 0.05;

/** A phone answering for this many accounts is a switchboard, not a person, and is dropped from
 *  the index — otherwise every list containing it inherits all of them. */
const SHARED_ACCOUNT_CEILING = 4;

/** How far a cell's markets may diverge from the lead index's before the run refuses the cell. */
const MAX_MARKET_DIVERGENCE = 0.5;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Days in each month of a common year, indexed by month number minus one. February's other
 *  answer is the leap rule in `rolls_forward_to`; every other month has one length forever. */
const COMMON_YEAR_MONTH_DAYS: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** The civil date a declared cut opens with. A month outside 01–12 or a day outside 01–31 never
 *  reaches this — the parser refuses those outright — so what arrives here is a real-looking date
 *  that may still name a day its own month does not have. */
const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * The date the runtime would measure from, where that is not the date the cut names. Null for
 * every real day, which is every cut but a mistyped one.
 *
 * Only the `YYYY-MM-DD` a person typed is read, never the instant it parsed to. Taking the date
 * back off the instant would refuse correct cuts: `2030-03-01T00:00:00+05:30` is 28 February in
 * UTC, and a check comparing UTC fields against the typed ones would call that a rollover and stop
 * a reading that is exactly right.
 *
 * Only a month shorter than thirty-one days can overflow, so the roll lands at most three days
 * into the next month of the same year and needs no calendar arithmetic beyond a subtraction.
 */
function rolls_forward_to(declared: string): string | null {
  const match = CIVIL_DATE.exec(declared.trim());
  if (match === null) {
    return null;
  }
  const year = Number(match[1] as string);
  const month = Number(match[2] as string);
  const day = Number(match[3] as string);
  // Divisible by four, except a century not also divisible by four hundred. Both exceptions reach
  // a cut: `2100-02-29` is not a date and `2000-02-29` is, and a rule written as `year % 4` alone
  // waves the first one through to be measured from 1 March.
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const length = month === 2 && leap ? 29 : (COMMON_YEAR_MONTH_DAYS[month - 1] as number);
  if (day <= length) {
    return null;
  }
  return `${match[1] as string}-${String(month + 1).padStart(2, "0")}-${String(day - length).padStart(2, "0")}`;
}

/** A blank is refused rather than read as zero, and the caller hands the row's value through the
 *  same `?? ""` every other bound column uses: a record built by `read_rows` carries every header
 *  column, so a missing one and an empty one are the same string here and there is no third case
 *  to distinguish. */
function amount_of(raw: string, role: string, column: string): number {
  if (raw.trim() === "") {
    throw new ExportValueError(role, column, raw);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new ExportValueError(role, column, raw);
  }
  return value;
}

/** Round a money total to the cent, having first refused one that has stopped being a number.
 *
 *  The per-row check above bounds each value; nothing bounds their sum, and `round_half_even` passes
 *  a non-finite input straight through by design. Every total the record publishes goes through
 *  here, because the field would otherwise serialise as `null` and read as a role nobody measured.
 *  `field` is the record's own dotted path, so the sentence names the number the reader is looking
 *  at rather than the role it came from. */
function published_total(total: number, cell: string, field: string): number {
  if (!Number.isFinite(total)) {
    throw new OverflowedTotalError(cell, field);
  }
  return round_half_even(total, 2);
}

/**
 * Read a role's export, having first checked that every column the map binds for it is in the
 * header exactly once.
 *
 * The check is here because the two ways a binding can be wrong fail differently. A missing amount
 * column throws on the first row, because what it reads is not a number. A missing timestamp column
 * throws nothing at all: the read is `undefined`, the parse is null, the accumulator skips the
 * event, and a file of real events reports as none. Asserting the header once, before any row is
 * indexed, makes the silent half as loud as the other.
 *
 * A bound name the header carries twice is the same fault wearing the other face: the column is
 * present, so the check above passes, and the record holds only the second of the two. It is
 * asserted per bound column rather than over the whole header, so a `note` column the export
 * happens to carry twice — bound by nothing, read by nobody — does not refuse a file this run
 * would have measured correctly.
 */
/**
 * A predicate column, read strictly.
 *
 * The boundary carries strings, so a boolean arrives as `true` or `false`. Anything else is a
 * fault rather than a falsy value: a source that answers `1`, `t`, `yes` or an empty cell has not
 * answered the question, and reading that as `false` would silently drop every row it applies to —
 * which for `committed` means reporting a campaign nobody committed to.
 */
function read_flag(row: Record<string, string>, column: string, role: string): boolean {
  const raw = row[column] ?? "";
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  throw new ExportFlagError(role, column, raw);
}

async function read_role(
  source: Source,
  role: RoleName,
  bound: readonly string[],
): Promise<Record<string, string>[] | null> {
  const { header, records } = await source.rows(role);
  // Neither a header nor a row is how a source says it does not carry this role at all, and that
  // is a different fact from a role that carries nothing: a product with no withdrawals reports a
  // churn of zero, a product with no concept of churn should not report a figure for it. Every
  // other emptiness — a header with no rows under it — is a measured zero and reads on below.
  if (header.length === 0 && records.length === 0) {
    return null;
  }
  const present = new Set(header);
  const read_by = `The ${role} role reads it`;
  for (const column of bound) {
    if (!present.has(column)) {
      throw new ExportColumnError(role, role, column, header);
    }
    assert_unshadowed(role, header, column, read_by);
  }
  return records;
}

/**
 * Refuse a role whose rows reference nobody in the person export.
 *
 * Every other check on a role's export asks whether it is well-formed, and a file joining on the
 * wrong kind of identifier can pass every one of them: the columns are bound, the timestamps parse,
 * the amounts are numbers. It then contributes nothing to any cell, because `accumulate` looks each
 * account's id up in this index and misses every time — a thousand matched accounts and no
 * revenue, no churn, no conversions, and not a word about why.
 *
 * One shared key is enough to pass. This is not a coverage check and must not become one: a role
 * exported over a narrower window than the person export legitimately references a fraction of it,
 * and a threshold on that fraction would refuse quiet months. Zero is the fault, because zero is
 * the only overlap that cannot happen while both files describe the same people.
 *
 * It runs before the blank-column and status checks in both index functions, and the order is the
 * whole point of it. Those two describe a surface of the file, this one describes whether the file
 * is the right file at all. A role bound to the wrong export usually carries an incidental fault as
 * well — an orders extract has its own lifecycle in the status column and often no timestamp the
 * map's name reaches — and reported as that fault it sends the reader to widen `valid_statuses` or
 * re-export a column, neither of which can work, before the join error they needed first. The
 * three checks all run after the indexing loop and share no state, so the order costs nothing:
 * a right file with drifted statuses joins, passes here, and reports exactly as it did.
 *
 * The person side is every id in the person export, including accounts whose phone was unreadable
 * and switchboards evicted from the index. They are still people this role can reference, and
 * measuring the overlap against the surviving subset would turn a phone-format problem into a
 * join error and send the reader to the wrong file.
 *
 * The empty string is not an identifier and is skipped on both sides. A blank person column is
 * what a left join that matched nothing leaves behind, and it reads as `""` here exactly as a
 * blank id column does — so one blank row on each side used to satisfy this check on a key that
 * names nobody, and the real rows beside it could then reference no one at all in silence, which
 * is the whole of what this error exists to catch. Skipped at the comparison rather than dropped
 * when either index is built: a role whose person column is blank on every row keeps its bucket
 * and is still refused for referencing nobody, where an index built without blanks would come
 * back empty and be read two lines below as "no rows, nothing to say". The count in the message
 * stays the number of distinct values in the column, blanks included, because that is what the
 * reader will find in the file; the quoted sample skips them, because a blank tells them nothing
 * about which kind of id was bound by mistake.
 */
function assert_joins(
  index: ReadonlyMap<string, unknown>,
  lead_ids: ReadonlySet<string>,
  path: string,
  role: string,
  column: string,
): void {
  // PRECONDITION, and the rule every reader of the lead role owes an answer to: **say what you do
  // when it has no rows.** An empty lead role is now refused outright, in `measure`, before the
  // market is inferred — the earlier judgment measured it, and produced three defects from guards
  // that were each correct in isolation and silent about this case. This one still returns rather
  // than throwing, because it can be reached with a non-empty base whose ids simply do not overlap,
  // and a join against nobody is unprovable rather than wrong: with no
  // ids on the other side, a key that would never have matched is indistinguishable from one that
  // simply has nothing to match yet. Whoever writes the next check here answers the same question
  // in their own comment, or becomes the fourth.
  if (index.size === 0 || lead_ids.size === 0) {
    return;
  }
  let sample = "";
  for (const id of index.keys()) {
    if (id === "") {
      continue;
    }
    if (lead_ids.has(id)) {
      return;
    }
    if (sample === "") {
      sample = id;
    }
  }
  let person_sample = "";
  for (const id of lead_ids) {
    if (id !== "") {
      person_sample = id;
      break;
    }
  }
  throw new ExportJoinError(path, role, column, sample, person_sample, index.size);
}

/**
 * Group a money-carrying role's rows under the person they reference.
 *
 * The header check in `read_export` proves the bound timestamp column exists; the count below
 * proves it holds something. A column that is present and blank on every row is what a rename at
 * the source usually leaves behind, and it produces the same silent nothing an absent column
 * would: every event parses to a null instant, the accumulator skips all of them, and a file of
 * real money reports as none. The bound amount needs no such count, because `amount_of` already
 * refuses a blank on the first row it meets.
 */
async function money_index(
  source: Source,
  role: "revenue" | "churn",
  lead_ids: ReadonlySet<string>,
): Promise<Map<string, MoneyEvent[]> | null> {
  const rows = await read_role(source, role, ["lead", "at", "amount"]);
  if (rows === null) {
    return null;
  }

  const index = new Map<string, MoneyEvent[]>();
  let dated = 0;
  for (const row of rows) {
    const id = row.lead ?? "";
    const event: MoneyEvent = { at: parse_ts(row.at), amount: amount_of(row.amount ?? "", role, "amount") };
    if (event.at !== null) {
      dated += 1;
    }
    const bucket = index.get(id);
    if (bucket === undefined) {
      index.set(id, [event]);
    } else {
      bucket.push(event);
    }
  }
  // First, because it is the only check here that can say the export is the wrong file. A wallet
  // extract bound to the revenue role often has no column the map's timestamp name reaches either,
  // and reported as a blank timestamp it sends the reader to re-export a column in a file that was
  // never this role's.
  assert_joins(index, lead_ids, role, role, "lead");
  // An export with no rows is a fact — a role that saw no activity in the window someone queried.
  // An export with rows and no times in any of them is a fault, and the two must not be confused.
  if (rows.length > 0 && dated === 0) {
    throw new ExportBlankColumnError(role, role, ["at"], rows.length, "timestamp");
  }
  return index;
}

async function conversion_index(
  source: Source,
  lead_ids: ReadonlySet<string>,
): Promise<Map<string, ConversionEvent[]>> {
  // Two optional columns, discovered from what the source answered rather than declared anywhere:
  // a fallback timestamp for rows whose primary one is blank, and the recycled predicate. Absent
  // means the product has no such concept, which is a different fact from measuring zero.
  const { header } = await source.rows("conversion");
  const present = new Set(header);
  const at_fallback = present.has("at_fallback");
  const has_recycled = present.has("recycled");
  const rows = await read_role(source, "conversion", ["lead", "at", "amount", "committed"]);
  if (rows === null) {
    throw new SourceError(
      "conversion",
      "the conversion role answered with nothing at all - no header and no rows. Revenue and " +
        "churn may be absent, because a product can genuinely have no such concept, but a " +
        "campaign with no conversions to read is not a measurement with a zero in it.",
    );
  }

  const index = new Map<string, ConversionEvent[]>();
  // The committed filter runs per cell, against the cut, so a source whose predicate never fires
  // is invisible there: the events are simply skipped one by one. Counted once here, over the
  // whole role, the difference between "nobody committed in this window" and "this predicate
  // matches nothing at all" becomes a fact the run can refuse on.
  let committed = 0;
  let dated = 0;
  for (const row of rows) {
    // The primary timestamp is nullable on this role, so the map may name a second column to
    // stand in. Empty, not absent, is what an unset timestamp looks like in an export.
    const primary = row.at ?? "";
    const when = primary !== "" || !at_fallback ? primary : (row.at_fallback ?? "");
    const event: ConversionEvent = {
      at: parse_ts(when),
      amount: amount_of(row.amount ?? "", "conversion", "amount"),
      committed: read_flag(row, "committed", "conversion"),
    };
    if (event.at !== null) {
      dated += 1;
    }
    if (event.committed) {
      committed += 1;
    }
    // Absent where the source answers no `recycled` column, so a product with no recycled balance
    // carries no half-read field that later reads as "not recycled".
    if (has_recycled) {
      event.recycled = read_flag(row, "recycled", "conversion");
    }
    const id = row.lead ?? "";
    const bucket = index.get(id);
    if (bucket === undefined) {
      index.set(id, [event]);
    } else {
      bucket.push(event);
    }
  }
  // First, for the reason written over `assert_joins`. An orders extract bound to this role keeps
  // its own lifecycle in whatever it calls a status, so it fails the committed check too — and
  // that message cannot fix a file describing different things than the role wanted.
  assert_joins(index, lead_ids, "conversion", "conversion", "lead");
  // Both timestamp columns are named where a fallback was answered: reporting only the primary
  // would send the reader to correct a column the source was already prepared to do without.
  if (rows.length > 0 && dated === 0) {
    throw new ExportBlankColumnError(
      "conversion",
      "conversion",
      at_fallback ? ["at", "at_fallback"] : ["at"],
      rows.length,
      "timestamp",
    );
  }
  if (rows.length > 0 && committed === 0) {
    throw new ExportStatusError(rows.length);
  }
  return index;
}

/**
 * Sum one role over one group, from the cut forward.
 *
 * Each person is counted once however many events they generated, and their events are summed into
 * a subtotal before that subtotal joins the running total — the same association the reference
 * implementation uses, which matters because floating-point addition is not associative and a
 * different grouping would move the last cent of a published figure.
 */
function accumulate(
  group: Account[],
  index: Map<string, MoneyEvent[]>,
  cut_ms: number,
): { leads: number; value: number; lags: number[]; per_person: number[] } {
  let leads = 0;
  let value = 0;
  const lags: number[] = [];
  const per_person: number[] = [];

  for (const account of group) {
    // An account whose id is blank joins nothing, by the same rule `assert_joins` applies. The
    // bucket a blank keys holds every row whose person column was empty — money that belongs to
    // nobody — and looking it up here would credit all of it to whichever listed person happens
    // to carry the blank. The account stays in the audience it was matched into: its phone was
    // read and it is a person this cell reached, and only its join key is missing.
    if (account.id === "") {
      continue;
    }
    const events = index.get(account.id);
    if (events === undefined) {
      continue;
    }
    let subtotal = 0;
    let counted = 0;
    let earliest = Number.POSITIVE_INFINITY;
    for (const event of events) {
      if (event.at === null) {
        continue;
      }
      const at = event.at.getTime();
      if (at < cut_ms) {
        continue;
      }
      counted++;
      subtotal += event.amount;
      if (at < earliest) {
        earliest = at;
      }
    }
    if (counted === 0) {
      continue;
    }
    leads++;
    value += subtotal;
    per_person.push(subtotal);
    lags.push((earliest - cut_ms) / DAY_MS);
  }
  return { leads, value, lags, per_person };
}

/**
 * Share of a group's total held by its two largest contributors. Null where the question is
 * meaningless: nothing collected, fewer than two contributors to compare, or a total that is not
 * a whole made of parts.
 *
 * An average over a group where two people account for most of the money describes nobody in it,
 * and the concentration is invisible until someone goes looking. This puts it beside the total.
 *
 * That last condition is the one worth stating. A share is a part over a whole, and it only reads
 * as one while every part is non-negative — a person whose events net out below zero, a refund or
 * a reversal larger than what they paid, shrinks the denominator without shrinking the two
 * numerators, and the arithmetic then returns something above 1 or below 0. Read as a percentage
 * it says the top two hold four hundred percent of the money, which is not a fact about
 * concentration at all; it is the ratio complaining that this group has no whole to take a share
 * of. Null says exactly that, and it is the same null the two other meaningless cases already
 * return, sitting in a field the reader can see beside a `value` that is very much not null.
 *
 * Not refused, because a negative contribution is data rather than a fault: a reversal is a real
 * thing that happens to a real account, and `value` still totals it correctly. Only the share is
 * undefined, so only the share goes null.
 */
function top2_share(per_person: number[], total: number): number | null {
  if (total <= 0 || per_person.length < 2) {
    return null;
  }
  for (const one of per_person) {
    if (one < 0) {
      return null;
    }
  }
  const ranked = [...per_person].sort((a, b) => b - a);
  return round_half_even(((ranked[0] as number) + (ranked[1] as number)) / total, 2);
}

/** Walk a dotted path into a record and return the number at the end of it, if there is one. */
function resolve_outcome(record: CellRecord, path: string): number | undefined {
  let node: unknown = record;
  for (const step of path.split(".")) {
    if (node === null || typeof node !== "object") {
      return undefined;
    }
    node = (node as Record<string, unknown>)[step];
  }
  return typeof node === "number" ? node : undefined;
}

/**
 * Which outcomes a control pair may be read on, by the audience it was read against.
 *
 * Two rules used to live here as two lists, and they contradicted each other. One admitted seven
 * paths; the other confined a `cold` cell to `acquired.*` and an `own_base` cell to
 * `conversions.*`, which made the three `pre_existing.*` paths unreachable for every audience —
 * admitted by the allowlist and then refused by the audience check, two errors for one mistake
 * and the second contradicting the first. They were dropped rather than admitted, because there
 * is no reading they enable: `pre_existing` counts people who were already there before the cut,
 * so it is the same population in both arms of any pair and a difference in it is a difference in
 * how the two lists were drawn, not an effect of anything that was sent. This table is the only
 * statement of the rule, and `measure` reads nothing else: the union below is derived from it for
 * callers, and checking against the union first only ever repeated this check or contradicted it.
 *
 * Why the shape of each entry. A cold list has no counterfactual: nobody who has never heard of
 * the brand arrives unprompted, so arrival is the effect. A list of people who already hold
 * accounts cannot arrive at all, so arrival there measures nothing and commitment is the effect.
 * Reading a pair on the wrong one gives zero against zero, which is not a null result — it is a
 * question that was never asked.
 *
 * Why every entry is a count. The two-proportion test behind `publishable` compares successes
 * against a denominator of listed identifiers. Hand it a sum of money and it still returns a
 * number: a p-value on "currency per person listed", which is not a proportion of anything and
 * cannot be below or above a significance threshold in any meaningful way. The reading would
 * carry `publishable: true` and mean nothing.
 */
const COUNTABLE_BY_AUDIENCE: Record<Cell["audience"], readonly string[]> = {
  cold: ["acquired.accounts", "acquired.revenue.leads", "acquired.churn.leads"],
  own_base: ["conversions.count"],
};

/** Every path some audience can be read on: the union of the table above, derived so it can never
 *  admit a path no audience will read. Exported for a caller validating a declaration before it
 *  measures. `measure` does not consult it — a check against the union can only refuse what the
 *  per-audience check is about to refuse anyway, and refusing one mistake twice sent the reader a
 *  first message naming four paths and a second one taking three of them back. */
export const COUNTABLE_OUTCOMES: readonly string[] = [...new Set(Object.values(COUNTABLE_BY_AUDIENCE).flat())];

/**
 * The counts a provisional cut makes meaningless.
 *
 * Every one of them is accumulated forward from the cut, so a cut that is a guess dates all of
 * them against a guess. `acquired.accounts` is the obvious one and was for a while the only one
 * checked, which left the guard blind to exactly the case that matters: an `own_base` cell is by
 * construction one whose matched accounts all predate the cut, so its arrivals are always zero
 * and the guard could never fire on it — while `conversions.count`, the one outcome such a cell
 * is ever read on, was accumulated from the same guess and published.
 *
 * The revenue and churn counts are here for the same reason and not merely for symmetry. The two
 * on the `acquired` branch are subsets of `acquired.accounts` and so can only add detail to the
 * message, but the two on the `pre_existing` branch are not: they count people who were already
 * there and then paid or left *after* the cut, which is a number a guessed cut moves and nothing
 * else here would catch.
 *
 * `pre_existing.accounts` is deliberately absent. It is a partition of the audience rather than
 * an outcome — nothing was attributed to it — and it is non-zero for essentially every `own_base`
 * cell, so including it would refuse every provisional cut ever declared on one and destroy the
 * quiet case the flag exists to allow. Money sums are absent too, because a non-zero sum always
 * carries a non-zero count and the counts already detect it.
 *
 * Not derived from `COUNTABLE_OUTCOMES`: that list answers which paths a proportion test can
 * read, this one answers which paths the cut dates, and the two questions only look alike.
 */
const ACCUMULATED_FROM_CUT: readonly string[] = [
  "acquired.accounts",
  "acquired.revenue.leads",
  "acquired.churn.leads",
  "conversions.count",
  "pre_existing.revenue.leads",
  "pre_existing.churn.leads",
];

export async function measure(opts: MeasureOptions): Promise<CellRecord[]> {
  // Both of these are faults in the argument the caller just typed, and both are refused before a
  // single export is opened. Two cells sharing a name make every control naming it ambiguous, and
  // the join would silently pick one. Two controls on one treated cell both write `record.control`,
  // and the last one wins with nothing said about the first.
  const declared = new Set<string>();
  for (const cell of opts.cells) {
    if (declared.has(cell.name)) {
      throw new CellDeclarationError(
        cell.name,
        "two cells are declared under this name. A control joins on the name, so a duplicate makes " +
          "the pair ambiguous and the reading would attach to whichever was measured last. Rename one " +
          "of them, or merge their lists into a single cell",
      );
    }
    declared.add(cell.name);
  }
  const treated_once = new Set<string>();
  for (const control of opts.controls ?? []) {
    if (treated_once.has(control.treated)) {
      throw new ControlError(
        `${JSON.stringify(control.treated)} is named as the treated cell of more than one pair. A cell ` +
          "carries one control reading, so the second pair would overwrite the first without a word. " +
          "Keep the comparison this cell is meant to publish and drop the rest.",
      );
    }
    treated_once.add(control.treated);
  }

  const now = opts.now ?? new Date();
  const measured_utc = now.toISOString();
  const now_ms = now.getTime();

  // Columns are the contract's names, not the database's: a query aliases to them and a CSV
  // header spells them, so nothing here has to be looked up in a map.
  const lead_rows = await read_role(opts.source, "lead", ["id", "phone", "created_at"]);
  if (lead_rows === null) {
    throw new SourceError(
      "lead",
      "the lead role answered with nothing at all - no header and no rows. It is the index every " +
        "other role joins against, so without it there is nobody for a cell to be about.",
    );
  }

  // The market a bare national number belongs to, read off the base rather than declared. A
  // campaign may carry leads from any country, so naming one of them would name the wrong thing;
  // and only numbers already carrying a calling code get a vote, so the answer is not circular.
  // Before the market, because an entirely empty phone column would otherwise arrive at
  // `dominant_market` as a corpus nothing can be inferred from, and be reported as an ambiguous
  // market rather than as the missing column it is. Every cell would match nobody either way; only
  // one of the two sentences sends the reader to the right place.
  // Before the market for the same reason as the blank column below: with no rows there is no
  // corpus to infer from, and the run would surface as an ambiguous market rather than as an empty
  // base. Every figure this engine publishes is about people in that base, so with nobody in it
  // every number is zero by construction - the engine's own "zero against zero, a question that was
  // never asked". This reverses an earlier judgment that measured the empty case; it was reversed
  // because the reading it produced could not be told apart from a campaign that reached nobody.
  if (lead_rows.length === 0) {
    throw new SourceError(
      "lead",
      "the lead role answered a header and no rows. There is nobody in the base to measure, so " +
        "every count would come back zero by construction and read as a campaign that reached " +
        "nobody. Either the query is filtered to nothing, or the export was cut to an empty window.",
    );
  }
  if (lead_rows.every((row) => (row.phone ?? "").trim() === "")) {
    throw new ExportBlankColumnError("lead", "lead", ["phone"], lead_rows.length, "phone number");
  }
  const fallback = dominant_market(lead_rows.map((row) => row.phone));
  const place_key = (raw: unknown): string | null => place(raw, fallback)?.key ?? null;
  // What the base looks like by market, counted once. A cell's list is compared against this
  // rather than against a declared country, so a project that genuinely spans markets carries its
  // own shape and a single-market project gets a tight guard for free.
  const base_markets = new Map<CountryCode, number>();
  const place_market = (raw: unknown): CountryCode | null => place(raw, fallback)?.country ?? null;
  for (const row of lead_rows) {
    const country = place_market(row.phone);
    if (country !== null) {
      base_markets.set(country, (base_markets.get(country) ?? 0) + 1);
    }
  }

  const by_key = new Map<string, Account[]>();
  // Every id in the file, whether or not its phone was readable and whether or not its key
  // survives the switchboard eviction below. It is what the other roles are asked to join
  // against, and that question is about the id column, not about the dialling plan.
  const lead_ids = new Set<string>();
  // Rows that carried an id, against the distinct spellings among them. One row per person is what
  // the id column being a primary key means, and the check below costs nothing here because both
  // quantities are already being built.
  let identified = 0;
  // Distinct spellings, not rows, so both sides of the rate below count the same kind of thing.
  // One sentinel repeated down a column is a single unknown, and it can hide at most one person.
  const unknowns = new Set<string>();
  let dated = 0;
  for (const row of lead_rows) {
    const id = row.id ?? "";
    lead_ids.add(id);
    if (id !== "") {
      identified += 1;
    }
    // Parsed before the phone is looked at, so the count below describes the file rather than the
    // subset of it this market's dialling plan happened to understand.
    const created = parse_ts(row.created_at);
    if (created !== null) {
      dated += 1;
    }
    // The same distinction the cell lists are read with, for the same reason. This role's export
    // writes `coalesce(u.phone, '')`, so an account with no number recorded arrives as an empty
    // cell — an absent identifier, not one the dialling plan failed on. Counting it here would
    // charge the plan for a person who never gave a number, and it would do so at a rate that
    // grows with the account base: the ceiling is spent on absences until a genuine format fault
    // has almost no room left below it.
    const written = (row.phone ?? "").trim();
    if (written === "") {
      continue;
    }
    const key = place_key(written);
    if (key === null) {
      unknowns.add(written);
      continue;
    }
    const account: Account = { id, created };
    const bucket = by_key.get(key);
    if (bucket === undefined) {
      by_key.set(key, [account]);
    } else {
      bucket.push(account);
    }
  }
  // Before the two checks below, which describe the index this file builds and which a fanned-out
  // file has already inflated: a fan-out as wide as the switchboard ceiling puts every phone at it,
  // the eviction empties the index, and the run then publishes a campaign that reached nobody with
  // nothing said about why. Blanks count on neither side — a blank id is a left join that matched
  // nothing, already handled as a person who collects nothing, and a column of them read as one id
  // repeated would refuse a file that measures correctly.
  const distinct_ids = lead_ids.has("") ? lead_ids.size - 1 : lead_ids.size;
  if (identified > distinct_ids) {
    throw new ExportRepeatedPersonError("lead", identified, distinct_ids);
  }

  if (lead_rows.length > 0) {
    // Divided by the index this protects rather than by the file, so the reading survives an
    // export where one number answers for several accounts. Each distinct unknown could have added
    // at most one more key, so the sum is the largest index the file could have produced.
    const possible = by_key.size + unknowns.size;
    if (possible > 0) {
      const rate = unknowns.size / possible;
      if (rate > MAX_UNPARSEABLE_RATE) {
        throw new UnparseablePhonesError(unknowns.size, possible, rate, MAX_UNPARSEABLE_RATE);
      }
    }
    // Checked after the phone rate, because an export whose numbers are unreadable is the larger
    // fault and the one whose message the reader wants first. An account with no creation time is
    // legal on its own — it falls in neither group rather than the flattering one — but a file
    // where every account is undated places nobody, and the run then reports an audience that
    // arrived at nothing and was already there for nothing.
    if (dated === 0) {
      throw new ExportBlankColumnError("lead", "lead", ["created_at"], lead_rows.length, "timestamp");
    }
  }

  // A number answering for this many accounts is a switchboard, a placeholder or a support desk,
  // not a person. Left in the index, every list containing it inherits all of them.
  for (const [key, accounts] of by_key) {
    if (accounts.length >= SHARED_ACCOUNT_CEILING) {
      by_key.delete(key);
    }
  }

  const revenue = await money_index(opts.source, "revenue", lead_ids);
  const churn = await money_index(opts.source, "churn", lead_ids);
  const conversions = await conversion_index(opts.source, lead_ids);
  // Whether this product distinguishes recycled value at all, read off what the source answered
  // rather than declared anywhere. No `recycled` column means no such concept, which the record
  // reports by omitting the pair rather than by publishing two zeros.
  const splits_value = [...conversions.values()].some((events) => events.some((event) => event.recycled !== undefined));

  const measured: { cell: Cell; record: CellRecord; keys: ReadonlySet<string> }[] = [];

  for (const cell of opts.cells) {
    // The cut is the one instant the truncation in `parse_ts` is not provably harmless for: every
    // event is compared against it, and the argument that no event can change side holds only
    // while the cut itself sits on a whole millisecond. A cut is typed by a person, once, so
    // refusing an unhonourable one costs nothing and closes the only case that could disagree.
    //
    // A cut nobody can read is caught here rather than left to rise as the parser wrote it. That
    // error names the text and nothing else, and the four refusals below it all name the cell — so
    // a run measuring several cells answered `not a readable timestamp: "03/02/2030 09:00"` and
    // left the reader grepping the declaration for whichever cell was carrying that string.
    let reading: TimestampReading;
    try {
      reading = parse_ts_with_precision(cell.cut);
    } catch (error) {
      if (!(error instanceof TimestampError)) {
        throw error;
      }
      throw new CellDeclarationError(
        cell.name,
        `its cut ${JSON.stringify(cell.cut)} cannot be read as a moment, so there is nothing to ` +
          "measure from and nothing to place an event either side of. A cut is an ISO instant — " +
          `${JSON.stringify("2030-01-01T00:00:00Z")}, or the same with a space instead of the T and ` +
          "no zone, which is read as UTC. Correct it to the moment the send went out",
      );
    }
    const { at: cut, sub_millisecond } = reading;
    if (cut === null) {
      throw new CellDeclarationError(cell.name, "its cut is blank, so there is no moment to measure from");
    }
    if (sub_millisecond) {
      throw new CellDeclarationError(
        cell.name,
        `its cut ${JSON.stringify(cell.cut)} is declared finer than a millisecond, and this engine's instant resolves to the millisecond, so that cut cannot be honoured exactly — declare it to the millisecond or coarser`,
      );
    }
    // Refused before the instant is taken, because the fault is in the string and not in where it
    // landed. `new Date` answers an impossible day by counting past the end of the month instead
    // of refusing it, so `2030-02-30` measures from 2 March. Every cut on disk is transcribed by
    // hand off a delivery report, where `2026-04-31`, `2026-06-31` and `2026-02-30` are ordinary
    // slips, and the shift runs whichever way the typo points — it can credit the campaign as
    // easily as rob it. Left alone the record publishes the day that was typed while the counts
    // behind it were taken from a different one, and nothing in the record says so.
    const rolled = rolls_forward_to(cell.cut);
    if (rolled !== null) {
      throw new CellDeclarationError(
        cell.name,
        `its cut ${JSON.stringify(cell.cut)} names a day that month does not have, and the runtime ` +
          `counts past the end of the month rather than refusing it, so the reading would be taken ` +
          `from ${rolled}. The record would still publish ${JSON.stringify(cell.cut)} as its cut — a ` +
          "date that never existed and was never measured from — while every account and event " +
          "arriving in between fell on the wrong side of the comparison. Correct the cut to the day " +
          "the send actually went out",
      );
    }
    const cut_ms = cut.getTime();
    // A cut later than the reading is not a small error. The window comes out negative, every
    // comparison against the cut excludes everything, and the record reads as a campaign that
    // reached people and produced nothing — the same zeros a real failure produces. A planning
    // date left in place after the send slipped is exactly how it happens.
    if (cut_ms > now_ms) {
      throw new CellDeclarationError(
        cell.name,
        `its cut ${JSON.stringify(cell.cut)} is later than the moment this reading was taken ` +
          `(${measured_utc}), so the window it measures is negative and nothing can fall inside it. ` +
          "Every count would come back zero and read as a campaign nobody responded to. Correct the " +
          "cut to the real moment of contact, or wait until it has passed and measure then",
      );
    }

    const keys = new Set<string>();
    // Distinct spellings, not rows, for the same reason `keys` is a set: both sides of this
    // fraction have to count the same kind of thing. Twenty rows reading `SEM TELEFONE` are one
    // unknown repeated, and can hide at most one person between them; twenty different junk
    // strings can hide twenty. Counting rows scores those two identically and lets a file's
    // duplication decide the verdict — most sharply when a cell names the same list twice, which
    // deduplicates on the readable side and accumulated on the other, so repeating a filename
    // changed a cell's audience.
    const unknowns = new Set<string>();
    const list_markets: CountryCode[] = [];
    for (const list of cell.lists) {
      if (!(await Bun.file(list).exists())) {
        throw new MissingExportError(list, `cell ${JSON.stringify(cell.name)}`);
      }
      for (const raw of await read_identifiers(list, cell.column, cell.filter)) {
        // A row carrying nothing in its identifier column is not a member this cell failed to
        // read; it is a row of somebody's export that was never part of the dispatch. A CRM dump
        // is mostly such rows, and the count the campaign publishes has always been the phones it
        // held rather than the lines it ran to. Counting them as unreadable would refuse a
        // correct reading, which is the opposite of the fault this guard exists for. A `.txt`
        // list already drops blank lines, so this also stops the same identifiers passing or
        // failing on nothing but the file's extension.
        const written = raw.trim();
        if (written === "") {
          continue;
        }
        const placed = place(written, fallback);
        if (placed === null) {
          unknowns.add(written);
          continue;
        }
        keys.add(placed.key);
        list_markets.push(placed.country);
      }
    }
    // The same ceiling the person export is held to, for the same reason and with the opposite
    // sign. An entry nobody can key never matches an account, so it can never reach a numerator —
    // dropping it quietly shrinks `listed`, which is the denominator under every rate this cell
    // publishes and under both arms of its comparison. A file of junk therefore reads as a small
    // audience that converted brilliantly, and two lists carrying different amounts of junk make a
    // comparison whose difference is the junk. The person export is rate-checked a few dozen lines
    // above; leaving the lists unchecked guarded the side that empties and left the side that
    // inflates open, and of the two it is the inflated reading that gets published.
    //
    // The denominator is what `listed` could have been, not how many rows were read. Each distinct
    // unknown could have contributed at most one key, so the sum is the largest audience this cell
    // could have had, and the share lost is the distortion of the one number the guard protects.
    // Dividing by rows instead would understate it wherever readable entries repeat: a list of
    // eighty rows resolving to twenty people reads as five percent junk while a fifth of its
    // audience is missing.
    //
    // Checked before the empty cell below, so a list of nothing but junk is refused for being junk
    // rather than for being empty. The two faults read alike and are fixed in different files —
    // one sends the reader to the map's dialling plan, the other to a wrong column or an
    // over-narrow filter — and this order is also what leaves `possible` provably non-zero.
    const possible = keys.size + unknowns.size;
    if (possible > 0) {
      const rate = unknowns.size / possible;
      if (rate > MAX_UNPARSEABLE_RATE) {
        throw new UnparseablePhonesError(
          unknowns.size,
          possible,
          rate,
          MAX_UNPARSEABLE_RATE,
          `cell ${JSON.stringify(cell.name)}`,
        );
      }
    }
    if (keys.size === 0) {
      throw new EmptyCellError(cell.name, cell.lists, cell.column, false);
    }

    // Probes and internal numbers are subtracted after that first check so the two ways a cell can
    // come out empty are reported apart: a file that yielded nothing is a different fix from a file
    // whose every entry was excluded. Both are refused, because a cell with no members left reads
    // downstream as an audience that converted nothing.
    //
    // An entry that yields no key is refused ahead of both. Dropped in silence it subtracts nobody
    // and the number it named stays in the cell, so this fault inflates where every other one
    // empties — and of the two, the inflated reading is the one that gets published.
    const unusable: string[] = [];
    for (const raw of cell.exclude ?? []) {
      const key = place_key(raw);
      if (key === null) {
        unusable.push(raw);
        continue;
      }
      keys.delete(key);
    }
    if (unusable.length > 0) {
      throw new CellExclusionError(cell.name, unusable);
    }
    if (keys.size === 0) {
      throw new EmptyCellError(cell.name, cell.lists, cell.column, true);
    }

    const matched_keys: string[] = [];
    const matched_accounts: Account[] = [];
    for (const key of keys) {
      const accounts = by_key.get(key);
      if (accounts === undefined) {
        continue;
      }
      matched_keys.push(key);
      for (const account of accounts) {
        matched_accounts.push(account);
      }
    }
    // Checked here because this is the first line at which the answer exists: the two guards above
    // ask whether the identifiers could be read and whether any survived, and a list of well-formed
    // numbers absent from the export passes both. Only `own_base` is refused. It is a declaration
    // that these people already hold accounts, so nothing matched contradicts it; the same zeros on
    // a cold cell are the finding that send was run to get, and refusing them would refuse every
    // honest cold reading this engine takes.
    //
    // And only where there is an index to match against. Two files leave none: an export of a
    // header and no rows, which this pass measures rather than refuses on purpose, and a populated
    // one whose every key sat at the switchboard ceiling and was evicted a few dozen lines above.
    // In both, no cell of any audience can match one identifier, so naming the cell would send the
    // reader to check their column and their list file over a fault in the other file. This error
    // means there is a base and this list does not intersect it; where there is no base the fault
    // is upstream of the declaration, and both worlds read the same whichever audience is declared.
    if (cell.audience === "own_base" && by_key.size > 0 && matched_keys.length === 0) {
      throw new UnmatchedBaseError(cell.name, keys.size);
    }

    // A list from the wrong market matches nothing for a reason no per-number check can see: every
    // number in it is valid, and the join is against a population that was never in this file. The
    // unparseable rate cannot catch it — a Portuguese list parses perfectly — and `UnmatchedBaseError`
    // only fires for a cell that claimed the base. This is the cold-list case, where zero matches is
    // the expected reading and a wrong-country list looks exactly like a campaign that did not land.
    const spread = market_divergence(list_markets, base_markets);
    if (spread > (opts.max_market_divergence ?? MAX_MARKET_DIVERGENCE)) {
      throw new MarketDivergenceError(cell.name, spread, opts.max_market_divergence ?? MAX_MARKET_DIVERGENCE);
    }

    // An account with no creation time falls in neither group. It cannot be placed relative to
    // the cut, and guessing would put it on whichever side flatters the campaign.
    const pre_existing: Account[] = [];
    const acquired: Account[] = [];
    for (const account of matched_accounts) {
      if (account.created === null) {
        continue;
      }
      if (account.created.getTime() < cut_ms) {
        pre_existing.push(account);
      } else {
        acquired.push(account);
      }
    }

    const within = (hours: number): number => {
      let count = 0;
      for (const account of acquired) {
        if ((account.created as Date).getTime() - cut_ms <= hours * HOUR_MS) {
          count++;
        }
      }
      return count;
    };

    let conversion_count = 0;
    let conversion_value = 0;
    // Only accumulated where the map declares the split. A product with no recycled balance has
    // no such distinction to report, and two zeros would read as one that came out empty.
    let new_money = 0;
    let recycled = 0;
    for (const account of matched_accounts) {
      // Blank joins nothing here for the reason it joins nothing in `accumulate`.
      if (account.id === "") {
        continue;
      }
      const events = conversions.get(account.id);
      if (events === undefined) {
        continue;
      }
      for (const event of events) {
        if (event.at === null || event.at.getTime() < cut_ms) {
          continue;
        }
        if (!event.committed) {
          continue;
        }
        conversion_count++;
        conversion_value += event.amount;
        if (event.recycled !== undefined) {
          if (event.recycled) {
            recycled += event.amount;
          } else {
            new_money += event.amount;
          }
        }
      }
    }

    const record: CellRecord = {
      cell: cell.name,
      cut_utc: cell.cut,
      // Beside the cut it qualifies rather than at the end of the record: the number and the fact
      // that the moment it is counted from is a placeholder have to be read together.
      ...(cell.cut_provisional === true ? { cut_provisional: true } : {}),
      measured_utc,
      window_hours: Math.floor((now_ms - cut_ms) / HOUR_MS),
      audience: {
        listed: keys.size,
        matched_phones: matched_keys.length,
        matched_accounts: matched_accounts.length,
      },
      acquired: {
        accounts: acquired.length,
        within: { h24: within(24), d7: within(24 * 7), d30: within(24 * 30) },
      },
      pre_existing: { accounts: pre_existing.length },
      conversions: {
        count: conversion_count,
        value: published_total(conversion_value, cell.name, "conversions.value"),
      },
    };

    if (splits_value) {
      record.conversions.new_money = published_total(new_money, cell.name, "conversions.new_money");
      record.conversions.recycled = published_total(recycled, cell.name, "conversions.recycled");
    }

    if (revenue !== null) {
      const gained = accumulate(acquired, revenue, cut_ms);
      const held = accumulate(pre_existing, revenue, cut_ms);
      record.acquired.revenue = {
        leads: gained.leads,
        value: published_total(gained.value, cell.name, "acquired.revenue.value"),
        top2_share: top2_share(gained.per_person, gained.value),
        median_lag_days: round_or_null(gained.lags.length === 0 ? null : median(gained.lags), 1),
      };
      record.pre_existing.revenue = {
        leads: held.leads,
        value: published_total(held.value, cell.name, "pre_existing.revenue.value"),
      };
    }
    if (churn !== null) {
      const gone = accumulate(acquired, churn, cut_ms);
      const held = accumulate(pre_existing, churn, cut_ms);
      record.acquired.churn = {
        leads: gone.leads,
        value: published_total(gone.value, cell.name, "acquired.churn.value"),
      };
      record.pre_existing.churn = {
        leads: held.leads,
        value: published_total(held.value, cell.name, "pre_existing.churn.value"),
      };
    }

    // The key set travels with the record. It is the cell's membership, and the only place a
    // control pair can be checked for the one fault that makes its arithmetic meaningless.
    measured.push({ cell, record, keys });
  }

  // A provisional cut is a date somebody wrote down while waiting for the real one. Everything
  // counted forward from it is dated against a guess, so the run refuses rather than emitting it.
  // It refuses instead of printing a warning because the reader who is misled is not the one
  // watching this run: it is whoever opens the JSON weeks later, and nothing printed to a terminal
  // reaches them. The record carries `cut_provisional` for the same reason, and that flag is what
  // the case with nothing counted is left with.
  const against_a_guess = measured
    .filter((entry) => entry.cell.cut_provisional === true)
    .map((entry) => ({
      cell: entry.cell.name,
      counted: ACCUMULATED_FROM_CUT.map((outcome) => ({
        outcome,
        // Zero where the map left the role unbound, which is the same "nothing to attribute" as a
        // bound role that counted none.
        count: resolve_outcome(entry.record, outcome) ?? 0,
      })).filter((reading) => reading.count > 0),
    }))
    .filter((entry) => entry.counted.length > 0);
  if (against_a_guess.length > 0) {
    throw new ProvisionalCutError(against_a_guess);
  }

  const by_name = new Map(measured.map((entry) => [entry.cell.name, entry]));

  for (const control of opts.controls ?? []) {
    const treated = by_name.get(control.treated);
    const untouched = by_name.get(control.control);
    if (treated === undefined || untouched === undefined) {
      const missing = treated === undefined ? control.treated : control.control;
      throw new ControlError(
        `the pair ${JSON.stringify(control.treated)} against ${JSON.stringify(control.control)} names ` +
          `${JSON.stringify(missing)}, which is not a declared cell. The cells measured in this run are ` +
          `${[...by_name.keys()].map((name) => JSON.stringify(name)).join(", ")}. A pair joins on the name, ` +
          "so correct the spelling here or declare the cell — naming a cell that was not measured cannot " +
          "be read as a comparison against nothing.",
      );
    }

    // The two-proportion test assumes two independent samples. Arms that share members break that
    // assumption without breaking anything visible: the shared people are counted on both sides,
    // so the control drifts towards the treated arm and the difference that survives is a
    // selection artefact wearing a p-value. A control drawn as "everyone we did not send to" from
    // a list that was later extended, or the same cell named twice, both land here — and both
    // publish `publishable: true` on a comparison of a group against itself.
    const smaller = treated.keys.size <= untouched.keys.size ? treated.keys : untouched.keys;
    const larger = smaller === treated.keys ? untouched.keys : treated.keys;
    let overlap = 0;
    for (const key of smaller) {
      if (larger.has(key)) {
        overlap += 1;
      }
    }
    if (overlap > 0) {
      throw new ControlError(
        control.treated === control.control
          ? `the pair names ${JSON.stringify(control.treated)} on both sides, so it compares a cell ` +
              "against itself. The result is a rate against the identical rate, a lift of exactly one and " +
              "a p-value of one, published as though a comparison had been made. Name the untouched cell " +
              "this one is meant to be read against."
          : `the pair ${JSON.stringify(control.treated)} against ${JSON.stringify(control.control)} ` +
              `shares ${overlap} of the ${treated.keys.size} identifiers listed by the first and the ` +
              `${untouched.keys.size} listed by the second. A two-proportion test reads two independent ` +
              "samples, and a person counted in both arms is counted as evidence twice — the control " +
              "moves towards the treated cell and whatever difference survives is an artefact of how the " +
              "two lists were drawn rather than of anything that was sent. Subtract the treated " +
              "identifiers from the control list, or exclude them on the control cell, and measure again.",
      );
    }

    // One check, not two. There was a countability check ahead of this one, reading the union of
    // the same table, so every outcome it refused this one refuses too and the only thing it
    // decided was which message the reader got: a first that named all four countable paths and a
    // second that then took three of them back, for one mistake. What the reader needs is a single
    // sentence naming what this pair can be read on and why the path asked for is not it.
    const treated_allows = COUNTABLE_BY_AUDIENCE[treated.cell.audience];
    const control_allows = COUNTABLE_BY_AUDIENCE[untouched.cell.audience];
    if (!treated_allows.includes(control.outcome) || !control_allows.includes(control.outcome)) {
      // A pair whose cells share an audience is told the rule once instead of hearing the same
      // list twice. The mixed case states that nothing can be read on both as a fact rather than
      // intersecting the two lists to find out: they are disjoint, so a branch for the case where
      // they overlapped would be a sentence no input could produce — the very thing this whole
      // check was merged to stop shipping. Their disjointness is pinned by a test, which is what
      // fires if it ever stops holding and this message starts lying.
      const rule =
        treated.cell.audience === untouched.cell.audience
          ? `Both cells are ${treated.cell.audience}, and a ${treated.cell.audience} cell is read on ` +
            `${treated_allows.join(", ")}.`
          : `A ${treated.cell.audience} cell is read on ${treated_allows.join(", ")}, and a ` +
            `${untouched.cell.audience} cell on ${control_allows.join(", ")}. No outcome can be read ` +
            "on both, so a pair drawn across the two audiences cannot be compared at all: read each " +
            "cell against an untouched cell drawn from its own audience.";
      throw new ControlError(
        `the pair ${JSON.stringify(control.treated)} (${treated.cell.audience}) against ` +
          `${JSON.stringify(control.control)} (${untouched.cell.audience}) reads outcome ` +
          `${JSON.stringify(control.outcome)}, which is not one both of these cells can be read on. ` +
          rule +
          " Two rules land here. The outcome has to be a count of people or events, because the " +
          "comparison is a two-proportion test over the identifiers each cell listed — a sum of money " +
          "divided by a headcount is not a proportion, and the test would answer with a p-value that " +
          "means nothing while reading as publishable, so report the money beside the counts instead. " +
          "And it has to be a count this audience can produce: a cold list has no counterfactual, so " +
          "arrival is the effect, while a list of people who already hold accounts cannot arrive at " +
          "all and commitment is the effect. The other way round is zero against zero, which is not a " +
          "null result but a question never asked.",
      );
    }

    const treated_value = resolve_outcome(treated.record, control.outcome);
    const control_value = resolve_outcome(untouched.record, control.outcome);
    if (treated_value === undefined || control_value === undefined) {
      throw new ControlError(
        `the pair ${JSON.stringify(control.treated)} against ${JSON.stringify(control.control)} reads outcome ` +
          `${JSON.stringify(control.outcome)}, which does not resolve to a number on the record. Check the ` +
          "path against the emitted shape; a role left unbound by the map emits no branch at all.",
      );
    }

    const treated_listed = treated.record.audience.listed;
    const control_listed = untouched.record.audience.listed;
    const test = two_proportion(treated_value, treated_listed, control_value, control_listed);

    treated.record.control = {
      against: control.control,
      outcome: control.outcome,
      treated_rate: round_half_even((treated_value / treated_listed) * 100, 3),
      control_rate: round_half_even((control_value / control_listed) * 100, 3),
      lift:
        control_value === 0
          ? null
          : round_half_even(treated_value / treated_listed / (control_value / control_listed), 2),
      control_events: control_value,
      p: round_or_null(test === null ? null : test.p, 3),
      // The unrounded p, and the window off the treated cell — which is the record this reading is
      // attached to and published from. Why each threshold is where it is, and which of the three
      // comparisons are inclusive, is on `is_publishable`.
      publishable: is_publishable(test === null ? null : test.p, control_value, treated.record.window_hours),
    };
  }

  return measured.map((entry) => entry.record);
}
