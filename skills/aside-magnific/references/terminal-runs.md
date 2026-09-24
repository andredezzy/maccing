# Generate runs from a terminal

How to split Magnific work into one-shot `aside repl` calls. Each call opens its own tab, and the tab closes when the call ends (`../aside/references/terminal.md`). The app keeps each model's settings across tabs. It loses the typed prompt, the references and any open dialog.

The Aside agent's own REPL keeps its tab across cells. It can ask the user and click Generate in the same tab, after reading the cost again. The rest of this file is for one-shot calls.

## Every call

1. Prepend the helpers the call uses to its code (`SKILL.md`, "Helpers"; `../aside/references/terminal.md`, "One call is one session"). List the tabs, open your own, and check the URL is the tool you want.
2. In a call that reads a cost or clicks Generate, run the account check (`SKILL.md`). Stop if the email differs from the one the user confirmed.
3. Do one step, verify it, and close the tab. The task's last call restores the settings you changed (`SKILL.md`, "Opening the app").

## Paid work

The user must say yes after they see the cost, and the tab is gone by then. So a paid Generate takes two calls with the user's answer between them.

1. **Read call.** Set the model, settings and count, type the prompt, add the references. Read the cost the panel shows. Print the account, model, settings, count, reference count and cost. Close the tab without clicking Generate.
2. **Ask.** Show the user those values and the prompt, and wait for their yes. A yes covers exactly those values.
3. **Generate call.** Open a new tab. Check the model and settings in the panel still match. Type the prompt again, read it back (`image-generator.md`, "Prompt"), and add the references again. Read the cost again. If any value differs from what the user approved, close the tab and ask again. Otherwise click Generate, then find your new card in the feed (`creations.md`, "Telling your new card from an older one") and close the tab.

Never hold a tab open across the question with `aside "<url>"`: it may take over a tab someone else uses.

## Several images

Plan the calls before the first one, and put the plan in the one message `SKILL.md`, "Asking the user once", describes. The plan says how each new card will be told from the others (`creations.md`, "Telling your new card from an older one"); a run tag in the prompt needs the user's yes. An answer to that message covers a tag it stated as a default.

- **The count covers it** (paid work, or Unlimited with + still enabled): one Generate with the count set to the number asked for.
- **The count stops short** (Unlimited often caps it at 1): one Generate per call. Wait until that card has its images before the next Generate (`unlimited.md`, "One batch at a time"). Four images are at least four Generate calls, with waiting calls between them.

A waiting call opens a tab, runs `magnificDownload`, and closes. On `pending`, it may `await sleep(ms)` and call the helper again, with `ms` sized as "The 120 s limit" says; otherwise the next call tries again.

## The 120 s limit

A call that times out stops mid-action. You cannot tell whether its Generate went through. Look for a new card with your prompt in a later call. If none shows after one waiting call, tell the user and let them decide. Never click Generate again on your own.

- **Time every step.** The REPL prints each call's duration (`[ok | <ms>]`). Note it per step: opening the tab, the account check, setting the panel, uploading a reference, the download helper.
- **Budget each call** from those times. Keep the sum well under 120 s, with room for a slow page. When a call would not fit, split it at a step boundary.
- **Click Generate near the end** of its call, and put no long wait after it. Waiting for results belongs in later calls.
- **Size a `sleep`** to what is left of the budget, never to how long a generation takes.

## Dated examples (2026-09-24; not rules)

- Opening the Image Generator on `u1` and reading the panel took 9 s. Opening it and reading the account menu dialog also took 9 s.
- The account menu was a button named "Account menu". Its dialog held the name and email on one text line, then the credits spent and available, and "Plan & billing" with the plan name.
- Opening the Image Generator with the helpers prepended, reading the panel, typing a prompt and running the guard six times as a dry run took 12 s.
- One Seedream 5 Pro image at 1.5K took 30 to 60 s (2026-09-23). The download helper took 7 to 32 s (`creations.md`).
