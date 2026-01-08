# maccing

Claude Code plugins built for developers who care about code quality.

---

## Installation

    /plugin marketplace add andredezzy/maccing

---

## Updating Plugins

**Manual update:**

    /plugin marketplace update maccing

**Enable auto-update:**

1. Run `/plugin`
2. Select **Marketplaces** tab
3. Select `maccing`
4. Select **Enable auto-update**

**Reinstall to get latest:**

    /plugin install maccing-code-reviewer@maccing

---

## Available Plugins

### maccing-code-reviewer

Multi-agent code review with automatic pattern discovery.

    /plugin install maccing-code-reviewer@maccing

**Features:**

- Automatic pattern discovery from YOUR codebase
- 6 specialized review agents running in parallel
- ULTRATHINK methodology for deep analysis
- Persistent reports in docs/code-reviews/

**Quick start:**

    /maccing-code-reviewer:review

[View full documentation](plugins/maccing-code-reviewer/README.md)

### maccing-monorepo

Monorepo workflow assistance with auto-detection and smart reminders.

    /plugin install maccing-monorepo@maccing

**Features:**

- Auto-detects Turborepo, Nx, pnpm, npm, yarn workspaces
- Reminds to run scripts from root with filters
- Comprehensive monorepo-workflows skill
- Commands: `/maccing-monorepo:info`, `/maccing-monorepo:run`

**Quick start:**

    /maccing-monorepo:info

[View full documentation](plugins/maccing-monorepo/README.md)

---

## Plugin Output

### maccing-monorepo

**Monorepo Info**

```
★ monorepo ───────────────────────────────────────────

Tool:     Turborepo
Root:     /Users/dev/my-project

Packages:

  apps/web (web)
  ├─ dev, build, test, lint

  apps/docs (docs)
  ├─ dev, build

  packages/ui (@repo/ui)
  ├─ build, test

Filter syntax:
  turbo run <task> --filter=<package>

───────────────────────────────────────────────────────
```

**Run Command**

```
★ monorepo:run ────────────────────────────────────────

Task:    build
Package: web
Tool:    Turborepo

Command:
turbo run build --filter=web

────────────────────────────────────────────────────────
```

**PostToolUse Reminder** (context injection, not visual banner)

```
You ran `npm run dev` from apps/web/. For better caching and
consistency, run from monorepo root: `turbo run dev --filter=web`
```

### maccing-code-reviewer

**Initial Banner**

```
⚠ maccing-code-reviewer v1.1.0

Scope: Full Codebase

────────────────────────────────────────────────────────
```

**First-Time Setup**

```
◆ maccing-code-reviewer: First-time Setup ──────────────

Scanning for project rules...
```

**Setup Complete**

```
✓ maccing-code-reviewer: Setup Complete ────────────────

Config: .claude/plugins/maccing/code-reviewer.json
Rules:  CLAUDE.md
Agents: naming, code-style, clean-code, architecture, security

────────────────────────────────────────────────────────
```

**Pattern Discovery**

```
◎ maccing-code-reviewer: Pattern Discovery ─────────────

Scanning codebase for implicit conventions...

naming patterns discovered:

  Boolean Prefixes
  ├─ is*  → 73%
  ├─ has* → 18%
  └─ can* →  5%
  ✓ Adopted

  Function Naming
  ├─ verb-first → 91%
  └─ noun-first →  9%
  ✓ Adopted

────────────────────────────────────────────────────────
```

**Final Report**

```
★ maccing-code-reviewer: Code Review Report ────────────

Date:     2025-12-31 14:30
Branch:   feature/auth
Files:    12
Issues:   7

Summary:
- CRITICAL: 1
- HIGH: 3
- MEDIUM: 2
- LOW: 1

Verdict: REQUEST CHANGES

─────────────────────────────────────────────────────────

Issues:

✖ CRITICAL: src/auth.ts:42
Agent: security-agent
Issue: Tenant ID accepted from request body
Pattern: Never accept tenantId from frontend

▲ HIGH: src/utils/helpers.ts:15
Agent: naming-agent
Issue: Boolean variable missing prefix
Pattern: Discovered: 96% of booleans use is/has/can prefix

────────────────────────────────────────────────────────
```

---

## Philosophy

- **Discovery-first**: Learn from YOUR codebase, not generic rules
- **Thorough over fast**: Deep multi-pass analysis
- **Evidence over claims**: Every issue includes file:line reference
- **Transparent**: See what was discovered and why

---

## Troubleshooting

### Plugin not updating

Clear cache and reinstall:

```bash
rm -rf ~/.claude/plugins/cache/maccing
rm -rf ~/.claude/plugins/marketplaces/maccing
/plugin marketplace add andredezzy/maccing
/plugin install <plugin-name>@maccing
```

### Check installed version

```bash
cat ~/.claude/plugins/marketplaces/maccing/plugins/<plugin-name>/.claude-plugin/plugin.json | grep version
```

### Plugin-specific issues

For detailed troubleshooting guides:

- [maccing-code-reviewer troubleshooting](plugins/maccing-code-reviewer/README.md#troubleshooting)
- [maccing-monorepo troubleshooting](plugins/maccing-monorepo/README.md#troubleshooting)

---

## License

MIT
