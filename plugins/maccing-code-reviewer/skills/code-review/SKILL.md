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
[*] First-time setup for maccing-code-reviewer

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
  [4] Skip (use built-in defaults only)

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

## Step 3: Read the Rules

Read all rule files specified in `.claude/plugins/maccing/code-reviewer.json`. If no config exists, use the built-in defaults from the plugin's `defaults/` folder:

- `defaults/NAMING.md`
- `defaults/CLEAN_CODE.md`
- `defaults/SECURITY.md`
- `defaults/ARCHITECTURE.md`

## Step 4: Spawn Category Agents in Parallel

Use the Task tool to spawn these agents **in parallel** (single message, multiple tool calls).

Only spawn agents that are enabled in the configuration.

### Agent Prompts

**naming-agent:**
```
You are the naming-agent. Your job is to verify naming conventions.

CRITICAL: Use ULTRATHINK for all analysis. Think harder and deeper than normal.

FIRST: Read the naming rules from the project configuration or defaults.

Then for EACH changed file, execute this loop:

1. READ - Read the file content completely
2. RULES - Reference the naming rules you read
3. ULTRATHINK - Think very hard about what naming patterns apply to this file.
   Consider every variable, function, interface, type, component, and enum.
4. CHECK - Verify each pattern meticulously:
   - Boolean variables have prefixes (is, has, should, can, will)
   - Interface suffixes are appropriate for the layer
   - Enum values are UPPERCASE
   - Component names are descriptive (not generic like "DataTable")
   - Constants are UPPER_SNAKE_CASE
   - Functions are camelCase, verb-first
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

FIRST: Read the code style rules from the project configuration or defaults.

Then for EACH changed file, execute this loop:

1. READ - Read the file content completely
2. RULES - Reference the style rules you read
3. ULTRATHINK - Think very hard about what style patterns apply to this file.
   Examine every line, every block, every JSX element.
4. CHECK - Verify each pattern meticulously:
   - Proper spacing and blank lines between logical sections
   - Consistent formatting patterns
   - Ternary usage for conditional rendering
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

FIRST: Read the clean code rules from the project configuration or defaults.

Then for EACH changed file, execute this loop:

1. READ - Read the file content completely
2. RULES - Reference the clean code rules you read
3. ULTRATHINK - Think very hard about what clean code patterns apply.
   Trace every variable usage. Check every import. Analyze every comment.
4. CHECK - Verify each pattern meticulously:
   - No unused variables, imports, functions
   - No commented-out code
   - Comments explain "why" not "what"
   - No `any` types (use unknown, proper types)
   - No linter suppression comments without justification
   - No nested ternaries
   - Proper error handling patterns
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

FIRST: Read the architecture rules from the project configuration or defaults.

Then for EACH changed file, execute this loop:

1. READ - Read the file content completely
2. RULES - Reference the architecture rules you read
3. ULTRATHINK - Think very hard about what layer this file is in.
   What are its dependencies? What imports it? What does it import?
   Map out the dependency graph mentally.
4. CHECK - Verify each pattern meticulously:
   - Proper layer boundaries (UI doesn't call database directly)
   - Separation of concerns (UI vs business logic)
   - Dependencies flow downward only
   - File colocation (types near usage, tests near code)
   - One component/class per file
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

FIRST: Read the security rules from the project configuration or defaults.

Then for EACH changed file, execute this loop:

1. READ - Read the file content completely
2. RULES - Reference the security rules you read
3. ULTRATHINK - Think very hard about attack vectors.
   How could an attacker exploit this code? What inputs are untrusted?
   Where does data come from? Where does it go?
4. CHECK - Verify each pattern with extreme scrutiny:
   - No secrets in code (API keys, passwords, tokens)
   - Validate all user input at boundaries
   - No SQL injection vulnerabilities
   - No XSS vulnerabilities
   - No command injection
   - Proper authentication checks on all endpoints
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

## Step 5: Show Progress

Display the initial review info with full context:

```
`★ maccing-code-reviewer ═══════════════════════════`

Review Started

Config:   .claude/plugins/maccing/code-reviewer.json
Status:   Using built-in defaults (no config found)
Scope:    Git changes (last 5 commits)
Files:    12 files to review

Rules Loaded:
  - defaults/NAMING.md
  - defaults/CLEAN_CODE.md
  - defaults/SECURITY.md
  - defaults/ARCHITECTURE.md

Active Agents:
  - naming-agent
  - code-style-agent
  - clean-code-agent
  - architecture-agent
  - security-agent

Skipped Agents:
  - i18n-agent (no locale files detected)

`═══════════════════════════════════════════════════`
```

As each agent works, show progress:

```
`★ naming-agent ─────────────────────────────────────`
Phase 1: Deep analysis... done
Phase 2: Validation... done
Result: 3 issues found
`─────────────────────────────────────────────────────`

`★ security-agent ───────────────────────────────────`
Phase 1: Deep analysis... done
Phase 2: Validation... done
Result: 1 CRITICAL issue found
`─────────────────────────────────────────────────────`
```

Summary after all agents complete:

```
`★ Agent Results ────────────────────────────────────`
- naming-agent: 3 issues
- code-style-agent: 2 issues
- clean-code-agent: 1 issue
- architecture-agent: 0 issues
- security-agent: 1 CRITICAL issue
- i18n-agent: 4 issues
`─────────────────────────────────────────────────────`
```

## Step 6: Aggregate Results

After all agents complete, aggregate their findings:

1. **Deduplicate** Remove duplicate issues reported by multiple agents
2. **Sort by severity** CRITICAL > HIGH > MEDIUM > LOW
3. **Group by file** Organize issues by file path

## Step 7: Generate Report

Output the final review using simple markdown with section markers:

```
`★ Code Review Report ═══════════════════════════════`
Date:     YYYY-MM-DD
Branch:   feature/example
Reviewer: Claude (multi-agent)
Files:    12
Issues:   11
`═══════════════════════════════════════════════════`
```

### Summary

```
`★ Summary ──────────────────────────────────────────`
- CRITICAL: 1 (must fix)
- HIGH: 3 (should fix)
- MEDIUM: 5 (consider)
- LOW: 2 (optional)
`─────────────────────────────────────────────────────`
```

```
`★ Verdict: REQUEST CHANGES ─────────────────────────`
Critical and high priority issues must be addressed.
`─────────────────────────────────────────────────────`
```

### Critical Issues

```
`✖ CRITICAL ─────────────────────────────────────────`
File:    src/auth.ts:42
Agent:   security-agent
Issue:   Tenant ID accepted from request body
Pattern: Never accept tenantId from frontend
`─────────────────────────────────────────────────────`
```

```typescript
// Bad
const tenantId = input.tenantId;

// Good
const tenantId = ctx.tenant.id;
```

### High Priority Issues

```
`▲ HIGH ──────────────────────────────────────────────`
File:    src/utils/helpers.ts:15
Agent:   naming-agent
Issue:   Boolean variable missing prefix
Pattern: Use is, has, should, can, will prefixes
`─────────────────────────────────────────────────────`
```

```typescript
// Bad
const active = true;

// Good
const isActive = true;
```

### Agent Summary

```
`★ Agent Summary ────────────────────────────────────`
- security-agent: 1 issue (tenant isolation vulnerability)
- naming-agent: 3 issues (boolean prefixes missing)
- code-style-agent: 2 issues (conditional rendering patterns)
- clean-code-agent: 1 issue (unused import)
- architecture-agent: 0 issues (no violations)
- i18n-agent: 4 issues (missing translation keys)
`─────────────────────────────────────────────────────`
```

### Recommendations

```
`★ Recommendations ──────────────────────────────────`
1. Review tenant context patterns in auth layer
2. Add ESLint rules for boolean naming
3. Enforce ternary pattern in component library
`─────────────────────────────────────────────────────`
```

## Step 8: Save Review to Documentation

**CRITICAL: Always save the code review report to the `docs/code-reviews/` folder.**

### File Naming Convention

```
docs/code-reviews/YYYY-MM-DD-<scope>.md
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

## Step 9: Handle Custom Agents

If `.claude/plugins/maccing/code-reviewer.json` contains `customAgents`, spawn those in parallel with the built-in agents.

For each custom agent:

```
You are the {name}. Your job is: {description}

CRITICAL: Use ULTRATHINK for all analysis.

FIRST: Read the rules from {ruleFile}.

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
