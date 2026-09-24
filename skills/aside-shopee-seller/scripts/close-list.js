/**
 * shpClose() closes the open option list of the field under a label. Clicking
 * the field again closes it; Escape did not.
 *
 * Needs: field.js, list-open.js.
 */

globalThis.shpClose = async (label) => {
  const tree = (await snapshot(page)).tree;
  if (shpListOpen(tree)) {
    await page.locator(shpField(tree, label).ref).click();
    await sleep(600);
  }
};
