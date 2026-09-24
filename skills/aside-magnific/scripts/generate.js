/**
 * magnificGenerate() is the Unlimited guard. It clicks Generate only when every
 * check passes, all read in this one call. dryRun (the default) checks without
 * clicking.
 *
 * - expect: { path, model, count, aspect, resolution, level }, each matching
 *   magnificSettings(). Every key is required. Pass null where the panel shows
 *   no such value.
 * - switchOn: the switch label when Unlimited is on. The switch must read it,
 *   be enabled, and have its popup closed.
 * - signal: the Unlimited text under Generate. Pass null only when a read on
 *   this model and these settings, with the switch on, showed no such text.
 *
 * Needs: settings.js, tab-path.js, unlimited-switch.js (load them too).
 */

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
