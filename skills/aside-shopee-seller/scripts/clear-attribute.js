/**
 * shpClearAttribute() empties the specification attribute under a label, and
 * returns its value afterwards (see shpAttributes()).
 *
 * It clicks with the mouse at each control's position: a multi-select loses one
 * tag per click on the tag's delete icon; a single select shows its clear
 * button only while hovered. Clicking a multi-select's field instead can
 * remove a tag you meant to keep, so do not open it to clear it.
 *
 * Needs: attributes.js.
 */

globalThis.shpClearAttribute = async (label) => {
  const centre = (selector) =>
    page.evaluate(
      ([label, selector]) => {
        const title = [...document.querySelectorAll(".item-title-text")].find((t) => t.textContent.trim() === label);
        const control = title?.closest(".edit-row").querySelector(selector);
        if (!control) {
          return null;
        }
        control.scrollIntoView({ block: "center" });
        const r = control.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      },
      [label, selector],
    );
  if (await centre(".eds-selector--tag .delete-icon")) {
    for (let i = 0; i < 10; i++) {
      const tag = await centre(".eds-selector--tag .delete-icon");
      if (!tag) {
        break;
      }
      await page.mouse.move(tag.x, tag.y);
      await page.mouse.click(tag.x, tag.y);
      await sleep(500);
    }
  } else {
    const field = await centre(".eds-selector");
    if (field) {
      await page.mouse.move(field.x, field.y);
      await sleep(400);
    }
    const clear = await centre(".eds-selector__clear-btn");
    if (clear) {
      await page.mouse.move(clear.x, clear.y);
      await page.mouse.click(clear.x, clear.y);
      await sleep(500);
    }
  }
  await page.mouse.move(5, 400);
  return (await shpAttributes())[label];
};
