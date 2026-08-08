import { describe, expect, test } from "bun:test";

import { median, two_proportion } from "../src/internal/stats.ts";

/**
 * Two functions, and between them they decide whether a reading is publishable. `median` is the
 * summary that a single large value cannot move; `two_proportion` is the test that decides
 * whether a difference between a treated group and an untouched one is worth reporting at all.
 * The interesting cases are the degenerate ones, because those are where a function that
 * returns a number instead of null turns noise into a claim.
 *
 * Every figure below is invented.
 */

/**
 * Runs a Python snippet and returns its stdout lines, or null when there is no usable `python3`.
 * A real spawn is the probe: a `python3` on PATH that cannot run is the same problem as one
 * that is not installed.
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

const PYTHON_AVAILABLE = python_lines("print(1 + 1)")?.[0] === "2";
const python_test = PYTHON_AVAILABLE ? test : test.skip;

/** One reading, unpacked from the nullable return so the assertions stay readable. */
type Reading = { z: number; p: number };

/** Fails the test rather than returning null, so the caller can use the reading directly. */
function reading(result: Reading | null): Reading {
  expect(result).not.toBeNull();
  return result as Reading;
}

/** Sample sets for the cross-check: odd, even, unsorted, negative, single, and repeated. */
const MEDIAN_CASES: readonly number[][] = [
  [5],
  [1, 2, 3],
  [3, 1, 2],
  [1, 2, 3, 4],
  [10, 2, 8, 4],
  [-3, -1, -2],
  [-5, 5],
  [7, 7, 7, 7],
  [0.5, 1.5, 2.5, 3.5],
  [100, 1, 2, 3, 4, 5, 6],
  [2.25, 4.75],
  [1, 9, 10, 11, 100],
];

describe("median", () => {
  test("takes the middle value of an odd-length sample", () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });

  test("averages the two middle values of an even-length sample", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([2, 4])).toBe(3);
  });

  test("sorts before choosing, rather than trusting the caller's order", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([10, 2, 8, 4])).toBe(6);
  });

  test("sorts numerically, not as strings", () => {
    // The default Array#sort compares stringified values, which puts 100 before 20 and
    // hands back the wrong middle. These samples fail loudly under that bug.
    expect(median([1, 9, 10, 11, 100])).toBe(10);
    expect(median([100, 20, 3])).toBe(20);
  });

  test("handles negatives and a single element", () => {
    expect(median([-3, -1, -2])).toBe(-2);
    expect(median([-5, 5])).toBe(0);
    expect(median([42])).toBe(42);
  });

  test("does not mutate the caller's array", () => {
    // An in-place sort inside a summary function reorders a list the caller is still
    // holding, and the damage surfaces somewhere else entirely.
    const sample = [3, 1, 2];
    median(sample);
    expect(sample).toEqual([3, 1, 2]);
  });

  test("throws on an empty sample instead of inventing a number", () => {
    // There is no median of nothing. Returning 0 or NaN here publishes a number nobody
    // measured.
    expect(() => median([])).toThrow();
  });

  python_test("agrees with statistics.median on every sample", () => {
    const payload = JSON.stringify(JSON.stringify(MEDIAN_CASES));
    const script = [
      "import json, statistics",
      `for sample in json.loads(${payload}):`,
      "    print(repr(statistics.median(sample)))",
    ].join("\n");

    const lines = python_lines(script);
    expect(lines).not.toBeNull();
    expect(lines).toHaveLength(MEDIAN_CASES.length);

    const mismatches: string[] = [];
    for (let i = 0; i < MEDIAN_CASES.length; i += 1) {
      const sample = MEDIAN_CASES[i] as number[];
      const expected = Number((lines as string[])[i]);
      const actual = median(sample);
      if (actual !== expected) {
        mismatches.push(`median(${JSON.stringify(sample)}): python ${expected}, ours ${actual}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("two_proportion", () => {
  test("returns null when either group is empty", () => {
    // No denominator means no proportion. A reading of z = 0 here would say "measured, and
    // identical", which is the opposite of what happened.
    expect(two_proportion(0, 0, 5, 100)).toBeNull();
    expect(two_proportion(5, 100, 0, 0)).toBeNull();
    expect(two_proportion(0, 0, 0, 0)).toBeNull();
  });

  test("returns null when the pooled standard error is zero", () => {
    // Both groups all-miss or both all-hit: the pooled proportion is 0 or 1, the standard
    // error is 0, and z would be a division by zero dressed up as infinity.
    expect(two_proportion(0, 50, 0, 80)).toBeNull();
    expect(two_proportion(40, 40, 30, 30)).toBeNull();
  });

  test("reports no difference when the two rates are equal", () => {
    const { z, p } = reading(two_proportion(10, 100, 20, 200));
    expect(z).toBe(0);
    expect(p).toBe(1);
  });

  test("reports no difference for equal rates at other sizes too", () => {
    for (const [a, na, b, nb] of [
      [1, 4, 25, 100],
      [3, 6, 50, 100],
      [9, 30, 3, 10],
    ] as const) {
      const { z, p } = reading(two_proportion(a, na, b, nb));
      expect(z).toBe(0);
      expect(p).toBe(1);
    }
  });

  test("finds an obvious split significant", () => {
    // Half of one group against a tenth of the other, at a hundred each: no threshold
    // worth having misses this.
    const { z, p } = reading(two_proportion(50, 100, 10, 100));
    expect(Math.abs(z)).toBeGreaterThan(1.959963984540054);
    expect(p).toBeLessThan(0.05);
  });

  test("does not find a small split on small groups significant", () => {
    // Six against four out of ten apiece looks like a difference and is not one. Refusing
    // this reading is the entire job.
    const { p } = reading(two_proportion(6, 10, 4, 10));
    expect(p).toBeGreaterThan(0.05);
  });

  test("is symmetric in its two groups up to the sign of z", () => {
    const forward = reading(two_proportion(30, 100, 15, 100));
    const backward = reading(two_proportion(15, 100, 30, 100));
    expect(forward.z).toBeCloseTo(-backward.z, 12);
    expect(forward.p).toBeCloseTo(backward.p, 12);
  });

  test("keeps p inside 0..1 and z finite across a sweep", () => {
    const sizes = [5, 10, 37, 100, 1000];
    const rates = [0, 0.01, 0.1, 0.5, 0.9, 1];
    const out_of_range: string[] = [];
    let readings = 0;
    for (const na of sizes) {
      for (const nb of sizes) {
        for (const ra of rates) {
          for (const rb of rates) {
            const a = Math.round(ra * na);
            const b = Math.round(rb * nb);
            const result = two_proportion(a, na, b, nb);
            if (result === null) {
              continue;
            }
            readings += 1;
            if (!(result.p >= 0 && result.p <= 1) || !Number.isFinite(result.z)) {
              out_of_range.push(`${a}/${na} vs ${b}/${nb}: z ${result.z}, p ${result.p}`);
            }
          }
        }
      }
    }
    expect(out_of_range).toEqual([]);
    // Guards the sweep itself: an implementation that returned null everywhere would skip
    // every iteration and pass having checked nothing.
    expect(readings).toBeGreaterThan(500);
  });

  test("moves p towards zero as the same split is measured on more people", () => {
    // A rate difference that is noise at ten apiece is a result at a thousand apiece, and
    // the p-value has to be the thing that notices.
    const small = reading(two_proportion(6, 10, 4, 10));
    const large = reading(two_proportion(600, 1000, 400, 1000));
    expect(large.p).toBeLessThan(small.p);
    expect(large.p).toBeLessThan(0.05);
  });
});
