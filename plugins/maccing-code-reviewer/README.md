# maccing-code-reviewer

Multi-agent code review with automatic pattern discovery using ULTRATHINK methodology.

---

## What it does

- **Automatic pattern discovery** learns conventions from YOUR codebase
- **6 specialized agents** analyze code in parallel
- **ULTRATHINK methodology** for deep, multi-pass verification
- **Project-aware** respects your explicit rules when provided
- **Extensible** define custom agents for your stack
- **Persistent reports** saved to docs/code-reviews/

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    Code Review Flow                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Load Configuration                                  │
│     └─ Check for .claude/plugins/maccing/code-reviewer.json
│                                                          │
│  2. Identify Rule Sources                               │
│     ├─ Explicit rules → Use directly                    │
│     └─ No rules → Pattern Discovery                     │
│                                                          │
│  3. Pattern Discovery (for gaps only)                   │
│     ├─ Scan entire codebase                             │
│     ├─ Extract conventions per category                 │
│     ├─ Calculate consistency percentages                │
│     └─ Adopt patterns with >60% consistency             │
│                                                          │
│  4. Spawn Review Agents (parallel)                      │
│     ├─ Each agent uses explicit OR discovered rules     │
│     └─ ULTRATHINK double-pass verification              │
│                                                          │
│  5. Aggregate & Report                                  │
│     ├─ Deduplicate issues                               │
│     ├─ Sort by severity                                 │
│     └─ Save to docs/code-reviews/                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Pattern Discovery

When no explicit rules exist for a category, the reviewer **discovers patterns from your codebase**.

### Discovery Flow

```
┌─────────────────────────────────────────────────────────┐
│              Pattern Discovery Agent                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. SCAN    Find all relevant files                     │
│  2. READ    Read every file (exhaustive)                │
│  3. EXTRACT Identify patterns for the category          │
│  4. COUNT   Build statistics per pattern                │
│  5. ANALYZE Calculate consistency percentages            │
│  6. ADOPT   Patterns with >60% become rules             │
│  7. SAVE    Store to discovered-patterns.json           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Example Discovery Output

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

────────────────────────────────────────────────────────

architecture patterns discovered:

  Import Boundaries
  ├─ components/ never imports from pages/  → 100%
  ├─ utils/ never imports from components/  → 94%
  └─ hooks/ imports from utils/             → 88%
  ✓ Adopted: Layer boundaries enforced

════════════════════════════════════════════════════════

Patterns saved to: .claude/plugins/maccing/discovered-patterns.json

Proceeding with code review...
```

### What Gets Discovered

| Category | Patterns Discovered |
|----------|---------------------|
| Naming | Boolean prefixes, function verb patterns, constant casing, component naming |
| Code Style | Import ordering, spacing conventions, ternary vs if/else, destructuring |
| Architecture | Folder structure, import boundaries, dependency direction, colocation |
| Clean Code | Type safety (any vs unknown), error handling, comment style |
| Security | Auth patterns, input validation locations, secret handling |

---

## Installation

    /plugin marketplace add andredezzy/maccing
    /plugin install maccing-code-reviewer@maccing

---

## Usage

### Basic Review

    /maccing-code-reviewer:review

Reviews all uncommitted changes using all 6 agents.

### Targeted Review

    /maccing-code-reviewer:review --only security,architecture

Run only specific agents.

### Skip Agents

    /maccing-code-reviewer:review --skip i18n,naming

Skip specific agents.

### Review Specific Path

    /maccing-code-reviewer:review --scope src/api/

Review files in a specific directory.

### Console-Only Output

    /maccing-code-reviewer:review --no-save

Output report to console without saving to file.

---

## Agents

| Agent | Focus |
|-------|-------|
| `naming` | Boolean prefixes, interface suffixes, enum casing |
| `code-style` | Formatting, spacing, ternaries, composition |
| `clean-code` | Unused code, comments, types, error handling |
| `architecture` | Layer boundaries, separation of concerns |
| `security` | Injection, auth, secrets, vulnerabilities |
| `i18n` | Translation keys, locale coverage |

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
│       └─ NO  → Run pattern discovery                    │
│                                                          │
│    2. Pattern discovery produces:                       │
│       └─ Discovered patterns (>60% consistency)         │
│       └─ Saved to discovered-patterns.json              │
│                                                          │
│    3. Agent uses discovered patterns as rules           │
│                                                          │
│  Every rule is either:                                  │
│    - Explicitly defined by you                          │
│    - Discovered from your actual codebase               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Configuration

On first run, the plugin creates `.claude/plugins/maccing/code-reviewer.json`:

```json
{
  "ruleFiles": ["CLAUDE.md", "rules/CODE_STYLE.md"],
  "agents": ["naming", "code-style", "clean-code", "architecture", "security", "i18n"],
  "customAgents": []
}
```

### Explicit Rules

If you want to override discovered patterns, create explicit rule files:

```json
{
  "ruleFiles": ["rules/NAMING.md", "rules/ARCHITECTURE.md"]
}
```

See `examples/` folder for rule file templates.

### Custom Agents

Add custom agents for your stack:

```json
{
  "customAgents": [
    {
      "name": "django-agent",
      "description": "Django-specific patterns",
      "ruleFile": "rules/DJANGO.md",
      "checks": [
        "Model field naming",
        "View permissions",
        "QuerySet optimization"
      ]
    }
  ]
}
```

---

## Reports

Reports are saved to:

    docs/code-reviews/YYYY-MM-DD-HHmm-<branch-name>.md

Example: `docs/code-reviews/2025-12-31-1430-feature-auth.md`

### Report Structure

```
★ Code Review Report ═══════════════════════════════════

Date:     2025-12-31 14:30
Branch:   feature/auth
Files:    12
Issues:   11

Rules Used:
- naming: discovered (4 patterns, 96% avg consistency)
- code-style: explicit (CLAUDE.md)
- architecture: discovered (3 patterns, 88% avg consistency)

Summary:
- CRITICAL: 1 (must fix)
- HIGH: 3 (should fix)
- MEDIUM: 5 (consider)
- LOW: 2 (optional)

Verdict: REQUEST CHANGES
```

---

## ULTRATHINK Methodology

Each agent executes a rigorous loop for every file:

```
READ -> RULES -> ULTRATHINK -> CHECK -> ULTRATHINK -> RESULT -> NEXT
        ^                                              |
        +-------------- (next file) -------------------+
```

### Two-Phase Verification

| Phase | Purpose |
|-------|---------|
| **ULTRATHINK 1** | Deep analysis of patterns, potential issues, all elements to check |
| **ULTRATHINK 2** | Validation pass, verify findings, catch edge cases, re-scan everything |

This methodology ensures thorough, accurate reviews with minimal false positives.

---

## Edge Cases

### New/Small Codebase

If the codebase is too small for pattern inference:

```
naming patterns discovered:

  No patterns detected, codebase too small for inference

  Skipping naming checks for this review.
```

### No Locale Files

If i18n agent finds no locale files:

```
i18n patterns discovered:

  No locale files found to analyze

  Skipping i18n checks for this review.
```

---

## Philosophy

- **Discovery-first** Learn from YOUR codebase, not generic rules
- **Thorough over fast** Exhaustive analysis, no shortcuts
- **Evidence over claims** Percentages and counts for transparency
- **Project-aware** Respect established patterns
- **Transparent** Show what was discovered and why

---

## License

MIT
