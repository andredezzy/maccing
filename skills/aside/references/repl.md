# REPL behaviour the guide leaves out

What held on real sites, for the Aside agent's REPL tool and for one-shot `aside repl` alike. Read `aside guide repl` first; this file only adds to it.

## Refs and snapshots

- **Every snapshot renumbers the refs.** Forms re-render after each input. Snapshot, act, snapshot again. Never reuse a ref across snapshots.
- **Navigate, then read.** A snapshot right after `page.goto()` or a reload, in the same call, has failed with "Cannot find context with specified id". Snapshot in the next call, or after `await sleep(3000)`. If it fails anyway, snapshot again.
- **`page.url()` can lag** after an in-app navigation. Read the current URL from `listBrowserTabs()`.
- **Hidden controls are absent** from a normal snapshot. A control that shows only on hover, or behind a show-more button, needs `showHidden: true` or the button clicked before you conclude it does not exist.
- **Parse a tree with `tree.match()` or `tree.matchAll()`.** `split()`, `slice()` and `substring()` on a tree print a "hiding context" warning.
- **When the snapshot and the page disagree**, read the DOM for the one value you need (`locator.evaluate`), or take `page.screenshot()`. Say which you used.

## APIs

- `getByRole` takes a string `name`, not a regex.
- `getByPlaceholder`, `locator.evaluateHandle` and `xpath=` selectors are unsupported. A CSS attribute selector such as `input[placeholder="…"]` works.
- To pick a list entry, take its ref from a snapshot.
- Keep each call under the 120 s timeout. Wait with `await sleep(ms)` inside the REPL.
- **Helpers.** In the Aside agent's REPL, define a helper on `globalThis` in its own cell, once per task, and call it from later cells. From a terminal, prepend it to every call (`terminal.md`).

## Reading without printing other people's content

A logged-in site often shows work that is not the user's: a shared feed, a team's history, other people's chats or prompts. A whole-page snapshot prints all of it into your context and your output.

- **Scope the snapshot** to the region you act on: `snapshot(page, { interactive: true, selector: '<region>' })`. The site skill names the region.
- **Cut, don't search.** When a control only shows in the whole tree (a dialog appended at its end, say), cut that part out with one `match` and print only it. Searching the whole tree for a label also matches the same words in other people's content.
- **Never open, download or describe** someone else's item, even when it sits beside yours. Find your own by something only you know, such as a phrase from your own input.
