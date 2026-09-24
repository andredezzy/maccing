/**
 * shpDeleteImage() deletes the listing's image at a position (0 is the cover)
 * and waits until its tile is gone. Returns the image count after it.
 * It deletes with no confirmation.
 *
 * The delete icon shows only while the tile is hovered. Tiles are picked by
 * position: matching a tile by its image URL missed.
 *
 * Needs: no other helper.
 */

globalThis.shpDeleteImage = async (position) => {
  const tiles = page
    .locator(".shopee-image-manager")
    .first()
    .locator(".shopee-image-manager__itembox:has(img.shopee-image-manager__image)");
  const before = await tiles.count();
  if (position >= before) {
    throw new Error(`no image at position ${position}: the listing has ${before}`);
  }
  await tiles.nth(position).hover();
  await sleep(300);
  await tiles.nth(position).locator(".shopee-image-manager__icon--delete").click();
  for (let i = 0; i < 20 && (await tiles.count()) === before; i++) {
    await sleep(300);
  }
  const after = await tiles.count();
  if (after !== before - 1) {
    throw new Error(`image ${position} was not deleted: ${after} images`);
  }
  return after;
};
