/**
 * shpTypeInto() replaces an input's value by typing, and returns what the
 * input then holds. Use it for the name, prices, stock, weight, box sizes and
 * textbox attributes such as quantities.
 *
 * fill() throws on the formatted inputs, keyboard.insertText can leave the
 * value unchanged or append to it, and keyboard typing after a click can land
 * in another field. Typing on the locator itself avoids all three.
 *
 * - input: a locator for the <input> itself, not its row.
 *
 * Needs: no other helper.
 */

globalThis.shpTypeInto = async (input, value) => {
  await input.scrollIntoViewIfNeeded();
  await input.focus();
  await page.keyboard.press("End");
  const length = (await input.inputValue()).length;
  for (let i = 0; i < length + 2; i++) {
    await page.keyboard.press("Backspace");
  }
  await input.pressSequentially(value);
  await input.blur();
  await sleep(300);
  return input.inputValue();
};
