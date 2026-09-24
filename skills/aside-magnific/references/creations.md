# Creations feed and downloads

## The feed is shared

The Creations feed is the account's history, live. Results from every session and tab land there, so the newest card is not necessarily yours. The feed holds other people's work: never open, download or describe it.

It is virtualized: it renders only the rows near the viewport, and rows re-render and shift as it scrolls. An older card is missing from the snapshot until the feed scrolls to it, and a card near the edge can show only some of its images.

A card is a text line with the prompt, a relative time on its own line ("3 minutes ago"), and one `generic [ref=…]` holding an `image` per result. The prompt line can carry a prefix, such as a wait message while the card runs, so match a phrase inside it, not its start. A card for your prompt with no image yet is still running.

## Download your own results

The helper finds your card by a phrase from your prompt, reads each image's `src` from the same snapshot as the card (the next snapshot renumbers the refs), and fetches the full-size file. An image's `src` ends in `&preview=1`, which serves a small preview. Without the flag, the same signed URL usually serves the full-size file. Drop only the flag: the rest of the query is the signature. The helper never hovers or clicks, so the feed does not re-render under it.

The helper is `magnificDownload`, in [`../scripts/download.js`](../scripts/download.js), with `scroll-feed.js` (`helpers.md`). Call it with the number of images you generated, a `name` unique to this run and scene, the anchor from your Generate call, and the smallest size a full file may have:

```js
console.log(JSON.stringify(await magnificDownload({
  promptPart: '<phrase from your prompt>', count: 2, name: '<run tag>-<scene>',
  after: '<key from magnificFeedTop()>', minLongSide: 1500,
})));
```

It saves `<name>-1.<ext>`, `<name>-2.<ext>` and so on. The same `name` twice gives the same file names: the second call overwrites the first in a shared session folder, and in the folder you copy them to.

- **`after`** is the anchor (see "Telling your new card from an older one"). Pass `null` only when no anchor was taken, and then only with a phrase no other card holds.
- **`minLongSide`** is the smallest long side, in pixels, a full-size file may have. Take it from the resolution you generated at: about 1000 px per "K" (1.5K → 1500). That floor is inferred from square images (dated examples below); other aspects and models are unchecked. A file below it is a preview: the helper does not save it. If a file that is plainly full size fails it, measure the file and tell the user rather than lowering the floor to pass.

What it returns:

- `ok: true`: the files are in the REPL session folder, listed in `saved` with their pixel size and `key`. Copy them with Bash to where the user wants them, and report that size: a card's quality label and its details panel can both disagree with the file. From a terminal the folder outlives the call, so the copy can run after it.
- `reason: 'pending'`: your card has no image yet. Wait and call again. Size each wait to what is left of the call's 120 s budget, as `terminal-runs.md`, "The 120 s limit", says; in the Aside agent's REPL the same budget holds per cell. If it is still pending after a few minutes, tell the user. Never regenerate.
- `found n of m images`: the feed showed only part of the card. Call again. If it repeats, check `count` against what you generated.
- `no card … above the anchor`: nothing newer than your Generate holds the phrase. Right after the click, the card may not show yet: call again once. If it repeats, the Generate may not have gone through: tell the user.
- `no card with this prompt in the feed` (no anchor): check the phrase against what you typed.
- `… is below … px, a preview; not saved`: the full-size URL served a preview. Call again after a minute. If it repeats, get the file through the MCP ("The full-size file through the MCP" below); without the MCP, tell the user. Never keep the preview as the result.
- `size unreadable`: the bytes are not PNG, JPEG or WebP. Tell the user the content type it names.

The helper ends a card at the next text line that is not a relative time, and knows a relative time by its trailing "ago". If it keeps saying pending while your card shows images, that line has changed: read the card's lines and adjust the script's `isTime`.

## Telling your new card from an older one

The same phrase can sit on older cards, for example when the same prompt ran earlier on another model. The card's relative time ("46 seconds ago") cannot tell them apart: it can stay frozen long after the card was made.

**Take an anchor in the call that clicks Generate.** Just before the click, call `magnificFeedTop()` ([`../scripts/feed-top.js`](../scripts/feed-top.js)) and print the key it returns: the feed's top image, without its query string. The feed puts new cards on top, so your card is above that image, and every older card is below it. Pass the key to `magnificDownload` as `after`. Keep it with the run's other values: every later waiting call needs it.

- The anchor can be anyone's image. Its key names a file, not its content; print nothing else about it.
- `null` from `magnificFeedTop()` means the feed showed no image. Snapshot the feed region before you click, and fix the helper or stop.
- Untested as of 2026-09-24: no run has used the anchor yet. On its first use, also give the prompt a phrase no feed card holds, and check the anchor's card is the one that phrase finds with `after: null`.

**Keep a phrase no other card holds** as well, when you can: a short run tag in each prompt (agreed with the user, `asking-the-user.md`), or prompts that already differ. Another session's card can also land above the anchor, and the phrase is what tells it from yours.

When neither fits, tell the user you cannot tell the cards apart, and let them choose.

The hover "Download" button also works and saves to `~/Downloads`, but hovering re-renders the feed and stales every ref, so the helper leaves it alone.

## The Magnific MCP

The Magnific MCP exists for coding agents; the Aside agent cannot reach it. Its generation tools always spend credits, even on models the plan covers without limit. Its read tools, such as `creations_search` and `creations_get`, spend none. It can be signed in to another account than the web app: before trusting any MCP result, compare the email `account_profile` returns with the one the account check read (`SKILL.md`, "The account check"). If they differ, leave the MCP out and tell the user.

### The full-size file through the MCP

When the web URL keeps serving a preview, `creations_get` returns the creation's `url` at full resolution, read-only. Find the creation first with `creations_search`: filter by `dateStart` a little before your Generate, keep the default newest-first order, and match the prompt and model in the results yourself. Do not trust `dateEnd` to cut at a time of day (dated examples). Fetch the `url`, measure the file, and hold it to the same `minLongSide`. Show nothing of other people's creations the search returns.

## Dated examples (2026-09-23 unless marked; not rules)

- A Seedream 5 Pro image at 1.5K downloaded as a 1536×1536 PNG, while its card's details reported 2048 px. Its preview was an 800×800 JPEG. The URL without `&preview=1` returned the same bytes as the Download button.
- The helper found a card about forty cards down the feed in 23 s, and reported a missing prompt in 32 s. Asked for 3 images on a 2-image card, it returned "found 2 of 3" in 7 s. It has not been run on a card still running; those showed "Hang tight" in their text.
- A re-run prompt already in the feed made the helper match the older card.
- 2026-09-24: a card's relative time still read "46 seconds ago" long after the card was made. A unique prompt per image found each card in that run.
- 2026-09-24: an older card from the same prompt on another model matched before the new one.
- 2026-09-24: the URL without `&preview=1` sometimes served an 800 px preview instead of the full file. Changing the query further gave 403. The MCP's `creations_get` `url` gave the full-size file. Why the web URL served a preview was not found.
- 2026-09-24, seen once: `creations_search` with a `dateEnd` holding a time of day seemed to ignore the time and keep the whole day.
