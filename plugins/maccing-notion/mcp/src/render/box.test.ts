// Pure unit tests for the box-drawing primitives that render paths don't exercise directly. Run with `bun test`.

import { expect, test } from "bun:test";

import { hcat } from "./box";

test("hcat returns an empty array when given no boxes", () => {
  expect(hcat([], 2)).toEqual([]);
});

test("hcat lays boxes side by side, padding shorter ones to the tallest height", () => {
  const left = ["aa", "bb", "cc"];
  const right = ["xx"]; // shorter → padded with blank lines to match height
  expect(hcat([left, right], 1)).toEqual(["aa xx", "bb   ", "cc   "]);
});
