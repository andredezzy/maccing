# maccing-code-reviewer

Multi-agent code review with automatic pattern discovery using ULTRATHINK methodology.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Installation](#installation)
- [Usage](#usage)
- [Workflows](#workflows)
  - [Complete Review Flow](#complete-review-flow)
  - [First-Time Setup Flow](#first-time-setup-flow)
  - [Rule Resolution Flow](#rule-resolution-flow)
  - [Gap Detection Flow](#gap-detection-flow)
  - [Pattern Discovery Flow](#pattern-discovery-flow)
  - [Agent Execution Flow](#agent-execution-flow)
  - [ULTRATHINK Loop](#ultrathink-loop)
  - [Result Aggregation Flow](#result-aggregation-flow)
  - [Report Generation Flow](#report-generation-flow)
- [Agents](#agents)
- [Configuration](#configuration)
- [Visual Output Examples](#visual-output-examples)
- [Edge Cases](#edge-cases)
- [Philosophy](#philosophy)

---

## What It Does

- **Automatic pattern discovery** learns conventions from YOUR codebase
- **6 specialized agents** analyze code in parallel
- **ULTRATHINK methodology** for deep, multi-pass verification
- **Project-aware** respects your explicit rules when provided
- **Extensible** define custom agents for your stack
- **Persistent reports** saved to docs/code-reviews/

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

## Workflows

### Complete Review Flow

The end-to-end flow from command invocation to final report:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE REVIEW FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │ User invokes │                                                           │
│  │   /review    │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────┐    NO     ┌───────────────────┐                       │
│  │  Config exists?  │──────────▶│ First-Time Setup  │                       │
│  └────────┬─────────┘           └─────────┬─────────┘                       │
│           │ YES                           │                                  │
│           ▼                               ▼                                  │
│  ┌──────────────────┐           ┌───────────────────┐                       │
│  │  Load Config     │◀──────────│  Save Config      │                       │
│  └────────┬─────────┘           └───────────────────┘                       │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────┐                                                       │
│  │ Get Changed Files│                                                       │
│  │  (git diff)      │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────┐                                                       │
│  │ Read Explicit    │                                                       │
│  │ Rules (if any)   │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────┐                                                       │
│  │ Detect Gaps      │──────────▶ Which categories have no explicit rules?   │
│  └────────┬─────────┘                                                       │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────┐    GAPS    ┌───────────────────┐                      │
│  │  Gaps detected?  │───────────▶│ Pattern Discovery │                      │
│  └────────┬─────────┘            │   (per category)  │                      │
│           │ NO GAPS              └─────────┬─────────┘                      │
│           │                                │                                 │
│           ▼                                ▼                                 │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │                 SPAWN AGENTS (PARALLEL)               │                   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │                   │
│  │  │ naming  │ │  style  │ │  clean  │ │  arch   │ ... │                   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘     │                   │
│  │       │           │           │           │           │                   │
│  │       └───────────┴───────────┴───────────┘           │                   │
│  │                       │                               │                   │
│  └───────────────────────┼───────────────────────────────┘                   │
│                          │                                                   │
│                          ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │              AGGREGATE RESULTS                        │                   │
│  │  • Deduplicate issues                                │                   │
│  │  • Sort by severity (CRITICAL > HIGH > MEDIUM > LOW) │                   │
│  │  • Group by file                                     │                   │
│  └───────────────────────┬──────────────────────────────┘                   │
│                          │                                                   │
│                          ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │              GENERATE REPORT                          │                   │
│  │  • Display to console                                │                   │
│  │  • Save to docs/code-reviews/                        │                   │
│  └──────────────────────────────────────────────────────┘                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### First-Time Setup Flow

When no configuration exists, the plugin guides the user through setup:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FIRST-TIME SETUP FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────┐                      │
│  │ Check: .claude/plugins/maccing/code-reviewer.json │                      │
│  └───────────────────────┬───────────────────────────┘                      │
│                          │                                                   │
│                          ▼                                                   │
│              ┌───────────────────────┐                                      │
│              │   Config not found    │                                      │
│              └───────────┬───────────┘                                      │
│                          │                                                   │
│                          ▼                                                   │
│  ┌───────────────────────────────────────────────────┐                      │
│  │              SCAN FOR RULE FILES                   │                      │
│  │                                                    │                      │
│  │   ls -la CLAUDE.md rules/*.md .claude/*.md        │                      │
│  │                                                    │                      │
│  │   Found:                                          │                      │
│  │   • CLAUDE.md                                     │                      │
│  │   • rules/CODE_STYLE.md                           │                      │
│  │   • rules/SECURITY.md                             │                      │
│  └───────────────────────┬───────────────────────────┘                      │
│                          │                                                   │
│                          ▼                                                   │
│  ┌───────────────────────────────────────────────────┐                      │
│  │           PROMPT: SELECT RULE FILES                │                      │
│  │                                                    │                      │
│  │   Which rule files should I use for reviews?      │                      │
│  │                                                    │                      │
│  │   [1] CLAUDE.md (detected)                        │                      │
│  │   [2] rules/CODE_STYLE.md (detected)              │                      │
│  │   [3] rules/SECURITY.md (detected)                │                      │
│  │   [4] Add custom path...                          │                      │
│  │   [5] Skip (discover patterns from codebase)      │                      │
│  │                                                    │                      │
│  │   > Select (comma-separated): 1,2                 │                      │
│  └───────────────────────┬───────────────────────────┘                      │
│                          │                                                   │
│                          ▼                                                   │
│  ┌───────────────────────────────────────────────────┐                      │
│  │           PROMPT: SELECT AGENTS                    │                      │
│  │                                                    │                      │
│  │   Which agents should run during reviews?         │                      │
│  │                                                    │                      │
│  │   [1] naming-agent       Naming conventions       │                      │
│  │   [2] code-style-agent   Formatting and patterns  │                      │
│  │   [3] clean-code-agent   Code quality             │                      │
│  │   [4] architecture-agent Layer boundaries         │                      │
│  │   [5] security-agent     Security vulnerabilities │                      │
│  │   [6] i18n-agent         Internationalization     │                      │
│  │                                                    │                      │
│  │   > Select (comma-separated, or 'all'): all       │                      │
│  └───────────────────────┬───────────────────────────┘                      │
│                          │                                                   │
│                          ▼                                                   │
│  ┌───────────────────────────────────────────────────┐                      │
│  │              CREATE CONFIG DIRECTORY               │                      │
│  │                                                    │                      │
│  │   mkdir -p .claude/plugins/maccing                │                      │
│  └───────────────────────┬───────────────────────────┘                      │
│                          │                                                   │
│                          ▼                                                   │
│  ┌───────────────────────────────────────────────────┐                      │
│  │              SAVE CONFIGURATION                    │                      │
│  │                                                    │                      │
│  │   {                                               │                      │
│  │     "ruleFiles": ["CLAUDE.md", "rules/..."],      │                      │
│  │     "agents": ["naming", "code-style", ...],      │                      │
│  │     "customAgents": []                            │                      │
│  │   }                                               │                      │
│  └───────────────────────────────────────────────────┘                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Rule Resolution Flow

How the plugin decides which rules to use for each agent:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RULE RESOLUTION FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   For EACH agent category:                                                  │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         naming-agent                                 │   │
│   │                                                                      │   │
│   │   ┌──────────────────────┐                                          │   │
│   │   │ Check: NAMING.md     │                                          │   │
│   │   │ exists in ruleFiles? │                                          │   │
│   │   └──────────┬───────────┘                                          │   │
│   │              │                                                       │   │
│   │      ┌───────┴───────┐                                              │   │
│   │      │               │                                              │   │
│   │     YES              NO                                              │   │
│   │      │               │                                              │   │
│   │      ▼               ▼                                              │   │
│   │   ┌──────────┐   ┌──────────────────────────────┐                   │   │
│   │   │   Use    │   │ Check: naming section        │                   │   │
│   │   │ explicit │   │ exists in CLAUDE.md?         │                   │   │
│   │   │  rules   │   └──────────────┬───────────────┘                   │   │
│   │   └──────────┘          ┌───────┴───────┐                           │   │
│   │                         │               │                            │   │
│   │                        YES              NO                           │   │
│   │                         │               │                            │   │
│   │                         ▼               ▼                            │   │
│   │                   ┌──────────┐   ┌──────────────┐                   │   │
│   │                   │   Use    │   │    MARK AS   │                   │   │
│   │                   │  section │   │     GAP      │                   │   │
│   │                   └──────────┘   │              │                   │   │
│   │                                  │  → Pattern   │                   │   │
│   │                                  │   Discovery  │                   │   │
│   │                                  └──────────────┘                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                       code-style-agent                               │   │
│   │                            (same flow)                               │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                       architecture-agent                             │   │
│   │                            (same flow)                               │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ... (repeat for all agents)                                               │
│                                                                              │
│   ═══════════════════════════════════════════════════════════════════════   │
│                                                                              │
│   RESULT: Each agent is tagged with:                                        │
│                                                                              │
│   • naming:       explicit (NAMING.md)                                      │
│   • code-style:   explicit (CLAUDE.md section)                              │
│   • clean-code:   GAP → discovery                                           │
│   • architecture: GAP → discovery                                           │
│   • security:     explicit (SECURITY.md)                                    │
│   • i18n:         skipped (no locale files)                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Rule Extraction Flow

How the plugin reads ALL rule files and extracts rules for each category:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RULE EXTRACTION FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    READ ALL RULE FILES                                 │  │
│  │                                                                        │  │
│  │   ruleFiles: ["CLAUDE.md", "rules/CODE_STYLE.md", "rules/CONVENTIONS.md"]│
│  │                                                                        │  │
│  │   For EACH file:                                                      │  │
│  │     1. Read entire file content                                       │  │
│  │     2. Scan for rules related to ALL categories                       │  │
│  │     3. Extract and aggregate rules                                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│                                   │                                          │
│                                   ▼                                          │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    CATEGORY KEYWORD MATCHING                           │  │
│  │                                                                        │  │
│  │   ┌──────────────┬─────────────────────────────────────────────────┐  │  │
│  │   │ Category     │ Keywords to Look For                            │  │  │
│  │   ├──────────────┼─────────────────────────────────────────────────┤  │  │
│  │   │ naming       │ naming, variables, functions, constants,        │  │  │
│  │   │              │ boolean, prefix, suffix, conventions            │  │  │
│  │   ├──────────────┼─────────────────────────────────────────────────┤  │  │
│  │   │ code-style   │ style, formatting, spacing, imports,            │  │  │
│  │   │              │ ternary, composition, patterns                  │  │  │
│  │   ├──────────────┼─────────────────────────────────────────────────┤  │  │
│  │   │ clean-code   │ clean, unused, comments, types, any,            │  │  │
│  │   │              │ error handling, dead code                       │  │  │
│  │   ├──────────────┼─────────────────────────────────────────────────┤  │  │
│  │   │ architecture │ architecture, layers, boundaries, imports,      │  │  │
│  │   │              │ dependencies, separation, structure             │  │  │
│  │   ├──────────────┼─────────────────────────────────────────────────┤  │  │
│  │   │ security     │ security, auth, validation, injection,          │  │  │
│  │   │              │ secrets, vulnerabilities, sanitization          │  │  │
│  │   ├──────────────┼─────────────────────────────────────────────────┤  │  │
│  │   │ i18n         │ i18n, internationalization, translation,        │  │  │
│  │   │              │ locale, localization                            │  │  │
│  │   └──────────────┴─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│                                   │                                          │
│                                   ▼                                          │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    AGGREGATE RULES PER CATEGORY                        │  │
│  │                                                                        │  │
│  │   CLAUDE.md:                                                          │  │
│  │   ├─ naming:       5 rules extracted                                  │  │
│  │   ├─ code-style:   3 rules extracted                                  │  │
│  │   └─ security:     2 rules extracted                                  │  │
│  │                                                                        │  │
│  │   rules/CODE_STYLE.md:                                                │  │
│  │   ├─ code-style:   8 rules extracted                                  │  │
│  │   └─ clean-code:   4 rules extracted                                  │  │
│  │                                                                        │  │
│  │   rules/CONVENTIONS.md:                                               │  │
│  │   ├─ naming:       7 rules extracted                                  │  │
│  │   └─ architecture: 3 rules extracted                                  │  │
│  │                                                                        │  │
│  │   ─────────────────────────────────────────────────────────────────   │  │
│  │                                                                        │  │
│  │   AGGREGATED TOTALS:                                                  │  │
│  │   • naming:       12 rules (CLAUDE.md + CONVENTIONS.md)               │  │
│  │   • code-style:   11 rules (CLAUDE.md + CODE_STYLE.md)                │  │
│  │   • clean-code:   4 rules  (CODE_STYLE.md)                            │  │
│  │   • architecture: 3 rules  (CONVENTIONS.md)                           │  │
│  │   • security:     2 rules  (CLAUDE.md)                                │  │
│  │   • i18n:         0 rules  → GAP                                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Gap Detection Flow

How the plugin identifies which categories need pattern discovery:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GAP DETECTION FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  After reading ALL rule files and aggregating rules:                        │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        GAP DETECTION RESULT                            │  │
│  │                                                                        │  │
│  │   A category is a GAP if:                                             │  │
│  │   • NO rules were found for it across ALL rule files                  │  │
│  │   • The agent is enabled in configuration                             │  │
│  │                                                                        │  │
│  │   ┌──────────────────┬──────────────┬─────────────────────────────┐  │  │
│  │   │ Agent            │ Rules Found  │ Status                      │  │  │
│  │   ├──────────────────┼──────────────┼─────────────────────────────┤  │  │
│  │   │ naming-agent     │ 12 rules     │ ✓ covered                   │  │  │
│  │   │ code-style-agent │ 11 rules     │ ✓ covered                   │  │  │
│  │   │ clean-code-agent │ 4 rules      │ ✓ covered                   │  │  │
│  │   │ architecture-agen│ 3 rules      │ ✓ covered                   │  │  │
│  │   │ security-agent   │ 2 rules      │ ✓ covered                   │  │  │
│  │   │ i18n-agent       │ 0 rules      │ ✗ GAP → Pattern Discovery   │  │  │
│  │   └──────────────────┴──────────────┴─────────────────────────────┘  │  │
│  │                                                                        │  │
│  │   GAPS DETECTED: 1 (i18n)                                             │  │
│  │   → Proceed to Pattern Discovery for i18n category                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Pattern Discovery Flow

How the plugin discovers patterns from the codebase for categories without explicit rules:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PATTERN DISCOVERY FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  For EACH gap category, spawn a pattern-discovery-agent:                    │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    PATTERN DISCOVERY AGENT                             │  │
│  │                                                                        │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │   │ 1. SCAN                                                         │ │  │
│  │   │                                                                  │ │  │
│  │   │    find . -type f \( -name "*.ts" -o -name "*.tsx" \)           │ │  │
│  │   │           -not -path "*/node_modules/*"                         │ │  │
│  │   │                                                                  │ │  │
│  │   │    Result: 142 files found                                      │ │  │
│  │   └─────────────────────────────────────────────────────────────────┘ │  │
│  │                              │                                        │  │
│  │                              ▼                                        │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │   │ 2. READ                                                         │ │  │
│  │   │                                                                  │ │  │
│  │   │    Read EVERY file exhaustively                                 │ │  │
│  │   │    (No sampling, no shortcuts)                                  │ │  │
│  │   └─────────────────────────────────────────────────────────────────┘ │  │
│  │                              │                                        │  │
│  │                              ▼                                        │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │   │ 3. EXTRACT                                                      │ │  │
│  │   │                                                                  │ │  │
│  │   │    For naming category:                                         │ │  │
│  │   │    • Boolean variables: what prefixes? (is, has, can, none)    │ │  │
│  │   │    • Functions: verb-first or noun-first?                      │ │  │
│  │   │    • Constants: UPPER_SNAKE or camelCase?                      │ │  │
│  │   │    • Components: descriptive or generic?                       │ │  │
│  │   │    • Types/Interfaces: what suffixes?                          │ │  │
│  │   └─────────────────────────────────────────────────────────────────┘ │  │
│  │                              │                                        │  │
│  │                              ▼                                        │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │   │ 4. COUNT                                                        │ │  │
│  │   │                                                                  │ │  │
│  │   │    Build statistics:                                            │ │  │
│  │   │                                                                  │ │  │
│  │   │    Boolean Prefixes:                                            │ │  │
│  │   │    ├─ is*     → 89 occurrences                                  │ │  │
│  │   │    ├─ has*    → 22 occurrences                                  │ │  │
│  │   │    ├─ can*    → 6 occurrences                                   │ │  │
│  │   │    ├─ should* → 3 occurrences                                   │ │  │
│  │   │    └─ none    → 2 occurrences                                   │ │  │
│  │   │    Total: 122 booleans                                          │ │  │
│  │   └─────────────────────────────────────────────────────────────────┘ │  │
│  │                              │                                        │  │
│  │                              ▼                                        │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │   │ 5. ANALYZE                                                      │ │  │
│  │   │                                                                  │ │  │
│  │   │    Calculate consistency percentages:                           │ │  │
│  │   │                                                                  │ │  │
│  │   │    Boolean prefixes used: (89+22+6+3) / 122 = 98.4%            │ │  │
│  │   │    ├─ is*     → 73% of all booleans                             │ │  │
│  │   │    ├─ has*    → 18% of all booleans                             │ │  │
│  │   │    └─ can*    → 5% of all booleans                              │ │  │
│  │   └─────────────────────────────────────────────────────────────────┘ │  │
│  │                              │                                        │  │
│  │                              ▼                                        │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │   │ 6. THRESHOLD                                                    │ │  │
│  │   │                                                                  │ │  │
│  │   │    Apply 60% consistency threshold:                             │ │  │
│  │   │                                                                  │ │  │
│  │   │    ┌────────────────────────────────────────────────────────┐  │ │  │
│  │   │    │ Pattern                     │ Consistency │ Adopted?  │  │ │  │
│  │   │    ├─────────────────────────────┼─────────────┼───────────┤  │ │  │
│  │   │    │ Boolean prefixes (is/has/ca)│ 98.4%       │ ✓ YES     │  │ │  │
│  │   │    │ Functions verb-first        │ 91%         │ ✓ YES     │  │ │  │
│  │   │    │ Constants UPPER_SNAKE       │ 64%         │ ✓ YES     │  │ │  │
│  │   │    │ Enum values uppercase       │ 55%         │ ✗ NO      │  │ │  │
│  │   │    └────────────────────────────────────────────────────────┘  │ │  │
│  │   └─────────────────────────────────────────────────────────────────┘ │  │
│  │                              │                                        │  │
│  │                              ▼                                        │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │   │ 7. SAVE                                                         │ │  │
│  │   │                                                                  │ │  │
│  │   │    Store to .claude/plugins/maccing/discovered-patterns.json:  │ │  │
│  │   │                                                                  │ │  │
│  │   │    {                                                            │ │  │
│  │   │      "discoveredAt": "2025-12-31T12:45:00Z",                   │ │  │
│  │   │      "filesAnalyzed": 142,                                     │ │  │
│  │   │      "categories": {                                           │ │  │
│  │   │        "naming": {                                             │ │  │
│  │   │          "hasExplicitRules": false,                            │ │  │
│  │   │          "patterns": [                                         │ │  │
│  │   │            {                                                   │ │  │
│  │   │              "name": "Boolean Prefixes",                       │ │  │
│  │   │              "rule": "Use is/has/can prefixes",                │ │  │
│  │   │              "consistency": 0.984,                             │ │  │
│  │   │              "adopted": true                                   │ │  │
│  │   │            }                                                   │ │  │
│  │   │          ]                                                     │ │  │
│  │   │        }                                                       │ │  │
│  │   │      }                                                         │ │  │
│  │   │    }                                                           │ │  │
│  │   └─────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Agent Execution Flow

How each review agent processes files:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT EXECUTION FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    PARALLEL AGENT SPAWNING                             │  │
│  │                                                                        │  │
│  │   Task tool spawns ALL agents in a SINGLE message (parallel):         │  │
│  │                                                                        │  │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │  │
│  │   │ naming  │  │  style  │  │  clean  │  │  arch   │  │security │    │  │
│  │   │  agent  │  │  agent  │  │  agent  │  │  agent  │  │  agent  │    │  │
│  │   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘    │  │
│  │        │            │            │            │            │          │  │
│  │        ▼            ▼            ▼            ▼            ▼          │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐│  │
│  │   │                 EACH AGENT EXECUTES:                            ││  │
│  │   │                                                                  ││  │
│  │   │  1. LOAD RULES                                                  ││  │
│  │   │     ├─ If explicit rules exist → Read rule file                 ││  │
│  │   │     └─ If gap → Read discovered-patterns.json                   ││  │
│  │   │                                                                  ││  │
│  │   │  2. FOR EACH CHANGED FILE:                                      ││  │
│  │   │     └─ Execute ULTRATHINK Loop (see below)                      ││  │
│  │   │                                                                  ││  │
│  │   │  3. RETURN RESULTS                                              ││  │
│  │   │     └─ Structured list of issues found                          ││  │
│  │   └─────────────────────────────────────────────────────────────────┘│  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    AGENT PER-FILE EXECUTION                            │  │
│  │                                                                        │  │
│  │   Changed files: [src/auth.ts, src/utils.ts, src/components/Button.tsx]│  │
│  │                                                                        │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │   │ File 1: src/auth.ts                                             │ │  │
│  │   │                                                                  │ │  │
│  │   │   READ ──▶ RULES ──▶ ULTRATHINK ──▶ CHECK ──▶ ULTRATHINK ──▶ RESULT│ │
│  │   │                                                                  │ │  │
│  │   │   Issues found: 2                                               │ │  │
│  │   │   • Line 42: tenantId from input (CRITICAL)                     │ │  │
│  │   │   • Line 15: active → should be isActive                        │ │  │
│  │   └─────────────────────────────────────────────────────────────────┘ │  │
│  │                              │                                        │  │
│  │                              ▼                                        │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │   │ File 2: src/utils.ts                                            │ │  │
│  │   │                                                                  │ │  │
│  │   │   READ ──▶ RULES ──▶ ULTRATHINK ──▶ CHECK ──▶ ULTRATHINK ──▶ RESULT│ │
│  │   │                                                                  │ │  │
│  │   │   Issues found: 1                                               │ │  │
│  │   │   • Line 8: unused import 'lodash'                              │ │  │
│  │   └─────────────────────────────────────────────────────────────────┘ │  │
│  │                              │                                        │  │
│  │                              ▼                                        │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │   │ File 3: src/components/Button.tsx                               │ │  │
│  │   │                                                                  │ │  │
│  │   │   READ ──▶ RULES ──▶ ULTRATHINK ──▶ CHECK ──▶ ULTRATHINK ──▶ RESULT│ │
│  │   │                                                                  │ │  │
│  │   │   Issues found: 0                                               │ │  │
│  │   └─────────────────────────────────────────────────────────────────┘ │  │
│  │                              │                                        │  │
│  │                              ▼                                        │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │   │ AGENT COMPLETE                                                  │ │  │
│  │   │                                                                  │ │  │
│  │   │ Return: {                                                       │ │  │
│  │   │   "agent": "naming-agent",                                      │ │  │
│  │   │   "filesReviewed": 3,                                           │ │  │
│  │   │   "issuesFound": 3,                                             │ │  │
│  │   │   "issues": [...]                                               │ │  │
│  │   │ }                                                               │ │  │
│  │   └─────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### ULTRATHINK Loop

The core verification methodology used by each agent:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ULTRATHINK LOOP                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   For EACH file, execute this loop:                                         │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                      │   │
│   │     ┌────────┐                                                      │   │
│   │     │  READ  │  Read file content completely                        │   │
│   │     └───┬────┘                                                      │   │
│   │         │                                                            │   │
│   │         ▼                                                            │   │
│   │     ┌────────┐                                                      │   │
│   │     │ RULES  │  Reference rules (explicit or discovered)           │   │
│   │     └───┬────┘                                                      │   │
│   │         │                                                            │   │
│   │         ▼                                                            │   │
│   │   ┌───────────────┐                                                 │   │
│   │   │  ULTRATHINK   │  Phase 1: Deep Analysis                        │   │
│   │   │   (Phase 1)   │                                                 │   │
│   │   │               │  • What patterns apply to this file?           │   │
│   │   │               │  • What could go wrong?                        │   │
│   │   │               │  • What are ALL elements to check?             │   │
│   │   │               │  • Consider every variable, function, import   │   │
│   │   └───────┬───────┘                                                 │   │
│   │           │                                                          │   │
│   │           ▼                                                          │   │
│   │     ┌────────┐                                                      │   │
│   │     │ CHECK  │  Verify each pattern meticulously                   │   │
│   │     │        │  • Boolean prefixes                                 │   │
│   │     │        │  • Function naming                                  │   │
│   │     │        │  • Import boundaries                                │   │
│   │     │        │  • Security vulnerabilities                         │   │
│   │     │        │  • etc.                                             │   │
│   │     └───┬────┘                                                      │   │
│   │         │                                                            │   │
│   │         ▼                                                            │   │
│   │   ┌───────────────┐                                                 │   │
│   │   │  ULTRATHINK   │  Phase 2: Validation                           │   │
│   │   │   (Phase 2)   │                                                 │   │
│   │   │               │  • Is this REALLY a violation?                 │   │
│   │   │               │  • Could it be intentional?                    │   │
│   │   │               │  • Did I miss anything?                        │   │
│   │   │               │  • Are there edge cases?                       │   │
│   │   │               │  • Re-scan the entire file                     │   │
│   │   └───────┬───────┘                                                 │   │
│   │           │                                                          │   │
│   │           ▼                                                          │   │
│   │     ┌────────┐                                                      │   │
│   │     │ RESULT │  Document findings:                                 │   │
│   │     │        │  • file:line                                        │   │
│   │     │        │  • issue description                                │   │
│   │     │        │  • correct pattern                                  │   │
│   │     │        │  • severity                                         │   │
│   │     └───┬────┘                                                      │   │
│   │         │                                                            │   │
│   │         ▼                                                            │   │
│   │     ┌────────┐                                                      │   │
│   │     │  NEXT  │──────────────────────────────────┐                  │   │
│   │     └────────┘                                   │                  │   │
│   │         ▲                                        │                  │   │
│   │         │                                        │                  │   │
│   │         └────────── (next file) ─────────────────┘                  │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ═══════════════════════════════════════════════════════════════════════   │
│                                                                              │
│   THINKING DEPTH HIERARCHY:                                                 │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                      │   │
│   │   think        → Basic consideration           ✗ NOT ENOUGH         │   │
│   │   think hard   → Deeper analysis               ✗ NOT ENOUGH         │   │
│   │   think harder → Extended analysis             ✗ STILL NOT ENOUGH   │   │
│   │   ultrathink   → Maximum depth analysis        ✓ USE THIS           │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Result Aggregation Flow

How results from all agents are combined:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       RESULT AGGREGATION FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     COLLECT AGENT RESULTS                              │  │
│  │                                                                        │  │
│  │   naming-agent:       3 issues                                        │  │
│  │   code-style-agent:   2 issues                                        │  │
│  │   clean-code-agent:   1 issue                                         │  │
│  │   architecture-agent: 0 issues                                        │  │
│  │   security-agent:     1 issue (CRITICAL)                              │  │
│  │   i18n-agent:         4 issues                                        │  │
│  │                                                                        │  │
│  │   Total raw: 11 issues                                                │  │
│  └───────────────────────┬───────────────────────────────────────────────┘  │
│                          │                                                   │
│                          ▼                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        1. DEDUPLICATE                                  │  │
│  │                                                                        │  │
│  │   Remove duplicate issues reported by multiple agents:                │  │
│  │                                                                        │  │
│  │   Example: src/auth.ts:42                                             │  │
│  │   • security-agent: "tenantId from input"                             │  │
│  │   • clean-code-agent: "untrusted input"                               │  │
│  │   → Merge into single issue, keep security-agent as primary          │  │
│  │                                                                        │  │
│  │   After dedup: 10 unique issues                                       │  │
│  └───────────────────────┬───────────────────────────────────────────────┘  │
│                          │                                                   │
│                          ▼                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     2. SORT BY SEVERITY                                │  │
│  │                                                                        │  │
│  │   Priority order:                                                     │  │
│  │                                                                        │  │
│  │   CRITICAL ────────────────────────────────────────────────▶ First   │  │
│  │   HIGH ─────────────────────────────────────────────────────▶ Second  │  │
│  │   MEDIUM ───────────────────────────────────────────────────▶ Third   │  │
│  │   LOW ──────────────────────────────────────────────────────▶ Last    │  │
│  │                                                                        │  │
│  │   Result:                                                             │  │
│  │   1. CRITICAL: src/auth.ts:42 (security)                              │  │
│  │   2. HIGH: src/utils.ts:15 (naming)                                   │  │
│  │   3. HIGH: src/api/index.ts:8 (architecture)                          │  │
│  │   4. MEDIUM: src/components/Form.tsx:22 (code-style)                  │  │
│  │   5. MEDIUM: ...                                                      │  │
│  └───────────────────────┬───────────────────────────────────────────────┘  │
│                          │                                                   │
│                          ▼                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      3. GROUP BY FILE                                  │  │
│  │                                                                        │  │
│  │   Organize for readability:                                           │  │
│  │                                                                        │  │
│  │   src/auth.ts                                                         │  │
│  │   ├─ Line 42: CRITICAL - tenantId from input                          │  │
│  │   └─ Line 15: HIGH - Boolean missing prefix                           │  │
│  │                                                                        │  │
│  │   src/utils.ts                                                        │  │
│  │   └─ Line 8: MEDIUM - Unused import                                   │  │
│  │                                                                        │  │
│  │   src/components/Form.tsx                                             │  │
│  │   ├─ Line 22: MEDIUM - Ternary nesting                                │  │
│  │   └─ Line 45: LOW - Missing translation key                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Report Generation Flow

How the final report is created and saved:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REPORT GENERATION FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      1. DETERMINE VERDICT                              │  │
│  │                                                                        │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │   │ CRITICAL issues > 0?  ───────────▶  VERDICT: REQUEST CHANGES   │ │  │
│  │   │ HIGH issues > 0?      ───────────▶  VERDICT: REQUEST CHANGES   │ │  │
│  │   │ MEDIUM issues > 3?    ───────────▶  VERDICT: NEEDS REVIEW      │ │  │
│  │   │ Only LOW issues?      ───────────▶  VERDICT: APPROVED          │ │  │
│  │   │ No issues?            ───────────▶  VERDICT: APPROVED          │ │  │
│  │   └─────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────┬───────────────────────────────────────────────┘  │
│                          │                                                   │
│                          ▼                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     2. GENERATE REPORT CONTENT                         │  │
│  │                                                                        │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │   │ ★ Code Review Report ═══════════════════════════════════════   │ │  │
│  │   │                                                                  │ │  │
│  │   │ Date:     2025-12-31 14:30                                      │ │  │
│  │   │ Branch:   feature/auth                                          │ │  │
│  │   │ Reviewer: Claude (multi-agent)                                  │ │  │
│  │   │ Files:    12                                                    │ │  │
│  │   │ Issues:   10                                                    │ │  │
│  │   │                                                                  │ │  │
│  │   │ Rules Used:                                                     │ │  │
│  │   │ - naming: discovered (4 patterns, 96% avg consistency)         │ │  │
│  │   │ - code-style: explicit (CLAUDE.md)                             │ │  │
│  │   │ - architecture: discovered (3 patterns, 88% avg)               │ │  │
│  │   │                                                                  │ │  │
│  │   │ Summary:                                                        │ │  │
│  │   │ - CRITICAL: 1 (must fix)                                        │ │  │
│  │   │ - HIGH: 3 (should fix)                                          │ │  │
│  │   │ - MEDIUM: 4 (consider)                                          │ │  │
│  │   │ - LOW: 2 (optional)                                             │ │  │
│  │   │                                                                  │ │  │
│  │   │ Verdict: REQUEST CHANGES                                        │ │  │
│  │   │                                                                  │ │  │
│  │   │ ─────────────────────────────────────────────────────────────   │ │  │
│  │   │                                                                  │ │  │
│  │   │ Issues:                                                         │ │  │
│  │   │                                                                  │ │  │
│  │   │ ✖ CRITICAL — src/auth.ts:42                                     │ │  │
│  │   │ Agent: security-agent                                           │ │  │
│  │   │ Issue: Tenant ID accepted from request body                     │ │  │
│  │   │ Pattern: Never accept tenantId from frontend                    │ │  │
│  │   │                                                                  │ │  │
│  │   │ // Bad                                                          │ │  │
│  │   │ const tenantId = input.tenantId;                                │ │  │
│  │   │                                                                  │ │  │
│  │   │ // Good                                                         │ │  │
│  │   │ const tenantId = ctx.tenant.id;                                 │ │  │
│  │   │                                                                  │ │  │
│  │   │ ...                                                             │ │  │
│  │   └─────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────┬───────────────────────────────────────────────┘  │
│                          │                                                   │
│                          ▼                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    3. DETERMINE FILE NAME                              │  │
│  │                                                                        │  │
│  │   Get branch name:                                                    │  │
│  │   $ git branch --show-current                                         │  │
│  │   → feature/auth                                                      │  │
│  │                                                                        │  │
│  │   Sanitize:                                                           │  │
│  │   • Replace / with -                                                  │  │
│  │   • Lowercase                                                         │  │
│  │   • Keep alphanumeric and hyphens                                     │  │
│  │   → feature-auth                                                      │  │
│  │                                                                        │  │
│  │   Generate filename:                                                  │  │
│  │   → docs/code-reviews/2025-12-31-1430-feature-auth.md                │  │
│  └───────────────────────┬───────────────────────────────────────────────┘  │
│                          │                                                   │
│                          ▼                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       4. SAVE REPORT                                   │  │
│  │                                                                        │  │
│  │   $ mkdir -p docs/code-reviews                                        │  │
│  │                                                                        │  │
│  │   Write file using Write tool:                                        │  │
│  │   → docs/code-reviews/2025-12-31-1430-feature-auth.md                │  │
│  │                                                                        │  │
│  │   ✓ Report saved                                                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agents

| Agent | Focus | What It Checks |
|-------|-------|----------------|
| `naming` | Naming conventions | Boolean prefixes (`is`, `has`, `should`), interface suffixes, enum casing, component names, constants, function naming |
| `code-style` | Formatting patterns | Import ordering, spacing, blank lines, ternary operators, composition patterns, React keys |
| `clean-code` | Code quality | Unused code, commented code, obvious comments, `any` types, nested ternaries, error handling |
| `architecture` | Layer boundaries | Separation of concerns, dependency direction, circular dependencies, file colocation, one component per file |
| `security` | Vulnerabilities | SQL injection, XSS, command injection, secrets in code, auth checks, sensitive data in logs, input validation |
| `i18n` | Internationalization | Translation keys, hardcoded strings, locale coverage, pluralization |

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

Override discovered patterns with explicit rule files:

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

## Visual Output Examples

### Pattern Discovery Output

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

════════════════════════════════════════════════════════

Patterns saved to: .claude/plugins/maccing/discovered-patterns.json

Proceeding with code review...
```

### Review Progress Output

```
★ maccing-code-reviewer ════════════════════════════════

Review Started

Config:   .claude/plugins/maccing/code-reviewer.json
Scope:    Git changes
Files:    12 files to review

Rules Source:
- naming: discovered (4 patterns adopted)
- code-style: explicit (CLAUDE.md)
- clean-code: discovered (2 patterns adopted)
- architecture: discovered (3 patterns adopted)
- security: explicit (rules/SECURITY.md)

Active Agents:
- naming-agent
- code-style-agent
- clean-code-agent
- architecture-agent
- security-agent

Skipped Agents:
- i18n-agent (no locale files detected)

════════════════════════════════════════════════════════
```

### Final Report Output

```
★ Code Review Report ═══════════════════════════════════

Date:     2025-12-31 14:30
Branch:   feature/auth
Reviewer: Claude (multi-agent)
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
Critical and high priority issues must be addressed.

─────────────────────────────────────────────────────────

Issues:

✖ CRITICAL — src/auth.ts:42
Agent: security-agent
Issue: Tenant ID accepted from request body
Pattern: Never accept tenantId from frontend

▲ HIGH — src/utils/helpers.ts:15
Agent: naming-agent
Issue: Boolean variable missing prefix
Pattern: Discovered: 96% of booleans use is/has/can prefix

─────────────────────────────────────────────────────────

Agent Summary:
- security-agent: 1 issue (tenant isolation vulnerability)
- naming-agent: 3 issues (boolean prefixes missing)
- code-style-agent: 2 issues (conditional rendering patterns)
- clean-code-agent: 1 issue (unused import)
- architecture-agent: 0 issues (no violations)
- i18n-agent: 4 issues (missing translation keys)

Recommendations:
1. Review tenant context patterns in auth layer
2. Add ESLint rules for boolean naming
3. Enforce ternary pattern in component library

═══════════════════════════════════════════════════════
```

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

### No Changed Files

If there are no files to review:

```
★ maccing-code-reviewer ════════════════════════════════

No changes detected.

Run with --scope <path> to review specific files.

════════════════════════════════════════════════════════
```

---

## Philosophy

- **Discovery-first** — Learn from YOUR codebase, not generic rules
- **Thorough over fast** — Exhaustive analysis, no shortcuts
- **Evidence over claims** — Percentages and counts for transparency
- **Project-aware** — Respect established patterns
- **Transparent** — Show what was discovered and why

---

## License

MIT
