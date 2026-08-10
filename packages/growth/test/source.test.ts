import { describe, expect, test } from "bun:test";

import { driver_rows, TimestampDriverError } from "../src/meta/whatsapp/campaigns/source.ts";

/**
 * The driver boundary, exercised without a database.
 *
 * Everything a Postgres source hands the engine passes through here, and the one defect this file
 * has had came through it: `Bun.sql` turns a `timestamp without time zone` into a `Date` by reading
 * the stored wall clock in the *client's* timezone, so the same row is a different instant on every
 * machine that measures it. Nothing downstream could see it — by then the value was a well-formed
 * instant, and every guard passed. It was caught by re-measuring a campaign whose numbers were
 * already known and finding one median four hours out.
 */
describe("what a driver hands back", () => {
  test("refuses a column that arrived as a timestamp rather than as text", () => {
    // The exact shape `Bun.sql` produces for `select "createdAt" from "User"`.
    let caught: unknown;
    try {
      driver_rows("lead", [{ id: "u1", created_at: new Date("2026-01-30T23:49:45.985Z") }]);
    } catch (failure) {
      caught = failure;
    }

    expect(caught).toBeInstanceOf(TimestampDriverError);
    expect((caught as TimestampDriverError).role).toBe("lead");
    expect((caught as TimestampDriverError).column).toBe("created_at");
    // The remedy is one cast, and the message has to carry it: the person reading this error is the
    // person who wrote the query, and they are the only one who knows which kind of column it is.
    expect((caught as Error).message).toContain("created_at::text");
    expect((caught as Error).message).toContain("at time zone 'UTC'");
  });

  test("and says so for a timestamp anywhere in the row, not only the first column", () => {
    const caught = (() => {
      try {
        driver_rows("conversion", [{ lead: "u1", at: "2026-01-30 23:49:45.985", amount: "10", committed: true }]);
        return driver_rows("conversion", [{ lead: "u1", at: "x", amount: "10", at_fallback: new Date() }]);
      } catch (failure) {
        return failure;
      }
    })();

    expect(caught).toBeInstanceOf(TimestampDriverError);
    expect((caught as TimestampDriverError).column).toBe("at_fallback");
  });

  test("carries a naive timestamp string through untouched", () => {
    // What the cast produces, and what `\copy` writes. Read as UTC downstream, the same either way.
    const { header, records } = driver_rows("lead", [
      { id: "u1", phone: "5511987654321", created_at: "2026-01-30 23:49:45.985" },
    ]);

    expect(header).toEqual(["id", "phone", "created_at"]);
    expect(records).toEqual([{ id: "u1", phone: "5511987654321", created_at: "2026-01-30 23:49:45.985" }]);
  });

  test("renders a boolean as the literal the contract reads", () => {
    // A driver hands back real booleans for `(status in (...)) as committed`. The contract carries
    // strings, and `true`/`false` are the two it accepts — so the conversion belongs here, not in
    // every project's SQL.
    const { records } = driver_rows("conversion", [
      { lead: "u1", at: "2026-01-30 23:49:45", amount: "10", committed: true, recycled: false },
    ]);

    expect(records).toEqual([
      { lead: "u1", at: "2026-01-30 23:49:45", amount: "10", committed: "true", recycled: "false" },
    ]);
  });

  test("renders an absent value as the empty cell a CSV would have carried", () => {
    // `null` and a missing column are the same absence from every source, which is what lets an
    // optional binding be optional in the same way on both sides.
    const { records } = driver_rows("conversion", [
      { lead: "u1", at: "2026-01-30 23:49:45", amount: "10", committed: true, recycled: null },
    ]);

    expect(records).toEqual([{ lead: "u1", at: "2026-01-30 23:49:45", amount: "10", committed: "true", recycled: "" }]);
  });

  test("describes an empty answer as no header and no rows", () => {
    // The signal a role is unbound rather than measured at zero. A driver returning no rows also
    // returns no column names, and this is the one place that distinction is made.
    expect(driver_rows("churn", [])).toEqual({ header: [], records: [] });
  });
});
