import { load_map, MapFieldError, MapStaleError, type RoleBinding, verify_fingerprint } from "../../../internal/map.ts";
import { make_key } from "../../../internal/phone.ts";
import { round_half_even, round_or_null } from "../../../internal/round.ts";
import { median, two_proportion } from "../../../internal/stats.ts";
import { read_identifiers, read_table } from "../../../internal/table.ts";
import { parse_ts } from "../../../internal/timestamp.ts";

export type { DatabaseMap, RoleBinding } from "../../../internal/map.ts";
export {
  load_map,
  MapFieldError,
  MapMissingError,
  MapSectionError,
  MapStaleError,
  verify_fingerprint,
} from "../../../internal/map.ts";
export type { PhoneFormat } from "../../../internal/phone.ts";
export { PhoneFormatError } from "../../../internal/phone.ts";
export { UnsupportedListFormatError } from "../../../internal/table.ts";
export { TimestampError } from "../../../internal/timestamp.ts";

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
   *  earlier than the truth counts people who arrived before anything reached them. */
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
export type EventTotals = { people: number; value: number | null };

export type AcquiredRevenue = EventTotals & {
  /** Share of the total held by the two largest contributors. Concentration hides in an
   *  average, and it has been found by hand more than once. */
  top2_share: number | null;
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
  conversions: { count: number; value: number; new_money: number; recycled: number };
  control?: ControlReading;
};

export type MeasureOptions = {
  /** Path to the map. Unmapped, or mapped against a schema that has since moved, is a stop. */
  map: string;
  /** Directory holding one exported file per bound role. */
  exports: string;
  cells: readonly Cell[];
  controls?: readonly Control[];
  /** Overrides the reading time. Only a test has a reason to set this. */
  now?: Date;
};

/** Readings below this are never publishable, whatever the p-value says. */
export const WINDOW_FLOOR_HOURS = 24 * 7;

/** Below this many events in the control, one outlier flips the sign of the comparison. */
export const MIN_CONTROL_EVENTS = 10;

export const MAX_P = 0.05;

/** More of the person export is unreadable than the map permits. */
export class UnparseablePhonesError extends Error {
  constructor(unreadable: number, total: number, rate: number, ceiling: number) {
    super(
      `${unreadable} of ${total} rows in the person export carry no readable number (${(rate * 100).toFixed(1)}%), ` +
        `above the ${(ceiling * 100).toFixed(1)}% the map allows. A dialling plan that does not match this ` +
        "market and a list of people who genuinely never registered produce the same zero, and only one of " +
        "them is a result — so the run stops instead of reporting it.",
    );
    this.name = "UnparseablePhonesError";
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

/** A bound amount column holds something that is not a number. */
export class ExportValueError extends Error {
  constructor(path: string, column: string, raw: string) {
    super(
      `${path} column ${JSON.stringify(column)} holds ${JSON.stringify(raw)}, which is not a number. ` +
        "Treating it as zero would quietly shrink a total that someone will publish.",
    );
    this.name = "ExportValueError";
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

/** A cell's lists yielded nothing usable. */
export class EmptyCellError extends Error {
  readonly cell: string;

  constructor(cell: string, lists: readonly string[], column: string | undefined) {
    super(
      `cell ${JSON.stringify(cell)} yielded no usable identifier from ${lists.join(", ")}` +
        `${column === undefined ? "" : ` (column ${JSON.stringify(column)})`}. ` +
        "An empty cell reads as 'nothing converted' when the truth is that the file moved or the " +
        "column was renamed, so it stops the run rather than emitting a row of zeros.",
    );
    this.name = "EmptyCellError";
    this.cell = cell;
  }
}

/** A control pair that cannot be read, or that reads the wrong outcome for its audience. */
export class ControlError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ControlError";
  }
}

type Account = { id: string; created: Date | null };
type MoneyEvent = { at: Date | null; amount: number };
type ConversionEvent = MoneyEvent & { status: string; split: string };

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function column_of(binding: RoleBinding, name: string, role: string): string {
  const column = binding.columns[name];
  if (column === undefined) {
    throw new MapFieldError(`## Role: ${role}`, name, "the engine reads this column and the map does not bind it");
  }
  return column;
}

function amount_of(raw: string, path: string, column: string): number {
  const value = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(value)) {
    throw new ExportValueError(path, column, raw);
  }
  return value;
}

async function read_export(path: string, role: string): Promise<Record<string, string>[]> {
  if (!(await Bun.file(path).exists())) {
    throw new MissingExportError(path, `the ${role} role`);
  }
  return read_table(path);
}

/** Group a money-carrying role's rows under the person they reference. */
async function money_index(directory: string, binding: RoleBinding, role: string): Promise<Map<string, MoneyEvent[]>> {
  const path = `${directory}/${binding.export}`;
  const rows = await read_export(path, role);
  const person = column_of(binding, "person", role);
  const at = column_of(binding, "at", role);
  const amount = column_of(binding, "amount", role);

  const index = new Map<string, MoneyEvent[]>();
  for (const row of rows) {
    const id = row[person] ?? "";
    const event: MoneyEvent = { at: parse_ts(row[at]), amount: amount_of(row[amount] ?? "", path, amount) };
    const bucket = index.get(id);
    if (bucket === undefined) {
      index.set(id, [event]);
    } else {
      bucket.push(event);
    }
  }
  return index;
}

async function conversion_index(directory: string, binding: RoleBinding): Promise<Map<string, ConversionEvent[]>> {
  const path = `${directory}/${binding.export}`;
  const rows = await read_export(path, "conversion");
  const person = column_of(binding, "person", "conversion");
  const at = column_of(binding, "at", "conversion");
  const amount = column_of(binding, "amount", "conversion");
  const status = column_of(binding, "status", "conversion");
  const split = column_of(binding, "split", "conversion");
  const at_fallback = binding.columns.at_fallback;

  const index = new Map<string, ConversionEvent[]>();
  for (const row of rows) {
    // The primary timestamp is nullable on this role, so the map may name a second column to
    // stand in. Empty, not absent, is what an unset timestamp looks like in an export.
    const primary = row[at] ?? "";
    const when = primary !== "" || at_fallback === undefined ? primary : (row[at_fallback] ?? "");
    const event: ConversionEvent = {
      at: parse_ts(when),
      amount: amount_of(row[amount] ?? "", path, amount),
      status: row[status] ?? "",
      split: row[split] ?? "",
    };
    const id = row[person] ?? "";
    const bucket = index.get(id);
    if (bucket === undefined) {
      index.set(id, [event]);
    } else {
      bucket.push(event);
    }
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
): { people: number; value: number; lags: number[]; per_person: number[] } {
  let people = 0;
  let value = 0;
  const lags: number[] = [];
  const per_person: number[] = [];

  for (const account of group) {
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
    people++;
    value += subtotal;
    per_person.push(subtotal);
    lags.push((earliest - cut_ms) / DAY_MS);
  }
  return { people, value, lags, per_person };
}

/**
 * Share of a group's total held by its two largest contributors. Null where the question is
 * meaningless: nothing collected, or fewer than two contributors to compare.
 *
 * An average over a group where two people account for most of the money describes nobody in it,
 * and the concentration is invisible until someone goes looking. This puts it beside the total.
 */
function top2_share(per_person: number[], total: number): number | null {
  if (total === 0 || per_person.length < 2) {
    return null;
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
 * Which outcome an audience can be read on.
 *
 * A cold list has no counterfactual: nobody who has never heard of the brand arrives unprompted,
 * so arrival is the effect. A list of people who already hold accounts cannot arrive at all, so
 * arrival there measures nothing and commitment is the effect. Reading a pair on the wrong one
 * gives zero against zero, which is not a null result — it is a question that was never asked.
 */
const OUTCOME_PREFIX: Record<Cell["audience"], string> = { cold: "acquired.", own_base: "conversions." };

export async function measure(opts: MeasureOptions): Promise<CellRecord[]> {
  const map = await load_map(opts.map);
  // Checked on every run, never on request. A hash nobody checks is a written date, and a written
  // date cannot notice that a column was renamed under the binding that names it.
  const fingerprint = await verify_fingerprint(map, opts.map);
  if (!fingerprint.ok) {
    throw new MapStaleError(map.fingerprint.schema, fingerprint.expected, fingerprint.actual);
  }

  const key_of = make_key(map.phone);
  const now = opts.now ?? new Date();
  const measured_utc = now.toISOString();
  const now_ms = now.getTime();

  const person_path = `${opts.exports}/${map.person.export}`;
  const person_rows = await read_export(person_path, "person");
  const person_id = column_of(map.person, "id", "person");
  const person_phone = column_of(map.person, "phone", "person");
  const person_created = column_of(map.person, "created_at", "person");

  const by_key = new Map<string, Account[]>();
  let unreadable = 0;
  for (const row of person_rows) {
    const key = key_of(row[person_phone]);
    if (key === null) {
      unreadable++;
      continue;
    }
    const account: Account = { id: row[person_id] ?? "", created: parse_ts(row[person_created]) };
    const bucket = by_key.get(key);
    if (bucket === undefined) {
      by_key.set(key, [account]);
    } else {
      bucket.push(account);
    }
  }
  if (person_rows.length > 0) {
    const rate = unreadable / person_rows.length;
    if (rate > map.phone.max_unparseable_rate) {
      throw new UnparseablePhonesError(unreadable, person_rows.length, rate, map.phone.max_unparseable_rate);
    }
  }

  // A number answering for this many accounts is a switchboard, a placeholder or a support desk,
  // not a person. Left in the index, every list containing it inherits all of them.
  for (const [key, accounts] of by_key) {
    if (accounts.length >= map.phone.shared_account_ceiling) {
      by_key.delete(key);
    }
  }

  const revenue = map.revenue === undefined ? null : await money_index(opts.exports, map.revenue, "revenue");
  const churn = map.churn === undefined ? null : await money_index(opts.exports, map.churn, "churn");
  const conversions = await conversion_index(opts.exports, map.conversion);
  const valid_statuses = new Set(map.conversion.valid_statuses ?? []);
  const recycled_when = map.conversion.recycled_when;

  const measured: { cell: Cell; record: CellRecord }[] = [];

  for (const cell of opts.cells) {
    const cut = parse_ts(cell.cut);
    if (cut === null) {
      throw new CellDeclarationError(cell.name, "its cut is blank, so there is no moment to measure from");
    }
    const cut_ms = cut.getTime();

    const keys = new Set<string>();
    for (const list of cell.lists) {
      if (!(await Bun.file(list).exists())) {
        throw new MissingExportError(list, `cell ${JSON.stringify(cell.name)}`);
      }
      for (const raw of await read_identifiers(list, cell.column, cell.filter)) {
        const key = key_of(raw);
        if (key !== null) {
          keys.add(key);
        }
      }
    }
    if (keys.size === 0) {
      throw new EmptyCellError(cell.name, cell.lists, cell.column);
    }

    // Planted probes and internal numbers are subtracted after the emptiness check, so a cell
    // consisting only of them still fails as unusable rather than as empty.
    for (const raw of cell.exclude ?? []) {
      const key = key_of(raw);
      if (key !== null) {
        keys.delete(key);
      }
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
    let new_money = 0;
    let recycled = 0;
    for (const account of matched_accounts) {
      const events = conversions.get(account.id);
      if (events === undefined) {
        continue;
      }
      for (const event of events) {
        if (event.at === null || event.at.getTime() < cut_ms) {
          continue;
        }
        if (!valid_statuses.has(event.status)) {
          continue;
        }
        conversion_count++;
        conversion_value += event.amount;
        if (event.split === recycled_when) {
          recycled += event.amount;
        } else {
          new_money += event.amount;
        }
      }
    }

    const record: CellRecord = {
      cell: cell.name,
      cut_utc: cell.cut,
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
        value: round_half_even(conversion_value, 2),
        new_money: round_half_even(new_money, 2),
        recycled: round_half_even(recycled, 2),
      },
    };

    if (revenue !== null) {
      const gained = accumulate(acquired, revenue, cut_ms);
      const held = accumulate(pre_existing, revenue, cut_ms);
      record.acquired.revenue = {
        people: gained.people,
        value: round_half_even(gained.value, 2),
        top2_share: top2_share(gained.per_person, gained.value),
        median_lag_days: round_or_null(gained.lags.length === 0 ? null : median(gained.lags), 1),
      };
      record.pre_existing.revenue = { people: held.people, value: round_half_even(held.value, 2) };
    }
    if (churn !== null) {
      const gone = accumulate(acquired, churn, cut_ms);
      const held = accumulate(pre_existing, churn, cut_ms);
      record.acquired.churn = { people: gone.people, value: round_half_even(gone.value, 2) };
      record.pre_existing.churn = { people: held.people, value: round_half_even(held.value, 2) };
    }

    measured.push({ cell, record });
  }

  const by_name = new Map(measured.map((entry) => [entry.cell.name, entry]));

  for (const control of opts.controls ?? []) {
    const treated = by_name.get(control.treated);
    const untouched = by_name.get(control.control);
    if (treated === undefined || untouched === undefined) {
      const missing = treated === undefined ? control.treated : control.control;
      throw new ControlError(
        `the pair ${JSON.stringify(control.treated)} against ${JSON.stringify(control.control)} names ` +
          `${JSON.stringify(missing)}, which is not a declared cell`,
      );
    }

    const wanted = OUTCOME_PREFIX[treated.cell.audience];
    if (!control.outcome.startsWith(wanted) || !control.outcome.startsWith(OUTCOME_PREFIX[untouched.cell.audience])) {
      throw new ControlError(
        `the pair ${JSON.stringify(control.treated)} (${treated.cell.audience}) against ` +
          `${JSON.stringify(control.control)} (${untouched.cell.audience}) reads outcome ` +
          `${JSON.stringify(control.outcome)}, which contradicts the audience. A cold cell is read on an ` +
          "`acquired.*` outcome and one already holding accounts on a `conversions.*` outcome; the other " +
          "way round is zero against zero, which is not a null result but a question never asked.",
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
      // The gate reads the unrounded p. Rounding first would let a value sitting just above
      // the threshold cross it on presentation alone.
      publishable: test !== null && test.p < MAX_P && control_value >= MIN_CONTROL_EVENTS,
    };
  }

  return measured.map((entry) => entry.record);
}
