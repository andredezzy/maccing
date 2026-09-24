---
name: aside
description: Use before the first `aside repl`, `aside exec` or `aside --account` command a site skill needs, and whenever an Aside site skill (`aside-magnific`, `aside-shopee-seller`) is loaded. Triggers on "aside repl", "aside profile", "--account u1", "another Aside profile", "getting a file into the REPL", "setInputFiles escapes the session", "Path escapes", "aside exec 402", "no credits", "tab closed after the call", "stale ref", "new Aside skill".
---

# Aside

Parent skill for every site skill that drives a website through the Aside browser. Aside is the engine and a hard requirement: a child skill describes one site, this skill describes Aside. Both the Aside agent (inside the app, with its own REPL tool) and a coding agent (running `aside repl` from a shell) read it.

**Child skills:** `aside-magnific` (the Magnific web app) and `aside-shopee-seller` (the Shopee Brasil Seller Centre). Each one loads this skill first.

## Aside is required

```
MANDATORY for a coding agent, before the first Aside command:
1. `command -v aside`. If Aside is missing, STOP and tell the user. Install it only
   after their yes, with the installer `aside --help` or aside.com names today
   (2026-09-23: `curl -fsSL https://releases.aside.com/install.sh | bash`).
2. `aside --update`, then read `aside guide` and `aside guide repl` in full.
   They are the source of truth for the CLI. This skill adds only what they
   leave out, or get wrong for one-shot calls.
3. If the update or the guide fails, report the error. Never guess CLI usage.
```

The Aside agent skips this block: it is already inside Aside. Its shell may lack `aside` on the `PATH`; the binary sits under `~/.aside/cli/`.

## Where to read next

| Task | Read |
|---|---|
| The site is logged in on another profile (`u1`, …), or you must find which profile holds it | `references/profiles.md` |
| Driving Aside from a terminal: one-shot `aside repl`, getting a file in, tabs that close, `aside exec` refusing with 402 | `references/terminal.md` |
| Any REPL work: stale refs, unsupported APIs, reading snapshots without printing other people's content | `references/repl.md` |
| Adding a new Aside site skill | `references/new-site-skill.md` |

## Rules every Aside site skill shares

1. **Read live.** Sites change labels, menus, fees and limits often. A label quoted in a skill is a dated example, not a selector. Snapshot, find the control by its purpose, use today's label.
2. **Other people's work stays out of your output.** Scope every snapshot to the region you act on, and never open, download or describe someone else's content (`references/repl.md`).
3. **A tab someone else uses is theirs.** List the tabs first. Attach one only where the site skill says to; otherwise open your own, and close it when done.
4. **An action others can see, or one that spends money, needs the user's explicit ask.** Each site skill lists its own such actions and the guard before them.
