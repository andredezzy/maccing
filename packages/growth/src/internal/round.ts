/**
 * Rounding that agrees with the reference implementation on exact ties.
 *
 * The reference rounds half to *even*, on the double's exact binary value. `toFixed` rounds half
 * up, on a decimal rendering. They disagree whenever the scaled value lands exactly on a half, and
 * that is reachable here rather than theoretical: the median of two lag measurements is the mean of
 * two doubles, so a pair like 4.0 and 4.5 gives exactly 4.25, where half-to-even yields 4.2 and
 * `toFixed(1)` yields 4.3. One digit of drift in a published number is the whole reason this file
 * exists, so the arithmetic below is exact and never scales through a float.
 */

/** Scratch view for reading a double's IEEE-754 bits. Single-threaded, so one is enough. */
const bits_view = new DataView(new ArrayBuffer(8));

const MANTISSA_BITS = 52n;
const FRACTION_MASK = (1n << MANTISSA_BITS) - 1n;
const EXPONENT_MASK = 0x7ffn;
/** Exponent bias (1023) plus the 52 fraction bits, so `stored_exponent - 1075` scales the
 *  integer significand back to the value it stands for. */
const EXPONENT_SHIFT = 1075;
/** Every subnormal shares one exponent: the smallest normal's, with no implicit leading bit. */
const SUBNORMAL_EXPONENT = -1074;

/**
 * Split a finite non-negative double into an exact `significand * 2 ** exponent`. Both parts are
 * exact, which is the point — the pair reproduces the double with no rounding of its own, so every
 * comparison downstream is between integers.
 */
function decompose(value: number): { significand: bigint; exponent: number } {
  bits_view.setFloat64(0, value);
  const bits = bits_view.getBigUint64(0);
  const stored_exponent = Number((bits >> MANTISSA_BITS) & EXPONENT_MASK);
  const fraction = bits & FRACTION_MASK;
  if (stored_exponent === 0) {
    return { significand: fraction, exponent: SUBNORMAL_EXPONENT };
  }
  return { significand: (1n << MANTISSA_BITS) | fraction, exponent: stored_exponent - EXPONENT_SHIFT };
}

/**
 * Round `x` to `digits` decimal places, breaking exact ties toward the even neighbour.
 *
 * Non-finite input is returned unchanged, matching what a caller would get from any other
 * arithmetic on it. Everything else goes through exact integer arithmetic: the scaled value is
 * written as a rational `numerator / denominator` in BigInt, and the tie is decided by comparing
 * twice the remainder against the denominator rather than by inspecting a decimal string.
 *
 * `digits` must be a non-negative integer within a range a double can express. Anything else is a
 * caller bug that would otherwise come back as a silent `NaN` or `Infinity`, which is the one kind
 * of wrong answer this whole file exists to prevent.
 */
export function round_half_even(x: number, digits: number): number {
  if (!Number.isInteger(digits) || digits < 0 || digits > 100) {
    throw new RangeError(`digits must be a whole number between 0 and 100, got ${digits}`);
  }
  if (!Number.isFinite(x)) {
    return x;
  }
  if (x === 0) {
    return 0;
  }

  const negative = x < 0;
  const { significand, exponent } = decompose(Math.abs(x));

  // A non-negative binary exponent means the double is already a whole number, so rounding to
  // any decimal place returns it. Short-circuiting is not only cheaper: past 2**53 the scaled
  // integer no longer fits a double, and converting it back would saturate to infinity.
  if (exponent >= 0) {
    return x;
  }

  const scale = 10n ** BigInt(digits);
  const numerator = significand * scale;
  const denominator = 1n << BigInt(-exponent);

  let quotient = numerator / denominator;
  const doubled_remainder = 2n * (numerator % denominator);
  if (doubled_remainder > denominator) {
    quotient += 1n;
  } else if (doubled_remainder === denominator && (quotient & 1n) === 1n) {
    quotient += 1n;
  }

  const rounded = Number(quotient) / 10 ** digits;
  return negative ? -rounded : rounded;
}

/** The same rounding, transparent to the absent measurement a nullable field carries. */
export function round_or_null(x: number | null, digits: number): number | null {
  return x === null ? null : round_half_even(x, digits);
}
