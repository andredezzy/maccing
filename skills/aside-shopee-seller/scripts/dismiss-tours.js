/**
 * shpDismissTours() closes the guided tours that sit over the listing form.
 * While one is open it swallows clicks and typing, and Escape does not close it.
 * Call it after the form loads and again before typing or saving.
 *
 * - known: a RegExp matching the text of tours you may close. A tour whose
 *   text does not match is left open and returned as unknown: read it and
 *   ask the user, because its button may do more than close it.
 *
 * Returns { closed: [<tour text>], unknown: <tour text> | null }.
 *
 * Needs: no other helper.
 */

globalThis.shpDismissTours = async (known) => {
  const closed = [];
  for (let i = 0; i < 10; i++) {
    const tour = page.locator(".tour-container:has(.next-button), .step-container:has(.next-button)").first();
    if (!(await tour.count()) || !(await tour.isVisible())) {
      return { closed, unknown: null };
    }
    const text = (await tour.innerText()).replace(/\s+/g, " ").trim();
    if (!known.test(text)) {
      return { closed, unknown: text };
    }
    await tour.locator(".next-button").first().click();
    closed.push(text.slice(0, 80));
    await sleep(1000);
  }
  throw new Error(`tours still open after 10 clicks: ${closed.join(" / ")}`);
};
