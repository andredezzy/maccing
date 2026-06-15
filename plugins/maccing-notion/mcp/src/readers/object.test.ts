// Pure unit tests for the page/database icon-label formatter. Run with `bun test`.

import { expect, test } from "bun:test";

import { iconLabel } from "./object";

test("emoji icon → the emoji glyph", () => {
  expect(iconLabel({ type: "emoji", emoji: "💰" })).toBe("💰");
});

test("named icon → name·color (color dropped when default)", () => {
  expect(iconLabel({ type: "icon", icon: { name: "chart-mixed", color: "gray" } })).toBe("chart-mixed·gray");
  expect(iconLabel({ type: "icon", icon: { name: "cash", color: "default" } })).toBe("cash");
});

test("external / file icon → the url", () => {
  expect(iconLabel({ type: "external", external: { url: "https://x/i.png" } })).toBe("https://x/i.png");
  expect(iconLabel({ type: "file", file: { url: "https://x/f.png" } })).toBe("https://x/f.png");
});

test("no icon → 'none'", () => {
  expect(iconLabel(null)).toBe("none");
  expect(iconLabel(undefined)).toBe("none");
});
