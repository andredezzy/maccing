// Pure unit tests for the display-width text primitives — the seam every renderer leans on for wrapping
// and padding. displayWidth's grapheme handling is covered in index.test; here we pin wordWrap's branches
// (the off-by-one-prone hard-break path) plus clip/padRight/spread. Run with `bun test`.

import { expect, test } from "bun:test";

import { clip, codeFence, displayWidth, padRight, spread, wordWrap } from "./text";

test("wordWrap: an empty string yields a single empty line (the sentinel)", () => {
  expect(wordWrap("", 10)).toEqual([""]);
});

test("wordWrap: wraps on word boundaries within the width", () => {
  expect(wordWrap("hello world", 7)).toEqual(["hello", "world"]);
});

test("wordWrap: preserves blank lines between paragraphs", () => {
  expect(wordWrap("hi\n\nbye", 20)).toEqual(["hi", "", "bye"]);
});

test("wordWrap: hard-breaks a single word longer than the width", () => {
  expect(wordWrap("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
});

test("wordWrap: a non-positive width clamps to 1 (never zero/negative)", () => {
  expect(wordWrap("x", 0)).toEqual(["x"]);
});

test("clip truncates with an ellipsis only when over the width", () => {
  expect(clip("hello", 10)).toBe("hello");
  expect(clip("hello", 4)).toBe("hel…");
});

test("padRight fits to exactly the width — pad when short, clip when long", () => {
  expect(padRight("hi", 5)).toBe("hi   ");
  expect(displayWidth(padRight("hello world", 6))).toBe(6);
});

test("spread right-aligns the right side within the width", () => {
  expect(spread("L", "R", 5)).toBe("L   R");
});

test("codeFence wraps a body in a triple-backtick fence", () => {
  expect(codeFence("hello")).toBe("```\nhello\n```");
});

test("codeFence returns empty for an empty body — nothing to fence", () => {
  expect(codeFence("")).toBe("");
});

test("codeFence lengthens the fence past any embedded backtick run so it can't break out early", () => {
  const body = "```js\ncode\n```"; // an embedded code block — a run of 3 backticks
  const fenced = codeFence(body);
  expect(fenced.startsWith("````\n")).toBe(true); // 4 backticks — one longer than the embedded run
  expect(fenced.endsWith("\n````")).toBe(true);
  expect(fenced).toContain(body); // body preserved verbatim inside
});
