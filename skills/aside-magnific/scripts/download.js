/**
 * magnificDownload() finds your card in the Creations feed by a phrase from your
 * prompt, and saves its full-size images into the REPL session folder as
 * <name>-<n>.<ext>. Reads and fetches only: no hover, no clicks.
 *
 * name must be unique per run and scene: the same name overwrites earlier files.
 * It takes the first card from the top that holds promptPart, which can be an
 * older card with the same phrase.
 *
 * Needs: no other helper.
 */

globalThis.magnificDownload = async ({ promptPart, count, name, maxScrolls = 40 }) => {
  if (!name) {
    return { ok: false, reason: "Pass a name unique to this run and scene, such as <run tag>-<scene>" };
  }
  // A relative time ("3 minutes ago") sits on its own text line under the prompt.
  const isTime = (text) => / ago$/.test(text);
  const findCard = async () => {
    const lines = [...(await snapshot(page)).tree.matchAll(/[^\n]+/g)].map((m) => m[0]);
    const start = lines.findIndex((l) => /^\s*- text: "/.test(l) && l.includes(promptPart));
    if (start < 0) {
      return null;
    }
    const indent = lines[start].match(/^\s*/)[0];
    let end = start + 1;
    for (; end < lines.length; end++) {
      const text = lines[end].startsWith(`${indent}- text: "`) && lines[end].slice(indent.length + 9, -1);
      if (text !== false && !isTime(text)) {
        break;
      }
    }
    const card = lines.slice(start, end).join("\n");
    // Read every src now: the next snapshot renumbers the refs.
    const sources = [];
    for (const m of card.matchAll(/generic \[ref=(e\d+)\]:\n\s+- image/g)) {
      sources.push(
        await page
          .locator(m[1])
          .evaluate((el) => el.querySelector("img")?.src ?? null)
          .catch(() => null),
      );
    }
    return { card, sources: sources.filter(Boolean) };
  };
  // Scrolls the feed by a share of its height; 0 goes back to the top.
  const scrollFeed = async (share) => {
    const any = (await snapshot(page)).tree.match(/generic \[ref=(e\d+)\]:\n\s+- image/)?.[1];
    if (!any) {
      return;
    }
    await page.locator(any).evaluate((el, share) => {
      let box = el;
      while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) {
        box = box.parentElement;
      }
      if (box) {
        box.scrollTop = share === 0 ? 0 : box.scrollTop + box.clientHeight * share;
      }
    }, share);
    await sleep(600);
  };

  await scrollFeed(0);
  let found = await findCard();
  // The feed is virtualized: a card can be missing, or show only some images.
  // Once the card shows, a few small scrolls bring the rest of it in.
  for (let i = 0, near = 0; i < maxScrolls && near < 5 && !(found && found.sources.length >= count); i++) {
    if (found) {
      near++;
    }
    await scrollFeed(found ? 0.3 : 0.8);
    found = (await findCard()) ?? found;
  }
  if (!found) {
    return { ok: false, reason: "no card with this prompt in the feed" };
  }
  if (found.sources.length === 0) {
    return { ok: false, reason: "pending" };
  }
  if (found.sources.length < count) {
    return { ok: false, reason: `found ${found.sources.length} of ${count} images; call again` };
  }

  // The file's own first bytes name its format; the content type is the fallback.
  const extensionOf = (bytes, type) => {
    const head = bytes.subarray(0, 12);
    if (head.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
      return "png";
    }
    if (head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
      return "jpg";
    }
    if (head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WEBP") {
      return "webp";
    }
    return type?.match(/^image\/([a-z0-9]+)/)?.[1] ?? "bin";
  };
  const saved = [];
  for (let i = 0; i < found.sources.length; i++) {
    // Without &preview=1 the same signed URL serves the full-size file.
    const res = await fetch(found.sources[i].replace("&preview=1", ""));
    if (!res.ok) {
      return { ok: false, reason: `fetch ${res.status}`, saved };
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type");
    const file = `./${name}-${i + 1}.${extensionOf(bytes, type)}`;
    await fs.writeFile(file, bytes);
    saved.push({ file: path.join(pwd, file), type });
  }
  return { ok: true, saved };
};
