# Pattern Discovery Design

**Date:** 2025-12-31
**Status:** Approved
**Author:** Claude (multi-agent)

---

## Overview

Enhance the maccing-code-reviewer to automatically discover coding patterns from the codebase when explicit rules are not provided. This makes the reviewer fully adaptive, learning conventions from the actual project rather than imposing generic defaults.

---

## Requirements

1. **Hybrid discovery timing** — Discover on first setup AND always rediscover on each run
2. **Gap-only discovery** — Only discover patterns for categories missing explicit rules
3. **Dedicated visual phase** — Separate "Pattern Discovery" block before review
4. **Exhaustive analysis** — Scan all files, build comprehensive pattern profile
5. **No built-in defaults** — Every rule is either explicit or discovered
6. **60% threshold** — Patterns with >60% consistency are adopted as rules

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Code Review Start                     │
├─────────────────────────────────────────────────────────┤
│  1. Load config (or create on first run)                │
│  2. Load explicit rules from ruleFiles[]                │
│  3. Identify gaps: which agents have NO explicit rules? │
│  4. For each gap → run Pattern Discovery Agent          │
│  5. Save discovered patterns to config                  │
│  6. Display discovery results visually                  │
│  7. Proceed with normal multi-agent review              │
└─────────────────────────────────────────────────────────┘
```

---

## Gap Detection Logic

| Agent | Has Explicit Rules If... |
|-------|--------------------------|
| naming-agent | `NAMING.md` or naming section in `CLAUDE.md` exists |
| code-style-agent | `CODE_STYLE.md` or style section exists |
| architecture-agent | `ARCHITECTURE.md` or architecture section exists |
| clean-code-agent | `CLEAN_CODE.md` or clean code section exists |
| security-agent | `SECURITY.md` or security section exists |
| i18n-agent | i18n rules exist OR no locale files in project |

---

## Pattern Discovery Agent

A new **pattern-discovery-agent** runs before the review agents. It exhaustively scans the codebase to infer conventions.

### Discovery Process

```
┌─────────────────────────────────────────────────────────┐
│              Pattern Discovery Agent                     │
├─────────────────────────────────────────────────────────┤
│  1. SCAN - Glob all relevant files (*.ts, *.tsx, etc.) │
│  2. SAMPLE - Read every file (exhaustive mode)          │
│  3. EXTRACT - Identify patterns for the category:       │
│     - Naming: variable prefixes, function verbs, etc.  │
│     - Style: formatting, spacing, import ordering       │
│     - Architecture: folder structure, layer boundaries  │
│  4. ANALYZE - Calculate consistency percentages         │
│     "87% of booleans use is/has prefix"                │
│  5. THRESHOLD - Only adopt patterns with >60% usage    │
│  6. DOCUMENT - Save as inferred rules                   │
└─────────────────────────────────────────────────────────┘
```

### Patterns Discovered Per Category

| Category | Patterns Discovered |
|----------|---------------------|
| Naming | Boolean prefixes, function verb patterns, constant casing, component naming style |
| Code Style | Import ordering, spacing conventions, ternary vs if/else usage, destructuring patterns |
| Architecture | Folder structure conventions, import boundaries (what imports what), colocation patterns |
| Clean Code | Comment style, error handling patterns, type usage (any vs unknown) |
| Security | Auth patterns, input validation locations, secret handling |

---

## Visual Output

### Pattern Discovery Phase Block

```
★ Pattern Discovery ════════════════════════════════════

Scanning codebase for implicit conventions...

Files Analyzed: 142
Categories:     3 gaps detected (naming, architecture, clean-code)

────────────────────────────────────────────────────────

naming patterns discovered:

  Boolean Prefixes
  ├─ is*     → 73% (89/122 booleans)
  ├─ has*    → 18% (22/122 booleans)
  └─ can*    →  5% (6/122 booleans)
  ✓ Adopted: Booleans should use is/has/can prefixes

  Function Naming
  ├─ verb-first  → 91% (handle*, get*, set*, fetch*)
  └─ noun-first  →  9%
  ✓ Adopted: Functions should start with verb

  Constants
  ├─ UPPER_SNAKE  → 64%
  └─ camelCase    → 36%
  ✓ Adopted: Constants should use UPPER_SNAKE_CASE

────────────────────────────────────────────────────────

architecture patterns discovered:

  Import Boundaries
  ├─ components/ never imports from pages/  → 100%
  ├─ utils/ never imports from components/  → 94%
  └─ hooks/ imports from utils/             → 88%
  ✓ Adopted: Layer boundaries enforced

  File Colocation
  ├─ *.test.ts next to source  → 72%
  └─ *.types.ts next to source → 81%
  ✓ Adopted: Tests and types colocated with source

────────────────────────────────────────────────────────

clean-code patterns discovered:

  Type Safety
  ├─ any usage      →  3% (4 occurrences)
  └─ unknown usage  → 97%
  ✓ Adopted: Prefer unknown over any

  Error Handling
  ├─ try/catch with typed errors  → 78%
  └─ untyped catch                → 22%
  ✓ Adopted: Catch blocks should type errors

════════════════════════════════════════════════════════

Patterns saved to: .claude/plugins/maccing/discovered-patterns.json

Proceeding with code review...
```

### Visual Elements

- Tree structure (`├─`, `└─`) showing pattern breakdown
- Percentages for transparency
- `✓ Adopted` markers for patterns meeting >60% threshold
- Clear separation between categories

---

## Storage Format

**File:** `.claude/plugins/maccing/discovered-patterns.json`

```json
{
  "discoveredAt": "2025-12-31T12:45:00Z",
  "filesAnalyzed": 142,
  "categories": {
    "naming": {
      "hasExplicitRules": false,
      "patterns": [
        {
          "name": "Boolean Prefixes",
          "rule": "Booleans should use is/has/can prefixes",
          "evidence": {
            "total": 122,
            "matches": { "is": 89, "has": 22, "can": 6, "other": 5 },
            "consistency": 0.96
          },
          "adopted": true
        },
        {
          "name": "Function Naming",
          "rule": "Functions should start with verb",
          "evidence": {
            "total": 245,
            "matches": { "verbFirst": 223, "nounFirst": 22 },
            "consistency": 0.91
          },
          "adopted": true
        }
      ]
    },
    "architecture": {
      "hasExplicitRules": false,
      "patterns": [
        {
          "name": "Import Boundaries",
          "rule": "components/ never imports from pages/",
          "evidence": {
            "violations": 0,
            "checked": 47,
            "consistency": 1.0
          },
          "adopted": true
        }
      ]
    },
    "code-style": {
      "hasExplicitRules": true,
      "patterns": [],
      "skippedReason": "Explicit rules found in CLAUDE.md"
    }
  }
}
```

### Storage Properties

- `discoveredAt` — Timestamp for when patterns were last discovered
- `evidence` — Raw data showing how pattern was inferred (transparency)
- `consistency` — Percentage meeting threshold
- `adopted` — Whether pattern met >60% threshold
- `skippedReason` — Explains why discovery was skipped for a category

---

## Edge Cases

### Empty/New Codebase

If discovery finds no patterns (new project):
- Report: "No patterns detected, codebase too small for inference"
- Agent skips checks for that category rather than guessing

### No Files Match Category

If no relevant files exist for a category:
- Report: "No [category] files found to analyze"
- Skip that category gracefully

---

## Rule Resolution

```
┌─────────────────────────────────────────────────────────┐
│                   Rule Resolution                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  For each agent category:                               │
│                                                          │
│    1. Check: Does explicit rule file exist?             │
│       └─ YES → Use explicit rules                       │
│       └─ NO  → Run pattern discovery for this category  │
│                                                          │
│    2. Pattern discovery produces:                       │
│       └─ Discovered patterns (>60% consistency)         │
│       └─ Saved to discovered-patterns.json              │
│                                                          │
│    3. Agent uses discovered patterns as rules           │
│                                                          │
│  NO DEFAULTS. Every rule is either:                     │
│    - Explicitly defined by user                         │
│    - Discovered from the actual codebase                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Changes

### Changes to SKILL.md

1. Remove default rules fallback — Delete references to `defaults/` folder
2. Add Step 2.5: Pattern Discovery Phase — New step between config load and agent spawn
3. Add pattern-discovery-agent prompt — Exhaustive codebase scanner
4. Update visual output — Add discovery phase block before review
5. Update agent prompts — Agents read from discovered patterns when no explicit rules

### File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `skills/code-review/SKILL.md` | Add discovery phase, remove defaults fallback |
| Rename | `defaults/` → `examples/` | Rename folder |
| Create | `examples/README.md` | Explain these are optional templates |

### Documentation Updates

| File | Updates |
|------|---------|
| `README.md` (root) | Add pattern discovery feature, update philosophy |
| `plugins/maccing-code-reviewer/README.md` | Add workflow diagrams, discovery docs, visual examples |
| `CLAUDE.md` | Update plugin standards for discovery-first approach |
| `examples/README.md` | Explain templates are optional reference |

---

## Philosophy Alignment

This design embodies the maccing principles:

- **Thorough over fast** — Exhaustive codebase scan
- **Evidence over claims** — Percentages and raw counts for transparency
- **Systematic over ad-hoc** — Structured discovery process
- **Project-aware** — Learns from YOUR codebase, not generic rules
- **Transparent** — Shows exactly what was discovered and why
