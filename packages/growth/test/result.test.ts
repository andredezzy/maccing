import { describe, expect, test } from "bun:test";

import type { Cell, CellRecord } from "../src/meta/whatsapp/campaigns/metrics.ts";
import { ResultError, result } from "../src/meta/whatsapp/campaigns/metrics.ts";

function cell(name: string, audience: Cell["audience"]): Cell {
  return { name, cut: "2026-01-01T00:00", lists: ["ignored.csv"], audience };
}

/** A record carrying only what `result` reads. Everything else is a plausible zero. */
function record(
  name: string,
  totals: { acquired?: number; conversions?: number; controlled?: boolean },
): CellRecord {
  return {
    cell: name,
    cut_utc: "2026-01-01T00:00:00",
    measured_utc: "2026-01-08T00:00:00.000Z",
    window_hours: 168,
    audience: { listed: 1000, matched_phones: 100, matched_accounts: 100 },
    acquired: {
      accounts: 10,
      within: { h24: 1, d7: 5, d30: 10 },
      revenue: {
        leads: 3,
        value: totals.acquired ?? 0,
        top2_share: null,
        median_lag_days: null,
      },
    },
    pre_existing: { accounts: 0 },
    conversions: { count: 2, value: totals.conversions ?? 0 },
    ...(totals.controlled === true
      ? {
          control: {
            against: "whoever",
            outcome: "conversions.count",
            treated_rate: 1,
            control_rate: 0.5,
            lift: 2,
            control_events: 12,
            p: 0.01,
            publishable: true,
          } as const,
        }
      : {}),
  };
}

describe("result", () => {
  test("a cold campaign divides cleanly and publishes", () => {
    const cells = [cell("A", "cold"), cell("B", "cold")];
    const records = [record("A", { acquired: 300 }), record("B", { acquired: 200 })];

    const got = result({ cells, records, cost: 100, revenue: "acquired.revenue.value" });

    expect(got.measured).toBe(500);
    expect(got.attributable).toBe(500);
    expect(got.profit).toBe(400);
    expect(got.roas).toBe(5);
    expect(got.publishable).toBe(true);
  });

  test("an own_base cell with no control is measured, not attributed", () => {
    const cells = [cell("platform", "own_base"), cell("cold", "cold")];
    const records = [record("platform", { conversions: 900 }), record("cold", { conversions: 100 })];

    const got = result({ cells, records, cost: 100, revenue: "conversions.value" });

    expect(got.measured).toBe(1000);
    expect(got.attributable).toBe(100);
    expect(got.roas).toBe(1);
    expect(got.publishable).toBe(false);
    expect(got.contributions.find((row) => row.cell === "platform")?.attributable).toBe(false);
  });

  test("profit and roas come off the attributable total, never the measured one", () => {
    const cells = [cell("platform", "own_base")];
    const records = [record("platform", { conversions: 5000 })];

    const got = result({ cells, records, cost: 400, revenue: "conversions.value" });

    expect(got.measured).toBe(5000);
    expect(got.attributable).toBe(0);
    expect(got.profit).toBe(-400);
    expect(got.roas).toBe(0);
  });

  test("a control gives an own_base cell its counterfactual back", () => {
    const cells = [cell("treated", "own_base")];
    const records = [
      record("treated", { conversions: 800, controlled: true }),
      record("held", { conversions: 700 }),
    ];

    const got = result({ cells, records, cost: 200, revenue: "conversions.value" });

    expect(got.measured).toBe(800);
    expect(got.attributable).toBe(800);
    expect(got.publishable).toBe(true);
  });

  test("a holdout is left out by the caller, and its revenue never lands", () => {
    const treated = cell("treated", "cold");
    const records = [
      record("treated", { acquired: 300, controlled: true }),
      record("held", { acquired: 250 }),
    ];

    const got = result({ cells: [treated], records, cost: 100, revenue: "acquired.revenue.value" });

    expect(got.measured).toBe(300);
    expect(got.contributions.map((row) => row.cell)).toEqual(["treated"]);
  });

  test("both arms of an A/B count — the baseline arm received a message too", () => {
    const cells = [cell("A", "cold"), cell("B", "cold")];
    const records = [
      record("A", { acquired: 1650.41 }),
      record("B", { acquired: 887.83, controlled: true }),
    ];

    const got = result({ cells, records, cost: 497, revenue: "acquired.revenue.value" });

    expect(got.measured).toBe(2538.24);
    expect(got.attributable).toBe(2538.24);
    expect(got.roas).toBe(5.11);
  });

  test("a zero cost gives a null roas rather than an infinity", () => {
    const cells = [cell("A", "cold")];
    const records = [record("A", { acquired: 10 })];

    expect(result({ cells, records, cost: 0, revenue: "acquired.revenue.value" }).roas).toBeNull();
  });

  test("a negative cost is refused", () => {
    const cells = [cell("A", "cold")];
    const records = [record("A", { acquired: 10 })];

    expect(() => result({ cells, records, cost: -1, revenue: "acquired.revenue.value" })).toThrow(
      ResultError,
    );
  });

  test("a revenue path the record does not carry is refused, never read as zero", () => {
    const cells = [cell("A", "cold")];
    const bare = record("A", {});
    delete bare.acquired.revenue;

    expect(() =>
      result({ cells, records: [bare], cost: 100, revenue: "acquired.revenue.value" }),
    ).toThrow(ResultError);
  });

  test("a cell with no record is refused rather than counted as zero", () => {
    const cells = [cell("A", "cold"), cell("B", "cold")];

    expect(() =>
      result({
        cells,
        records: [record("A", { acquired: 10 })],
        cost: 100,
        revenue: "acquired.revenue.value",
      }),
    ).toThrow(ResultError);
  });
});
