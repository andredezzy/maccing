# Unlimited

Unlimited mode lets a plan generate on some models and settings without spending credits. It exists only in the web app.

## Magnific's terms

From https://www.magnific.com/ai/unlimited/changes:

> "Unlimited Generations are intended for individual, human use only. The following are not allowed, according to our Acceptable Use Policy: Automation or scraping tools; Account or credential sharing; Reselling access."

> "Magnific may pause or disable Unlimited Generations if it detects account sharing or automated tool usage. [...] Repeated suspicious activity may lead to permanent suspension of your account."

## Account risk, per account

Acceptance covers one Magnific account: the one whose owner accepted. Before the first automated Unlimited Generate:

1. Run the account check in `SKILL.md` and note the logged-in email.
2. Find the user's acceptance of these terms, in this task or in their own instructions. This public skill records no one's.
3. Match the email against the account that acceptance names. It counts only when it names this account, by email or so plainly that no other account fits.

When there is no acceptance, it names another account, or it names none, show the user the email and both quotes, and ask. Without a yes for this account, stop.

Keep the automated footprint small:

- Generate only the images the user asked for. Run no bulk loops and no speculative variations.
- If a generation fails or hangs, report it to the user. Never retry it on your own.

## The guard

**Before every Generate click, confirm the Unlimited signal and the settings you mean to run. If any differs, stop and tell the user.** Each image made without the signal costs credits.

The signal sits in the Generate area and depends on the model and its settings:

- the Unlimited switch: the panel button that holds the ∞ icon, with a label meaning on, enabled, and its popup closed;
- a line of text under Generate announcing unlimited generations, on some models only;
- sometimes the Generate button's own accessible name, which then mentions Unlimited.

A disabled switch reading off means this model at these settings charges credits. An enabled switch reading off may be turned on: "The switch" below says when and how.

The guard is `magnificGenerate`, in [`../scripts/magnific-helpers.js`](../scripts/magnific-helpers.js). In one call it reads the panel, compares it with what you pass, and clicks Generate only when all of it matches:

```js
console.log(JSON.stringify(await magnificGenerate({
  expect: { path: '<generator path>', model: '<model>', count: 1, aspect: '<aspect>', resolution: '<resolution>', level: '<level>' },
  switchOn: '<switch label when on>',
  signal: '<Unlimited text under Generate>',   // or null, see below
  dryRun: false,
})));
```

Take every value from an earlier `magnificSettings()` read, on the model and settings the user approved, with the switch on and enabled. Pass `null` where that read showed `null`. From a terminal, record them as constants and keep them for the whole run. A label read just now can be the off one, and the guard would then pass on it.

- **`signal`** is the text from a full snapshot of the panel (`snapshot(page, { selector: 'aside' })`) in that read. Whether it shows has depended on the model, not on the prompt (dated examples in `image-generator.md`). When that read showed the switch on and no such text, pass `signal: null`: the guard then relies on the switch, and its result says `text: null`. Name that in the report.
- **`dryRun`** defaults to `true`: it runs every check and clicks nothing.

`ok: true` returns `checked`, the values it verified. `ok: false` means stop and tell the user, with one exception: a full queue. Do not click Generate any other way for no-credit work.

**One batch at a time.** The account has a queue, and a full queue disables Generate. Before each Generate, wait until your previous cards have their images (`magnificDownload` in `creations.md` stops saying pending). When the helper reports a full queue, nothing was generated: wait for the running cards, then call it once more. If the queue is still full, tell the user. From a terminal, `terminal-runs.md` splits this into calls.

## The switch

When the user asked for no-credit work and the switch reads off but is enabled, you may turn it on. Never turn it off to make a paid run happen: that needs the user's yes to the cost (`SKILL.md`, "Spending credits"). Turning it back to its baseline after your last Generate is fine.

The switch declares a popup (`aria-haspopup="dialog"`), so a click may open a dialog instead of toggling. Unverified as of 2026-09-24: no one has watched what a click does. To change it:

1. Click the switch once, then read `magnificUnlimitedSwitch()` and cut any `- dialog:` out of the whole interactive tree.
2. If the label changed and `expanded` is false, it toggled. Go on.
3. If a dialog opened, read it. Use its own control only when it plainly sets Unlimited to the state you want. Otherwise close it with Escape, and tell the user what it said.
4. Read the switch again. Go on only when it reads the state you wanted, enabled, with `expanded` false.

## Which models and settings are Unlimited

This changes often. Check it live every time.

1. **The app is the authority.** Select a model and settings, then read the signal. The docs have lagged behind the app.
2. **The model picker** shows a credit range beside paid entries. An entry without one is only a candidate: the switch decides. The quality dialog may show a credit figure or an "Unlimited" hint, but it has disagreed with the switch.
3. **Magnific's docs** give a map: https://www.magnific.com/ai/docs/unlimited-models (models per plan) and https://www.magnific.com/ai/unlimited/changes. Open them in a tab and read the snapshot.

A lower resolution or a faster "thinking" level often keeps Unlimited on where a higher one turns it off. Dropping one changes the output the user gets, so it is their call. Tell them the settings they asked for, the settings that keep the signal, and that keeping theirs costs credits. Change only on their yes. When they already asked for no-credit work at whatever quality it takes, go ahead, and name the settings you used in the report.

**When the chosen model shows no signal** at any setting, stop and tell the user. Name the picker entries that carry no credit range as candidates, and switch to one only on their yes: the model is part of what they asked for.

## Evidence that a run cost nothing

- **Direct: the guard at each click.** `magnificGenerate` clicks only while the Unlimited signal is present, so its `ok: true, clicked: true` result shows the signal was there at that click. Keep the result of every Generate, with its `checked` values, and report them.
- **Indirect: the credit balance.** It is shared by the whole account, and other sessions and people spend from it. It counts only when you read it right before and right after your run, and know nothing else ran in the account between. Otherwise it says nothing about your run. The Magnific MCP's `account_balance` reports it, for an agent that has the MCP.
- **If the app shows a credit figure on your cards**, read it on every card you made. The app may show none, on the feed card or on the creation's page, even on hover.

## Priority usage

Unlimited has a priority allowance that resets on a date. The app can show it in a popover over the prompt box, such as "Unlimited, priority usage N% spent, resets on <date>", with a close button. It can open mid-run. When it does:

1. Read the percentage and the reset date, then close it before typing (`image-generator.md`, "Prompt").
2. Tell the user both figures, in the run's report: the allowance may run out before the reset. Magnific's docs have a "Priority usage" page under "Unlimited generations" that says what happens then; read it before you describe it.

## Dated examples (2026-09-23 unless marked, Premium+ plan; not rules)

- The switch showed the ∞ icon and the label "ON" or "OFF". The text under Generate read "Unlimited generations". The Generate button's name was "Generate", "Generate Unlimited" or "GenerateUnlimited".
- Seedream 5 Pro was Unlimited at 1.5K · Fast. At 2K · High the switch went OFF and disabled. The docs table did not list this model.
- Google Nano Banana 2 was OFF and disabled at 2K · Fast, and ON at 1K · Fast.
- Picker entries such as "Cinematic … 75 - 150" and "GPT 2.5 … 15 - 1000" carried credit ranges. The Unlimited-eligible ones carried none.
- One Seedream 5 Pro image at 1.5K took 30–60 s. The credit balance did not change across 13 web generations.
- In another run the balance fell from 44,775 to 44,175 while other generations ran in the account. The agent's 40 cards all showed 0 credits.
- A queue full of running generations left Generate disabled with a prompt typed in. The old guard read that as an empty prompt.
- 2026-09-24: the app showed no credit figure on the feed cards or on a creation's page, even on hover.
- 2026-09-24: the popover opened over the prompt box as a dialog holding the text "Unlimited" and an unnamed close button. It read 30% of priority usage spent, resetting on October 20.
