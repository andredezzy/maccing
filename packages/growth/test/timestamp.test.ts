import { describe, expect, test } from "bun:test";

import { parse_ts, parse_ts_with_precision, TimestampError } from "../src/internal/timestamp.ts";

/**
 * The timestamp suite guards one decision and one assumption.
 *
 * The decision: the reference implementation this engine replaces reads a fraction to the
 * microsecond, while the runtime here resolves an instant to the millisecond. Rather than abandon
 * the runtime's instant for a bigint — a large change — the engine truncates and refuses the one
 * input for which truncation is not provably harmless.
 *
 * The assumption underneath it: truncation cannot move an event across a cut that sits on a whole
 * millisecond. That claim is what makes the small fix the correct one, so it is executed here as a
 * sweep against exact microsecond arithmetic rather than asserted in a comment.
 */

/** Midnight-anchored helper: the epoch milliseconds of a plain UTC wall time. */
const at_utc = (h: number, m: number, s: number, ms = 0): number => Date.UTC(2026, 2, 4, h, m, s, ms);

describe("parse_ts, absent input", () => {
  test("null is a fact, not an error", () => {
    expect(parse_ts(null)).toBeNull();
  });

  test("undefined is a fact, not an error", () => {
    expect(parse_ts(undefined)).toBeNull();
  });

  test("an empty string is a fact, not an error", () => {
    expect(parse_ts("")).toBeNull();
  });

  test("whitespace alone is a fact, not an error", () => {
    expect(parse_ts("   \t\n ")).toBeNull();
  });
});

describe("parse_ts, shapes an export produces", () => {
  test("a space between the date and the time is accepted", () => {
    // The second source is what a database actually writes: the space separator by default and the
    // fraction out to the microsecond. Pinned at whole seconds alone, this asserted the same instant
    // from the same string as the UTC-default case below, so the two were one test written twice —
    // and a fraction dropped or left-padded on the space path alone would have reached every export
    // taken in the default format with nothing here reading it.
    expect(parse_ts("2026-03-04 05:06:07")?.getTime()).toBe(at_utc(5, 6, 7));
    expect(parse_ts("2026-03-04 05:06:07.123456")?.getTime()).toBe(at_utc(5, 6, 7, 123));
  });

  test("a T between the date and the time is accepted", () => {
    expect(parse_ts("2026-03-04T05:06:07")?.getTime()).toBe(at_utc(5, 6, 7));
  });

  test("both spellings land on the same instant", () => {
    expect(parse_ts("2026-03-04 05:06:07.25")?.getTime()).toBe(parse_ts("2026-03-04T05:06:07.25")?.getTime());
  });

  test("no zone suffix is read as UTC, not as the host's own zone", () => {
    // Written so the assertion cannot pass by accident on a UTC machine: the expected value is
    // built with Date.UTC, which disagrees with a local reading on every offset but zero.
    expect(parse_ts("2026-03-04 05:06:07")?.getTime()).toBe(Date.UTC(2026, 2, 4, 5, 6, 7));
  });

  test("an explicit Z is honoured", () => {
    expect(parse_ts("2026-03-04T05:06:07Z")?.getTime()).toBe(at_utc(5, 6, 7));
  });

  test("an explicit offset is honoured and not overwritten with Z", () => {
    expect(parse_ts("2026-03-04T05:06:07+02:00")?.getTime()).toBe(at_utc(3, 6, 7));
  });

  test("an offset following a fraction survives the padding step", () => {
    expect(parse_ts("2026-03-04T05:06:07.25+02:00")?.getTime()).toBe(at_utc(3, 6, 7, 250));
  });

  test("surrounding whitespace is trimmed", () => {
    expect(parse_ts("  2026-03-04 05:06:07  ")?.getTime()).toBe(at_utc(5, 6, 7));
  });
});

describe("parse_ts, the fraction is right-padded", () => {
  /** `[source fraction, expected milliseconds]`. The trap this table exists for is left-padding:
   *  `.5` is half a second, so 500ms — not five microseconds, which would round to 0ms. */
  const FRACTIONS: readonly [fraction: string, ms: number][] = [
    ["5", 500],
    ["25", 250],
    ["125", 125],
    ["1250", 125],
    ["12500", 125],
    ["125000", 125],
    ["0", 0],
    ["05", 50],
    ["005", 5],
    ["0005", 0],
    ["999999", 999],
  ];

  for (const [fraction, ms] of FRACTIONS) {
    test(`.${fraction} is ${ms}ms`, () => {
      expect(parse_ts(`2026-03-04T05:06:07.${fraction}`)?.getTime()).toBe(at_utc(5, 6, 7, ms));
    });
  }

  test("one digit is not read as the last digit of six", () => {
    // The left-padded reading of `.5` would be 5 microseconds, which truncates to the whole second.
    expect(parse_ts("2026-03-04T05:06:07.5")?.getTime()).not.toBe(at_utc(5, 6, 7));
  });
});

describe("parse_ts, precision beyond the runtime's instant", () => {
  test("seven digits truncate rather than throw", () => {
    expect(parse_ts("2026-03-04T05:06:07.1234567")?.getTime()).toBe(at_utc(5, 6, 7, 123));
  });

  test("nine digits truncate rather than throw", () => {
    expect(parse_ts("2026-03-04T05:06:07.123456789")?.getTime()).toBe(at_utc(5, 6, 7, 123));
  });

  test("the fraction is truncated, never rounded up", () => {
    expect(parse_ts("2026-03-04T05:06:07.999999")?.getTime()).toBe(at_utc(5, 6, 7, 999));
    expect(parse_ts("2026-03-04T05:06:07.249999")?.getTime()).toBe(at_utc(5, 6, 7, 249));
  });
});

describe("parse_ts, unreadable input", () => {
  test("prose throws the named error", () => {
    expect(() => parse_ts("last tuesday")).toThrow(TimestampError);
  });

  test("a truncated date throws the named error", () => {
    expect(() => parse_ts("2026-13-45T99:99:99")).toThrow(TimestampError);
  });

  test("the error carries the offending value", () => {
    try {
      parse_ts("  not a moment  ");
      throw new Error("expected a TimestampError");
    } catch (error) {
      expect(error).toBeInstanceOf(TimestampError);
      expect((error as TimestampError).value).toBe("not a moment");
    }
  });
});

describe("parse_ts_with_precision", () => {
  test("it reads the same instant as parse_ts", () => {
    // Both readings pinned to the literal rather than to each other. The flagged reading hands back
    // the very Date `parse_ts` built, so asserting one against the other compares an instant with
    // itself and holds for any parse whatever: a `parse_ts` an hour out leaves that form of this
    // test green while every cut in the engine is compared against the wrong moment.
    const source = "2026-03-04T05:06:07.123456";
    expect(parse_ts_with_precision(source).at?.getTime()).toBe(at_utc(5, 6, 7, 123));
    expect(parse_ts(source)?.getTime()).toBe(at_utc(5, 6, 7, 123));
  });

  test("absent input is null and unflagged", () => {
    for (const source of [null, undefined, "", "   "]) {
      expect(parse_ts_with_precision(source)).toEqual({ at: null, sub_millisecond: false });
    }
  });

  test("unreadable input still throws", () => {
    expect(() => parse_ts_with_precision("last tuesday")).toThrow(TimestampError);
  });

  /** `[source fraction or null for none, flagged]`. Three digits is exactly a millisecond, and
   *  zeros beyond the third are still exactly a millisecond, so only a non-zero digit past the
   *  third makes the instant unrepresentable. */
  const PRECISION: readonly [fraction: string | null, flagged: boolean][] = [
    [null, false],
    ["5", false],
    ["25", false],
    ["125", false],
    ["999", false],
    ["1230", false],
    ["123000", false],
    ["0000", false],
    ["1234", true],
    ["1204", true],
    ["123456", true],
    ["0001", true],
    ["000001", true],
    ["1234567", true],
  ];

  for (const [fraction, flagged] of PRECISION) {
    const source = fraction === null ? "2026-03-04T05:06:07" : `2026-03-04T05:06:07.${fraction}`;
    test(`${source} is ${flagged ? "" : "not "}sub-millisecond`, () => {
      expect(parse_ts_with_precision(source).sub_millisecond).toBe(flagged);
    });
  }

  test("an offset after the fraction is not mistaken for precision", () => {
    expect(parse_ts_with_precision("2026-03-04T05:06:07.250+02:00").sub_millisecond).toBe(false);
    expect(parse_ts_with_precision("2026-03-04T05:06:07.250001+02:00").sub_millisecond).toBe(true);
  });
});

/**
 * The property the whole design decision rests on.
 *
 * Truncation only ever moves an instant down, towards the start of its own millisecond. So against
 * a cut that sits on a whole millisecond, the truncated comparison has to give the same answer as
 * an exact microsecond comparison would, for every event on either side. If it ever did not, the
 * engine would need a bigint instant instead of a guard on the cut.
 *
 * The exact side is computed from the digits rather than from the runtime, so this is a genuine
 * cross-check and not the parser re-asserting itself. Microseconds since the epoch exceed what a
 * double holds exactly for far-future dates, so the arithmetic is done in bigint.
 */
describe("truncation cannot move an event across a whole-millisecond cut", () => {
  /** Epoch microseconds of `2026-03-04T05:06:SS.ffffff`, from the digits alone. */
  const exact_us = (second: number, fraction: string): bigint =>
    BigInt(Date.UTC(2026, 2, 4, 5, 6, second)) * 1000n + BigInt(fraction.padEnd(6, "0"));

  const SECONDS = [6, 7, 8] as const;

  /** Fractions written the way an export writes them — trailing zeros dropped, widths uneven —
   *  and clustered hard against the cut, because that is the only place the two readings could
   *  ever part company. `249999` is the case that fails the moment truncation becomes rounding. */
  const FRACTIONS: readonly string[] = [
    "",
    "0",
    "000001",
    "1",
    "2",
    "24",
    "249",
    "2499",
    "24999",
    "249998",
    "249999",
    "25",
    "250",
    "250000",
    "250001",
    "250002",
    "2501",
    "251",
    "2519",
    "3",
    "9",
    "99",
    "999",
    "9999",
    "999998",
    "999999",
  ];

  /** The cut: second 07, a quarter of a second in — exactly 250ms, a whole millisecond. */
  const CUT = "2026-03-04T05:06:07.250";
  const cut_at = parse_ts(CUT);
  const cut_us = exact_us(7, "250");

  test("the cut is itself on a whole millisecond, which is the premise", () => {
    expect(parse_ts_with_precision(CUT).sub_millisecond).toBe(false);
    expect(cut_us % 1000n).toBe(0n);
  });

  test("the sweep straddles the cut in both directions", () => {
    const sides = new Set<boolean>();
    for (const second of SECONDS) {
      for (const fraction of FRACTIONS) {
        sides.add(exact_us(second, fraction) >= cut_us);
      }
    }
    expect(sides).toEqual(new Set([true, false]));
  });

  test("every event agrees with the exact microsecond comparison", () => {
    for (const second of SECONDS) {
      for (const fraction of FRACTIONS) {
        const pad = String(second).padStart(2, "0");
        const source = fraction === "" ? `2026-03-04T05:06:${pad}` : `2026-03-04T05:06:${pad}.${fraction}`;
        const truncated = (parse_ts(source) as Date).getTime() >= (cut_at as Date).getTime();
        const exact = exact_us(second, fraction) >= cut_us;
        expect(`${source} -> ${truncated}`).toBe(`${source} -> ${exact}`);
      }
    }
  });

  test("the sweep would catch a parser that rounded instead of truncating", () => {
    // Guard on the guard: `.249999` is the event that separates the two behaviours, so if it ever
    // leaves the sweep above, that test stops being able to fail.
    expect(FRACTIONS).toContain("249999");
    const rounded = at_utc(5, 6, 7, 250);
    expect((parse_ts("2026-03-04T05:06:07.249999") as Date).getTime()).not.toBe(rounded);
    expect(exact_us(7, "249999") < cut_us).toBe(true);
  });
});
