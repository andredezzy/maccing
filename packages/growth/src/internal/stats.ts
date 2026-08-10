import { normal_cdf } from "./erf.ts";

/**
 * Median of a sample. An even-length sample returns the mean of the two middle values, which the
 * sample need not contain; the reference implementation does the same, so do not switch to a low
 * or high median, which would move a published figure by half a step. Throws `RangeError` on an
 * empty sample, because "no measurements" and "measured zero" are different facts.
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
 * Pooled two-proportion z-test, two-sided. Returns `{ z, p }`, or null where the test has nothing
 * to say: a denominator that is not finite and positive, a success count that is negative,
 * non-finite or above its denominator, or a standard error, z or p that leaves the reals. Never
 * NaN and never a substituted p of 1, because NaN serialises to JSON `null` exactly as a
 * legitimately absent result does and would be indistinguishable from one downstream.
 *
 * The last three guards test the computed values, not the arguments, and must stay that way:
 * finite in-range arguments still leave the domain. Denominators near `Number.MAX_VALUE` sum to
 * Infinity, making the pooled proportion `Infinity / Infinity`. Denominators below about 1e-308
 * have `1 / n === Infinity`, which is `0 * Infinity` in the variance term where the pooled
 * proportion is 0 or 1, and otherwise an infinite standard error reporting z = 0 with p = 1, a
 * "tested and found identical" that someone will act on. Nothing non-finite reaches a caller.
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
  // Positive-finite rather than `se === 0`, so the NaN and Infinity above leave by the same door.
  if (!Number.isFinite(se) || !(se > 0)) {
    return null;
  }
  const z = (a / na - b / nb) / se;
  if (!Number.isFinite(z)) {
    return null;
  }
  const p = 2 * (1 - normal_cdf(Math.abs(z)));
  if (!Number.isFinite(p)) {
    return null;
  }
  return { z, p };
}
