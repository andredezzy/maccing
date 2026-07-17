# maccing — repo maintenance
# maccing-notion — agent rules

Instructions for any agent editing this plugin — the `notion` skill (`SKILL.md` + `references/`) and the bundled MCP server. Applies to the whole `skills/notion/` subtree. (`AGENTS.md` here is a symlink to this file.)

## Keep the skill WORKSPACE-AGNOSTIC — MANDATORY

This is a **general-purpose** Notion-API engineering reference, reusable by anyone. It must read as API/technique documentation — **never** as a tour of one person's Notion.

**Never write, into any skill file:**

- **A specific workspace's proper nouns** — the real NAMES of a user's pages, databases, or properties (e.g. a database literally named "Muscle Groups", a property "To beat", a hub "Nutrition", a chart "Net Worth Over Time"). Replace with **generic descriptive common nouns**: *a strength-log DB*, *an `Actual` / `Target` rollup pair*, *an inline navigation DB*, *a daily-totals collection*, *a hub page*.
- **Real ids** — collection / data-source / page / block / property ids, and ESPECIALLY the **space id** (it is a secret — never echo or commit it). Always use placeholders: `<ds>`, `<propId>`, `<pageId>`, `<space>`, `<activeUser>`.

**Live-verified examples STAY — anonymize the subject, keep the proof.** A `live-verified YYYY-MM-DD` marker plus its mechanics are the skill's best feature (they prove a technique was tested, not theorized). Keep the date and every API detail; swap only the specific subject noun:

> ✗ `Live-verified 2026-06-14 — moved an inline "Gym Navigation" DB to the top of its page`
> ✓ `Live-verified 2026-06-14 — moved an inline navigation DB to the top of its page`

Illustrative **values** are fine — `maxValue: 2200`, `prop("Actual") / prop("Target") * 100`, `format: "real"` teach the shape without naming anyone's workspace. The line to hold: **generic role, never a real name or id.**

**The test is a grep.** Before committing any skill edit, grep your diff for workspace proper nouns and real ids — there must be zero. (Icon-catalog entries in `icon-names.md` are Notion's own icon names, not a workspace — those are fine.)

## Skill edits are test-driven

Per the user's global rules, every `SKILL.md` / reference edit goes through `superpowers:writing-skills` (RED→GREEN before the edit). Pure content-anonymization is the one exception — its "failing test" is the agnostic grep above.

## Dev workflow — the marketplace runs straight from the repo; no cache copy or symlink needed

The `maccing` marketplace is registered `source: directory` (`~/.claude/plugins/known_marketplaces.json`), pointing straight at this repo (adopted 2026-07-07) — so skills and MCP servers already run live from the working tree, edit-to-live with nothing to point a symlink at. `installed_plugins.json`'s `installPath` for `maccing@maccing` can point at a cache path that doesn't even exist on disk (live-verified 2026-07-17) and the plugin still loads fine — that field is a cosmetic version label, not the actual load path.

- **`/reload-plugins` does NOT respawn a RUNNING plugin MCP server** (live-verified 2026-07-17) — mid-session it re-reads hooks/skills, but a server process already up keeps running on its already-loaded env and code. To pick up a new env var or server-code change: find the session's plugin-server process (its `ppid` is the session's `claude` pid), kill it, then run `/reload-plugins` — a DEAD server IS respawned fresh with current env/code; `/reload-plugins` alone, against a still-running server, changes nothing.
- **The cache-dir relabel-after-release recipe is optional/cosmetic, not required** (live-verified 2026-07-17) — session-start marketplace reconciliation sweeps the cache dir regardless of any hand-made relabel, so it can't reliably keep a symlink alive. Run it only if you want `/plugin`'s version display to match the latest release: symlink a fresh `<new-version>` cache dir → repo, update that install's `installPath` + `version` + `gitCommitSha` in `installed_plugins.json`. It has no effect on which code actually runs.
- **Gitignore the in-use marker** (`**/.in_use/`) and keep real secrets OUT of the repo — the directory-source marketplace makes the repo itself the plugin root.
