# Driving Aside from a terminal

What holds when a coding agent runs `aside repl "<code>"` from a shell, where each call stands alone. The Aside agent's own REPL tool keeps one session across cells, so most of this does not apply to it; it applies again the moment the Aside agent shells out to `aside repl --account <id>`.

## One call is one session

`aside guide repl` says `const` and `let` bindings persist across calls. That holds for the Aside agent's REPL tool, not for one-shot calls from a shell.

- **Nothing carries over.** Bindings, `globalThis` helpers, `page` and every ref are gone in the next call. Where a site skill says to define a helper once in its own cell, prepend the helper's file to every call instead: `aside repl "$(cat helpers.js task.js)"`.
- **Refs die with the call.** Re-attach the tab by its `targetId`, then snapshot and act on the new refs inside the same call. A ref copied from an earlier call's output points at whatever holds that number now; one opened a different page in a new tab.
- **Each call gets a new session folder** (the `pwd` global). Files written there stay on disk after the call, so the shell can copy them out, but the next call cannot see them.
- **A tab opened with `openTab()` closes when the call ends.** So does a tab it opens in turn, such as a link with `target=_blank`. For a quick task in a tab of your own, open, act, verify and close inside one call, under the 120 s timeout. For work across many calls, keep one session alive instead (next section).
- **`aside "<url>"` may navigate an existing tab** of that site instead of opening a new one. List the tabs afterwards and check that the tab you use is yours. It also needs Aside credits (see "When `aside exec` has no credits").

## A session that outlives the call

A long run, such as many generations with waits between them, needs a tab that stays open. Run one `aside repl` in the background, fed by a file, and send it one step at a time. Its tab, its `globalThis` helpers and its session folder then last until you stop it.

1. **Start** it once, with a folder of your own:

   ```bash
   dir=<absolute scratch folder>; mkdir -p "$dir"; : > "$dir/cmds.txt"
   tail -n +1 -f "$dir/cmds.txt" | aside repl --account <id> > "$dir/out.log" 2>&1 &
   ```

   `out.log` then starts with `account:` and `sessionDir:` lines. Check the account before anything else.
2. **Send a step** with [`../scripts/repl-send.sh`](../scripts/repl-send.sh): `bash <skill dir>/scripts/repl-send.sh "$dir" step.js`. It copies the file into the session folder, runs it, waits for it to finish and prints only its output, with the `[ok | <ms>]` timing. Each step runs in its own function: keep what later steps need on `globalThis`, such as your tab (`globalThis.myTab = await openTab(url)`). Load the site skill's helpers once, as the first step.
3. **Every step** starts by checking your tab is still there (`listBrowserTabs()`, by `targetId`), then sets `page = myTab`: helpers act on `page`. Another session, or the site itself, can close or move your tab. If it is gone, open a new one; never attach someone else's.
4. **Stop** it at the end of the task: a step that closes your tab with `closeTab(myTab)` (this session opened it, so it closes), then:

   ```bash
   echo exit >> "$dir/cmds.txt"; pkill -f "tail -n +1 -f $dir/cmds.txt"
   ```

The session folder (`sessionDir`) stays put, so the shell can copy a file into it for a later step, such as an upload. A session with no step running holds no one else's tab, so it is safe to keep across a question to the user.

**One step at a time, each well under 120 s.**

- Send one step and wait for it. A line that reaches the REPL while it is busy can be lost, so `repl-send.sh` puts each step on one line.
- A shell loop that sends steps back to back in the background is a sender too. Stop it before you send any other step.
- A step that runs past the call limit kills the whole session: it ends with "fetch failed: other side closed" or "Aside isn't running on this machine", and its tab closes. Aside itself keeps running, so the next one-shot call works. To wait on something slow, poll inside a step for at most 60 to 90 s, return, and loop from the shell.

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
- 2026-09-24: a background session started as above kept its tab and its `globalThis` values across separate shell calls, and a step that threw still printed its end marker. A marker sent on its own line while a step ran was lost. `exit` stopped the REPL, but `tail` stayed until killed.
- 2026-09-24: in a one-shot call, `closeTab()` on a tab attached with `attachBrowserTab()` only detached it; the tab stayed open. A tab opened by `openTab()` in an earlier session closed with `page.evaluate(() => window.close())`.
- 2026-09-25: twice, a background session step that polled with `sleep` for about 100 to 125 s ended with "fetch failed: other side closed / Aside isn't running on this machine". The session died and its tab closed. Steps of about 90 s survived, Aside stayed up, and the next one-shot call worked.
