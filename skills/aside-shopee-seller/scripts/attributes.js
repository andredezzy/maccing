/**
 * shpAttributes() reads every specification attribute's current value from the
 * DOM: { '<label>': '<value>' | ['<tag>', …] | '' }. A multi-select gives its
 * tags; an empty field gives ''.
 *
 * Expand the section's show-more button first, or the hidden attributes are
 * missing. Shopee pre-fills some attributes on its own: compare every value
 * with what the listing declares.
 *
 * Needs: no other helper.
 */

globalThis.shpAttributes = async () =>
  Object.fromEntries(
    await page.evaluate(() =>
      [...document.querySelectorAll(".item-title-text")].map((title) => {
        const row = title.closest(".edit-row");
        const tags = [...row.querySelectorAll(".eds-selector--tag .text")].map((t) => t.textContent.trim());
        const single = row.querySelector(".single-selector .eds-selector__inner");
        const inputs = [...row.querySelectorAll("input")].map((i) => i.value).filter(Boolean);
        let value = inputs.join(",");
        if (tags.length) {
          value = tags;
        } else if (single) {
          value = single.classList.contains("placeholder") ? "" : single.textContent.trim();
        }
        return [title.textContent.trim(), value];
      }),
    ),
  );
