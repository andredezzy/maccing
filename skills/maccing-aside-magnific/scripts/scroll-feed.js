/**
 * magnificScrollFeed(share) scrolls the Creations feed by a share of its height.
 * 0 goes back to the top. It finds the feed through its first image outside the
 * panel, so a reference thumbnail in the panel never scrolls the panel instead.
 *
 * Returns false when no feed image is rendered, so nothing scrolled.
 *
 * Needs: no other helper.
 */

globalThis.magnificScrollFeed = async (share) => {
  const refs = [...(await snapshot(page)).tree.matchAll(/generic \[ref=(e\d+)\]:\n\s+- image/g)].map((m) => m[1]);
  for (const ref of refs) {
    const scrolled = await page
      .locator(ref)
      .evaluate((el, share) => {
        if (el.closest("aside")) {
          return null;
        }
        let box = el;
        while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) {
          box = box.parentElement;
        }
        if (box) {
          box.scrollTop = share === 0 ? 0 : box.scrollTop + box.clientHeight * share;
        }
        return true;
      }, share)
      .catch(() => null);
    if (scrolled) {
      await sleep(600);
      return true;
    }
  }
  return false;
};
