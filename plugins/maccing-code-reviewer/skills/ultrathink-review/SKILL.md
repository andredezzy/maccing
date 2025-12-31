---
name: ultrathink-review
description: |
  maccing-code-reviewer ULTRATHINK multi-agent analysis.
  ONLY use when user explicitly invokes /maccing-code-reviewer:review command.
  Do NOT use for generic "code review" or "review code" requests.
  This skill uses 6 parallel agents with pattern discovery.
---

<first_action>
Immediately call AskUserQuestion with EXACTLY this JSON (do not modify labels or descriptions):

{"questions":[{"question":"What would you like to review?","header":"Scope","multiSelect":false,"options":[{"label":"Git Changes","description":"Review only files changed in git"},{"label":"Full Codebase","description":"Review all source files in the project"},{"label":"Specific Path","description":"Review files in a specific folder"}]}]}

IMPORTANT: Use the exact JSON above. Do not rephrase, reorder, or modify the options.

EXCEPTION: Skip AskUserQuestion only if user specified scope (e.g., "review src/api/" or "review entire codebase").
</first_action>

<after_scope_selected>
Output (with backticks for colored output):

`⚠ maccing-code-reviewer v1.1.0`

Scope: [user's selection]

`════════════════════════════════════════════════════════`

Then proceed to Step 1.
</after_scope_selected>

---

# Code Review Skill

Multi-agent code review with ULTRATHINK methodology.

---

## Step 1: Check Configuration

```bash
cat .claude/plugins/maccing/code-reviewer.json 2>/dev/null || echo "NO_CONFIG"
```

<if_no_config>
Run first-time setup:

1. Create directory:
```bash
mkdir -p .claude/plugins/maccing
```

2. Output (with backticks for colored output):

`◆ maccing-code-reviewer: First-time Setup ══════════════`

Scanning for project rules...

3. Scan for rule files:
```bash
ls -la CLAUDE.md rules/*.md .claude/*.md 2>/dev/null || echo "NO_RULES_FOUND"
```

4. Call AskUserQuestion for rule files with EXACTLY this JSON (add detected files as additional options):

{"questions":[{"question":"Which rule files should I use for code reviews?","header":"Rules","multiSelect":true,"options":[{"label":"CLAUDE.md","description":"Project instructions"},{"label":"Skip all","description":"Discover patterns from codebase"}]}]}

IMPORTANT: Add any detected rule files (from step 3) as additional options before "Skip all".

5. Detect if project uses i18n:
```bash
ls -la locales/ messages/ translations/ i18n/ 2>/dev/null || grep -r "next-intl\|react-i18next\|i18next\|formatMessage" package.json 2>/dev/null || echo "NO_I18N"
```

6. Call AskUserQuestion for agents:

**If i18n detected:**
{"questions":[{"question":"Which review agents should be enabled?","header":"Agents","multiSelect":true,"options":[{"label":"All agents (Recommended)","description":"naming, code-style, clean-code, architecture, security, i18n"},{"label":"naming","description":"Naming conventions"},{"label":"code-style","description":"Formatting patterns"},{"label":"clean-code","description":"Code quality"},{"label":"architecture","description":"Layer boundaries"},{"label":"security","description":"Security vulnerabilities"},{"label":"i18n","description":"Internationalization"}]}]}

**If NO i18n detected (exclude i18n option):**
{"questions":[{"question":"Which review agents should be enabled?","header":"Agents","multiSelect":true,"options":[{"label":"All agents (Recommended)","description":"naming, code-style, clean-code, architecture, security"},{"label":"naming","description":"Naming conventions"},{"label":"code-style","description":"Formatting patterns"},{"label":"clean-code","description":"Code quality"},{"label":"architecture","description":"Layer boundaries"},{"label":"security","description":"Security vulnerabilities"}]}]}

IMPORTANT: Use the exact JSON above. Do not rephrase or reorder options.

7. Create config file using Write tool at `.claude/plugins/maccing/code-reviewer.json`:

**If i18n detected:**
```json
{"ruleFiles":["CLAUDE.md"],"agents":["naming","code-style","clean-code","architecture","security","i18n"],"customAgents":[]}
```

**If NO i18n detected:**
```json
{"ruleFiles":["CLAUDE.md"],"agents":["naming","code-style","clean-code","architecture","security"],"customAgents":[]}
```

8. Output confirmation (with backticks for colored output):

`✓ maccing-code-reviewer: Setup Complete ════════════════`

Config: .claude/plugins/maccing/code-reviewer.json
Rules:  [selected files]
Agents: [selected agents]

`════════════════════════════════════════════════════════`
</if_no_config>

---

## Step 2: Collect Files

<collect_files>
Based on selected scope:

**Git Changes:**
```bash
git diff --name-only HEAD
git diff --cached --name-only
```

**Full Codebase:**
```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.go" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*"
```

**Specific Path:**
```bash
find [path] -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -not -path "*/node_modules/*"
```

Output (with backticks for colored output):

`▶ maccing-code-reviewer: Review Scope ══════════════════`

Mode:  [scope]
Files: [count] files

`════════════════════════════════════════════════════════`
</collect_files>

---

## Step 3: Load Rules

<load_rules>
Read all files in `ruleFiles` from config. For each file, extract rules by category keywords:

| Category | Keywords |
|----------|----------|
| naming | naming, variables, functions, boolean, prefix |
| code-style | style, formatting, imports, ternary |
| clean-code | unused, comments, types, any |
| architecture | layers, boundaries, dependencies |
| security | auth, validation, injection, secrets |
| i18n | translation, locale, internationalization |

Output (with backticks for colored output):

`◈ maccing-code-reviewer: Rules Loaded ══════════════════`

Files: [count]
- naming: [count] rules
- code-style: [count] rules
- architecture: 0 rules → Pattern Discovery

`════════════════════════════════════════════════════════`

A category with 0 rules = GAP (needs pattern discovery).
</load_rules>

---

## Step 4: Pattern Discovery

<pattern_discovery>
For each GAP category, spawn a pattern-discovery-agent using Task tool.

IMPORTANT: Output ONE block only. Do NOT output multiple headers.

Output at START of pattern discovery (with backticks for colored output):

`◎ maccing-code-reviewer: Pattern Discovery ═════════════`

Scanning codebase for implicit conventions...

[Run agents here, do NOT output another header]

<agent_prompt category="naming">
You are pattern-discovery-agent for NAMING. Scan entire codebase:

1. Find all source files
2. Read every file
3. Extract: boolean prefixes (is/has/can), function naming (verb-first?), constants (UPPER_SNAKE?)
4. Count occurrences
5. Calculate consistency percentages
6. Return JSON with patterns >60% consistency marked as adopted
</agent_prompt>

<agent_prompt category="code-style">
You are pattern-discovery-agent for CODE-STYLE. Scan entire codebase:

1. Find all source files
2. Read every file
3. Extract: import ordering, spacing, ternary usage, arrow functions
4. Count occurrences
5. Calculate consistency percentages
6. Return JSON with patterns >60% consistency marked as adopted
</agent_prompt>

<agent_prompt category="architecture">
You are pattern-discovery-agent for ARCHITECTURE. Scan entire codebase:

1. Map folder structure
2. Read every file, track imports
3. Build dependency graph
4. Identify layer boundaries (components→pages?, utils→components?)
5. Calculate consistency percentages
6. Return JSON with patterns >60% consistency marked as adopted
</agent_prompt>

<agent_prompt category="clean-code">
You are pattern-discovery-agent for CLEAN-CODE. Scan entire codebase:

1. Find all source files
2. Read every file
3. Extract: any vs unknown usage, error handling patterns, comment styles
4. Count occurrences
5. Calculate consistency percentages
6. Return JSON with patterns >60% consistency marked as adopted
</agent_prompt>

<agent_prompt category="security">
You are pattern-discovery-agent for SECURITY. Scan entire codebase:

1. Find API routes, auth code, validation code
2. Read every file
3. Extract: input validation location, auth patterns, query building
4. Count occurrences
5. Calculate consistency percentages
6. Return JSON with patterns >60% consistency marked as adopted
</agent_prompt>

Save discovered patterns to `.claude/plugins/maccing/discovered-patterns.json`.

Output results WITHIN THE SAME BLOCK (no new header, just continue):

naming patterns discovered:

  Boolean Prefixes
  ├─ is*  → 73%
  ├─ has* → 18%
  └─ can* →  5%
  ✓ Adopted

[Show all category results here]

Output at END (close the block):

`════════════════════════════════════════════════════════`

Then ask user if they want to save patterns as rule files:

{"questions":[{"question":"Save discovered patterns as rule files?","header":"Rules","multiSelect":false,"options":[{"label":"Yes, create rule files","description":"Create .md files in rules/ folder"},{"label":"No, use patterns only this session","description":"Patterns saved to config but no rule files created"}]}]}

If user selects "Yes, create rule files":
1. Create rules/ directory: `mkdir -p rules`
2. For each category with discovered patterns, create a file using Write tool:
   - rules/NAMING.md
   - rules/CODE_STYLE.md
   - rules/CLEAN_CODE.md
   - rules/ARCHITECTURE.md
   - rules/SECURITY.md

File format:
```markdown
# [Category] Rules

Discovered from codebase analysis.

## Patterns

- [Pattern name]: [percentage]% consistency
  - Description of pattern
```

3. Add references to CLAUDE.md (create if doesn't exist):

Check if CLAUDE.md exists:
```bash
cat CLAUDE.md 2>/dev/null || echo "NO_CLAUDE_MD"
```

If CLAUDE.md exists, append rule references using Edit tool.
If CLAUDE.md doesn't exist, create it using Write tool.

Add this section to CLAUDE.md:
```markdown

## Coding Rules

The following rules were discovered from this codebase and should be followed when writing or reviewing code:

- [Naming Conventions](rules/NAMING.md)
- [Code Style](rules/CODE_STYLE.md)
- [Clean Code](rules/CLEAN_CODE.md)
- [Architecture](rules/ARCHITECTURE.md)
- [Security](rules/SECURITY.md)
```

4. Output confirmation:

`✓ maccing-code-reviewer: Rules Created ═════════════════`

Created rule files:
- rules/NAMING.md
- rules/CODE_STYLE.md
- [etc.]

References added to CLAUDE.md

`════════════════════════════════════════════════════════`
</pattern_discovery>

---

## Step 5: Run Review Agents

<spawn_agents>
Use Task tool to spawn ALL enabled agents in parallel (single message, multiple tool calls).

Each agent receives either explicit rules OR discovered patterns.
</spawn_agents>

<agent_prompt name="naming-agent">
You are naming-agent. Verify naming conventions.

For EACH file:
1. READ file completely
2. ULTRATHINK: What naming patterns apply?
3. CHECK: booleans, functions, constants, interfaces
4. ULTRATHINK: Is this really a violation?
5. RESULT: file:line, issue, pattern

Return structured list of violations.
</agent_prompt>

<agent_prompt name="code-style-agent">
You are code-style-agent. Verify formatting patterns.

For EACH file:
1. READ file completely
2. ULTRATHINK: What style patterns apply?
3. CHECK: imports, spacing, ternaries, composition
4. ULTRATHINK: Is this really a violation?
5. RESULT: file:line, issue, pattern

Return structured list of violations.
</agent_prompt>

<agent_prompt name="clean-code-agent">
You are clean-code-agent. Verify code quality.

For EACH file:
1. READ file completely
2. ULTRATHINK: What clean code patterns apply?
3. CHECK: unused code, comments, types, error handling
4. ULTRATHINK: Is this really a violation?
5. RESULT: file:line, issue, pattern

Return structured list of violations.
</agent_prompt>

<agent_prompt name="architecture-agent">
You are architecture-agent. Verify layer boundaries.

For EACH file:
1. READ file completely
2. ULTRATHINK: What layer is this? What are dependencies?
3. CHECK: import boundaries, separation of concerns, circular deps
4. ULTRATHINK: Is this really a violation?
5. RESULT: file:line, issue, pattern

Return structured list of violations.
</agent_prompt>

<agent_prompt name="security-agent">
You are security-agent. Verify security patterns.

For EACH file:
1. READ file completely
2. ULTRATHINK: What attack vectors exist?
3. CHECK: secrets, injection, auth, input validation
4. ULTRATHINK: Could attacker bypass this?
5. RESULT: file:line, issue, severity (CRITICAL/HIGH/MEDIUM)

Return structured list of issues. Be paranoid.
</agent_prompt>

<agent_prompt name="i18n-agent">
You are i18n-agent. Verify internationalization.

For EACH file with user-facing text:
1. READ file completely
2. ULTRATHINK: What text is user-facing?
3. CHECK: hardcoded strings, translation keys, pluralization
4. ULTRATHINK: Did I miss any strings?
5. RESULT: file:line, issue, missing key

Return structured list of issues.
</agent_prompt>

---

## Step 6: Aggregate Results

<aggregate>
1. Deduplicate issues from multiple agents
2. Sort: CRITICAL > HIGH > MEDIUM > LOW
3. Group by file
</aggregate>

---

## Step 7: Generate Report

<report_format>
Output (with backticks for colored output):

`★ maccing-code-reviewer: Code Review Report ════════════`

Date:     YYYY-MM-DD HH:mm
Branch:   [branch]
Files:    [count]
Issues:   [count]

Summary:
- CRITICAL: [count]
- HIGH: [count]
- MEDIUM: [count]
- LOW: [count]

Verdict: [APPROVED | NEEDS REVIEW | REQUEST CHANGES]

`─────────────────────────────────────────────────────────`

Issues:

`✖ CRITICAL`: src/auth.ts:42
Agent: security-agent
Issue: [description]
Pattern: [rule]

`▲ HIGH`: src/utils.ts:15
Agent: naming-agent
Issue: [description]
Pattern: [rule]

`════════════════════════════════════════════════════════`
</report_format>

---

## Step 8: Save Report

<save_report>
1. Get branch: `git branch --show-current`
2. Create dir: `mkdir -p docs/code-reviews`
3. Save using Write tool to: `docs/code-reviews/YYYY-MM-DD-HHmm-[branch].md`

Skip if --no-save flag was provided.
</save_report>

---

## ULTRATHINK Reference

<ultrathink_methodology>
Every agent MUST use ULTRATHINK (maximum depth analysis).

Loop per file:
```
READ → RULES → ULTRATHINK → CHECK → ULTRATHINK → RESULT → NEXT
```

Thinking hierarchy:
- think = NOT ENOUGH
- think hard = NOT ENOUGH
- think harder = NOT ENOUGH
- ultrathink = USE THIS
</ultrathink_methodology>
