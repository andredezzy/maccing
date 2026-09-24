/**
 * shpAddItem() adds a value a dropdown's list lacks, through the list's own
 * add-new item, and selects it. Returns the field as it reads afterwards.
 *
 * - labels.addItem: today's text of the add-new item at the end of the list.
 * - labels.input: today's placeholder of the textbox it shows.
 *
 * The confirm button after that textbox has no name and starts disabled.
 * pressSequentially enables it; insertText leaves it disabled.
 *
 * Needs: escape.js, field.js, list-open.js, close-list.js.
 */

globalThis.shpAddItem = async (label, value, labels) => {
  let tree = (await snapshot(page)).tree;
  if (!shpListOpen(tree)) {
    await page.locator(shpField(tree, label).ref).click();
    await sleep(800);
    tree = (await snapshot(page)).tree;
  }
  const add = [...tree.matchAll(new RegExp(`generic "${shpEscape(labels.addItem)}" \\[ref=(e\\d+)\\]`, "g"))].at(-1);
  if (!add) {
    await shpClose(label);
    throw new Error(`no "${labels.addItem}" item in the ${label} list`);
  }
  await page.locator(add[1]).click();
  await sleep(800);
  // Refs go stale once you type, so find the textbox and its button again.
  const newItem = async () =>
    (await snapshot(page)).tree.match(
      new RegExp(
        `textbox "${shpEscape(labels.input)}" \\[ref=(e\\d+)\\][^\\n]*\\n\\s*- button[^\\n]*\\[ref=(e\\d+)\\]`,
      ),
    );
  await page.locator((await newItem())[1]).pressSequentially(value);
  await sleep(400);
  await page.locator((await newItem())[2]).click();
  await sleep(800);
  if (!shpField((await snapshot(page)).tree, label).shows.includes(value)) {
    const hits = [
      ...(await snapshot(page)).tree.matchAll(new RegExp(`generic "${shpEscape(value)}" \\[ref=(e\\d+)\\]`, "g")),
    ];
    if (hits.length) {
      await page.locator(hits.at(-1)[1]).click();
      await sleep(600);
    }
  }
  await shpClose(label);
  return shpField((await snapshot(page)).tree, label);
};
