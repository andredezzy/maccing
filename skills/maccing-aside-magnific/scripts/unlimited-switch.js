/**
 * magnificUnlimitedSwitch() reads the Unlimited switch: the panel button that
 * holds the ∞ icon. Reads only.
 *
 * Returns { label, enabled, expanded }, or null when no panel button holds the
 * icon. expanded is true while the switch's own popup is open. A null may mean
 * the icon was renamed: read the switch's DOM and adjust isInfinity before you
 * trust the switch.
 *
 * Needs: no other helper.
 */

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
