/** How this market writes a phone number. Read from the map; never guessed, never defaulted.
 *
 *  Nothing here names a country. The shape of a number is a property of the market being measured
 *  and belongs in the map beside the tables it describes, not in the engine that reads it. */
export type PhoneFormat = {
  /** Digits dialled before the national number, without `+`. Dropped when present, and — once
   *  declared — required on any string too long to be a bare national number: a longer string
   *  carrying some other prefix belongs to another market and gets no key at all. */
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
  area_codes?: readonly string[];
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
        "It is the share of a file's distinct identifiers allowed to be unreadable, not a count " +
        "of them, and identifiers that are simply absent are not counted on either side of it.",
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
    //
    // The leading zeros stripped here are the ones in front of a country code: an international
    // access code dialled as zeros, or a trunk zero on a number written without a country code.
    // The trunk zero that sits *after* a country code cannot be removed at this point, because
    // the country-code test that follows reads from the head of the string; it is stripped below,
    // once the prefix is off.
    const digits = (raw ? String(raw) : "").replace(/\D/g, "").replace(/^0+/, "");

    // Length decides whether a leading run of digits is the country code or part of the national
    // number, and it has to, because in a market whose area codes are as long as its country code
    // the two are the same digits. A bare national number is `national` digits, or `national + 1`
    // where a dialling-plan reform added one at the head of the subscriber part; both are read as
    // national, prefix or no prefix, and that is the case the whole design rests on since most
    // sources drop the country code entirely.
    //
    // Anything longer therefore carries a country code, and it must be the declared one. The
    // tempting loose branch — fall through and read the tail of any string as a national number —
    // is what mints a local-looking key for a foreign subscriber and collides it with a real
    // person, so a longer string that does not start with the declared prefix is not ours and
    // gets nothing. Do not restore the fall-through: it does not recover a single extra local
    // number, it only manufactures wrong ones.
    //
    // What length cannot settle is a foreign number that happens to be a national length here.
    // No arrangement of these three numbers separates it, because by every property the format
    // declares it is a number of this market. `area_codes` is the lever for that residue: the
    // foreign number carries a region code this plan never issued, and the check below drops it.
    let national_digits: string | null = null;
    if (digits.length === national || digits.length === national + 1) {
      national_digits = digits;
    } else if (prefix !== "" && digits.startsWith(prefix)) {
      // A national number never begins with the trunk digit, so a zero left at the head after the
      // country code came off is dialling notation rather than a digit of the number.
      const rest = digits.slice(prefix.length).replace(/^0+/, "");
      if (rest.length === national || rest.length === national + 1) {
        national_digits = rest;
      }
    }

    if (national_digits === null) {
      return null;
    }
    // The extra digit, when present, sits at the head of the subscriber part, so the region is
    // read from the head and the subscriber from the tail and the middle is discarded.
    const key = national_digits.slice(0, area) + national_digits.slice(-subscriber);
    // Length alone accepts region codes that were never issued. Where the map lists the real
    // ones, a number of the right shape carrying an impossible region is still not a number.
    if (allowed !== null && !allowed.has(key.slice(0, area))) {
      return null;
    }
    return key;
  };
}
