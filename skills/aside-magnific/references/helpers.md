# REPL helpers

Each REPL helper is one file in `scripts/`, defining one function on `globalThis`. Load a helper and the ones it needs:

| File | Defines | Needs |
|---|---|---|
| [`tab-path.js`](../scripts/tab-path.js) | `magnificTabPath()` | — |
| [`unlimited-switch.js`](../scripts/unlimited-switch.js) | `magnificUnlimitedSwitch()` | — |
| [`settings.js`](../scripts/settings.js) | `magnificSettings()` | `tab-path.js`, `unlimited-switch.js` |
| [`generate.js`](../scripts/generate.js) | `magnificGenerate()`, the Unlimited guard | `settings.js`, `tab-path.js`, `unlimited-switch.js` |
| [`scroll-feed.js`](../scripts/scroll-feed.js) | `magnificScrollFeed()` | — |
| [`feed-top.js`](../scripts/feed-top.js) | `magnificFeedTop()`, the anchor for your next card | `scroll-feed.js` |
| [`download.js`](../scripts/download.js) | `magnificDownload()` | `scroll-feed.js` |

A helper looks the others up only when it runs, so any order works as long as all of them are loaded before the first call.

- **In a session that outlives the call** (`../aside/references/terminal.md`, "A session that outlives the call"), concatenate the files you need into one step and send it once, first.
- **From one-shot terminal calls**, concatenate the files before your task's code in every call. For the guard:

  ```bash
  s=<skill dir>/scripts
  aside repl --account <id> "$(cat "$s/tab-path.js" "$s/unlimited-switch.js" "$s/settings.js" "$s/generate.js" task.js)"
  ```
- **In the Aside agent's REPL**, run each file's contents once, in its own cell, before the cell that calls it.
