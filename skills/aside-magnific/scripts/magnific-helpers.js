/**
 * Magnific helpers for the Aside REPL
 *
 * Defines the magnific* helpers on globalThis. They read the Image Generator
 * panel, guard the Generate click, and download your results from the feed.
 * Only magnificGenerate clicks, and only with dryRun: false.
 *
 * Usage:
 *   From a terminal, prepend this file to every call:
 *     aside repl --account <id> "$(cat <skill dir>/scripts/magnific-helpers.js task.js)"
 *   In the Aside agent's REPL, run this file once as its own cell.
 *
 * What each helper returns, and when to call it: references/image-generator.md,
 * references/unlimited.md and references/creations.md.
 */

// The Unlimited switch: the panel button that holds the ∞ icon. Reads only.
// Returns { label, enabled, expanded }, or null when no panel button holds the icon.
// expanded is true while the switch's own popup is open.
globalThis.magnificUnlimitedSwitch = async () =>
  page.evaluate(() => {
    const isInfinity = (use) => /#infinity$/.test(use.getAttribute("href") || use.getAttribute("xlink:href") || "");
    const button = [...document.querySelectorAll("aside button")].find((b) =>
      [...b.querySelectorAll("use")].some(isInfinity),
    );
    if (!button) {
      return null;
    }
    return {
      label: button.innerText.trim(),
      enabled: !button.disabled && button.getAttribute("aria-disabled") !== "true",
      expanded: button.getAttribute("aria-expanded") === "true",
    };
  });

// This tab's path, from the browser's tab list: page.url() can lag after an
// in-app navigation. null means the tab is gone.
globalThis.magnificTabPath = async () => {
  const tab = (await listBrowserTabs()).find((t) => t.targetId === page.targetId);
  return tab ? new URL(tab.url).pathname : null;
};

// Reads the generation panel's current values. Reads only.
globalThis.magnificSettings = async () => {
  const { tree } = await snapshot(page, { interactive: true, selector: "aside" });
  const buttons = [...tree.matchAll(/button "([^"]*)" \[ref=e\d+\]/g)].map((m) => m[1]);
  // The quality label is a resolution, then maybe a level: "1.5K · Fast", "2K•High", "1K".
  // The separator varies, so only the resolution is anchored.
  const quality = buttons.find((b) => /^\d+(?:[.,]\d+)?\s*K\b/i.test(b)) ?? null;
  const [, resolution = null, level = null] = quality?.match(/^(\d+(?:[.,]\d+)?\s*K)\b[^\p{L}\p{N}]*(.*)$/iu) ?? [];
  const count = tree.match(/status: "(\d+)"/)?.[1];
  return {
    path: await magnificTabPath(),
    model: tree.match(/text: "Model"\n\s+- button "([^"]*)"/)?.[1] ?? null,
    count: count === undefined ? null : Number(count),
    aspect: buttons.find((b) => /^\d+(?:\.\d+)?\s*:\s*\d+/.test(b)) ?? null,
    quality,
    resolution: resolution?.replace(/\s+/g, "") ?? null,
    level: level || null,
    references: tree.match(/References\s*\d+\s*\/\s*\d+/)?.[0] ?? null,
    unlimited: await magnificUnlimitedSwitch(),
  };
};

// Clicks Generate only when every check passes, all read in this one call:
// - expect: { path, model, count, aspect, resolution, level }, each matching magnificSettings().
//   Every key is required. Pass null where the panel shows no such value.
// - switchOn: the switch label when Unlimited is on. The switch must read it, be
//   enabled, and have its popup closed.
// - signal: the Unlimited text under Generate. Pass null only when a read on this
//   model and these settings, with the switch on, showed no such text.
// dryRun (the default) checks without clicking.
globalThis.magnificGenerate = async ({ expect, switchOn, signal, dryRun = true }) => {
  const keys = ["path", "model", "count", "aspect", "resolution", "level"];
  const missing = [
    ...keys.filter((k) => !expect || !(k in expect)).map((k) => `expect.${k}`),
    ...(typeof switchOn === "string" ? [] : ["switchOn"]),
    ...(signal === undefined ? ["signal"] : []),
  ];
  if (missing.length > 0) {
    return { ok: false, reason: `Missing arguments: ${missing.join(", ")}` };
  }

  const { tree } = await snapshot(page, { interactive: true, selector: "aside" });
  const generate = tree.match(/button "Generate[^"]*" \[ref=(e\d+)\]( \[disabled\])?/);
  if (!generate) {
    return { ok: false, reason: "No Generate button in the panel" };
  }
  if (generate[2]) {
    // An empty prompt shows as an unnamed textbox. A named one means the prompt is in.
    const hasPrompt = /- textbox "[^"]+"/.test(tree);
    return {
      ok: false,
      reason: hasPrompt
        ? "Generate is disabled with a prompt in: the queue is probably full"
        : "Generate is disabled: the prompt is empty",
    };
  }

  const settings = await magnificSettings();
  const differs = keys
    .filter((k) => settings[k] !== expect[k])
    .map((k) => `${k}: ${JSON.stringify(settings[k])}, expected ${JSON.stringify(expect[k])}`);
  if (differs.length > 0) {
    return { ok: false, reason: `Panel differs: ${differs.join("; ")}` };
  }

  const unlimited = settings.unlimited;
  if (!unlimited) {
    return { ok: false, reason: "No Unlimited switch (no panel button holds the ∞ icon)" };
  }
  if (unlimited.label !== switchOn || !unlimited.enabled || unlimited.expanded) {
    return {
      ok: false,
      reason: `Unlimited switch reads ${JSON.stringify(unlimited)}; expected label ${JSON.stringify(switchOn)}, enabled, popup closed`,
    };
  }
  if (signal !== null) {
    // Plain text can be missing from the interactive tree, so read the full panel too.
    const { tree: full } = await snapshot(page, { selector: "aside" });
    if (![tree, full].some((t) => t.includes(`text: "${signal}"`))) {
      return { ok: false, reason: `Unlimited text absent: ${JSON.stringify(signal)}` };
    }
  }

  const checked = { ...expect, switch: unlimited.label, text: signal };
  if (dryRun) {
    return { ok: true, clicked: false, checked };
  }
  await page.locator(generate[1]).click();
  return { ok: true, clicked: true, checked };
};

// Finds your card in the Creations feed by a phrase from your prompt, and saves
// its full-size images into the REPL session folder as <name>-<n>.<ext>.
// name must be unique per run and scene: the same name overwrites earlier files.
// Reads and fetches only: no hover, no clicks.
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
