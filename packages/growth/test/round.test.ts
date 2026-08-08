import { describe, expect, test } from "bun:test";

import { round_half_even, round_or_null } from "../src/internal/round.ts";

/**
 * The rounding suite is the byte-identity gate. The published record has to be reproducible
 * from a second implementation, and the second implementation people reach for is Python, whose
 * `round()` breaks a tie towards the even digit on the double's exact value. JavaScript's
 * `toFixed` breaks the same tie upwards on the decimal it prints. Those two disagree on a small
 * but very reachable set of numbers, so every tie below is written out with the wrong answer
 * named in a comment: if someone quietly swaps the implementation for `toFixed`, these fail.
 */

/** One `(value, digits)` pair fed to both implementations. */
type RoundCase = [value: number, digits: number];

/**
 * The cross-check corpus. Kept as data rather than as assertions because the expected column is
 * produced by Python at run time — hardcoding it here would only be re-asserting this file
 * against itself. Ordered: exact binary ties at 0, 1, 2 and 3 digits, then decimals that look
 * like ties but are not, then magnitudes where the scaling step can lose a bit, then ordinary
 * values that no correct implementation can get wrong.
 */
const ROUND_CASES: readonly RoundCase[] = [
  // Exact ties at 0 digits: k + 1/2 is representable, so the tie is real.
  [0.5, 0],
  [1.5, 0],
  [2.5, 0],
  [3.5, 0],
  [4.5, 0],
  [5.5, 0],
  [6.5, 0],
  [-0.5, 0],
  [-1.5, 0],
  [-2.5, 0],
  [-3.5, 0],
  // Exact ties at 1 digit: k + 1/4 and k + 3/4.
  [0.25, 1],
  [0.75, 1],
  [1.25, 1],
  [1.75, 1],
  [2.25, 1],
  [2.75, 1],
  [3.25, 1],
  [3.75, 1],
  [4.25, 1],
  [-0.25, 1],
  [-1.25, 1],
  [-2.75, 1],
  // Exact ties at 2 digits: odd eighths.
  [0.125, 2],
  [0.375, 2],
  [0.625, 2],
  [0.875, 2],
  [1.125, 2],
  [1.375, 2],
  [1.625, 2],
  [1.875, 2],
  [2.125, 2],
  [-0.125, 2],
  [-0.375, 2],
  [-1.625, 2],
  // Exact ties at 3 digits: odd sixteenths.
  [0.0625, 3],
  [0.1875, 3],
  [0.3125, 3],
  [0.4375, 3],
  [0.5625, 3],
  [0.6875, 3],
  [0.8125, 3],
  [0.9375, 3],
  [1.0625, 3],
  [-0.0625, 3],
  [-0.3125, 3],
  // Near-ties: decimals that read as ties but land above or below one in binary. These are
  // the cases where "round the printed decimal" and "round the stored double" diverge.
  [2.675, 2],
  [1.005, 2],
  [1.115, 2],
  [2.345, 2],
  [8.835, 2],
  [0.145, 2],
  [4.35, 1],
  [4.45, 1],
  [8.35, 1],
  [1.045, 2],
  [0.615, 2],
  // Large magnitudes, where a scale-multiply-unscale implementation can drift.
  [98765.5, 0],
  [12345678901.5, 0],
  [-98765.5, 0],
  [1234567.875, 2],
  [8589934592.25, 1],
  [1000000000000.5, 0],
  // Ordinary values with no tie in sight.
  [Math.PI, 3],
  [-Math.PI, 3],
  [Math.E, 4],
  [100, 0],
  [0, 2],
  [-7, 1],
  [0.001, 2],
  [-0.006, 2],
];

/**
 * `-0 === 0` is true and `Object.is(-0, 0)` is false. The sign of a zero is not part of the
 * contract — Python prints `-0.0` for `round(-0.5)` and nobody publishes that distinction — so
 * the comparison uses `===` and only special-cases NaN, which is unequal to itself.
 */
function same_number(a: number, b: number): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

/**
 * Runs a Python snippet and returns its stdout lines, or null when there is no usable `python3`.
 * The probe is a real spawn rather than a PATH lookup, because a `python3` that exists and
 * cannot run is the same problem as one that is not there.
 */
function python_lines(script: string): string[] | null {
  let stdout: string;
  try {
    const proc = Bun.spawnSync(["python3", "-c", script]);
    if (!proc.success) {
      return null;
    }
    stdout = proc.stdout.toString();
  } catch {
    return null;
  }
  const trimmed = stdout.trim();
  return trimmed === "" ? [] : trimmed.split("\n");
}

/** Attempted once, at load, so the choice between `test` and `test.skip` is made from facts. */
const PYTHON_AVAILABLE = python_lines("print(1 + 1)")?.[0] === "2";
const python_test = PYTHON_AVAILABLE ? test : test.skip;

describe("round_half_even", () => {
  test("breaks an exact tie towards the even digit", () => {
    expect(round_half_even(4.25, 1)).toBe(4.2); // toFixed would give 4.3
    expect(round_half_even(0.125, 2)).toBe(0.12); // toFixed would give 0.13
    expect(round_half_even(0.375, 2)).toBe(0.38); // toFixed agrees here, by luck
    expect(round_half_even(0.625, 2)).toBe(0.62); // toFixed would give 0.63
    expect(round_half_even(0.875, 2)).toBe(0.88); // toFixed agrees here, by luck
  });

  test("rounds a near-tie by the stored double, not by the printed decimal", () => {
    // 4.35 is stored as 4.3499999999999996..., below the tie, so it rounds down. Reading
    // "4.35" as a decimal and rounding half-up would give 4.4, which is the wrong answer.
    expect(round_half_even(4.35, 1)).toBe(4.3);
    // The classic surprise: 2.675 is stored as 2.67499999999999982..., so it rounds down.
    expect(round_half_even(2.675, 2)).toBe(2.67); // toFixed would give 2.68
    // 1.005 is stored just below its tie as well.
    expect(round_half_even(1.005, 2)).toBe(1); // toFixed would give 1.01
    // 2.345 is stored just above its tie, so it rounds up and the even-digit rule never fires.
    expect(round_half_even(2.345, 2)).toBe(2.35);
  });

  test("breaks a tie at zero digits towards the even integer", () => {
    expect(round_half_even(2.5, 0)).toBe(2); // toFixed would give 3
    expect(round_half_even(3.5, 0)).toBe(4);
    expect(round_half_even(4.5, 0)).toBe(4); // toFixed would give 5
    expect(round_half_even(-2.5, 0)).toBe(-2); // toFixed would give -3
    expect(round_half_even(-3.5, 0)).toBe(-4);
  });

  test("treats a negative the same way as its magnitude", () => {
    expect(round_half_even(-4.25, 1)).toBe(-4.2);
    expect(round_half_even(-0.125, 2)).toBe(-0.12);
    expect(round_half_even(-Math.PI, 3)).toBe(-Math.PI);
  });

  test("leaves zero and already-rounded values alone", () => {
    expect(round_half_even(0, 2)).toBe(0);
    expect(round_half_even(7, 0)).toBe(7);
    expect(round_half_even(-7, 1)).toBe(-7);
    expect(round_half_even(1.5, 4)).toBe(1.5);
  });

  test("passes non-finite input straight through", () => {
    expect(round_half_even(Number.POSITIVE_INFINITY, 2)).toBe(Number.POSITIVE_INFINITY);
    expect(round_half_even(Number.NEGATIVE_INFINITY, 2)).toBe(Number.NEGATIVE_INFINITY);
    expect(Number.isNaN(round_half_even(Number.NaN, 2))).toBe(true);
  });

  test("keeps large magnitudes intact instead of drifting through the scale step", () => {
    expect(round_half_even(12345678901.5, 0)).toBe(12345678902);
    expect(round_half_even(1234567.875, 2)).toBe(1234567.88);
    expect(round_half_even(1000000000000.5, 0)).toBe(1000000000000);
  });

  python_test("agrees with Python's round() on every case in the corpus", () => {
    // Single source of truth: the corpus is serialised into the snippet, so the two sides
    // cannot drift apart by someone editing one list and forgetting the other.
    const payload = JSON.stringify(JSON.stringify(ROUND_CASES));
    const script = [
      "import json",
      `for value, digits in json.loads(${payload}):`,
      "    print(repr(round(value, digits)))",
    ].join("\n");

    const lines = python_lines(script);
    expect(lines).not.toBeNull();
    expect(lines).toHaveLength(ROUND_CASES.length);

    const mismatches: string[] = [];
    for (let i = 0; i < ROUND_CASES.length; i += 1) {
      const [value, digits] = ROUND_CASES[i] as RoundCase;
      const expected = Number((lines as string[])[i]);
      const actual = round_half_even(value, digits);
      if (!same_number(actual, expected)) {
        mismatches.push(`round(${value}, ${digits}): python ${expected}, ours ${actual}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  test("covers ties at every digit count the corpus claims to cover", () => {
    // Guards the corpus itself: an edit that dropped all the 3-digit ties would leave the
    // cross-check green while it silently tested less than it says it does.
    const digits = [...new Set(ROUND_CASES.map(([, d]) => d))].sort();
    expect(digits).toEqual([0, 1, 2, 3, 4]);
    expect(ROUND_CASES.length).toBeGreaterThanOrEqual(60);
  });
});

describe("round_or_null", () => {
  test("passes null through untouched", () => {
    expect(round_or_null(null, 2)).toBeNull();
    expect(round_or_null(null, 0)).toBeNull();
  });

  test("rounds a present value exactly as round_half_even does", () => {
    expect(round_or_null(4.25, 1)).toBe(4.2);
    expect(round_or_null(2.5, 0)).toBe(2);
    expect(round_or_null(-0.375, 2)).toBe(-0.38);
    expect(round_or_null(2.675, 2)).toBe(2.67);
  });

  test("does not confuse zero with absence", () => {
    // The record distinguishes a measured zero from an unbound role, and a truthiness check
    // in the wrong place collapses the two.
    expect(round_or_null(0, 2)).not.toBeNull();
    expect(round_or_null(0, 2)).toBe(0);
  });
});
