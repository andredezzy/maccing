# Creations feed and downloads

## The feed is shared

The Creations feed is the account's history, live. Results from every session and tab land there, so the newest card is not necessarily yours. The feed holds other people's work: never open, download or describe it.

It is virtualized: it renders only the rows near the viewport, and rows re-render and shift as it scrolls. An older card is missing from the snapshot until the feed scrolls to it, and a card near the edge can show only some of its images.

A card is a text line with the prompt, a relative time on its own line ("3 minutes ago"), and one `generic [ref=…]` holding an `image` per result. The prompt line can carry a prefix, such as a wait message while the card runs, so match a phrase inside it, not its start. A card for your prompt with no image yet is still running.

## Download your own results

The helper finds your card by a phrase from your prompt, reads each image's `src` from the same snapshot as the card (the next snapshot renumbers the refs), and fetches the full-size file. An image's `src` ends in `&preview=1`, which serves a small preview; without the flag, the same signed URL serves the full-size file. It never hovers or clicks, so the feed does not re-render under it.

The helper is `magnificDownload`, in [`../scripts/download.js`](../scripts/download.js). It needs no other helper. Call it with the number of images you generated, and a `name` unique to this run and scene:

```js
console.log(JSON.stringify(await magnificDownload({ promptPart: '<phrase from your prompt>', count: 2, name: '<run tag>-<scene>' })));
```

It saves `<name>-1.<ext>`, `<name>-2.<ext>` and so on. The same `name` twice gives the same file names: the second call overwrites the first in a shared session folder, and in the folder you copy them to. It refuses to run without a `name`.

Pick a phrase no other card shares. If the prompt repeats one already in the feed, follow "Telling your new card from an older one" below.

- `ok: true`: the files are in the REPL session folder, listed in `saved`, each named with the extension its bytes show (`.bin` when neither the bytes nor the content type name a format: check it with `file` before you rename it). Copy them with Bash to where the user wants them. Measure each file (`file`, or `sips -g pixelWidth -g pixelHeight`) and report that size: a card's quality label and its details panel can both disagree with the file. From a terminal the folder outlives the call, so the copy can run after it.
- `reason: 'pending'`: wait and call again. Size each wait to what is left of the call's 120 s budget, as `terminal-runs.md`, "The 120 s limit", says; in the Aside agent's REPL the same budget holds per cell. If the card is still pending after a few minutes, tell the user. Never regenerate.
- `found n of m images`: the feed showed only part of the card. Call again. If it repeats, check `count` against what you generated.
- `no card`: the feed never showed your prompt. Check the phrase against what you typed.

The helper ends a card at the next text line that is not a relative time, and knows a relative time by its trailing "ago". If it keeps saying pending while your card shows images, that line has changed: read the card's lines and adjust the script's `isTime`.

## Telling your new card from an older one

The helper takes the first card from the top that holds your phrase. When an older card carries the same phrase, that can be the older card, for example while yours has not rendered yet. The card's relative time ("46 seconds ago") cannot tell them apart: it can stay frozen long after the card was made.

Use one of these, in this order of preference:

1. **A prompt no other card holds.** Before the run, agree with the user on a short run tag to put in each prompt, or check the prompts already differ from each other and from the feed. Then `promptPart` matches only your card. This is the method that has worked in a real run.
2. **The feed's top card before Generate.** In the call that clicks Generate, just before the click, note the top card without printing its content: its first image's `src` without the query string. After the click, your card is the first new card above it. Untested so far: check it on a card you know before relying on it.
3. **The Magnific MCP**, for a coding agent that has it: find the new creation read-only with `creations_search`, then `creations_get`. It spends no credits. First check the MCP is signed in to the same account ("The Magnific MCP" below). The Aside agent cannot reach the MCP. Untested for this purpose so far.

When none of these fits, tell the user you cannot tell the cards apart, and let them choose.

The hover "Download" button also works and saves to `~/Downloads`, but hovering re-renders the feed and stales every ref, so the helper leaves it alone.

## The Magnific MCP

The Magnific MCP exists for coding agents; the Aside agent cannot reach it. Its generation tools always spend credits, even on models the plan covers without limit. Its read tools, such as `creations_search` and `creations_get`, spend none. It can be signed in to another account than the web app: before trusting any MCP result, compare the email `account_profile` returns with the one the account check read (`SKILL.md`, "The account check"). If they differ, leave the MCP out and tell the user.

## Dated examples (2026-09-23 unless marked; not rules)

- A Seedream 5 Pro image at 1.5K downloaded as a 1536×1536 PNG, while its card's details reported 2048 px. Its preview was an 800×800 JPEG. The URL without `&preview=1` returned the same bytes as the Download button.
- The helper found a card about forty cards down the feed in 23 s, and reported a missing prompt in 32 s. Asked for 3 images on a 2-image card, it returned "found 2 of 3" in 7 s. It has not been run on a card still running; those showed "Hang tight" in their text.
- A re-run prompt already in the feed made the helper match the older card.
- 2026-09-24: a card's relative time still read "46 seconds ago" long after the card was made. A unique prompt per image found each card in that run.
