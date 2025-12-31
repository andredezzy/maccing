# maccing-code-reviewer Design

**Date:** 2025-12-30
**Status:** Approved

---

## Overview

**Repository:** `github.com/[YOUR_USERNAME]/maccing`

**Type:** Claude Code Plugin Marketplace

**First Plugin:** `maccing-code-reviewer`

A multi-agent code review plugin using ULTRATHINK methodology for deep, thorough verification. Based on a production-proven POC with 6 specialized agents analyzing code in parallel.

---

## Repository Structure

```
maccing/
├── .claude-plugin/
│   └── marketplace.json
├── plugins/
│   └── maccing-code-reviewer/
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── skills/
│       │   └── code-review/
│       │       └── SKILL.md
│       ├── commands/
│       │   └── review.md
│       ├── defaults/
│       │   ├── NAMING.md
│       │   ├── CLEAN_CODE.md
│       │   ├── SECURITY.md
│       │   └── ARCHITECTURE.md
│       └── README.md
├── LICENSE
└── README.md
```

---

## Design Decisions

| Decision | Choice |
|----------|--------|
| Structure | Marketplace with namespaced plugins |
| Plugin naming | `maccing-code-reviewer` |
| Rule discovery | Interactive first-run setup |
| Config storage | `.claude/plugins/maccing/code-reviewer.json` |
| Agent selection | Per-review flags (`--skip`, `--only`) |
| No rules fallback | Built-in defaults + offer to create custom |
| ULTRATHINK visibility | Visible phases during execution |
| Report storage | `docs/code-reviews/YYYY-MM-DD-<scope>.md` |
| Invocation | Both skill (auto) and command (explicit) |
| Custom agents | Extensible via config |

---

## Installation

```bash
# Add marketplace
/plugin marketplace add YOUR_USERNAME/maccing

# Install code reviewer
/plugin install maccing-code-reviewer@maccing

# Run review
/maccing-code-reviewer:review
```

---

## First-Run Interactive Setup

When a user runs `/maccing-code-reviewer:review` for the first time:

### Step 1: Detect existing rules

```
[*] Scanning for project rules...

Found:
  [+] CLAUDE.md
  [+] rules/CODE_STYLE.md
  [-] rules/NAMING_CONVENTIONS.md (not found)
```

### Step 2: Prompt for configuration

```
Configure Code Reviewer
------------------------

Which rule files should I use for reviews?

  [1] CLAUDE.md (detected)
  [2] rules/CODE_STYLE.md (detected)
  [3] Add custom path...
  [4] Skip - use built-in defaults only

> Select (comma-separated): 1,2
```

### Step 3: Agent selection

```
Review Agents
-------------

  [1] naming-agent       Naming conventions
  [2] code-style-agent   Formatting and patterns
  [3] clean-code-agent   Code quality
  [4] architecture-agent Layer boundaries
  [5] security-agent     Security vulnerabilities
  [6] i18n-agent         Internationalization

> Select (comma-separated, or 'all'): all
```

### Step 4: Save configuration

Creates `.claude/plugins/maccing/code-reviewer.json`.

---

## Review Agents

### Built-in Agents (6)

| Agent | Focus | Key Checks |
|-------|-------|------------|
| `naming-agent` | Naming conventions | Boolean prefixes, interface suffixes, enum casing |
| `code-style-agent` | Formatting patterns | Spacing, ternaries, composition, React keys |
| `clean-code-agent` | Code quality | Unused code, comments, types, error handling |
| `architecture-agent` | Layer boundaries | Separation of concerns, dependencies, colocation |
| `security-agent` | Vulnerabilities | Injection, auth, secrets, tenant isolation |
| `i18n-agent` | Internationalization | Translation keys, locale coverage |

### ULTRATHINK Execution (Visible to User)

```
[maccing-code-reviewer] Starting review...

[*] Reading project rules
    -> CLAUDE.md
    -> rules/CODE_STYLE.md

[*] Spawning 6 agents in parallel

    naming-agent
    |-- [PHASE 1] Deep analysis pass............
    |-- [PHASE 2] Validation pass...............
    |-- [DONE] 3 issues found

    security-agent
    |-- [PHASE 1] Deep analysis pass............
    |-- [PHASE 2] Validation pass...............
    |-- [DONE] 1 critical issue found

    ... (other agents)

[*] Aggregating results
[*] Generating report
```

### Per-Review Flags

```bash
/maccing-code-reviewer:review --skip i18n,naming
/maccing-code-reviewer:review --only security,architecture
```

---

## Custom Agent Extensibility

Users can define custom agents in `.claude/plugins/maccing/code-reviewer.json`:

```json
{
  "ruleFiles": ["CLAUDE.md", "rules/CODE_STYLE.md"],
  "agents": ["naming", "code-style", "clean-code", "architecture", "security", "i18n"],
  "customAgents": [
    {
      "name": "django-agent",
      "description": "Django-specific patterns",
      "ruleFile": "rules/DJANGO.md",
      "checks": [
        "Model field naming (no _id suffix)",
        "View permissions decorators",
        "QuerySet optimization (select_related, prefetch_related)",
        "Form validation patterns"
      ]
    },
    {
      "name": "api-agent",
      "description": "REST API conventions",
      "ruleFile": "rules/API.md",
      "checks": [
        "Endpoint naming (plural nouns)",
        "HTTP status codes",
        "Error response format",
        "Pagination patterns"
      ]
    }
  ]
}
```

### How Custom Agents Work

1. Plugin reads `customAgents` from config
2. For each custom agent, generates an agent prompt using:
   - The `ruleFile` as the rules source
   - The `checks` array as focus areas
   - The same ULTRATHINK methodology as built-in agents
3. Custom agents run in parallel with built-in agents
4. Results aggregated into the same report format

---

## Report Format & Storage

### Output Location (Fixed Convention)

```
docs/code-reviews/YYYY-MM-DD-<branch-name>.md
```

### Report Structure

```markdown
# Code Review Report

**Date:** 2025-12-30
**Branch:** feature/user-auth
**Reviewer:** Claude (multi-agent review)

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1     |
| High     | 3     |
| Medium   | 5     |
| Low      | 2     |

**Verdict:** REQUEST CHANGES

## Critical Issues

| File | Line | Issue | Agent |
|------|------|-------|-------|
| src/auth.ts | 42 | Tenant ID accepted from request body | security-agent |

## High Priority Issues

| File | Line | Issue | Agent |
|------|------|-------|-------|
| ... | ... | ... | ... |

## Agent Reports

### security-agent
- Issues found: 1
- Summary: Tenant isolation vulnerability in auth endpoint

### naming-agent
- Issues found: 3
- Summary: Boolean variables missing 'is/has' prefix

...

## Review History

| Date | Action | Details |
|------|--------|---------|
| 2025-12-30 | Initial Review | 11 issues, verdict: REQUEST CHANGES |
```

### Post-Fix Updates

Report updated in-place with `[FIXED]` markers and verdict changes.

---

## Built-in Default Rules

When no project rules exist, the plugin uses sensible defaults.

### defaults/NAMING.md

```markdown
# Naming Conventions (Default)

- Boolean variables: prefix with is, has, should, can, will
- Interfaces: suffix with Request/Response, Input/Output, Props, Config
- Enums: UPPER_CASE values
- Components: descriptive names (not generic "DataTable", "Modal")
- Constants: UPPER_SNAKE_CASE
- Functions: camelCase, verb-first (getUser, handleClick, validateInput)
```

### defaults/CLEAN_CODE.md

```markdown
# Clean Code (Default)

- No unused variables, imports, or functions
- No commented-out code
- Comments explain "why", not "what"
- Avoid `any` type (use unknown or proper types)
- No nested ternaries
- No linter suppression comments without justification
```

### defaults/SECURITY.md

```markdown
# Security (Default)

- No secrets in code (API keys, passwords, tokens)
- Validate all user input at boundaries
- No SQL/command injection vulnerabilities
- Proper authentication checks on endpoints
- No sensitive data in logs
- HTTPS for all external requests
```

### defaults/ARCHITECTURE.md

```markdown
# Architecture (Default)

- Separation of concerns (UI vs business logic)
- Dependencies flow downward only
- No circular dependencies
- One component/class per file
- Colocate tests with source files
```

### First-Run Offer

```
No project rules detected. Using built-in defaults.

Would you like help creating custom rules for this project?
  [1] Yes, guide me through it
  [2] No, continue with defaults
```

---

## Skill vs Command Implementation

### Skill (Auto-Invoked)

`skills/code-review/SKILL.md`

```yaml
---
name: code-review
description: Reviews code for quality, security, and conventions. Use when
  reviewing changes, checking PRs, or analyzing code quality.
---
```

Triggered by natural language:
- "review my changes"
- "check this code"
- "do a code review"

### Command (Explicit)

`commands/review.md`

```markdown
---
description: Run comprehensive code review with multi-agent analysis
---

# Code Review Command

Run a thorough code review using the ULTRATHINK methodology.

Arguments: $ARGUMENTS

Supported flags:
- --skip <agents>     Skip specific agents (comma-separated)
- --only <agents>     Run only specific agents
- --no-save           Output to console only, skip file save
- --scope <path>      Review specific path instead of git changes
```

### Usage Examples

```bash
/maccing-code-reviewer:review
/maccing-code-reviewer:review --only security,architecture
/maccing-code-reviewer:review --scope src/auth/
```

---

## README Files

### Repository README (maccing/README.md)

```markdown
# maccing

Claude Code plugins built for developers who care about code quality.

---

## Installation

    /plugin marketplace add YOUR_USERNAME/maccing

---

## Available Plugins

### maccing-code-reviewer

**Description:** Multi-agent code review using ULTRATHINK methodology

**Categories:** code-review, quality, security

**Installation:**

    /plugin install maccing-code-reviewer@maccing

**What you get:**
- 6 specialized review agents running in parallel
- Deep multi-pass analysis with visible progress
- Project-aware rules (reads CLAUDE.md, rules/*.md)
- Custom agent extensibility
- Persistent reports in docs/code-reviews/

**Commands:**
- `/maccing-code-reviewer:review` — run full review
- `/maccing-code-reviewer:review --only security` — targeted review
- `/maccing-code-reviewer:review --skip i18n` — skip agents

**Repository:** [plugins/maccing-code-reviewer](plugins/maccing-code-reviewer/)

---

## Marketplace Structure

    maccing/
    ├── .claude-plugin/
    │   └── marketplace.json
    └── plugins/
        └── maccing-code-reviewer/

---

## License

MIT
```

---

## Next Steps

1. Create the repository structure
2. Implement marketplace.json and plugin.json manifests
3. Port the SKILL.md from the POC, generalizing hardcoded paths
4. Implement the command with flag parsing
5. Create default rule files
6. Write the README files
7. Test locally with `claude --plugin-dir`
8. Publish to GitHub
