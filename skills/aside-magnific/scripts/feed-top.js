/**
 * magnificFeedTop() returns the key of the Creations feed's top image: its src
 * without the query string. Call it just before a Generate click, and pass the
 * key to magnificDownload as `after`: a card made by that click sits above it.
 * Reads and scrolls only.
 *
 * The top image can be anyone's. The key names a file, not its content, so it
 * is safe to print. null means the feed showed no image.
 *
 * Needs: scroll-feed.js (load it too).
 */

globalThis.magnificFeedTop = async () => {
  await magnificScrollFeed(0);
  const refs = [...(await snapshot(page)).tree.matchAll(/generic \[ref=(e\d+)\]:\n\s+- image/g)].map((m) => m[1]);
  for (const ref of refs) {
    const src = await page
      .locator(ref)
      .evaluate((el) => (el.closest("aside") ? null : (el.querySelector("img")?.src ?? null)))
      .catch(() => null);
    if (src) {
      return src.split("?")[0];
    }
  }
  return null;
};
