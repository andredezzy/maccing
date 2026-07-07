# maccing — repo maintenance
# maccing-notion — agent rules

Instructions for any agent editing this plugin — the `notion-api` skill (`SKILL.md` + `references/`) and the bundled MCP server. Applies to the whole `skills/notion/` subtree. (`AGENTS.md` here is a symlink to this file.)

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

## Dev workflow — iterate via a dev symlink, never reinstall per edit

A marketplace-installed plugin runs from its CACHED copy (`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`), NOT your working tree, so edits go live only on reinstall/republish. Fix: point the active cache dir at the repo. Find the install in `~/.claude/plugins/installed_plugins.json` (`<plugin>@<marketplace>` → `installPath`), move that dir aside as a backup, then `ln -s <repo> <installPath>` — `CLAUDE_PLUGIN_ROOT` resolves through the symlink, so the MCP servers AND skills run live repo code.

- **Takes effect on the next Claude Code restart** — MCP servers launch at session start; there is no hot reload (`/reload-plugins` switches hooks/MCP mid-session).
- **A `/plugin` reinstall/update overwrites the symlink with a real copy** (retiring dev mode) — re-create the symlink to resume. Session-start marketplace reconciliation can also DELETE the cache dir when the marketplace source is stale; sourcing the marketplace as a local directory (`claude plugin marketplace add <repo-path>`) eliminates that class (adopted 2026-07-07).
- **After releasing a new version, RELABEL rather than reinstall** to stay live AND show the new version: symlink a fresh `<new-version>` cache dir → repo, update that install's `installPath` + `version` + `gitCommitSha` in `installed_plugins.json`.
- **Gitignore the in-use marker** (`**/.in_use/`) and keep real secrets OUT of the repo — the symlink makes the repo itself the plugin root.
