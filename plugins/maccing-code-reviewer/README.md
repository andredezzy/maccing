# maccing-code-reviewer

Multi-agent code review with automatic pattern discovery using ULTRATHINK methodology.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Installation](#installation)
- [Usage](#usage)
- [Workflows](#workflows)
- [Agents](#agents)
- [Configuration](#configuration)
- [Visual Output Examples](#visual-output-examples)
- [Edge Cases](#edge-cases)
- [Philosophy](#philosophy)
- [Troubleshooting](#troubleshooting)

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

```
/plugin marketplace add andredezzy/maccing
/plugin install maccing-code-reviewer@maccing
```

---

## Usage

### Basic Review

```
/maccing-code-reviewer:review
```

Asks which scope to review (Git Changes, Full Codebase, or Specific Path).

### Review Entire Codebase

```
/maccing-code-reviewer:review entire codebase
```

### Review Specific Path

```
/maccing-code-reviewer:review src/api/
```

### Review by Module Name

```
/maccing-code-reviewer:review the authentication module
```

### Targeted Review (specific agents)

```
/maccing-code-reviewer:review --only security,architecture
```

### Skip Agents

```
/maccing-code-reviewer:review --skip i18n,naming
```

### Console-Only Output

```
/maccing-code-reviewer:review --no-save
```

---

## Workflows

### Complete Review Flow

```
+-----------------------------------------------------------------------+
|                        COMPLETE REVIEW FLOW                           |
+-----------------------------------------------------------------------+
|                                                                       |
|  User invokes /maccing-code-reviewer:review                           |
|                        |                                              |
|                        v                                              |
|              +------------------+                                     |
|              | Config exists?   |                                     |
|              +--------+---------+                                     |
|                  |         |                                          |
|                 YES        NO                                         |
|                  |         |                                          |
|                  v         v                                          |
|           +----------+  +-------------------+                         |
|           | Load     |  | First-Time Setup  |                         |
|           | Config   |<-| Save Config       |                         |
|           +----+-----+  +-------------------+                         |
|                |                                                      |
|                v                                                      |
|         +----------------+                                            |
|         | Determine Scope|                                            |
|         | (ask if needed)|                                            |
|         +-------+--------+                                            |
|                 |                                                     |
|                 v                                                     |
|         +----------------+                                            |
|         | Get Files      |                                            |
|         | to Review      |                                            |
|         +-------+--------+                                            |
|                 |                                                     |
|                 v                                                     |
|         +----------------+                                            |
|         | Read Explicit  |                                            |
|         | Rules (if any) |                                            |
|         +-------+--------+                                            |
|                 |                                                     |
|                 v                                                     |
|         +----------------+     +-------------------+                  |
|         | Detect Gaps    |---->| Pattern Discovery |                  |
|         | (no rules?)    |     | (per category)    |                  |
|         +-------+--------+     +---------+---------+                  |
|                 |                        |                            |
|                 v                        v                            |
|         +------------------------------------------------+            |
|         |            SPAWN AGENTS (PARALLEL)             |            |
|         |  naming | style | clean | arch | security     |            |
|         +------------------------+-----------------------+            |
|                                  |                                    |
|                                  v                                    |
|         +------------------------------------------------+            |
|         |              AGGREGATE RESULTS                 |            |
|         |  - Deduplicate issues                          |            |
|         |  - Sort by severity                            |            |
|         |  - Group by file                               |            |
|         +------------------------+-----------------------+            |
|                                  |                                    |
|                                  v                                    |
|         +------------------------------------------------+            |
|         |              GENERATE REPORT                   |            |
|         |  - Display to console                          |            |
|         |  - Save to docs/code-reviews/                  |            |
|         +------------------------------------------------+            |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

### First-Time Setup Flow

```
+-----------------------------------------------------------------------+
|                      FIRST-TIME SETUP FLOW                            |
+-----------------------------------------------------------------------+
|                                                                       |
|  Check: .claude/plugins/maccing/code-reviewer.json                    |
|                        |                                              |
|                        v                                              |
|              Config not found                                         |
|                        |                                              |
|                        v                                              |
|  +-----------------------------------------------------------+        |
|  | SCAN FOR RULE FILES                                       |        |
|  |                                                           |        |
|  |   ls -la CLAUDE.md rules/*.md .claude/*.md                |        |
|  |                                                           |        |
|  |   Found:                                                  |        |
|  |   - CLAUDE.md                                             |        |
|  |   - rules/CODE_STYLE.md                                   |        |
|  |   - rules/SECURITY.md                                     |        |
|  +-----------------------------------------------------------+        |
|                        |                                              |
|                        v                                              |
|  +-----------------------------------------------------------+        |
|  | PROMPT: SELECT RULE FILES (AskUserQuestion tool)          |        |
|  |                                                           |        |
|  |   Which rule files should I use for reviews?              |        |
|  |                                                           |        |
|  |   [1] CLAUDE.md (detected)                                |        |
|  |   [2] rules/CODE_STYLE.md (detected)                      |        |
|  |   [3] Add custom path...                                  |        |
|  |   [4] Skip (discover patterns from codebase)              |        |
|  +-----------------------------------------------------------+        |
|                        |                                              |
|                        v                                              |
|  +-----------------------------------------------------------+        |
|  | PROMPT: SELECT AGENTS (AskUserQuestion tool)              |        |
|  |                                                           |        |
|  |   Which agents should run during reviews?                 |        |
|  |                                                           |        |
|  |   [1] All agents (Recommended)                            |        |
|  |   [2] Select specific agents                              |        |
|  +-----------------------------------------------------------+        |
|                        |                                              |
|                        v                                              |
|  +-----------------------------------------------------------+        |
|  | SAVE CONFIGURATION (Write tool)                           |        |
|  |                                                           |        |
|  |   mkdir -p .claude/plugins/maccing                        |        |
|  |                                                           |        |
|  |   {                                                       |        |
|  |     "ruleFiles": ["CLAUDE.md", "rules/..."],              |        |
|  |     "agents": ["naming", "code-style", ...],              |        |
|  |     "customAgents": []                                    |        |
|  |   }                                                       |        |
|  +-----------------------------------------------------------+        |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

### Rule Extraction Flow

```
+-----------------------------------------------------------------------+
|                       RULE EXTRACTION FLOW                            |
+-----------------------------------------------------------------------+
|                                                                       |
|  READ ALL RULE FILES                                                  |
|                                                                       |
|  ruleFiles: ["CLAUDE.md", "rules/CODE_STYLE.md", "rules/CONVENTIONS.md"]
|                                                                       |
|  For EACH file:                                                       |
|    1. Read entire file content                                        |
|    2. Scan for rules related to ALL categories                        |
|    3. Extract and aggregate rules                                     |
|                                                                       |
+-----------------------------------------------------------------------+
|                                                                       |
|  CATEGORY KEYWORD MATCHING                                            |
|                                                                       |
|  +-------------+--------------------------------------------------+   |
|  | Category    | Keywords to Look For                             |   |
|  +-------------+--------------------------------------------------+   |
|  | naming      | naming, variables, functions, constants,         |   |
|  |             | boolean, prefix, suffix, conventions             |   |
|  +-------------+--------------------------------------------------+   |
|  | code-style  | style, formatting, spacing, imports,             |   |
|  |             | ternary, composition, patterns                   |   |
|  +-------------+--------------------------------------------------+   |
|  | clean-code  | clean, unused, comments, types, any,             |   |
|  |             | error handling, dead code                        |   |
|  +-------------+--------------------------------------------------+   |
|  | architecture| architecture, layers, boundaries, imports,       |   |
|  |             | dependencies, separation, structure              |   |
|  +-------------+--------------------------------------------------+   |
|  | security    | security, auth, validation, injection,           |   |
|  |             | secrets, vulnerabilities, sanitization           |   |
|  +-------------+--------------------------------------------------+   |
|  | i18n        | i18n, internationalization, translation,         |   |
|  |             | locale, localization                             |   |
|  +-------------+--------------------------------------------------+   |
|                                                                       |
+-----------------------------------------------------------------------+
|                                                                       |
|  AGGREGATE RULES PER CATEGORY                                         |
|                                                                       |
|  CLAUDE.md:                                                           |
|  |-- naming:       5 rules extracted                                  |
|  |-- code-style:   3 rules extracted                                  |
|  +-- security:     2 rules extracted                                  |
|                                                                       |
|  rules/CODE_STYLE.md:                                                 |
|  |-- code-style:   8 rules extracted                                  |
|  +-- clean-code:   4 rules extracted                                  |
|                                                                       |
|  AGGREGATED TOTALS:                                                   |
|  - naming:       12 rules (CLAUDE.md + CONVENTIONS.md)                |
|  - code-style:   11 rules (CLAUDE.md + CODE_STYLE.md)                 |
|  - clean-code:   4 rules  (CODE_STYLE.md)                             |
|  - architecture: 3 rules  (CONVENTIONS.md)                            |
|  - security:     2 rules  (CLAUDE.md)                                 |
|  - i18n:         0 rules  -> GAP (Pattern Discovery)                  |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

### Pattern Discovery Flow

```
+-----------------------------------------------------------------------+
|                      PATTERN DISCOVERY FLOW                           |
+-----------------------------------------------------------------------+
|                                                                       |
|  For EACH gap category, spawn a pattern-discovery-agent:              |
|                                                                       |
|  1. SCAN                                                              |
|     find . -type f \( -name "*.ts" -o -name "*.tsx" \)                |
|            -not -path "*/node_modules/*"                              |
|     Result: 142 files found                                           |
|                        |                                              |
|                        v                                              |
|  2. READ                                                              |
|     Read EVERY file exhaustively                                      |
|     (No sampling, no shortcuts)                                       |
|                        |                                              |
|                        v                                              |
|  3. EXTRACT                                                           |
|     For naming category:                                              |
|     - Boolean variables: what prefixes? (is, has, can, none)          |
|     - Functions: verb-first or noun-first?                            |
|     - Constants: UPPER_SNAKE or camelCase?                            |
|     - Components: descriptive or generic?                             |
|                        |                                              |
|                        v                                              |
|  4. COUNT                                                             |
|     Build statistics:                                                 |
|                                                                       |
|     Boolean Prefixes:                                                 |
|     |-- is*     -> 89 occurrences                                     |
|     |-- has*    -> 22 occurrences                                     |
|     |-- can*    -> 6 occurrences                                      |
|     +-- none    -> 2 occurrences                                      |
|     Total: 122 booleans                                               |
|                        |                                              |
|                        v                                              |
|  5. ANALYZE                                                           |
|     Calculate consistency percentages:                                |
|                                                                       |
|     Boolean prefixes used: (89+22+6+3) / 122 = 98.4%                  |
|     |-- is*     -> 73% of all booleans                                |
|     |-- has*    -> 18% of all booleans                                |
|     +-- can*    -> 5% of all booleans                                 |
|                        |                                              |
|                        v                                              |
|  6. THRESHOLD                                                         |
|     Apply 60% consistency threshold:                                  |
|                                                                       |
|     +-----------------------------+-------------+-----------+         |
|     | Pattern                     | Consistency | Adopted?  |         |
|     +-----------------------------+-------------+-----------+         |
|     | Boolean prefixes (is/has/ca)| 98.4%       | YES       |         |
|     | Functions verb-first        | 91%         | YES       |         |
|     | Constants UPPER_SNAKE       | 64%         | YES       |         |
|     | Enum values uppercase       | 55%         | NO        |         |
|     +-----------------------------+-------------+-----------+         |
|                        |                                              |
|                        v                                              |
|  7. SAVE                                                              |
|     Store to .claude/plugins/maccing/discovered-patterns.json         |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

### Agent Execution Flow

```
+-----------------------------------------------------------------------+
|                       AGENT EXECUTION FLOW                            |
+-----------------------------------------------------------------------+
|                                                                       |
|  PARALLEL AGENT SPAWNING (Task tool, single message)                  |
|                                                                       |
|  +--------+  +--------+  +--------+  +--------+  +--------+           |
|  | naming |  | style  |  | clean  |  | arch   |  |security|           |
|  +---+----+  +---+----+  +---+----+  +---+----+  +---+----+           |
|      |           |           |           |           |                |
|      v           v           v           v           v                |
|  +-------------------------------------------------------+            |
|  |              EACH AGENT EXECUTES:                     |            |
|  |                                                       |            |
|  |  1. LOAD RULES                                        |            |
|  |     |-- If explicit rules exist -> Read rule file     |            |
|  |     +-- If gap -> Read discovered-patterns.json       |            |
|  |                                                       |            |
|  |  2. FOR EACH FILE:                                    |            |
|  |     +-- Execute ULTRATHINK Loop                       |            |
|  |                                                       |            |
|  |  3. RETURN RESULTS                                    |            |
|  |     +-- Structured list of issues found               |            |
|  +-------------------------------------------------------+            |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

### ULTRATHINK Loop

```
+-----------------------------------------------------------------------+
|                         ULTRATHINK LOOP                               |
+-----------------------------------------------------------------------+
|                                                                       |
|  For EACH file, execute this loop:                                    |
|                                                                       |
|     +--------+                                                        |
|     |  READ  |  Read file content completely                          |
|     +---+----+                                                        |
|         |                                                             |
|         v                                                             |
|     +--------+                                                        |
|     | RULES  |  Reference rules (explicit or discovered)              |
|     +---+----+                                                        |
|         |                                                             |
|         v                                                             |
|   +---------------+                                                   |
|   |  ULTRATHINK   |  Phase 1: Deep Analysis                           |
|   |   (Phase 1)   |  - What patterns apply to this file?              |
|   |               |  - What could go wrong?                           |
|   |               |  - What are ALL elements to check?                |
|   +-------+-------+                                                   |
|           |                                                           |
|           v                                                           |
|     +--------+                                                        |
|     | CHECK  |  Verify each pattern meticulously                      |
|     +---+----+                                                        |
|         |                                                             |
|         v                                                             |
|   +---------------+                                                   |
|   |  ULTRATHINK   |  Phase 2: Validation                              |
|   |   (Phase 2)   |  - Is this REALLY a violation?                    |
|   |               |  - Could it be intentional?                       |
|   |               |  - Did I miss anything?                           |
|   +-------+-------+                                                   |
|           |                                                           |
|           v                                                           |
|     +--------+                                                        |
|     | RESULT |  Document findings: file:line, issue, severity         |
|     +---+----+                                                        |
|         |                                                             |
|         +-----> (next file, loop back to READ)                        |
|                                                                       |
+-----------------------------------------------------------------------+
|                                                                       |
|  THINKING DEPTH HIERARCHY:                                            |
|                                                                       |
|  think        -> Basic consideration           NOT ENOUGH             |
|  think hard   -> Deeper analysis               NOT ENOUGH             |
|  think harder -> Extended analysis             STILL NOT ENOUGH       |
|  ultrathink   -> Maximum depth analysis        USE THIS               |
|                                                                       |
+-----------------------------------------------------------------------+
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

### Initial Banner (with scope)

```
★ maccing-code-reviewer v1.1.0 ═════════════════════════

Scope: Full Codebase

════════════════════════════════════════════════════════
```

### First-Time Setup Output

```
★ maccing-code-reviewer: First-time Setup ══════════════

Scanning for project rules...
```

### Setup Complete Confirmation

```
★ maccing-code-reviewer: Setup Complete ════════════════

Config: .claude/plugins/maccing/code-reviewer.json
Rules:  CLAUDE.md
Agents: naming, code-style, clean-code, architecture, security, i18n

════════════════════════════════════════════════════════
```

### Rules Loaded Output

```
★ maccing-code-reviewer: Rules Loaded ══════════════════

Files: 3
- CLAUDE.md
- rules/CODE_STYLE.md
- rules/CONVENTIONS.md

Rules per category:
- naming:       12 rules
- code-style:   8 rules
- clean-code:   5 rules
- architecture: 0 rules → Pattern Discovery
- security:     3 rules
- i18n:         0 rules → Pattern Discovery

════════════════════════════════════════════════════════
```

### Pattern Discovery Output

```
★ maccing-code-reviewer: Pattern Discovery ═════════════

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
```

### Review Progress Output

```
★ maccing-code-reviewer: Review Scope ══════════════════

Mode:   Git Changes
Files:  12 files to review
Config: .claude/plugins/maccing/code-reviewer.json

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

### Agent Progress Output

```
★ maccing-code-reviewer: Agent Progress ════════════════

naming-agent: Phase 1 done, Phase 2 done, 3 issues found

code-style-agent: Phase 1 done, Phase 2 done, 2 issues found

clean-code-agent: Phase 1 done, Phase 2 done, 1 issue found

architecture-agent: Phase 1 done, Phase 2 done, 0 issues found

security-agent: Phase 1 done, Phase 2 done, 1 CRITICAL issue found

Results:
- naming-agent: 3 issues
- code-style-agent: 2 issues
- clean-code-agent: 1 issue
- architecture-agent: 0 issues
- security-agent: 1 CRITICAL issue
- i18n-agent: skipped (no locale files)

════════════════════════════════════════════════════════
```

### Final Report Output

```
★ maccing-code-reviewer: Code Review Report ════════════

Date:     2025-12-31 14:30
Branch:   feature/auth
Files:    12
Issues:   11

Rules Used:
- naming: discovered (4 patterns, 96% avg consistency)
- code-style: explicit (CLAUDE.md)
- architecture: discovered (3 patterns, 88% avg consistency)

Summary:
- CRITICAL: 1
- HIGH: 3
- MEDIUM: 5
- LOW: 2

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

─────────────────────────────────────────────────────────

Agent Summary:
- security-agent: 1 issue
- naming-agent: 3 issues
- code-style-agent: 2 issues
- clean-code-agent: 1 issue
- architecture-agent: 0 issues
- i18n-agent: 4 issues

════════════════════════════════════════════════════════
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

### No Scope Specified

If user runs `/maccing-code-reviewer:review` without scope:

```
★ maccing-code-reviewer ════════════════════════════════
```

Then the AskUserQuestion tool is invoked with EXACTLY these options:
1. **Git Changes**: Review only files changed in git
2. **Full Codebase**: Review all source files in the project
3. **Specific Path**: Review files in a specific folder

---

## Philosophy

- **Discovery-first**: Learn from YOUR codebase, not generic rules
- **Thorough over fast**: Exhaustive analysis, no shortcuts
- **Evidence over claims**: Percentages and counts for transparency
- **Project-aware**: Respect established patterns
- **Transparent**: Show what was discovered and why

---

## Troubleshooting

### Check installed version

```bash
cat ~/.claude/plugins/marketplaces/maccing/plugins/maccing-code-reviewer/.claude-plugin/plugin.json | grep version
```

Expected: `"version": "1.1.0"`

### Plugin not updating

If changes don't appear after update:

**Fix:** Clear both cache and marketplace, then reinstall:
```bash
rm -rf ~/.claude/plugins/cache/maccing
rm -rf ~/.claude/plugins/marketplaces/maccing
/plugin marketplace add andredezzy/maccing
/plugin install maccing-code-reviewer@maccing
```

**Verify update:**
```bash
cat ~/.claude/plugins/marketplaces/maccing/plugins/maccing-code-reviewer/.claude-plugin/plugin.json | grep version
```

Expected: `"version": "1.1.0"`

### Output not colored

If the `★ maccing-code-reviewer` headers appear but aren't colored:

**Cause:** Old cached version without backticks for colored rendering.

**Fix:** Full reinstall:
```bash
rm -rf ~/.claude/plugins/cache/maccing
rm -rf ~/.claude/plugins/marketplaces/maccing
/plugin marketplace add andredezzy/maccing
/plugin install maccing-code-reviewer@maccing
```

### Wrong command name (code-review instead of review)

If you see `/maccing-code-reviewer:code-review` instead of `/maccing-code-reviewer:review`:

**Cause:** Cached old version of the plugin.

**Fix:**
```bash
rm -rf ~/.claude/plugins/cache/maccing
/plugin install maccing-code-reviewer@maccing
```

### Conflicting with other code review plugins

If another code review plugin is invoked instead of maccing:

**Cause:** Other plugins with similar names or descriptions.

**Check installed plugins:**
```bash
find ~/.claude/plugins -type d -name "code-review" 2>/dev/null
```

**Fix:** Uninstall conflicting plugins:
```
/plugin uninstall code-review@claude-code-plugins
/plugin uninstall code-review@claude-plugins-official
```

### First-time setup not triggering

If the plugin skips setup questions:

**Cause:** Config file already exists from previous installation.

**Fix:** Delete the config to trigger setup again:
```bash
rm -rf .claude/plugins/maccing/
```

### Inconsistent scope options

If the scope question shows different options each time:

**Cause:** Old cached version without explicit JSON instructions.

**Fix:** Full reinstall (see "Plugin not updating" above).

---

## License

MIT
