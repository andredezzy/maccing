/**
 * shpCloseCategoryPicker() cancels the category picker when a stray click
 * opened it. The snapshot may not show it, yet it keeps the form from saving
 * as expected. Returns true when it closed one.
 *
 * - cancel: today's text of the picker's cancel button.
 *
 * The button is clicked with the mouse at its position, the way that worked.
 *
 * Needs: no other helper.
 */

globalThis.shpCloseCategoryPicker = async (cancel) => {
  const at = await page.evaluate((cancel) => {
    const button = [...document.querySelectorAll(".product-category-selector-modal button")].find(
      (b) => b.innerText.trim() === cancel && b.offsetParent,
    );
    if (!button) {
      return null;
    }
    const r = button.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, cancel);
  if (!at) {
    return false;
  }
  await page.mouse.click(at.x, at.y);
  await sleep(1000);
  return true;
};
