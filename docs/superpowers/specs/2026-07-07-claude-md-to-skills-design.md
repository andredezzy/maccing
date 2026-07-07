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
5. **Skill granularity: one skill per shareable CLAUDE.md domain** (6 certain + 1 conditional), each <500 words, individually pressure-tested. `passing-quality-gates` was considered and removed by user decision — quality gates and commit style stay private. `formatting-code` was merged into `organizing-code` by user decision (2026-07-07 shelf-appeal judgment): its three rules survive as the visual-structure cluster; only the standalone name — which read redundant next to Biome/Prettier — was dropped.
6. **Maestri team: mind + writer + fresh verifiers** — Claude is maestro/mind and source of truth; one Writer recruit executes; disposable Verifier recruits are fresh-context test subjects.
7. **Naming scheme: superpowers gerund-process school**, applied wholesale — validated against skills.sh top-10, Anthropic official skills, mattpocock, and superpowers corpora; no collisions. One deliberate non-gerund exception, user-ratified: `dx` (the umbrella doctrine — the `tdd` initialism pattern; registry-searched 2026-07-07, no exact-name collision, nearest hits are Salesforce `dx-*` tooling skills, disambiguated by the description).

## Target repo structure

```
maccing/
├── .claude-plugin/
│   ├── plugin.json          ← single plugin "maccing"; skills declared with explicit bucket paths
│   └── marketplace.json     ← marketplace "maccing", one entry, source "./"
├── skills/
│   ├── reasoning/           ← ALREADY BUILT (2026-07-07, user order): cross-domain craft skill authored from a Fable 5 operating manual; SKILL.md + references/operating-manual.md. Placement rule: buckets are for domain families; domain-agnostic skills live directly under skills/. Inert until Phase 1 wires plugin.json (skills.sh picks it up immediately). Scenario validation (GREEN/REFACTOR) queued with Phase 2.
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
| `dx` | DX — TOP PRIORITY | Pattern | The umbrella doctrine. Description must open with "developer experience" (also disambiguates from Salesforce DX) and carry: simplicity, over-engineering, cognitive load, discoverability, open/closed, local reasoning |
| `modeling-domains` | Data Model & Architecture | Pattern | Description must list: domain mirroring, registries/engines, middleware, zero-ceremony init, no tech mixing, no redundant fields |
| `organizing-code` | Code Organization + "never silently swallow an error" (moved from Problem-Solving) + Formatting & Aesthetics (merged) | Pattern | `errors/` folder, one concern per file, no pass-throughs, no barrels, test-file conventions, circular imports, env var ownership, visual structure (blank-line grouping, named types, no dividers) |
| `naming` | Naming & Enums | Pattern | Enum preference + casing, precision, whole-behavior naming, truncations, no Base/Contract |
| `researching-before-coding` | Problem-Solving (minus error rule) | Discipline | Web-search mandate, research before fixes, diagnose before prescribing, dimension enumeration |
| `composing-ui` | UI & Components | Discipline | HARD RULE: composition pattern for new components + refactoring god components to composition. Compound components, props rules, className, forms stack, sentence case |
| `respecting-lockfiles` | Runtime & Tooling (universal half only) | Discipline | **CONDITIONAL**: written only if RED baseline shows fresh agents actually violate lockfile discipline; otherwise dropped entirely |

Skill authoring rules (from superpowers:writing-skills): `Use when…` trigger-only descriptions (no workflow summaries), third person, <500-word bodies, keyword-rich, verb-first gerund names, supporting files only for heavy reference or tools.

## Skill reference

Common shape for all seven — **progressive disclosure via `references/`**, the pattern the famous skills use (Anthropic official skills, superpowers, mattpocock) and maccing's own house style:

- `SKILL.md` — lean body (<500 words): `Overview` (core principle) → `When to use` (incl. when NOT) → `Quick reference` (a table listing EVERY rule in compressed form) → `Common mistakes`, plus "load `references/<file>.md` when …" pointers. **The rule inventory is never split across tiers** — SKILL.md always names every rule so nothing is undiscoverable; references only deepen.
- `references/*.md` — the WHY, worked before/after TypeScript examples, and edge cases for each rule cluster. This preserves the original CLAUDE.md reasoning depth that a 500-word body would destroy.
- **Discipline-skill caveat:** rationalization tables and red-flag lists stay in `SKILL.md` — bulletproofing hidden in a reference is bulletproofing skipped.
- A references file must earn its existence (real depth, independently loadable); small skills stay `SKILL.md`-only.
- **Directory name unification:** growth skills' `reference/` (singular) renames to `references/` (plural) in Phase 1, matching notion, Anthropic, and superpowers — one convention repo-wide.

Descriptions below are drafts — final wording is set in GREEN after RED evidence, but must stay trigger-only.

### dx

- **Description (draft):** `Use when developer experience is at stake — designing or reviewing any code structure, choosing between implementation approaches, or tempted to add abstraction, configuration, indirection, or generality. Triggers: over-engineering, speculative flexibility, "we might need it later", cognitive load, extension points, buried conditionals, clever code.`
- **Form:** Pattern — positive contract (the DX test) + counter-examples; NOT a prohibition list.
- **Rules carried (complete):** (1) DX outweighs every other trade-off heuristic; (2) simplicity over cleverness — simplest design fully solving the present problem wins, no speculative machinery, patterns exist to remove complexity never to decorate; (3) discoverability — extension points obvious from listing a directory; (4) consistency of mental model — one pattern per concern class, applied everywhere; (5) open/closed — new case = new file + one registration, never a growing conditional; (6) test isolation via seams — inject strategy, substitute small fake, one-line setup; (7) self-documenting architecture — structure is the docs; (8) local reasoning — no state-at-a-distance, explicit params, caching earns its place only when expensive + input unavailable + several callers; (9) the single re-evaluation question: easier to read, debug, test, extend well into the future?
- **Also carries:** a 2–3 sentence distillation of the "principles to reason from, not templates to copy" preamble — this is the umbrella skill, and that framing governs how agents apply the whole set.
- **References:** `references/simplicity.md` (over-engineering, speculative flexibility, when patterns earn their place — before/after), `references/extension-points.md` (discoverability, open/closed, consistency of mental model, self-documenting structure, registry example), `references/local-reasoning.md` (state-at-a-distance, the 3-condition caching test, test seams via injection).
- **RED scenarios (recognition/application):** (a) fixture: config loader task with "we may add YAML and remote config later" bait — does baseline build speculative abstraction? (b) fixture: module with a 3-branch conditional, task "add a fourth case fast" — does baseline judge when a registry reduces complexity vs when the conditional is still simplest?
- **Word budget:** SKILL.md ~350 + 3 references. Fits.

### modeling-domains

- **Description (draft):** `Use when defining domain types, database or validation schemas, config shapes, wire payloads, or translation/message trees; when adding a domain type, union member, registry, or dispatcher; when data is flat, joined by ID references, duplicated across fields, or its nesting doesn't match the real-world thing it describes.`
- **Form:** Pattern — recipes with before/after type examples.
- **Rules carried (complete):** (1) data model mirrors the business domain — nest what belongs, explicit relation only for genuine many-to-many; (2) structure isomorphic to the described thing everywhere (types, config, wire, translation trees) — every nesting level a real nameable boundary, no concatenated-name flattening, no invented levels; (3) one registry/engine per domain — never conflate concept-spaces in one union/dispatcher, generic registry factory instantiated per concern, one explicit one-direction bridge, mixed-containment union = split signal; (4) mirror the domain's exact type-set — verify the current set against official docs/live API, never memory; containment rules enforced in static types AND wire schema; (5) middleware over manual orchestration for cross-cutting concerns; (6) zero-ceremony initialization — self-detecting, lazy, self-hydrating; (7) no technology mixing; (8) no redundant/derivable stored fields; (9) defaults detected from the user's actual context, never hardcoded.
- **Positioning (2026-07-07 shelf judgment):** the one direct famous rival is mattpocock's `domain-modeling` — the description must make the distinguishers visible (isomorphic structure everywhere + registries/engines), or installers pick his.
- **References:** `references/isomorphic-structure.md` (nesting = real boundaries; domain/config/wire/translation worked examples; no redundant fields), `references/registries-and-engines.md` (one registry per domain, generic factory, one-direction bridge, the mixed-union split signal), `references/domain-type-fidelity.md` (exact type-set, verifying against live docs/API, containment enforced in types AND wire schema), `references/self-initializing-architecture.md` (middleware over orchestration, zero-ceremony init). Defaults-from-context and no-tech-mixing stay inline in SKILL.md.
- **RED scenarios (application):** (a) design types + schema for orders/items/tags (items belong-to, tags many-to-many) — does baseline nest vs flat-FK everything?; (b) translation file task — does baseline produce `checkout_button_label`-style concatenated keys?
- **Word budget:** SKILL.md ~400 + 4 references. Fits.

### organizing-code

- **Description (draft):** `Use when creating, splitting, or moving files; defining error classes or writing catch blocks; adding helpers, wrappers, or utils; structuring test files; or deciding where types, env vars, or server/client context live. Triggers: a file doing several things, circular imports, barrel files, a function that only forwards its arguments, an empty catch, code reading as a dense wall, inline multi-property object types, section-divider comments.`
- **Form:** Pattern — quick-reference table + terse recipes; the pass-through rule gets its earn-its-existence test as a checklist.
- **Rules carried (complete):** (1) no barrel files or abstract-taxonomy dirs — code lives with its owner; (2) custom errors in top-level `errors/`, one class per file, catch by `instanceof` never message-string, error messages in English; (3) one responsibility per file, file name = documentation; (4) split by responsibility not size, inline once-used short helpers; (5) inline over premature extraction — local duplication beats a single-caller abstraction; (6) no pure pass-through wrappers + the earn-its-existence test; (7) OOP for stateful responsibility with a lifecycle, functions for stateless transforms; (8) entry points are thin orchestrators; (9) single-static-method class = function (mapper-namespace exception); (10) no circular runtime imports — extract the shared dependency; type-only cycles fine; (11) env vars owned by apps, packages receive config; (12) server vs client context in separate files; (13) one test file per file-under-test, named after it; e2e tests belong to infrastructure files; split only past ~1000 lines with shared prefix; (14) no per-module READMEs in src/; (15) **never silently swallow an error** — every catch re-throws, logs, or transforms; empty catch is always a bug (moved here from Problem-Solving); (16) blank lines mandatory — group related statements, separate concerns, no dense walls (merged from Formatting & Aesthetics); (17) no inline structural types — 2+ properties or 2+ non-primitive union members = extract a named type, trivial single-member nullable exempt (merged); (18) no decorative section-divider comments — needing them signals a split-by-responsibility (merged).
- **References:** `references/errors.md` (top-level `errors/` folder, one class per file, `instanceof` catching, English messages, never-swallow rule), `references/extraction-and-wrappers.md` (inline-over-premature-extraction + the pass-through earn-its-existence test — the two longest rules), `references/file-boundaries.md` (barrels, one responsibility per file, thin entry points, OOP vs functions, circular imports, env-var ownership, server/client context), `references/test-files.md` (one test file per file-under-test, e2e-in-infrastructure rule, split threshold), `references/visual-structure.md` (blank-line grouping, named-type extraction thresholds, divider-free files — beyond what Biome/Prettier enforce; merged from the dropped formatting-code skill).
- **RED scenarios (application):** (a) "add a NotFound error to this service and handle it in the router" — does baseline colocate the error class in the thrower and/or match on message strings?; (b) "clean up this module" with a once-used 4-line block — does baseline extract a single-caller helper and add a forwarding wrapper?; (c) "organize this long file visually" — does baseline reach for `// ────` dividers and leave inline types?
- **Word budget:** SKILL.md ~500 (all 18 rules in the quick-reference table) + 5 references.

### naming

- **Description (draft):** `Use when naming anything — files, functions, types, variables, enum members — or choosing between a boolean, string union, and enum for a set of states. Triggers: vague or abbreviated names, single-letter values, Base-prefixed classes, Contract-suffixed interfaces, casing questions, a name that only covers part of what the function does.`
- **Form:** Pattern — recipes + naming decision table.
- **Rules carried (complete):** (1) enums over booleans/string unions for closed sets — 3+ states or 2 meaning-bearing ones; plain boolean stays right for an unambiguous flag; (2) enum keys AND values UPPERCASE; wire-boundary values keep the external contract's exact casing as a string union; (3) names precise, never a vague gesture; (4) name the whole behavior, not the salient sub-step — prefer the established domain term, avoid sibling collisions; (5) spell out truncations that cost decoding, no bare single letters, universal conventional short forms exempt; (6) no manufactured verbosity — drop meaningless suffixes, fewest unambiguous words; (7) dot-notation filename suffixes only for framework kinds; every other file = kebab-case of its main export; (8) no `Base` prefix — the interface owns the plain name, the skeleton is named for what it adds; (9) no `Contract` suffix — the interface IS the concept.
- **References:** `references/enums.md` (the full enum-vs-boolean-vs-string-union reasoning, UPPERCASE rule, wire-boundary casing exception). Precision/whole-behavior/truncation rules stay inline — they ARE the skill's heart. One reference only: restraint where content is small.
- **RED scenarios (recognition):** (a) code with `isActive`/`isPending` needing a third state — does baseline add a third boolean or a lowercase string union?; (b) "create an abstract base for these repositories" — does baseline produce `BaseRepository`?
- **Word budget:** SKILL.md ~400 + 1 reference. Fits.

### researching-before-coding

- **Description (draft):** `Use when about to write code against any external library, API, framework, or tool; when hitting an error, incompatibility, or unfamiliar technology; before proposing a fix or presenting a design. Especially when confident from memory, under time pressure, or the API "is well known".`
- **Form:** Discipline — prohibition + rationalization table + red flags (baseline rationalizations harvested in RED).
- **Rules carried (complete):** (1) always verify against current sources before code touching anything external — API surface, version, breaking changes, deprecations; memory assertions never acceptable, a named current source is the standard; (2) research before attempting fixes — understand why a working approach works; no guess-test-fail loops; (3) diagnose before prescribing — read the error, consult docs, search the exact message; fix the root cause; (4) enumerate every dimension before presenting a design — every applicable axis marked specified / not-applicable-with-reason / user-deferred; verify the build against the design dimension by dimension.
- **References:** `references/dimension-sweep.md` (the enumerate-every-dimension method: axis checklist, specified/not-applicable/deferred marking, post-build verification). The rationalization table and red flags stay in SKILL.md — discipline bulletproofing must live in the loaded body.
- **RED scenarios (pressure, 3+ combined):** "our payment-SDK webhook verification broke after an upgrade — patch it now, deploying in 10 minutes, you've used this SDK a hundred times" (time + authority + confidence). Document verbatim rationalizations for the table.
- **Word budget:** SKILL.md ~450 (incl. rationalization table grown from RED evidence) + 1 reference.

### composing-ui

- **Description (draft):** `Use when creating any UI component, adding a prop to an existing one, or touching a component that has grown large — in React or any component framework — plus forms, styling, and labels. Triggers: a prop that controls layout or conditionally renders a section, a god component (prop explosion, many booleans/variants, 200+ lines), dot-notation sub-components (Card.Header), raw inputs with hand-rolled validation, title-case labels.`
- **Form:** Discipline — the composition iron law + a god-component refactor recipe + rationalization table and red flags (in SKILL.md). Baseline rationalizations harvested in RED.
- **Rules carried (complete):** (1) **HARD RULE — composition is mandatory**: every new component is built as composed parts; props never control layout, conditional sub-sections, or behavioral branches; appearance/domain-value props fine; (2) **HARD RULE — god components get refactored to composition, not extended**: when touching a component showing god signals (prop explosion, boolean/variant props toggling sections, conditional render forests), the move is decompose-to-parts — never "just add one more prop"; (3) no dot-notation namespacing (breaks RSC) — named exports per part; (4) one file per compound — root + all parts as named exports, deliberate override of one-responsibility-per-file; primitives get their own file; (5) compose at parent/screen level — leaf parts live beside the screen, flat screen folder, no sub-components bucket; (6) compounds colocated with usage; shared primitives in the UI package, source-level exports, no build step; (7) className over visual props; (8) no custom CSS classes in globals — theme variables, imports, resets only; (9) sentence case for all labels; (10) standard form stack — schema-validated form library + resolver, never raw field state; (11) full component-library adoption — field/control/label/message together.
- **Positioning (2026-07-07 shelf judgment):** crowded shelf — `frontend-design` (634K installs, visual design) and `vercel-react-best-practices` (531K, general React idioms) are adjacent. Position as **component API design**: composition-over-props, compound files, RSC constraints — not general React tips.
- **References:** `references/compound-components.md` (one-file compound pattern, RSC/dot-notation rule, parent/screen-level composition, colocation, one full worked example), `references/god-components.md` (detection signals — prop explosion, boolean/variant sections, conditional render forests — and the step-by-step decompose-to-parts refactor with one full before/after), `references/forms.md` (schema-validated form stack, resolver, full component-library adoption). Styling rules (className, globals, sentence case) stay inline.
- **RED scenarios (pressure + application):** (a) "add a `variant` prop that shows or hides this Card's sidebar" — does baseline add the conditional prop instead of a composition part?; (b) god-component fixture: ~300-line component with 8 boolean/variant props, task "add one more variant, quick" (time + sunk-cost pressure) — does baseline add prop #9 instead of refactoring to composition?; (c) "add a small form" — does baseline hand-roll useState fields?
- **Word budget:** SKILL.md ~450 (incl. rationalization table from RED) + 3 references.

### respecting-lockfiles — CONDITIONAL

- **Description (draft):** `Use when installing dependencies, adding or removing packages, or running scripts in any JavaScript/TypeScript repo — before reaching for npm, pnpm, yarn, or bun.`
- **Form:** Discipline — one iron rule + detection recipe (lockfile table: bun.lock/bun.lockb, pnpm-lock.yaml, package-lock.json, yarn.lock, packageManager field).
- **Rules carried (complete):** (1) the repo's lockfile/`packageManager` field decides the tool — use exactly it; (2) never switch tools, never introduce a second lockfile, never run a different installer.
- **References:** none.
- **RED scenarios (existence test, runs FIRST in Phase 2):** pnpm-lock fixture, task "add lodash and run the tests" phrased npm-flavored ("npm install whatever you need"). 3+ fresh Verifier reps. **If baseline complies, the skill is dropped** — this RED run is the existence gate, not just a quality gate.
- **Word budget:** SKILL.md ~150 if it exists at all, no references.

### Stays in the private ~/.claude/CLAUDE.md

- Browser Automation — Aside (personal tooling)
- Claude Code native commands (`/goal` etc.)
- Plugin dev-symlink workflow (personal paths)
- My Accounts
- Bun preference for greenfield work (personal default) + Bun built-ins guidance
- Quality Gates (zero lint/unused/build warnings) + Git commit style
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

1. **Phase 1 — restructure:** move skills/commands/mcp and write the new manifests + merged `.mcp.json` FIRST, then immediately gate: install the plugin locally and verify both MCP servers boot, all skills resolve, and `/growth` still invokes — before any README/docs polish (the assumption-killing check runs first; multi-server plugins and the `plugin.json` `skills` array are doc-verified, but the gate proves them in this runtime). Then: bucket READMEs, root CLAUDE.md, README rewrite; unify growth's `reference/` dirs to `references/` (with mechanical link updates in their SKILL.md files); migrate the local dev install (single symlinked cache dir → repo root, `installed_plugins.json` updated); commit. `/reload-plugins` switches hooks/MCP to edited paths mid-session — useful during Phase 2 iteration.
2. **Phase 2 — engineering skills:** one at a time through RED→GREEN→REFACTOR, starting with the conditional `respecting-lockfiles` baseline (cheapest existence test), then the 6 certain skills.
3. **Phase 3 — cutover:** slim the private `~/.claude/CLAUDE.md` (remove migrated sections, add the bridge line, update MCP tool prefixes in My Accounts), final README pass, version 1.0.0, push, marketplace update.

## Breaking changes & migration

- Installs: 3 plugins → 1. Old names (`maccing-growth`, `maccing-notion`, `google-workspace`) die; users reinstall as `maccing@maccing`. README documents this.
- **MCP tool prefixes change:** `mcp__plugin_maccing-notion_notion__*` → `mcp__plugin_maccing_notion__*`; `mcp__plugin_google-workspace_workspace__*` → `mcp__plugin_maccing_workspace__*` (verified against the plugins reference: scoped names are `mcp__plugin_<plugin-name>_<server-name>__<tool>`). The private CLAUDE.md "My Accounts" section is updated in Phase 3 — and Phase 3 also greps `~/.claude/settings.json` + project settings for `mcp__plugin_` references (permission allow-lists, hooks) and updates them.
- **Skill namespace changes:** every existing skill moves from `maccing-growth:`/`maccing-notion:`/`google-workspace:` to the `maccing:` namespace (the plugin name is the skill namespace). Bare skill names stay the same; anything referencing the old namespaced form breaks.
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
- Any change to skill *content* of existing growth/notion/google-workspace skills (moves, the `reference/`→`references/` rename, and mechanical link updates only — no prose changes).
- The `~/.claude/skills/maestri*` skills — they belong to the Maestri app, not maccing.
