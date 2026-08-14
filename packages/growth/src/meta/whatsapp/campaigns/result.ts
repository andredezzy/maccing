/**
 * What a campaign returned against what it cost, and whether that division is allowed to stand.
 *
 * `measure` answers what each cell did. It never learns what the campaign cost, so until this
 * module existed the return multiple was arithmetic somebody did by hand in prose beside the
 * record — and the errors were all there rather than in the measurement. The one this exists to
 * stop: dividing a cost into revenue produced by people who **already held accounts and buy again
 * without being asked**. That is the base's ordinary behaviour published as a campaign effect, and
 * it flatters every own-base cell that ships without a control.
 *
 * The rule is not a new judgment. `Cell.audience` already declares which side a cell is on, and a
 * control already declares whether an own-base cell has a counterfactual. This reads both and says
 * out loud what the declaration was already carrying.
 */
import { ResultError } from "./errors/result-error.ts";
import type { Cell, CellRecord } from "./metrics.ts";
import { round_half_even } from "../../../internal/round.ts";

/** The two totals a campaign's return can honestly be read on.
 *
 *  A cold list is read on money arriving from accounts that did not exist before the cut; an
 *  own-base list cannot arrive at all, so it is read on what it committed. Both are declared
 *  per campaign rather than derived, because which one a campaign is *for* is not in the data. */
export type RevenuePath = "acquired.revenue.value" | "conversions.value";

/** One cell's contribution, and whether anything in the declaration supports attributing it. */
export type Contribution = {
  cell: string;
  audience: Cell["audience"];
  value: number;
  /** False only for an own-base cell with no control: nobody can say whether those people bought
   *  because of the campaign or because they were going to buy anyway. */
  attributable: boolean;
};

/** What a campaign returned against what it cost. */
export type ResultRecord = {
  /** Which total this was read on, so a reader never has to infer it from the size. */
  revenue: RevenuePath;
  /** One per cell given, in declaration order. */
  contributions: readonly Contribution[];
  /** Summed over every cell given, attributable or not. This is the accounting figure. */
  measured: number;
  /** Summed over the attributable cells alone. This is the one a decision may rest on. */
  attributable: number;
  cost: number;
  /** `attributable - cost`. Deliberately not computed from `measured`: a profit line that counts
   *  revenue the record cannot attribute is the exact error this module exists to stop. */
  profit: number;
  /** `attributable / cost`, or null where the cost is zero and the ratio has no meaning. */
  roas: number | null;
  /** True where every cell's revenue is attributable. False means `measured` is larger
   *  than `attributable` and the gap belongs to people who buy with or without a campaign. */
  publishable: boolean;
};

/** What `result` is given. */
export type ResultOptions = {
  /** The cells whose revenue **is** the campaign's, which is not always every cell `measure` was
   *  given. Two cases where it is not, and the engine cannot tell them apart on its own:
   *
   *  - An untouched holdout received nothing, so its revenue was never the campaign's. Leave it out.
   *  - Two cells drawn from one population — a list as handed over and the part of it confirmed
   *    delivered — overlap, and summing both counts the same people twice. Pass the one that is
   *    the campaign.
   *
   *  Both arms of an A/B **do** belong here. A cell named as some control's `control` is not
   *  necessarily untouched: in a copy test it received a message too, and dropping it would report
   *  half a campaign. That is why this is a declaration and not something derived from `controls`. */
  cells: readonly Cell[];
  /** The records `measure` returned, for those same cells. */
  records: readonly CellRecord[];
  /** What the campaign cost, **in the unit the source reports money in**. The engine never learns
   *  a currency and never converts one: a cost paid in another currency is divided by the rate
   *  before it gets here, in the campaign file, where the rate is visible beside the reading it
   *  belongs to. Zero is allowed and gives a null `roas`. */
  cost: number;
  revenue: RevenuePath;
};

/** Walk a dotted path into a record and return the number at the end of it, if there is one. */
function resolve(record: CellRecord, path: string): number | undefined {
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
 * Divide a campaign's cost into what it returned, and say whether the division stands.
 *
 * Pure: it reads the records `measure` already produced and touches no database, so it also runs
 * against a stored `metrics.json` months later.
 *
 * Every cell given contributes, and is attributable when it is `cold` (those accounts did not
 * exist before the cut) or when its record carries a control (the counterfactual exists). An
 * `own_base` cell with no control contributes to `measured` and not to `attributable`, and its
 * presence alone sets `publishable` to false.
 *
 * Which cells to give it is the caller's declaration — see `ResultOptions.cells`. Holdouts are
 * left out there rather than detected here, because a cell on the `control` side of a copy test
 * received a message and a cell on the `control` side of a holdout did not, and nothing in the
 * declaration distinguishes them.
 *
 * @throws ResultError on a cost that is not finite and at or above zero, on a cell with no record,
 *   or on a revenue path no record carries.
 */
export function result(opts: ResultOptions): ResultRecord {
  const { cells, records, cost, revenue } = opts;

  if (!Number.isFinite(cost) || cost < 0) {
    throw new ResultError(`cost must be a finite number at or above zero, got ${cost}`);
  }

  const by_name = new Map(records.map((record) => [record.cell, record]));

  const contributions: Contribution[] = [];
  for (const cell of cells) {
    const record = by_name.get(cell.name);
    if (record === undefined) {
      throw new ResultError(`no record for cell \`${cell.name}\``);
    }
    const value = resolve(record, revenue);
    if (value === undefined) {
      throw new ResultError(
        `cell \`${cell.name}\` carries no \`${revenue}\`. A campaign read on a total its source ` +
          `never bound would return zero and read as one that sold nothing`,
      );
    }
    contributions.push({
      cell: cell.name,
      audience: cell.audience,
      value,
      attributable: cell.audience === "cold" || record.control !== undefined,
    });
  }

  const sum = (rows: readonly Contribution[]) =>
    round_half_even(
      rows.reduce((total, row) => total + row.value, 0),
      2,
    );
  const measured = sum(contributions);
  const attributable = sum(contributions.filter((row) => row.attributable));

  return {
    revenue,
    contributions,
    measured,
    attributable,
    cost,
    profit: round_half_even(attributable - cost, 2),
    roas: cost === 0 ? null : round_half_even(attributable / cost, 2),
    publishable: measured === attributable,
  };
}
