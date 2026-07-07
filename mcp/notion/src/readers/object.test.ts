// Pure unit tests for the page/database icon formatters — iconLabel (the `describe` tool) and iconGlyph
// (the render model). Run with `bun test`.

import { expect, test } from "bun:test";

import { iconGlyph, iconLabel } from "./object";

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

test("a named icon with no name → 'none' (degenerate shape guard)", () => {
  expect(iconLabel({ type: "icon", icon: {} })).toBe("none");
});

test("an unrecognized icon type → 'none' (forward-compat default)", () => {
  expect(iconLabel({ type: "custom_upload" })).toBe("none");
});

test("iconGlyph: emoji → the emoji; image icons → 🖼; nothing → undefined", () => {
  expect(iconGlyph({ type: "emoji", emoji: "🏋" })).toBe("🏋");
  expect(iconGlyph({ type: "external", external: { url: "https://x/i.png" } })).toBe("🖼");
  expect(iconGlyph(null)).toBeUndefined();
});

test("iconGlyph: a named icon renders as name:color (color dropped when default or absent)", () => {
  expect(iconGlyph({ type: "icon", icon: { name: "gym", color: "gray" } })).toBe("gym:gray");
  expect(iconGlyph({ type: "icon", icon: { name: "cash", color: "default" } })).toBe("cash");
  expect(iconGlyph({ type: "icon", icon: { name: "cash" } })).toBe("cash");
});
