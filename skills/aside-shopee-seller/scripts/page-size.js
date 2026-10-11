/**
 * shpPageSize() sets how many rows a list shows per page, through the eds
 * page-size dropdown under the table. A pointer click on that dropdown waits
 * until "Timeout waiting for element to be ready", and `text=` on its label
 * throws "Node is not an Element"; this clicks the option through the DOM.
 *
 * The product list holds a second, hidden page-size widget ("12 / page").
 * Only the visible one changes the table, so this acts on that one.
 *
 * Takes the size (a number the dropdown offers, such as 48). Returns the
 * visible label after the change. Throws when there is no visible widget or
 * no such option.
 *
 * Needs: no other helper.
 */

globalThis.shpPageSize = async (size) => {
  const clicked = await page.evaluate((size) => {
    const widget = [...document.querySelectorAll(".eds-pagination-sizes")].find((w) => w.offsetParent !== null);
    const option = [...(widget?.querySelectorAll("li.eds-dropdown-item") ?? [])].find(
      (li) => li.textContent.trim() === String(size),
    );
    option?.click();
    return Boolean(option);
  }, size);
  if (!clicked) {
    throw new Error(`shpPageSize(${size}): no visible page-size option ${size}`);
  }
  await sleep(3000);
  return page.evaluate(() =>
    [...document.querySelectorAll(".eds-pagination-sizes")]
      .find((w) => w.offsetParent !== null)
      ?.querySelector(".eds-pagination-sizes__content")
      ?.textContent.trim(),
  );
};
