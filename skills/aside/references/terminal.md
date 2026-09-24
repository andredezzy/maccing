# Driving Aside from a terminal

What holds when a coding agent runs `aside repl "<code>"` from a shell, where each call stands alone. The Aside agent's own REPL tool keeps one session across cells, so most of this does not apply to it; it applies again the moment the Aside agent shells out to `aside repl --account <id>`.

## One call is one session

`aside guide repl` says `const` and `let` bindings persist across calls. That holds for the Aside agent's REPL tool, not for one-shot calls from a shell.

- **Nothing carries over.** Bindings, `globalThis` helpers, `page` and every ref are gone in the next call. Where a site skill says to define a helper once in its own cell, prepend the helper's file to every call instead: `aside repl "$(cat helpers.js task.js)"`.
- **Refs die with the call.** Re-attach the tab by its `targetId`, then snapshot and act on the new refs inside the same call. A ref copied from an earlier call's output points at whatever holds that number now; one opened a different page in a new tab.
- **Each call gets a new session folder** (the `pwd` global). Files written there stay on disk after the call, so the shell can copy them out, but the next call cannot see them.
- **A tab opened with `openTab()` closes when the call ends.** For work across calls, attach an existing tab. For a quick task in a tab of your own, open, act, verify and close inside one call, under the 120 s timeout.
- **`aside "<url>"` may navigate an existing tab** of that site instead of opening a new one. List the tabs afterwards and check that the tab you use is yours.

## Getting a file into the REPL

`fs`, `setInputFiles` and a file chooser's `setFiles` reach only the session folder. Any other path fails with "Path escapes Project and session roots" or "escapes the session directory". Bring the file in inside the same call that uses it:

- **Small files** (images around 100 KB): pass the bytes as base64 in the code and write them with `await fs.writeFile('./img.jpg', Buffer.from(b64, 'base64'))`. One file per call: the whole code travels as one command-line argument, whose size limit is `getconf ARG_MAX`.
- **Larger files** (a video, or an image well over 100 KB): serve the folder from a local server outside Aside, then fetch it in the call.

  ```bash
  python3 -m http.server 18977 --bind 127.0.0.1 --directory <folder> &   # stop it when done
  ```

  ```js
  const res = await fetch('http://127.0.0.1:18977/<file>');
  await fs.writeFile('./<file>', Buffer.from(await res.arrayBuffer()));
  ```

The Aside agent's own session folder is stable, so it can `cp` a file there with its shell instead.

## Getting a file out

Write it into the session folder (`./<name>`), print `path.join(pwd, '<name>')`, and copy it with the shell after the call. The folder outlives the call.

## When `aside exec` has no credits

`aside exec` refuses with a 402 when the Aside account has no credits, and `aside "<url>"` then cannot open a tab that outlasts the call either. `aside repl` still works: open, act, verify and close inside one call. `open -a Aside <url>` opens the URL in whichever profile window is frontmost, which you can neither pick nor drive, so leave it out.

## Quoting

Put the JavaScript in a file and pass it with `"$(cat file.js)"`. Inline code inside double quotes breaks: the shell expands `$`, and a regex literal can turn into "invalid regular expression flags". A quoted heredoc (`<<'EOF'`) keeps the file exact.

Pass long text, such as a description, as base64 and decode it in the REPL: `Buffer.from(b64, 'base64').toString('utf8')`.

## Dated examples (2026-09-23; not rules)

- A 4.8 MB MP4 came in through the local server. Images of about 100 KB came in as base64, one per call. `ARG_MAX` was 1048576.
- `aside exec` answered 402 for lack of credits, and one-shot `aside repl` calls did the whole job.
