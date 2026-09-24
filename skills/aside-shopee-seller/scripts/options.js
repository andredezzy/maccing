/**
 * shpOptions() opens the list of the field under a label, returns the snapshot
 * diff it added, and closes it. Reads only. null means the label is not in the
 * tree: expand the section's show-more button first.
 *
 * Needs: field.js, close-list.js.
 */

globalThis.shpOptions = async (label) => {
  const field = shpField((await snapshot(page)).tree, label);
  if (!field) {
    return null;
  }
  await page.locator(field.ref).click();
  await sleep(800);
  const { diff } = await snapshot(page);
  await shpClose(label);
  return diff;
};
