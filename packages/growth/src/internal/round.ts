/**
 * Rounding that agrees with the reference implementation on exact ties: half to *even*, decided on
 * the double's exact binary value, with no step that scales through a float.
 *
 * `toFixed` is not a substitute. It rounds half up, on a decimal rendering, and the two disagree
 * whenever the scaled value lands exactly on a half. That is reachable here rather than
 * theoretical: the median of two lag measurements is the mean of two doubles, so 4.0 and 4.5 give
 * exactly 4.25, which this rounds to 4.2 and `toFixed(1)` to 4.3.
 */

/** Scratch view for reading a double's IEEE-754 bits. Single-threaded, so one is enough. */
const bits_view = new DataView(new ArrayBuffer(8));

const MANTISSA_BITS = 52n;
const FRACTION_MASK = (1n << MANTISSA_BITS) - 1n;
const EXPONENT_MASK = 0x7ffn;
/** Bias 1023 plus the 52 fraction bits: `stored_exponent - 1075` scales the significand to its value. */
const EXPONENT_SHIFT = 1075;
/** Every subnormal shares one exponent: the smallest normal's, with no implicit leading bit. */
const SUBNORMAL_EXPONENT = -1074;

/** Split a finite non-negative double into an exact `significand * 2 ** exponent`; both parts are
 *  exact, so every comparison downstream is between integers rather than floats. */
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
 * Round `x` to `digits` decimal places, breaking exact ties toward the even neighbour. Non-finite
 * `x` comes back unchanged. Throws `RangeError` unless `digits` is a whole number in 0..100, which
 * a caller would otherwise get back as a silent `NaN` or `Infinity`.
 *
 * The scaled value is an exact BigInt rational, and the tie is decided by comparing twice the
 * remainder against the denominator, never by inspecting a decimal string.
 *
 * The quotient is returned by rendering it as a decimal string and parsing that. Do not replace
 * the step with a division by `10 ** digits`: past a handful of digits that power is not exactly
 * representable, so the quotient of two approximations can land on a different double than the
 * decimal asked for. Parsing has no such step, since the language specifies that a numeric string
 * becomes the nearest double to the value it denotes, which is the correctly rounded answer.
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

  // A non-negative binary exponent means the double is already whole, so any decimal rounding
  // returns it. Not only cheaper: past 2**53 the scaled integer would convert back to infinity.
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

  // `quotient` counts units of 10**-digits; the padding covers a value below one such unit.
  const scaled_text = quotient.toString().padStart(digits + 1, "0");
  const point = scaled_text.length - digits;
  const decimal = digits === 0 ? scaled_text : `${scaled_text.slice(0, point)}.${scaled_text.slice(point)}`;
  const rounded = Number(decimal);
  return negative ? -rounded : rounded;
}

/** `round_half_even`, passing the absent measurement a nullable field carries through as null. */
export function round_or_null(x: number | null, digits: number): number | null {
  return x === null ? null : round_half_even(x, digits);
}
