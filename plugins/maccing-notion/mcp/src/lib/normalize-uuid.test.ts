// Pure unit tests for the UUID normalizer. Run with `bun test`.

import { expect, test } from "bun:test";

import { normalizeUuid } from "./normalize-uuid";

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
