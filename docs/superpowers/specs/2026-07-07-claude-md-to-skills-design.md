# CLAUDE.md → maccing skills + single-plugin restructure — Design

Date: 2026-07-07
Status: awaiting user approval

## Goal

Transform the genuinely shareable engineering rules from the private `~/.claude/CLAUDE.md` into public skills in the maccing repo, and restructure maccing from a three-plugin marketplace into a single plugin with a root-level `skills/` directory, matching the shape of `mattpocock/skills` and `obra/superpowers`.

## Decisions (user-approved)

1. **Skills replace CLAUDE.md** — shareable rule domains move into maccing skills and leave the private CLAUDE.md; only personally-owned material stays private.
2. **Shareable rules only** — nothing personally André's becomes a public skill. The test is not "is this rule good?" but "is this rule mine or everyone's?" (e.g. "prefer Bun" is personal; "respect the existing package manager" is universal).
3. **Full restructure to a single plugin** — one plugin named `maccing`, root-level `skills/`, `marketplace.json` kept with one entry pointing at `./` (superpowers shape), so `/plugin marketplace add andredezzy/maccing` keeps working.
4. **Bucketed `skills/` layout** — mattpocock-style domain buckets, not a flat namespace.
5. **Skill granularity: one skill per CLAUDE.md domain** (~9), each <500 words, individually pressure-tested.
6. **Maestri team: mind + writer + fresh verifiers** — Claude is maestro/mind and source of truth; one Writer recruit executes; disposable Verifier recruits are fresh-context test subjects.
7. **Naming scheme: superpowers gerund-process school**, applied wholesale — validated against skills.sh top-10, Anthropic official skills, mattpocock, and superpowers corpora; no collisions.

## Target repo structure

```
maccing/
├── .claude-plugin/
│   ├── plugin.json          ← single plugin "maccing"; skills declared with explicit bucket paths
│   └── marketplace.json     ← marketplace "maccing", one entry, source "./"
├── skills/
│   ├── engineering/         ← NEW (see below)
│   ├── growth/              ← moved from plugins/maccing-growth/skills/ (meta/, platforms/ nesting preserved)
│   ├── notion/notion-api/   ← moved from plugins/maccing-notion/skills/notion-api/
│   └── google-workspace/google-workspace/ ← moved from plugins/google-workspace/skills/google-workspace/
├── commands/growth.md       ← moved from plugins/maccing-growth/commands/
├── mcp/
│   ├── notion/              ← moved from plugins/maccing-notion/mcp/
│   └── google-workspace/    ← moved from plugins/google-workspace/mcp/
├── .mcp.json                ← merged; server keys stay `notion` and `workspace`
├── docs/                    ← superpowers/{specs,plans} unchanged
├── CLAUDE.md                ← NEW: repo-maintenance rules (both reference repos have one)
└── README.md                ← rewritten: single-plugin install + skills.sh
```

- Per-bucket `README.md` files list each bucket's skills (mattpocock pattern); former plugin READMEs' setup content (Notion token, Google OAuth) moves into the owning bucket's README, so `docs/` stays reserved for specs/plans.
- Plugin-level `AGENTS.md`/`CLAUDE.md` in maccing-notion merge into the repo-root `CLAUDE.md`.
- Version resets to a single `1.0.0`.
- No CI/changesets — manual version bumps stay (simplicity; matches current practice).

## The engineering bucket

| Skill | Source CLAUDE.md section | Type | Notes |
|---|---|---|---|
| `designing-for-dx` | DX — TOP PRIORITY | Pattern | Description must carry: developer experience, simplicity, over-engineering, cognitive load, discoverability, open/closed, local reasoning |
| `modeling-domains` | Data Model & Architecture | Pattern | Description must list: domain mirroring, registries/engines, middleware, zero-ceremony init, no tech mixing, no redundant fields |
| `organizing-code` | Code Organization + "never silently swallow an error" (moved from Problem-Solving) | Pattern | `errors/` folder, one concern per file, no pass-throughs, no barrels, test-file conventions, circular imports, env var ownership |
| `naming` | Naming & Enums | Pattern | Enum preference + casing, precision, whole-behavior naming, truncations, no Base/Contract |
| `formatting-code` | Formatting & Aesthetics | Reference | Description MUST open with "beyond what formatters enforce" or agents defer to Biome/Prettier and skip it |
| `researching-before-coding` | Problem-Solving (minus error rule) | Discipline | Web-search mandate, research before fixes, diagnose before prescribing, dimension enumeration |
| `composing-ui` | UI & Components | Pattern | Component composition, compound components, props rules, className, forms stack, sentence case |
| `passing-quality-gates` | Quality Gates + Git & Commits | Discipline | Zero lint/unused/build warnings; commit style as a "before you commit" step |
| `respecting-lockfiles` | Runtime & Tooling (universal half only) | Discipline | **CONDITIONAL**: written only if RED baseline shows fresh agents actually violate lockfile discipline; otherwise dropped entirely |

Skill authoring rules (from superpowers:writing-skills): `Use when…` trigger-only descriptions (no workflow summaries), third person, <500-word bodies, keyword-rich, verb-first gerund names, supporting files only for heavy reference or tools.

### Stays in the private ~/.claude/CLAUDE.md

- Browser Automation — Aside (personal tooling)
- Claude Code native commands (`/goal` etc.)
- Plugin dev-symlink workflow (personal paths)
- My Accounts
- Bun preference for greenfield work (personal default) + Bun built-ins guidance
- The skill-writing-skill mandate
- "How to Read These Rules" preamble, rewritten shorter
- NEW bridge line: the maccing engineering skills are mandatory standing rules — invoke the matching one before designing/coding

A superpowers-style SessionStart hook is deliberately deferred (YAGNI) until description-based invocation proves insufficient.

## Maestri team + per-skill TDD

- **Maestro (Claude, this session):** designs every skill, writes numbered command-level order files to scratchpad, reviews every diff, is the source of truth. Never rules on a recruit's diagnosis without verifying in source personally.
- **Writer (one recruit):** `claude --model claude-sonnet-5 --dangerously-skip-permissions`. Sole executor of restructure moves and skill-file authoring, from order files. Never designs or chooses values.
- **Verifier-N (disposable recruits, same model command):** fresh-context test subjects per skill. Booted vanilla, pointed at a small fixture repo in the session scratchpad, given a tempting task. Dismissed after each round.

Per-skill cycle (superpowers:writing-skills, Iron Law: no skill without a failing test first):

1. **RED** — Maestro drafts pressure/application scenarios matched to skill type (discipline → pressure scenarios; pattern → recognition/application; reference → retrieval). Fresh Verifier runs the scenario WITHOUT the skill; rationalizations documented verbatim. If the baseline does not fail, the skill (or the section of it) is not written.
2. **GREEN** — Maestro designs content; Writer authors from a numbered order file; Maestro reviews. Fresh Verifier re-runs the scenario WITH the plugin installed; must comply.
3. **REFACTOR** — close observed loopholes (rationalization tables/red flags for discipline skills; recipes for shaping issues), re-test until stable.
4. Commit, then move to the next skill. No batch authoring.

## Sequencing

1. **Phase 1 — restructure:** move skills/commands/mcp, write new manifests, merged `.mcp.json`, bucket READMEs, root CLAUDE.md, README rewrite; verify both MCP servers boot and all existing skills resolve; migrate the local dev install (single symlinked cache dir → repo root, `installed_plugins.json` updated); commit.
2. **Phase 2 — engineering skills:** one at a time through RED→GREEN→REFACTOR, starting with the conditional `respecting-lockfiles` baseline (cheapest existence test), then the 8 certain skills.
3. **Phase 3 — cutover:** slim the private `~/.claude/CLAUDE.md` (remove migrated sections, add the bridge line, update MCP tool prefixes in My Accounts), final README pass, version 1.0.0, push, marketplace update.

## Breaking changes & migration

- Installs: 3 plugins → 1. Old names (`maccing-growth`, `maccing-notion`, `google-workspace`) die; users reinstall as `maccing@maccing`. README documents this.
- **MCP tool prefixes change:** `mcp__plugin_maccing-notion_notion__*` → `mcp__plugin_maccing_notion__*`; `mcp__plugin_google-workspace_workspace__*` → `mcp__plugin_maccing_workspace__*`. The private CLAUDE.md "My Accounts" section is updated in Phase 3.
- skills.sh flow unaffected (it scans for `SKILL.md` anywhere); existing skill names unchanged, so `npx skills add andredezzy/maccing -s notion-api` keeps working.
- `/growth` command name unchanged.
- `pictura-output/` at repo root: inspected in Phase 1; if untracked output, gitignored — never silently deleted.

## Dimension sweep

- Data/logic (skill content and mapping): fully specified above.
- Operational (install, migration, versioning, local dev symlink): fully specified above.
- Presentation (root README, bucket READMEs, repo CLAUDE.md): fully specified above.
- Infrastructure (plugin.json, marketplace.json, .mcp.json, commands): fully specified above.
- CI/release automation: not applicable — deliberately manual, matching current practice.
- Hooks: deferred out of scope by design (SessionStart hook YAGNI).
- Testing: per-skill subagent scenarios + Phase 1 install/boot verification.

## Out of scope

- Multi-harness packagings (.codex-plugin, .cursor-plugin, etc. from superpowers) — not requested.
- Changesets/CI release pipeline.
- Any change to skill *content* of existing growth/notion/google-workspace skills (moves only).
- The `~/.claude/skills/maestri*` skills — they belong to the Maestri app, not maccing.
