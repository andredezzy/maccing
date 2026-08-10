import { type CountryCode, parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * A number this engine could not place in any market. Thrown once, when a corpus is read, rather
 * than per row: a corpus that cannot be keyed produces zero matches, and zero matches looks
 * exactly like a list nobody on it ever registered.
 */
export class PhoneFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhoneFormatError";
  }
}

/**
 * Digits of a national number that survive a dialling-plan reform, per market.
 *
 * Only markets that have moved their numbering need an entry; everywhere else the national number
 * is already stable and is used whole. This is the one piece of local knowledge the engine keeps,
 * and it is kept because no library carries it: `libphonenumber` knows what a number *is today*,
 * not which of two spellings across a reform belong to one person.
 *
 * Brazil inserted a `9` at the head of every mobile subscriber part between 2013 and 2016, so the
 * same line is ten digits in older records and eleven in newer ones. Dropping that digit collapses
 * both to one key. Measured on this project's user base: 16 accounts pairs reconcile this way, and
 * a key without it splits 9 of them.
 */
const STABLE: Partial<Record<CountryCode, (national: string) => string>> = {
  BR: (national) =>
    national.length === 11 && national[2] === "9" ? national.slice(0, 2) + national.slice(3) : national,
};

/** A market, as ISO 3166-1 alpha-2. Re-exported so a caller can name one without importing
 *  `libphonenumber-js` itself — the library is this module's business, not its consumers'. */
export type { CountryCode };

/** A number placed in its market, with the market kept so two markets can never collide. */
export type Placed = { country: CountryCode; key: string };

/**
 * Place one raw value in a market and derive its join key, or answer null when it is not a number.
 *
 * `fallback` is the market a bare national number belongs to — one carrying no calling code, which
 * is most of what a database holds. It is inferred from the corpus rather than declared; see
 * `dominant_market`.
 *
 * The market is part of the key. That is what makes a multi-country campaign measurable at all:
 * `PT:912345678` and `BR:912345678` are different people, and a key that dropped the market would
 * merge them. The previous key could only avoid that by refusing every foreign number outright.
 */
export function place(raw: unknown, fallback: CountryCode): Placed | null {
  const digits = (raw ? String(raw) : "").replace(/\D/g, "");
  if (digits.length < 8) {
    return null;
  }
  // A string long enough to carry a calling code is offered as international; anything shorter is
  // read as national in the fallback market. Deciding this by length rather than by a leading
  // prefix is what keeps a real area code from being eaten: Brazil's area 55 serves Santa Maria,
  // and stripping `55` on sight mutilates every number in that region. Length decides, and the
  // per-market lengths that make length decidable are the library's metadata.
  const offered = digits.length >= 12 ? `+${digits}` : digits;
  const parsed = parsePhoneNumberFromString(offered, fallback);
  if (parsed?.isValid() !== true || parsed.country === undefined) {
    return null;
  }
  const shape = STABLE[parsed.country];
  const national = parsed.nationalNumber;
  return { country: parsed.country, key: `${parsed.country}:${shape ? shape(national) : national}` };
}

/**
 * The market a corpus is mostly written in, used as the fallback for its bare national numbers.
 *
 * Inferred rather than declared, because a campaign may carry leads from any country and naming
 * one of them would be naming the wrong thing. Only numbers that place themselves — those long
 * enough to carry a calling code — get a vote, so the answer cannot be circular.
 *
 * A corpus with no clear majority is refused instead of guessed. Picking the larger of two similar
 * shares would key half a base under the wrong plan, and a wrong plan does not fail loudly: it
 * produces keys that match nothing, which reads as an audience that never registered.
 */
export function dominant_market(raws: Iterable<unknown>): CountryCode {
  const votes = new Map<CountryCode, number>();
  let counted = 0;
  for (const raw of raws) {
    const digits = (raw ? String(raw) : "").replace(/\D/g, "");
    if (digits.length < 12) {
      continue;
    }
    const parsed = parsePhoneNumberFromString(`+${digits}`);
    if (parsed?.isValid() !== true || parsed.country === undefined) {
      continue;
    }
    votes.set(parsed.country, (votes.get(parsed.country) ?? 0) + 1);
    counted += 1;
  }
  if (counted === 0) {
    throw new PhoneFormatError(
      "no identifier in this corpus carries a calling code, so the market its bare national " +
        "numbers belong to cannot be inferred. Export at least some numbers in international form.",
    );
  }
  const ranked = [...votes].sort((a, b) => b[1] - a[1]);
  const [top, share] = ranked[0] as [CountryCode, number];
  const runner = ranked[1]?.[1] ?? 0;
  if (share < counted * 0.5 || share < runner * 2) {
    const summary = ranked
      .slice(0, 3)
      .map(([country, n]) => `${country} ${((n / counted) * 100).toFixed(1)}%`)
      .join(", ");
    throw new PhoneFormatError(
      `no market dominates this corpus (${summary} of ${counted} numbers carrying a calling code), ` +
        "so the market for its bare national numbers cannot be inferred. A bare number keyed under " +
        "the wrong plan matches nothing, which reads as an audience that never registered.",
    );
  }
  return top;
}

/**
 * How far a corpus's markets diverge from the base they are measured against, as a share.
 *
 * The guard this serves is not a parse check and cannot be one. A column that is not a phone
 * column still parses: feeding `20260805103000`-style timestamps to a keyer produced thousands of
 * valid-looking Egyptian numbers, every one of them a parse *success*, so an unparseable-rate
 * ceiling never fires. What gives it away is the company it keeps — a base that is 98% one market
 * receiving a list that is 60% another is not a list of that base.
 *
 * A heuristic, and documented as one: it catches a wholesale mislabelled column, not a handful of
 * wrong rows.
 */
export function market_divergence(list: Iterable<CountryCode>, base: ReadonlyMap<CountryCode, number>): number {
  const base_total = [...base.values()].reduce((sum, n) => sum + n, 0);
  if (base_total === 0) {
    return 0;
  }
  const seen = new Map<CountryCode, number>();
  let total = 0;
  for (const country of list) {
    seen.set(country, (seen.get(country) ?? 0) + 1);
    total += 1;
  }
  if (total === 0) {
    return 0;
  }
  // Total variation distance between the two distributions: half the summed absolute difference
  // of their shares, so 0 is identical and 1 is disjoint.
  let distance = 0;
  for (const country of new Set([...seen.keys(), ...base.keys()])) {
    distance += Math.abs((seen.get(country) ?? 0) / total - (base.get(country) ?? 0) / base_total);
  }
  return distance / 2;
}
