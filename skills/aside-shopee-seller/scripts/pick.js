/**
 * shpPick() picks one option in the dropdown under a label. For a
 * multi-select, call it once per value. Returns { ok, now } with the field as
 * it reads afterwards, or { ok: false, reason }.
 *
 * An open list repeats the field's current value, so the option clicked is the
 * last match in the tree.
 *
 * Needs: escape.js, field.js, close-list.js.
 */

globalThis.shpPick = async (label, option) => {
  const field = shpField((await snapshot(page)).tree, label);
  if (!field) {
    return { ok: false, reason: "label not found; expand the show-more button?" };
  }
  await page.locator(field.ref).click();
  await sleep(800);
  const hits = [
    ...(await snapshot(page)).tree.matchAll(new RegExp(`generic "${shpEscape(option)}" \\[ref=(e\\d+)\\]`, "g")),
  ];
  if (hits.length < (field.shows === option ? 2 : 1)) {
    await shpClose(label);
    return { ok: false, reason: "option not listed" };
  }
  await page.locator(hits.at(-1)[1]).click();
  await sleep(600);
  await shpClose(label);
  return { ok: true, now: shpField((await snapshot(page)).tree, label) };
};
