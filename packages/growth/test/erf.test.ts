import { describe, expect, test } from "bun:test";

import { erf, normal_cdf } from "../src/internal/erf.ts";

/**
 * `erf` is the only transcendental in the package and everything published as a p-value goes
 * through it, so it is pinned against high-precision reference values rather than against
 * itself. The tolerance is 1e-12: tight enough that a series truncated one term too early
 * fails, loose enough that the last bit of a double is not being litigated.
 */

const TOLERANCE = 1e-12;

/** The 97.5th percentile of the standard normal, to full double precision. */
const Z_975 = 1.959963984540054;

/**
 * Runs a Python snippet and returns its stdout lines, or null when there is no usable `python3`.
 * A real spawn is the probe, because a `python3` on PATH that cannot run is the same problem as
 * one that is absent.
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

/** The sweep used for the Python cross-check and for the monotonicity check. */
const SWEEP: readonly number[] = [
  -4, -3.5, -3, -2.5, -2, -1.75, -1.5, -1.25, -1, -0.75, -0.5, -0.25, -0.125, 0, 0.125, 0.25, 0.5, 0.75, 1, 1.25, 1.5,
  1.75, 2, 2.5, 3, 3.5, 4,
];

describe("erf", () => {
  test("matches the reference values at the usual checkpoints", () => {
    // Reference values are the standard tabulated ones for the error function; each is the
    // true value rounded to seventeen significant digits, so a correct double
    // implementation lands well inside the tolerance.
    // `===` rather than `toBe`, which is `Object.is` and would separate -0 from 0. The sign
    // of a zero is not part of anything this package publishes.
    expect(erf(0) === 0).toBe(true);
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 12);
    expect(erf(0.5)).toBeCloseTo(0.5204998778130465, 12);
    expect(erf(2)).toBeCloseTo(0.9953222650189527, 12);
    expect(erf(3)).toBeCloseTo(0.9999779095030014, 12);
    expect(erf(-1)).toBeCloseTo(-0.8427007929497149, 12);
  });

  test("is odd: erf(-x) is exactly -erf(x)", () => {
    // Exact rather than approximate. A sign handled by a separate branch instead of by
    // negating the result would show up here as a difference in the last bits. Compared
    // with `!==` so that the zero in the sweep is not a fight about the sign of a zero.
    const mismatches: string[] = [];
    for (const x of SWEEP) {
      if (erf(-x) !== -erf(x)) {
        mismatches.push(`x=${x}: erf(-x) is ${erf(-x)}, -erf(x) is ${-erf(x)}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  test("increases across the whole sweep and stays inside its asymptotes", () => {
    let previous = Number.NEGATIVE_INFINITY;
    for (const x of SWEEP) {
      const y = erf(x);
      expect(y).toBeGreaterThan(previous);
      expect(y).toBeGreaterThanOrEqual(-1);
      expect(y).toBeLessThanOrEqual(1);
      previous = y;
    }
  });

  test("saturates rather than overshooting far out in the tails", () => {
    expect(erf(10)).toBeCloseTo(1, 12);
    expect(erf(-10)).toBeCloseTo(-1, 12);
    expect(erf(40)).toBeLessThanOrEqual(1);
    expect(erf(-40)).toBeGreaterThanOrEqual(-1);
  });

  python_test("agrees with math.erf across the sweep", () => {
    const payload = JSON.stringify(JSON.stringify(SWEEP));
    const script = ["import json, math", `for x in json.loads(${payload}):`, "    print(repr(math.erf(x)))"].join("\n");

    const lines = python_lines(script);
    expect(lines).not.toBeNull();
    expect(lines).toHaveLength(SWEEP.length);

    const mismatches: string[] = [];
    for (let i = 0; i < SWEEP.length; i += 1) {
      const x = SWEEP[i] as number;
      const expected = Number((lines as string[])[i]);
      const actual = erf(x);
      if (Math.abs(actual - expected) > TOLERANCE) {
        mismatches.push(`erf(${x}): python ${expected}, ours ${actual}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("normal_cdf", () => {
  test("is exactly one half at the mean", () => {
    expect(normal_cdf(0)).toBeCloseTo(0.5, 12);
  });

  test("puts the two-sided 5% boundary where the tables put it", () => {
    // 1.959963984540054 is the z that leaves 2.5% in each tail; every p-value the package
    // publishes is compared against a threshold derived from exactly this point.
    expect(normal_cdf(Z_975)).toBeCloseTo(0.975, 12);
    expect(normal_cdf(-Z_975)).toBeCloseTo(0.025, 12);
  });

  test("is symmetric about the mean", () => {
    for (const z of SWEEP) {
      expect(normal_cdf(z) + normal_cdf(-z)).toBeCloseTo(1, 12);
    }
  });

  test("increases and stays a probability across the sweep", () => {
    let previous = Number.NEGATIVE_INFINITY;
    for (const z of SWEEP) {
      const p = normal_cdf(z);
      expect(p).toBeGreaterThan(previous);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      previous = p;
    }
  });

  test("reaches its limits without leaving the unit interval", () => {
    expect(normal_cdf(12)).toBeCloseTo(1, 12);
    expect(normal_cdf(-12)).toBeCloseTo(0, 12);
    expect(normal_cdf(-40)).toBeGreaterThanOrEqual(0);
    expect(normal_cdf(40)).toBeLessThanOrEqual(1);
  });
});
