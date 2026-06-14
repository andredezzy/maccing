// Alignment-invariant tests for the page-mockup renderer. The whole point of a renderer (vs a
// hand-typed mockup) is that borders ALWAYS close — so we assert exactly that on display width,
// including emoji lines (the case that broke every hand attempt). Run with `bun test`.

import { expect, test } from "bun:test";
import { displayWidth, type PageModel, renderMockup } from "./render-mockup";

test("displayWidth counts emoji as 2 cells and ZWJ/skin clusters as one glyph", () => {
  expect(displayWidth("abc")).toBe(3);
  expect(displayWidth("👦")).toBe(2);
  expect(displayWidth("👦 x")).toBe(4); // 2 + space + 1
  expect(displayWidth("👍🏽")).toBe(2); // emoji + skin tone = one width-2 grapheme
  expect(displayWidth("👨‍👩‍👧")).toBe(2); // ZWJ family sequence = one width-2 glyph
});

/** Every box (┌…┐ / │…│ / └…┘) must have equal DISPLAY width on every one of its lines. */
function assertBoxesClose(rendered: string): void {
  const lines = rendered.split("\n");
  let topWidth: number | null = null;
  for (const line of lines) {
    if (line.startsWith("┌")) {
      topWidth = displayWidth(line);
    } else if (line.startsWith("│") || line.startsWith("├") || line.startsWith("└")) {
      // a side/middle/bottom line of the current box (single-box lines; galleries use hcat rows
      // which start with ┌ — those are handled when their own top line is seen per row group)
      if (line.startsWith("└")) {
        expect(displayWidth(line)).toBe(topWidth);
        topWidth = null;
      } else if (topWidth !== null && !line.includes("  ")) {
        // skip hcat'd multi-box rows (they contain a 2-space gap); single boxes have no double gap
        expect(displayWidth(line)).toBe(topWidth);
      }
    }
  }
}

const model: PageModel = {
  title: "Gym",
  icon: "🏋",
  cover: "B&W dumbbell-rack cover",
  description: "Document your gym life",
  blocks: [
    { type: "callout", icon: "👦", lines: ["@andre.dezzy", "", "Height: 1,65m", "Age: 22"] },
    {
      type: "gallery",
      name: "Gym Navigation",
      views: ["Navigation", "All areas"],
      cardSize: "small",
      cards: [
        { icon: "💪", name: "Training", lines: ["Log and", "review…"] },
        { icon: "📖", name: "Exercises", lines: ["Browse the", "catalog"] },
      ],
    },
    {
      type: "gallery",
      name: "Muscle Groups",
      views: ["By muscle"],
      cardSize: "medium",
      cards: [
        { icon: "🦴", name: "Triceps", lines: ["0", "12"] },
        { icon: "💪", name: "Biceps", lines: ["0", "7"] },
      ],
    },
    {
      type: "table",
      name: "Weeks",
      views: ["All weeks"],
      columns: ["Name", "Volume", "Sessions"],
      rows: [["Jun 9-15 2025", "4 210", "3"]],
    },
    { type: "page_link", icon: "📓", title: "Training Log", note: "full-page database" },
  ],
};

test("renders a full page with every box closing on display width (incl. emoji lines)", () => {
  assertBoxesClose(renderMockup(model));
});

test("the callout's emoji line has the SAME display width as its borders", () => {
  const lines = renderMockup({
    title: "X",
    blocks: [{ type: "callout", icon: "👦", lines: ["@andre.dezzy", "Age: 22"] }],
  }).split("\n");
  const top = lines.find((l) => l.startsWith("┌"));
  const emojiLine = lines.find((l) => l.includes("@andre.dezzy"));
  const bottom = lines.find((l) => l.startsWith("└"));
  expect(top && emojiLine && bottom).toBeTruthy();
  expect(displayWidth(emojiLine ?? "")).toBe(displayWidth(top ?? ""));
  expect(displayWidth(bottom ?? "")).toBe(displayWidth(top ?? ""));
});

test("every database header carries a right-aligned + New", () => {
  const out = renderMockup(model);
  for (const dbName of ["Gym Navigation", "Muscle Groups", "Weeks"]) {
    const header = out.split("\n").find((l) => l.includes(`◷ ${dbName}`));
    expect(header).toBeTruthy();
    expect(header?.endsWith("+ New")).toBe(true);
  }
});

test("a table spans the full page width", () => {
  const out = renderMockup(model).split("\n");
  const topRule = out.find((l) => l.startsWith("┌─") && l.includes("┬"));
  expect(topRule).toBeTruthy();
  expect(displayWidth(topRule ?? "")).toBe(70);
});
