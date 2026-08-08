/** How this market writes a phone number. Read from the map; never guessed, never defaulted.
 *
 *  Nothing here names a country. The shape of a number is a property of the market being measured
 *  and belongs in the map beside the tables it describes, not in the engine that reads it. */
export type PhoneFormat = {
  /** Digits dialled before the national number, without `+`. Dropped when present. */
  country_code: string;
  /** Length of the area/region code. A market whose area codes vary in length cannot be
   *  expressed this way, and `make_key` rejects it by name rather than producing wrong keys. */
  area_digits: number;
  /** Count of trailing digits that stay stable across dialling-plan reforms. */
  subscriber_digits: number;
  /** Share of unparseable numbers above which a run aborts. A misconfigured dialling plan
   *  and a genuinely unmatched list both produce zero, and only one of them is a result. */
  max_unparseable_rate: number;
  /** A phone answering for this many accounts is a switchboard, not a person, and is dropped
   *  from the index — otherwise every list containing it inherits all of them. */
  shared_account_ceiling: number;
  /** Optional allowlist of valid area codes. Length alone accepts codes that do not exist. */
  area_codes?: string[];
};

/** A declared number format this engine cannot honour. Thrown once, when the format is read,
 *  rather than per row — a format that cannot produce correct keys produces wrong ones silently,
 *  and a run that reports zero matches looks exactly like a list nobody on it ever registered. */
export class PhoneFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhoneFormatError";
  }
}

/**
 * Build the function that turns whatever a column holds into a join key, or into null when the
 * value cannot be one.
 *
 * The problem this solves: the same person's number is written several ways across the sources
 * being joined. One source keeps the international prefix, another drops it. One keeps a leading
 * trunk zero, another strips it. A dialling-plan reform inserted a digit at the front of the
 * subscriber part, so older records are one digit shorter than newer ones for the same line. Joining
 * on the raw text loses most of the overlap; joining on the last N digits alone collides across
 * regions. The key is therefore the region code followed by the trailing digits that survived the
 * reform, which is stable under all four variations at once.
 *
 * The format is validated here, once, and the closure that comes back does no validation at all —
 * it runs once per row of a whole export, and a check that can be hoisted out of that loop should
 * be.
 */
export function make_key(fmt: PhoneFormat): (raw: unknown) => string | null {
  if (fmt.area_digits < 1 || fmt.subscriber_digits < 1) {
    const field = fmt.area_digits < 1 ? "area_digits" : "subscriber_digits";
    throw new PhoneFormatError(
      `${field} must be at least 1, got ${field === "area_digits" ? fmt.area_digits : fmt.subscriber_digits}. ` +
        "A market whose area codes vary in length cannot be expressed with fixed lengths at all: " +
        "no pair of numbers describes it, so this needs a second key strategy rather than " +
        "different numbers here.",
    );
  }
  if (!/^[0-9]*$/.test(fmt.country_code)) {
    throw new PhoneFormatError(
      `country_code must be digits only, got ${JSON.stringify(fmt.country_code)}. ` +
        "Leave it empty for a market with no dialled prefix; do not include a plus sign.",
    );
  }
  if (!(fmt.max_unparseable_rate >= 0 && fmt.max_unparseable_rate <= 1)) {
    throw new PhoneFormatError(
      `max_unparseable_rate must be between 0 and 1 inclusive, got ${fmt.max_unparseable_rate}. ` +
        "It is the share of rows allowed to be unreadable, not a count of them.",
    );
  }
  if (!(fmt.shared_account_ceiling >= 2)) {
    throw new PhoneFormatError(
      `shared_account_ceiling must be at least 2, got ${fmt.shared_account_ceiling}. ` +
        "A ceiling of 1 evicts every phone holding a single account, which is every ordinary " +
        "person, and 0 evicts everything. Either way the index comes out empty and every cell " +
        "reports zero matches — the exact silent zero this design exists to prevent.",
    );
  }

  const prefix = fmt.country_code;
  const area = fmt.area_digits;
  const subscriber = fmt.subscriber_digits;
  const national = area + subscriber;
  const allowed = fmt.area_codes ? new Set(fmt.area_codes) : null;

  return (raw: unknown): string | null => {
    // Falsy is empty, including a numeric zero and a boolean: those are a column read that
    // found nothing, not a number, and they must not survive into a key.
    const digits = (raw ? String(raw) : "").replace(/\D/g, "").replace(/^0+/, "");

    let key: string | null = null;
    if (
      prefix !== "" &&
      digits.startsWith(prefix) &&
      (digits.length === prefix.length + national || digits.length === prefix.length + national + 1)
    ) {
      // Prefixed. The extra digit, when present, sits at the head of the subscriber part, so
      // the region is read from a fixed offset and the subscriber from the tail.
      key = digits.slice(prefix.length, prefix.length + area) + digits.slice(-subscriber);
    } else if (digits.length === national || digits.length === national + 1) {
      key = digits.slice(0, area) + digits.slice(-subscriber);
    }

    if (key === null) {
      return null;
    }
    // Length alone accepts region codes that were never issued. Where the map lists the real
    // ones, a number of the right shape carrying an impossible region is still not a number.
    if (allowed !== null && !allowed.has(key.slice(0, area))) {
      return null;
    }
    return key;
  };
}
