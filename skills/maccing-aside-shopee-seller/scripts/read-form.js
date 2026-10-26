/**
 * shpRead() reads a listing form's text inputs from the DOM, because the
 * snapshot drops sections of a long form. Returns { fields, preview }:
 * fields maps each row's label to its values, and preview is the preview
 * card's text, which prints the name typed in the form, then the shop name.
 *
 * Labels lose their "*" and extra spaces. Empty fields means Shopee renamed
 * the classes: inspect the DOM before you trust any read.
 *
 * Needs: no other helper.
 */

globalThis.shpRead = async () => {
  const rows = await page.locator(".edit-row").evaluateAll((els) =>
    els.map((e) => [
      (e.querySelector("[class*=label]")?.innerText ?? "").replace(/[*\s]+/g, " ").trim(),
      [...e.querySelectorAll("input:not([type=file]):not([type=checkbox]):not([type=radio]), textarea")]
        .map((i) => i.value)
        .filter(Boolean)
        .join(" | "),
    ]),
  );
  const preview = await page
    .locator(".preview-card")
    .first()
    .innerText()
    .catch(() => "");
  return { fields: Object.fromEntries(rows.filter(([label]) => label)), preview: preview.replace(/\s+/g, " ") };
};
