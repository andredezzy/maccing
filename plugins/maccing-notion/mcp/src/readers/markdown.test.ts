// Pure unit tests for normalizeCallouts — a stateful regex transform prone to edge cases. Run with `bun test`.

import { expect, test } from "bun:test";

import { normalizeCallouts } from "./markdown";

test("callout with icon → blockquote with the icon on the first line", () => {
  expect(normalizeCallouts('<callout icon="💡">\nRemember this\n</callout>')).toBe("> 💡 Remember this");
});

test("callout without icon → plain blockquote", () => {
  expect(normalizeCallouts("<callout>\njust text\n</callout>")).toBe("> just text");
});

test("multiline body → every line prefixed with '> '; icon only on the first", () => {
  expect(normalizeCallouts('<callout icon="⚠️">\nline one\nline two\n</callout>')).toBe("> ⚠️ line one\n> line two");
});

test("a leading tab on a body line is stripped before prefixing", () => {
  expect(normalizeCallouts("<callout>\n\ttabbed\n</callout>")).toBe("> tabbed");
});

test("a color attribute is tolerated and ignored", () => {
  expect(normalizeCallouts('<callout icon="🔥" color="red">\nhot\n</callout>')).toBe("> 🔥 hot");
});

test("multiple callouts in one document are each converted", () => {
  const input = '<callout icon="a">\none\n</callout>\n\n<callout icon="b">\ntwo\n</callout>';
  expect(normalizeCallouts(input)).toBe("> a one\n\n> b two");
});

test("color-before-icon attribute order normalizes the same as icon-first", () => {
  // Attribute matching is order-independent: the icon is pulled from the open tag regardless of where
  // it sits relative to color (or any other attribute).
  expect(normalizeCallouts('<callout color="red" icon="💡">\nhot\n</callout>')).toBe("> 💡 hot");
});

test("text without callouts passes through unchanged", () => {
  const text = "# Heading\n\nA paragraph with no callouts.";
  expect(normalizeCallouts(text)).toBe(text);
});

test("empty-body callout becomes a blockquote, not raw HTML", () => {
  // The trailing newline is optional: <callout …>\n</callout> has no body line, only one \n total.
  expect(normalizeCallouts('<callout icon="💡">\n</callout>')).toBe("> 💡 ");
});
