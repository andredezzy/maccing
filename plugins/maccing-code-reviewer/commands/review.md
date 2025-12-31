---
description: Run comprehensive code review with multi-agent ULTRATHINK analysis
---

# Code Review Command

Run a thorough code review using the ULTRATHINK methodology with 6 specialized agents.

## Arguments

$ARGUMENTS

## Supported Flags

Parse the following flags from $ARGUMENTS:

- `--all` Review entire codebase (all source files, not just git changes)

- `--scope <path>` Review specific path/folder instead of git changes
  Example: `--scope src/auth/`

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

**Review Mode (mutually exclusive, first match wins):**
- If `--all` is provided, review all source files in the codebase.
- If `--scope` is provided, review files in that path.
- If no flag provided, ask user which scope they want.

**Agent Selection:**
- If `--skip` is provided, exclude those agents from the review.
- If `--only` is provided, only run those agents.

**Output:**
- If `--no-save` is provided, output the report to console without saving to file.

## Examples

```bash
# Review git changes (default)
/maccing-code-reviewer:review

# Review entire codebase
/maccing-code-reviewer:review --all

# Review specific directory
/maccing-code-reviewer:review --scope src/api/

# Security-focused review of entire codebase
/maccing-code-reviewer:review --all --only security,architecture

# Skip i18n for non-user-facing code
/maccing-code-reviewer:review --skip i18n

# Quick console-only review
/maccing-code-reviewer:review --no-save --only security
```
