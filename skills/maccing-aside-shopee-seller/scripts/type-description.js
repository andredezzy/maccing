/**
 * shpTypeDescription() replaces the description with text, typing it line by
 * line with Enter between lines. Returns true when the editor then reads back
 * exactly that text.
 *
 * keyboard.insertText into the editor has silently kept the old text. A tour
 * over the form steals the focus: the helper throws then, so dismiss it first.
 *
 * - row: today's label of the description row.
 *
 * Needs: read-description.js.
 */

globalThis.shpTypeDescription = async (row, text) => {
  const editor = page.locator(".edit-row").filter({ hasText: row }).first().locator(".ql-editor");
  await editor.evaluate((e) => {
    e.scrollIntoView({ block: "center" });
    e.focus();
    const range = document.createRange();
    range.selectNodeContents(e);
    range.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  });
  await sleep(400);
  if (!(await editor.evaluate((e) => e.contains(document.activeElement)))) {
    throw new Error("the description editor did not take the focus: is a tour open?");
  }
  await page.keyboard.press("Meta+A");
  await page.keyboard.press("Backspace");
  const lines = text.split("\n");
  for (const [i, line] of lines.entries()) {
    if (line) {
      await page.keyboard.type(line);
    }
    if (i < lines.length - 1) {
      await page.keyboard.press("Enter");
    }
  }
  await sleep(800);
  return (await shpReadDescription(row)) === text;
};
