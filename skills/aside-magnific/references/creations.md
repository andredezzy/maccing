# Creations feed and downloads

## The feed is shared

The Creations feed is the account's history, live. Results from every session and tab land there, so the newest card is not necessarily yours. The feed holds other people's work: never open, download or describe it.

It is virtualized: it renders only the rows near the viewport, and rows re-render and shift as it scrolls. An older card is missing from the snapshot until the feed scrolls to it, and a card near the edge can show only some of its images.

A card is a text line with the prompt, a relative time on its own line ("3 minutes ago"), and one `generic [ref=…]` holding an `image` per result. The prompt line can carry a prefix, such as a wait message while the card runs, so match a phrase inside it, not its start. A card for your prompt with no image yet is still running.

## Download your own results

The helper finds your card by a phrase from your prompt, reads each image's `src` from the same snapshot as the card (the next snapshot renumbers the refs), and fetches the full-size file. An image's `src` ends in `&preview=1`, which serves a small JPEG; without the flag, the same signed URL serves the full-size PNG. It never hovers or clicks, so the feed does not re-render under it.

Define it alone in its own cell:

```js
// Finds your card by a phrase from your prompt and saves its full-size images
// into the REPL session folder. Reads and fetches only: no hover, no clicks.
globalThis.magnificDownload = async function ({ promptPart, count, name = 'magnific', maxScrolls = 40 }) {
  // A relative time ("3 minutes ago") sits on its own text line under the prompt.
  const isTime = (text) => / ago$/.test(text);
  const findCard = async () => {
    const lines = [...(await snapshot(page)).tree.matchAll(/[^\n]+/g)].map((m) => m[0]);
    const start = lines.findIndex((l) => /^\s*- text: "/.test(l) && l.includes(promptPart));
    if (start < 0) return null;
    const indent = lines[start].match(/^\s*/)[0];
    let end = start + 1;
    let age = null;
    for (; end < lines.length; end++) {
      const text = lines[end].startsWith(indent + '- text: "') && lines[end].slice(indent.length + 9, -1);
      if (text !== false && !isTime(text)) break;
      if (text !== false) age = text;
    }
    const card = lines.slice(start, end).join('\n');
    // Read every src now: the next snapshot renumbers the refs.
    const sources = [];
    for (const m of card.matchAll(/generic \[ref=(e\d+)\]:\n\s+- image/g)) {
      sources.push(await page.locator(m[1]).evaluate((el) => el.querySelector('img')?.src ?? null).catch(() => null));
    }
    return { card, age, sources: sources.filter(Boolean) };
  };
  // Scrolls the feed by a share of its height; 0 goes back to the top.
  const scrollFeed = async (share) => {
    const any = (await snapshot(page)).tree.match(/generic \[ref=(e\d+)\]:\n\s+- image/)?.[1];
    if (!any) return;
    await page.locator(any).evaluate((el, share) => {
      let box = el;
      while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
      if (box) box.scrollTop = share === 0 ? 0 : box.scrollTop + box.clientHeight * share;
    }, share);
    await sleep(600);
  };

  await scrollFeed(0);
  let found = await findCard();
  // The feed is virtualized: a card can be missing, or show only some images.
  // Once the card shows, a few small scrolls bring the rest of it in.
  for (let i = 0, near = 0; i < maxScrolls && near < 5 && !(found && found.sources.length >= count); i++) {
    if (found) near++;
    await scrollFeed(found ? 0.3 : 0.8);
    found = (await findCard()) ?? found;
  }
  if (!found) return { ok: false, reason: 'no card with this prompt in the feed' };
  if (found.sources.length === 0) return { ok: false, reason: 'pending', age: found.age };
  if (found.sources.length < count) return { ok: false, reason: `found ${found.sources.length} of ${count} images; call again` };

  const saved = [];
  for (let i = 0; i < found.sources.length; i++) {
    // Without &preview=1 the same signed URL serves the full-size file.
    const res = await fetch(found.sources[i].replace('&preview=1', ''));
    if (!res.ok) return { ok: false, reason: `fetch ${res.status}`, saved };
    const file = `./${name}-${i + 1}.png`;
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
    saved.push({ file: path.join(pwd, file), type: res.headers.get('content-type') });
  }
  return { ok: true, age: found.age, saved };
};
```

Call it with the number of images you generated:

```js
console.log(JSON.stringify(await magnificDownload({ promptPart: '<phrase from your prompt>', count: 2, name: '<file prefix>' })));
```

Pick a phrase no other card shares. If the prompt repeats one already in the feed, follow "Repeated prompts" below.

- `ok: true`: the files are in the REPL session folder, listed in `saved`. Copy them with Bash to where the user wants them. Measure each file (`file`, or `sips -g pixelWidth -g pixelHeight`) and report that size: a card's quality label and its details panel can both disagree with the file. From a terminal the folder outlives the call, so the copy can run after it.
- `reason: 'pending'`: wait (`await sleep(60000)`) and call again. If the card is still pending after a few minutes, tell the user. Never regenerate.
- `found n of m images`: the feed showed only part of the card. Call again. If it repeats, check `count` against what you generated.
- `no card`: the feed never showed your prompt. Check the phrase against what you typed.

The helper ends a card at the next text line that is not a relative time, and knows a relative time by its trailing "ago". If it keeps saying pending while your card shows images, that line has changed: read the card's lines and adjust `isTime`.

## Repeated prompts

The helper takes the first card from the top that holds your phrase. When an older card carries the same prompt, that can be the older card, for example while yours has not rendered yet. Each result carries the card's relative time as `age`.

1. Right after the Generate click, in the same call, snapshot the feed and find the card that appeared after the click: your prompt, no image yet, at the top. Note its time.
2. Download only after that card was seen. Check that the returned `age` fits the time since your click. An older `age` means the helper matched an earlier card: discard those files and call again later.

A coding agent with the Magnific MCP can find the new creation there instead, read-only and without credits: `creations_search`, then `creations_get`. The Aside agent cannot reach the MCP.

The hover "Download" button also works and saves to `~/Downloads`, but hovering re-renders the feed and stales every ref, so the helper leaves it alone.

## Dated examples (2026-09-23)

- A Seedream 5 Pro image at 1.5K downloaded as a 1536×1536 PNG, while its card's details reported 2048 px. Its preview was an 800×800 JPEG. The URL without `&preview=1` returned the same bytes as the Download button.
- The helper found a card about forty cards down the feed in 23 s, and reported a missing prompt in 32 s. Asked for 3 images on a 2-image card, it returned "found 2 of 3" in 7 s. It has not been run on a card still running; those showed "Hang tight" in their text.
- A re-run prompt already in the feed made the helper match the older card.
