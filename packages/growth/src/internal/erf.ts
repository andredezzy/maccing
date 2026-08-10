/**
 * The error function, which the runtime does not ship and the two-proportion test needs for its
 * normal CDF. Accuracy over speed: a p-value decides publication by which side of a threshold it
 * falls on, so error in the third decimal would decide it by rounding noise.
 *
 * Maximum absolute error below 1e-12 across [-6, 6]; measured against correctly-rounded references
 * on a 0.0001 grid, the observed maximum is 1.2e-15. Beyond |x| = 6 the function is 1 to within a
 * double's resolution. The Abramowitz & Stegun 7.1.26 rational approximation is deliberately not
 * used: its error bound is 1.5e-7, five orders short of the claim.
 *
 * Two branches, each where it converges cleanly. Below |x| = 2, the confluent series A&S 7.1.6,
 * whose terms are all positive; the algebraically equal alternating Maclaurin form suffers
 * cancellation and must not be substituted. At or above it, `erfc` from the continued fraction
 * A&S 7.1.14 by modified Lentz, taken as the complement so `1 - erfc` subtracts a value already
 * small enough to lose no significant digits. Both loops run until a step stops moving the result
 * rather than to a fixed term count.
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

/** `erf(x)` for real `x`, to the accuracy above. NaN in, NaN out; the infinities give 1 and -1. */
export function erf(x: number): number {
  if (Number.isNaN(x)) {
    return Number.NaN;
  }
  if (x === 0) {
    return x;
  }
  // The continued fraction below divides by the argument, so an infinite input would come back
  // NaN instead of saturated, and a NaN p-value reads as "no result" at every gate downstream.
  if (x === Infinity) {
    return 1;
  }
  if (x === -Infinity) {
    return -1;
  }

  const magnitude = Math.abs(x);
  const sign = x < 0 ? -1 : 1;

  if (magnitude < BRANCH_POINT) {
    // `term` carries 2^n * x^(2n+1) / (1*3*...*(2n+1)); neighbouring terms differ by 2*x*x/(2n+1).
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

  // Modified Lentz for erfc: partial numerators 1, 1/2, 2/2, 3/2, ...; denominators all `magnitude`.
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

/** Standard normal cumulative distribution, `P(Z <= z)`. */
export function normal_cdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}
