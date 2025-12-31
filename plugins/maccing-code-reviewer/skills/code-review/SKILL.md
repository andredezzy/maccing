---
name: code-review
description: Reviews code for quality, security, and conventions using multi-agent ULTRATHINK methodology. Use when reviewing changes, checking PRs, or analyzing code quality.
---

# Code Review Skill

You are performing a comprehensive code review using the **multi-agent loop methodology** with **ULTRATHINK** level analysis.

**CRITICAL: Use "ultrathink" for all analysis phases.** This triggers extended thinking for deep, thorough verification. Do not use shallow "think", every analysis must be rigorous.

## Step 1: Check Configuration

First, check if `.claude/plugins/maccing/code-reviewer.json` exists:

```bash
cat .claude/plugins/maccing/code-reviewer.json 2>/dev/null || echo "NO_CONFIG"
```

### If NO_CONFIG: Run First-Time Setup

Display this prompt to the user:

```
★ maccing-code-reviewer ════════════════════════════════

First-time setup

Scanning for project rules...
```

Then scan for common rule file locations:

```bash
ls -la CLAUDE.md rules/*.md .claude/*.md 2>/dev/null || echo "NO_RULES_FOUND"
```

Present found files and ask user to select which to use:

```
Configure Code Reviewer
------------------------

Which rule files should I use for reviews?

  [1] CLAUDE.md (detected)
  [2] rules/CODE_STYLE.md (detected)
  [3] Add custom path...
  [4] Skip (discover patterns from codebase)

> Select (comma-separated):
```

Then ask about agents:

```
Review Agents
-------------

  [1] naming-agent       Naming conventions
  [2] code-style-agent   Formatting and patterns
  [3] clean-code-agent   Code quality
  [4] architecture-agent Layer boundaries
  [5] security-agent     Security vulnerabilities
  [6] i18n-agent         Internationalization

> Select (comma-separated, or 'all'):
```

Create the directory and save the configuration:

```bash
mkdir -p .claude/plugins/maccing
```

Save to `.claude/plugins/maccing/code-reviewer.json`:

```json
{
  "ruleFiles": ["CLAUDE.md", "rules/CODE_STYLE.md"],
  "agents": ["naming", "code-style", "clean-code", "architecture", "security", "i18n"],
  "customAgents": []
}
```

## Step 2: Get Changed Files

Identify all files to review:

```bash
git diff --name-only HEAD
```

If no changes, check staged files:

```bash
git diff --cached --name-only
```

## Step 3: Read Explicit Rules and Identify Gaps

Read all rule files specified in `.claude/plugins/maccing/code-reviewer.json`.

**IMPORTANT: No built-in defaults.** If a category has no explicit rules, pattern discovery will be used.

For each enabled agent, check if explicit rules exist:

| Agent | Has Explicit Rules If... |
|-------|--------------------------|
| naming-agent | `NAMING.md` exists OR naming section in `CLAUDE.md` |
| code-style-agent | `CODE_STYLE.md` exists OR style section in rules |
| architecture-agent | `ARCHITECTURE.md` exists OR architecture section |
| clean-code-agent | `CLEAN_CODE.md` exists OR clean code section |
| security-agent | `SECURITY.md` exists OR security section |
| i18n-agent | i18n rules exist OR no locale files in project |

Track which categories have gaps (no explicit rules).

## Step 4: Pattern Discovery Phase

**CRITICAL: This step runs EVERY review for categories without explicit rules.**

For each category with a gap, run pattern discovery to learn conventions from the codebase.

### Display Discovery Start

```
★ Pattern Discovery ════════════════════════════════════

Scanning codebase for implicit conventions...
```

### Spawn Pattern Discovery Agents

Use the Task tool to spawn discovery agents **in parallel** for each gap category.

**pattern-discovery-agent (naming):**
```
You are the pattern-discovery-agent for NAMING conventions.

CRITICAL: Use ULTRATHINK for exhaustive analysis.

Your job is to scan the ENTIRE codebase and discover naming patterns.

1. SCAN - Find all relevant files:
   ```bash
   find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -not -path "*/node_modules/*" -not -path "*/.git/*"
   ```

2. READ - Read every file exhaustively

3. EXTRACT - For each file, identify:
   - Boolean variables: what prefixes are used? (is, has, can, should, will, none)
   - Functions: verb-first or noun-first naming?
   - Constants: UPPER_SNAKE_CASE or camelCase?
   - Components: descriptive or generic names?
   - Interfaces/Types: what suffixes? (Props, Config, Options, Request, Response)

4. COUNT - Build statistics:
   - Total booleans found
   - Count per prefix type
   - Total functions found
   - Count verb-first vs noun-first
   - etc.

5. CALCULATE - Compute consistency percentages:
   - "X% of booleans use is/has prefix"
   - "Y% of functions start with verb"

6. THRESHOLD - Mark patterns with >60% consistency as ADOPTED

7. RETURN - Structured JSON with patterns and evidence:
   {
     "category": "naming",
     "filesAnalyzed": 142,
     "patterns": [
       {
         "name": "Boolean Prefixes",
         "rule": "Booleans should use is/has/can prefixes",
         "evidence": { "total": 122, "matches": { "is": 89, "has": 22, "can": 6 }, "consistency": 0.96 },
         "adopted": true
       }
     ]
   }
```

**pattern-discovery-agent (code-style):**
```
You are the pattern-discovery-agent for CODE STYLE conventions.

CRITICAL: Use ULTRATHINK for exhaustive analysis.

Your job is to scan the ENTIRE codebase and discover code style patterns.

1. SCAN - Find all relevant files

2. READ - Read every file exhaustively

3. EXTRACT - For each file, identify:
   - Import ordering: external first? Alphabetical? Grouped?
   - Spacing: blank lines between functions? Sections?
   - Conditionals: ternary usage vs if/else?
   - Destructuring: preferred or avoided?
   - Arrow functions vs function declarations

4. COUNT - Build statistics for each pattern

5. CALCULATE - Compute consistency percentages

6. THRESHOLD - Mark patterns with >60% consistency as ADOPTED

7. RETURN - Structured JSON with patterns and evidence
```

**pattern-discovery-agent (architecture):**
```
You are the pattern-discovery-agent for ARCHITECTURE conventions.

CRITICAL: Use ULTRATHINK for exhaustive analysis.

Your job is to scan the ENTIRE codebase and discover architecture patterns.

1. SCAN - Map the folder structure:
   ```bash
   find . -type d -not -path "*/node_modules/*" -not -path "*/.git/*"
   ```

2. READ - Read every source file

3. EXTRACT - For each file, identify:
   - What folder is it in? (components/, pages/, utils/, hooks/, services/, api/)
   - What does it import? Map import paths to folders
   - Build a dependency graph: which folders import from which?

4. ANALYZE - Identify boundaries:
   - Does components/ ever import from pages/? (violation)
   - Does utils/ ever import from components/? (violation)
   - Are there circular dependencies?

5. COLOCATION - Check file organization:
   - Are *.test.ts files next to source files?
   - Are *.types.ts files next to source files?
   - One component per file?

6. CALCULATE - Compute consistency percentages

7. THRESHOLD - Mark patterns with >60% consistency as ADOPTED

8. RETURN - Structured JSON with patterns and evidence
```

**pattern-discovery-agent (clean-code):**
```
You are the pattern-discovery-agent for CLEAN CODE conventions.

CRITICAL: Use ULTRATHINK for exhaustive analysis.

Your job is to scan the ENTIRE codebase and discover clean code patterns.

1. SCAN - Find all relevant files

2. READ - Read every file exhaustively

3. EXTRACT - For each file, identify:
   - Type safety: `any` usage vs `unknown`?
   - Error handling: typed catch blocks? Custom error classes?
   - Comments: explain "why" or "what"?
   - Code organization: early returns? Guard clauses?

4. COUNT - Build statistics for each pattern

5. CALCULATE - Compute consistency percentages

6. THRESHOLD - Mark patterns with >60% consistency as ADOPTED

7. RETURN - Structured JSON with patterns and evidence
```

**pattern-discovery-agent (security):**
```
You are the pattern-discovery-agent for SECURITY conventions.

CRITICAL: Use ULTRATHINK for exhaustive analysis.

Your job is to scan the ENTIRE codebase and discover security patterns.

1. SCAN - Find all relevant files, especially:
   - API routes, controllers, handlers
   - Authentication/authorization code
   - Input validation code
   - Database queries

2. READ - Read every file exhaustively

3. EXTRACT - For each file, identify:
   - Input validation: where does it happen? (boundaries, everywhere, nowhere)
   - Auth checks: middleware? Per-route? Centralized?
   - Query building: parameterized? String concatenation?
   - Secret handling: env vars? Config files? Hardcoded?

4. COUNT - Build statistics for each pattern

5. CALCULATE - Compute consistency percentages

6. THRESHOLD - Mark patterns with >60% consistency as ADOPTED

7. RETURN - Structured JSON with patterns and evidence
```

### Save Discovered Patterns

After all discovery agents complete, save to `.claude/plugins/maccing/discovered-patterns.json`:

```json
{
  "discoveredAt": "2025-12-31T12:45:00Z",
  "filesAnalyzed": 142,
  "categories": {
    "naming": {
      "hasExplicitRules": false,
      "patterns": [...]
    }
  }
}
```

### Display Discovery Results

```
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

### Edge Cases

**No patterns detected:**
```
naming patterns discovered:

  No patterns detected, codebase too small for inference

  Skipping naming checks for this review.
```

**No files for category:**
```
i18n patterns discovered:

  No locale files found to analyze

  Skipping i18n checks for this review.
```

## Step 5: Spawn Category Agents in Parallel

Use the Task tool to spawn these agents **in parallel** (single message, multiple tool calls).

Only spawn agents that are enabled in the configuration.

Each agent receives EITHER:
- Explicit rules (if they exist)
- Discovered patterns (from Step 4)

### Agent Prompts

**naming-agent:**
```
You are the naming-agent. Your job is to verify naming conventions.

CRITICAL: Use ULTRATHINK for all analysis. Think harder and deeper than normal.

FIRST: Read the naming rules. Use EITHER:
- Explicit rules from project configuration
- Discovered patterns from .claude/plugins/maccing/discovered-patterns.json

Then for EACH changed file, execute this loop:

1. READ - Read the file content completely
2. RULES - Reference the rules (explicit or discovered)
3. ULTRATHINK - Think very hard about what naming patterns apply to this file.
   Consider every variable, function, interface, type, component, and enum.
4. CHECK - Verify each pattern meticulously:
   - Boolean variables follow the discovered/explicit prefix patterns
   - Interface suffixes match the established conventions
   - Enum values follow the established casing
   - Component names match the descriptiveness pattern
   - Constants follow the established casing
   - Functions follow the established naming pattern
5. ULTRATHINK - Think even harder. Is this really a violation? Could it be intentional?
   Are there edge cases? Did I miss any names? Re-scan the file.
6. RESULT - Document: file:line, issue, correct pattern
7. NEXT - Move to next file

Return a structured list of all naming violations found.
```

**code-style-agent:**
```
You are the code-style-agent. Your job is to verify code formatting and patterns.

CRITICAL: Use ULTRATHINK for all analysis. Think harder and deeper than normal.

FIRST: Read the code style rules. Use EITHER:
- Explicit rules from project configuration
- Discovered patterns from .claude/plugins/maccing/discovered-patterns.json

Then for EACH changed file, execute this loop:

1. READ - Read the file content completely
2. RULES - Reference the style rules (explicit or discovered)
3. ULTRATHINK - Think very hard about what style patterns apply to this file.
   Examine every line, every block, every JSX element.
4. CHECK - Verify each pattern meticulously:
   - Import ordering matches established pattern
   - Spacing and blank lines match established pattern
   - Conditional rendering matches established pattern
   - Proper composition patterns
   - React keys (no Math.random(), no bare index)
5. ULTRATHINK - Think even harder. Is this really a violation? Could the formatting
   be intentional? Are there edge cases? Re-scan the file line by line.
6. RESULT - Document: file:line, issue, correct pattern
7. NEXT - Move to next file

Return a structured list of all style violations found.
```

**clean-code-agent:**
```
You are the clean-code-agent. Your job is to verify clean code principles.

CRITICAL: Use ULTRATHINK for all analysis. Think harder and deeper than normal.

FIRST: Read the clean code rules. Use EITHER:
- Explicit rules from project configuration
- Discovered patterns from .claude/plugins/maccing/discovered-patterns.json

Then for EACH changed file, execute this loop:

1. READ - Read the file content completely
2. RULES - Reference the clean code rules (explicit or discovered)
3. ULTRATHINK - Think very hard about what clean code patterns apply.
   Trace every variable usage. Check every import. Analyze every comment.
4. CHECK - Verify each pattern meticulously:
   - No unused variables, imports, functions
   - No commented-out code
   - Comments explain "why" not "what"
   - Type safety matches established pattern (any vs unknown)
   - Error handling matches established pattern
   - No nested ternaries
5. ULTRATHINK - Think even harder. Is this variable really unused or is it used
   elsewhere? Is this comment really obvious? Trace all references. Re-verify.
6. RESULT - Document: file:line, issue, correct pattern
7. NEXT - Move to next file

Return a structured list of all clean code violations found.
```

**architecture-agent:**
```
You are the architecture-agent. Your job is to verify architecture and organization.

CRITICAL: Use ULTRATHINK for all analysis. Think harder and deeper than normal.

FIRST: Read the architecture rules. Use EITHER:
- Explicit rules from project configuration
- Discovered patterns from .claude/plugins/maccing/discovered-patterns.json

Then for EACH changed file, execute this loop:

1. READ - Read the file content completely
2. RULES - Reference the architecture rules (explicit or discovered)
3. ULTRATHINK - Think very hard about what layer this file is in.
   What are its dependencies? What imports it? What does it import?
   Map out the dependency graph mentally.
4. CHECK - Verify each pattern meticulously:
   - Import boundaries match established patterns
   - Separation of concerns (UI vs business logic)
   - Dependencies flow according to established direction
   - File colocation matches established pattern
   - One component/class per file (if established)
   - No circular dependencies
5. ULTRATHINK - Think even harder. Is this a real architectural violation or an
   acceptable exception? What are the implications? Would this create circular deps?
   Trace the full dependency chain.
6. RESULT - Document: file:line, issue, correct pattern
7. NEXT - Move to next file

Return a structured list of all architecture violations found.
```

**security-agent:**
```
You are the security-agent. Your job is to verify security patterns.

CRITICAL: Use ULTRATHINK for all analysis. Security requires the deepest thinking.

FIRST: Read the security rules. Use EITHER:
- Explicit rules from project configuration
- Discovered patterns from .claude/plugins/maccing/discovered-patterns.json

Then for EACH changed file, execute this loop:

1. READ - Read the file content completely
2. RULES - Reference the security rules (explicit or discovered)
3. ULTRATHINK - Think very hard about attack vectors.
   How could an attacker exploit this code? What inputs are untrusted?
   Where does data come from? Where does it go?
4. CHECK - Verify each pattern with extreme scrutiny:
   - No secrets in code (API keys, passwords, tokens)
   - Input validation matches established pattern
   - No SQL injection vulnerabilities
   - No XSS vulnerabilities
   - No command injection
   - Auth checks match established pattern
   - No sensitive data in logs
5. ULTRATHINK - Think even harder. Could an attacker bypass this check?
   What if they send malformed input? What if they're authenticated but
   shouldn't have access? Think like a malicious actor. Re-verify.
6. RESULT - Document: file:line, issue, severity (CRITICAL/HIGH/MEDIUM), attack vector
7. NEXT - Move to next file

Return a structured list of all security issues found. Be paranoid.
```

**i18n-agent:**
```
You are the i18n-agent. Your job is to verify internationalization.

CRITICAL: Use ULTRATHINK for all analysis. Think harder and deeper than normal.

FIRST: Check for locale files in common locations (messages/, locales/, i18n/).

Then for EACH changed file that contains user-facing text, execute this loop:

1. READ - Read the file content completely
2. RULES - All user-facing text must use translation keys
3. ULTRATHINK - Think very hard about what text is user-facing.
   Check every string literal. Is it displayed to users? Is it a label?
   A button? A toast message? An error? A placeholder?
4. CHECK - Verify each pattern meticulously:
   - All visible text uses translation functions/hooks
   - No hardcoded strings for UI text
   - Error messages use translation keys
   - Proper pluralization handling if applicable
5. ULTRATHINK - Think even harder. Did I miss any strings? Check every JSX
   element. Check every toast call. Check every error message.
6. RESULT - Document: file:line, issue, missing translation key
7. NEXT - Move to next file

Return a structured list of all i18n issues found.
```

## Step 6: Show Progress

Display the initial review info with full context:

`★ maccing-code-reviewer ════════════════════════════════`

Review Started

Config:   `.claude/plugins/maccing/code-reviewer.json`
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

`════════════════════════════════════════════════════════`

After all agents complete, show consolidated progress:

`★ maccing-code-reviewer ════════════════════════════════`

Agent Progress:

`naming-agent` — Phase 1: done, Phase 2: done — 3 issues found

`code-style-agent` — Phase 1: done, Phase 2: done — 2 issues found

`clean-code-agent` — Phase 1: done, Phase 2: done — 1 issue found

`architecture-agent` — Phase 1: done, Phase 2: done — 0 issues found

`security-agent` — Phase 1: done, Phase 2: done — 1 CRITICAL issue found

Results:
- naming-agent: 3 issues
- code-style-agent: 2 issues
- clean-code-agent: 1 issue
- architecture-agent: 0 issues
- security-agent: 1 CRITICAL issue
- i18n-agent: skipped (no locale files)

`════════════════════════════════════════════════════════`

## Step 7: Aggregate Results

After all agents complete, aggregate their findings:

1. **Deduplicate** Remove duplicate issues reported by multiple agents
2. **Sort by severity** CRITICAL > HIGH > MEDIUM > LOW
3. **Group by file** Organize issues by file path

## Step 8: Generate Report

Output the final review using inline backticks for colored headers:

`★ Code Review Report ═══════════════════════════════════`

Date:     YYYY-MM-DD HH:mm
Branch:   `feature/example`
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

`Verdict: REQUEST CHANGES`
Critical and high priority issues must be addressed.

`─────────────────────────────────────────────────────────`

Issues:

`✖ CRITICAL` — `src/auth.ts:42`
Agent: security-agent
Issue: Tenant ID accepted from request body
Pattern: Never accept tenantId from frontend

`▲ HIGH` — `src/utils/helpers.ts:15`
Agent: naming-agent
Issue: Boolean variable missing prefix
Pattern: Discovered: 96% of booleans use is/has/can prefix

`─────────────────────────────────────────────────────────`

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

`═══════════════════════════════════════════════════════`

For each issue, also show the code fix:

```typescript
// Bad
const tenantId = input.tenantId;

// Good
const tenantId = ctx.tenant.id;
```

## Step 9: Save Review to Documentation

**CRITICAL: Always save the code review report to the `docs/code-reviews/` folder.**

### File Naming Convention

```
docs/code-reviews/YYYY-MM-DD-HHmm-<scope>.md
```

Where `<scope>` is:
- The branch name (e.g., `feature-chat`, `fix-auth-bug`)
- Or a descriptive scope (e.g., `git-changes`, `pr-123`)

### How to Determine the Scope

1. Get the current branch name:
   ```bash
   git branch --show-current
   ```

2. Use the branch name as scope, sanitized for filenames:
   - Replace `/` with `-` (e.g., `feature/chat` -> `feature-chat`)
   - Lowercase
   - Keep only alphanumeric and hyphens

3. Create the docs directory if it doesn't exist:
   ```bash
   mkdir -p docs/code-reviews
   ```

4. Save the full report using the Write tool.

## Step 10: Handle Custom Agents

If `.claude/plugins/maccing/code-reviewer.json` contains `customAgents`, spawn those in parallel with the built-in agents.

For each custom agent:

```
You are the {name}. Your job is: {description}

CRITICAL: Use ULTRATHINK for all analysis.

FIRST: Read the rules from {ruleFile}. If no ruleFile specified, use discovered patterns.

Then for EACH changed file, execute this loop:

1. READ - Read the file content completely
2. RULES - Reference the rules you read
3. ULTRATHINK - Think very hard about what patterns apply.
4. CHECK - Verify each pattern:
   {checks as bullet list}
5. ULTRATHINK - Think even harder. Verify everything.
6. RESULT - Document: file:line, issue, correct pattern
7. NEXT - Move to next file

Return a structured list of all issues found.
```

## CRITICAL: The ULTRATHINK Loop

Remember, each agent MUST execute the full loop for EACH file:

```
READ -> RULES -> ULTRATHINK -> CHECK -> ULTRATHINK -> RESULT -> NEXT
        ^                                              |
        +-------------- (next file) -------------------+
```

### ULTRATHINK Phases (Non-Negotiable)

| Phase | Purpose | What to Think About |
|-------|---------|---------------------|
| **First ULTRATHINK** | Deep analysis | What patterns apply? What could go wrong? What are all the elements to check? |
| **Second ULTRATHINK** | Validation | Is this really a violation? Could it be intentional? Did I miss anything? Re-scan everything. |

### Thinking Depth Hierarchy

```
think        -> Basic consideration (NOT ENOUGH)
think hard   -> Deeper analysis (NOT ENOUGH)
think harder -> Extended analysis (STILL NOT ENOUGH)
ultrathink   -> Maximum depth analysis (USE THIS)
```

**Every ULTRATHINK phase must be thorough.** Question everything. Verify everything. Miss nothing.
