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
 */
export function parse_ts(s: string | null | undefined): Date | null {
  if (s === null || s === undefined) {
    return null;
  }
  const trimmed = s.trim();
  if (trimmed === "") {
    return null;
  }

  let text = trimmed.replace(" ", "T");

  const dot = text.indexOf(".");
  if (dot !== -1) {
    // Consume only the run of digits after the separator, so an offset that follows the
    // fraction is carried through untouched rather than padded into nonsense.
    let end = dot + 1;
    while (end < text.length) {
      const code = text.charCodeAt(end);
      if (code < 48 || code > 57) {
        break;
      }
      end++;
    }
    const fraction = text
      .slice(dot + 1, end)
      .slice(0, 6)
      .padEnd(6, "0");
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

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new TimestampError(trimmed);
  }
  return parsed;
}
