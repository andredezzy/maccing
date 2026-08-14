import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Cell, CellRecord, Control } from "../src/meta/whatsapp/campaigns/metrics.ts";
import {
  CellDeclarationError,
  CellExclusionError,
  COUNTABLE_OUTCOMES,
  ControlError,
  DuplicateColumnError,
  EmptyCellError,
  ExportBlankColumnError,
  ExportColumnError,
  ExportFlagError,
  ExportJoinError,
  ExportRepeatedPersonError,
  ExportStatusError,
  ExportValueError,
  files,
  is_publishable,
  MAX_P,
  MarketDivergenceError,
  MIN_CONTROL_EVENTS,
  MissingColumnError,
  MissingExportError,
  measure,
  OverflowedTotalError,
  PhoneFormatError,
  ProvisionalCutError,
  SourceError,
  TextListOptionError,
  TimestampError,
  UnmatchedBaseError,
  UnparseablePhonesError,
  UnsupportedListFormatError,
  UnterminatedQuoteError,
  WINDOW_FLOOR_HOURS,
} from "../src/meta/whatsapp/campaigns/metrics.ts";

/**
 * `measure` is the package's only entry point, and everything else in this suite tests a piece it
 * calls rather than the pass itself. That gap is not academic: a reviewer inverted all four
 * comparisons against the cut at once and the rest of the suite stayed green, which means the
 * decision separating "already had an account" from "arrived because of this" was undefended. So
 * the boundary cases come first here, and each one is written to fail if the comparison it guards
 * moves by one instant in either direction.
 *
 * The other half of the file is about refusal. This engine's cheapest wrong answer is zero, and a
 * record full of zeros reads exactly like a campaign nobody responded to, so every ambiguity has a
 * named error and every named error gets a test proving it is reachable from the public call. An
 * unreachable guard is prose.
 *
 * Rows arrive through the `files` adapter, because a fixture is a directory: four files named for
 * the four roles, each headed with the contract's own column names. The database adapter is the
 * other implementation of the same one-method interface and everything below sits downstream of
 * both — the boundary carries strings precisely so a directory and a database inherit identical
 * validation.
 *
 * The numbering plan is Brazil's, which is a change from the fixtures this file used to carry.
 * Those named an impossible market on purpose, so that nothing here could be mistaken for a
 * description of a real one or quietly reused as such. The market is now derived from the base
 * rather than declared, and an impossible market derives nothing: every case would measure an
 * audience of nobody. So the plan is real and everything written inside it — every subscriber, id,
 * amount and label below — is still invented to exercise a branch.
 */

// ---------------------------------------------------------------------------------------------
// Fixture vocabulary
// ---------------------------------------------------------------------------------------------

/** The one instant everything is measured against. Whole-millisecond, as a cut must be. */
const CUT = "2030-01-01T00:00:00.000Z";
const CUT_MS = Date.parse(CUT);

const HOUR = 3_600_000;
const DAY = 86_400_000;

/** An ISO instant a given number of milliseconds from the cut. Negative is before it. */
function from_cut(offset: number): string {
  return new Date(CUT_MS + offset).toISOString();
}

/** The default reading time: far enough past the cut that the publishability floor is clear of
 *  it, so a test about anything else never trips over the floor by accident. */
const NOW = new Date(CUT_MS + 30 * DAY);

/**
 * One invented subscriber per `n`, written the way a base that keeps calling codes writes it:
 * thirteen digits, `+55 11 9XXXX-XXXX`. It keys to `BR:11` followed by the eight digits under the
 * reform nine, so a list row and a person row join with nothing in between for the reader to work
 * out, and two different `n` are always two different people.
 */
function phone(n: number): string {
  return `55119${String(n).padStart(8, "0")}`;
}

/** The same subscriber as a base that keeps no calling code writes it: eleven digits, read against
 *  the market inferred from the corpus around it. It keys identically to `phone`. */
function national(n: number): string {
  return `119${String(n).padStart(8, "0")}`;
}

/** An invented Portuguese subscriber, for the cases about a list drawn from another market. */
function foreign(n: number): string {
  return `3519${String(n).padStart(8, "0")}`;
}

// ---------------------------------------------------------------------------------------------
// Building the source and the lists
// ---------------------------------------------------------------------------------------------

type Row = readonly (string | number)[];

function csv(header: readonly string[], rows: readonly Row[]): string {
  return `${[header.join(","), ...rows.map((row) => row.join(","))].join("\n")}\n`;
}

/** The lead role, headed with the contract's names. One row per account, not per person: a phone
 *  answering for several accounts appears on several rows. */
function leads(...rows: readonly Row[]): string {
  return csv(["id", "phone", "created_at"], rows);
}

/** The lead role with the optional `referrer` column, which is what turns the `referrals` block on. */
function tree(...rows: readonly Row[]): string {
  return csv(["id", "phone", "created_at", "referrer"], rows);
}

function revenue(...rows: readonly Row[]): string {
  return csv(["lead", "at", "amount"], rows);
}

function churn(...rows: readonly Row[]): string {
  return csv(["lead", "at", "amount"], rows);
}

/** The conversion role. `committed` and `recycled` are predicates the source answers rather than
 *  statuses this package interprets, so they cross the boundary as the literal strings `true` and
 *  `false`, and anything else is a fault rather than a falsy value. */
function conversions(...rows: readonly Row[]): string {
  return csv(["lead", "at", "amount", "committed", "recycled"], rows);
}

/** The same role as a product with no recycled balance answers it. The column is absent rather
 *  than `false` on every row, which is the difference between having no such concept and having
 *  measured none of it. */
function conversions_unsplit(...rows: readonly Row[]): string {
  return csv(["lead", "at", "amount", "committed"], rows);
}

/** A `.txt` list: one identifier per line. */
function lines(...values: readonly string[]): string {
  return `${values.join("\n")}\n`;
}

/**
 * The readable company one unreadable identifier has to keep before the rate guard is the thing a
 * case is asking about.
 *
 * A run refuses above five percent unreadable, and five percent of twenty is one. So a fixture
 * about *how* unknowns are counted — one sentinel repeated, a sentinel written twice with
 * different padding, a list named twice — needs nineteen keys beside the unknown, or it is
 * refused for being small rather than for the thing under test. `keyed_accounts(19)` and
 * `keyed_numbers(19)` are the two sides of that quorum, and they key to each other.
 */
const READABLE = 19;

function keyed_accounts(count: number, created: string = from_cut(HOUR)): Row[] {
  return Array.from({ length: count }, (_, i): Row => [`account-${i}`, phone(i + 1), created]);
}

function keyed_numbers(count: number): string[] {
  return Array.from({ length: count }, (_, i) => phone(i + 1));
}

type Parts = {
  /** `null` writes no file for the role at all, which is how a role goes unanswered. */
  lead?: string | null;
  revenue?: string | null;
  churn?: string | null;
  conversion?: string | null;
  /** Filename to body. Written under the case's `lists/`. */
  lists?: Record<string, string>;
};

type Fixture = {
  /** The directory the role files were written to, which is what a `files` source is pointed at. */
  dir: string;
  /** Absolute path of one of this case's list files, written or not. */
  list: (name: string) => string;
};

let root = "";

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "growth-metrics-"));
});

afterAll(async () => {
  if (root !== "") {
    await rm(root, { recursive: true, force: true });
  }
});

async function build(name: string, parts: Parts = {}): Promise<Fixture> {
  const base = join(root, name);
  const dir = join(base, "exports");

  const roles: readonly (readonly [string, string | null])[] = [
    ["lead.csv", parts.lead === undefined ? leads() : parts.lead],
    ["revenue.csv", parts.revenue === undefined ? revenue() : parts.revenue],
    ["churn.csv", parts.churn === undefined ? churn() : parts.churn],
    ["conversion.csv", parts.conversion === undefined ? conversions() : parts.conversion],
  ];
  for (const [file, body] of roles) {
    if (body !== null) {
      await Bun.write(join(dir, file), body);
    }
  }
  for (const [file, body] of Object.entries(parts.lists ?? {})) {
    await Bun.write(join(base, "lists", file), body);
  }

  return { dir, list: (file) => join(base, "lists", file) };
}

/** A cold cell on this fixture's cut, which is what most cases want. */
function cold(name: string, list: string, extra: Partial<Cell> = {}): Cell {
  return { name, cut: CUT, lists: [list], audience: "cold", ...extra };
}

/** The same, for a list of people who already hold accounts. */
function base(name: string, list: string, extra: Partial<Cell> = {}): Cell {
  return { name, cut: CUT, lists: [list], audience: "own_base", ...extra };
}

/** Returns the error a rejection produced, and fails if there was no rejection at all. */
async function caught(work: Promise<unknown>): Promise<Error> {
  try {
    await work;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the measurement to be refused, but it returned a record");
}

/** The single record a one-cell run emits. */
async function one(fixture: Fixture, cell: Cell, now: Date = NOW): Promise<CellRecord> {
  const records = await measure({ source: files(fixture.dir), cells: [cell], now });
  expect(records).toHaveLength(1);
  return records[0] as CellRecord;
}

// ---------------------------------------------------------------------------------------------
// The cut
// ---------------------------------------------------------------------------------------------

describe("the cut separates who was already there from who arrived", () => {
  /**
   * The comparison this pins is the one the whole record is built on, and inverting it changes
   * the two headline numbers a campaign is judged by while breaking nothing else. It is `<`
   * against the cut, so an account created at the exact instant of contact is *acquired*: the
   * same polarity the event side uses, where an event at the cut counts as after it. An instant
   * that appears in two comparisons on one record has to fall the same side in both.
   */
  test("an account created at the exact cut is acquired, one a millisecond earlier is not", async () => {
    const fixture = await build("cut-boundary", {
      lead: leads(
        ["before", phone(1), from_cut(-1)],
        ["exactly", phone(2), from_cut(0)],
        ["after", phone(3), from_cut(1)],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2), phone(3)) },
    });

    const record = await one(fixture, cold("cut-boundary", fixture.list("reached.txt")));

    expect(record.audience).toEqual({ listed: 3, matched_phones: 3, matched_accounts: 3 });
    // Only the account a millisecond before the cut was already there. The one sitting exactly
    // on it is an arrival, and moving the comparison to `<=` swaps a member between these two
    // numbers — which is the mutation this test exists to catch.
    expect(record.pre_existing.accounts).toBe(1);
    expect(record.acquired.accounts).toBe(2);
  });

  test("an account with no creation time falls in neither group rather than the flattering one", async () => {
    const fixture = await build("cut-undated", {
      lead: leads(["dated", phone(1), from_cut(HOUR)], ["undated", phone(2), ""]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const record = await one(fixture, cold("cut-undated", fixture.list("reached.txt")));

    expect(record.audience.matched_accounts).toBe(2);
    expect(record.acquired.accounts).toBe(1);
    expect(record.pre_existing.accounts).toBe(0);
  });

  test("the within windows include their own boundary and exclude the millisecond after it", async () => {
    const fixture = await build("cut-windows", {
      lead: leads(
        ["at-cut", phone(1), from_cut(0)],
        ["h24", phone(2), from_cut(24 * HOUR)],
        ["h24-plus", phone(3), from_cut(24 * HOUR + 1)],
        ["d7", phone(4), from_cut(7 * DAY)],
        ["d7-plus", phone(5), from_cut(7 * DAY + 1)],
        ["d30", phone(6), from_cut(30 * DAY)],
        ["d30-plus", phone(7), from_cut(30 * DAY + 1)],
      ),
      lists: { "reached.txt": lines(...[1, 2, 3, 4, 5, 6, 7].map(phone)) },
    });

    const record = await one(fixture, cold("cut-windows", fixture.list("reached.txt")), new Date(CUT_MS + 40 * DAY));

    expect(record.acquired.accounts).toBe(7);
    // Cumulative, and each boundary is inclusive: 24h holds the cut itself and the account at
    // exactly 24h; the one a millisecond later waits for the seven-day window.
    expect(record.acquired.within).toEqual({ h24: 2, d7: 4, d30: 6 });
  });

  test("an event on the cut counts and one a millisecond earlier does not, in every money role", async () => {
    const fixture = await build("cut-events", {
      lead: leads(
        ["on", phone(1), from_cut(-DAY)],
        ["early", phone(2), from_cut(-DAY)],
        ["void", phone(3), from_cut(-DAY)],
      ),
      revenue: revenue(["on", from_cut(0), 25], ["early", from_cut(-1), 99]),
      churn: churn(["on", from_cut(0), 5], ["early", from_cut(-1), 88]),
      conversion: conversions(
        ["on", from_cut(0), 10, "true", "false"],
        ["early", from_cut(-1), 77, "true", "false"],
        // A row the source did not mark committed is not a commitment, whenever it happened.
        ["void", from_cut(HOUR), 500, "false", "false"],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2), phone(3)) },
    });

    const record = await one(fixture, cold("cut-events", fixture.list("reached.txt")));

    expect(record.pre_existing.accounts).toBe(3);
    expect(record.pre_existing.revenue).toEqual({ leads: 1, value: 25 });
    expect(record.pre_existing.churn).toEqual({ leads: 1, value: 5 });
    expect(record.conversions.count).toBe(1);
    expect(record.conversions.value).toBe(10);
  });

  test("an event with no time at all is dropped rather than read as sitting on the cut", async () => {
    // The shape the two null guards exist for, and the only shape that reaches them: a file where
    // every row is undated is stopped a layer up by the blank-column refusal, and every other
    // fixture here dates all of its rows. Read as the cut instant instead of skipped, the undated
    // revenue row lands on the countable side and this cell reports 124 earned where 25 was; drop
    // the null half of the conversion filter and the 77 becomes a second commitment nobody can put
    // a date on. Both hand the campaign money with no evidence it arrived after contact.
    const fixture = await build("cut-mixed-dates", {
      lead: leads(["mixed", phone(1), from_cut(-DAY)]),
      revenue: revenue(["mixed", from_cut(HOUR), 25], ["mixed", "", 99]),
      churn: churn(["mixed", from_cut(HOUR), 5], ["mixed", "", 88]),
      conversion: conversions(["mixed", from_cut(HOUR), 10, "true", "false"], ["mixed", "", 77, "true", "false"]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("cut-mixed-dates", fixture.list("reached.txt")));

    expect(record.pre_existing.revenue).toEqual({ leads: 1, value: 25 });
    expect(record.pre_existing.churn).toEqual({ leads: 1, value: 5 });
    expect(record.conversions.count).toBe(1);
    expect(record.conversions.value).toBe(10);
  });

  test("a cut finer than a millisecond is refused rather than silently truncated", async () => {
    const fixture = await build("cut-precision", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(
      one(fixture, cold("cut-precision", fixture.list("reached.txt"), { cut: "2030-01-01T00:00:00.0005Z" })),
    );

    expect(error).toBeInstanceOf(CellDeclarationError);
    expect((error as CellDeclarationError).cell).toBe("cut-precision");
    expect(error.message).toMatch(/millisecond/i);
  });

  test("a blank cut is refused, because there is no moment to measure from", async () => {
    const fixture = await build("cut-blank", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("cut-blank", fixture.list("reached.txt"), { cut: "   " })));

    expect(error).toBeInstanceOf(CellDeclarationError);
    expect(error.message).toMatch(/blank/i);
  });

  test("a cut nothing can read names the cell that declared it, not just the text", async () => {
    // The parser names the value and stops there, which is all it can do: it is handed a string
    // and knows nothing about cells. Left to surface as written, a run measuring several cells
    // answers `not a readable timestamp: "03/02/2030 09:00"` and leaves the reader grepping the
    // declaration for whichever cell is carrying that string — while every other refusal on a
    // cut, the blank one above and the rolled and late ones below, names it outright. Two cells
    // here, because one cell cannot tell a message that names the cell from one that does not.
    const fixture = await build("cut-unreadable", {
      lead: leads(["one", phone(1), from_cut(HOUR)], ["two", phone(2), from_cut(HOUR)]),
      lists: { "first.txt": lines(phone(1)), "second.txt": lines(phone(2)) },
    });

    const error = await caught(
      measure({
        source: files(fixture.dir),
        cells: [
          cold("list-a", fixture.list("first.txt")),
          cold("list-b", fixture.list("second.txt"), { cut: "03/02/2030 09:00" }),
        ],
        now: NOW,
      }),
    );

    expect(error).toBeInstanceOf(CellDeclarationError);
    expect((error as CellDeclarationError).cell).toBe("list-b");
    // The text as typed, beside the cell: the pair is what makes the line actionable.
    expect(error.message).toContain("03/02/2030 09:00");
  });

  /**
   * One more way a hand-typed cut goes wrong, and the only one the runtime answers by guessing:
   * `new Date` counts an impossible day past the end of its month instead of refusing it. Every
   * cut on disk is transcribed off a delivery report, where a slipped day is an ordinary typo, and
   * the roll moves arrivals across the cut in whichever direction the typo points while the record
   * goes on publishing the date that was typed. Each case below pins the day the runtime would
   * have measured from, so a check that refuses on the wrong arithmetic still fails.
   */
  const ROLLED_CUTS: readonly { case: string; cut: string; rolls_to: string; now: string }[] = [
    // A 30-day month. The slip a delivery report invites most, because 31 is a real day in seven
    // of the other eleven months.
    { case: "cut-april-31", cut: "2030-04-31T00:00:00Z", rolls_to: "2030-05-01", now: "2030-06-01T00:00:00Z" },
    // 29 February in a common year, which is a real date in three years out of four.
    { case: "cut-feb-29-common", cut: "2030-02-29T00:00:00Z", rolls_to: "2030-03-01", now: "2030-06-01T00:00:00Z" },
    // Past the end of February in a *leap* year. February is 29 days long here, so this rolls one
    // day rather than two — which is what proves the check consults the leap rule instead of
    // refusing every February day above 28.
    { case: "cut-feb-30-leap", cut: "2028-02-30T00:00:00Z", rolls_to: "2028-03-01", now: "2028-06-01T00:00:00Z" },
  ];

  for (const shape of ROLLED_CUTS) {
    test(`a cut of ${shape.cut} is refused rather than rolled forward to ${shape.rolls_to}`, async () => {
      const fixture = await build(shape.case, {
        lead: leads(["one", phone(1), from_cut(HOUR)]),
        lists: { "reached.txt": lines(phone(1)) },
      });

      // Read from well after the declared date, so the only refusal this cut can draw is the
      // rollover: a reading taken before it would also be later-than-now, and the test would pass
      // on the wrong error.
      const error = await caught(
        one(fixture, cold(shape.case, fixture.list("reached.txt"), { cut: shape.cut }), new Date(shape.now)),
      );

      expect(error).toBeInstanceOf(CellDeclarationError);
      expect((error as CellDeclarationError).cell).toBe(shape.case);
      // Both dates, because the fault is the gap between them: what the record would say, and
      // what it would have counted from.
      expect(error.message).toContain(shape.cut);
      expect(error.message).toContain(shape.rolls_to);
    });
  }

  test("a legitimate 29 February in a leap year still measures", async () => {
    // The other half of the refusal above. 2028 is divisible by four, so the day exists and the
    // cut is honoured exactly — a check written as "February above 28 is a typo" turns a real
    // send date into a stop, and the campaign it measured never gets read at all.
    const fixture = await build("cut-feb-29-leap", {
      lead: leads(
        ["before", phone(1), "2028-02-28T23:59:59.999Z"],
        ["exactly", phone(2), "2028-02-29T00:00:00.000Z"],
        ["after", phone(3), "2028-02-29T12:00:00.000Z"],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2), phone(3)) },
    });

    const record = await one(
      fixture,
      cold("cut-feb-29-leap", fixture.list("reached.txt"), { cut: "2028-02-29T00:00:00Z" }),
      new Date("2028-04-01T00:00:00Z"),
    );

    expect(record.cut_utc).toBe("2028-02-29T00:00:00Z");
    expect(record.pre_existing.accounts).toBe(1);
    expect(record.acquired.accounts).toBe(2);
  });

  test("a cut whose explicit offset carries it into another civil date is left alone", async () => {
    // 1 March at +05:30 is 28 February in UTC. The declared day is real, and only the declared day
    // is the check's business — reading the date back off the parsed instant would refuse this cut
    // for naming a March day the reading never touches, which is a correct send date turned into a
    // stop by a guard meant for typos.
    const fixture = await build("cut-offset-date", {
      lead: leads(["before", phone(1), "2030-02-28T18:29:59.999Z"], ["after", phone(2), "2030-02-28T18:30:00.000Z"]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const record = await one(
      fixture,
      cold("cut-offset-date", fixture.list("reached.txt"), { cut: "2030-03-01T00:00:00+05:30" }),
      new Date("2030-06-01T00:00:00Z"),
    );

    expect(record.cut_utc).toBe("2030-03-01T00:00:00+05:30");
    expect(record.pre_existing.accounts).toBe(1);
    expect(record.acquired.accounts).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------------------------

describe("matching a list against the lead index", () => {
  test("one subscriber written several ways in one list counts once", async () => {
    const fixture = await build("match-forms", {
      lead: leads(["multi", "5511987654321", from_cut(HOUR)], ["other", "5511987654322", from_cut(HOUR)]),
      lists: {
        // The same subscriber as a mixed set of sources writes it: with the calling code and the
        // reform digit, with the calling code and the older national number, bare with the reform
        // digit, and bare without it. Four rows, one person, and a cell that counted them as four
        // publishes an audience four times the size of the one it reached.
        "reached.txt": lines("5511987654321", "551187654321", "11987654321", "1187654321", "5511987654322"),
      },
    });

    const record = await one(fixture, cold("match-forms", fixture.list("reached.txt")));

    expect(record.audience).toEqual({ listed: 2, matched_phones: 2, matched_accounts: 2 });
    expect(record.acquired.accounts).toBe(2);
  });

  test("one phone answering for two accounts contributes one key and two accounts", async () => {
    // The record separates the two counts on purpose: a cell of 100 phones that matched 130
    // accounts is a different fact from one that matched 130 phones.
    const fixture = await build("match-two-accounts", {
      lead: leads(["old", phone(10), from_cut(-DAY)], ["new", phone(10), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(10)) },
    });

    const record = await one(fixture, cold("match-two-accounts", fixture.list("reached.txt")));

    expect(record.audience).toEqual({ listed: 1, matched_phones: 1, matched_accounts: 2 });
    // Each account is placed against the cut on its own, so one phone can land on both sides.
    expect(record.pre_existing.accounts).toBe(1);
    expect(record.acquired.accounts).toBe(1);
  });

  test("a phone at the shared ceiling is evicted before matching, so it cannot inflate a cell", async () => {
    // The ceiling is four. Left in the index, the switchboard below would hand this cell four
    // arrivals it never reached — the failure the eviction exists to prevent — and it is the
    // *matching* that must not see it, not merely the reported total.
    const fixture = await build("match-ceiling", {
      lead: leads(
        ["desk-a", phone(20), from_cut(HOUR)],
        ["desk-b", phone(20), from_cut(HOUR)],
        ["desk-c", phone(20), from_cut(HOUR)],
        ["desk-d", phone(20), from_cut(HOUR)],
        ["person", phone(21), from_cut(HOUR)],
      ),
      lists: { "reached.txt": lines(phone(20), phone(21)) },
    });

    const record = await one(fixture, cold("match-ceiling", fixture.list("reached.txt")));

    expect(record.audience.listed).toBe(2);
    expect(record.audience.matched_phones).toBe(1);
    expect(record.audience.matched_accounts).toBe(1);
    expect(record.acquired.accounts).toBe(1);
  });

  test("a phone one account below the ceiling is kept", async () => {
    // The ceiling is `at or above`, not `above`. Three accounts under a ceiling of four survive,
    // which is what pins the comparison rather than merely the constant.
    const fixture = await build("match-under-ceiling", {
      lead: leads(
        ["trio-a", phone(22), from_cut(HOUR)],
        ["trio-b", phone(22), from_cut(HOUR)],
        ["trio-c", phone(22), from_cut(HOUR)],
      ),
      lists: { "reached.txt": lines(phone(22)) },
    });

    const record = await one(fixture, cold("match-under-ceiling", fixture.list("reached.txt")));

    expect(record.audience.matched_accounts).toBe(3);
    expect(record.acquired.accounts).toBe(3);
  });

  test("a filter cuts one cell out of a file holding several", async () => {
    const fixture = await build("match-filter", {
      lead: leads(["a1", phone(1), from_cut(HOUR)], ["b1", phone(2), from_cut(HOUR)], ["a2", phone(3), from_cut(HOUR)]),
      lists: {
        "roster.csv": `handset,cell\n${phone(1)},alpha\n${phone(2)},beta\n${phone(3)},alpha\n`,
      },
    });

    const record = await one(fixture, {
      name: "alpha",
      cut: CUT,
      lists: [fixture.list("roster.csv")],
      column: "handset",
      filter: { column: "cell", value: "alpha" },
      audience: "cold",
    });

    expect(record.audience.listed).toBe(2);
    expect(record.acquired.accounts).toBe(2);
  });

  test("a declared column that is not the file's first one", async () => {
    // Every other fixture that names a column puts it first, so the declaration and the fallback
    // pick the same column and a reader that ignored the declaration would look correct. Here they
    // disagree, and the disagreement is a different set of leads: `ticket` holds numbers that
    // belong to two accounts that already existed, `handset` the two that arrived. Read the wrong
    // column and the cell reports two arrivals it never reached and none of the two it did, with
    // no error anywhere — the counts are the same size, only the people are wrong.
    const fixture = await build("match-second-column", {
      lead: leads(
        ["new-a", phone(31), from_cut(HOUR)],
        ["new-b", phone(32), from_cut(HOUR)],
        ["old-a", phone(33), from_cut(-DAY)],
        ["old-b", phone(34), from_cut(-DAY)],
      ),
      lists: {
        "roster.csv": `ticket,handset\n${phone(33)},${phone(31)}\n${phone(34)},${phone(32)}\n`,
      },
    });

    const record = await one(fixture, cold("match-second-column", fixture.list("roster.csv"), { column: "handset" }));

    expect(record.audience).toEqual({ listed: 2, matched_phones: 2, matched_accounts: 2 });
    expect(record.acquired.accounts).toBe(2);
    expect(record.pre_existing.accounts).toBe(0);
  });

  test("a list whose last line carries no terminator is still a row", async () => {
    // Every other fixture ends with a newline, so the scanner's final flush — the row still in
    // hand when the text runs out — is never the thing that emits a record. Plenty of writers omit
    // that last newline, and without the flush their last identifier is simply not there: the cell
    // is measured one person short, quietly, because a list of two that reads as one is a
    // perfectly plausible list.
    const fixture = await build("match-no-trailing-newline", {
      lead: leads(["a1", phone(41), from_cut(HOUR)], ["a2", phone(42), from_cut(HOUR)]),
      lists: { "roster.csv": `handset,cohort\n${phone(41)},evening\n${phone(42)},evening` },
    });

    const record = await one(
      fixture,
      cold("match-no-trailing-newline", fixture.list("roster.csv"), { column: "handset" }),
    );

    expect(record.audience).toEqual({ listed: 2, matched_phones: 2, matched_accounts: 2 });
    expect(record.acquired.accounts).toBe(2);
  });

  test("a list that needs a real scanner is read as written, not split on commas", async () => {
    // Three properties of the scanner at once, because each one is invisible in a well-behaved
    // file and each one quietly moves people between cells. The cohort label holds a comma, so a
    // split on commas would shift every column after it on those rows alone; it holds a doubled
    // quote, which is how a CSV writes one inside a quoted field; and the last row stops short of
    // the header, which is what a writer that trims trailing empties produces.
    //
    // The file also opens with a byte-order mark, and that one is not a property of the scanner.
    // `Bun.file().text()` decodes UTF-8 by the WHATWG rule, which strips a single leading mark
    // before this package sees the text, so the scanner never meets it. The mark stays in the
    // fixture because a spreadsheet writes one and this proves the whole path tolerates it. What
    // exercises the strip in `read_rows` is the doubled mark in the case below.
    const fixture = await build("match-scanner", {
      lead: leads(["a1", phone(1), from_cut(HOUR)], ["a2", phone(2), from_cut(HOUR)], ["b1", phone(3), from_cut(HOUR)]),
      lists: {
        "roster.csv":
          "\uFEFFhandset,cohort\n" +
          `${phone(1)},"evening, the ""late"" batch"\n` +
          `${phone(2)},"evening, the ""late"" batch"\n` +
          `${phone(3)}\n`,
      },
    });

    const records = await measure({
      source: files(fixture.dir),
      now: NOW,
      cells: [
        {
          name: "labelled",
          cut: CUT,
          lists: [fixture.list("roster.csv")],
          column: "handset",
          filter: { column: "cohort", value: 'evening, the "late" batch' },
          audience: "cold",
        },
        {
          // A row that stops before the label is a row whose label is blank, not a row with no
          // label at all, and it can be selected as such.
          name: "unlabelled",
          cut: CUT,
          lists: [fixture.list("roster.csv")],
          column: "handset",
          filter: { column: "cohort", value: "" },
          audience: "cold",
        },
      ],
    });

    expect(records[0]?.audience).toEqual({ listed: 2, matched_phones: 2, matched_accounts: 2 });
    expect(records[1]?.audience).toEqual({ listed: 1, matched_phones: 1, matched_accounts: 1 });
  });

  test("a list whose byte-order mark was written twice still finds its first column", async () => {
    // Why this fixture carries two marks and not one, stated here because the next mutation pass
    // will find the strip in `read_rows` unexercised by every other case and reach for the delete.
    // It is live code. The decoder removes one leading mark, so a file with one never reaches the
    // strip — but a "prepend a byte-order mark so Excel opens it properly" script run against an
    // export that already carried one writes two, which is exactly the sort of file this engine is
    // pointed at. The decoder takes the first, the second arrives in the header, and it becomes
    // part of the first column's name: without the strip this list fails with a MissingColumnError
    // naming a column that is visibly right in the file.
    const fixture = await build("match-double-bom", {
      lead: leads(["a1", phone(1), from_cut(HOUR)], ["b1", phone(2), from_cut(HOUR)]),
      lists: { "roster.csv": `\uFEFF\uFEFFhandset,cohort\n${phone(1)},evening\n${phone(2)},morning\n` },
    });

    const record = await one(fixture, {
      name: "double-bom",
      cut: CUT,
      lists: [fixture.list("roster.csv")],
      column: "handset",
      filter: { column: "cohort", value: "evening" },
      audience: "cold",
    });

    expect(record.audience).toEqual({ listed: 1, matched_phones: 1, matched_accounts: 1 });
  });

  test("an excluded identifier is subtracted however the number is written", async () => {
    const fixture = await build("match-exclude", {
      lead: leads(
        ["real", phone(1), from_cut(HOUR)],
        ["probe-a", phone(2), from_cut(HOUR)],
        ["probe-b", phone(3), from_cut(HOUR)],
        ["probe-c", phone(4), from_cut(HOUR)],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2), phone(3), phone(4)) },
    });

    const record = await one(
      fixture,
      // The probes are written in different forms from their list rows on purpose: exclusion is
      // by derived key, so the three ways a planted number reaches a declaration — copied out of
      // a delivery report with its calling code and punctuation, pasted from a spreadsheet with
      // spaces and no calling code, typed bare — all subtract the same person. The refusal for
      // entries that yield no key must not narrow this to one spelling.
      cold("match-exclude", fixture.list("reached.txt"), {
        exclude: ["+55 (11) 90000-0002", "11 90000-0003", phone(4)],
      }),
    );

    expect(record.audience.listed).toBe(1);
    expect(record.acquired.accounts).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------
// Concentration
// ---------------------------------------------------------------------------------------------

describe("top2_share puts concentration beside the total", () => {
  /** Builds a cell where everyone is acquired and each named member paid once. */
  async function paid(name: string, amounts: readonly number[]): Promise<CellRecord> {
    const ids = amounts.map((_, i) => `payer-${i}`);
    const fixture = await build(name, {
      lead: leads(...ids.map((id, i) => [id, phone(i + 1), from_cut(HOUR)] as Row)),
      revenue: revenue(...ids.map((id, i) => [id, from_cut((i + 1) * DAY), amounts[i] as number] as Row)),
      lists: { "reached.txt": lines(...ids.map((_, i) => phone(i + 1))) },
    });
    return one(fixture, cold(name, fixture.list("reached.txt")));
  }

  test("is null when nobody paid, because the question is meaningless", async () => {
    const fixture = await build("top2-none", {
      lead: leads(["quiet", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("top2-none", fixture.list("reached.txt")));

    expect(record.acquired.revenue).toEqual({ leads: 0, value: 0, top2_share: null, median_lag_days: null });
  });

  test("is null when exactly one person paid, because there is no second to compare", async () => {
    const record = await paid("top2-one", [40]);

    expect(record.acquired.revenue?.leads).toBe(1);
    expect(record.acquired.revenue?.value).toBe(40);
    expect(record.acquired.revenue?.top2_share).toBeNull();
  });

  test("is one when exactly two people paid, since between them they are the whole total", async () => {
    const record = await paid("top2-two", [30, 10]);

    expect(record.acquired.revenue?.value).toBe(40);
    expect(record.acquired.revenue?.top2_share).toBe(1);
  });

  test("reports the real share once there is a third contributor to hide behind", async () => {
    const record = await paid("top2-three", [60, 30, 10]);

    expect(record.acquired.revenue?.value).toBe(100);
    expect(record.acquired.revenue?.top2_share).toBe(0.9);
    // Lags of one, two and four days: the median is the value the mean would flatter away.
    expect(record.acquired.revenue?.median_lag_days).toBe(2);
  });

  test("is one when a single person paid everything and the rest paid nothing", async () => {
    // A zero-value event still counts its lead: they did transact. The share then says that
    // the total belongs to one of them, which is exactly the fact worth surfacing.
    const record = await paid("top2-all-one", [100, 0, 0]);

    expect(record.acquired.revenue?.leads).toBe(3);
    expect(record.acquired.revenue?.value).toBe(100);
    expect(record.acquired.revenue?.top2_share).toBe(1);
  });

  test("is null when a contributor nets out below zero, since there is then no whole to share", async () => {
    // Two people paid ten each and a third's events net out at minus fifteen — a reversal larger
    // than what they put in, which is data rather than a fault and totals correctly. The share is
    // the part that stops meaning anything: the denominator shrinks to five while the two largest
    // parts still sum to twenty, so the ratio comes out at 4 and the field says the top two hold
    // four hundred percent of the money. A number outside the range it is read in is worse than
    // no number, and null is what the two other meaningless cases here already return.
    const record = await paid("top2-negative", [10, 10, -15]);

    expect(record.acquired.revenue?.leads).toBe(3);
    expect(record.acquired.revenue?.value).toBe(5);
    expect(record.acquired.revenue?.top2_share).toBeNull();
  });

  test("is null when two people each contributed exactly zero, since zero is no whole to divide", async () => {
    // Both transacted and both paid nothing: two contributors, and a denominator of nothing to
    // divide between them. Relaxing the guard to strictly-negative walks this pair into `0 / 0`
    // and the field comes back NaN, which serialises into the published file as `null` — so the
    // reader cannot tell it from the honest null, and anything reading the field back and doing
    // arithmetic on it turns every downstream figure to NaN too.
    const record = await paid("top2-zero-total", [0, 0]);

    expect(record.acquired.revenue?.leads).toBe(2);
    expect(record.acquired.revenue?.value).toBe(0);
    expect(record.acquired.revenue?.top2_share).toBeNull();
  });

  test("rounds the share to two places, so a third decimal cannot pass for measured concentration", async () => {
    // Three subtotals that divide to 0.7774725…, which is the only kind of input that can see the
    // digit count at all: every other share in this describe terminates inside two places and
    // prints the same at any precision. At three the field emits 0.777 where it emitted 0.78, so
    // two runs over identical subtotals disagree in the last digit they publish and a share
    // quoted off an earlier record can no longer be re-checked against the run that produced it.
    const record = await paid("top2-precision", [40.5, 30.25, 20.25]);

    expect(record.acquired.revenue?.value).toBe(91);
    expect(record.acquired.revenue?.top2_share).toBe(0.78);
  });
});

// ---------------------------------------------------------------------------------------------
// The lag
// ---------------------------------------------------------------------------------------------

describe("median_lag_days measures from the cut to the first payment", () => {
  test("not from the account's own creation, and not as a mean over its events", async () => {
    // The field's name is the whole risk: "lag" reads as time-since-signup, and it is not. This
    // fixture separates the three readings somebody could implement or document. The account arrives
    // ten days after contact and pays on day twelve and again on day twenty, so from the cut to its
    // first payment is 12, from its own creation would be 2, and the mean of both events would be
    // 16. Every other fixture in this file creates its accounts at one instant an hour after the
    // cut, where from-creation and from-cut differ by a constant and round to the same number — so
    // the reading has never been held apart from its two neighbours anywhere else.
    const fixture = await build("lag-from-cut", {
      lead: leads(["late", phone(1), from_cut(10 * DAY)]),
      revenue: revenue(["late", from_cut(12 * DAY), 30], ["late", from_cut(20 * DAY), 30]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("lag-from-cut", fixture.list("reached.txt")));

    expect(record.acquired.revenue?.median_lag_days).toBe(12);
  });
});

// ---------------------------------------------------------------------------------------------
// The emitted record
// ---------------------------------------------------------------------------------------------

describe("the emitted record", () => {
  async function shape_fixture(): Promise<Fixture> {
    return build("record-shape", {
      lead: leads(["fresh", phone(1), from_cut(2 * HOUR)], ["existing", phone(2), from_cut(-DAY)]),
      // Both groups earn after the cut, because the one thing this record must never do is credit
      // the campaign with a customer it already had. With revenue only on the acquired account,
      // accumulating it over the matched accounts instead reads identically and the misattribution
      // is invisible — and it is the most flattering mistake the engine can make.
      revenue: revenue(["fresh", from_cut(3 * HOUR), 12.5], ["existing", from_cut(5 * HOUR), 40]),
      churn: churn(["existing", from_cut(DAY), 3]),
      conversion: conversions(["fresh", from_cut(4 * HOUR), 12.5, "true", "false"]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });
  }

  test("carries every role the source answered, and dates itself", async () => {
    const fixture = await shape_fixture();

    const record = await one(fixture, cold("record-shape", fixture.list("reached.txt")));

    expect(record).toEqual({
      cell: "record-shape",
      cut_utc: CUT,
      measured_utc: NOW.toISOString(),
      window_hours: 720,
      audience: { listed: 2, matched_phones: 2, matched_accounts: 2 },
      acquired: {
        accounts: 1,
        within: { h24: 1, d7: 1, d30: 1 },
        revenue: { leads: 1, value: 12.5, top2_share: null, median_lag_days: 0.1 },
        churn: { leads: 0, value: 0 },
      },
      pre_existing: {
        accounts: 1,
        revenue: { leads: 1, value: 40 },
        churn: { leads: 1, value: 3 },
      },
      conversions: { count: 1, value: 12.5, new_money: 12.5, recycled: 0 },
    });
  });

  test("omits a role the source never answered rather than reporting it as a measured zero", async () => {
    // Unbound and empty are different facts, and a zero for a role a project does not have is
    // a number someone will eventually try to explain.
    const fixture = await build("record-unbound", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      revenue: null,
      churn: null,
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("record-unbound", fixture.list("reached.txt")));

    expect(record.acquired.revenue).toBeUndefined();
    expect(record.acquired.churn).toBeUndefined();
    expect(record.pre_existing.revenue).toBeUndefined();
    expect("revenue" in record.acquired).toBe(false);
    expect("churn" in record.pre_existing).toBe(false);
  });

  test("every outcome the allowlist names resolves to a number on a fully bound record", async () => {
    // An allowlist naming a path the record does not carry would refuse a control for the wrong
    // reason and read as though the outcome were forbidden rather than absent.
    const fixture = await shape_fixture();
    const record = await one(fixture, cold("record-shape", fixture.list("reached.txt")));

    expect([...COUNTABLE_OUTCOMES]).toEqual([
      "acquired.accounts",
      "acquired.revenue.leads",
      "acquired.churn.leads",
      "conversions.count",
    ]);

    for (const path of COUNTABLE_OUTCOMES) {
      let node: unknown = record;
      for (const step of path.split(".")) {
        node = (node as Record<string, unknown>)[step];
      }
      expect(typeof node).toBe("number");
    }
  });

  test("every outcome the allowlist admits is readable by exactly one audience", async () => {
    // The allowlist and the audience rule were two lists once, and they disagreed: three of the
    // seven paths were admitted here and refused there, so no pair could ever be read on them
    // and the second error contradicted the first. This asks the engine rather than the table.
    // A path no audience will read is not permitted, whatever the allowlist says about it.
    //
    // The other half of that sentence is load-bearing elsewhere. The refusal a cold cell paired
    // against an own_base one receives states as a fact that no outcome can be read on both, and
    // it states it rather than intersecting the two lists to find out — a branch for the case
    // where they overlapped would be a message no input could produce. This is the premise that
    // sentence rests on: give a path to both audiences and this fails, pointing at the message
    // that would otherwise have started lying.
    const fixture = await build("outcome-reachable", {
      lead: leads(["fresh", phone(1), from_cut(2 * HOUR)], ["existing", phone(2), from_cut(-DAY)]),
      revenue: revenue(["fresh", from_cut(3 * HOUR), 12.5], ["existing", from_cut(3 * HOUR), 8]),
      churn: churn(["fresh", from_cut(DAY), 3], ["existing", from_cut(DAY), 3]),
      conversion: conversions(["fresh", from_cut(4 * HOUR), 12.5, "true", "false"]),
      lists: { "treated.txt": lines(phone(1)), "untouched.txt": lines(phone(2)) },
    });

    // The audience is a declaration, not something derived from the data, so the same two cells
    // can be offered under either label and the answer is the rule's alone.
    const readable_by = async (outcome: string, audience: Cell["audience"]): Promise<boolean> => {
      try {
        await measure({
          source: files(fixture.dir),
          cells: [
            { name: "treated", cut: CUT, lists: [fixture.list("treated.txt")], audience },
            { name: "untouched", cut: CUT, lists: [fixture.list("untouched.txt")], audience },
          ],
          controls: [{ treated: "treated", control: "untouched", outcome }],
          now: NOW,
        });
        return true;
      } catch (error) {
        if (error instanceof ControlError) {
          return false;
        }
        throw error;
      }
    };

    const unreachable: string[] = [];
    const both: string[] = [];
    for (const outcome of COUNTABLE_OUTCOMES) {
      const cold_reads = await readable_by(outcome, "cold");
      const base_reads = await readable_by(outcome, "own_base");
      if (!cold_reads && !base_reads) {
        unreachable.push(outcome);
      }
      if (cold_reads && base_reads) {
        both.push(outcome);
      }
    }
    expect(unreachable).toEqual([]);
    expect(both).toEqual([]);
  });

  test("reads several cells in one pass and keeps them apart", async () => {
    const fixture = await build("record-two-cells", {
      lead: leads(["a", phone(1), from_cut(HOUR)], ["b", phone(2), from_cut(-DAY)]),
      lists: { "alpha.txt": lines(phone(1)), "beta.txt": lines(phone(2)) },
    });

    const records = await measure({
      source: files(fixture.dir),
      cells: [cold("alpha", fixture.list("alpha.txt")), cold("beta", fixture.list("beta.txt"))],
      now: NOW,
    });

    expect(records.map((record) => record.cell)).toEqual(["alpha", "beta"]);
    expect(records[0]?.acquired.accounts).toBe(1);
    expect(records[1]?.acquired.accounts).toBe(0);
    expect(records[1]?.pre_existing.accounts).toBe(1);
  });

  test("counts a person once in a money role, however many events they generated", async () => {
    // The first account here paid three times and left twice after the cut, so every count taken
    // off it is a count of people rather than of rows. Summed per event instead, this cell reports
    // four acquired payers among two people and two departures among one — and both of those
    // fields are ones a control pair may be read on, so the comparison would divide an event count
    // by listed identifiers and publish it as the share of a list that paid. The arm holding the
    // weekly regulars then wins on nothing but how often its customers transact.
    const fixture = await build("record-repeat-events", {
      lead: leads(
        ["repeat", phone(1), from_cut(HOUR)],
        ["single", phone(2), from_cut(2 * HOUR)],
        ["held", phone(3), from_cut(-DAY)],
      ),
      revenue: revenue(
        ["repeat", from_cut(DAY), 10],
        ["repeat", from_cut(2 * DAY), 20],
        ["repeat", from_cut(3 * DAY), 30],
        ["single", from_cut(4 * DAY), 15],
        ["held", from_cut(DAY), 5],
        ["held", from_cut(2 * DAY), 7],
      ),
      churn: churn(
        ["repeat", from_cut(5 * DAY), 4],
        ["repeat", from_cut(6 * DAY), 6],
        ["held", from_cut(DAY), 1],
        ["held", from_cut(2 * DAY), 2],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2), phone(3)) },
    });

    const record = await one(fixture, cold("record-repeat-events", fixture.list("reached.txt")));

    // Every headcount below is smaller than the number of events behind it, and the sums are what
    // those events add up to: the pair of them is what separates a count of people from a count of
    // rows, which a fixture where everyone transacted once cannot do.
    expect(record.acquired.revenue).toEqual({ leads: 2, value: 75, top2_share: 1, median_lag_days: 2.5 });
    expect(record.acquired.churn).toEqual({ leads: 1, value: 10 });
    expect(record.pre_existing.revenue).toEqual({ leads: 1, value: 12 });
    expect(record.pre_existing.churn).toEqual({ leads: 1, value: 3 });
  });

  test("rounds every money field to the cent, not to a tenth of one", async () => {
    // Each amount below carries a third decimal, which is what makes the digit count visible: on
    // the whole cents every other fixture here uses, two places and three emit the same number. At
    // three this record publishes 10.126 earned and 3.208 lost — a tenth of a cent, in a currency
    // with no such unit — and a reader reconciling the file against the ledger it was drawn from
    // finds every total off by a fraction of the smallest coin it can be paid in.
    const fixture = await build("record-cents", {
      lead: leads(["fresh", phone(1), from_cut(2 * HOUR)], ["existing", phone(2), from_cut(-DAY)]),
      revenue: revenue(["fresh", from_cut(3 * HOUR), 10.126], ["existing", from_cut(5 * HOUR), 20.374]),
      churn: churn(["fresh", from_cut(DAY), 3.208], ["existing", from_cut(DAY), 4.601]),
      // One event either side of the recycled marker, so the two split fields round on their own
      // subtotals rather than out of the total they sit under.
      conversion: conversions(
        ["fresh", from_cut(4 * HOUR), 5.121, "true", "false"],
        ["fresh", from_cut(5 * HOUR), 7.232, "true", "true"],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const record = await one(fixture, cold("record-cents", fixture.list("reached.txt")));

    expect(record.acquired.revenue?.value).toBe(10.13);
    expect(record.pre_existing.revenue?.value).toBe(20.37);
    expect(record.acquired.churn?.value).toBe(3.21);
    expect(record.pre_existing.churn?.value).toBe(4.6);
    expect(record.conversions.value).toBe(12.35);
    expect(record.conversions.new_money).toBe(5.12);
    expect(record.conversions.recycled).toBe(7.23);
  });
});

// ---------------------------------------------------------------------------------------------
// The conversion split
// ---------------------------------------------------------------------------------------------

describe("the conversion split", () => {
  const two_conversions = conversions(
    ["one", from_cut(HOUR), 60, "true", "false"],
    ["one", from_cut(2 * HOUR), 40, "true", "true"],
  );

  test("divides committed money where the source answers the recycled predicate", async () => {
    const fixture = await build("split-declared", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      conversion: two_conversions,
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("split-declared", fixture.list("reached.txt")));

    expect(record.conversions).toEqual({ count: 2, value: 100, new_money: 60, recycled: 40 });
  });

  test("refuses a recycled cell that is neither true nor false, rather than picking a side for it", async () => {
    // `recycled` is a predicate the source answers, and a blank is a source that did not answer.
    // Both readings of it are wrong and both are silent. Read as false, money the business already
    // held is published as money the campaign brought in; read as true, the report says the
    // campaign brought in nothing new, which reads as a cell worth switching off. The column is
    // one word in a query, so an unanswered row is a fault to be fixed there rather than a
    // default this package gets to choose.
    const fixture = await build("split-blank-cell", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      conversion: conversions(["one", from_cut(HOUR), 50, "true", ""]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("split-blank-cell", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportFlagError);
    expect((error as ExportFlagError).column).toBe("recycled");
    expect((error as ExportFlagError).raw).toBe("");
    // The empty arm of the message. A blank and a wrong value are different jobs at the source,
    // and the sentence has to say which one this row is.
    expect(error.message).toContain("an unanswered question is not an answer of no");
  });

  test("and counts an answered false as new money, which is the side that row belongs on", async () => {
    // The other half of the refusal above: answered, and answered `false`, the payment is money
    // the business did not already have. This is the reading the blank was ambiguous between.
    const fixture = await build("split-answered-false", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      conversion: conversions(["one", from_cut(HOUR), 50, "true", "false"]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("split-answered-false", fixture.list("reached.txt")));

    expect(record.conversions).toEqual({ count: 1, value: 50, new_money: 50, recycled: 0 });
  });

  test("omits the split fields entirely where the source answers no recycled column", async () => {
    // A recycled balance is a property of one kind of product. Requiring every project to answer
    // the question produced two fields of zeros wherever the concept does not exist, and a zero
    // that looks like a measurement is the expensive failure here. An absent column says the
    // question does not apply; a column of `false` says it was asked and answered.
    const fixture = await build("split-absent", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      conversion: conversions_unsplit(["one", from_cut(HOUR), 60, "true"], ["one", from_cut(2 * HOUR), 40, "true"]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("split-absent", fixture.list("reached.txt")));

    expect(record.conversions).toEqual({ count: 2, value: 100 });
    expect("new_money" in record.conversions).toBe(false);
    expect("recycled" in record.conversions).toBe(false);
  });

  test("falls back to a second timestamp column where the source answers one", async () => {
    // The commitment timestamp is nullable on this role, and empty is what unset looks like in
    // an export. Without the fallback the event drops out and the cell loses a conversion.
    const fixture = await build("split-fallback", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      conversion: csv(
        ["lead", "at", "at_fallback", "amount", "committed", "recycled"],
        [["one", "", from_cut(2 * HOUR), 30, "true", "false"]],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("split-fallback", fixture.list("reached.txt")));

    expect(record.conversions.count).toBe(1);
    expect(record.conversions.value).toBe(30);
  });

  test("but only where the primary is empty: with both columns filled the primary dates the event", async () => {
    // The case above leaves the primary blank, so it says the fallback is read and nothing about
    // which of the two wins when both hold an instant — and where a fallback is bound at all, both
    // filled is the ordinary row rather than the exception. The two instants here straddle the cut
    // by two hours each way, which is the only way the precedence is observable from the record:
    // read in the declared order the commitment falls after the cut and is counted, and read the
    // other way round it falls before and the cell reports a conversion it really has as none.
    const fixture = await build("split-fallback-precedence", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      conversion: csv(
        ["lead", "at", "at_fallback", "amount", "committed", "recycled"],
        [["one", from_cut(2 * HOUR), from_cut(-2 * HOUR), 30, "true", "false"]],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("split-fallback-precedence", fixture.list("reached.txt")));

    expect(record.conversions.count).toBe(1);
    expect(record.conversions.value).toBe(30);
  });
});

// ---------------------------------------------------------------------------------------------
// Provisional cuts
// ---------------------------------------------------------------------------------------------

describe("a provisional cut", () => {
  /**
   * Two lists of forty people who all held accounts long before the cut, thirty of one and
   * twelve of the other committing after it. Nobody can arrive, which is the point: `acquired
   * .accounts` is zero on both sides by construction, and the sizes are what make the resulting
   * comparison significant with a control past the minimum events — so the reading these cells
   * produce is one somebody would publish.
   */
  async function own_base_pair(name: string): Promise<Fixture> {
    const lead_rows: Row[] = [];
    const conversion_rows: Row[] = [];
    const treated_list: string[] = [];
    const control_list: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      treated_list.push(phone(100 + i));
      control_list.push(phone(200 + i));
      lead_rows.push([`t${i}`, phone(100 + i), from_cut(-DAY)]);
      lead_rows.push([`c${i}`, phone(200 + i), from_cut(-DAY)]);
      if (i < 30) {
        conversion_rows.push([`t${i}`, from_cut(HOUR), 10, "true", "false"]);
      }
      if (i < 12) {
        conversion_rows.push([`c${i}`, from_cut(HOUR), 10, "true", "false"]);
      }
    }
    return build(name, {
      lead: leads(...lead_rows),
      conversion: conversions(...conversion_rows),
      lists: { "treated.txt": lines(...treated_list), "untouched.txt": lines(...control_list) },
    });
  }

  test("measures normally while nobody has arrived, and says so on the record", async () => {
    const fixture = await build("provisional-quiet", {
      lead: leads(["old", phone(1), from_cut(-DAY)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(
      fixture,
      cold("provisional-quiet", fixture.list("reached.txt"), { cut_provisional: true }),
    );

    expect(record.acquired.accounts).toBe(0);
    expect(record.pre_existing.accounts).toBe(1);
    // The warning travels with the record, so a reader two weeks later sees it in the JSON
    // rather than having to remember which cells were placeholders.
    expect(record.cut_provisional).toBe(true);
  });

  test("and does the same where no money role is answered at all", async () => {
    // The scan reads six counts off the record and four of them are branches a project without
    // revenue or churn never emits. Read as anything but nothing to attribute, every provisional
    // cell such a project declares is refused, and the refusal names a role the source never
    // answered — sending the reader to find a revenue figure in a report that has no revenue in it.
    const fixture = await build("provisional-quiet-unbound", {
      revenue: null,
      churn: null,
      lead: leads(["old", phone(1), from_cut(-DAY)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(
      fixture,
      cold("provisional-quiet-unbound", fixture.list("reached.txt"), { cut_provisional: true }),
    );

    expect(record.acquired.revenue).toBeUndefined();
    expect(record.pre_existing.churn).toBeUndefined();
    expect(record.acquired.accounts).toBe(0);
    expect(record.cut_provisional).toBe(true);
  });

  test("refuses once anybody has arrived, and names the cell and the count", async () => {
    // A placeholder cut is not a moment of contact, so arrivals after it cannot be attributed
    // to anything. This is the documented way a report once claimed arrivals that never
    // happened, and it is the reason the flag exists at all.
    const fixture = await build("provisional-arrivals", {
      lead: leads(
        ["old", phone(1), from_cut(-DAY)],
        ["new-a", phone(2), from_cut(HOUR)],
        ["new-b", phone(3), from_cut(2 * HOUR)],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2), phone(3)) },
    });

    const error = await caught(one(fixture, cold("guessed", fixture.list("reached.txt"), { cut_provisional: true })));

    expect(error).toBeInstanceOf(ProvisionalCutError);
    expect(error.message).toContain("guessed");
    expect(error.message).toContain("acquired.accounts 2");
    expect((error as ProvisionalCutError).cells).toEqual([
      { cell: "guessed", counted: [{ outcome: "acquired.accounts", count: 2 }] },
    ]);
  });

  test("refuses before any control is read", async () => {
    // The pair would otherwise be computed against a number the engine is about to refuse, and
    // a ControlError here would send the reader after the wrong problem. The pair names a control
    // cell nobody declared, so the control loop has a fault of its own to raise and the ordering
    // is what decides which one arrives: a valid pair here would leave the two checks free to
    // swap places with nothing to show for it.
    const fixture = await build("provisional-control", {
      lead: leads(["new", phone(1), from_cut(HOUR)]),
      lists: { "treated.txt": lines(phone(1)) },
    });

    const error = await caught(
      measure({
        source: files(fixture.dir),
        cells: [cold("treated", fixture.list("treated.txt"), { cut_provisional: true })],
        controls: [{ treated: "treated", control: "untouched", outcome: "acquired.accounts" }],
        now: NOW,
      }),
    );

    expect(error).toBeInstanceOf(ProvisionalCutError);
  });

  test("refuses an own_base cell whose commitments were counted from a guessed cut", async () => {
    // The case the guard was blind to for a release, and the one that matters most. An own_base
    // cell is by construction one whose matched accounts all predate the cut, so `acquired
    // .accounts` on it is always zero and a guard reading only arrivals can never fire on it —
    // while `conversions.count`, the single outcome such a cell is ever read on, is accumulated
    // forward from the same guessed cut. The companion case below is what that used to publish.
    const fixture = await own_base_pair("provisional-own-base");

    const error = await caught(
      measure({
        source: files(fixture.dir),
        cells: [
          base("guessed", fixture.list("treated.txt"), { cut_provisional: true }),
          base("untouched", fixture.list("untouched.txt")),
        ],
        controls: [{ treated: "guessed", control: "untouched", outcome: "conversions.count" }],
        now: NOW,
      }),
    );

    expect(error).toBeInstanceOf(ProvisionalCutError);
    expect(error.message).toContain("guessed");
    // Naming the outcome, not merely the cell: a reader told only that "guessed" was refused has
    // to go and work out which of its numbers came from the placeholder.
    expect(error.message).toContain("conversions.count 30");
    expect((error as ProvisionalCutError).cells).toEqual([
      { cell: "guessed", counted: [{ outcome: "conversions.count", count: 30 }] },
    ]);
  });

  test("would otherwise publish that comparison, which is what the refusal is worth", async () => {
    // The same run with the placeholder flag dropped. Every gate is open — significant, a control
    // well past the minimum events, a window well past the floor — so the reading comes back
    // `publishable: true`. That is the number the case above was emitting beside a record that
    // also carried `cut_provisional: true`: a publishable figure computed from a date somebody
    // wrote down while waiting for the real one.
    const fixture = await own_base_pair("provisional-own-base-stake");

    const [treated] = await measure({
      source: files(fixture.dir),
      cells: [base("confirmed", fixture.list("treated.txt")), base("untouched", fixture.list("untouched.txt"))],
      controls: [{ treated: "confirmed", control: "untouched", outcome: "conversions.count" }],
      now: NOW,
    });

    expect(treated?.control?.control_events).toBe(12);
    expect(treated?.control?.publishable).toBe(true);
  });

  test("refuses on money counted forward from the guess even where nobody committed", async () => {
    // `pre_existing.revenue.leads` counts people who were already there and then paid after the
    // cut. Nothing arrived and nothing was committed, so neither of the two obvious counts is
    // non-zero, and the payment is still dated against a guess. A guard that stopped at arrivals
    // and commitments would let this one through.
    const fixture = await build("provisional-money", {
      lead: leads(["old", phone(1), from_cut(-DAY)]),
      revenue: revenue(["old", from_cut(2 * HOUR), 40]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("guessed", fixture.list("reached.txt"), { cut_provisional: true })));

    expect(error).toBeInstanceOf(ProvisionalCutError);
    expect(error.message).toContain("pre_existing.revenue.leads 1");
  });

  test("still measures an own_base cell with a guessed cut and nothing counted against it", async () => {
    // The widened guard must not swallow the case the flag exists to allow. `pre_existing
    // .accounts` is non-zero on every own_base cell by construction — it is the audience, not an
    // outcome — so reading it as something to attribute would refuse every provisional cut ever
    // declared on a base and leave the flag with no legal use at all.
    const fixture = await build("provisional-own-base-quiet", {
      lead: leads(["old", phone(1), from_cut(-DAY)]),
      conversion: conversions(["old", from_cut(-HOUR), 50, "true", "false"]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, base("quiet-base", fixture.list("reached.txt"), { cut_provisional: true }));

    expect(record.pre_existing.accounts).toBe(1);
    expect(record.conversions.count).toBe(0);
    expect(record.cut_provisional).toBe(true);
  });

  test("leaves the key off a cell whose cut is confirmed", async () => {
    const fixture = await build("provisional-absent", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("provisional-absent", fixture.list("reached.txt")));

    expect("cut_provisional" in record).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------------------------

describe("a control pair", () => {
  /**
   * Forty listed phones a side, twenty-eight arrivals against eighteen. The sizes are what make
   * the comparison significant with a control large enough to be worth reading, which is what a
   * test of the publishability gate needs in order to isolate the one condition it is about. The
   * control's arrivals are a parameter so a case about the minimum-events threshold can sit on it
   * without a second fixture builder saying the same thing with one number changed.
   */
  async function pair(name: string, control_arrivals = 18): Promise<Fixture> {
    const lead_rows: Row[] = [];
    const treated_list: string[] = [];
    const control_list: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      const treated = phone(100 + i);
      const control = phone(200 + i);
      treated_list.push(treated);
      control_list.push(control);
      lead_rows.push([`t${i}`, treated, from_cut(i < 28 ? HOUR : -DAY)]);
      lead_rows.push([`c${i}`, control, from_cut(i < control_arrivals ? HOUR : -DAY)]);
    }
    return build(name, {
      lead: leads(...lead_rows),
      lists: { "treated.txt": lines(...treated_list), "untouched.txt": lines(...control_list) },
    });
  }

  async function read(fixture: Fixture, now: Date): Promise<CellRecord[]> {
    return measure({
      source: files(fixture.dir),
      cells: [cold("treated", fixture.list("treated.txt")), cold("untouched", fixture.list("untouched.txt"))],
      controls: [{ treated: "treated", control: "untouched", outcome: "acquired.accounts" }],
      now,
    });
  }

  test("attaches the reading to the treated cell only", async () => {
    const fixture = await pair("control-attach");

    const [treated, untouched] = await read(fixture, new Date(CUT_MS + 200 * HOUR));

    expect(treated?.control).toEqual({
      against: "untouched",
      outcome: "acquired.accounts",
      treated_rate: 70,
      control_rate: 45,
      lift: 1.56,
      control_events: 18,
      p: 0.024,
      publishable: true,
    });
    expect(untouched?.control).toBeUndefined();
  });

  test("is not publishable inside the window floor, however significant it looks", async () => {
    // Every other gate is open here: the difference clears significance and the control carries
    // more than the minimum events. Only the window is short, and that alone has to be enough.
    const fixture = await pair("control-floor");

    const [treated] = await read(fixture, new Date(CUT_MS + 100 * HOUR));
    const reading = treated?.control;

    expect(treated?.window_hours).toBe(100);
    expect(treated?.window_hours).toBeLessThan(WINDOW_FLOOR_HOURS);
    expect(reading?.p).not.toBeNull();
    expect(reading?.p as number).toBeLessThan(MAX_P);
    expect(reading?.control_events).toBeGreaterThanOrEqual(MIN_CONTROL_EVENTS);
    expect(reading?.publishable).toBe(false);
  });

  test("becomes publishable once the window clears the floor, on the same numbers", async () => {
    const fixture = await pair("control-floor-clear");

    const [treated] = await read(fixture, new Date(CUT_MS + 200 * HOUR));

    expect(treated?.window_hours).toBeGreaterThanOrEqual(WINDOW_FLOOR_HOURS);
    expect(treated?.control?.p).toBe(0.024);
    expect(treated?.control?.publishable).toBe(true);
  });

  test("reads a base that already holds accounts on commitment, and reports a null lift against nothing", async () => {
    const fixture = await build("control-own-base", {
      lead: leads(
        ["t1", phone(1), from_cut(-DAY)],
        ["t2", phone(2), from_cut(-DAY)],
        ["c1", phone(3), from_cut(-DAY)],
        ["c2", phone(4), from_cut(-DAY)],
      ),
      conversion: conversions(["t1", from_cut(HOUR), 10, "true", "false"], ["t2", from_cut(HOUR), 20, "true", "false"]),
      lists: { "treated.txt": lines(phone(1), phone(2)), "untouched.txt": lines(phone(3), phone(4)) },
    });

    const [treated] = await measure({
      source: files(fixture.dir),
      cells: [
        { name: "treated", cut: CUT, lists: [fixture.list("treated.txt")], audience: "own_base" },
        { name: "untouched", cut: CUT, lists: [fixture.list("untouched.txt")], audience: "own_base" },
      ],
      controls: [{ treated: "treated", control: "untouched", outcome: "conversions.count" }],
      now: NOW,
    });

    expect(treated?.control?.control_events).toBe(0);
    // A ratio against zero is an infinity, and an infinity in a published table is a bug wearing
    // a number's clothes.
    expect(treated?.control?.lift).toBeNull();
    // Two events on the control side is not a comparison, whatever the p-value says.
    expect(treated?.control?.publishable).toBe(false);
  });

  test("publishes a window standing exactly on the floor, and refuses one hour short of it", async () => {
    // The floor is `at or above`. Every other gate is open on both readings and only the reading
    // time moves, so the pair of them says where the boundary is rather than that a floor exists:
    // a floor moved one hour in either direction changes one of these two answers.
    const fixture = await pair("control-floor-boundary");

    const [at_the_floor] = await read(fixture, new Date(CUT_MS + WINDOW_FLOOR_HOURS * HOUR));
    expect(at_the_floor?.window_hours).toBe(WINDOW_FLOOR_HOURS);
    expect(at_the_floor?.control?.publishable).toBe(true);

    const [one_hour_short] = await read(fixture, new Date(CUT_MS + (WINDOW_FLOOR_HOURS - 1) * HOUR));
    expect(one_hour_short?.window_hours).toBe(WINDOW_FLOOR_HOURS - 1);
    expect(one_hour_short?.control?.p).toBe(0.024);
    expect(one_hour_short?.control?.publishable).toBe(false);
  });

  test("reads a part-hour window down to the hour it has finished, not up to the one it has not", async () => {
    // Half an hour short of the floor. Rounded up rather than truncated the window reads as 168
    // and the reading publishes, so a comparison thirty minutes inside the floor goes out under a
    // gate that was written to keep it in — and no other fixture can see it, because every one of
    // them reads at a whole number of hours past the cut where the two agree.
    const fixture = await pair("control-window-part-hour");

    const [treated] = await read(fixture, new Date(CUT_MS + WINDOW_FLOOR_HOURS * HOUR - HOUR / 2));

    expect(treated?.window_hours).toBe(WINDOW_FLOOR_HOURS - 1);
    expect(treated?.control?.publishable).toBe(false);
  });

  test("publishes a control carrying exactly the minimum events, and refuses one short of it", async () => {
    // The same boundary on the other threshold, and the same shape of proof. Both readings clear
    // significance and both windows are well past the floor, so the only thing separating them is
    // the one arrival, and the answer says which side of the minimum is inside it.
    const at_the_minimum = await pair("control-events-boundary", MIN_CONTROL_EVENTS);
    const [enough] = await read(at_the_minimum, new Date(CUT_MS + 200 * HOUR));
    expect(enough?.control?.control_events).toBe(MIN_CONTROL_EVENTS);
    expect(enough?.control?.p as number).toBeLessThan(MAX_P);
    expect(enough?.control?.publishable).toBe(true);

    const one_short = await pair("control-events-short", MIN_CONTROL_EVENTS - 1);
    const [thin] = await read(one_short, new Date(CUT_MS + 200 * HOUR));
    expect(thin?.control?.control_events).toBe(MIN_CONTROL_EVENTS - 1);
    // Still significant. The refusal is about how few events the control carries, not about the
    // comparison having failed to clear p, and a test where both moved would not say which.
    expect(thin?.control?.p as number).toBeLessThan(MAX_P);
    expect(thin?.control?.publishable).toBe(false);
  });

  test("takes the window off the treated cell, not off a control cut twenty days earlier", async () => {
    // The two arms were cut twenty days apart — a control drawn from a send that went out first —
    // so the control's window is 580 hours while the treated reading is 100 hours old. Gated on
    // the control's window this publishes four days after contact, backdating the floor to a
    // moment the treated cell was never measured from and clearing it on time the treated cell
    // never had. The floor outranks the p-value, and this is how it gets bypassed with the
    // p-value left intact.
    const lead_rows: Row[] = [];
    const treated_list: string[] = [];
    const control_list: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      treated_list.push(phone(100 + i));
      control_list.push(phone(200 + i));
      lead_rows.push([`t${i}`, phone(100 + i), from_cut(i < 28 ? HOUR : -DAY)]);
      // Dated against the control's own cut rather than the treated one, so eighteen of them
      // arrived after it and the pair carries the same counts every other case here reads.
      lead_rows.push([`c${i}`, phone(200 + i), from_cut(i < 18 ? -20 * DAY + HOUR : -25 * DAY)]);
    }
    const fixture = await build("control-split-cuts", {
      lead: leads(...lead_rows),
      lists: { "treated.txt": lines(...treated_list), "untouched.txt": lines(...control_list) },
    });

    const [treated, untouched] = await measure({
      source: files(fixture.dir),
      cells: [
        cold("treated", fixture.list("treated.txt")),
        cold("untouched", fixture.list("untouched.txt"), { cut: from_cut(-20 * DAY) }),
      ],
      controls: [{ treated: "treated", control: "untouched", outcome: "acquired.accounts" }],
      now: new Date(CUT_MS + 100 * HOUR),
    });

    expect(treated?.window_hours).toBe(100);
    expect(untouched?.window_hours).toBe(580);
    // Significance and the control's event count are both wide open, so the window is the only
    // thing left that can decide this reading.
    expect(treated?.control?.p).toBe(0.024);
    expect(treated?.control?.control_events).toBe(18);
    expect(treated?.control?.publishable).toBe(false);
  });

  test("takes both rates over the identifiers each cell listed, not over the accounts it matched", async () => {
    // The three numbers `audience` reports are all different here, on both sides, and a fixture
    // like this one is the only place the denominator can be seen: every other pair in this
    // describe lists phones that each match one account, so `listed`, `matched_phones` and
    // `matched_accounts` are one number and any of the three reads correctly.
    //
    // Listed is the sample the send was drawn on. A number that matched nothing is a number this
    // cell reached and got nothing back from, which is a miss and belongs in the denominator. Read
    // over matched accounts the treated arm publishes 77.419% instead of 60%, a rate that climbs
    // whenever the lead role happens to hold a second account for someone; read over the
    // control's matched phones the pair reports 37.5% against 30%, which moves p from 0.007 to
    // 0.058 and holds back a reading that was publishable, on sends that did not change.
    const lead_rows: Row[] = [];
    const treated_list: string[] = [];
    const control_list: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      treated_list.push(phone(300 + i));
      control_list.push(phone(400 + i));
      // Thirty of the forty treated numbers are in the lead role, twenty-four of them arriving
      // after the cut; thirty-two of the forty control numbers, twelve arriving after it.
      if (i < 30) {
        lead_rows.push([`t${i}`, phone(300 + i), from_cut(i < 24 ? HOUR : -DAY)]);
      }
      if (i < 32) {
        lead_rows.push([`c${i}`, phone(400 + i), from_cut(i < 12 ? HOUR : -DAY)]);
      }
    }
    // One matched phone a side answers for a second account, which is what separates
    // `matched_accounts` from `matched_phones`. Both predate the cut, so the arrivals stay where
    // the loop above put them and only the denominators under test move.
    lead_rows.push(["t-second", phone(300), from_cut(-DAY)], ["c-second", phone(400), from_cut(-DAY)]);

    const fixture = await build("control-listed-denominator", {
      lead: leads(...lead_rows),
      lists: { "treated.txt": lines(...treated_list), "untouched.txt": lines(...control_list) },
    });

    const [treated, untouched] = await read(fixture, new Date(CUT_MS + 200 * HOUR));

    expect(treated?.audience).toEqual({ listed: 40, matched_phones: 30, matched_accounts: 31 });
    expect(untouched?.audience).toEqual({ listed: 40, matched_phones: 32, matched_accounts: 33 });
    expect(treated?.acquired.accounts).toBe(24);
    expect(untouched?.acquired.accounts).toBe(12);
    expect(treated?.control).toEqual({
      against: "untouched",
      outcome: "acquired.accounts",
      treated_rate: 60,
      control_rate: 30,
      lift: 2,
      control_events: 12,
      p: 0.007,
      publishable: true,
    });
  });

  test("rounds both rates to three places, the precision the reading is published at", async () => {
    // Seventy listed a side, so neither rate terminates: 40 of 70 is 57.142857… and 15 of 70 is
    // 21.428571…. Every other pair here lists forty and lands on a whole number of percent, where
    // two places and three print the same thing. At two this same reading publishes 57.14 against
    // 21.43, so a rate copied out of an earlier run stops matching the run that produced it and
    // two passes over identical counts disagree in the last digit they print.
    const lead_rows: Row[] = [];
    const treated_list: string[] = [];
    const control_list: string[] = [];
    for (let i = 0; i < 70; i += 1) {
      treated_list.push(phone(500 + i));
      control_list.push(phone(600 + i));
      lead_rows.push([`t${i}`, phone(500 + i), from_cut(i < 40 ? HOUR : -DAY)]);
      lead_rows.push([`c${i}`, phone(600 + i), from_cut(i < 15 ? HOUR : -DAY)]);
    }
    const fixture = await build("control-rate-precision", {
      lead: leads(...lead_rows),
      lists: { "treated.txt": lines(...treated_list), "untouched.txt": lines(...control_list) },
    });

    const [treated, untouched] = await read(fixture, new Date(CUT_MS + 200 * HOUR));

    expect(treated?.audience.listed).toBe(70);
    expect(untouched?.audience.listed).toBe(70);
    expect(treated?.acquired.accounts).toBe(40);
    expect(untouched?.acquired.accounts).toBe(15);
    expect(treated?.control?.treated_rate).toBe(57.143);
    expect(treated?.control?.control_rate).toBe(21.429);
  });
});

// ---------------------------------------------------------------------------------------------
// The publishability gate
// ---------------------------------------------------------------------------------------------

/**
 * The two cases above ask the gate through `measure`, which is what proves it is wired to the
 * numbers the record carries. They cannot ask it about the p-value: p comes out of a z-test over
 * integer counts, and no arrangement of those counts lands a double exactly on `MAX_P`, so
 * whether that comparison is `<` or `<=` is invisible from the outside. `is_publishable` is
 * exported so the question can be asked at all, and these are the cases that ask it.
 */
describe("the publishability gate", () => {
  test("holds its three thresholds at the values they were chosen for", () => {
    // Pinned by value once, here, and read as constants everywhere else. Referencing the exports
    // is right — a literal repeated through twenty assertions pins the literal in twenty places
    // and the constant in none — but it leaves the constants themselves free to move under a
    // suite that stays green, which is what a mutation pass found. So the numbers are stated in
    // one place, with what each one is for beside it.
    //
    // Seven days, because that is longer than the tail of any response this engine has been
    // pointed at: a window inside it has not finished collecting the thing it is measuring.
    expect(WINDOW_FLOOR_HOURS).toBe(168);
    // Ten events, because below that a single outlier in the control flips the sign of the
    // comparison.
    expect(MIN_CONTROL_EVENTS).toBe(10);
    // The conventional two-sided significance threshold.
    expect(MAX_P).toBe(0.05);
  });

  test("refuses a p-value sitting exactly on the threshold, and admits the value below it", () => {
    // `<`, not `<=`: a reading exactly on 0.05 has not cleared 0.05. The other two gates are open
    // in both calls, so the p is the only thing being asked about.
    expect(is_publishable(MAX_P, MIN_CONTROL_EVENTS, WINDOW_FLOOR_HOURS)).toBe(false);

    const just_below = MAX_P - Number.EPSILON;
    expect(just_below).toBeLessThan(MAX_P);
    expect(is_publishable(just_below, MIN_CONTROL_EVENTS, WINDOW_FLOOR_HOURS)).toBe(true);
  });

  test("admits a control carrying exactly the minimum events, and refuses the count below it", () => {
    expect(is_publishable(0.01, MIN_CONTROL_EVENTS, WINDOW_FLOOR_HOURS)).toBe(true);
    expect(is_publishable(0.01, MIN_CONTROL_EVENTS - 1, WINDOW_FLOOR_HOURS)).toBe(false);
  });

  test("admits a window standing exactly on the floor, and refuses the hour below it", () => {
    expect(is_publishable(0.01, MIN_CONTROL_EVENTS, WINDOW_FLOOR_HOURS)).toBe(true);
    expect(is_publishable(0.01, MIN_CONTROL_EVENTS, WINDOW_FLOOR_HOURS - 1)).toBe(false);
  });

  test("refuses a comparison the test had nothing to say about, however wide the other two are", () => {
    // A null p is not a p that failed to clear the threshold; it is a test that was never able to
    // run — an empty denominator, or two groups that were all-or-nothing. Reading it as anything
    // but unpublishable would publish a comparison nobody made.
    expect(is_publishable(null, MIN_CONTROL_EVENTS * 100, WINDOW_FLOOR_HOURS * 100)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------------------------

describe("the run refuses what it cannot measure", () => {
  test("a base written entirely in national form, which names no market to read it in", async () => {
    // The market a bare national number belongs to is inferred from the numbers in the base that
    // carry a calling code, and here none of them does. Guessing one would key the whole base
    // under a plan it was never written in, which does not fail loudly: the keys are well-formed
    // and match nothing, so the run reports an audience that never registered.
    const fixture = await build("refuse-no-market", {
      lead: leads(["one", national(1), from_cut(HOUR)], ["two", national(2), from_cut(HOUR)]),
      lists: { "reached.txt": lines(national(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-no-market", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(PhoneFormatError);
    expect(error.message).toMatch(/calling code/i);
  });

  test("and a base split evenly between two markets, where picking the larger half is a guess", async () => {
    // Half a base keyed under the wrong plan is the same silent zero as all of it, and the two
    // shares are what the message has to carry: a genuinely two-country base and a mislabelled
    // column read alike from here, and only whoever drew the export can tell them apart.
    const fixture = await build("refuse-split-market", {
      lead: leads(["one", phone(1), from_cut(HOUR)], ["two", foreign(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-split-market", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(PhoneFormatError);
    expect(error.message).toMatch(/no market dominates/i);
    expect(error.message).toContain("BR 50.0%");
  });

  test("a single exported timestamp that cannot be read as a moment", async () => {
    // Not the column-wide check: the other rows are fine and this one value is not. It stops the
    // run rather than resolving to null, because a null instant is skipped by the accumulator and
    // the event would quietly leave the group it belongs to.
    const fixture = await build("refuse-timestamp", {
      lead: leads(["one", phone(1), from_cut(-DAY)], ["two", phone(2), from_cut(-DAY)]),
      revenue: revenue(["one", from_cut(HOUR), 40], ["two", "last tuesday", 60]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const error = await caught(one(fixture, cold("refuse-timestamp", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(TimestampError);
    expect((error as TimestampError).value).toBe("last tuesday");
  });

  test("a required role the source has no file for", async () => {
    // The lead role is the index every other role joins against, so a source that cannot answer
    // it has nothing for a cell to be about. Read as an absence instead, every cell matches
    // nobody and the run publishes a campaign that reached an audience it never looked for.
    const fixture = await build("refuse-missing-lead", {
      lead: null,
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-missing-lead", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(SourceError);
    expect((error as SourceError).role).toBe("lead");
    // The path it looked at, because a directory source names its files by role and the reader
    // needs to know which name was expected.
    expect(error.message).toContain("lead.csv");
  });

  test("and the conversion role, which is the other half of what a campaign is measured on", async () => {
    // Revenue and churn are optional: a product may collect neither, and an unanswered one is
    // reported as unbound rather than as zero. These two are not optional, and the asymmetry has
    // to be visible from outside — an absent conversion file read as an absence is a campaign
    // nobody committed to, which is the reading this engine spends everything to avoid.
    const fixture = await build("refuse-missing-conversion", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      conversion: null,
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-missing-conversion", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(SourceError);
    expect((error as SourceError).role).toBe("conversion");
    expect(error.message).toContain("conversion.csv");
  });

  test("a list file the cell names and nobody produced", async () => {
    const fixture = await build("refuse-missing-list", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
    });

    const error = await caught(one(fixture, cold("refuse-missing-list", fixture.list("never-written.txt"))));

    expect(error).toBeInstanceOf(MissingExportError);
    expect(error.message).toContain("never-written.txt");
    expect(error.message).toContain("refuse-missing-list");
  });

  test("a list in a format it will not guess at", async () => {
    const fixture = await build("refuse-format", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      lists: { "roster.json": `["${phone(1)}"]\n` },
    });

    const error = await caught(one(fixture, cold("refuse-format", fixture.list("roster.json"))));

    expect(error).toBeInstanceOf(UnsupportedListFormatError);
    expect(error.message).toContain(".json");
  });

  test("a contract column the role's rows do not carry", async () => {
    // A timestamp column renamed under the query that aliases it reads as empty on every row,
    // which places every account in neither group and reports a cell that arrived at nothing.
    const fixture = await build("refuse-column-lead", {
      lead: csv(["id", "phone", "joined_at"], [["one", phone(1), from_cut(HOUR)]]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-column-lead", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportColumnError);
    expect((error as ExportColumnError).role).toBe("lead");
    expect((error as ExportColumnError).column).toBe("created_at");
    // The header as it actually reads, so the reader can see the rename without opening the file.
    expect(error.message).toContain("joined_at");
  });

  test("a bound column missing from a money role's header too", async () => {
    const fixture = await build("refuse-column-revenue", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      revenue: csv(["lead", "at", "value"], [["one", from_cut(HOUR), 10]]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-column-revenue", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportColumnError);
    expect((error as ExportColumnError).role).toBe("revenue");
    expect((error as ExportColumnError).column).toBe("amount");
  });

  test("a bound timestamp column that is in the header and blank on every row", async () => {
    // The header check catches a column that was renamed away. It does not catch the empty one a
    // rename usually leaves behind, and that reads identically downstream: every account parses
    // to no instant, falls in neither group, and the cell reports an audience that arrived at
    // nothing and was already there for nothing.
    const fixture = await build("refuse-blank-lead", {
      lead: leads(["one", phone(1), ""], ["two", phone(2), ""]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const error = await caught(one(fixture, cold("refuse-blank-lead", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportBlankColumnError);
    expect((error as ExportBlankColumnError).path).toBe("lead");
    expect((error as ExportBlankColumnError).role).toBe("lead");
    expect((error as ExportBlankColumnError).columns).toEqual(["created_at"]);
    expect(error.message).toContain("2 rows");
    // The kind, not just the column. Three of the four throw sites once inherited this word from a
    // default that no test read, so flipping the default made this message say the lead role binds
    // its creation time "for its phone number" and the suite stayed green.
    expect(error.message).toContain('"created_at" for its timestamp');
    expect(error.message).toContain("falls out of the accumulator");
  });

  test("a bound timestamp column blank on every row of a money role too", async () => {
    // Here the silence is total: the amounts are real and readable, so nothing else objects, and
    // every event is dropped for want of a time to place it against the cut.
    const fixture = await build("refuse-blank-revenue", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      revenue: revenue(["one", "", 10], ["one", "", 20]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-blank-revenue", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportBlankColumnError);
    expect((error as ExportBlankColumnError).role).toBe("revenue");
    expect((error as ExportBlankColumnError).columns).toEqual(["at"]);
  });

  test("names both timestamp columns where the source answered a fallback, since either would do", async () => {
    const fixture = await build("refuse-blank-conversion", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      conversion: csv(
        ["lead", "at", "at_fallback", "amount", "committed", "recycled"],
        [["one", "", "", 30, "true", "false"]],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-blank-conversion", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportBlankColumnError);
    expect((error as ExportBlankColumnError).columns).toEqual(["at", "at_fallback"]);
  });

  test("but not a role whose export has no rows at all, because that is a fact", async () => {
    // The distinction the check turns on. An empty export is a role that saw no activity in the
    // window somebody queried, and refusing it would make every quiet month unmeasurable. A full
    // file of blanks is a fault. Both produce zeros, and only one of them is a result.
    const fixture = await build("blank-empty-is-legal", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      revenue: revenue(),
      churn: churn(),
      conversion: conversions(),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("blank-empty-is-legal", fixture.list("reached.txt")));

    expect(record.acquired.accounts).toBe(1);
    expect(record.acquired.revenue).toEqual({ leads: 0, value: 0, top2_share: null, median_lag_days: null });
    expect(record.conversions.count).toBe(0);
  });

  test("an amount column holding something that is not a number", async () => {
    const fixture = await build("refuse-amount", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      revenue: revenue(["one", from_cut(HOUR), "twelve"]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-amount", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportValueError);
    expect(error.message).toContain("twelve");
    expect(error.message).toContain("amount");
  });

  test("an amount column left empty on a row, which is not an amount of zero", async () => {
    // The other arm of the same error, and the whole of it now. This class used to name a third
    // case — the column absent from the file — which no input could produce: every bound column is
    // asserted against the header before a row is indexed, and a short row's missing columns come
    // back as empty strings rather than absent ones, so an absent value and a blank one are the
    // same string by the time an amount is read. An absent column is `ExportColumnError`, two
    // cases above.
    const fixture = await build("refuse-amount-blank", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      revenue: revenue(["one", from_cut(HOUR), ""]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-amount-blank", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportValueError);
    // Which of the two happened, because filling the row at the source and fixing a decimal comma
    // are different jobs.
    expect(error.message).toContain("is empty on one row");
    expect(error.message).toContain("amount");
  });

  test("an amount column holding only spaces, which Number reads as a finite zero", async () => {
    // The blank case above spells the absence as nothing at all; an export that pads its columns
    // spells the same absence as spaces. `Number("   ")` is 0 and finite, so a reader that asked
    // only whether the string was empty would let this row through as a payment of zero — the
    // silent shrunken total this class exists to stop, arriving from a file that looks fine in a
    // spreadsheet because the padding is invisible there.
    const fixture = await build("refuse-amount-spaces", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      revenue: revenue(["one", from_cut(HOUR), "   "]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-amount-spaces", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportValueError);
    // The absence arm of the message, not the unparseable one: the fix is to fill the row at the
    // source, and telling the reader to hunt for a decimal comma would send them looking at a cell
    // that has nothing in it.
    expect(error.message).toContain("is empty on one row");
    expect(error.message).toContain("amount");
  });

  test("an amount that overflows to Infinity rather than failing to parse", async () => {
    // `Number("1e999")` is not NaN; it is Infinity. Checked for NaN alone, this row is accepted,
    // added into the total, and carried through `round_half_even`, which passes non-finite input
    // straight through by design — so the cell publishes `Infinity` as money somebody collected.
    const fixture = await build("refuse-amount-overflow", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      revenue: revenue(["one", from_cut(HOUR), "1e999"]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-amount-overflow", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportValueError);
    // The unparseable arm, quoting the cell: an overflowing literal is something written wrong in
    // the export, not a row left empty.
    expect(error.message).toContain("1e999");
    expect(error.message).toContain("amount");
  });

  test("more unreadable numbers than the engine allows", async () => {
    // The engine permits five percent. Two identifiers in three is a market whose plan does not
    // describe this data, and that produces the same zero as a list nobody on it ever registered.
    const fixture = await build("refuse-unparseable", {
      lead: leads(
        ["good", phone(1), from_cut(HOUR)],
        ["bad-a", "not a number", from_cut(HOUR)],
        ["bad-b", "12", from_cut(HOUR)],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-unparseable", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(UnparseablePhonesError);
    expect(error.message).toContain("2 of 3");
  });

  test("but an account that never gave a number is not an unreadable one either", async () => {
    // A lead role writes `coalesce(u.phone, '')`, so every account without a number lands here as
    // an empty cell. Charging the market for them spends the ceiling on absences: four of these
    // six rows are blank, which under a row count is 67% and a refusal, while the only thing
    // wrong with the file is nothing at all.
    const fixture = await build("blank-accounts-are-not-junk", {
      lead: leads(
        ["a", phone(1), from_cut(HOUR)],
        ["no-phone-1", "", from_cut(HOUR)],
        ["b", phone(2), from_cut(HOUR)],
        ["no-phone-2", "", from_cut(HOUR)],
        ["no-phone-3", "", from_cut(HOUR)],
        // A space rather than nothing: the same absence, spelled by an export that pads its
        // columns. Read as an unreadable number it would put this file over the ceiling alone.
        ["no-phone-4", "   ", from_cut(HOUR)],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const record = await one(fixture, cold("blank-accounts-are-not-junk", fixture.list("reached.txt")));

    expect(record.audience.matched_phones).toBe(2);
  });

  test("and a lead role whose phone column is empty throughout, which the rate cannot catch", async () => {
    // The hole skipping blanks opens. Nothing is unreadable, so the rate is zero and says the file
    // is perfect; there is no index, so every cell matches nobody and the run publishes an
    // audience that was never there. It is checked before the market is inferred, because a column
    // of nothing reaches `dominant_market` as a corpus with no market in it — and reported that
    // way it sends the reader to argue with the dialling plan over a column that is simply empty.
    const fixture = await build("every-account-without-a-number", {
      lead: leads(["a", "", from_cut(HOUR)], ["b", "", from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("every-account-without-a-number", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportBlankColumnError);
    expect((error as ExportBlankColumnError).columns).toEqual(["phone"]);
    // Names the column and what it was read for, in one phrase. Asserting the column alone passed
    // happily while the sentence read `binds "phone" for its timestamp` — the message was wrong in
    // the only word that tells the reader which fault they have.
    expect(error.message).toContain('"phone" for its phone number');
    // And the consequence is the phone one, not the accumulator sentence the timestamp case uses.
    expect(error.message).toContain("matches nobody");
  });

  test("and the export's rate is measured against the index, not the row count", async () => {
    // One row per account, not per person, so a file is free to repeat a number — and the thing
    // the ceiling protects is the index those rows collapse into. Five of these six rows are
    // readable and they build an index of one, so the honest reading is one key missing of two
    // and a refusal. Counting rows calls the same file 17% junk and lets it through.
    const fixture = await build("rate-against-the-index", {
      lead: leads(
        ["a1", phone(1), from_cut(HOUR)],
        ["a2", phone(1), from_cut(HOUR)],
        ["a3", phone(1), from_cut(HOUR)],
        ["a4", phone(1), from_cut(HOUR)],
        ["a5", phone(1), from_cut(HOUR)],
        ["junk", "not a number", from_cut(HOUR)],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("rate-against-the-index", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(UnparseablePhonesError);
    expect(error.message).toContain("1 of 2");
    // Ordered, like the cell side: swapping the two arguments leaves both numbers present and
    // every loose assertion passing while the sentence reports the observed rate as the ceiling.
    expect(error.message).toContain("(50.0%), above the 5.0%");
  });

  test("and one sentinel repeated down the lead role's phone column is one unknown", async () => {
    // The base side of the same spelling problem. A base whose phone column says `SEM TELEFONE`
    // on every account that never gave one is describing a single thing it could not read, and
    // charging the market once per row would refuse a file at four times its real rate. Nineteen
    // keys and one sentinel is one missing of twenty, which is exactly the five percent allowed;
    // the same four rows counted one by one are four missing of twenty-three, and a refusal.
    const fixture = await build("one-sentinel-in-the-export", {
      lead: leads(
        ...keyed_accounts(READABLE),
        ["s1", "SEM TELEFONE", from_cut(HOUR)],
        ["s2", "SEM TELEFONE", from_cut(HOUR)],
        ["s3", "SEM TELEFONE", from_cut(HOUR)],
        ["s4", "SEM TELEFONE", from_cut(HOUR)],
      ),
      lists: { "reached.txt": lines(...keyed_numbers(READABLE)) },
    });

    const record = await one(fixture, cold("one-sentinel-in-the-export", fixture.list("reached.txt")));

    expect(record.audience.matched_phones).toBe(READABLE);
  });

  test("and more unreadable numbers in a cell's own list than the engine allows", async () => {
    // The same ceiling, the other side of the join, and the opposite sign. An entry nobody can key
    // never reaches a numerator, so dropping it quietly only shrinks `listed` — the denominator
    // under every rate this cell publishes. Left unguarded, a list of junk reads as a tiny audience
    // that converted brilliantly, which is the direction that gets published.
    const fixture = await build("refuse-unparseable-list", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1), "not a number", "12", "also not one") },
    });

    const error = await caught(one(fixture, cold("refuse-unparseable-list", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(UnparseablePhonesError);
    expect(error.message).toContain("3 of 4");
    // Named, because the remedy differs: the base is written in another market's plan, or this one
    // file is junk. Saying "the person export" here would send the reader to the wrong file.
    expect(error.message).toContain("refuse-unparseable-list");
  });

  test("but a row carrying no identifier at all is not an unreadable one", async () => {
    // The distinction this rate turns on. A malformed number is a person who was reached and is
    // now missing from the denominator; an empty cell is a row of somebody's export that was never
    // part of the dispatch. Counting the second as the first refuses correct readings — a CRM dump
    // is mostly such rows, and the audience such a campaign publishes has always been the phones it
    // held rather than the lines the file ran to.
    const fixture = await build("blank-rows-are-not-junk", {
      lead: leads(["one", phone(1), from_cut(HOUR)], ["two", phone(2), from_cut(HOUR)]),
      lists: {
        // Two phones among a majority of empty cells, which is the shape of a real export.
        "reached.csv": csv(
          ["phone", "name"],
          [
            [phone(1), "a"],
            ["", "no phone on this row"],
            ["", ""],
            [phone(2), "b"],
            ["", "nor this one"],
            // Whitespace, not emptiness. An export writing a space instead of nothing is the same
            // absence spelled differently, and reading it as an unreadable number would put this
            // file straight back at the rate the guard refuses.
            ["   ", "a space, which is also no phone"],
          ],
        ),
      },
    });

    const record = await one(
      fixture,
      cold("blank-rows-are-not-junk", fixture.list("reached.csv"), { column: "phone" }),
    );

    expect(record.audience.listed).toBe(2);
  });

  test("and a rate sitting exactly on the ceiling is allowed, on both sides of the join", async () => {
    // The engine permits five percent, and "above this share" means above it. Whether the
    // comparison is strict decides what the ceiling actually licenses, and neither side pinned it
    // — so a change from `>` to `>=` would silently start refusing every file measured at exactly
    // the declared limit, which is the one value anybody picks on purpose.
    const fixture = await build("ceiling-is-inclusive", {
      // One unreadable of twenty accounts, and one of twenty possible list identifiers: 0.05 both
      // ways, and one identifier fewer on either side would tip it over.
      lead: leads(...keyed_accounts(READABLE), ["junk", "not a number", from_cut(HOUR)]),
      lists: { "reached.txt": lines(...keyed_numbers(READABLE), "not a number") },
    });

    const record = await one(fixture, cold("ceiling-is-inclusive", fixture.list("reached.txt")));

    expect(record.audience.listed).toBe(READABLE);
    expect(record.audience.matched_phones).toBe(READABLE);
  });

  test("and one unknown repeated down a column is one unknown, not a file of them", async () => {
    // A sentinel is how an export spells absence when its author did not leave the cell empty:
    // `N/A`, `-`, `SEM TELEFONE`. Counting the rows it appears on charges the market once per row
    // for a single thing it could not read, and twenty rows of one sentinel can hide at most one
    // person between them. Nineteen keys and one sentinel is one missing of twenty, which is
    // exactly the five percent allowed, however many rows carry it.
    const fixture = await build("one-sentinel-is-one-unknown", {
      lead: leads(...keyed_accounts(READABLE)),
      lists: {
        "reached.txt": lines(
          ...keyed_numbers(READABLE),
          "SEM TELEFONE",
          "SEM TELEFONE",
          "SEM TELEFONE",
          "SEM TELEFONE",
        ),
      },
    });

    const record = await one(fixture, cold("one-sentinel-is-one-unknown", fixture.list("reached.txt")));

    expect(record.audience.listed).toBe(READABLE);
  });

  test("and naming the same list twice cannot change what the cell measured", async () => {
    // The readable side deduplicates across lists and the unreadable side did not, so repeating a
    // filename used to move the rate on one arm of the fraction only — a cell that passed as one
    // list was refused as two copies of itself. A declaration is a statement about which people
    // the cell covers, and saying it twice says the same thing.
    const fixture = await build("the-same-list-twice", {
      lead: leads(...keyed_accounts(READABLE)),
      lists: { "reached.txt": lines(...keyed_numbers(READABLE), "not a number") },
    });

    const once = await one(fixture, cold("the-same-list-twice", fixture.list("reached.txt")));
    const twice = await one(fixture, {
      ...cold("the-same-list-twice", fixture.list("reached.txt")),
      lists: [fixture.list("reached.txt"), fixture.list("reached.txt")],
    });

    expect(twice.audience).toEqual(once.audience);
  });

  test("and the rate is measured against the audience, not the row count", async () => {
    // `listed` is a count of distinct people, so the guard has to bound how far that number was
    // shrunk. Dividing by rows understates it wherever readable entries repeat: five of these six
    // rows are readable but resolve to one person, so the row reading is one junk entry in six and
    // the honest one is one in two — half the audience missing, which the ceiling must catch.
    const fixture = await build("rate-against-the-audience", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      lists: {
        "reached.txt": lines(phone(1), phone(1), phone(1), phone(1), phone(1), "not a number"),
      },
    });

    const error = await caught(one(fixture, cold("rate-against-the-audience", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(UnparseablePhonesError);
    expect(error.message).toContain("1 of 2");
    // The percentage too, not just the two counts. Asserting only the counts leaves the division
    // that turns them into a rate unchecked, and a fixture this far clear of the ceiling still
    // throws under a divisor loosened by one.
    // Rate and ceiling in one ordered phrase, not as two loose substrings. Swapping the two
    // arguments leaves both numbers in the sentence and every separate assertion still passing,
    // while it reads "(5.0%), above the 50.0%" — an observed rate reported as the limit, sending
    // whoever reads it to widen a ceiling that is not the problem.
    expect(error.message).toContain("(50.0%), above the 5.0%");
  });

  test("and the rate measures the list as it was delivered, before exclusions are subtracted", async () => {
    // One junk entry in twenty is exactly the five percent allowed, and the probe subtracted below
    // was on the list that was sent. Subtract exclusions first and the denominator drops to
    // nineteen, the same single junk entry reads as 5.3% of the list, and this clean cell is
    // refused over a market that fits it perfectly — one more probe named in a declaration
    // deciding whether the base is called unreadable.
    const fixture = await build("rate-before-exclusions", {
      lead: leads(...keyed_accounts(READABLE)),
      lists: { "reached.txt": lines(...keyed_numbers(READABLE), "not a number") },
    });

    const record = await one(
      fixture,
      cold("rate-before-exclusions", fixture.list("reached.txt"), { exclude: [phone(1)] }),
    );

    // The exclusion still does its work: eighteen members are left, and the junk entry is not one
    // of them. What it must not do is change the verdict on the file it was subtracted from.
    expect(record.audience.listed).toBe(READABLE - 1);
    expect(record.audience.matched_phones).toBe(READABLE - 1);
  });

  test("a cell whose lists hold nothing but junk, named as junk and not as emptiness", async () => {
    // Both faults stop the run and they read alike, but they are fixed in different files: a list
    // of unreadable numbers sends the reader to the market the base is written in or to the export
    // that produced them, while an empty cell sends them to a wrong column or an over-narrow filter.
    // The rate is therefore checked first, so the more specific of the two gets to speak.
    const fixture = await build("refuse-all-junk", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines("not a number", "also not one") },
    });

    const error = await caught(one(fixture, cold("refuse-all-junk", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(UnparseablePhonesError);
    expect(error.message).toContain("2 of 2");
  });

  test("and a list holding exactly one identifier, which is junk", async () => {
    // The smallest file the rate can see, and the boundary the guard above it is written against.
    // `possible` is 1 here, so a check reading `possible > 1` instead of `possible > 0` skips the
    // rate entirely and the cell falls through to being called empty — the same misnaming the
    // reorder exists to prevent, reachable again through the off-by-one.
    const fixture = await build("one-identifier-and-it-is-junk", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines("not a number") },
    });

    const error = await caught(one(fixture, cold("one-identifier-and-it-is-junk", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(UnparseablePhonesError);
    // The noun, because it has drifted from the quantity twice. Both numbers counted rows once,
    // then counted rows on one side only, and now count distinct identifiers on both — and the
    // word stayed "rows" through all three, sending a reader to look for rows that do not exist.
    expect(error.message).toContain("1 of 1 distinct identifiers");
    expect(error.message).toContain("100.0%");
  });

  test("and a base of nothing but junk, refused before a market can be read off it", async () => {
    // The base side of the same fault, and it now lands one guard earlier than the cell side
    // does. The market a bare number is read in is inferred from the numbers that carry a calling
    // code, and a file of junk carries none — so this is refused for naming no market rather than
    // for its unreadable share, which is the earliest and most specific thing that is true of it.
    // What must not happen either way is the blank-column refusal: the column is not empty, it is
    // full of something nothing can read, and those are fixed in different places.
    const fixture = await build("one-junk-spelling-in-the-export", {
      lead: leads(["a", "junk", from_cut(HOUR)], ["b", "junk", from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("one-junk-spelling-in-the-export", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(PhoneFormatError);
    expect(error).not.toBeInstanceOf(ExportBlankColumnError);
    expect(error.message).toMatch(/calling code/i);
  });

  test("and a sentinel is trimmed before it is counted, on both sides", async () => {
    // An export that pads its columns writes the same absence two ways. Adding the untrimmed text
    // to the set makes `N/A` and `N/A   ` two unknowns instead of one, which is the padding
    // deciding the verdict — the same fault as counting rows, reached through whitespace.
    // Nineteen keys and one sentinel is the five percent allowed; two sentinels is 9.5% and a
    // refusal, so a trim dropped on either side of the join fails here.
    const fixture = await build("padding-is-not-a-second-unknown", {
      lead: leads(...keyed_accounts(READABLE), ["s1", "SEM TEL", from_cut(HOUR)], ["s2", "SEM TEL  ", from_cut(HOUR)]),
      lists: {
        "reached.csv": csv(
          ["phone", "note"],
          [
            ...keyed_numbers(READABLE).map((written, i): Row => [written, `row ${i}`]),
            ["N/A", "one spelling"],
            ["N/A   ", "the same one, padded"],
          ],
        ),
      },
    });

    const record = await one(
      fixture,
      cold("padding-is-not-a-second-unknown", fixture.list("reached.csv"), { column: "phone" }),
    );

    expect(record.audience.listed).toBe(READABLE);
    expect(record.audience.matched_phones).toBe(READABLE);
  });

  test("and skipping a blank phone does not excuse its row from the rest of the file", async () => {
    // Where the skip sits in the loop is two decisions, and both are load-bearing. The `dated`
    // tally runs first, so it describes the file rather than the part of it this market's plan
    // happened to read — here the only dated account is the one with no phone, and hoisting the
    // skip above the tally would report a file with no times in it. `person_ids` is added first
    // for the same kind of reason: it answers the join, which is a question about the id column,
    // so the revenue row belonging to that account must still land.
    const fixture = await build("a-blank-phone-is-still-a-row", {
      lead: leads(["dated-no-phone", "", from_cut(HOUR)], ["undated", phone(1), ""]),
      revenue: revenue(["dated-no-phone", from_cut(HOUR), 10]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("a-blank-phone-is-still-a-row", fixture.list("reached.txt")));

    expect(record.audience.matched_phones).toBe(1);
  });

  test("a cell whose lists yielded no usable identifier", async () => {
    // Nothing unreadable to report and nothing readable either: the file has rows, and the filter
    // this cell declared kept none of them. The rate above cannot see this one — `possible` is 0,
    // and its guard is there to say so out loud rather than to lean on `0 / 0` being `NaN` and
    // `NaN > ceiling` being false, which is true but is not a thing the next reader should need.
    const fixture = await build("refuse-empty", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      lists: {
        "reached.csv": csv(
          ["phone", "cohort"],
          [
            [phone(1), "morning"],
            [phone(2), "morning"],
          ],
        ),
      },
    });

    const error = await caught(
      one(
        fixture,
        cold("refuse-empty", fixture.list("reached.csv"), {
          column: "phone",
          filter: { column: "cohort", value: "evening" },
        }),
      ),
    );

    expect(error).toBeInstanceOf(EmptyCellError);
    expect((error as EmptyCellError).cell).toBe("refuse-empty");
    // The variant, not just the class. Deleting the refusal this commit reordered leaves the
    // second one downstream to catch the same input and blame `exclude` — on a cell that declares
    // no exclusions — so the class alone cannot tell the two apart.
    expect((error as EmptyCellError).after_exclusions).toBe(false);
    expect(error.message).not.toContain("exclusions are subtracted");
    expect(error.message).toContain("yielded no usable identifier");
  });

  test("a cell left empty by its own exclusions", async () => {
    // A cell consisting only of planted probes is as unmeasurable as one whose file moved, and
    // it must fail the same way rather than reporting a clean row of zeros.
    const fixture = await build("refuse-empty-excluded", {
      lead: leads(["probe", phone(2), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(2)) },
    });

    const error = await caught(
      one(fixture, cold("refuse-empty-excluded", fixture.list("reached.txt"), { exclude: [phone(2)] })),
    );

    expect(error).toBeInstanceOf(EmptyCellError);
    expect((error as EmptyCellError).cell).toBe("refuse-empty-excluded");
    // The variant, not merely the class. Flipping the flag at this throw site swaps the entire
    // message: a cell emptied by its own probes would be told to check that this is the file that
    // was sent, sending whoever reads it to a file that is not the problem while the over-broad
    // `exclude` that actually emptied the cell stays in the declaration untouched.
    expect((error as EmptyCellError).after_exclusions).toBe(true);
    expect(error.message).toContain("exclusions are subtracted");
    expect(error.message).not.toContain("yielded no usable identifier");
  });

  test("an exclusion that cannot be read as a number, which would leave the probe in the cell", async () => {
    // The one fault here that overstates instead of emptying. Each entry below is a real way a
    // probe number is mistyped — a capital letter for a zero, an extension appended, a row of the
    // declaration left blank — and none of them yields a key. Skipped rather than refused, they
    // subtract nobody: the probe stays in a two-member cell, its conversion is counted as the
    // campaign's, and the reading comes back a hundred times what it should be. An empty reading
    // is queried by whoever reads it; an inflated one is published.
    const fixture = await build("refuse-exclude-unreadable", {
      lead: leads(["real", phone(1), from_cut(HOUR)], ["probe", phone(2), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const entries = ["55 11 9OOOO-OOO2", `${phone(2)} ext 20`, ""];
    const error = await caught(
      one(fixture, cold("refuse-exclude-unreadable", fixture.list("reached.txt"), { exclude: entries })),
    );

    expect(error).toBeInstanceOf(CellExclusionError);
    expect((error as CellExclusionError).cell).toBe("refuse-exclude-unreadable");
    // Every one of them, not the first: a declaration corrected one entry per run is corrected
    // over three runs, and the second and third are found only after the first is fixed.
    expect((error as CellExclusionError).entries).toEqual(entries);
    for (const entry of entries) {
      expect(error.message).toContain(JSON.stringify(entry));
    }
  });

  test("and one mistyped entry out of one, which is the shape the fault actually arrives in", async () => {
    // A declaration lists a handful of probes and somebody gets a digit wrong in one of them. The
    // case above hands over three unreadable entries at once, which a refusal starting at the
    // second would still pass — and the second is never the realistic number. One entry is, and
    // under a refusal that missed it this cell measures with the probe still in the population and
    // its conversion credited to the campaign.
    const fixture = await build("refuse-exclude-one", {
      lead: leads(["real", phone(1), from_cut(HOUR)], ["probe", phone(2), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const error = await caught(
      one(fixture, cold("refuse-exclude-one", fixture.list("reached.txt"), { exclude: ["55 11 9OOOO-OOO2"] })),
    );

    expect(error).toBeInstanceOf(CellExclusionError);
    expect((error as CellExclusionError).entries).toEqual(["55 11 9OOOO-OOO2"]);
    // Singular, because the sentence is an instruction to whoever fixes the declaration and "an
    // exclusion" and "3 exclusions" send them to look for different amounts of work.
    expect(error.message).toContain("lists an exclusion that cannot be read");
  });

  test("two cells sharing one name, which would make every control join ambiguous", async () => {
    const fixture = await build("refuse-duplicate-cell", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(
      measure({
        source: files(fixture.dir),
        cells: [cold("twice", fixture.list("reached.txt")), cold("twice", fixture.list("reached.txt"))],
        now: NOW,
      }),
    );

    expect(error).toBeInstanceOf(CellDeclarationError);
    expect((error as CellDeclarationError).cell).toBe("twice");
  });

  test("a control naming a cell nobody declared", async () => {
    const fixture = await build("refuse-control-unknown", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(
      measure({
        source: files(fixture.dir),
        cells: [cold("treated", fixture.list("reached.txt"))],
        controls: [{ treated: "treated", control: "imaginary", outcome: "acquired.accounts" }],
        now: NOW,
      }),
    );

    expect(error).toBeInstanceOf(ControlError);
    expect(error.message).toContain("imaginary");
  });

  test("a control read on a countable outcome its audience cannot have", async () => {
    // Nobody who has never heard of the brand can commit before arriving, so a cold pair read
    // on commitment is zero against zero: not a null result, a question never asked.
    const fixture = await build("refuse-control-audience", {
      lead: leads(["one", phone(1), from_cut(HOUR)], ["two", phone(2), from_cut(HOUR)]),
      lists: { "treated.txt": lines(phone(1)), "untouched.txt": lines(phone(2)) },
    });

    const error = await caught(
      measure({
        source: files(fixture.dir),
        cells: [cold("treated", fixture.list("treated.txt")), cold("untouched", fixture.list("untouched.txt"))],
        controls: [{ treated: "treated", control: "untouched", outcome: "conversions.count" }],
        now: NOW,
      }),
    );

    expect(error).toBeInstanceOf(ControlError);
    expect(error.message).toMatch(/audience/i);
    expect(error.message).toContain("conversions.count");
    // What this pair can be read on, in the same sentence that refuses what it asked for. One
    // message, because a countability check ahead of this one used to refuse the same declaration
    // first and name four paths, three of which this check was about to take back.
    expect(error.message).toContain("Both cells are cold, and a cold cell is read on acquired.accounts");
    expect(error.message).toContain("question never asked");
  });

  test("a control read on a sum of money rather than a count of people", async () => {
    // A money total fed to a two-proportion test produces a p-value and a `publishable: true`
    // that mean nothing: the test counts successes out of trials, and currency is neither. The
    // same guard answers this, because a path no audience can be read on is refused by every
    // audience — and one refusal that names what this pair can be read on is the whole answer.
    const fixture = await build("refuse-control-outcome", {
      lead: leads(["one", phone(1), from_cut(HOUR)], ["two", phone(2), from_cut(HOUR)]),
      lists: { "treated.txt": lines(phone(1)), "untouched.txt": lines(phone(2)) },
    });

    const error = await caught(
      measure({
        source: files(fixture.dir),
        cells: [cold("treated", fixture.list("treated.txt")), cold("untouched", fixture.list("untouched.txt"))],
        controls: [{ treated: "treated", control: "untouched", outcome: "acquired.revenue.value" }],
        now: NOW,
      }),
    );

    expect(error).toBeInstanceOf(ControlError);
    expect(error.message).toContain("acquired.revenue.value");
    expect(error.message).toContain("acquired.accounts");
    expect(error.message).toContain("not a proportion");
  });

  test("a pair drawn across the two audiences, which has no outcome both sides can be read on", async () => {
    // Read in both directions, because the guard is two conditions and either one alone refuses
    // this pair. The outcome asked for is always one the treated cell allows and the control cell
    // does not, or the reverse, so each reading fails if the check stops consulting one of the two
    // cells — which is what "reads both cells rather than whichever it looked at first" has to
    // mean to be worth asserting. It is also the whole of what a mixed pair can ever be: the two
    // audiences share no countable path, so the message says so and sends the reader to draw a
    // control from the treated cell's own audience instead of trying a third outcome.
    const fixture = await build("refuse-control-mixed-audience", {
      lead: leads(["one", phone(1), from_cut(HOUR)], ["two", phone(2), from_cut(-DAY)]),
      lists: { "treated.txt": lines(phone(1)), "untouched.txt": lines(phone(2)) },
    });

    // The treated cell allows the outcome and the control cell does not: only the control side of
    // the condition refuses this one.
    const on_the_control = await caught(
      measure({
        source: files(fixture.dir),
        cells: [cold("treated", fixture.list("treated.txt")), base("untouched", fixture.list("untouched.txt"))],
        controls: [{ treated: "treated", control: "untouched", outcome: "acquired.accounts" }],
        now: NOW,
      }),
    );

    expect(on_the_control).toBeInstanceOf(ControlError);
    expect(on_the_control.message).toContain('"treated" (cold) against "untouched" (own_base)');
    expect(on_the_control.message).toContain("No outcome can be read on both");

    // The audiences swapped and the outcome kept: now the control cell allows `acquired.accounts`
    // and the treated one cannot be read on it, so only the treated side of the condition refuses.
    const on_the_treated = await caught(
      measure({
        source: files(fixture.dir),
        cells: [base("treated", fixture.list("treated.txt")), cold("untouched", fixture.list("untouched.txt"))],
        controls: [{ treated: "treated", control: "untouched", outcome: "acquired.accounts" }],
        now: NOW,
      }),
    );

    expect(on_the_treated).toBeInstanceOf(ControlError);
    expect(on_the_treated.message).toContain('"treated" (own_base) against "untouched" (cold)');
    // The rule is stated in the pair's own order, so the reader is told what the cell they named
    // first can be read on first.
    expect(on_the_treated.message).toContain("A own_base cell is read on conversions.count");
    expect(on_the_treated.message).toContain("No outcome can be read on both");
  });

  test("two controls on one treated cell, where the last would silently win", async () => {
    const fixture = await build("refuse-control-duplicate", {
      lead: leads(
        ["one", phone(1), from_cut(HOUR)],
        ["two", phone(2), from_cut(HOUR)],
        ["three", phone(3), from_cut(HOUR)],
      ),
      lists: { "treated.txt": lines(phone(1)), "first.txt": lines(phone(2)), "second.txt": lines(phone(3)) },
    });

    const controls: Control[] = [
      { treated: "treated", control: "first", outcome: "acquired.accounts" },
      { treated: "treated", control: "second", outcome: "acquired.accounts" },
    ];
    const error = await caught(
      measure({
        source: files(fixture.dir),
        cells: [
          cold("treated", fixture.list("treated.txt")),
          cold("first", fixture.list("first.txt")),
          cold("second", fixture.list("second.txt")),
        ],
        controls,
        now: NOW,
      }),
    );

    expect(error).toBeInstanceOf(ControlError);
    expect(error.message).toContain("treated");
  });

  test("a conversion role with rows, not one of which is marked committed", async () => {
    // A role can be present, well-formed and contribute nothing. Every column is there, every
    // timestamp parses, every amount is a number — and the value the `committed` predicate
    // compares against was renamed in a migration, so the query stays valid and matches nothing.
    // The per-cell filter then drops the rows one at a time and the record says nobody committed,
    // which is indistinguishable from a campaign nobody committed to. Counted once over the whole
    // role, the difference between a quiet window and a predicate that fires on nothing becomes a
    // fact the run can refuse on.
    //
    // The predicate lives in the source's own query now, so this error cannot name the values it
    // saw and does not try to: they are the product's vocabulary and this package is published.
    // What it can say is how many rows answered and that none of them counted.
    const fixture = await build("refuse-status-drift", {
      lead: leads(["one", phone(1), from_cut(-DAY)], ["two", phone(2), from_cut(-DAY)]),
      conversion: conversions(
        ["one", from_cut(HOUR), 60, "false", "false"],
        ["two", from_cut(2 * HOUR), 40, "false", "true"],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const error = await caught(one(fixture, base("refuse-status-drift", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportStatusError);
    expect((error as ExportStatusError).rows).toBe(2);
    expect(error.message).toContain("answered 2 rows");
    // The remedy names the predicate rather than a list of statuses this package no longer holds,
    // which is the whole of what moved when the project's vocabulary left the package.
    expect(error.message).toContain("`committed` predicate");
  });

  test("and the same drift in an export carrying a single row", async () => {
    // The count the guard is conditioned on is "any rows at all", and the case above has two — so
    // a guard that started at the second row would look correct there and stay silent here. A
    // one-row conversion export is what a small cell produces, and its single renamed status is
    // the same migration: the row is dropped by the per-cell filter, the record says nobody
    // committed, and the only thing that distinguishes it from a genuinely quiet cell is this
    // refusal. The blank-timestamp guard beside it is written to the same shape and is exercised
    // at one row, which is what makes the asymmetry a gap rather than a preference.
    const fixture = await build("refuse-status-drift-one-row", {
      lead: leads(["one", phone(1), from_cut(-DAY)]),
      conversion: conversions(["one", from_cut(HOUR), 60, "false", "false"]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, base("refuse-status-drift-one-row", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportStatusError);
    expect((error as ExportStatusError).rows).toBe(1);
    expect(error.message).toContain("answered 1 rows");
  });

  test("and a committed column blank on every row, which is not a role nobody committed to", async () => {
    // The other way the predicate stops answering, and the one no count of committed rows can
    // see: nothing was renamed, the column was emptied at the source while its header stayed.
    // Read as false, an empty cell drops every row and the record reports conversions 0 of 0 for
    // two people who both signed — the same reading a campaign nobody committed to produces. The
    // boundary carries strings, so `true` and `false` are the whole of the answer and a blank is
    // a source that did not answer at all.
    const fixture = await build("refuse-status-blank-column", {
      lead: leads(["one", phone(1), from_cut(-DAY)], ["two", phone(2), from_cut(-DAY)]),
      conversion: conversions(["one", from_cut(HOUR), 60, "", "false"], ["two", from_cut(2 * HOUR), 40, "", "true"]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const error = await caught(one(fixture, base("refuse-status-blank-column", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportFlagError);
    expect((error as ExportFlagError).column).toBe("committed");
    // Which of the two happened, because an emptied column and a value from the wrong vocabulary
    // are different jobs at the source.
    expect((error as ExportFlagError).raw).toBe("");
    expect(error.message).toContain("an unanswered question is not an answer of no");
  });

  test("but not a role where one row in three is marked committed", async () => {
    // The same distinction the blank-column check draws. A file whose rows are mostly abandoned
    // or cancelled is an ordinary file; it is a file with nothing countable in it that is a
    // fault, and refusing the first would make every honest month unmeasurable.
    const fixture = await build("status-partial-is-legal", {
      lead: leads(["one", phone(1), from_cut(-DAY)]),
      conversion: conversions(
        ["one", from_cut(HOUR), 10, "false", "false"],
        ["one", from_cut(2 * HOUR), 20, "true", "false"],
        ["one", from_cut(3 * HOUR), 30, "false", "false"],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, base("status-partial-is-legal", fixture.list("reached.txt")));

    expect(record.conversions.count).toBe(1);
    expect(record.conversions.value).toBe(20);
  });

  test("and a committed cell holding anything but true or false, which is not a row that did not commit", async () => {
    // The strict read, and what it buys. A source answering `1`, `t`, `yes` or a status name has
    // not answered the question, and reading that as false drops the row in silence: this cell
    // would publish one conversion worth twenty where the truth is two worth five hundred and
    // twenty, on the strength of a value nothing in the record mentions. Every other row here is
    // well-formed, so the count guard above cannot see it — one row in two is committed.
    const fixture = await build("committed-is-not-a-status-name", {
      lead: leads(["one", phone(1), from_cut(-DAY)]),
      conversion: conversions(
        ["one", from_cut(HOUR), 20, "true", "false"],
        ["one", from_cut(2 * HOUR), 500, "LIVE", "false"],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, base("committed-is-not-a-status-name", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportFlagError);
    // Not `ExportValueError`: that one is about amounts and says so, and its remedy — look for a
    // currency symbol, a thousands separator, a decimal comma — is no help at all here.
    expect(error).not.toBeInstanceOf(ExportValueError);
    expect((error as ExportFlagError).column).toBe("committed");
    // The value as written, and the cause it points at: a query passing its own vocabulary
    // through where the contract asked it to answer the question.
    expect((error as ExportFlagError).raw).toBe("LIVE");
    expect(error.message).toContain('holds "LIVE"');
    expect(error.message).toContain("as committed");
  });

  test("a conversion role whose lead column holds the wrong kind of id", async () => {
    // The join is the one column that can be wrong while every column is present and every value
    // well-formed: a conversion role keyed on the contract's own primary key instead of the
    // person's matches nobody. What comes out is a thousand matched accounts and no conversions,
    // which is exactly what a campaign nobody responded to looks like.
    const fixture = await build("refuse-join-conversion", {
      lead: leads(["member-1", phone(1), from_cut(-DAY)]),
      conversion: conversions(["contract-9", from_cut(HOUR), 50, "true", "false"]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, base("refuse-join-conversion", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportJoinError);
    expect((error as ExportJoinError).role).toBe("conversion");
    expect((error as ExportJoinError).column).toBe("lead");
    // Both sides quoted, because the shape of the two ids is what tells the reader which one is
    // the wrong kind.
    expect(error.message).toContain("contract-9");
    expect(error.message).toContain("member-1");
  });

  test("a money role that references nobody in the lead role either", async () => {
    const fixture = await build("refuse-join-revenue", {
      lead: leads(["member-1", phone(1), from_cut(-DAY)]),
      revenue: revenue(["wallet-7", from_cut(HOUR), 25]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-join-revenue", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportJoinError);
    expect((error as ExportJoinError).role).toBe("revenue");
    expect((error as ExportJoinError).path).toBe("revenue");
  });

  test("a role pointed at the wrong rows entirely, reported as the wrong rows and not as a surface fault", async () => {
    // An orders extract answering the conversion role. It joins on the order's own key and keeps
    // the order's lifecycle in whatever it calls a status, so its `committed` predicate matches
    // nothing either — and that check used to run first. Its remedy sends the reader to read the
    // predicate against the values the column holds, which they can carry out in full and arrive
    // exactly where they started: no predicate makes this file describe people. The honest drift
    // beside it, `refuse-status-drift` above, is a role that does join and is still reported as
    // the uncommitted rows it is.
    const fixture = await build("wrong-file-status", {
      lead: leads(["member-1", phone(1), from_cut(-DAY)], ["member-2", phone(2), from_cut(-DAY)]),
      conversion: conversions(
        ["ORD-1", from_cut(HOUR), 50, "false", "false"],
        ["ORD-2", from_cut(2 * HOUR), 70, "false", "false"],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const error = await caught(one(fixture, base("wrong-file-status", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportJoinError);
    expect((error as ExportJoinError).role).toBe("conversion");
    expect(error.message).toContain("ORD-1");
  });

  test("and the same, over the blank-column check the join used to run behind", async () => {
    // The other order this could be reported in. A wallet extract that happens to carry the bound
    // column names — which is how it came to be bound at all — references wallets and was written
    // with its timestamp column empty. Both faults are real; only the join says which file is in
    // the wrong place. `refuse-blank-revenue` above is the honest half: a revenue export that
    // joins, with the same empty column, still reported as the blank column it is.
    const fixture = await build("wrong-file-blank", {
      lead: leads(["member-1", phone(1), from_cut(-DAY)]),
      revenue: revenue(["WAL-1", "", 25], ["WAL-2", "", 40]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("wrong-file-blank", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportJoinError);
    expect((error as ExportJoinError).role).toBe("revenue");
    expect(error.message).toContain("WAL-1");
  });

  test("but not a role that references only some of them, which is a narrower export", async () => {
    // One shared identifier is enough, and this must never become a coverage threshold: a role
    // exported over a shorter window than the lead role legitimately references a fraction
    // of it, and a fraction is not a fault. Zero is the fault, because zero is the only overlap
    // two files describing the same people cannot produce.
    const fixture = await build("join-partial-is-legal", {
      lead: leads(["one", phone(1), from_cut(-DAY)], ["two", phone(2), from_cut(-DAY)]),
      revenue: revenue(["one", from_cut(HOUR), 10], ["outside-this-export", from_cut(HOUR), 90]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const record = await one(fixture, cold("join-partial-is-legal", fixture.list("reached.txt")));

    expect(record.pre_existing.revenue).toEqual({ leads: 1, value: 10 });
  });

  test("and a blank on both sides is not the shared identifier that satisfies it", async () => {
    // The check above is satisfied by one key the two files have in common, and the empty string
    // used to be such a key. A person row whose id is blank and a revenue row whose person column
    // is blank meet at `""`, the check returns satisfied on that pair, and the real row beside
    // them — keyed on a wallet, referencing nobody — falls out of every cell in the silence this
    // error exists to break. A consumer reaches it the ordinary way: a left join that matched
    // nothing writes a null person, and a null reads as blank in an export.
    const fixture = await build("refuse-join-blank", {
      lead: leads(["", phone(1), from_cut(-DAY)]),
      revenue: revenue(["", from_cut(HOUR), 5], ["wallet-7", from_cut(HOUR), 90]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-join-blank", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportJoinError);
    expect((error as ExportJoinError).role).toBe("revenue");
    // The sample quoted is the wallet rather than the blank, because a blank tells the reader
    // nothing about which kind of id was bound by mistake.
    expect(error.message).toContain("wallet-7");
  });

  test("money whose person column is blank is not credited to a person whose id is blank", async () => {
    // The same two blanks, in a file that joins: one real row references a real person, so the
    // check above passes on it and is right to. What is left is a bucket keyed on nothing, and an
    // account keyed on nothing sitting in the audience, and reading one with the other credits
    // every unattributable unit in the export to whichever listed person happens to carry the
    // blank id. Ninety here, on a cell that really collected ten — and the conversion index is
    // read by its own loop, so both lookups are asserted or one of them keeps the fault.
    const fixture = await build("join-blank-not-credited", {
      lead: leads(["", phone(1), from_cut(-DAY)], ["real", phone(2), from_cut(-DAY)]),
      revenue: revenue(["", from_cut(HOUR), 90], ["real", from_cut(HOUR), 10]),
      conversion: conversions(["", from_cut(HOUR), 70, "true", "false"], ["real", from_cut(HOUR), 20, "true", "false"]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const record = await one(fixture, cold("join-blank-not-credited", fixture.list("reached.txt")));

    // Both accounts stay in the audience. The one with no id was matched on a phone that was read
    // and is a person this cell reached; only its join key is missing, so it collects nothing
    // rather than disappearing from the denominator.
    expect(record.audience.matched_accounts).toBe(2);
    expect(record.pre_existing.accounts).toBe(2);
    expect(record.pre_existing.revenue).toEqual({ leads: 1, value: 10 });
    expect(record.conversions).toEqual({ count: 1, value: 20, new_money: 20, recycled: 0 });
  });

  /**
   * Twenty listed phones, four of them arriving two hours after the cut, with `wallets` rows per
   * person and the same person id on every copy of a row.
   *
   * One wallet is the honest export. Two is what the money roles' own join produces when it is
   * followed into the wrong file: those roles reach a person through the wallet table, so an
   * author writes the lead role the same way and gets one row per person and wallet. It is not an
   * artificial duplicate — nobody types the same id twice — and it is the only shape this
   * arrives in.
   */
  async function fanned_out(name: string, wallets: number): Promise<Fixture> {
    const rows: Row[] = [];
    for (let n = 1; n <= 20; n += 1) {
      const created = n <= 4 ? from_cut(2 * HOUR) : from_cut(-30 * DAY);
      for (let w = 0; w < wallets; w += 1) {
        rows.push([`member-${n}`, phone(n), created]);
      }
    }
    return build(name, {
      lead: leads(...rows),
      revenue: revenue(...[1, 2, 3, 4].map((n): Row => [`member-${n}`, from_cut(3 * HOUR), 25])),
      conversion: conversions(["member-1", from_cut(4 * HOUR), 70, "true", "false"]),
      lists: { "reached.txt": lines(...Array.from({ length: 20 }, (_, i) => phone(i + 1))) },
    });
  }

  test("a lead role fanned out onto one row per wallet, which multiplies every figure it publishes", async () => {
    // Measured rather than refused, this file reads 40 matched accounts, 8 arrivals, 200 collected
    // and two commitments worth 140 — every figure in the test below doubled, and an acquisition
    // rate of 40% against a truth of 20%. None of it is distinguishable downstream from a base
    // whose people each hold two accounts, which the record documents as ordinary, and the narrower
    // version of the same fault does not even move `matched_accounts` off `matched_phones`.
    const fixture = await fanned_out("refuse-fan-out", 2);

    const error = await caught(one(fixture, cold("refuse-fan-out", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportRepeatedPersonError);
    expect((error as ExportRepeatedPersonError).rows).toBe(40);
    expect((error as ExportRepeatedPersonError).identifiers).toBe(20);
    expect((error as ExportRepeatedPersonError).path).toBe("lead");
    // Both quantities in the sentence: 40 against 20 says the file is doubled without anybody
    // opening it, where either number alone says nothing.
    expect(error.message).toContain("40 rows");
    expect(error.message).toContain("20 distinct");
    // And the remedy names the join, because that is where the rows came from.
    expect(error.message).toContain("wallet");
  });

  test("and one still refused where a row carrying no id sits beside it, which is where the two counts meet", async () => {
    // The blank carve-out has to hold on both sides of the comparison or it opens the hole it was
    // written to close. Three people, one of whom holds a second wallet, and one row whose person
    // join missed: four rows carry an id and three spellings are among them, so the file is doubled
    // for exactly one person. Count the blank as a fourth identifier and four rows meet four
    // spellings, the guard falls silent, and that person's money is collected twice — the same
    // inflation as the case above, reached through an off-by-one nothing else here can see.
    const fixture = await build("refuse-fan-out-with-blank", {
      lead: leads(
        ["", phone(1), from_cut(-DAY)],
        ["member-1", phone(2), from_cut(2 * HOUR)],
        ["member-1", phone(2), from_cut(2 * HOUR)],
        ["member-2", phone(3), from_cut(2 * HOUR)],
        ["member-3", phone(4), from_cut(-DAY)],
      ),
      revenue: revenue(["member-1", from_cut(3 * HOUR), 50]),
      lists: { "reached.txt": lines(phone(1), phone(2), phone(3), phone(4)) },
    });

    const error = await caught(one(fixture, cold("refuse-fan-out-with-blank", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportRepeatedPersonError);
    expect((error as ExportRepeatedPersonError).rows).toBe(4);
    // Three, not four: the blank row is on neither side of the comparison.
    expect((error as ExportRepeatedPersonError).identifiers).toBe(3);
  });

  test("but the same twenty people at one row each, which is the reading the refusal protects", async () => {
    // The truth the doubled numbers above are doubled against, measured rather than asserted in a
    // comment. `listed` and `acquired.accounts` are the two numbers every control divides to
    // publish an acquisition rate, and 4 of 20 is the 20% the fan-out reported as 40%.
    const fixture = await fanned_out("fan-out-one-row-each", 1);

    const record = await one(fixture, cold("fan-out-one-row-each", fixture.list("reached.txt")));

    expect(record.audience).toEqual({ listed: 20, matched_phones: 20, matched_accounts: 20 });
    expect(record.acquired.accounts).toBe(4);
    expect(record.acquired.revenue?.value).toBe(100);
    expect(record.conversions.count).toBe(1);
    expect(record.conversions.value).toBe(70);
  });

  test("and a lead role carrying no id on several rows, which is a left join that missed", async () => {
    // The carve-out the count above depends on. A left join that matched nothing writes a null
    // person, and a null reads as blank in an export, so three blanks among five rows is an
    // ordinary file — one this engine already measures by crediting those rows nothing. Counted as
    // identifiers they are one spelling on five rows, and this file is then refused as a fan-out:
    // every export with a handful of unresolved rows becomes unmeasurable, which is the opposite
    // failure and by far the commoner one.
    const fixture = await build("fan-out-blank-ids-are-legal", {
      lead: leads(
        ["", phone(1), from_cut(-DAY)],
        ["member-1", phone(2), from_cut(2 * HOUR)],
        ["", phone(3), from_cut(-DAY)],
        ["member-2", phone(4), from_cut(2 * HOUR)],
        ["", phone(5), from_cut(-DAY)],
      ),
      revenue: revenue(["member-1", from_cut(3 * HOUR), 40]),
      conversion: conversions(["member-2", from_cut(3 * HOUR), 60, "true", "false"]),
      lists: { "reached.txt": lines(phone(1), phone(2), phone(3), phone(4), phone(5)) },
    });

    const record = await one(fixture, cold("fan-out-blank-ids-are-legal", fixture.list("reached.txt")));

    expect(record.audience).toEqual({ listed: 5, matched_phones: 5, matched_accounts: 5 });
    expect(record.acquired.accounts).toBe(2);
    expect(record.acquired.revenue?.value).toBe(40);
    expect(record.conversions).toEqual({ count: 1, value: 60, new_money: 60, recycled: 0 });
  });

  test("an own_base cell not one of whose listed numbers answers for an account", async () => {
    // The declaration is the claim: own_base says these people already hold accounts, so arrival
    // measures nothing about them and commitment is the outcome. None of these four holds one, so
    // every count comes back zero and the record publishes a base that was reached and did nothing.
    // It sits past both of the cell's own guards rather than between them — four readable numbers
    // clear the unreadable-share ceiling and yield four keys, so `EmptyCellError` passes them too.
    // Nothing else in the pass ever compares the keys against the index they are matched in.
    const fixture = await build("refuse-own-base-unmatched", {
      lead: leads(["member-1", phone(90), from_cut(-30 * DAY)]),
      revenue: revenue(["member-1", from_cut(HOUR), 10]),
      lists: { "reached.txt": lines(phone(1), phone(2), phone(3), phone(4)) },
    });

    const error = await caught(one(fixture, base("refuse-own-base-unmatched", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(UnmatchedBaseError);
    expect((error as UnmatchedBaseError).cell).toBe("refuse-own-base-unmatched");
    expect((error as UnmatchedBaseError).listed).toBe(4);
    // The role the fix compares against, because the fix is a comparison between two sets of rows
    // and the reader needs the second one named. And the audience word, because the refusal turns
    // on the declaration.
    expect(error.message).toContain("the lead role");
    expect(error.message).toContain("own_base");
  });

  test("but the same list declared cold, where matching nobody is the finding rather than a fault", async () => {
    // The asymmetry the guard turns on, and the reason it reads the audience rather than the count.
    // A cold send to four numbers none of which has ever registered is the number that send was run
    // to get: people were reached and none of them arrived. Refusing it would refuse every honest
    // cold reading, a real sub-one-percent baseline included.
    const fixture = await build("cold-unmatched-is-a-finding", {
      lead: leads(["member-1", phone(90), from_cut(-30 * DAY)]),
      revenue: revenue(["member-1", from_cut(HOUR), 10]),
      lists: { "reached.txt": lines(phone(1), phone(2), phone(3), phone(4)) },
    });

    const record = await one(fixture, cold("cold-unmatched-is-a-finding", fixture.list("reached.txt")));

    expect(record.audience).toEqual({ listed: 4, matched_phones: 0, matched_accounts: 0 });
    expect(record.acquired.accounts).toBe(0);
    expect(record.conversions.count).toBe(0);
  });

  test("a cell whose list is drawn from a market the base is not in", async () => {
    // Every number in this list is valid, so no per-number check sees anything: the unreadable
    // rate is zero, the keys are well-formed, and the join simply misses. The case above is what
    // that looks like when it is honest — a cold send that nobody on it had ever registered — so
    // the record cannot tell the two apart and only the distribution can.
    //
    // It is also the shape a column that is not a phone column arrives in, which is the fault this
    // heuristic was added for: `20260805103000`-style timestamps fed to a keyer parsed
    // *successfully* into thousands of Egyptian numbers, so an unparseable-rate ceiling counting
    // failures never fired on any of them.
    const fixture = await build("refuse-market-divergence", {
      lead: leads(...keyed_accounts(READABLE)),
      lists: { "elsewhere.txt": lines(foreign(1), foreign(2), foreign(3), foreign(4)) },
    });

    const error = await caught(one(fixture, cold("refuse-market-divergence", fixture.list("elsewhere.txt"))));

    expect(error).toBeInstanceOf(MarketDivergenceError);
    expect((error as MarketDivergenceError).cell).toBe("refuse-market-divergence");
    // Disjoint, so the distance is the whole of it: nothing in this list shares a market with the
    // base, which is the only reading a total-variation distance of one can have.
    expect((error as MarketDivergenceError).divergence).toBe(1);
  });

  test("but the same list measures where the declaration says the campaign ran there", async () => {
    // A heuristic that cannot be overridden refuses the honest case: a campaign genuinely run in a
    // market the base is not mostly written in. The ceiling is a number on the call, and at one it
    // admits a list sharing nothing with the base — which is exactly the reading, zeros and all,
    // that the refusal above exists to stop anybody publishing by accident.
    const fixture = await build("market-divergence-declared", {
      lead: leads(...keyed_accounts(READABLE)),
      lists: { "elsewhere.txt": lines(foreign(1), foreign(2), foreign(3), foreign(4)) },
    });

    const [record] = await measure({
      source: files(fixture.dir),
      cells: [cold("market-divergence-declared", fixture.list("elsewhere.txt"))],
      max_market_divergence: 1,
      now: NOW,
    });

    expect(record?.audience).toEqual({ listed: 4, matched_phones: 0, matched_accounts: 0 });
  });

  test("and an own_base cell against a lead role with no rows, which is not the cell's fault", async () => {
    // The mis-blame the guard above opens if it only counts matches. A lead role of a header and
    // nothing else builds no index, so no cell of any audience can match — and a refusal naming
    // the cell sends the reader to check their column and their list file while the fault is in
    // the other file entirely.
    //
    // What the empty base itself gets is a refusal rather than a reading, which reverses an
    // earlier judgment and is worth stating: measuring against nobody produces zeros on every
    // count by construction, and a row of zeros is indistinguishable from a campaign that reached
    // nobody — the exact reading this engine exists to refuse. So the run stops, and it stops
    // naming the role that is empty rather than the cell that is fine.
    const fixture = await build("own-base-no-base-to-match", {
      lead: leads(),
      lists: { "reached.txt": lines(phone(1), phone(2), phone(3), phone(4)) },
    });

    const error = await caught(one(fixture, base("own-base-no-base-to-match", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(SourceError);
    expect((error as SourceError).role).toBe("lead");
    expect(error.message).toContain("answered a header and no rows");
    expect(error).not.toBeInstanceOf(UnmatchedBaseError);
    expect(error.message).not.toContain("own-base-no-base-to-match");
  });

  test("a total that overflows the range, on every one of the seven money fields", async () => {
    // The per-row check cannot see any of these: every amount below is a finite number that passes
    // it, and the sum is what leaves the range. `round_half_even` then hands a non-finite value
    // straight back — deliberately, it is exact integer arithmetic and has nothing to say about
    // infinity — and `JSON.stringify` writes it as `null`. That is the same `null` the record uses
    // for a role the source never answered, so the overflow publishes as a legitimate absence.
    //
    // Seven cases because there are seven call sites and a guard missing at one of them is a field
    // that still publishes the null. The two split fields are not folded into `conversions.value`:
    // a recycled row of the opposite sign between the two payments keeps the running total finite
    // while the new-money side of the same split still overflows, so each is reachable alone.
    const BIG = "9e307";
    const cases: readonly { field: string; parts: Parts }[] = [
      {
        field: "acquired.revenue.value",
        parts: {
          lead: leads(["late", phone(1), from_cut(2 * HOUR)]),
          revenue: revenue(["late", from_cut(3 * HOUR), BIG], ["late", from_cut(4 * HOUR), BIG]),
        },
      },
      {
        field: "pre_existing.revenue.value",
        parts: {
          lead: leads(["old", phone(1), from_cut(-DAY)]),
          revenue: revenue(["old", from_cut(3 * HOUR), BIG], ["old", from_cut(4 * HOUR), BIG]),
        },
      },
      {
        field: "acquired.churn.value",
        parts: {
          lead: leads(["late", phone(1), from_cut(2 * HOUR)]),
          churn: churn(["late", from_cut(3 * HOUR), BIG], ["late", from_cut(4 * HOUR), BIG]),
        },
      },
      {
        field: "pre_existing.churn.value",
        parts: {
          lead: leads(["old", phone(1), from_cut(-DAY)]),
          churn: churn(["old", from_cut(3 * HOUR), BIG], ["old", from_cut(4 * HOUR), BIG]),
        },
      },
      {
        field: "conversions.value",
        parts: {
          lead: leads(["late", phone(1), from_cut(2 * HOUR)]),
          conversion: conversions(
            ["late", from_cut(3 * HOUR), BIG, "true", "false"],
            ["late", from_cut(4 * HOUR), BIG, "true", "false"],
          ),
        },
      },
      {
        field: "conversions.new_money",
        parts: {
          lead: leads(["late", phone(1), from_cut(2 * HOUR)]),
          conversion: conversions(
            ["late", from_cut(3 * HOUR), BIG, "true", "false"],
            ["late", from_cut(4 * HOUR), `-${BIG}`, "true", "true"],
            ["late", from_cut(5 * HOUR), BIG, "true", "false"],
          ),
        },
      },
      {
        field: "conversions.recycled",
        parts: {
          lead: leads(["late", phone(1), from_cut(2 * HOUR)]),
          conversion: conversions(
            ["late", from_cut(3 * HOUR), `-${BIG}`, "true", "true"],
            ["late", from_cut(4 * HOUR), BIG, "true", "false"],
            ["late", from_cut(5 * HOUR), `-${BIG}`, "true", "true"],
          ),
        },
      },
    ];

    for (const { field, parts } of cases) {
      const name = `refuse-overflow-${field.replaceAll(".", "-")}`;
      const fixture = await build(name, { ...parts, lists: { "reached.txt": lines(phone(1)) } });

      const error = await caught(one(fixture, cold(name, fixture.list("reached.txt"))));

      expect(error).toBeInstanceOf(OverflowedTotalError);
      // The field by its own dotted path, so the sentence names the number the reader is looking at
      // rather than the role behind it. A guard copied to a second site with the first site's label
      // sends them to the wrong line of the record.
      expect((error as OverflowedTotalError).field).toBe(field);
      expect((error as OverflowedTotalError).cell).toBe(name);
    }
  });

  test("a role whose header names one column twice, where the run reads that name", async () => {
    // The duplicate defeats the check that exists to catch a wrong column: `phone` is in the
    // header, so the presence check passes, and only the second column of that name survives into
    // each row — so the run reads whatever the second column holds and joins on nothing. Measured
    // against the reader as it stood at `08a5548`, before this guard existed, the same shape
    // published `matched_phones: 0` and `conversions.value: 0` for two people who both held
    // accounts and both converted — against a truth of 2 and 100, and no word of it anywhere.
    const fixture = await build("refuse-duplicate-column", {
      lead: csv(["id", "phone", "created_at", "phone"], [["one", phone(1), from_cut(HOUR), phone(999)]]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-duplicate-column", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(DuplicateColumnError);
    expect((error as DuplicateColumnError).column).toBe("phone");
    // What reads the column, because the sentence used to assert a binding whatever had triggered
    // it — and on a file where nothing read the repeated name, that sent the reader hunting for a
    // declaration that was never there.
    expect(error.message).toContain("The lead role reads it");
  });

  test("but not a duplicate among the columns nothing reads", async () => {
    // `note` is repeated and no role binds it. Nothing in the run ever looks that name up, the
    // record loses only a column nobody wanted, and every number below is the one this export
    // really carries. Refusing it stopped a correct reading over a sentence about a binding that
    // did not exist.
    const fixture = await build("duplicate-unread-column", {
      lead: csv(
        ["id", "phone", "created_at", "note", "note"],
        [
          ["one", phone(1), from_cut(-DAY), "called", "left a message"],
          ["two", phone(2), from_cut(-DAY), "called", "no answer"],
        ],
      ),
      conversion: conversions(["one", from_cut(HOUR), 50, "true", "false"]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const record = await one(fixture, cold("duplicate-unread-column", fixture.list("reached.txt")));

    expect(record.audience).toEqual({ listed: 2, matched_phones: 2, matched_accounts: 2 });
    expect(record.conversions.count).toBe(1);
  });

  test("and not one in a list beside the column the cell reads", async () => {
    // The same file shape on the list side: a CRM export of the people who were sent to, with a
    // note column the spreadsheet duplicated on its way out. The cell names `phone`, so `note` is
    // read by nothing here either.
    const fixture = await build("duplicate-unread-list-column", {
      lead: leads(["one", phone(1), from_cut(-DAY)], ["two", phone(2), from_cut(-DAY)]),
      lists: {
        "roster.csv": csv(
          ["phone", "note", "note"],
          [
            [phone(1), "called", "left a message"],
            [phone(2), "called", "no answer"],
          ],
        ),
      },
    });

    const record = await one(
      fixture,
      cold("duplicate-unread-list-column", fixture.list("roster.csv"), { column: "phone" }),
    );

    expect(record.audience.matched_phones).toBe(2);
  });

  test("but a list read on the column its own header names twice is refused", async () => {
    // The list-side core case, and the same silence. The second `handset` holds numbers this cell
    // never reached; read from it, the cell is measured against strangers and publishes them
    // under its own name.
    const fixture = await build("refuse-duplicate-list-column", {
      lead: leads(["one", phone(1), from_cut(-DAY)], ["two", phone(2), from_cut(-DAY)]),
      lists: { "roster.csv": csv(["handset", "note", "handset"], [[phone(1), "called", phone(2)]]) },
    });

    const error = await caught(
      one(fixture, cold("refuse-duplicate-list-column", fixture.list("roster.csv"), { column: "handset" })),
    );

    expect(error).toBeInstanceOf(DuplicateColumnError);
    expect((error as DuplicateColumnError).column).toBe("handset");
    expect(error.message).toContain("This cell reads its identifiers from it");
  });

  test("and so is a list whose filter matches on a column named twice", async () => {
    // The filter decides which rows are this cell at all. Matched against the second column of
    // the name, it selects a different slice of the same file and reports that slice here.
    const fixture = await build("refuse-duplicate-filter-column", {
      lead: leads(["one", phone(1), from_cut(-DAY)], ["two", phone(2), from_cut(-DAY)]),
      lists: {
        "roster.csv": csv(
          ["handset", "cell", "cell"],
          [
            [phone(1), "alpha", "beta"],
            [phone(2), "beta", "alpha"],
          ],
        ),
      },
    });

    const error = await caught(
      one(fixture, {
        name: "refuse-duplicate-filter-column",
        cut: CUT,
        lists: [fixture.list("roster.csv")],
        column: "handset",
        filter: { column: "cell", value: "alpha" },
        audience: "cold",
      }),
    );

    expect(error).toBeInstanceOf(DuplicateColumnError);
    expect((error as DuplicateColumnError).column).toBe("cell");
    expect(error.message).toContain("This cell's filter matches on it");
  });

  test("and a list with no column declared, whose first column is the name repeated", async () => {
    // Nothing names a column here, so the reader takes the first — and the header repeats it, so
    // the record holds the second. The narrowing has to resolve that default before it can know
    // the name is read at all, and a check that only looked at what the declaration spelled out
    // would pass this file straight through.
    const fixture = await build("refuse-duplicate-default-column", {
      lead: leads(["one", phone(1), from_cut(-DAY)]),
      lists: { "roster.csv": csv(["handset", "handset"], [[phone(1), phone(2)]]) },
    });

    const error = await caught(one(fixture, cold("refuse-duplicate-default-column", fixture.list("roster.csv"))));

    expect(error).toBeInstanceOf(DuplicateColumnError);
    expect((error as DuplicateColumnError).column).toBe("handset");
  });

  test("a list whose quoted field never closes, which would swallow every row below it", async () => {
    // The scanner is a real RFC 4180 reader and was proven identical to the reference one this
    // engine replaced — except here, where an unterminated quote reads the rest of the file as a
    // single field. No parse error, no short row: the list simply ends at the stray quote and
    // the identifiers below it are never measured.
    const fixture = await build("refuse-unterminated-quote", {
      lead: leads(
        ["one", phone(1), from_cut(HOUR)],
        ["two", phone(2), from_cut(HOUR)],
        ["three", phone(3), from_cut(HOUR)],
      ),
      lists: { "roster.csv": `handset,note\n${phone(1)},fine\n${phone(2)},"unclosed\n${phone(3)},fine\n` },
    });

    const error = await caught(
      one(fixture, cold("refuse-unterminated-quote", fixture.list("roster.csv"), { column: "handset" })),
    );

    expect(error).toBeInstanceOf(UnterminatedQuoteError);
    // The line the quote opened on, not the end of the file where the fault surfaces.
    expect((error as UnterminatedQuoteError).line).toBe(3);
  });

  test("a text list declared with a column it has nowhere to hold", async () => {
    const fixture = await build("refuse-txt-column", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(
      one(fixture, cold("refuse-txt-column", fixture.list("reached.txt"), { column: "handset" })),
    );

    expect(error).toBeInstanceOf(TextListOptionError);
    expect(error.message).toContain("handset");
  });

  test("a text list declared with a filter, which would measure the whole file under one name", async () => {
    // Ignored, the cell reports every line in the file under the name of the slice that was
    // asked for. That is not a wider number with the same meaning; it is a different population
    // wearing this cell's label.
    const fixture = await build("refuse-txt-filter", {
      lead: leads(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(
      one(fixture, cold("refuse-txt-filter", fixture.list("reached.txt"), { filter: { column: "cell", value: "a" } })),
    );

    expect(error).toBeInstanceOf(TextListOptionError);
    expect((error as TextListOptionError).options).toEqual(['filter on "cell"']);
  });

  test("an identifier column the list does not carry, rather than a fall back to the first one", async () => {
    // The declaration says `handset` and the export was written with `msisdn`. Falling back to the
    // first column reads the ticket numbers as phones: none of them parses, the cell matches
    // nobody, and what surfaces is either an unreadable-share complaint or an empty audience —
    // both of which point the reader at the numbers instead of at the one word that is wrong in
    // the declaration.
    const fixture = await build("refuse-missing-identifier-column", {
      lead: leads(["a1", phone(1), from_cut(HOUR)]),
      lists: { "roster.csv": `ticket,msisdn\nT-1,${phone(1)}\n` },
    });

    const error = await caught(
      one(fixture, cold("refuse-missing-identifier-column", fixture.list("roster.csv"), { column: "handset" })),
    );

    expect(error).toBeInstanceOf(MissingColumnError);
    expect((error as MissingColumnError).column).toBe("handset");
    // The header as scanned, so the reader can see the name the export actually used.
    expect(error.message).toContain('"msisdn"');
  });

  test("a filter naming a column the list does not carry, named as itself", async () => {
    // The phone column here is right and the filter column is wrong. Unchecked, the filter
    // matches no row, the cell comes out empty, and the error names the phone column — sending
    // the reader to correct the one binding that was correct.
    const fixture = await build("refuse-filter-column", {
      lead: leads(["a1", phone(1), from_cut(HOUR)]),
      lists: { "roster.csv": `handset,cell\n${phone(1)},alpha\n` },
    });

    const error = await caught(
      one(fixture, {
        name: "refuse-filter-column",
        cut: CUT,
        lists: [fixture.list("roster.csv")],
        column: "handset",
        filter: { column: "celula", value: "alpha" },
        audience: "cold",
      }),
    );

    expect(error).toBeInstanceOf(MissingColumnError);
    expect((error as MissingColumnError).column).toBe("celula");
  });

  test("a cut later than the moment of the reading", async () => {
    // A planning date left in place after the send slipped. The window comes out negative, every
    // comparison against the cut excludes everything, and the record reads as a campaign that
    // reached people and produced nothing.
    const fixture = await build("refuse-future-cut", {
      lead: leads(["one", phone(1), from_cut(-DAY)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("planned", fixture.list("reached.txt"), { cut: from_cut(31 * DAY) })));

    expect(error).toBeInstanceOf(CellDeclarationError);
    expect((error as CellDeclarationError).cell).toBe("planned");
    // Both instants, because the fault is the pair and not either one alone.
    expect(error.message).toContain(from_cut(31 * DAY));
    expect(error.message).toContain(NOW.toISOString());
  });

  test("but not a cut at the exact moment of the reading, which is a zero-hour window", async () => {
    const fixture = await build("cut-at-the-reading", {
      lead: leads(["one", phone(1), from_cut(-DAY)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(
      fixture,
      cold("cut-at-the-reading", fixture.list("reached.txt"), { cut: NOW.toISOString() }),
    );

    expect(record.window_hours).toBe(0);
    expect(record.pre_existing.accounts).toBe(1);
  });

  test("and one a single millisecond past it, which is where a skew tolerance would begin", async () => {
    // The pair above is gross — a cut thirty-one days out against a reading at thirty — so it
    // stays refused under any tolerance somebody widens this check by. And somebody will: the cut
    // is written by whoever ran the send, the reading is taken wherever the script runs, and
    // "allow an hour of clock skew between two hosts" sounds like housekeeping. It is not. A cut
    // inside such a tolerance is still a cut nothing has reached yet: one millisecond ahead
    // floors `window_hours` to -1, every comparison against the cut excludes every account and
    // every event, and what gets published is a full row of zeros under a negative window.
    const fixture = await build("refuse-future-cut-by-one", {
      lead: leads(["one", phone(1), from_cut(-DAY)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const one_past = new Date(NOW.getTime() + 1).toISOString();
    const error = await caught(one(fixture, cold("skewed", fixture.list("reached.txt"), { cut: one_past })));

    expect(error).toBeInstanceOf(CellDeclarationError);
    expect((error as CellDeclarationError).cell).toBe("skewed");
    expect(error.message).toContain(one_past);
    expect(error.message).toContain(NOW.toISOString());
  });

  test("a control pair whose arms share members, which is not two samples", async () => {
    // The four checks a pair already passes say nothing about who is in it. A control drawn as
    // "everyone we did not send to" from a list that had already been extended carries the
    // treated numbers back, and every shared person is counted as evidence on both sides: the
    // control drifts towards the treated arm and whatever difference survives is an artefact of
    // how the lists were drawn, published with a p-value on top.
    const fixture = await build("refuse-control-overlap", {
      lead: leads(["a", phone(1), from_cut(HOUR)], ["b", phone(2), from_cut(HOUR)], ["c", phone(3), from_cut(-DAY)]),
      lists: {
        "treated.txt": lines(phone(1), phone(2)),
        "untouched.txt": lines(phone(1), phone(2), phone(3)),
      },
    });

    const error = await caught(
      measure({
        source: files(fixture.dir),
        cells: [cold("treated", fixture.list("treated.txt")), cold("untouched", fixture.list("untouched.txt"))],
        controls: [{ treated: "treated", control: "untouched", outcome: "acquired.accounts" }],
        now: NOW,
      }),
    );

    expect(error).toBeInstanceOf(ControlError);
    // The count, because two shared out of forty and forty shared out of forty are different
    // conversations with whoever drew the lists.
    expect(error.message).toContain("shares 2");
  });

  test("and one whose arms share a single identifier, which is where the refusal starts", async () => {
    // One person in both arms is already two samples that are not independent, and one is where
    // this arrives: a control drawn by hand keeps a row somebody had already sent to. The case
    // above shares two, so a refusal that began at the second would look correct there and let
    // this one through with `publishable: true` on a comparison of a group against itself minus
    // one member.
    const fixture = await build("refuse-control-overlap-one", {
      lead: leads(["a", phone(1), from_cut(HOUR)], ["b", phone(2), from_cut(HOUR)], ["c", phone(3), from_cut(-DAY)]),
      lists: {
        "treated.txt": lines(phone(1), phone(2)),
        "untouched.txt": lines(phone(2), phone(3)),
      },
    });

    const error = await caught(
      measure({
        source: files(fixture.dir),
        cells: [cold("treated", fixture.list("treated.txt")), cold("untouched", fixture.list("untouched.txt"))],
        controls: [{ treated: "treated", control: "untouched", outcome: "acquired.accounts" }],
        now: NOW,
      }),
    );

    expect(error).toBeInstanceOf(ControlError);
    expect(error.message).toContain("shares 1 of the 2 identifiers");
  });

  test("a pair naming one cell on both sides, which compares a group against itself", async () => {
    const fixture = await build("refuse-control-self", {
      lead: leads(["a", phone(1), from_cut(HOUR)], ["b", phone(2), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const error = await caught(
      measure({
        source: files(fixture.dir),
        cells: [cold("solo", fixture.list("reached.txt"))],
        controls: [{ treated: "solo", control: "solo", outcome: "acquired.accounts" }],
        now: NOW,
      }),
    );

    expect(error).toBeInstanceOf(ControlError);
    expect(error.message).toMatch(/both sides/);
  });
});

// ---------------------------------------------------------------------------------------------
// The referral tree
// ---------------------------------------------------------------------------------------------

describe("the referral tree counts who the cell brought in below it", () => {
  test("a lead role with no referrer column gets no `referrals` block rather than a row of zeros", async () => {
    const fixture = await build("down-unbound", {
      lead: leads(["member", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("down-unbound", fixture.list("reached.txt")));

    // Absent, not zero. A product with no referral network never names the column, and a block of
    // zeros would read as a network that grew by nobody.
    expect(record.referrals).toBeUndefined();
  });

  test("the two sides are never pre-summed, so a caller has to write the addition down", async () => {
    const fixture = await build("down-nosum", {
      lead: tree(
        ["fresh", phone(1), from_cut(HOUR), ""],
        ["older", phone(2), from_cut(-HOUR), ""],
        ["byfresh", phone(3), from_cut(2 * HOUR), "fresh"],
        ["byolder", phone(4), from_cut(2 * HOUR), "older"],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const record = await one(fixture, base("down-nosum", fixture.list("reached.txt")));

    // No combined total exists on the block. An untreated cell shows a large `under_pre_existing`
    // from ordinary referring, so summing the two is a decision a caller makes in the open rather
    // than one the record quietly makes for them.
    expect(record.referrals?.under_acquired.accounts).toBe(1);
    expect(record.referrals?.under_pre_existing.accounts).toBe(1);
    expect(record.referrals).not.toHaveProperty("accounts");
  });

  test("someone recruited by an acquired member counts, and lands under the acquired side", async () => {
    const fixture = await build("down-acquired", {
      lead: tree(
        ["member", phone(1), from_cut(HOUR), ""],
        ["recruit", phone(2), from_cut(2 * HOUR), "member"],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("down-acquired", fixture.list("reached.txt")));

    expect(record.acquired.accounts).toBe(1);
    expect(record.referrals?.under_acquired.accounts).toBe(1);
    expect(record.referrals?.under_pre_existing.accounts).toBe(0);
  });

  test("someone recruited by a member who predates the cut lands on the other side of the split", async () => {
    const fixture = await build("down-pre-existing", {
      lead: tree(
        ["member", phone(1), from_cut(-HOUR), ""],
        ["recruit", phone(2), from_cut(HOUR), "member"],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, base("down-pre-existing", fixture.list("reached.txt")));

    // The two are split because they are not the same claim: a member who was already there refers
    // people with or without a campaign, and a cell has no control for that unless one was declared.
    expect(record.referrals?.under_acquired.accounts).toBe(0);
    expect(record.referrals?.under_pre_existing.accounts).toBe(1);
  });

  test("the walk goes to the bottom of the tree, not one level down", async () => {
    const fixture = await build("down-depth", {
      lead: tree(
        ["member", phone(1), from_cut(HOUR), ""],
        ["child", phone(2), from_cut(2 * HOUR), "member"],
        ["grandchild", phone(3), from_cut(3 * HOUR), "child"],
        ["great", phone(4), from_cut(4 * HOUR), "grandchild"],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("down-depth", fixture.list("reached.txt")));

    // The package is told nothing about how many levels a program pays, so the whole subtree is
    // the only depth it can defend. A walk that stopped at the first level reports a third of this.
    expect(record.referrals?.under_acquired.accounts).toBe(3);
  });

  test("a recruiter who predates the cut is walked through but not counted", async () => {
    const fixture = await build("down-through", {
      lead: tree(
        ["member", phone(1), from_cut(HOUR), ""],
        ["older", phone(2), from_cut(-HOUR), "member"],
        ["arrival", phone(3), from_cut(2 * HOUR), "older"],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("down-through", fixture.list("reached.txt")));

    // `older` was already there, so they are not an arrival; the person they recruited after the
    // cut still is. Stopping the walk at `older` would lose them.
    expect(record.referrals?.under_acquired.accounts).toBe(1);
  });

  test("a descendant who is also on the list stays a member and is not counted twice", async () => {
    const fixture = await build("down-overlap", {
      lead: tree(
        ["member", phone(1), from_cut(HOUR), ""],
        ["both", phone(2), from_cut(2 * HOUR), "member"],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const record = await one(fixture, cold("down-overlap", fixture.list("reached.txt")));

    expect(record.acquired.accounts).toBe(2);
    expect(record.referrals?.under_acquired.accounts).toBe(0);
  });

  test("a descendant with no phone still counts, because the tree finds them and a list cannot", async () => {
    const fixture = await build("down-phoneless", {
      lead: tree(
        ["member", phone(1), from_cut(HOUR), ""],
        ["silent", "", from_cut(2 * HOUR), "member"],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("down-phoneless", fixture.list("reached.txt")));

    // Somebody who joined through a referral link may never have given a number. Indexing only the
    // phone-readable rows would drop them and understate every count below a cell.
    expect(record.referrals?.under_acquired.accounts).toBe(1);
  });

  test("a cycle in the tree terminates instead of hanging the run", async () => {
    const fixture = await build("down-cycle", {
      lead: tree(
        ["member", phone(1), from_cut(HOUR), ""],
        ["a", phone(2), from_cut(2 * HOUR), "member"],
        ["b", phone(3), from_cut(3 * HOUR), "a"],
        ["c", phone(4), from_cut(4 * HOUR), "b"],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    // `c` points back at `a`, which a tree assembled from parent pointers permits and a walk
    // without a visited set would follow forever.
    await Bun.write(
      join(fixture.dir, "lead.csv"),
      tree(
        ["member", phone(1), from_cut(HOUR), ""],
        ["a", phone(2), from_cut(2 * HOUR), "member"],
        ["b", phone(3), from_cut(3 * HOUR), "a"],
        ["c", phone(4), from_cut(4 * HOUR), "b"],
        ["a2", phone(5), from_cut(5 * HOUR), "c"],
      ),
    );

    const record = await one(fixture, cold("down-cycle", fixture.list("reached.txt")));

    expect(record.referrals?.under_acquired.accounts).toBe(4);
  });

  test("money and contracts below a cell are counted separately from the cell's own", async () => {
    const fixture = await build("down-money", {
      lead: tree(
        ["member", phone(1), from_cut(HOUR), ""],
        ["recruit", phone(2), from_cut(2 * HOUR), "member"],
      ),
      revenue: revenue(["recruit", from_cut(3 * HOUR), "50"]),
      conversion: conversions_unsplit(["recruit", from_cut(3 * HOUR), "50", "true"]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("down-money", fixture.list("reached.txt")));

    // The person referred is nobody's member, so the cell's own figures stay empty and the referral
    // carry it. Folding the two together would make a cell look like it converted people it never
    // reached.
    expect(record.conversions.count).toBe(0);
    expect(record.referrals?.under_acquired.conversions).toEqual({ count: 1, value: 50 });
    expect(record.referrals?.under_acquired.revenue).toEqual({ leads: 1, value: 50 });
  });
});

test("a provisional cut refuses a referral count it made, the same as any other count it dates", async () => {
  const fixture = await build("down-provisional", {
    lead: tree(
      ["member", phone(1), from_cut(-HOUR), ""],
      ["recruit", phone(2), from_cut(HOUR), "member"],
    ),
    lists: { "reached.txt": lines(phone(1)) },
  });

  // The cell itself acquired nobody, so every count the older guard watches is zero and the run
  // would have gone through. The referral count is not zero, and it is dated by the same cut.
  const failure = await caught(
    measure({
      source: files(fixture.dir),
      cells: [base("down-provisional", fixture.list("reached.txt"), { cut_provisional: true })],
      now: NOW,
    }),
  );

  expect(failure).toBeInstanceOf(ProvisionalCutError);
  expect(failure.message).toContain("referrals.under_pre_existing.accounts");
});
