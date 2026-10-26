/**
 * magnificCardDownload(key) saves one feed image through its card's own
 * "Download" button, and returns the file's bytes. key is the image's src
 * without the query string.
 *
 * It hovers and clicks, so the feed re-renders and every snapshot ref goes
 * stale. Read what you need from a snapshot before you call it.
 *
 * Needs: no other helper.
 */

globalThis.magnificCardDownload = async (key) => {
  const img = page.locator(`img[src^="${key}"]`).first();
  if ((await img.count()) === 0) {
    return { ok: false, reason: "image not rendered in the feed" };
  }
  // The card shows its buttons on hover.
  await img.hover();
  await sleep(800);
  const download = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
  const clicked = await page.evaluate((key) => {
    const isDownload = (el) => (el.getAttribute("aria-label") || el.textContent || "").trim() === "Download";
    // The nearest ancestor that holds a Download button is this image's card.
    let box = [...document.images].find((i) => i.src.startsWith(key));
    let buttons = [];
    while (box && buttons.length === 0) {
      box = box.parentElement;
      buttons = [...(box?.querySelectorAll("button, a") ?? [])].filter(isDownload);
    }
    // Two buttons would mean the box holds more than this image.
    if (buttons.length !== 1) {
      return false;
    }
    buttons[0].click();
    return true;
  }, key);
  if (!clicked) {
    return { ok: false, reason: "no single Download button on the image's card" };
  }
  const file = await download;
  if (!file) {
    return { ok: false, reason: "the Download button started no download within 30 s" };
  }
  return { ok: true, bytes: await fs.readFile(await file.path()) };
};
