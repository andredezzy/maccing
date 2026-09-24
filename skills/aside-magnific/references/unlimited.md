# Unlimited

Unlimited mode lets a plan generate on some models and settings without spending credits. It exists only in the web app.

## Magnific's terms

From https://www.magnific.com/ai/unlimited/changes:

> "Unlimited Generations are intended for individual, human use only. The following are not allowed, according to our Acceptable Use Policy: Automation or scraping tools; Account or credential sharing; Reselling access."

> "Magnific may pause or disable Unlimited Generations if it detects account sharing or automated tool usage. [...] Repeated suspicious activity may lead to permanent suspension of your account."

## Account risk, per account

Acceptance covers one Magnific account: the one whose owner accepted. Before the first automated Unlimited Generate, run the account check in `SKILL.md` and confirm with the user that this account's owner accepted these terms. Their word counts when it comes in this task or in their own instructions; this public skill records no one's acceptance. Without it, show the user both quotes and ask. Without a yes, stop.

Keep the automated footprint small:

- Generate only the images the user asked for. Run no bulk loops and no speculative variations.
- If a generation fails or hangs, report it to the user. Never retry it on your own.

## The guard

**Before every Generate click, confirm the Unlimited signal is present. If it is absent, stop and tell the user.** Each image made without it costs credits.

The signal sits in the Generate area and depends on the model and its settings:

- the Unlimited switch (drawn "∞"), with an accessible name meaning on, and not disabled;
- a line of text under Generate announcing unlimited generations;
- sometimes the Generate button's own accessible name, which then mentions Unlimited.

A disabled switch reading off means this model at these settings charges credits. An enabled switch reading off may be turned on: `SKILL.md`, "Spending credits", says when.

Define the helper alone in its own cell:

```js
// Clicks Generate only while the Unlimited switch reads on (and is enabled)
// and the Unlimited text is shown. It reads the generation panel only
// (the <aside>), so feed items cannot match. Pass both labels exactly as
// the current snapshot shows them. dryRun checks without clicking.
globalThis.magnificGenerate = async function ({ signal, switchOn, dryRun = true }) {
  const { tree } = await snapshot(page, { interactive: true, selector: 'aside' });
  const generate = tree.match(/button "Generate[^"]*" \[ref=(e\d+)\]( \[disabled\])?/);
  if (!generate) return { ok: false, reason: 'No Generate button in the panel' };
  if (generate[2]) {
    // An empty prompt shows as an unnamed textbox. A named one means the prompt is in.
    const hasPrompt = /- textbox "[^"]+"/.test(tree);
    return { ok: false, reason: hasPrompt ? 'Generate is disabled with a prompt in: the queue is probably full' : 'Generate is disabled: the prompt is empty' };
  }
  const switchIsOn = [...tree.matchAll(/button "([^"]*)" \[ref=e\d+\]( \[disabled\])?/g)]
    .some((m) => m[1] === switchOn && !m[2]);
  // Plain text can be missing from the interactive tree, so read the full panel too.
  const { tree: full } = await snapshot(page, { selector: 'aside' });
  const signalShown = [tree, full].some((t) => t.includes(`text: "${signal}"`));
  if (!switchIsOn || !signalShown) {
    return { ok: false, reason: `Unlimited signal absent (switch on: ${switchIsOn}, text shown: ${signalShown})` };
  }
  if (dryRun) return { ok: true, clicked: false };
  await page.locator(generate[1]).click();
  return { ok: true, clicked: true };
};
```

Then snapshot, read the two labels, and call it:

```js
console.log(await magnificGenerate({ signal: '<Unlimited text under Generate>', switchOn: '<switch name when on>', dryRun: false }));
```

`ok: false` means stop and tell the user, with one exception: a full queue. Do not click Generate any other way for no-credit work.

**One batch at a time.** The account has a queue, and a full queue disables Generate. Before each Generate, wait until your previous cards have their images (`magnificDownload` in `creations.md` stops saying pending). When the helper reports a full queue, nothing was generated: wait for the running cards, then call it once more. If the queue is still full, tell the user. From a terminal, `terminal-runs.md` splits this into calls.

## Which models and settings are Unlimited

This changes often. Check it live every time.

1. **The app is the authority.** Select a model and settings, then read the signal. The docs have lagged behind the app.
2. **The model picker** shows a credit range beside paid entries. An entry without one is only a candidate: the switch decides. The quality dialog may show a credit figure or an "Unlimited" hint, but it has disagreed with the switch.
3. **Magnific's docs** give a map: https://www.magnific.com/ai/docs/unlimited-models (models per plan) and https://www.magnific.com/ai/unlimited/changes. Open them in a tab and read the snapshot.
4. **The credit figure on each of your cards** is the direct evidence of what your generations cost. Read it on every card you made.
5. **The credit balance**, before and after, is shared by the whole account. Other sessions and people spend from it too, so a drop across your run is not yours until your cards say so. The Magnific MCP's `account_balance` reports it, for an agent that has the MCP.

A lower resolution or a faster "thinking" level often keeps Unlimited on where a higher one turns it off.

**When the chosen model shows no signal** at any setting, stop and tell the user. Name the picker entries that carry no credit range as candidates, and switch to one only on their yes: the model is part of what they asked for.

## Dated examples (2026-09-23, Premium+ plan; not rules)

- The switch was drawn "∞" with the accessible name "ON" or "OFF". The text under Generate read "Unlimited generations". The Generate button's name was "Generate", "Generate Unlimited" or "GenerateUnlimited".
- Seedream 5 Pro was Unlimited at 1.5K · Fast. At 2K · High the switch went OFF and disabled. The docs table did not list this model.
- Google Nano Banana 2 was OFF and disabled at 2K · Fast, and ON at 1K · Fast.
- Picker entries such as "Cinematic … 75 - 150" and "GPT 2.5 … 15 - 1000" carried credit ranges. The Unlimited-eligible ones carried none.
- One Seedream 5 Pro image at 1.5K took 30–60 s. The credit balance did not change across 13 web generations.
- In another run the balance fell from 44,775 to 44,175 while other generations ran in the account. The agent's 40 cards all showed 0 credits.
- A queue full of running generations left Generate disabled with a prompt typed in. The old guard read that as an empty prompt.
