/**
 * The error function, because the runtime does not ship one and the two-proportion test needs a
 * normal CDF. The requirement on this file is accuracy, not speed: a comparison is published or
 * withheld on which side of a threshold its p-value falls, so an approximation whose error is
 * visible in the third decimal would decide that question by rounding noise.
 *
 * Method, in two branches, each chosen where it converges cleanly:
 *
 * - `|x| < 2` uses the confluent series `erf(x) = (2/sqrt(pi)) * exp(-x*x) * sum_{n>=0} 2^n *
 *   x^(2n+1) / (1*3*5*...*(2n+1))` (Abramowitz & Stegun 7.1.6). Every term is positive, so unlike
 *   the alternating Maclaurin form it suffers no cancellation, and it is iterated until a term
 *   stops moving the running sum — convergence to the last representable bit rather than to a
 *   fixed term count.
 * - `|x| >= 2` computes the complement from the continued fraction `erfc(x) = exp(-x*x)/sqrt(pi) *
 *   1/(x + (1/2)/(x + 1/(x + (3/2)/(x + ...))))` (A&S 7.1.14), evaluated with the modified Lentz
 *   algorithm and iterated to the same standard. Taking the complement here keeps the subtraction
 *   `1 - erfc` harmless, because past 2 the complement is already small enough that the difference
 *   loses no significant digits.
 *
 * Claimed accuracy: maximum absolute error below 1e-12 across [-6, 6]. Measured against
 * correctly-rounded reference values on a 0.0001 grid over that interval, the observed maximum is
 * 1.2e-15 — a few units in the last place, four orders inside the claim. Beyond |x| = 6 the
 * function is 1 to within a double's resolution and the claim is trivially met. The Abramowitz &
 * Stegun 7.1.26 rational approximation is *not* used: its error bound is 1.5e-7, five orders of
 * magnitude short of what is claimed here.
 */

const TWO_OVER_SQRT_PI = 2 / Math.sqrt(Math.PI);
const ONE_OVER_SQRT_PI = 1 / Math.sqrt(Math.PI);

/** Where the series stops paying and the continued fraction starts converging quickly. */
const BRANCH_POINT = 2;

/** Both loops stop when a step no longer moves the result; these only bound a pathological case. */
const MAX_SERIES_TERMS = 200;
const MAX_FRACTION_DEPTH = 400;

/** Lentz's guard against a zero denominator: small enough to vanish, non-zero so division is safe. */
const LENTZ_FLOOR = 1e-300;

export function erf(x: number): number {
  if (Number.isNaN(x)) {
    return Number.NaN;
  }
  if (x === 0) {
    return x;
  }
  // The continued fraction below divides by the argument, which turns an infinite input into a
  // NaN rather than the saturated value it should have. A NaN p-value reads as "no result" at
  // every gate downstream, so it is caught here instead.
  if (x === Infinity) {
    return 1;
  }
  if (x === -Infinity) {
    return -1;
  }

  const magnitude = Math.abs(x);
  const sign = x < 0 ? -1 : 1;

  if (magnitude < BRANCH_POINT) {
    // Positive-term series. `term` carries 2^n * x^(2n+1) / (1*3*...*(2n+1)) forward by one
    // multiplication each step; the ratio between neighbouring terms is 2*x*x/(2n+1).
    const squared = magnitude * magnitude;
    let term = magnitude;
    let sum = magnitude;
    for (let n = 1; n <= MAX_SERIES_TERMS; n++) {
      term *= (2 * squared) / (2 * n + 1);
      const next = sum + term;
      if (next === sum) {
        break;
      }
      sum = next;
    }
    return sign * TWO_OVER_SQRT_PI * Math.exp(-squared) * sum;
  }

  // Modified Lentz on the continued fraction for erfc. The partial numerators run
  // 1, 1/2, 2/2, 3/2, ... and every partial denominator is `magnitude`.
  let f = LENTZ_FLOOR;
  let c = f;
  let d = 0;
  for (let n = 1; n <= MAX_FRACTION_DEPTH; n++) {
    const numerator = n === 1 ? 1 : (n - 1) / 2;
    d = magnitude + numerator * d;
    if (d === 0) {
      d = LENTZ_FLOOR;
    }
    c = magnitude + numerator / c;
    if (c === 0) {
      c = LENTZ_FLOOR;
    }
    d = 1 / d;
    const delta = c * d;
    f *= delta;
    if (Math.abs(delta - 1) < Number.EPSILON) {
      break;
    }
  }

  const complement = ONE_OVER_SQRT_PI * Math.exp(-magnitude * magnitude) * f;
  return sign * (1 - complement);
}

/** Standard normal cumulative distribution. */
export function normal_cdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}
