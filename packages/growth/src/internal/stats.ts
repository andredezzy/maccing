import { normal_cdf } from "./erf.ts";

/**
 * The median of a sample, with the even-length case resolved as the mean of the two middle
 * values. That choice is not free: it produces a value the sample does not contain, and it is the
 * one the reference implementation makes, so the port keeps it rather than silently switching to a
 * lower or higher median and moving a published figure by half a step.
 *
 * An empty sample throws instead of returning zero. "No measurements" and "measured zero" are
 * different facts, and a caller with nothing to summarise owns the decision about which to report.
 */
export function median(xs: number[]): number {
  if (xs.length === 0) {
    throw new RangeError("median of an empty sample is undefined");
  }
  const sorted = [...xs].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  if (sorted.length % 2 === 1) {
    return sorted[middle] as number;
  }
  return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

/**
 * Pooled two-proportion z-test, two-sided.
 *
 * This is the whole reason the comparison is trustworthy. A ratio between two rates says which one
 * is larger; it never says whether the difference survives the sample sizes that produced it, and
 * a ratio read without that answer flips sign between two runs on the same data and gets published
 * both times.
 *
 * Returns null where the test has nothing to say: an empty denominator on either side, or a
 * standard error of zero, which happens when both groups are all-or-nothing. Null is the honest
 * answer there — a p-value of 1 would read as "tested and found no difference".
 *
 * Inputs outside the domain of a proportion — a non-finite or non-positive denominator, or a
 * success count that is negative, non-finite, or larger than its denominator — return null for
 * the same reason, rather than the NaN the arithmetic would otherwise hand back. NaN serialises
 * to `null` in JSON, which is exactly what a legitimately absent result serialises to, so a
 * comparison broken by impossible counts would arrive downstream indistinguishable from one that
 * was never run. Returning null deliberately keeps "nothing to say" one fact instead of two that
 * render identically, and refusing at the boundary means no caller has to test for NaN to find
 * out which it got.
 */
export function two_proportion(a: number, na: number, b: number, nb: number): { z: number; p: number } | null {
  const denominators_valid = Number.isFinite(na) && na > 0 && Number.isFinite(nb) && nb > 0;
  if (!denominators_valid) {
    return null;
  }
  const successes_valid = Number.isFinite(a) && a >= 0 && a <= na && Number.isFinite(b) && b >= 0 && b <= nb;
  if (!successes_valid) {
    return null;
  }
  const pooled = (a + b) / (na + nb);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / na + 1 / nb));
  if (se === 0) {
    return null;
  }
  const z = (a / na - b / nb) / se;
  return { z, p: 2 * (1 - normal_cdf(Math.abs(z))) };
}
