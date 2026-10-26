/**
 * shpImageSources() returns the URLs of the listing's images, in page order.
 * The first is the cover. Pass them to image-order.ts to check which file
 * each one is.
 *
 * Needs: no other helper.
 */

globalThis.shpImageSources = () =>
  page
    .locator(".shopee-image-manager")
    .first()
    .locator("img.shopee-image-manager__image")
    .evaluateAll((imgs) => imgs.map((i) => i.src));
