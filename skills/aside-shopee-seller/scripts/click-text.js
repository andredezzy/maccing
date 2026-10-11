/**
 * shpClickText() clicks the one visible element whose whole text is the given
 * text. Use it where `page.locator('text=…')` throws "Node is not an Element"
 * or a class locator waits until "Timeout waiting for element to be ready", as
 * on Shopee's eds tabs, filters and dropdown items.
 *
 * It clicks through the DOM, so it reaches what the pointer checks refuse.
 * Takes the whole visible text, counts included ("Não publicado(3)", not
 * "Não publicado"), and, when several elements match, { nth } (0-based, in page
 * order). Returns the number of matches. Throws on no match, or on several
 * without nth.
 *
 * Needs: no other helper.
 */

globalThis.shpClickText = async (text, { nth } = {}) => {
  const found = await page.evaluate(
    ([text, nth]) => {
      const hits = [...document.querySelectorAll("body *")].filter(
        (el) => el.offsetParent !== null && el.innerText?.trim() === text,
      );
      // The innermost element: an outer one with the same text wraps it.
      const inner = hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)));
      if (inner.length === 1 || (nth !== undefined && inner[nth])) {
        inner[nth ?? 0].click();
      }
      return inner.length;
    },
    [text, nth],
  );
  if (found === 0 || (found > 1 && nth === undefined) || (nth !== undefined && nth >= found)) {
    throw new Error(`shpClickText("${text}"): ${found} visible matches${nth === undefined ? "" : `, nth ${nth}`}`);
  }
  return found;
};
