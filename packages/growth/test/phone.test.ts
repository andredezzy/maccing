import { describe, expect, test } from "bun:test";
import { dominant_market, market_divergence, PhoneFormatError, place } from "../src/internal/phone.ts";

/**
 * The key is the join. Two lists describing the same person have to collapse onto one string or
 * every count downstream is wrong, and the shapes they arrive in differ by a calling code, a trunk
 * zero, a dialling-plan reform digit, and whatever punctuation the exporting tool felt like.
 *
 * These fixtures name real markets, and that is a change from the plan this file used to test
 * against. The old key was driven by a declared format — a country code and two fixed lengths —
 * so an invented plan exercised it perfectly and had the merit of being unmistakable for a
 * description of anywhere real. The market now comes from libphonenumber's metadata, and an
 * invented market has no metadata: `997` places nothing and every case would answer null. So the
 * plans below are Brazil's and Portugal's, and only the subscribers are made up.
 *
 * Brazil is not an arbitrary choice of market either. It is the one market whose numbering moved
 * inside the window this engine's data covers, so it is the only place the reform table is
 * exercised at all — and its area code 55 is the same two digits as its calling code, which is
 * the trap that decided how a bare number is read.
 */

describe("place collapses the spellings of one subscriber", () => {
  test("all four written forms of one Brazilian mobile give one key", () => {
    // The same subscriber as a mixed set of exports writes it: the calling code with the reformed
    // national number, the calling code with the older one, the reformed national number bare,
    // and the older one bare. Two of these four are what a database holds and two are what a
    // vendor's delivery report holds, so a key that separated them would report a campaign as
    // having reached people who were already customers under another spelling.
    const expected = "BR:1187654321";
    expect(place("5511987654321", "BR")?.key).toBe(expected); // 13 digits: calling code + reformed
    expect(place("551187654321", "BR")?.key).toBe(expected); // 12 digits: calling code + older
    expect(place("11987654321", "BR")?.key).toBe(expected); // 11 digits: reformed national
    expect(place("1187654321", "BR")?.key).toBe(expected); // 10 digits: older national
  });

  test("the reform digit is dropped, so one line written either side of it is one person", () => {
    // Brazil inserted a `9` at the head of every mobile subscriber part between 2013 and 2016, so
    // an account opened before the move and a list exported after it hold the same line at ten
    // and at eleven digits. This is the entire reason a per-market stable form exists: measured on
    // this project's own user base, sixteen pairs of accounts reconcile through it, and a key
    // taken from the national number whole splits nine of them into two people apiece.
    const eleven = place("11991234567", "BR");
    const ten = place("1191234567", "BR");

    expect(eleven?.key).toBe("BR:1191234567");
    expect(ten?.key).toBe(eleven?.key);
  });

  test("but the digit is dropped from the subscriber part, not from wherever a nine appears", () => {
    // The rule is positional: the inserted digit sits at the head of the subscriber part, third
    // from the left of the national number, and nothing else moves. A subscriber whose tail merely
    // contains a nine keeps every digit of it, so two lines that differ only there stay two people.
    expect(place("5511987654321", "BR")?.key).not.toBe(place("5511987654329", "BR")?.key);
    expect(place("5511987654321", "BR")?.key).not.toBe(place("5521987654321", "BR")?.key);
  });

  test("punctuation, spaces, a leading plus and a stray slash are read through", () => {
    const expected = "BR:1187654321";
    expect(place("+55 (11) 98765-4321", "BR")?.key).toBe(expected);
    expect(place("  55 11 98765 4321  ", "BR")?.key).toBe(expected);
    expect(place("55/11/9 8765 4321", "BR")?.key).toBe(expected);
  });

  test("a number that arrives as a number rather than a string is read too", () => {
    // Exports that pass through a spreadsheet lose the leading zero and the string type together,
    // so the parameter is `unknown` and this shape has to work.
    expect(place(5511987654321, "BR")?.key).toBe("BR:1187654321");
  });
});

describe("place does not mistake an area code for a calling code", () => {
  /**
   * Area code 55 is real — it serves Santa Maria — and it is the same two digits as Brazil's
   * calling code. Stripping `55` on sight mutilates every number in that region, and it does it
   * silently: the mutilated key is well-formed, it simply belongs to nobody. Measured against this
   * project's user base, a hand-rolled prefix table doing exactly that broke nine of sixteen
   * reconciliations and invented some hundred accounts in countries with no users here.
   *
   * Length decides instead, and the per-market lengths that make length decidable are the whole
   * reason a numbering library is a dependency of this package.
   */
  test("a bare ten-digit number whose area code is 55 keeps all ten digits", () => {
    const placed = place("5532145678", "BR");

    expect(placed?.country).toBe("BR");
    expect(placed?.key).toBe("BR:5532145678");
  });

  test("and is a different person from the number that really does carry the calling code", () => {
    // `+55 32 3214-5678` is twelve digits and is read as international; the ten-digit Santa Maria
    // line above is not. Read the shorter one as prefixed and the two collapse onto one key, and
    // one region's entire customer base is joined to another's.
    expect(place("553232145678", "BR")?.key).toBe("BR:3232145678");
    expect(place("5532145678", "BR")?.key).not.toBe(place("553232145678", "BR")?.key);
  });

  test("and the reform digit still comes off a Santa Maria mobile", () => {
    // The two rules have to compose, and this is the number where they could collide: an
    // eleven-digit mobile in area 55. The leading `55` is area code, not calling code, and the `9`
    // third from the left is the reform digit — so the key keeps the area and drops the nine.
    expect(place("55987654321", "BR")?.key).toBe("BR:5587654321");
    // The same line written with the calling code in front of it, which is thirteen digits.
    expect(place("5555987654321", "BR")?.key).toBe("BR:5587654321");
  });
});

describe("place keeps two markets apart", () => {
  test("the same national digits in two markets are two different keys", () => {
    // The market is part of the key, and this is what that buys: a campaign may carry leads from
    // any country. The previous key could only avoid merging these two by refusing every foreign
    // number outright, which silently dropped 93 numbers across 11 markets from the real lists.
    const portuguese = place("912345678", "PT");
    const brazilian = place("912345678", "BR");

    expect(portuguese?.key).toBe("PT:912345678");
    expect(brazilian?.key).toBe("BR:912345678");
    expect(portuguese?.key).not.toBe(brazilian?.key);
  });

  test("a number carrying its own calling code is placed there whatever the fallback says", () => {
    // The fallback answers for bare national numbers only. A Portuguese number in a Brazilian
    // base is a Portuguese person, and keying it under the base's market would put them in a plan
    // their number was never written in.
    const placed = place("351912345678", "BR");

    expect(placed?.country).toBe("PT");
    expect(placed?.key).toBe("PT:912345678");
  });
});

describe("place answers null rather than guessing", () => {
  test("for every shape of absence", () => {
    expect(place(null, "BR")).toBeNull();
    expect(place(undefined, "BR")).toBeNull();
    expect(place("", "BR")).toBeNull();
    expect(place("   ", "BR")).toBeNull();
    expect(place(0, "BR")).toBeNull();
    expect(place(false, "BR")).toBeNull();
  });

  test("for a digit count no market can honour", () => {
    expect(place("12345", "BR")).toBeNull(); // too few digits to be anybody's number
    expect(place("551198765432100", "BR")).toBeNull(); // longer than any calling code plus plan
    expect(place("not a phone at all", "BR")).toBeNull(); // no digits survive the strip
  });

  test("for a number the fallback market's plan does not admit", () => {
    // The plan is the library's, not a pair of lengths this package carries, so a nine-digit
    // string that is a number in Portugal is not automatically one in every market. `997` was the
    // invented calling code these tests used to be written against; nothing answers on it.
    expect(place("9974807224466", "BR")).toBeNull();
    expect(place("480224466", "BR")).toBeNull();
  });
});

describe("dominant_market infers the market a corpus is written in", () => {
  test("reads BR off a corpus that is mostly +55", () => {
    // Only numbers already carrying a calling code get a vote, so the answer cannot be circular —
    // it never asks the fallback in order to compute the fallback. The bare numbers in the corpus
    // are the ones the answer is for.
    const corpus = ["5511987654321", "5511987654322", "5511987654323", "351912345678", "1187654321", ""];

    expect(dominant_market(corpus)).toBe("BR");
  });

  test("throws when no market dominates, rather than picking the larger of two halves", () => {
    // A corpus split down the middle keys half its base under the wrong plan, and a wrong plan
    // does not fail loudly: it produces well-formed keys that match nothing, which reads as an
    // audience that never registered. Refusing is the only answer that reaches anybody.
    const split = () => dominant_market(["5511987654321", "351912345678"]);

    expect(split).toThrow(PhoneFormatError);
    expect(split).toThrow(/no market dominates/i);
    // The shares it saw, so whoever reads it can tell a two-country base from a mislabelled column.
    expect(split).toThrow(/BR 50\.0%/);
    expect(split).toThrow(/PT 50\.0%/);
  });

  test("throws when nothing in the corpus carries a calling code at all", () => {
    // Every vote comes from a number that placed itself, so a corpus written entirely in national
    // form has nobody to ask. Guessing a market here is guessing for the whole base at once.
    const bare = () => dominant_market(["1187654321", "1187654322", "", "not a phone"]);

    expect(bare).toThrow(PhoneFormatError);
    expect(bare).toThrow(/carries a calling code/i);
  });

  test("and throws on a corpus with nothing in it, which is the same question with no answer", () => {
    expect(() => dominant_market([])).toThrow(PhoneFormatError);
  });
});

describe("market_divergence measures a list against the base it is read with", () => {
  /**
   * The guard this serves is not a parse check and cannot be one. A column that is not a phone
   * column still parses: feeding `20260805103000`-style timestamps to a keyer produced thousands
   * of valid-looking Egyptian numbers, every one of them a parse *success*, so an
   * unparseable-rate ceiling never fires on it. What gives it away is the company it keeps.
   */
  const base = new Map([
    ["BR", 980],
    ["PT", 20],
  ] as const);

  test("is zero for a list drawn from the same distribution as the base", () => {
    const same = ["BR", "BR", "BR", "BR", "BR", "BR", "BR", "BR", "BR", "BR", "BR", "BR", "BR", "BR", "BR"] as const;

    // Not exactly zero: the base carries two percent PT and this list carries none, which is the
    // distance a sample of fifteen can be off by and still be the same audience.
    expect(market_divergence(same, base)).toBeCloseTo(0.02, 2);
    expect(market_divergence(["BR", "BR", "BR", "BR", "PT"] as const, base)).toBeLessThan(0.2);
  });

  test("is one for a list that shares no market with the base", () => {
    // The wholesale mislabelled column, which is the only thing this heuristic claims to catch.
    expect(market_divergence(["PT", "PT", "PT", "PT"] as const, new Map([["BR", 1000]] as const))).toBe(1);
  });

  test("is a half where half the list comes from somewhere else", () => {
    // Total variation distance, so the number is readable as a share rather than as a score: the
    // fraction of the list that would have to move to make the two distributions agree.
    expect(market_divergence(["BR", "PT"] as const, new Map([["BR", 1000]] as const))).toBe(0.5);
  });

  test("is zero where either side has nothing to compare, which is not a divergence", () => {
    // An empty list and an empty base both mean the question was never asked. Answering one would
    // refuse a cell for a fact about the other file.
    expect(market_divergence([], base)).toBe(0);
    expect(market_divergence(["BR"] as const, new Map())).toBe(0);
  });
});
