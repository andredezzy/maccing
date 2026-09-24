/**
 * magnificDownload() finds your card in the Creations feed by a phrase from your
 * prompt, and saves its full-size images into the REPL session folder as
 * <name>-<n>.<ext>. Reads, scrolls and fetches only: no hover, no clicks.
 *
 * - name: unique per run and scene. The same name overwrites earlier files.
 * - after: the key magnificFeedTop() returned just before your Generate click.
 *   Only a card above that image counts, so an older card with the same phrase
 *   is skipped. Pass null only to take the first card holding the phrase.
 * - minLongSide: the smallest long side, in pixels, a full-size file may have.
 *   A smaller file is a preview: it is not saved, and the result says so.
 *
 * Needs: scroll-feed.js (load it too).
 */

globalThis.magnificDownload = async ({ promptPart, count, name, after, minLongSide, maxScrolls = 40 }) => {
  const missing = [
    ...(name ? [] : ["name (unique to this run and scene, such as <run tag>-<scene>)"]),
    ...(after === undefined ? ["after (magnificFeedTop() before Generate, or null)"] : []),
    ...(Number.isFinite(minLongSide) ? [] : ["minLongSide (pixels)"]),
  ];
  if (missing.length > 0) {
    return { ok: false, reason: `Missing arguments: ${missing.join(", ")}` };
  }
  // A relative time ("3 minutes ago") sits on its own text line under the prompt.
  const isTime = (text) => / ago$/.test(text);
  let anchorSeen = false;

  // Returns the first card holding promptPart in this snapshot, or null.
  // With `after`, the card is `old` when it sits below the anchor image.
  const findCard = async () => {
    const lines = [...(await snapshot(page)).tree.matchAll(/[^\n]+/g)].map((m) => m[0]);
    const anchorRendered =
      after !== null &&
      (await page.evaluate((key) => [...document.images].some((i) => i.src.split("?")[0] === key), after));
    const seenBefore = anchorSeen;
    anchorSeen ||= anchorRendered;
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

    let old = false;
    const firstRef = card.match(/\[ref=(e\d+)\]/)?.[1];
    if (after !== null && firstRef) {
      const place = await page
        .locator(firstRef)
        .evaluate((el, key) => {
          const anchor = [...document.images].find((i) => i.src.split("?")[0] === key);
          if (!anchor) {
            return "unseen";
          }
          return anchor.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING ? "above" : "below";
        }, after)
        .catch(() => "unseen");
      // Scanning runs top down, so an anchor seen earlier and gone now is above the card.
      old = place === "below" || (place === "unseen" && seenBefore);
    }

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
    return { old, sources: sources.filter(Boolean) };
  };

  await magnificScrollFeed(0);
  let found = null;
  // The feed is virtualized: a card can be missing, or show only some images.
  // Once the card shows, a few small scrolls bring the rest of it in.
  for (let i = 0, near = 0; i <= maxScrolls && near < 5; i++) {
    if (i > 0) {
      await magnificScrollFeed(found ? 0.3 : 0.8);
    }
    const card = await findCard();
    if (card && !card.old && (!found || card.sources.length > found.sources.length)) {
      found = card;
    }
    if (found) {
      if (found.sources.length >= count) {
        break;
      }
      near++;
    } else if (card?.old || (after !== null && anchorSeen && !card)) {
      // Everything from here down is older than your Generate.
      break;
    }
  }
  if (!found) {
    return {
      ok: false,
      reason: after === null ? "no card with this prompt in the feed" : "no card with this prompt above the anchor",
    };
  }
  if (found.sources.length === 0) {
    return { ok: false, reason: "pending" };
  }
  if (found.sources.length < count) {
    return { ok: false, reason: `found ${found.sources.length} of ${count} images; call again` };
  }

  // The file's own header names its format and pixel size; the content type is the fallback format.
  const readImage = (bytes, type) => {
    if (bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
      return { ext: "png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }
    if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
      // Walk the JPEG segments to the frame header (SOF), which holds the size.
      for (let i = 2; i + 9 < bytes.length; ) {
        if (bytes[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = bytes[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { ext: "jpg", width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) };
        }
        if (marker === 0xff) {
          i++;
        } else {
          i += marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8) ? 2 : 2 + bytes.readUInt16BE(i + 2);
        }
      }
      return { ext: "jpg", width: null, height: null };
    }
    if (bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") {
      const chunk = bytes.toString("latin1", 12, 16);
      if (chunk === "VP8X") {
        return { ext: "webp", width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
      }
      if (chunk === "VP8L") {
        const bits = bytes.readUInt32LE(21);
        return { ext: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8 ") {
        return { ext: "webp", width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
      }
      return { ext: "webp", width: null, height: null };
    }
    return { ext: type?.match(/^image\/([a-z0-9]+)/)?.[1] ?? "bin", width: null, height: null };
  };

  const saved = [];
  for (let i = 0; i < found.sources.length; i++) {
    // Drop only the preview flag: the rest of the query is the URL's signature.
    const res = await fetch(found.sources[i].replace("&preview=1", ""));
    if (!res.ok) {
      return { ok: false, reason: `fetch ${res.status}`, saved };
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type");
    const { ext, width, height } = readImage(bytes, type);
    const key = found.sources[i].split("?")[0];
    if (width === null) {
      return { ok: false, reason: `image ${i + 1}: size unreadable (${type}); not saved`, key, saved };
    }
    if (Math.max(width, height) < minLongSide) {
      return {
        ok: false,
        reason: `image ${i + 1}: ${width}x${height} is below ${minLongSide} px, a preview; not saved`,
        key,
        saved,
      };
    }
    const file = `./${name}-${i + 1}.${ext}`;
    await fs.writeFile(file, bytes);
    saved.push({ file: path.join(pwd, file), width, height, type, key });
  }
  return { ok: true, saved };
};
