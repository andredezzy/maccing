# CLAUDE.md → maccing Skills + Single-Plugin Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **THIS RUN'S EXECUTION MODE (user-mandated, overrides the default):** maestri-driven. The maestro (main Claude session) is reviewer and source of truth; ONE Writer recruit executes tasks from order files; disposable Verifier recruits are fresh-context test subjects. See "Maestri protocol" below.

**Goal:** Restructure maccing from a 3-plugin marketplace into one plugin with root-level bucketed `skills/`, then author the 6 engineering doctrine skills (+1 conditional) from the private CLAUDE.md via per-skill TDD, then cut the private CLAUDE.md over to the skills.

**Architecture:** Superpowers-shape single plugin (`.claude-plugin/{plugin.json, marketplace.json}` with `source: "./"`), mattpocock-shape bucketed `skills/`, two bundled MCP servers in one `.mcp.json`. Skills follow progressive disclosure (lean SKILL.md + `references/`). Every new skill passes RED→GREEN→REFACTOR with fresh-session Verifiers before commit.

**Tech Stack:** Claude Code plugin system, skills.sh CLI, maestri CLI, git, Bun (existing MCP servers).

**Spec:** `docs/superpowers/specs/2026-07-07-claude-md-to-skills-design.md` — the rule inventories, description drafts, and references maps for every skill live in its "Skill reference" section. Where a step says "per spec §`<skill>`", that section is the content source and is normative.

## Global Constraints

- Plugin name: `maccing`. Version: `1.0.0`. Marketplace name stays `maccing`, one entry, `source: "./"`.
- MCP server keys stay exactly `notion` and `workspace` (tool prefixes become `mcp__plugin_maccing_notion__*`, `mcp__plugin_maccing_workspace__*`).
- Existing skill *content* is untouchable: moves, `reference/`→`references/` renames, and link updates only — no prose changes.
- New skills: `Use when…` trigger-only descriptions, third person; SKILL.md <500 words; every rule named in SKILL.md (references only deepen); discipline skills keep rationalization tables/red flags in SKILL.md.
- Iron Law: no skill (or skill edit) ships without its RED baseline observed and GREEN re-run passing. `respecting-lockfiles` additionally has an existence gate: baseline compliance ⇒ the skill is not written at all.
- Maestri children: always `--command "claude --model claude-sonnet-5 --dangerously-skip-permissions"`; verify "Sonnet 5" via `maestri check` after recruit.
- Commit style: `scope(area): subject` (matches repo history). Commit after every task.
- Scratchpad root for orders/fixtures/findings: `$SCRATCH` = `/private/tmp/claude-501/-Users-andrevictor/414c2b94-7f28-4aec-ae97-3f4d3a40556e/scratchpad`.
- Repo root: `/Users/andrevictor/www/Andre-Dezzy/maccing`. All relative paths below are from repo root.

## Maestri protocol (used by every task)

**Writer (once, at Task 1):**

```bash
maestri recruit "<invent-codename>" --command "claude --model claude-sonnet-5 --dangerously-skip-permissions"
maestri check "<codename>"   # status line must say "Sonnet 5"
```

Per task: maestro writes the task's full text to `$SCRATCH/orders/task-N.md`, then:

```bash
maestri ask "<Writer>" "Execute the order file at $SCRATCH/orders/task-N.md exactly, step by step, in /Users/andrevictor/www/Andre-Dezzy/maccing. Report each step's command and result. Do not design, choose values, or skip steps."   # Bash timeout 600000
```

Maestro then reviews (`git status`, `git diff`, read every new/changed manifest) before approving the task's commit. A Writer deviation ⇒ maestro rejects, re-issues the order with the correction.

**Verifier (fresh per RED/GREEN round, disposable):**

```bash
maestri recruit "<invent-fresh-codename>" --command "claude --model claude-sonnet-5 --dangerously-skip-permissions"
maestri check "<codename>"                      # must say Sonnet 5
maestri ask "<codename>" "<scenario prompt>"     # Bash timeout 300000–600000
# maestro copies the verbatim response into $SCRATCH/findings/<skill>-red.md (or -green.md)
maestri dismiss "<codename>"
```

GREEN rounds rely on the dev-symlinked plugin: recruits boot with user-level plugins, so the current repo state IS the installed plugin (verified in Task 4). Before a GREEN ask, confirm the recruit sees the skill: `maestri ask "<codename>" "List your available skills whose names start with maccing:"`.

---

## Phase 1 — Restructure

### Task 1: Move skills into root buckets + unify `references/`

**Files:**
- Move: `plugins/maccing-growth/skills/*` → `skills/growth/*`
- Move: `plugins/maccing-notion/skills/notion-api` → `skills/notion/notion-api`
- Move: `plugins/google-workspace/skills/google-workspace` → `skills/google-workspace/google-workspace`
- Rename: every `skills/growth/**/reference/` dir → `references/`
- Modify: the 8 growth SKILL.md files (link updates only)

**Interfaces:** Produces the `skills/` tree every later task assumes: `skills/{reasoning, growth, notion, google-workspace}` (engineering/ arrives in Phase 2).

- [ ] **Step 1: Move the three skill trees**

```bash
mkdir -p skills/growth skills/notion skills/google-workspace
git mv plugins/maccing-growth/skills/google-ads plugins/maccing-growth/skills/growth plugins/maccing-growth/skills/tiktok-ads plugins/maccing-growth/skills/meta plugins/maccing-growth/skills/platforms skills/growth/
git mv plugins/maccing-notion/skills/notion-api skills/notion/notion-api
git mv plugins/google-workspace/skills/google-workspace skills/google-workspace/google-workspace
```

- [ ] **Step 2: Rename `reference/` → `references/` (8 dirs) and update links**

```bash
for d in $(find skills/growth -type d -name reference); do git mv "$d" "$(dirname "$d")/references"; done
grep -rln "reference/" skills/growth --include="SKILL.md" | xargs sed -i '' 's|reference/|references/|g'
```

- [ ] **Step 3: Verify**

Run: `find skills -name SKILL.md | wc -l` → Expected: `11` (the 10 moved skills + the pre-existing `skills/reasoning/SKILL.md`)
Run: `find skills -type d -name reference | wc -l` → Expected: `0`
Run: `grep -rn "](reference/" skills --include="SKILL.md" | wc -l` → Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add -A skills plugins && git commit -m "restructure(skills): move plugin skills into root buckets; unify reference/ → references/"
```

### Task 2: Move commands and MCP servers

**Files:**
- Move: `plugins/maccing-growth/commands` → `commands`
- Move: `plugins/maccing-notion/mcp` → `mcp/notion`
- Move: `plugins/google-workspace/mcp` → `mcp/google-workspace`

**Interfaces:** Produces `mcp/notion/start.sh` and `mcp/google-workspace/start.sh` — the exact `command` paths Task 3's `.mcp.json` declares.

- [ ] **Step 1: Move**

```bash
git mv plugins/maccing-growth/commands commands
mkdir -p mcp
git mv plugins/maccing-notion/mcp mcp/notion
git mv plugins/google-workspace/mcp mcp/google-workspace
```

- [ ] **Step 2: Check the start scripts for path assumptions**

Run: `grep -n "CLAUDE_PLUGIN_ROOT\|dirname\|\.\./" mcp/notion/start.sh mcp/google-workspace/start.sh`
Expected: scripts resolve via `$(dirname "$0")` or `CLAUDE_PLUGIN_ROOT`-relative paths. If any path assumes the old `plugins/<name>/mcp` depth, fix ONLY the path string (no logic changes) and note it in the task report.

- [ ] **Step 3: Commit**

```bash
git add -A commands mcp plugins && git commit -m "restructure(mcp): move bundled MCP servers to mcp/{notion,google-workspace}; move commands/ to root"
```

### Task 3: New manifests — plugin.json, marketplace.json, .mcp.json

**Files:**
- Create: `.claude-plugin/plugin.json`
- Rewrite: `.claude-plugin/marketplace.json`
- Create: `.mcp.json` (repo root)
- Delete: `plugins/maccing-growth/.claude-plugin/`, `plugins/maccing-notion/.claude-plugin/`, `plugins/google-workspace/.claude-plugin/`, `plugins/maccing-notion/.mcp.json`, `plugins/google-workspace/.mcp.json`

**Interfaces:** Produces the plugin identity every later task depends on: plugin `maccing` v1.0.0, servers `notion` + `workspace`, skills array (engineering bucket added later in Task 7/8).

- [ ] **Step 1: Write `.claude-plugin/plugin.json`**

```json
{
  "name": "maccing",
  "version": "1.0.0",
  "description": "Maxxing skills for coding agents: an engineering doctrine (dx, naming, organizing-code, modeling-domains, researching-before-coding, composing-ui), the reasoning operating manual, growth (Google/Meta/TikTok Ads + WhatsApp via YCloud), a Notion API engineering reference with a bundled self-hosted notion MCP server, and a self-hosted Google Workspace MCP server (Calendar, Gmail, Drive, Docs, Sheets, Slides, Forms, Tasks, Chat, Contacts).",
  "author": {
    "name": "André \"Dezzy\" Victor",
    "email": "contact@andredezzy.com",
    "url": "https://github.com/andredezzy"
  },
  "homepage": "https://github.com/andredezzy/maccing",
  "repository": "https://github.com/andredezzy/maccing",
  "license": "MIT",
  "keywords": ["skills", "dx", "engineering", "reasoning", "growth", "ads", "whatsapp", "notion", "notion-api", "google-workspace", "mcp", "bun"],
  "skills": [
    "./skills/growth",
    "./skills/growth/meta",
    "./skills/growth/platforms/ycloud",
    "./skills/notion",
    "./skills/google-workspace"
  ],
  "commands": ["./commands/"]
}
```

(Root `skills/` is auto-scanned one level, which picks up `skills/reasoning`. The bucket paths above are scanned for `<name>/SKILL.md` one level each — this matches how maccing-growth declared nested skills today. `./skills/engineering` is added in Phase 2 when the bucket first exists.)

- [ ] **Step 2: Rewrite `.claude-plugin/marketplace.json`** (components live in plugin.json ONLY — a marketplace entry that redeclares them triggers the documented conflicting-manifests error)

```json
{
  "name": "maccing",
  "owner": {
    "name": "Andre Dezzy",
    "email": "andredezzy@users.noreply.github.com",
    "url": "https://github.com/andredezzy"
  },
  "plugins": [
    {
      "name": "maccing",
      "source": "./",
      "description": "Maxxing skills for coding agents — engineering doctrine, reasoning, growth, Notion API + notion MCP, Google Workspace MCP.",
      "version": "1.0.0",
      "author": {
        "name": "André \"Dezzy\" Victor",
        "url": "https://github.com/andredezzy"
      },
      "license": "MIT",
      "keywords": ["skills", "dx", "engineering", "reasoning", "growth", "notion", "google-workspace", "mcp"]
    }
  ]
}
```

- [ ] **Step 3: Write root `.mcp.json`** (merged from the two plugin configs; only the `command` paths change)

```json
{
  "mcpServers": {
    "notion": {
      "command": "${CLAUDE_PLUGIN_ROOT}/mcp/notion/start.sh",
      "env": {
        "NOTION_TOKEN": "${NOTION_TOKEN}"
      }
    },
    "workspace": {
      "command": "${CLAUDE_PLUGIN_ROOT}/mcp/google-workspace/start.sh",
      "env": {
        "GOOGLE_OAUTH_CLIENT_ID": "${GOOGLE_OAUTH_CLIENT_ID}",
        "GOOGLE_OAUTH_CLIENT_SECRET": "${GOOGLE_OAUTH_CLIENT_SECRET}",
        "USER_GOOGLE_EMAIL": "${USER_GOOGLE_EMAIL}"
      }
    }
  }
}
```

- [ ] **Step 4: Delete the old plugin manifests**

```bash
git rm -r plugins/maccing-growth/.claude-plugin plugins/maccing-notion/.claude-plugin plugins/google-workspace/.claude-plugin
git rm plugins/maccing-notion/.mcp.json plugins/google-workspace/.mcp.json
```

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin .mcp.json && git commit -m "restructure(plugin): single maccing plugin v1.0.0 — merged manifests + two-server .mcp.json"
```

### Task 4: GATE — migrate the local dev install and prove the runtime (maestro-executed, not Writer)

This is the assumption-killing check. It runs BEFORE any docs polish. Failure here ⇒ stop, diagnose against `git diff` of Task 3, do not proceed.

**Files:**
- Modify: `/Users/andrevictor/.claude/plugins/installed_plugins.json`
- Create: symlink `/Users/andrevictor/.claude/plugins/cache/maccing/maccing/1.0.0` → repo root

- [ ] **Step 1: Back up, then rewrite the install state**

```bash
cp ~/.claude/plugins/installed_plugins.json ~/.claude/plugins/installed_plugins.json.bak-2026-07-07
```

In `installed_plugins.json`, under `"plugins"`: DELETE the six `@maccing` keys (`maccing-monorepo@maccing`, `maccing-rules-enforcer@maccing`, `maccing-pictura@maccing`, `maccing-growth@maccing`, `maccing-notion@maccing`, `google-workspace@maccing`) and ADD:

```json
"maccing@maccing": [
  {
    "scope": "user",
    "installPath": "/Users/andrevictor/.claude/plugins/cache/maccing/maccing/1.0.0",
    "version": "1.0.0",
    "installedAt": "2026-07-07T00:00:00.000Z",
    "lastUpdated": "2026-07-07T00:00:00.000Z",
    "gitCommitSha": "<output of: git -C /Users/andrevictor/www/Andre-Dezzy/maccing rev-parse HEAD>"
  }
]
```

- [ ] **Step 2: Create the dev symlink; retire the old cache dirs**

```bash
mkdir -p ~/.claude/plugins/cache/maccing/maccing
ln -s /Users/andrevictor/www/Andre-Dezzy/maccing ~/.claude/plugins/cache/maccing/maccing/1.0.0
mv ~/.claude/plugins/cache/maccing/maccing-growth ~/.claude/plugins/cache/maccing/maccing-growth.bak
mv ~/.claude/plugins/cache/maccing/maccing-notion ~/.claude/plugins/cache/maccing/maccing-notion.bak
mv ~/.claude/plugins/cache/maccing/google-workspace ~/.claude/plugins/cache/maccing/google-workspace.bak
```

- [ ] **Step 3: Boot gate (fresh headless session)**

```bash
claude -p "Answer in 4 numbered lines, nothing else: 1) Do you see skills named maccing:growth, maccing:notion-api, maccing:google-workspace, maccing:reasoning? 2) Do tools with prefix mcp__plugin_maccing_notion__ exist — name one. 3) Do tools with prefix mcp__plugin_maccing_workspace__ exist — name one. 4) Call mcp__plugin_maccing_workspace__list_calendars for andrevcv1@gmail.com and say only whether it returned data."
```

Expected: 1) yes ×4 · 2) yes, e.g. `mcp__plugin_maccing_notion__search` · 3) yes, e.g. `mcp__plugin_maccing_workspace__list_calendars` · 4) returned data.

- [ ] **Step 4: `/growth` command gate**

```bash
claude -p "/growth" --max-turns 1
```

Expected: output shows the growth skill/command engaged (its Iron-Laws/roster preamble), not "Unknown command".

- [ ] **Step 5: Record the gate as passed** — append results to `$SCRATCH/findings/phase1-gate.md`. No commit (no repo changes in this task).

### Task 5: Bucket READMEs, root CLAUDE.md, repo cleanup

**Files:**
- Move+edit: `plugins/maccing-growth/README.md` → `skills/growth/README.md`
- Move+edit: `plugins/maccing-notion/README.md` → `skills/notion/README.md`
- Move+edit: `plugins/google-workspace/README.md` → `skills/google-workspace/README.md`
- Create: `CLAUDE.md` (repo root) from `plugins/maccing-notion/CLAUDE.md` + `plugins/maccing-notion/AGENTS.md`
- Modify: `.gitignore` (+`pictura-output/`)
- Delete: emptied `plugins/` tree

- [ ] **Step 1: Move the three READMEs and fix their content** (transformation rules — apply all, nothing else): `git mv` each README to its bucket, then in each: replace `/plugin install <old-name>@maccing` → `/plugin install maccing@maccing`; replace any `plugins/<old-name>/...` path → the new root-relative path (`skills/...`, `mcp/notion/...`, `mcp/google-workspace/...`); replace old MCP tool prefixes → `mcp__plugin_maccing_notion__` / `mcp__plugin_maccing_workspace__`. Keep ALL setup content (Notion token, Google OAuth) — it now lives in these bucket READMEs.

- [ ] **Step 2: Root `CLAUDE.md`** — concatenate `plugins/maccing-notion/CLAUDE.md` then `plugins/maccing-notion/AGENTS.md` under a heading `# maccing — repo maintenance`, updating any `plugins/maccing-notion/` path to the new locations, dropping nothing else. Then `git rm` the two source files.

- [ ] **Step 3: Cleanup**

```bash
printf '\n# maccing-pictura legacy output (untracked tool output, never committed)\npictura-output/\n' >> .gitignore
git rm -r plugins 2>/dev/null; rmdir plugins 2>/dev/null; true
```

Run: `ls plugins 2>&1` → Expected: `No such file or directory`. (`plugins/maccing-notion/.in_use` is gitignored; if it blocks the rmdir, `rm -rf plugins/maccing-notion/.in_use` first — it regenerates for the new symlink automatically.)

- [ ] **Step 4: Verify + commit**

Run: `grep -rn "plugins/maccing\|plugins/google-workspace" README.md CLAUDE.md skills .claude-plugin .mcp.json commands 2>/dev/null | wc -l` → Expected: `0`

```bash
git add -A && git commit -m "restructure(docs): bucket READMEs, root repo CLAUDE.md, retire plugins/ tree"
```

### Task 6: Root README rewrite + skills.sh regression

**Files:**
- Rewrite: `README.md`

- [ ] **Step 1: Rewrite `README.md`** with exactly these sections: title + tagline (keep "Maxxing plugins and skills for coding agents."); **Claude Code plugin** (`/plugin marketplace add andredezzy/maccing` then `/plugin install maccing@maccing`; auto-update note kept); **Migrating from the old plugins** (the three old install names are gone — uninstall them, install `maccing@maccing`; MCP tool prefixes changed to `mcp__plugin_maccing_notion__*` / `mcp__plugin_maccing_workspace__*`; skill namespaces changed to `maccing:` — bare skill names unchanged; the `/growth` command is now `/maccing:growth`); **Agent skills via skills.sh** (same commands as today); **Skills table** — one row per skill with bucket: reasoning · growth ×8 · notion-api · google-workspace (engineering rows added as they land in Phase 2); MCP setup pointers to the two bucket READMEs; Troubleshooting (updated cache paths); License.

- [ ] **Step 2: skills.sh regression**

Run: `npx -y skills@latest add . --list` → Expected: `Found 10 skills` listing all ten by name.

- [ ] **Step 3: Commit**

```bash
git add README.md && git commit -m "docs(readme): single-plugin install + migration guide"
```

---

## Phase 2 — Engineering skills (one at a time, Iron Law per skill)

**Shared authoring template** (every SKILL.md in this phase): frontmatter `name` + `description` (the spec's draft, adjusted only by RED evidence, trigger-only) → `# Title` → `## Overview` (core principle, 1–2 sentences) → `## When to use` (incl. when NOT) → `## Quick reference` (table naming EVERY rule from the spec's "Rules carried" list for that skill) → per-cluster sections or rationalization table (discipline skills) → `## Common mistakes` → reference pointers ("Load `references/<file>.md` when …"). References files per the spec's map for that skill; each carries the WHY + one worked TypeScript before/after from its rule cluster, sourced from the corresponding `~/.claude/CLAUDE.md` section's reasoning. `wc -w skills/engineering/<name>/SKILL.md` must be < 500.

**Shared per-skill cycle** (referenced as "the cycle" below; all asks/dismissals per the Maestri protocol):

1. RED: create the fixture(s) in `$SCRATCH/fixtures/<skill>/`, fresh Verifier runs the scenario prompt(s), maestro records verbatim behavior + rationalizations in `$SCRATCH/findings/<skill>-red.md`. Baseline must exhibit the failure; if a scenario doesn't fail, that rule keeps no bulletproofing (and for lockfiles: the whole skill is dropped).
2. GREEN: maestro drafts content per the template + spec rules + RED findings into the order file; Writer authors the files; maestro reviews word count, rule completeness (every spec rule present), description discipline. Add the skill's path coverage to `plugin.json` `skills` array if this is the first engineering skill: `"./skills/engineering"`. Fresh Verifier (confirms it sees `maccing:<skill>`) re-runs the same scenario. Must comply.
3. REFACTOR: new rationalization observed ⇒ add its counter (discipline: table row + red flag; pattern: sharpen the recipe), re-run a fresh Verifier until stable.
4. Commit: `git add skills/engineering/<name> .claude-plugin/plugin.json && git commit -m "skills(engineering): add <name> — RED/GREEN validated"`. Add the skill's row to README's table in the same commit.

### Task 7: `respecting-lockfiles` — existence test FIRST

**Files:** Create (only if RED fails): `skills/engineering/respecting-lockfiles/SKILL.md`

- [ ] **Step 1: Fixture** `$SCRATCH/fixtures/lockfiles/`:

`package.json`:
```json
{ "name": "acme-api", "private": true, "scripts": { "test": "echo tests pass" }, "dependencies": { "zod": "^3.23.0" } }
```
`pnpm-lock.yaml`:
```yaml
lockfileVersion: '9.0'
settings:
  autoInstallPeers: true
importers:
  .:
    dependencies:
      zod:
        specifier: ^3.23.0
        version: 3.23.8
```

- [ ] **Step 2: RED ×3** — three fresh Verifiers, one at a time, each with:

> "Work in $SCRATCH/fixtures/lockfiles. Add lodash to this project — npm install whatever you need — and run the tests. Be quick."

Record per rep: which installer it ran, whether a second lockfile appeared. **Decision gate:** ≥2/3 reps use pnpm and add no second lockfile ⇒ SKIP Steps 3–5, record "dropped — baseline complies" in `$SCRATCH/findings/lockfiles-red.md`, remove the skill's row from the spec via a one-line spec edit, commit that edit (`docs(specs): drop respecting-lockfiles — baseline complies`), and go to Task 8.

- [ ] **Step 3 (conditional): GREEN** — author per spec §respecting-lockfiles (~150 words, no references; iron rule + detection table: `bun.lock`/`bun.lockb`→bun, `pnpm-lock.yaml`→pnpm, `package-lock.json`→npm, `yarn.lock`→yarn, `packageManager` field wins). First engineering skill ⇒ add `"./skills/engineering"` to plugin.json `skills`.
- [ ] **Step 4 (conditional): re-run the scenario ×2 fresh Verifiers** — both must use pnpm. REFACTOR any new rationalization.
- [ ] **Step 5 (conditional): Commit** per the cycle.

### Task 8: `dx`

**Files:** Create: `skills/engineering/dx/{SKILL.md, references/{simplicity.md, extension-points.md, local-reasoning.md}}`

- [ ] **Step 1: Fixtures** — (a) `$SCRATCH/fixtures/dx-config/` containing only the fixture `package.json` `{ "name": "cfg-lab", "private": true }`; (b) `$SCRATCH/fixtures/dx-notifier/src/notifier.ts`:

```ts
type Channel = "email" | "sms" | "push";

export function sendNotification(channel: Channel, to: string, message: string) {
  if (channel === "email") {
    console.log(`[email] to=${to} subject=Notification body=${message}`);
  } else if (channel === "sms") {
    console.log(`[sms] to=${to} body=${message.slice(0, 160)}`);
  } else if (channel === "push") {
    console.log(`[push] to=${to} payload=${JSON.stringify({ title: "Notification", message })}`);
  }
}
```

- [ ] **Step 2: RED** — Verifier A (scenario a): "Work in $SCRATCH/fixtures/dx-config. Build a small TypeScript config loader that reads config.json from the project root. We may add YAML and remote config later. Write the code." Verifier B (scenario b): "Work in $SCRATCH/fixtures/dx-notifier. Add a 'whatsapp' channel fast — messages get a 'wa:' prefix. Write the code." Record: does A build speculative parser abstraction/interfaces for formats that don't exist? Does B reason about registry-vs-branch, or blindly do either?
- [ ] **Step 3: GREEN** — author per spec §dx (rules 1–9 + the "principles not templates" distillation in Overview; the three references per the spec map; cross-reference mattpocock `codebase-design` for deep-module vocabulary instead of re-teaching it). Re-run both scenarios on fresh Verifiers: A ships the simplest JSON-only loader and says why; B states the trade-off and picks the simplest fully-solving shape.
- [ ] **Step 4: REFACTOR + commit** per the cycle.

### Task 9: `modeling-domains`

**Files:** Create: `skills/engineering/modeling-domains/{SKILL.md, references/{isomorphic-structure.md, registries-and-engines.md, domain-type-fidelity.md, self-initializing-architecture.md}}`

- [ ] **Step 1: RED** — no repo fixture needed; two prompts, fresh Verifier each: (a) "Design the TypeScript types plus a zod schema for an order system: customers place orders; orders contain items; items reference products; posts is wrong—orders also carry tags, and a tag can be on many orders. Write the types and schema in $SCRATCH/fixtures/domains/order.ts." (b) "Create $SCRATCH/fixtures/domains/en.json — translation strings for a checkout screen: page title, a payment section with a card-number field label and its error message, and a submit button label." Record: (a) flat-FK arrays everywhere vs nesting with one explicit many-to-many; (b) `checkout_button_label`-style concatenated keys vs a nested tree.
- [ ] **Step 2: GREEN** — author per spec §modeling-domains (rules 1–9; the four references per map; description must lead with the distinguishers per the spec's positioning note). Re-run both prompts fresh: (a) items nested in orders, tags as explicit relation; (b) nested tree.
- [ ] **Step 3: REFACTOR + commit** per the cycle.

### Task 10: `organizing-code`

**Files:** Create: `skills/engineering/organizing-code/{SKILL.md, references/{errors.md, extraction-and-wrappers.md, file-boundaries.md, test-files.md, visual-structure.md}}`

- [ ] **Step 1: Fixture** `$SCRATCH/fixtures/org/src/user-service.ts`:

```ts
const users = new Map<string, { id: string; email: string }>();

export function getUser(id: string) {
  const user = users.get(id);
  if (!user) {
    throw new Error(`User not found: ${id}`);
  }
  return user;
}
```

and `$SCRATCH/fixtures/org/src/router.ts`:

```ts
import { getUser } from "./user-service";

export function handleGetUser(id: string) {
  const user = getUser(id);
  return { status: 200, body: user };
}
```

- [ ] **Step 2: RED** — Verifier A: "Work in $SCRATCH/fixtures/org. getUser throws a plain Error. Add a proper UserNotFoundError and make the router return a 404 for it." Verifier B: "Work in $SCRATCH/fixtures/org. Clean up user-service.ts — organize it nicely, extract what should be extracted, make it visually clear." Record: A — where does the error class land (colocated in user-service? caught by message string?); B — single-use helper extraction, forwarding wrappers, `// ───` dividers, inline types.
- [ ] **Step 3: GREEN** — author per spec §organizing-code (ALL 18 rules in the quick-reference table; five references per map; <500 words). Re-run both fresh: A puts the class in `errors/user-not-found-error.ts` + `instanceof` catch; B inlines the once-used block, adds blank-line grouping, no dividers.
- [ ] **Step 4: REFACTOR + commit** per the cycle.

### Task 11: `naming`

**Files:** Create: `skills/engineering/naming/{SKILL.md, references/enums.md}`

- [ ] **Step 1: Fixture** `$SCRATCH/fixtures/naming/src/subscription.ts`:

```ts
export interface Subscription {
  id: string;
  isActive: boolean;
  isPending: boolean;
}

export function describeSubscription(s: Subscription) {
  if (s.isPending) return "pending";
  return s.isActive ? "active" : "inactive";
}
```

- [ ] **Step 2: RED** — Verifier A: "Work in $SCRATCH/fixtures/naming. Subscriptions can now also be 'suspended'. Update the model and describeSubscription." Verifier B (prompt-only): "In $SCRATCH/fixtures/naming/src/repositories.ts, create an abstract base class for repositories that share findById/save, and a UserRepository extending it." Record: A — third boolean? lowercase string union? enum?; B — `BaseRepository`?
- [ ] **Step 3: GREEN** — author per spec §naming (rules 1–9; one reference). Re-run fresh: A reaches for an UPPERCASE enum (or names the wire-boundary exception if it argues serialization); B names the skeleton for what it adds, interface owns `Repository`.
- [ ] **Step 4: REFACTOR + commit** per the cycle.

### Task 12: `researching-before-coding`

**Files:** Create: `skills/engineering/researching-before-coding/{SKILL.md, references/dimension-sweep.md}`

- [ ] **Step 1: Fixture** `$SCRATCH/fixtures/research/`: `package.json`:

```json
{ "name": "payments", "private": true, "dependencies": { "stripe": "^14.0.0" } }
```

`src/webhook.ts`:

```ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export function verifyWebhook(payload: string, signature: string) {
  return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!);
}
```

- [ ] **Step 2: RED (pressure ×3 combined)** — fresh Verifier: "Work in $SCRATCH/fixtures/research. We upgraded the stripe package to the latest major and webhook verification broke in production. Patch verifyWebhook NOW — we deploy in 10 minutes and you've used this SDK a hundred times. Just write the fix." Record verbatim: does it patch from memory, or check the current stripe SDK changelog/docs first? Capture every rationalization ("standard API, unlikely to have changed", etc.) for the table.
- [ ] **Step 3: GREEN** — author per spec §researching-before-coding (rules 1–4; rationalization table + red flags IN SKILL.md built from Step 2's verbatim quotes; one reference; cross-reference `diagnosing-bugs`/superpowers `systematic-debugging` as the hard-bug escalation). Re-run fresh: Verifier must consult a current source (names it) before patching.
- [ ] **Step 4: REFACTOR + commit** per the cycle.

### Task 13: `composing-ui`

**Files:** Create: `skills/engineering/composing-ui/{SKILL.md, references/{compound-components.md, god-components.md, forms.md}}`

- [ ] **Step 1: Fixture** `$SCRATCH/fixtures/ui/src/card.tsx` (a compact god component):

```tsx
interface CardProps {
  title: string;
  showSidebar: boolean;
  showFooter: boolean;
  showAvatar: boolean;
  compact: boolean;
  highlighted: boolean;
  loading: boolean;
  variant: "default" | "warning" | "success";
  children: React.ReactNode;
}

export function Card(p: CardProps) {
  if (p.loading) return <div className="card skeleton" />;
  return (
    <div className={`card ${p.compact ? "compact" : ""} ${p.highlighted ? "ring" : ""} card-${p.variant}`}>
      {p.showAvatar && <img className="avatar" alt="" />}
      <h3>{p.title}</h3>
      <div className="row">
        <div className="content">{p.children}</div>
        {p.showSidebar && <aside className="sidebar">…</aside>}
      </div>
      {p.showFooter && <footer className="footer">…</footer>}
    </div>
  );
}
```

- [ ] **Step 2: RED (pressure)** — Verifier A: "Work in $SCRATCH/fixtures/ui. Add one more variant to Card quick: showBadge, a small badge next to the title. Two-line change, don't overthink it." Verifier B: "In $SCRATCH/fixtures/ui/src/newsletter-form.tsx create a small newsletter signup form (email + submit) with validation." Record: A — prop #9 vs decompose-to-parts (and every rationalization: "refactor out of scope", "just two lines"); B — raw useState + hand-rolled validation vs schema-stack.
- [ ] **Step 3: GREEN** — author per spec §composing-ui (the two HARD RULES + rules 3–11; rationalization table + red flags IN SKILL.md; three references per map; description positions as component API design). Re-run fresh: A refuses prop #9 and decomposes (CardAvatar/CardSidebar/CardFooter-style named exports, one file); B uses a schema-validated form stack.
- [ ] **Step 4: REFACTOR + commit** per the cycle.

### Task 14: `reasoning` — validation of the already-built skill

**Files:** Modify (only if REFACTOR demands): `skills/reasoning/SKILL.md`, `skills/reasoning/references/operating-manual.md`

- [ ] **Step 1: GREEN scenario** — fresh Verifier: "You have the maccing:reasoning skill — use it. Review this claim and give a verdict: 'The maccing repo's skills.sh install is broken for Claude Code because the CLI symlinks instead of copying.' Work in /Users/andrevictor/www/Andre-Dezzy/maccing (read-only)." Expected observable compliance: invokes the skill; verdict first sentence; claims labeled verified/inferred/assumed (it should CHECK the README's `--copy` note and the CLI behavior rather than assert); a risk section.
- [ ] **Step 2:** Any structural non-compliance (skips labels, buries verdict) ⇒ REFACTOR SKILL.md (sharpen the shape contract), re-run fresh. Commit only if files changed: `git commit -m "skills(reasoning): refactor after GREEN validation"`.

---

## Phase 3 — Cutover

### Task 15: Slim the private `~/.claude/CLAUDE.md` (maestro-executed — personal file)

**Files:**
- Modify: `/Users/andrevictor/.claude/CLAUDE.md`
- Check: `/Users/andrevictor/.claude/settings.json` and project `.claude/settings.json` files

- [ ] **Step 1: Back up** — `cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.bak-2026-07-07`
- [ ] **Step 2: REMOVE these sections entirely** (they now live in skills): "Developer Experience (DX) — TOP PRIORITY" · "Data Model & Architecture" · "Code Organization" · "Naming & Enums" · "Code Formatting & Aesthetics" · "Problem-Solving Approach" · "UI & Components" · and from "Runtime & Tooling" ONLY the "Respect the existing package manager" bullet **if** `respecting-lockfiles` was built (if dropped, the bullet stays).
- [ ] **Step 3: KEEP** (verbatim): Runtime & Tooling's Bun bullets + plugin dev-symlink workflow · Browser Automation (Aside) · Claude Code Native Commands · Quality Gates (incl. the skill-writing mandate) · Git & Commits · My Accounts. REWRITE "How to Read These Rules" down to 2–3 sentences. ADD at the top, after the preamble:

```markdown
## Standing Engineering Doctrine — maccing skills (MANDATORY)

My engineering rules live in the maccing plugin's skills, not in this file. Before designing, structuring, naming, or writing any code, invoke the matching skill: `dx` (design priorities), `modeling-domains`, `organizing-code`, `naming`, `researching-before-coding`, `composing-ui` — plus `reasoning` for any hard problem or verdict. These are standing rules, not suggestions; treat a matching skill exactly as you treated the section it replaced.
```

- [ ] **Step 4: Update "My Accounts"** tool prefixes: `mcp__plugin_google-workspace_workspace__*` → `mcp__plugin_maccing_workspace__*`; plugin path `~/www/Andre-Dezzy/maccing/plugins/google-workspace/` → `~/www/Andre-Dezzy/maccing/` (plugin = repo root now); the maccing-notion plugin reference → the `maccing` plugin's bundled `notion` server.
- [ ] **Step 5: Sweep settings for stale tool names**

Run: `grep -rn "mcp__plugin_maccing-notion\|mcp__plugin_google-workspace" ~/.claude/settings.json ~/.claude/settings.local.json 2>/dev/null`
Expected: update every hit to the new prefixes; zero hits remain on re-run.

- [ ] **Step 6: Cross-agent sanity** — `cat ~/.config/opencode/AGENTS.md | head -20` (the symlink shows the slimmed file). Re-read the remaining content once for OpenCode/Codex sense: Claude-specific leftovers are fine, nothing load-bearing for them may have been removed.

### Task 16: Publish

- [ ] **Step 1: Push** — `git -C /Users/andrevictor/www/Andre-Dezzy/maccing push origin main` (user confirmation obtained by the maestro before running).
- [ ] **Step 2: Marketplace source decision** — during Phase 2 the maccing marketplace was re-sourced as `directory` → the local repo (session-start reconciliation against the stale GitHub source kept destroying the local install). After the push, EITHER keep directory-sourcing on this machine (dev mode; consumers use GitHub regardless) OR restore the GitHub source via `claude plugin marketplace remove maccing && claude plugin marketplace add andredezzy/maccing` + reinstall + re-symlink. Decide with the user.
- [ ] **Step 3: Verify** — fresh `claude -p` repeat of Task 4 Step 3. Same expected output.

### Task 17: Cross-agent skills.sh install + interim cleanup

- [ ] **Step 1: Remove the interim copy** — `npx -y skills@latest remove reasoning -g -y` (falls back to `rm -rf ~/.claude/skills/reasoning ~/.agents/skills/reasoning` if the CLI refuses); it would otherwise collide with the plugin's `maccing:reasoning`.
- [ ] **Step 2: Install ALL skills for the non-Claude agents** (note, verified against skills.sh v1.5.15 source during Task 14: single-agent installs force copy mode automatically and symlink failures fall back to copy — `--copy` is a harmless no-op belt-and-suspenders here) — `npx -y skills@latest add andredezzy/maccing -s '*' -g --copy -y -a opencode codex` (agent list = the non-Claude agents in use; verify available agent ids via the CLI's interactive output or `--help` before running; NEVER include claude-code — the plugin serves it).
- [ ] **Step 3: Verify** — `npx -y skills@latest ls -g` lists every maccing skill for opencode/codex; `claude -p "List skills starting with maccing: — one line"` shows plugin skills only (no duplicate bare `reasoning`).
- [ ] **Step 4: Final scoreboard** — append to `$SCRATCH/findings/final-verification.md`: Phase 1 gate ✓, per-skill RED/GREEN ✓ (with lockfiles verdict), CLAUDE.md slim ✓, push ✓, cross-agent ✓. Report to user.
