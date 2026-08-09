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
  ExportJoinError,
  ExportStatusError,
  ExportValueError,
  is_publishable,
  MAX_P,
  MapStaleError,
  MIN_CONTROL_EVENTS,
  MissingColumnError,
  MissingExportError,
  measure,
  ProvisionalCutError,
  TextListOptionError,
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
 * Nothing in the fixtures is borrowed. `997` is not a dialling code any country answers on, no
 * market pairs a three-digit area code with a six-digit subscriber tail, and every table, column,
 * status and amount below was made up to exercise a branch.
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
 * Under this fixture's plan a nine-digit number is its own join key — three area digits plus six
 * subscriber digits, with no reform digit in play — so a list row and a person row join with
 * nothing in between for the reader to work out.
 */
function phone(n: number): string {
  return `480${String(n).padStart(6, "0")}`;
}

const SCHEMA = `// An invented schema. Two of these blocks are the ones the map lists by default.

model Member {
  id           String   @id
  handset      String
  enrolled_at  DateTime
}

model Movement {
  id         String   @id
  member_id  String
  amount     Int
}

model Unlisted {
  id String @id
}

enum Standing {
  LIVE
  SETTLED
  LAPSED
}

enum Funding {
  WIRE
  CREDIT
}
`;

const MODELS = ["Member", "Movement"] as const;

/**
 * The fingerprint rule, restated here rather than imported. Recomputing the digest by the same
 * rule is what makes the fresh-map case mean something; a literal copied from the implementation
 * would only prove that two files can hold the same string.
 *
 * A listed name is a model or an enum, and the rule does not care which — which is the whole
 * point of hashing enums: the statuses a map counts as committed and the marker that separates
 * recycled money from new one are enum values, and a rename there is invisible in every model.
 */
function digest_of(schema: string, blocks: readonly string[]): string {
  const lines = schema.split("\n");
  const hashed = blocks.map((name) => {
    const opener = new RegExp(`^\\s*(?:model|enum)\\s+${name}\\s*\\{`);
    const start = lines.findIndex((line) => opener.test(line));
    if (start === -1) {
      throw new Error(`the fixture has no block ${name}`);
    }
    let end = -1;
    for (let i = start + 1; i < lines.length; i += 1) {
      if (lines[i] === "}") {
        end = i;
        break;
      }
    }
    if (end === -1) {
      throw new Error(`the fixture never closes block ${name}`);
    }
    return lines.slice(start, end + 1).join("\n");
  });
  return new Bun.CryptoHasher("sha256").update(hashed.join("\n")).digest("hex");
}

const FRESH_SHA = digest_of(SCHEMA, MODELS);

// ---------------------------------------------------------------------------------------------
// Building a map
// ---------------------------------------------------------------------------------------------

type Rows = Record<string, string>;

function section(heading: string, rows: Rows): string {
  const lines = [heading, "", "| field | value |", "|---|---|"];
  for (const [field, value] of Object.entries(rows)) {
    lines.push(`| ${field} | ${value} |`);
  }
  return `${lines.join("\n")}\n`;
}

const PHONE_ROWS: Rows = {
  country_code: "997",
  area_digits: "3",
  subscriber_digits: "6",
  max_unparseable_rate: "0.25",
  shared_account_ceiling: "3",
};

const PERSON_ROWS: Rows = { export: "person.csv", id: "member_id", phone: "handset", created_at: "enrolled_at" };
const REVENUE_ROWS: Rows = { export: "revenue.csv", person: "member_id", at: "arrived_at", amount: "amount" };
const CHURN_ROWS: Rows = { export: "churn.csv", person: "member_id", at: "left_at", amount: "amount" };
const CONVERSION_ROWS: Rows = {
  export: "conversion.csv",
  person: "member_id",
  at: "signed_at",
  amount: "amount",
  status: "state",
  valid_statuses: "LIVE, SETTLED",
  split: "funding",
  recycled_when: "CREDIT",
};

type MapParts = {
  phone?: Rows;
  person?: Rows;
  conversion?: Rows;
  /** Present by default. `null` drops the section, leaving the role unbound. */
  revenue?: Rows | null;
  churn?: Rows | null;
  /** Drops `split` and `recycled_when`, for a project with no recycled-balance concept. */
  no_split?: boolean;
  /** Which schema blocks the fingerprint covers. Defaults to the two models; a case about a
   *  renamed status or split marker lists the enum that holds them. */
  models?: readonly string[];
  sha256?: string;
};

function render_map(parts: MapParts = {}): string {
  const conversion: Rows = { ...CONVERSION_ROWS, ...parts.conversion };
  if (parts.no_split === true) {
    delete conversion.split;
    delete conversion.recycled_when;
  }

  const out = [
    "# Database map\n",
    section("## Phone format", { ...PHONE_ROWS, ...parts.phone }),
    section("## Fingerprint", {
      schema: "db/schema.prisma",
      models: (parts.models ?? MODELS).join(", "),
      // Always the digest of the pristine schema, so a case that writes an edited one records the
      // hash taken before the edit — which is what drift is.
      sha256: parts.sha256 ?? digest_of(SCHEMA, parts.models ?? MODELS),
    }),
    section("## Role: person", { ...PERSON_ROWS, ...parts.person }),
    section("## Role: conversion", conversion),
  ];
  if (parts.revenue !== null) {
    out.push(section("## Role: revenue", { ...REVENUE_ROWS, ...parts.revenue }));
  }
  if (parts.churn !== null) {
    out.push(section("## Role: churn", { ...CHURN_ROWS, ...parts.churn }));
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------------------------
// Building exports and lists
// ---------------------------------------------------------------------------------------------

type Row = readonly (string | number)[];

function csv(header: readonly string[], rows: readonly Row[]): string {
  return `${[header.join(","), ...rows.map((row) => row.join(","))].join("\n")}\n`;
}

/** One row per account, not per person: a phone answering for several accounts appears twice. */
function people(...rows: readonly Row[]): string {
  return csv(["member_id", "handset", "enrolled_at"], rows);
}

function revenue(...rows: readonly Row[]): string {
  return csv(["member_id", "arrived_at", "amount"], rows);
}

function churn(...rows: readonly Row[]): string {
  return csv(["member_id", "left_at", "amount"], rows);
}

function conversions(...rows: readonly Row[]): string {
  return csv(["member_id", "signed_at", "amount", "state", "funding"], rows);
}

/** A `.txt` list: one identifier per line. */
function lines(...values: readonly string[]): string {
  return `${values.join("\n")}\n`;
}

type Parts = {
  map?: MapParts;
  /** `null` writes no schema file at all. */
  schema?: string | null;
  /** `null` leaves the role bound in the map with no file behind it. */
  person?: string | null;
  revenue?: string | null;
  churn?: string | null;
  conversion?: string | null;
  /** Filename to body. Written under the case's `lists/`. */
  lists?: Record<string, string>;
};

type Fixture = {
  map: string;
  exports: string;
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
  const exports = join(base, "exports");

  await Bun.write(join(base, "MAPPING.md"), render_map(parts.map));
  if (parts.schema !== null) {
    await Bun.write(join(base, "db", "schema.prisma"), parts.schema ?? SCHEMA);
  }

  const files: readonly (readonly [string, string | null])[] = [
    ["person.csv", parts.person === undefined ? people() : parts.person],
    ["revenue.csv", parts.revenue === undefined ? revenue() : parts.revenue],
    ["churn.csv", parts.churn === undefined ? churn() : parts.churn],
    ["conversion.csv", parts.conversion === undefined ? conversions() : parts.conversion],
  ];
  for (const [file, body] of files) {
    if (body !== null) {
      await Bun.write(join(exports, file), body);
    }
  }
  for (const [file, body] of Object.entries(parts.lists ?? {})) {
    await Bun.write(join(base, "lists", file), body);
  }

  return { map: join(base, "MAPPING.md"), exports, list: (file) => join(base, "lists", file) };
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
  const records = await measure({ map: fixture.map, exports: fixture.exports, cells: [cell], now });
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
      person: people(
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
      person: people(["dated", phone(1), from_cut(HOUR)], ["undated", phone(2), ""]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const record = await one(fixture, cold("cut-undated", fixture.list("reached.txt")));

    expect(record.audience.matched_accounts).toBe(2);
    expect(record.acquired.accounts).toBe(1);
    expect(record.pre_existing.accounts).toBe(0);
  });

  test("the within windows include their own boundary and exclude the millisecond after it", async () => {
    const fixture = await build("cut-windows", {
      person: people(
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
      person: people(
        ["on", phone(1), from_cut(-DAY)],
        ["early", phone(2), from_cut(-DAY)],
        ["void", phone(3), from_cut(-DAY)],
      ),
      revenue: revenue(["on", from_cut(0), 25], ["early", from_cut(-1), 99]),
      churn: churn(["on", from_cut(0), 5], ["early", from_cut(-1), 88]),
      conversion: conversions(
        ["on", from_cut(0), 10, "LIVE", "WIRE"],
        ["early", from_cut(-1), 77, "LIVE", "WIRE"],
        // A status outside the map's list is not a commitment, whenever it happened.
        ["void", from_cut(HOUR), 500, "LAPSED", "WIRE"],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2), phone(3)) },
    });

    const record = await one(fixture, cold("cut-events", fixture.list("reached.txt")));

    expect(record.pre_existing.accounts).toBe(3);
    expect(record.pre_existing.revenue).toEqual({ people: 1, value: 25 });
    expect(record.pre_existing.churn).toEqual({ people: 1, value: 5 });
    expect(record.conversions.count).toBe(1);
    expect(record.conversions.value).toBe(10);
  });

  test("a cut finer than a millisecond is refused rather than silently truncated", async () => {
    const fixture = await build("cut-precision", {
      person: people(["one", phone(1), from_cut(HOUR)]),
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
      person: people(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("cut-blank", fixture.list("reached.txt"), { cut: "   " })));

    expect(error).toBeInstanceOf(CellDeclarationError);
    expect(error.message).toMatch(/blank/i);
  });
});

// ---------------------------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------------------------

describe("matching a list against the person index", () => {
  test("one subscriber written several ways in one list counts once", async () => {
    const fixture = await build("match-forms", {
      person: people(["multi", "480224466", from_cut(HOUR)], ["other", "481224466", from_cut(HOUR)]),
      lists: {
        // The same subscriber as a mixed set of sources writes it: with the dialling prefix and
        // the reform digit, with the prefix alone, bare with the reform digit, and bare.
        "reached.txt": lines("9974807224466", "997480224466", "4807224466", "480224466", "481224466"),
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
      person: people(["old", phone(10), from_cut(-DAY)], ["new", phone(10), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(10)) },
    });

    const record = await one(fixture, cold("match-two-accounts", fixture.list("reached.txt")));

    expect(record.audience).toEqual({ listed: 1, matched_phones: 1, matched_accounts: 2 });
    // Each account is placed against the cut on its own, so one phone can land on both sides.
    expect(record.pre_existing.accounts).toBe(1);
    expect(record.acquired.accounts).toBe(1);
  });

  test("a phone at the shared ceiling is evicted before matching, so it cannot inflate a cell", async () => {
    // The ceiling is three here. Left in the index, the switchboard below would hand this cell
    // three arrivals it never reached — the failure the eviction exists to prevent — and it is
    // the *matching* that must not see it, not merely the reported total.
    const fixture = await build("match-ceiling", {
      person: people(
        ["desk-a", phone(20), from_cut(HOUR)],
        ["desk-b", phone(20), from_cut(HOUR)],
        ["desk-c", phone(20), from_cut(HOUR)],
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
    // The ceiling is `at or above`, not `above`. Two accounts under a ceiling of three survive,
    // which is what pins the comparison rather than merely the constant.
    const fixture = await build("match-under-ceiling", {
      person: people(["pair-a", phone(22), from_cut(HOUR)], ["pair-b", phone(22), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(22)) },
    });

    const record = await one(fixture, cold("match-under-ceiling", fixture.list("reached.txt")));

    expect(record.audience.matched_accounts).toBe(2);
    expect(record.acquired.accounts).toBe(2);
  });

  test("a filter cuts one cell out of a file holding several", async () => {
    const fixture = await build("match-filter", {
      person: people(
        ["a1", phone(1), from_cut(HOUR)],
        ["b1", phone(2), from_cut(HOUR)],
        ["a2", phone(3), from_cut(HOUR)],
      ),
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
      person: people(
        ["a1", phone(1), from_cut(HOUR)],
        ["a2", phone(2), from_cut(HOUR)],
        ["b1", phone(3), from_cut(HOUR)],
      ),
      lists: {
        "roster.csv":
          "\uFEFFhandset,cohort\n" +
          `${phone(1)},"evening, the ""late"" batch"\n` +
          `${phone(2)},"evening, the ""late"" batch"\n` +
          `${phone(3)}\n`,
      },
    });

    const records = await measure({
      map: fixture.map,
      exports: fixture.exports,
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
      person: people(["a1", phone(1), from_cut(HOUR)], ["b1", phone(2), from_cut(HOUR)]),
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
      person: people(
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
      // by derived key, so the three ways a planted number reaches a declaration — copied with
      // its dialling prefix, pasted out of a spreadsheet with spaces, typed bare — all subtract
      // the same person. The refusal for entries that yield no key must not narrow this to one
      // spelling.
      cold("match-exclude", fixture.list("reached.txt"), {
        exclude: [`997${phone(2)}`, "480 000 003", phone(4)],
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
      person: people(...ids.map((id, i) => [id, phone(i + 1), from_cut(HOUR)] as Row)),
      revenue: revenue(...ids.map((id, i) => [id, from_cut((i + 1) * DAY), amounts[i] as number] as Row)),
      lists: { "reached.txt": lines(...ids.map((_, i) => phone(i + 1))) },
    });
    return one(fixture, cold(name, fixture.list("reached.txt")));
  }

  test("is null when nobody paid, because the question is meaningless", async () => {
    const fixture = await build("top2-none", {
      person: people(["quiet", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("top2-none", fixture.list("reached.txt")));

    expect(record.acquired.revenue).toEqual({ people: 0, value: 0, top2_share: null, median_lag_days: null });
  });

  test("is null when exactly one person paid, because there is no second to compare", async () => {
    const record = await paid("top2-one", [40]);

    expect(record.acquired.revenue?.people).toBe(1);
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
    // A zero-value event still counts its person: they did transact. The share then says that
    // the total belongs to one of them, which is exactly the fact worth surfacing.
    const record = await paid("top2-all-one", [100, 0, 0]);

    expect(record.acquired.revenue?.people).toBe(3);
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

    expect(record.acquired.revenue?.people).toBe(3);
    expect(record.acquired.revenue?.value).toBe(5);
    expect(record.acquired.revenue?.top2_share).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// The emitted record
// ---------------------------------------------------------------------------------------------

describe("the emitted record", () => {
  async function shape_fixture(): Promise<Fixture> {
    return build("record-shape", {
      person: people(["fresh", phone(1), from_cut(2 * HOUR)], ["existing", phone(2), from_cut(-DAY)]),
      revenue: revenue(["fresh", from_cut(3 * HOUR), 12.5]),
      churn: churn(["existing", from_cut(DAY), 3]),
      conversion: conversions(["fresh", from_cut(4 * HOUR), 12.5, "LIVE", "WIRE"]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });
  }

  test("carries every role the map bound, and dates itself", async () => {
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
        revenue: { people: 1, value: 12.5, top2_share: null, median_lag_days: 0.1 },
        churn: { people: 0, value: 0 },
      },
      pre_existing: {
        accounts: 1,
        revenue: { people: 0, value: 0 },
        churn: { people: 1, value: 3 },
      },
      conversions: { count: 1, value: 12.5, new_money: 12.5, recycled: 0 },
    });
  });

  test("omits a role the map never bound rather than reporting it as a measured zero", async () => {
    // Unbound and empty are different facts, and a zero for a role a project does not have is
    // a number someone will eventually try to explain.
    const fixture = await build("record-unbound", {
      map: { revenue: null, churn: null },
      person: people(["one", phone(1), from_cut(HOUR)]),
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
      "acquired.revenue.people",
      "acquired.churn.people",
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
      person: people(["fresh", phone(1), from_cut(2 * HOUR)], ["existing", phone(2), from_cut(-DAY)]),
      revenue: revenue(["fresh", from_cut(3 * HOUR), 12.5], ["existing", from_cut(3 * HOUR), 8]),
      churn: churn(["fresh", from_cut(DAY), 3], ["existing", from_cut(DAY), 3]),
      conversion: conversions(["fresh", from_cut(4 * HOUR), 12.5, "LIVE", "WIRE"]),
      lists: { "treated.txt": lines(phone(1)), "untouched.txt": lines(phone(2)) },
    });

    // The audience is a declaration, not something derived from the data, so the same two cells
    // can be offered under either label and the answer is the rule's alone.
    const readable_by = async (outcome: string, audience: Cell["audience"]): Promise<boolean> => {
      try {
        await measure({
          map: fixture.map,
          exports: fixture.exports,
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
      person: people(["a", phone(1), from_cut(HOUR)], ["b", phone(2), from_cut(-DAY)]),
      lists: { "alpha.txt": lines(phone(1)), "beta.txt": lines(phone(2)) },
    });

    const records = await measure({
      map: fixture.map,
      exports: fixture.exports,
      cells: [cold("alpha", fixture.list("alpha.txt")), cold("beta", fixture.list("beta.txt"))],
      now: NOW,
    });

    expect(records.map((record) => record.cell)).toEqual(["alpha", "beta"]);
    expect(records[0]?.acquired.accounts).toBe(1);
    expect(records[1]?.acquired.accounts).toBe(0);
    expect(records[1]?.pre_existing.accounts).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------
// The conversion split
// ---------------------------------------------------------------------------------------------

describe("the conversion split", () => {
  const two_conversions = conversions(
    ["one", from_cut(HOUR), 60, "LIVE", "WIRE"],
    ["one", from_cut(2 * HOUR), 40, "SETTLED", "CREDIT"],
  );

  test("divides committed money when the map declares it", async () => {
    const fixture = await build("split-declared", {
      person: people(["one", phone(1), from_cut(HOUR)]),
      conversion: two_conversions,
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("split-declared", fixture.list("reached.txt")));

    expect(record.conversions).toEqual({ count: 2, value: 100, new_money: 60, recycled: 40 });
  });

  test("omits the split fields entirely when the map does not declare one", async () => {
    // A recycled balance is a property of one kind of product. Requiring every project to
    // declare the concept produced two fields of zeros wherever it does not exist, and a zero
    // that looks like a measurement is the expensive failure here.
    const fixture = await build("split-absent", {
      map: { no_split: true },
      person: people(["one", phone(1), from_cut(HOUR)]),
      conversion: two_conversions,
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("split-absent", fixture.list("reached.txt")));

    expect(record.conversions).toEqual({ count: 2, value: 100 });
    expect("new_money" in record.conversions).toBe(false);
    expect("recycled" in record.conversions).toBe(false);
  });

  test("falls back to a second timestamp column where the map names one", async () => {
    // The commitment timestamp is nullable on this role, and empty is what unset looks like in
    // an export. Without the fallback the event drops out and the cell loses a conversion.
    const fixture = await build("split-fallback", {
      map: { conversion: { at_fallback: "opened_at" } },
      person: people(["one", phone(1), from_cut(HOUR)]),
      conversion: csv(
        ["member_id", "signed_at", "opened_at", "amount", "state", "funding"],
        [["one", "", from_cut(2 * HOUR), 30, "LIVE", "WIRE"]],
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
      map: { conversion: { at_fallback: "opened_at" } },
      person: people(["one", phone(1), from_cut(HOUR)]),
      conversion: csv(
        ["member_id", "signed_at", "opened_at", "amount", "state", "funding"],
        [["one", from_cut(2 * HOUR), from_cut(-2 * HOUR), 30, "LIVE", "WIRE"]],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("split-fallback-precedence", fixture.list("reached.txt")));

    expect(record.conversions.count).toBe(1);
    expect(record.conversions.value).toBe(30);
  });
});

// ---------------------------------------------------------------------------------------------
// Drift inside an enum
// ---------------------------------------------------------------------------------------------

/**
 * The two values a map reads that are not columns: the statuses it counts as committed, and the
 * marker that separates recycled money from new. Both are enum values, both live outside every
 * model block, and a migration renaming one of them changes what every binding means while
 * leaving the hashed schema byte-identical. The status half has a runtime refusal of its own
 * further down, because a status nobody matches drops the whole file. The split half has none
 * and can have none — a file where nothing was paid out of a balance is an ordinary month — so
 * the fingerprint is the only place it can be caught, and only if the map lists the enum.
 */
describe("a marker renamed inside the schema's enum", () => {
  /** The export as it reads after a migration renamed the recycled marker to `LEDGER`. */
  const after_rename = conversions(
    ["one", from_cut(HOUR), 60, "LIVE", "WIRE"],
    ["one", from_cut(2 * HOUR), 40, "SETTLED", "LEDGER"],
  );
  const renamed_schema = SCHEMA.replace("  CREDIT", "  LEDGER");

  test("silently doubles what is reported as new money while the map lists only models", async () => {
    // Nothing here is malformed. Forty of the hundred was recycled from a balance the business
    // already held, the map still looks for `CREDIT`, and the row now says `LEDGER` — so the
    // whole sum falls through to the other side of the split and the report says every unit of
    // it was fresh. The models the map hashes did not move, so the fingerprint passes.
    const fixture = await build("enum-drift-silent", {
      schema: renamed_schema,
      person: people(["one", phone(1), from_cut(HOUR)]),
      conversion: after_rename,
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("enum-drift-silent", fixture.list("reached.txt")));

    expect(record.conversions).toEqual({ count: 2, value: 100, new_money: 100, recycled: 0 });
  });

  test("stops the run once the map lists the enum that holds it", async () => {
    // The same rename against the same export, with `Funding` added to the map's hashed blocks.
    // The fingerprint now covers the one place the value lives, so the run refuses before it
    // reads an export — which is the whole reason a map is allowed to list an enum at all.
    const fixture = await build("enum-drift-caught", {
      map: { models: [...MODELS, "Funding"] },
      schema: renamed_schema,
      person: people(["one", phone(1), from_cut(HOUR)]),
      conversion: after_rename,
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("enum-drift-caught", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(MapStaleError);
    expect((error as MapStaleError).expected).toBe(digest_of(SCHEMA, [...MODELS, "Funding"]));
    expect((error as MapStaleError).actual).toBe(digest_of(renamed_schema, [...MODELS, "Funding"]));
  });

  test("and leaves a schema whose enums are untouched passing, with the enum listed", async () => {
    // The listing itself must not become a permanent mismatch: a map naming an enum against the
    // schema it was hashed from reads clean, or nobody would add one.
    const fixture = await build("enum-listed-fresh", {
      map: { models: [...MODELS, "Funding", "Standing"] },
      person: people(["one", phone(1), from_cut(HOUR)]),
      conversion: conversions(["one", from_cut(HOUR), 60, "LIVE", "CREDIT"]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("enum-listed-fresh", fixture.list("reached.txt")));

    expect(record.conversions).toEqual({ count: 1, value: 60, new_money: 0, recycled: 60 });
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
    const person_rows: Row[] = [];
    const conversion_rows: Row[] = [];
    const treated_list: string[] = [];
    const control_list: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      treated_list.push(phone(100 + i));
      control_list.push(phone(200 + i));
      person_rows.push([`t${i}`, phone(100 + i), from_cut(-DAY)]);
      person_rows.push([`c${i}`, phone(200 + i), from_cut(-DAY)]);
      if (i < 30) {
        conversion_rows.push([`t${i}`, from_cut(HOUR), 10, "LIVE", "WIRE"]);
      }
      if (i < 12) {
        conversion_rows.push([`c${i}`, from_cut(HOUR), 10, "LIVE", "WIRE"]);
      }
    }
    return build(name, {
      person: people(...person_rows),
      conversion: conversions(...conversion_rows),
      lists: { "treated.txt": lines(...treated_list), "untouched.txt": lines(...control_list) },
    });
  }

  test("measures normally while nobody has arrived, and says so on the record", async () => {
    const fixture = await build("provisional-quiet", {
      person: people(["old", phone(1), from_cut(-DAY)]),
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

  test("refuses once anybody has arrived, and names the cell and the count", async () => {
    // A placeholder cut is not a moment of contact, so arrivals after it cannot be attributed
    // to anything. This is the documented way a report once claimed arrivals that never
    // happened, and it is the reason the flag exists at all.
    const fixture = await build("provisional-arrivals", {
      person: people(
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
    // a ControlError here would send the reader after the wrong problem.
    const fixture = await build("provisional-control", {
      person: people(["new", phone(1), from_cut(HOUR)], ["old", phone(2), from_cut(-DAY)]),
      lists: { "treated.txt": lines(phone(1)), "untouched.txt": lines(phone(2)) },
    });

    const error = await caught(
      measure({
        map: fixture.map,
        exports: fixture.exports,
        cells: [
          cold("treated", fixture.list("treated.txt"), { cut_provisional: true }),
          cold("untouched", fixture.list("untouched.txt")),
        ],
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
        map: fixture.map,
        exports: fixture.exports,
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
      map: fixture.map,
      exports: fixture.exports,
      cells: [base("confirmed", fixture.list("treated.txt")), base("untouched", fixture.list("untouched.txt"))],
      controls: [{ treated: "confirmed", control: "untouched", outcome: "conversions.count" }],
      now: NOW,
    });

    expect(treated?.control?.control_events).toBe(12);
    expect(treated?.control?.publishable).toBe(true);
  });

  test("refuses on money counted forward from the guess even where nobody committed", async () => {
    // `pre_existing.revenue.people` counts people who were already there and then paid after the
    // cut. Nothing arrived and nothing was committed, so neither of the two obvious counts is
    // non-zero, and the payment is still dated against a guess. A guard that stopped at arrivals
    // and commitments would let this one through.
    const fixture = await build("provisional-money", {
      person: people(["old", phone(1), from_cut(-DAY)]),
      revenue: revenue(["old", from_cut(2 * HOUR), 40]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("guessed", fixture.list("reached.txt"), { cut_provisional: true })));

    expect(error).toBeInstanceOf(ProvisionalCutError);
    expect(error.message).toContain("pre_existing.revenue.people 1");
  });

  test("still measures an own_base cell with a guessed cut and nothing counted against it", async () => {
    // The widened guard must not swallow the case the flag exists to allow. `pre_existing
    // .accounts` is non-zero on every own_base cell by construction — it is the audience, not an
    // outcome — so reading it as something to attribute would refuse every provisional cut ever
    // declared on a base and leave the flag with no legal use at all.
    const fixture = await build("provisional-own-base-quiet", {
      person: people(["old", phone(1), from_cut(-DAY)]),
      conversion: conversions(["old", from_cut(-HOUR), 50, "LIVE", "WIRE"]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, base("quiet-base", fixture.list("reached.txt"), { cut_provisional: true }));

    expect(record.pre_existing.accounts).toBe(1);
    expect(record.conversions.count).toBe(0);
    expect(record.cut_provisional).toBe(true);
  });

  test("leaves the key off a cell whose cut is confirmed", async () => {
    const fixture = await build("provisional-absent", {
      person: people(["one", phone(1), from_cut(HOUR)]),
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
    const person_rows: Row[] = [];
    const treated_list: string[] = [];
    const control_list: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      const treated = phone(100 + i);
      const control = phone(200 + i);
      treated_list.push(treated);
      control_list.push(control);
      person_rows.push([`t${i}`, treated, from_cut(i < 28 ? HOUR : -DAY)]);
      person_rows.push([`c${i}`, control, from_cut(i < control_arrivals ? HOUR : -DAY)]);
    }
    return build(name, {
      person: people(...person_rows),
      lists: { "treated.txt": lines(...treated_list), "untouched.txt": lines(...control_list) },
    });
  }

  async function read(fixture: Fixture, now: Date): Promise<CellRecord[]> {
    return measure({
      map: fixture.map,
      exports: fixture.exports,
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
      person: people(
        ["t1", phone(1), from_cut(-DAY)],
        ["t2", phone(2), from_cut(-DAY)],
        ["c1", phone(3), from_cut(-DAY)],
        ["c2", phone(4), from_cut(-DAY)],
      ),
      conversion: conversions(
        ["t1", from_cut(HOUR), 10, "LIVE", "WIRE"],
        ["t2", from_cut(HOUR), 20, "SETTLED", "WIRE"],
      ),
      lists: { "treated.txt": lines(phone(1), phone(2)), "untouched.txt": lines(phone(3), phone(4)) },
    });

    const [treated] = await measure({
      map: fixture.map,
      exports: fixture.exports,
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
  test("a stale fingerprint, before reading a single export", async () => {
    const fixture = await build("refuse-stale", {
      map: { sha256: "0".repeat(64) },
      person: null,
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-stale", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(MapStaleError);
    expect((error as MapStaleError).actual).toBe(FRESH_SHA);
    expect((error as MapStaleError).expected).toBe("0".repeat(64));
  });

  test("a person export that is not where the map says it is", async () => {
    const fixture = await build("refuse-missing-person", {
      person: null,
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-missing-person", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(MissingExportError);
    expect((error as MissingExportError).path).toContain("person.csv");
    expect(error.message).toMatch(/person/i);
  });

  test("a bound role whose export was never produced", async () => {
    const fixture = await build("refuse-missing-revenue", {
      person: people(["one", phone(1), from_cut(HOUR)]),
      revenue: null,
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-missing-revenue", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(MissingExportError);
    expect((error as MissingExportError).path).toContain("revenue.csv");
    expect(error.message).toMatch(/revenue/i);
  });

  test("a list file the cell names and nobody produced", async () => {
    const fixture = await build("refuse-missing-list", {
      person: people(["one", phone(1), from_cut(HOUR)]),
    });

    const error = await caught(one(fixture, cold("refuse-missing-list", fixture.list("never-written.txt"))));

    expect(error).toBeInstanceOf(MissingExportError);
    expect(error.message).toContain("never-written.txt");
    expect(error.message).toContain("refuse-missing-list");
  });

  test("a list in a format it will not guess at", async () => {
    const fixture = await build("refuse-format", {
      person: people(["one", phone(1), from_cut(HOUR)]),
      lists: { "roster.json": `["${phone(1)}"]\n` },
    });

    const error = await caught(one(fixture, cold("refuse-format", fixture.list("roster.json"))));

    expect(error).toBeInstanceOf(UnsupportedListFormatError);
    expect(error.message).toContain(".json");
  });

  test("a bound column the export's header does not carry", async () => {
    // A timestamp column renamed under its binding reads as empty on every row, which places
    // every account in neither group and reports a cell that arrived at nothing.
    const fixture = await build("refuse-column-person", {
      person: csv(["member_id", "handset", "joined_at"], [["one", phone(1), from_cut(HOUR)]]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-column-person", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportColumnError);
    expect((error as ExportColumnError).role).toBe("person");
    expect((error as ExportColumnError).column).toBe("enrolled_at");
    // The header as it actually reads, so the reader can see the rename without opening the file.
    expect(error.message).toContain("joined_at");
  });

  test("a bound column missing from a money role's header too", async () => {
    const fixture = await build("refuse-column-revenue", {
      person: people(["one", phone(1), from_cut(HOUR)]),
      revenue: csv(["member_id", "arrived_at", "value"], [["one", from_cut(HOUR), 10]]),
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
    const fixture = await build("refuse-blank-person", {
      person: people(["one", phone(1), ""], ["two", phone(2), ""]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const error = await caught(one(fixture, cold("refuse-blank-person", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportBlankColumnError);
    expect((error as ExportBlankColumnError).role).toBe("person");
    expect((error as ExportBlankColumnError).columns).toEqual(["enrolled_at"]);
    expect(error.message).toContain("2 rows");
  });

  test("a bound timestamp column blank on every row of a money role too", async () => {
    // Here the silence is total: the amounts are real and readable, so nothing else objects, and
    // every event is dropped for want of a time to place it against the cut.
    const fixture = await build("refuse-blank-revenue", {
      person: people(["one", phone(1), from_cut(HOUR)]),
      revenue: revenue(["one", "", 10], ["one", "", 20]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-blank-revenue", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportBlankColumnError);
    expect((error as ExportBlankColumnError).role).toBe("revenue");
    expect((error as ExportBlankColumnError).columns).toEqual(["arrived_at"]);
  });

  test("names both timestamp columns where the map bound a fallback, since either would do", async () => {
    const fixture = await build("refuse-blank-conversion", {
      map: { conversion: { at_fallback: "opened_at" } },
      person: people(["one", phone(1), from_cut(HOUR)]),
      conversion: csv(
        ["member_id", "signed_at", "opened_at", "amount", "state", "funding"],
        [["one", "", "", 30, "LIVE", "WIRE"]],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-blank-conversion", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportBlankColumnError);
    expect((error as ExportBlankColumnError).columns).toEqual(["signed_at", "opened_at"]);
  });

  test("but not a role whose export has no rows at all, because that is a fact", async () => {
    // The distinction the check turns on. An empty export is a role that saw no activity in the
    // window somebody queried, and refusing it would make every quiet month unmeasurable. A full
    // file of blanks is a fault. Both produce zeros, and only one of them is a result.
    const fixture = await build("blank-empty-is-legal", {
      person: people(["one", phone(1), from_cut(HOUR)]),
      revenue: revenue(),
      churn: churn(),
      conversion: conversions(),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, cold("blank-empty-is-legal", fixture.list("reached.txt")));

    expect(record.acquired.accounts).toBe(1);
    expect(record.acquired.revenue).toEqual({ people: 0, value: 0, top2_share: null, median_lag_days: null });
    expect(record.conversions.count).toBe(0);
  });

  test("an amount column holding something that is not a number", async () => {
    const fixture = await build("refuse-amount", {
      person: people(["one", phone(1), from_cut(HOUR)]),
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
      person: people(["one", phone(1), from_cut(HOUR)]),
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

  test("more unreadable numbers than the map allows", async () => {
    // The map permits a quarter. Two rows in three is a dialling plan that does not describe
    // this market, and that produces the same zero as a list nobody on it ever registered.
    const fixture = await build("refuse-unparseable", {
      person: people(
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

  test("and more unreadable numbers in a cell's own list than the map allows", async () => {
    // The same ceiling, the other side of the join, and the opposite sign. An entry nobody can key
    // never reaches a numerator, so dropping it quietly only shrinks `listed` — the denominator
    // under every rate this cell publishes. Left unguarded, a list of junk reads as a tiny audience
    // that converted brilliantly, which is the direction that gets published.
    const fixture = await build("refuse-unparseable-list", {
      person: people(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1), "not a number", "12", "also not one") },
    });

    const error = await caught(one(fixture, cold("refuse-unparseable-list", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(UnparseablePhonesError);
    expect(error.message).toContain("3 of 4");
    // Named, because the remedy differs: the map's plan is wrong for this market, or this one file
    // is junk. Saying "the person export" here would send the reader to the wrong file entirely.
    expect(error.message).toContain("refuse-unparseable-list");
  });

  test("but a row carrying no identifier at all is not an unreadable one", async () => {
    // The distinction this rate turns on. A malformed number is a person who was reached and is
    // now missing from the denominator; an empty cell is a row of somebody's export that was never
    // part of the dispatch. Counting the second as the first refuses correct readings — a CRM dump
    // is mostly such rows, and the audience such a campaign publishes has always been the phones it
    // held rather than the lines the file ran to.
    const fixture = await build("blank-rows-are-not-junk", {
      person: people(["one", phone(1), from_cut(HOUR)], ["two", phone(2), from_cut(HOUR)]),
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
    // The map permits a quarter, and "above this share" means above it. Whether the comparison is
    // strict decides what a map saying 0.25 actually licenses, and neither side pinned it — so a
    // change from `>` to `>=` would silently start refusing every file measured at exactly its
    // declared ceiling, which is the one value an author picked on purpose.
    const fixture = await build("ceiling-is-inclusive", {
      // One unreadable of four accounts, and one of four possible list identifiers: 0.25 both ways.
      person: people(
        ["a", phone(1), from_cut(HOUR)],
        ["b", phone(2), from_cut(HOUR)],
        ["c", phone(3), from_cut(HOUR)],
        ["junk", "not a number", from_cut(HOUR)],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2), phone(3), "not a number") },
    });

    const record = await one(fixture, cold("ceiling-is-inclusive", fixture.list("reached.txt")));

    expect(record.audience.listed).toBe(3);
    expect(record.audience.matched_phones).toBe(3);
  });

  test("and the rate is measured against the audience, not the row count", async () => {
    // `listed` is a count of distinct people, so the guard has to bound how far that number was
    // shrunk. Dividing by rows understates it wherever readable entries repeat: five of these six
    // rows are readable but resolve to one person, so the row reading is one junk entry in six and
    // the honest one is one in two — half the audience missing, which the ceiling must catch.
    const fixture = await build("rate-against-the-audience", {
      person: people(["one", phone(1), from_cut(HOUR)]),
      lists: {
        "reached.txt": lines(phone(1), phone(1), phone(1), phone(1), phone(1), "not a number"),
      },
    });

    const error = await caught(one(fixture, cold("rate-against-the-audience", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(UnparseablePhonesError);
    expect(error.message).toContain("1 of 2");
  });

  test("a cell whose lists yielded no usable identifier", async () => {
    const fixture = await build("refuse-empty", {
      person: people(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines("not a number", "also not one") },
    });

    const error = await caught(one(fixture, cold("refuse-empty", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(EmptyCellError);
    expect((error as EmptyCellError).cell).toBe("refuse-empty");
  });

  test("a cell left empty by its own exclusions", async () => {
    // A cell consisting only of planted probes is as unmeasurable as one whose file moved, and
    // it must fail the same way rather than reporting a clean row of zeros.
    const fixture = await build("refuse-empty-excluded", {
      person: people(["probe", phone(2), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(2)) },
    });

    const error = await caught(
      one(fixture, cold("refuse-empty-excluded", fixture.list("reached.txt"), { exclude: [phone(2)] })),
    );

    expect(error).toBeInstanceOf(EmptyCellError);
    expect((error as EmptyCellError).cell).toBe("refuse-empty-excluded");
  });

  test("an exclusion that cannot be read as a number, which would leave the probe in the cell", async () => {
    // The one fault here that overstates instead of emptying. Each entry below is a real way a
    // probe number is mistyped — a capital letter for a zero, an extension appended, a row of the
    // declaration left blank — and none of them yields a key. Skipped rather than refused, they
    // subtract nobody: the probe stays in a two-member cell, its conversion is counted as the
    // campaign's, and the reading comes back a hundred times what it should be. An empty reading
    // is queried by whoever reads it; an inflated one is published.
    const fixture = await build("refuse-exclude-unreadable", {
      person: people(["real", phone(1), from_cut(HOUR)], ["probe", phone(2), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const entries = ["48O000002", `${phone(2)} ext 20`, ""];
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
      person: people(["real", phone(1), from_cut(HOUR)], ["probe", phone(2), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const error = await caught(
      one(fixture, cold("refuse-exclude-one", fixture.list("reached.txt"), { exclude: ["48O000002"] })),
    );

    expect(error).toBeInstanceOf(CellExclusionError);
    expect((error as CellExclusionError).entries).toEqual(["48O000002"]);
    // Singular, because the sentence is an instruction to whoever fixes the declaration and "an
    // exclusion" and "3 exclusions" send them to look for different amounts of work.
    expect(error.message).toContain("lists an exclusion that cannot be read");
  });

  test("two cells sharing one name, which would make every control join ambiguous", async () => {
    const fixture = await build("refuse-duplicate-cell", {
      person: people(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(
      measure({
        map: fixture.map,
        exports: fixture.exports,
        cells: [cold("twice", fixture.list("reached.txt")), cold("twice", fixture.list("reached.txt"))],
        now: NOW,
      }),
    );

    expect(error).toBeInstanceOf(CellDeclarationError);
    expect((error as CellDeclarationError).cell).toBe("twice");
  });

  test("a control naming a cell nobody declared", async () => {
    const fixture = await build("refuse-control-unknown", {
      person: people(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(
      measure({
        map: fixture.map,
        exports: fixture.exports,
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
      person: people(["one", phone(1), from_cut(HOUR)], ["two", phone(2), from_cut(HOUR)]),
      lists: { "treated.txt": lines(phone(1)), "untouched.txt": lines(phone(2)) },
    });

    const error = await caught(
      measure({
        map: fixture.map,
        exports: fixture.exports,
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
      person: people(["one", phone(1), from_cut(HOUR)], ["two", phone(2), from_cut(HOUR)]),
      lists: { "treated.txt": lines(phone(1)), "untouched.txt": lines(phone(2)) },
    });

    const error = await caught(
      measure({
        map: fixture.map,
        exports: fixture.exports,
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
      person: people(["one", phone(1), from_cut(HOUR)], ["two", phone(2), from_cut(-DAY)]),
      lists: { "treated.txt": lines(phone(1)), "untouched.txt": lines(phone(2)) },
    });

    // The treated cell allows the outcome and the control cell does not: only the control side of
    // the condition refuses this one.
    const on_the_control = await caught(
      measure({
        map: fixture.map,
        exports: fixture.exports,
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
        map: fixture.map,
        exports: fixture.exports,
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
      person: people(
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
        map: fixture.map,
        exports: fixture.exports,
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

  test("a conversion export whose statuses were all renamed under the map", async () => {
    // A role export can be present, well-formed and contribute nothing. Every column is bound,
    // every timestamp parses, every amount is a number — and a migration renamed the statuses,
    // so the per-cell filter drops all of them one at a time and the record says nobody
    // committed. Counted once over the whole file, the difference between a quiet window and a
    // status list that matches nothing becomes a fact this can refuse on.
    const fixture = await build("refuse-status-drift", {
      person: people(["one", phone(1), from_cut(-DAY)], ["two", phone(2), from_cut(-DAY)]),
      conversion: conversions(
        ["one", from_cut(HOUR), 60, "RUNNING", "WIRE"],
        ["two", from_cut(2 * HOUR), 40, "RUNNING", "CREDIT"],
      ),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const error = await caught(one(fixture, base("refuse-status-drift", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportStatusError);
    expect((error as ExportStatusError).declared).toEqual(["LIVE", "SETTLED"]);
    // What the column actually holds, so the rename is legible without opening the export.
    expect((error as ExportStatusError).found).toEqual(["RUNNING"]);
    expect(error.message).toContain("2 rows");
  });

  test("but not a file where one row in three carries a status the map counts", async () => {
    // The same distinction the blank-column check draws. A file whose rows are mostly abandoned
    // or cancelled is an ordinary file; it is a file with nothing countable in it that is a
    // fault, and refusing the first would make every honest month unmeasurable.
    const fixture = await build("status-partial-is-legal", {
      person: people(["one", phone(1), from_cut(-DAY)]),
      conversion: conversions(
        ["one", from_cut(HOUR), 10, "LAPSED", "WIRE"],
        ["one", from_cut(2 * HOUR), 20, "LIVE", "WIRE"],
        ["one", from_cut(3 * HOUR), 30, "LAPSED", "WIRE"],
      ),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(fixture, base("status-partial-is-legal", fixture.list("reached.txt")));

    expect(record.conversions.count).toBe(1);
    expect(record.conversions.value).toBe(20);
  });

  test("a conversion export whose person column holds the wrong kind of id", async () => {
    // The join is the one binding that can be wrong while every column is present and every
    // value well-formed: a conversion export keyed by the contract's own primary key instead of
    // the person's matches nobody. What comes out is a thousand matched accounts and no
    // conversions, which is exactly what a campaign nobody responded to looks like.
    const fixture = await build("refuse-join-conversion", {
      person: people(["member-1", phone(1), from_cut(-DAY)]),
      conversion: conversions(["contract-9", from_cut(HOUR), 50, "LIVE", "WIRE"]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, base("refuse-join-conversion", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportJoinError);
    expect((error as ExportJoinError).role).toBe("conversion");
    expect((error as ExportJoinError).column).toBe("member_id");
    // Both sides quoted, because the shape of the two ids is what tells the reader which one is
    // the wrong kind.
    expect(error.message).toContain("contract-9");
    expect(error.message).toContain("member-1");
  });

  test("a money role that references nobody in the person export either", async () => {
    const fixture = await build("refuse-join-revenue", {
      person: people(["member-1", phone(1), from_cut(-DAY)]),
      revenue: revenue(["wallet-7", from_cut(HOUR), 25]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-join-revenue", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(ExportJoinError);
    expect((error as ExportJoinError).role).toBe("revenue");
    expect((error as ExportJoinError).path).toContain("revenue.csv");
  });

  test("but not a role that references only some of them, which is a narrower export", async () => {
    // One shared identifier is enough, and this must never become a coverage threshold: a role
    // exported over a shorter window than the person export legitimately references a fraction
    // of it, and a fraction is not a fault. Zero is the fault, because zero is the only overlap
    // two files describing the same people cannot produce.
    const fixture = await build("join-partial-is-legal", {
      person: people(["one", phone(1), from_cut(-DAY)], ["two", phone(2), from_cut(-DAY)]),
      revenue: revenue(["one", from_cut(HOUR), 10], ["outside-this-export", from_cut(HOUR), 90]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const record = await one(fixture, cold("join-partial-is-legal", fixture.list("reached.txt")));

    expect(record.pre_existing.revenue).toEqual({ people: 1, value: 10 });
  });

  test("and a blank on both sides is not the shared identifier that satisfies it", async () => {
    // The check above is satisfied by one key the two files have in common, and the empty string
    // used to be such a key. A person row whose id is blank and a revenue row whose person column
    // is blank meet at `""`, the check returns satisfied on that pair, and the real row beside
    // them — keyed on a wallet, referencing nobody — falls out of every cell in the silence this
    // error exists to break. A consumer reaches it the ordinary way: a left join that matched
    // nothing writes a null person, and a null reads as blank in an export.
    const fixture = await build("refuse-join-blank", {
      person: people(["", phone(1), from_cut(-DAY)]),
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
      person: people(["", phone(1), from_cut(-DAY)], ["real", phone(2), from_cut(-DAY)]),
      revenue: revenue(["", from_cut(HOUR), 90], ["real", from_cut(HOUR), 10]),
      conversion: conversions(["", from_cut(HOUR), 70, "LIVE", "WIRE"], ["real", from_cut(HOUR), 20, "LIVE", "WIRE"]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const record = await one(fixture, cold("join-blank-not-credited", fixture.list("reached.txt")));

    // Both accounts stay in the audience. The one with no id was matched on a phone that was read
    // and is a person this cell reached; only its join key is missing, so it collects nothing
    // rather than disappearing from the denominator.
    expect(record.audience.matched_accounts).toBe(2);
    expect(record.pre_existing.accounts).toBe(2);
    expect(record.pre_existing.revenue).toEqual({ people: 1, value: 10 });
    expect(record.conversions).toEqual({ count: 1, value: 20, new_money: 20, recycled: 0 });
  });

  test("an export whose header names one column twice", async () => {
    // The duplicate defeats the check that exists to catch a bad binding: `handset` is in the
    // header, so the binding passes, and only the second column of that name survives into each
    // row — so the run reads whatever the second query put there and joins on nothing.
    const fixture = await build("refuse-duplicate-column", {
      person: csv(["member_id", "handset", "enrolled_at", "handset"], [["one", phone(1), from_cut(HOUR), "480999999"]]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(one(fixture, cold("refuse-duplicate-column", fixture.list("reached.txt"))));

    expect(error).toBeInstanceOf(DuplicateColumnError);
    expect((error as DuplicateColumnError).column).toBe("handset");
  });

  test("a list whose quoted field never closes, which would swallow every row below it", async () => {
    // The scanner is a real RFC 4180 reader and was proven identical to the reference one this
    // engine replaced — except here, where an unterminated quote reads the rest of the file as a
    // single field. No parse error, no short row: the list simply ends at the stray quote and
    // the identifiers below it are never measured.
    const fixture = await build("refuse-unterminated-quote", {
      person: people(
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
      person: people(["one", phone(1), from_cut(HOUR)]),
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
      person: people(["one", phone(1), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const error = await caught(
      one(fixture, cold("refuse-txt-filter", fixture.list("reached.txt"), { filter: { column: "cell", value: "a" } })),
    );

    expect(error).toBeInstanceOf(TextListOptionError);
    expect((error as TextListOptionError).options).toEqual(['filter on "cell"']);
  });

  test("a filter naming a column the list does not carry, named as itself", async () => {
    // The phone column here is right and the filter column is wrong. Unchecked, the filter
    // matches no row, the cell comes out empty, and the error names the phone column — sending
    // the reader to correct the one binding that was correct.
    const fixture = await build("refuse-filter-column", {
      person: people(["a1", phone(1), from_cut(HOUR)]),
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
      person: people(["one", phone(1), from_cut(-DAY)]),
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
      person: people(["one", phone(1), from_cut(-DAY)]),
      lists: { "reached.txt": lines(phone(1)) },
    });

    const record = await one(
      fixture,
      cold("cut-at-the-reading", fixture.list("reached.txt"), { cut: NOW.toISOString() }),
    );

    expect(record.window_hours).toBe(0);
    expect(record.pre_existing.accounts).toBe(1);
  });

  test("a control pair whose arms share members, which is not two samples", async () => {
    // The four checks a pair already passes say nothing about who is in it. A control drawn as
    // "everyone we did not send to" from a list that had already been extended carries the
    // treated numbers back, and every shared person is counted as evidence on both sides: the
    // control drifts towards the treated arm and whatever difference survives is an artefact of
    // how the lists were drawn, published with a p-value on top.
    const fixture = await build("refuse-control-overlap", {
      person: people(["a", phone(1), from_cut(HOUR)], ["b", phone(2), from_cut(HOUR)], ["c", phone(3), from_cut(-DAY)]),
      lists: {
        "treated.txt": lines(phone(1), phone(2)),
        "untouched.txt": lines(phone(1), phone(2), phone(3)),
      },
    });

    const error = await caught(
      measure({
        map: fixture.map,
        exports: fixture.exports,
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
      person: people(["a", phone(1), from_cut(HOUR)], ["b", phone(2), from_cut(HOUR)], ["c", phone(3), from_cut(-DAY)]),
      lists: {
        "treated.txt": lines(phone(1), phone(2)),
        "untouched.txt": lines(phone(2), phone(3)),
      },
    });

    const error = await caught(
      measure({
        map: fixture.map,
        exports: fixture.exports,
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
      person: people(["a", phone(1), from_cut(HOUR)], ["b", phone(2), from_cut(HOUR)]),
      lists: { "reached.txt": lines(phone(1), phone(2)) },
    });

    const error = await caught(
      measure({
        map: fixture.map,
        exports: fixture.exports,
        cells: [cold("solo", fixture.list("reached.txt"))],
        controls: [{ treated: "solo", control: "solo", outcome: "acquired.accounts" }],
        now: NOW,
      }),
    );

    expect(error).toBeInstanceOf(ControlError);
    expect(error.message).toMatch(/both sides/);
  });
});
