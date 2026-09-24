/**
 * shpUploadImage() adds one image to the end of the listing's images and waits
 * until it has finished uploading. Returns the image count after it.
 *
 * - file: a path inside the REPL session folder (`../aside/references/terminal.md`
 *   says how to bring a file in).
 *
 * The edit form holds several file inputs; the one inside the image manager is
 * the images'. The counter beside the add tile goes up before the upload ends,
 * so the helper waits for the new tile and for no tile still loading.
 *
 * Needs: no other helper.
 */

globalThis.shpUploadImage = async (file) => {
  const manager = page.locator(".shopee-image-manager").first();
  const done = () => manager.locator("img.shopee-image-manager__image").count();
  const loading = () => manager.locator(".image-loading").count();
  const before = await done();
  await manager.locator("input[type=file]").first().setInputFiles(file);
  for (let i = 0; i < 60; i++) {
    if ((await done()) > before && (await loading()) === 0) {
      return done();
    }
    await sleep(1000);
  }
  throw new Error(`${file} did not finish uploading: ${await done()} images, ${await loading()} loading`);
};
