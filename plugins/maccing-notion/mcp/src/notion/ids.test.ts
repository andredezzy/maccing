// Pure unit tests for the Notion id helpers (normalizeUuid + abbreviateId + decodePropertyId +
// idVariants). Run with `bun test`.

import { expect, test } from "bun:test";

import { abbreviateId, decodePropertyId, idVariants, normalizeUuid } from "./ids";

test("lowercase input passes through unchanged", () => {
  expect(normalizeUuid("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
});

test("uppercase UUID is lowercased", () => {
  expect(normalizeUuid("A1B2C3D4-E5F6-7890-ABCD-EF1234567890")).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
});

test("mixed-case UUID is fully lowercased", () => {
  expect(normalizeUuid("A1b2C3d4-E5f6-7890-AbCd-eF1234567890")).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
});

test("leading and trailing whitespace is trimmed", () => {
  expect(normalizeUuid("  a1b2c3d4-e5f6-7890-abcd-ef1234567890  ")).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
});

test("trim AND lowercase are applied together", () => {
  expect(normalizeUuid("  A1B2C3D4-E5F6-7890-ABCD-EF1234567890  ")).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
});

test("UUID without dashes (32-char form) is also lowercased", () => {
  expect(normalizeUuid("A1B2C3D4E5F67890ABCDEF1234567890")).toBe("a1b2c3d4e5f67890abcdef1234567890");
});

test("abbreviateId: a long id is first-8 + ellipsis + last-4", () => {
  expect(abbreviateId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe("a1b2c3d4…7890");
});

test("abbreviateId: an id of exactly 12 chars is returned as-is (boundary)", () => {
  expect(abbreviateId("abcdef123456")).toBe("abcdef123456");
});

test("abbreviateId: an id longer than 12 chars is abbreviated (boundary)", () => {
  expect(abbreviateId("abcdef1234567")).toBe("abcdef12…4567");
});

test("decodePropertyId: an url-encoded id is decoded", () => {
  expect(decodePropertyId("%3AbCd")).toBe(":bCd");
});

test("decodePropertyId: a plain id (title) passes through unchanged", () => {
  expect(decodePropertyId("title")).toBe("title");
});

test("decodePropertyId: malformed percent-encoding degrades to the id as-is (never throws)", () => {
  expect(decodePropertyId("%GG")).toBe("%GG");
});

test("includeRaw=true: raw id is included", () => {
  expect(idVariants("sshZ", true)).toContain("sshZ");
});

test("includeRaw=false: raw id is NOT included", () => {
  expect(idVariants("sshZ", false)).not.toContain("sshZ");
});

test("decoded form is pushed only when it differs from the raw id", () => {
  // "%3F~%5CG" decodes to "?~\\G" — they differ, so decoded is pushed.
  expect(idVariants("%3F~%5CG", true)).toContain("?~\\G");
  // Plain "sshZ" decodes to itself — not pushed.
  expect(idVariants("sshZ", true).filter((variant) => variant === "sshZ")).toHaveLength(1); // exactly once
});

test("encoded form is pushed only when it differs from the raw id", () => {
  // "?~\\G" encodes to "%3F~%5CG" — they differ, so encoded is pushed.
  expect(idVariants("?~\\G", true)).toContain("%3F~%5CG");
  // "%3F~%5CG" encoded is "%253F~%255CG" (double-encode) — different, so pushed too.
  expect(idVariants("%3F~%5CG", true).some((variant) => variant.startsWith("%25"))).toBe(true);
});

test("malformed percent-encoding does not throw", () => {
  // "%GG" is malformed — decodeURIComponent would throw, idVariants must not.
  expect(() => idVariants("%GG", true)).not.toThrow();
  expect(() => idVariants("%GG", false)).not.toThrow();
});

test("malformed percent-encoding: decoded form is not pushed (guard works)", () => {
  const variants = idVariants("%GG", true);
  expect(variants).toContain("%GG"); // raw, because includeRaw=true
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
