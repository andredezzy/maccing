/** A timestamp that reached this point but could not be read as a moment. Named, because a
 *  silently-dropped date shifts an event across the cut and changes who a campaign is credited
 *  with. */
export class TimestampError extends Error {
  readonly value: string;

  constructor(value: string) {
    super(`not a readable timestamp: ${JSON.stringify(value)}`);
    this.name = "TimestampError";
    this.value = value;
  }
}

/** The number of fractional digits the runtime's instant can hold. Beyond this, the source is
 *  naming a moment the engine cannot represent. */
const MILLISECOND_DIGITS = 3;

/** The width the fraction is padded to before parsing, so a one-digit and a six-digit spelling of
 *  the same moment land on the same instant. */
const FRACTION_WIDTH = 6;

/** One timestamp read together with what its source claimed about it. */
export interface TimestampReading {
  /** The instant, resolved to the millisecond. Null when the source was absent or blank. */
  at: Date | null;
  /** True when the source declared a fraction finer than a millisecond and the digits past the
   *  third were not all zero — that is, when `at` is not quite the moment the source names.
   *  `.1230` is still a whole millisecond and does not set this; `.123400` does. */
  sub_millisecond: boolean;
}

/**
 * Read one exported timestamp.
 *
 * Three shapes have to survive the trip out of a database and into this function. A space instead
 * of `T` between the date and the time, which most engines emit by default. A fractional part of
 * anywhere from one to six digits, because trailing zeros are dropped on the way out while parsers
 * accept only fixed widths. And no zone suffix at all, because the export was taken in UTC and
 * said so in the query rather than in the column.
 *
 * That last one is the dangerous case: a bare local-looking timestamp is read as the host's own
 * zone by default, which moves every event by the machine's offset and reassigns the ones near a
 * cut. The zone is therefore attached explicitly here, exactly as the export promised.
 *
 * Null in, blank in, whitespace in — null out. An unbound nullable column is a normal fact and not
 * an error; unreadable text is an error and throws.
 *
 * The runtime's instant resolves to the millisecond, so a fraction finer than three digits is
 * truncated — not rounded, and not refused. That is safe for an event, for one reason worth
 * writing down so nobody has to derive it twice: truncation only ever moves an instant *down*,
 * towards the start of its own millisecond, and never past the start of it. So if the cut sits on
 * a whole millisecond, an event at or after the cut still truncates to at or after it, and an
 * event before the cut cannot truncate upwards to reach it — no event changes side, and no
 * comparison against the cut changes answer. The premise there is the cut, not the event. Which
 * is why a cut finer than a millisecond is refused where cells are declared, and why events —
 * which arrive in bulk from an export nobody controls — are truncated in silence here.
 */
export function parse_ts(s: string | null | undefined): Date | null {
  if (s === null || s === undefined) {
    return null;
  }
  const trimmed = s.trim();
  if (trimmed === "") {
    return null;
  }

  const parsed = new Date(normalize(trimmed));
  if (Number.isNaN(parsed.getTime())) {
    throw new TimestampError(trimmed);
  }
  return parsed;
}

/**
 * Read one timestamp and report whether its source asked for more precision than it got.
 *
 * Same parse, same errors, same nulls as `parse_ts`. The extra flag exists for the one value whose
 * truncation is not provably harmless: the cut every event is compared against. The proof on
 * `parse_ts` holds only while the cut sits on a whole millisecond, so whoever owns a cut has to be
 * able to see when it does not.
 */
export function parse_ts_with_precision(s: string | null | undefined): TimestampReading {
  const at = parse_ts(s);
  if (at === null) {
    return { at: null, sub_millisecond: false };
  }
  return { at, sub_millisecond: declares_sub_millisecond((s as string).trim()) };
}

/** Rewrite the trimmed source into the one shape the runtime's parser reads without guessing: `T`
 *  between date and time, a fixed-width fraction, an explicit zone. */
function normalize(trimmed: string): string {
  let text = trimmed.replace(" ", "T");

  const dot = text.indexOf(".");
  if (dot !== -1) {
    const end = fraction_end(text, dot);
    const fraction = text
      .slice(dot + 1, end)
      .slice(0, FRACTION_WIDTH)
      .padEnd(FRACTION_WIDTH, "0");
    text = `${text.slice(0, dot)}.${fraction}${text.slice(end)}`;
  }

  const separator = text.indexOf("T");
  if (separator !== -1) {
    const time = text.slice(separator + 1);
    const has_zone = time.includes("Z") || time.includes("z") || time.includes("+") || time.includes("-");
    if (!has_zone) {
      text += "Z";
    }
  }

  return text;
}

/** Index one past the last digit of the fraction opening at `dot`. Consumes only the run of
 *  digits, so an offset that follows the fraction is carried through untouched rather than padded
 *  into nonsense. */
function fraction_end(text: string, dot: number): number {
  let end = dot + 1;
  while (end < text.length) {
    const code = text.charCodeAt(end);
    if (code < 48 || code > 57) {
      break;
    }
    end++;
  }
  return end;
}

/** True when the source names a moment strictly between two milliseconds. Three digits is exactly
 *  a millisecond, and zeros beyond the third are still exactly a millisecond, so only a non-zero
 *  digit past the third counts. */
function declares_sub_millisecond(trimmed: string): boolean {
  const dot = trimmed.indexOf(".");
  if (dot === -1) {
    return false;
  }
  const end = fraction_end(trimmed, dot);
  for (let i = dot + 1 + MILLISECOND_DIGITS; i < end; i++) {
    if (trimmed.charCodeAt(i) !== 48) {
      return true;
    }
  }
  return false;
}
