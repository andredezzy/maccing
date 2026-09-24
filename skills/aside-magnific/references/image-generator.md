# Image Generator

What the Image Generator panel did when it was driven live. Labels are dated examples (2026-09-23): read the current ones from a snapshot.

## Read the panel, not the page

The panel is the page's `<aside>`. Snapshot it alone, so the Creations feed (other people's work) stays out of your output:

```js
const { tree: panel } = await snapshot(page, { interactive: true, selector: 'aside' });
console.log(panel);
```

Seen top to bottom: the model picker button (under a "Model" label), references ("Style", "Character", "Add"), the prompt textbox, a count group (−, `status: "<n>"`, +), an aspect-ratio button ("16:9"), a quality button ("1.5K · Fast"), the Unlimited switch ("ON"/"OFF"), Generate, and a line of Unlimited text.

**Take two baselines, and restore both.** The app keeps settings per model, so a run changes two sets: the settings of the model you pick, and which model the panel shows.

1. **On opening**, before any change: the model and its aspect ratio, quality, count, Unlimited switch and prompt.
2. **Right after picking your model**: that model's settings as the app restored them, before you change any.
3. **At the end**: put back baseline 2 on your model, then pick baseline 1's model and check its settings still match baseline 1. The switch counts: after your last Generate, turn it back to its baseline, off included. Before a Generate, `SKILL.md`, "Spending credits", says which way you may turn it.

When you keep the model the panel opened on, the two baselines are the same. From a terminal, print each baseline and keep it: the next call starts a new tab (`terminal-runs.md`).

The helpers below read them. Define them alone in their own cell:

```js
// The Unlimited switch: the panel button that holds the ∞ icon. Reads only.
// Returns { label, enabled }, or null when no panel button holds that icon.
globalThis.magnificUnlimitedSwitch = async function () {
  return page.evaluate(() => {
    const isInfinity = (use) => /#infinity$/.test(use.getAttribute('href') || use.getAttribute('xlink:href') || '');
    const button = [...document.querySelectorAll('aside button')]
      .find((b) => [...b.querySelectorAll('use')].some(isInfinity));
    if (!button) return null;
    return { label: button.innerText.trim(), enabled: !button.disabled && button.getAttribute('aria-disabled') !== 'true' };
  });
};

// This tab's path, from the browser's tab list: page.url() can lag after an
// in-app navigation. null means the tab is gone.
globalThis.magnificTabPath = async function () {
  const tab = (await listBrowserTabs()).find((t) => t.targetId === page.targetId);
  return tab ? new URL(tab.url).pathname : null;
};

// Reads the generation panel's current values. Reads only: no clicks.
globalThis.magnificSettings = async function () {
  const { tree } = await snapshot(page, { interactive: true, selector: 'aside' });
  const buttons = [...tree.matchAll(/button "([^"]*)" \[ref=e\d+\]/g)].map((m) => m[1]);
  // The quality label is a resolution, then maybe a level: "1.5K · Fast", "2K•High", "1K".
  // The separator and the spaces around it vary, so only the resolution is anchored.
  const quality = buttons.find((b) => /^\d+(?:[.,]\d+)?\s*K\b/i.test(b)) ?? null;
  const [, resolution = null, level = null] = quality?.match(/^(\d+(?:[.,]\d+)?\s*K)\b[^\p{L}\p{N}]*(.*)$/iu) ?? [];
  return {
    url: await magnificTabPath(),
    model: tree.match(/text: "Model"\n\s+- button "([^"]*)"/)?.[1] ?? null,
    count: tree.match(/status: "(\d+)"/)?.[1] ?? null,
    aspect: buttons.find((b) => /^\d+(?:\.\d+)?\s*:\s*\d+/.test(b)) ?? null,
    quality,
    resolution: resolution?.replace(/\s+/g, '') ?? null,
    level: level || null,
    references: tree.match(/References\s*\d+\s*\/\s*\d+/)?.[0] ?? null,
    unlimited: await magnificUnlimitedSwitch(),
  };
};
```

Compare `resolution` and `level`, not the whole `quality` label: the separator between them has changed. `quality: null` means the panel shows no quality button; some models have none. `count: null` means the panel showed no count status. Read the prompt separately (see "Prompt").

`unlimited: null` means no panel button holds the ∞ icon. The icon may have been renamed: read the switch's DOM and adjust `isInfinity` before you trust the switch. The snapshot does not show the icon, so a button named "ON" proves nothing on its own.

## Model, aspect and quality

Each button opens a dialog. A `[role=dialog]` selector finds nothing, so cut the dialog out of the whole tree. It sits at the end, after the feed:

```js
const { tree: p1 } = await snapshot(page, { interactive: true, selector: 'aside' });
await page.locator(p1.match(/text: "Model"\n\s+- button "[^"]*" \[ref=(e\d+)\]/)[1]).click();
const d1 = (await snapshot(page, { interactive: true })).tree.match(/- dialog:[\s\S]*/)?.[0];
console.log(d1);
```

- **The model picker** has a search box, filters, a "Featured" list and an "All models" list grouped by provider. Each entry's name carries tags (for example "New", "Refs", the typical time, the resolutions) and, for paid entries, a credit range. Click an entry by its ref from the dialog snapshot. The panel's own model button has the same name, so never match against the whole page.
- **The quality dialog** offers resolutions and, on some models, a "thinking level" (Fast/High). It may show a credit figure or an "Unlimited" hint.
- **The aspect dialog** lists ratios with names ("1:1 Square", "16:9 Widescreen", …).
- Dialogs don't mark the selected option. The panel button shows the current value. Escape closes a dialog, and a dialog left open stays open for the next REPL call.
- The app remembers settings per model. Picking a model restores its last settings: take baseline 2 then ("Read the panel, not the page").

## Count

The − and + buttons sit either side of `status: "<n>"`. Set it to exactly the number the user asked for. The minus button is disabled at 1, and the plus button is disabled at the current maximum.

The maximum depends on the model, its settings and Unlimited, so read it live: after choosing the settings, check whether + is disabled. Under Unlimited it can be 1. When it is below what the user asked for, plan one Generate per image, each after the previous batch finishes (`unlimited.md`, "One batch at a time"). Those cards would share one prompt, so plan how to tell them apart before the first Generate (`creations.md`, "Telling your new card from an older one").

## Prompt

The prompt is a rich-text editor.

**Close any popover first.** A popover can open over the prompt box mid-run, such as the Unlimited priority-usage one (`unlimited.md`, "Priority usage"). Keys typed then land in the popover or nowhere. Before typing, take the whole interactive tree and look for a `- dialog:`. If one is open, read what it says, close it with its close button or Escape, and snapshot again.

```js
const promptBox = page.locator('aside .tiptap, aside [contenteditable=true], aside textarea').first();
await promptBox.click();
await page.keyboard.press('Meta+A');
await page.keyboard.press('Backspace');
await page.keyboard.insertText(promptText);
```

**Read the prompt back before every Generate**, from the editor itself, and compare it with what you meant to type. On any difference, stop: do not click Generate.

```js
const typed = await promptBox.evaluate((el) => el.innerText ?? el.value);
if (typed.trim() !== promptText.trim()) throw new Error('prompt read-back differs: ' + JSON.stringify(typed));
```

Typing "@" may open a reference picker. A cleared box can still hold a newline; the snapshot then shows an unnamed textbox and a disabled Generate, as it does when empty.

## References

Setting the page's `input[type=file]` directly did nothing. The file chooser worked. The file must sit inside the REPL session folder (`pwd`), or `setFiles` fails with "escapes the session directory". Copy it there with Bash first, or write it from the REPL. From a terminal each call has a new folder, so bring the file in within the call that uploads it (`../aside/references/terminal.md`).

1. Click the reference "Add" slot in the panel. A modal opens with "History" and "Uploads" tabs. It has no dialog role: find its controls by name in the whole tree.
2. Upload through the file chooser:

```js
const chooser = page.waitForEvent('filechooser', { timeout: 8000 });
await page.getByRole('button', { name: 'Upload media' }).click();   // the modal's upload button
await (await chooser).setFiles('./ref.jpg');
await page.getByRole('button', { name: 'Add', exact: true }).last().click();   // the modal's confirm
```

3. The panel then shows a reference counter such as "References 1/14" and a chip such as `@img1`.

The limit is the counter's second number. It differs per model, so read it from the counter before planning references.

To remove a reference, click the chip's remove button from inside the page. The button (named like "Remove @img1") is hidden: it shows only in a `showHidden` snapshot, not on hover. A normal or forced locator click did nothing; `el.click()` inside `page.evaluate` worked:

```js
const { tree } = await snapshot(page, { interactive: true, selector: 'aside', showHidden: true });
console.log(tree.match(/[^\n]*Remove @img\d+[^\n]*/g));   // the chips' remove buttons
const removed = await page.evaluate((name) => {
  const el = [...document.querySelectorAll('button')]
    .find((b) => (b.getAttribute('aria-label') || b.title || b.textContent).trim() === name);
  el?.click();
  return Boolean(el);
}, 'Remove @img1');
```

`removed: false` means the lookup missed: read the button's attributes and adjust it. Then check the counter went down.

Files of about 100 KB worked. Larger files are untested.

## Generate

**Check the URL before each Generate.** The tab can leave the generator on its own. It has moved to a full-size result view (`/app/creation/<id>`) whose image covered the prompt box: typing did nothing and Escape did not close it. Read the path with `magnificTabPath()`, not `page.url()`, which can lag (`../aside/references/repl.md`). If it is not the generator's (2026-09-23: `/app/ai-image-generator`), go back with `page.goto` to it. The model settings survive that, but the references are cleared: read the panel again and re-add them before generating. A `null` path means your tab is gone: open a new one.

See SKILL.md, "Spending credits". For no-credit work, the only click is `magnificGenerate` from `unlimited.md`. The result arrives in the Creations feed; see `creations.md`.

## Dated examples (2026-09-23 unless marked; not rules)

- The reference counter's limit read /14 on Nano Banana 2 and /8 on Auto. An earlier run the same day saw /10.
- With Nano Banana 2 at 1K · Fast and Unlimited on, + was disabled at 1. On Auto, + was disabled at 4.
- 2026-09-24: labels such as "1.5K · Fast" broke a helper whose pattern expected a whole-number resolution (`\dK`). On Auto the panel showed no quality button at all, only the aspect ("16:9"), the switch and Generate.
- 2026-09-24: the priority-usage popover opened over the prompt box during a run. Reading the prompt back caught it before a Generate.
- 2026-09-24: the switch was a plain button, not an ARIA switch. It held an icon drawn from `…sprite….svg#infinity` and a text "ON", carried `aria-disabled`, and opened a popup (`aria-haspopup="dialog"`). It sat right before Generate. With Auto, an empty prompt and the switch on, the panel showed no Unlimited text.
- 2026-09-24: `page.targetId` held the same id `listBrowserTabs()` gave the tab. `aside guide repl` does not list it.
