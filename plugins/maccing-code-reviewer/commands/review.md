---
description: Run comprehensive code review with multi-agent ULTRATHINK analysis
---

# Code Review Command

Run a thorough code review using the ULTRATHINK methodology with 6 specialized agents.

## Arguments

$ARGUMENTS

## Scope Detection

The scope is detected from the context following the command:

| User Input | Detected Scope |
|------------|----------------|
| `/maccing-code-reviewer:review` | Ask user |
| `/maccing-code-reviewer:review src/api/` | Path: src/api/ |
| `/maccing-code-reviewer:review the auth module` | Path: auth-related folder |
| `/maccing-code-reviewer:review entire codebase` | Full Codebase |
| `/maccing-code-reviewer:review all files` | Full Codebase |
| `/maccing-code-reviewer:review whole project` | Full Codebase |

## Optional Flags

- `--skip <agents>` Skip specific agents (comma-separated)
  Example: `--skip i18n,naming`

- `--only <agents>` Run only specific agents (comma-separated)
  Example: `--only security,architecture`

- `--no-save` Output to console only, skip saving to docs/code-reviews/

## Available Agents

| Agent | Focus |
|-------|-------|
| `naming` | Naming conventions (boolean prefixes, interface suffixes) |
| `code-style` | Formatting and patterns (spacing, ternaries, composition) |
| `clean-code` | Code quality (unused code, comments, types) |
| `architecture` | Layer boundaries (separation of concerns, dependencies) |
| `security` | Security vulnerabilities (injection, auth, secrets) |
| `i18n` | Internationalization (translation keys, locale coverage) |

## Execution

Invoke the `review` skill with the parsed configuration.

**Review Mode:**
- Scope is detected from the context after the command
- If no scope can be determined, ask user which scope they want

**Agent Selection:**
- If `--skip` is provided, exclude those agents from the review.
- If `--only` is provided, only run those agents.

**Output:**
- If `--no-save` is provided, output the report to console without saving to file.

## Examples

```bash
# Ask for scope
/maccing-code-reviewer:review

# Review entire codebase
/maccing-code-reviewer:review entire codebase

# Review specific directory
/maccing-code-reviewer:review src/api/

# Review a module by name
/maccing-code-reviewer:review the authentication module

# Security-focused review
/maccing-code-reviewer:review entire codebase --only security,architecture

# Skip i18n for non-user-facing code
/maccing-code-reviewer:review src/utils/ --skip i18n

# Quick console-only review
/maccing-code-reviewer:review --no-save --only security
```
