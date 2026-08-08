import { describe, expect, test } from "bun:test";
import type { PhoneFormat } from "../src/internal/phone.ts";
import { make_key, PhoneFormatError } from "../src/internal/phone.ts";

/**
 * The key is the join. Two lists describing the same person have to collapse onto one string or
 * every count downstream is wrong, and the shapes they arrive in differ by a dialling prefix, a
 * trunk zero, a dialling-plan reform digit, and whatever punctuation the exporting tool felt
 * like. `make_key` is a generic rule driven entirely by the format, so these tests check that
 * the generic rule reproduces the behaviour a hand-written market-specific one would give.
 *
 * Every number below is invented.
 */

/** A format with a dialling prefix, an area code, and a subscriber tail shorter than the
 *  national number — the shape produced by a market that added a digit to its mobile plan. */
const PREFIXED: PhoneFormat = {
  country_code: "55",
  area_digits: 2,
  subscriber_digits: 8,
  max_unparseable_rate: 0.4,
  shared_account_ceiling: 4,
};

/** The degenerate shape: no dialling prefix, and area plus subscriber is the whole national
 *  number, so the key is the input and nothing is ever discarded. */
const BARE: PhoneFormat = {
  country_code: "",
  area_digits: 3,
  subscriber_digits: 7,
  max_unparseable_rate: 0.4,
  shared_account_ceiling: 4,
};

describe("make_key with a dialling prefix", () => {
  const key = make_key(PREFIXED);

  test("collapses all four written forms of one subscriber onto one key", () => {
    // Same invented subscriber, written the four ways a mixed set of exports produces it:
    // prefix plus the reformed national number, prefix plus the older national number,
    // the reformed national number bare, and the older national number bare.
    const expected = "1187654321";
    expect(key("5511987654321")).toBe(expected); // 13 digits: prefix + 11 national
    expect(key("551187654321")).toBe(expected); // 12 digits: prefix + 10 national
    expect(key("11987654321")).toBe(expected); // 11 digits: reformed national
    expect(key("1187654321")).toBe(expected); // 10 digits: national as area + subscriber
  });

  test("keeps two different subscribers apart", () => {
    // The collapse above must not be a collapse onto everything. Two numbers sharing an
    // area code and differing in the subscriber tail stay distinct.
    expect(key("11987654321")).not.toBe(key("11987654322"));
    // Same subscriber tail, different area code, stays distinct too.
    expect(key("11987654321")).not.toBe(key("21987654321"));
  });

  test("strips punctuation, spaces and a leading plus before reading digits", () => {
    const expected = "1187654321";
    expect(key("+55 (11) 98765-4321")).toBe(expected);
    expect(key("  +55-11-98765.4321  ")).toBe(expected);
    expect(key("55/11/9 8765 4321")).toBe(expected);
  });

  test("strips leading zeros, including a trunk zero before the area code", () => {
    expect(key("01187654321")).toBe("1187654321");
    expect(key("0011987654321")).toBe("1187654321");
    expect(key("0 (11) 98765-4321")).toBe("1187654321");
  });

  test("returns null for every shape of absence", () => {
    expect(key(null)).toBeNull();
    expect(key(undefined)).toBeNull();
    expect(key("")).toBeNull();
    expect(key("   ")).toBeNull();
    expect(key(0)).toBeNull();
    expect(key(false)).toBeNull();
  });

  test("returns null for a digit count that cannot be a number in this plan", () => {
    expect(key("8765432")).toBeNull(); // 7 digits: shorter than area + subscriber
    expect(key("551198765432100")).toBeNull(); // 15 digits: longer than the plan allows
    expect(key("not a phone at all")).toBeNull(); // no digits survive the strip
  });

  test("reads a number that arrives as a number rather than a string", () => {
    // Exports that pass through a spreadsheet lose the leading zero and the string type
    // together, so the parameter is `unknown` and this shape has to work.
    expect(key(5511987654321)).toBe("1187654321");
  });
});

describe("make_key without a dialling prefix", () => {
  const key = make_key(BARE);

  test("keys a full national number to itself", () => {
    // area_digits + subscriber_digits is the whole national length here, so the key is the
    // input: there is no reform digit to drop and nothing to discard.
    expect(key("4155551234")).toBe("4155551234");
    expect(key("415-555-1234")).toBe("4155551234");
  });

  test("still rejects the wrong length", () => {
    expect(key("555123")).toBeNull();
    expect(key("41555512345678")).toBeNull();
  });

  test("does not strip a leading digit that happens to match another market's prefix", () => {
    // With no country_code configured there is nothing to strip, so a national number that
    // begins with the digits of some other market's prefix survives intact.
    expect(key("5551234567")).toBe("5551234567");
  });
});

describe("make_key rejects a format it cannot honour", () => {
  test("throws on a zero-length area code and says why fixed lengths cannot work", () => {
    // A market whose area codes vary in length needs a different strategy, not different
    // numbers in this table, and the error has to say so or someone will try 1 and ship it.
    const build = () => make_key({ ...PREFIXED, area_digits: 0 });
    expect(build).toThrow(PhoneFormatError);
    expect(build).toThrow(/vary in length|variable[- ]length/i);
    expect(build).toThrow(/area code/i);
  });

  test("throws on a zero-length subscriber tail", () => {
    expect(() => make_key({ ...PREFIXED, subscriber_digits: 0 })).toThrow(PhoneFormatError);
  });

  test("throws on a country code that is not digits", () => {
    expect(() => make_key({ ...PREFIXED, country_code: "+55" })).toThrow(PhoneFormatError);
    expect(() => make_key({ ...PREFIXED, country_code: "5a" })).toThrow(PhoneFormatError);
    expect(() => make_key({ ...PREFIXED, country_code: "br" })).toThrow(PhoneFormatError);
  });

  test("throws on an unparseable-rate ceiling outside 0..1", () => {
    // The ceiling is a share, and a share above one aborts nothing, which makes the guard
    // look present while doing nothing at all.
    expect(() => make_key({ ...PREFIXED, max_unparseable_rate: 1.4 })).toThrow(PhoneFormatError);
    expect(() => make_key({ ...PREFIXED, max_unparseable_rate: -0.1 })).toThrow(PhoneFormatError);
  });

  test("throws on a shared-account ceiling of one", () => {
    // A ceiling of one drops every key that appears at all, leaving an empty index and a
    // run that reports zero of everything without failing.
    expect(() => make_key({ ...PREFIXED, shared_account_ceiling: 1 })).toThrow(PhoneFormatError);
    expect(() => make_key({ ...PREFIXED, shared_account_ceiling: 0 })).toThrow(PhoneFormatError);
  });
});

describe("make_key with an area-code allowlist", () => {
  const allowed = ["21", "31"];
  const key = make_key({ ...PREFIXED, area_codes: allowed });

  test("accepts a key whose area code is on the list", () => {
    expect(key("5521987654321")).toBe("2187654321");
    expect(key("3187654321")).toBe("3187654321");
  });

  test("rejects a key whose area code is absent from the list", () => {
    // Length alone accepts area codes that do not exist, and a wrong area code produces a
    // key that quietly fails to join rather than an error anyone sees.
    expect(key("5511987654321")).toBeNull();
    expect(key("9987654321")).toBeNull();
  });

  test("does not change the key it produces for an allowed code", () => {
    const unrestricted = make_key(PREFIXED);
    expect(key("5521987654321")).toBe(unrestricted("5521987654321"));
  });
});
