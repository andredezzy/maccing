/**
 * magnificSettings() reads the generation panel's current values. Reads only.
 *
 * Returns { path, model, count, aspect, quality, resolution, level, references,
 * unlimited }. Compare resolution and level, not the whole quality label: the
 * separator between them has changed. null means the panel shows no such value.
 *
 * Needs: tab-path.js, unlimited-switch.js (load them too).
 */

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
