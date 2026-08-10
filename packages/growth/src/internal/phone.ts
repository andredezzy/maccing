import { type CountryCode, parsePhoneNumberFromString } from "libphonenumber-js";

/** A corpus this engine could not place in any market. Thrown once per corpus, not per row: a corpus
 *  that cannot be keyed yields zero matches, which looks like a list nobody on it ever registered. */
export class PhoneFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhoneFormatError";
  }
}

/** Digits of a national number that survive a dialling-plan reform, per market; a market that never
 *  moved its numbering needs no entry and is used whole. `libphonenumber` cannot supply this: it
 *  knows what a number *is today*, not which two spellings across a reform are one person. Brazil
 *  inserted a `9` into every mobile subscriber part between 2013 and 2016, so one line is ten digits
 *  in old records and eleven in new ones. */
const STABLE: Partial<Record<CountryCode, (national: string) => string>> = {
  BR: (national) =>
    national.length === 11 && national[2] === "9" ? national.slice(0, 2) + national.slice(3) : national,
};

/** A market, as ISO 3166-1 alpha-2. Re-exported so a caller can name one without importing
 *  `libphonenumber-js` itself. */
export type { CountryCode };

/** A number placed in its market. The market is part of the key, so two markets can never collide:
 *  `PT:912345678` and `BR:912345678` are different people. */
export type Placed = { country: CountryCode; key: string };

/**
 * Place one raw value in a market and derive its join key. Null when it is not a number: fewer than
 * 8 digits, or nothing the market's plan accepts.
 *
 * `fallback` is the market a bare national number belongs to — one carrying no calling code, which is
 * most of what a database holds. Infer it with `dominant_market` rather than declaring it.
 */
export function place(raw: unknown, fallback: CountryCode): Placed | null {
  const digits = (raw ? String(raw) : "").replace(/\D/g, "");
  if (digits.length < 8) {
    return null;
  }
  // A string long enough to carry a calling code is offered as international; anything shorter reads
  // as national in the fallback market. Length decides, never a leading prefix: `55` is also a real
  // Brazilian area code (Santa Maria), so stripping it on sight mutilates every number in that
  // region. The per-market lengths that make length decidable are the library's metadata.
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
 * Only numbers long enough to carry a calling code vote, so the answer cannot be circular. Throws
 * `PhoneFormatError` when nothing votes, and when no market holds both half the votes and twice the
 * runner-up: half a base keyed under a guessed plan matches nothing, which reads as an audience that
 * never registered.
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
 * How far a corpus's markets diverge from the base they are measured against, as a share in 0..1.
 *
 * A heuristic for a wholesale mislabelled column, not a handful of wrong rows, and it cannot be a
 * parse check: `20260805103000`-style timestamps fed to a keyer produced thousands of valid Egyptian
 * numbers, every one of them a parse *success*, so an unparseable-rate ceiling never fires on them.
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
  // Total variation distance between the two distributions: half the summed absolute difference of
  // their shares, so 0 is identical and 1 is disjoint.
  let distance = 0;
  for (const country of new Set([...seen.keys(), ...base.keys()])) {
    distance += Math.abs((seen.get(country) ?? 0) / total - (base.get(country) ?? 0) / base_total);
  }
  return distance / 2;
}
