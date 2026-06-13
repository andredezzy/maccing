// Unit tests for the shared idVariants helper — pins inclusion/exclusion behavior per includeRaw flag.

import { expect, test } from "bun:test";

import { idVariants } from "./id-variants";

test("includeRaw=true: raw id is included", () => {
  const variants = idVariants("sshZ", true);
  expect(variants).toContain("sshZ");
});

test("includeRaw=false: raw id is NOT included", () => {
  const variants = idVariants("sshZ", false);
  expect(variants).not.toContain("sshZ");
});

test("decoded form is pushed only when it differs from the raw id", () => {
  // "%3F~%5CG" decodes to "?~\\G" — they differ, so decoded is pushed.
  const variants = idVariants("%3F~%5CG", true);
  expect(variants).toContain("?~\\G");
  // Plain "sshZ" decodes to itself — not pushed.
  const plain = idVariants("sshZ", true);
  expect(plain.filter((variant) => variant === "sshZ")).toHaveLength(1); // exactly once
});

test("encoded form is pushed only when it differs from the raw id", () => {
  // "?~\\G" encodes to "%3F~%5CG" — they differ, so encoded is pushed.
  const variants = idVariants("?~\\G", true);
  expect(variants).toContain("%3F~%5CG");
  // "%3F~%5CG" encoded is "%253F~%255CG" (double-encode) — different, so pushed too.
  const doubleEncoded = idVariants("%3F~%5CG", true);
  expect(doubleEncoded.some((variant) => variant.startsWith("%25"))).toBe(true);
});

test("malformed percent-encoding does not throw", () => {
  // "%GG" is malformed — decodeURIComponent would throw, idVariants must not.
  expect(() => idVariants("%GG", true)).not.toThrow();
  expect(() => idVariants("%GG", false)).not.toThrow();
});

test("malformed percent-encoding: decoded form is not pushed (guard works)", () => {
  // "%GG" can't be decoded — decoded variant must be absent.
  const variants = idVariants("%GG", true);
  // Only the raw and encoded forms should be present (not a decoded).
  // The encoded form of "%GG" is "%25GG" (the % gets encoded).
  expect(variants).toContain("%GG"); // raw, because includeRaw=true
  expect(variants).not.toContain(undefined as unknown as string);
  // No malformed string should appear.
  for (const variant of variants) {
    expect(typeof variant).toBe("string");
  }
});

test("a plain unencoded id with includeRaw=false returns encoded variant only (if it differs)", () => {
  // "M>L>" encodes to "M%3EL%3E" (> is encoded).
  const variants = idVariants("M>L>", false);
  expect(variants).not.toContain("M>L>"); // raw excluded
  expect(variants).toContain("M%3EL%3E"); // encoded included
});
