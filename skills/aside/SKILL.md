---
name: aside
description: 'Use before the first `aside repl`, `aside exec` or `aside --account` command a site skill needs, and whenever an Aside site skill (`aside-magnific`, `aside-shopee-seller`) is loaded. Triggers on "aside repl", "aside profile", "--account u1", "another Aside profile", "aside-browser", "aside skills", "getting a file into the REPL", "setInputFiles escapes the session", "Path escapes", "aside exec 402", "no credits", "tab closed after the call", "keep a tab open across calls", "file URL refused", "fetch failed: other side closed", "setViewportSize", "stale ref", "new Aside skill".'
---

# Aside

Parent skill for every site skill that drives a website through the Aside browser. A child skill describes one site; this skill describes Aside. Both the Aside agent (inside the app, with its own REPL tool) and a coding agent (running `aside repl` from a shell) read it.

**Child skills:** `aside-magnific` (the Magnific web app) and `aside-shopee-seller` (the Shopee Brasil Seller Centre). Each one loads this skill first.

## Iron Laws

### 0. MANDATORY: Load Aside's official skill first, and keep it current

```
BEFORE ANY ASIDE WORK, LOAD `aside-browser`, UPDATED TODAY.
Aside ships it for coding agents. It points to `aside guide` and
`aside guide repl`, the source of truth for the CLI.
```

For a coding agent, before the first Aside command:

1. `command -v aside`. If it prints nothing, STOP and tell the user. Install Aside only after their yes, by the method `aside-browser` or aside.com gives today.
2. `aside --update`. It updates the CLI and the installed `aside-browser` skill.
3. Compare the `version:` in the frontmatter of the installed `aside-browser` SKILL.md with the "Skill version" on the first line of `aside guide`. If they differ, or the skill is missing, run `aside skills install --target <your agent>` (`--help` lists the targets). When the skill was missing, ask the user first.
4. Load `aside-browser` and follow it: read `aside guide` and `aside guide repl` in full. If an update, the install or the guide fails, report the error. Never guess CLI usage.

The Aside agent skips this law: it is already inside Aside. Its shell may lack `aside` on the `PATH`; the binary sits under `~/.aside/cli/`.

### 1. Prefer Aside's built-in site skills

```
WHEN ASIDE SHIPS A SKILL FOR THE SITE, USE IT BEFORE DRIVING THE PAGE BY HAND.
```

Aside keeps its skills per profile under `~/.aside/u/<n>/skills/`: `builtin/` holds the ones Aside ships, `user/` the user's own. `aside skills list` shows only part of `builtin/`, so check both:

- `aside skills list --account <id>` prints the skills usable from `aside repl`. Read one with `aside skills show <name> --account <id>`.
- The folder holds more, such as the site skills under `builtin/site-specific/`, which `aside skills show` refuses. Find one for your site by its host, and read its `SKILL.md` directly: `grep -rl '<host>' ~/.aside/u/*/skills/builtin --include=SKILL.md`.

The list changes with each release, so read it live.

When Aside ships a skill for a site this family also covers, Aside's skill leads. Follow it where the two overlap, and use the family's skill only for what Aside's leaves out. Tell the user, so the family's skill can be cut down to that.

### 2. This family adds only what those leave out

Multi-profile work, one-shot `aside repl` mechanics, and site skills Aside does not ship. Where this family and `aside guide` disagree, the difference is one of mode: `references/terminal.md` says which holds for one-shot calls and which for the Aside agent's REPL.

## Where to read next

| Task | Read |
|---|---|
| The site is logged in on another profile (`u1`, …), or you must find which profile holds it | `references/profiles.md` |
| Driving Aside from a terminal: one-shot `aside repl`, a session that keeps its tab across calls or died mid-step, getting a file in, `aside exec` refusing with 402 | `references/terminal.md` |
| Any REPL work: stale refs, unsupported APIs, checking a local page at a set width, reading snapshots without printing other people's content | `references/repl.md` |
| Adding a new Aside site skill | `references/new-site-skill.md` |

## Rules every Aside site skill shares

1. **Read live.** Sites change labels, menus, fees and limits often. A label quoted in a skill is a dated example, not a selector. Snapshot, find the control by its purpose, use today's label.
2. **Other people's work stays out of your output.** Scope every snapshot to the region you act on, and never open, download or describe someone else's content (`references/repl.md`).
3. **A tab someone else uses is theirs.** List the tabs first. Attach one only where the site skill says to; otherwise open your own, and close it when done.
4. **An action others can see, or one that spends money, needs the user's explicit ask.** Each site skill lists its own such actions and the guard before them.

## Dated examples (2026-09-24; not rules)

- `aside guide` opened with "Aside CLI 1.26.916.1741 · Skill version 3", and the installed `aside-browser` said `version: 3`.
- `aside skills list` printed youtube, google-search, google-gmail, notion and slack, among others. `builtin/` also held skills it did not print, such as x-twitter, and a `site-specific/` folder of site skills (amazon, github, linear, …). `aside skills show amazon` answered "Unknown skill". Each site skill named its hosts under `autoInject.url`. None named Magnific or Shopee.
