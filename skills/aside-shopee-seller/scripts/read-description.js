/**
 * shpReadDescription() reads the description editor's text, one line per
 * paragraph. The editor is Quill: its .ql-editor sits in the description row,
 * beside a hidden .ql-clipboard that is also contenteditable.
 *
 * - row: today's label of the description row.
 *
 * Needs: no other helper.
 */

globalThis.shpReadDescription = async (row) => {
  const text = await page
    .locator(".edit-row")
    .filter({ hasText: row })
    .first()
    .locator(".ql-editor")
    .evaluate((e) => [...e.children].map((p) => p.innerText.replace(/\n$/, "")).join("\n"));
  return text.replace(/\n+$/, "");
};
