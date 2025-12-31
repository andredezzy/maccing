---
description: Run comprehensive code review with multi-agent ULTRATHINK analysis
---

# Code Review Command

Run a thorough code review using the ULTRATHINK methodology with 6 specialized agents.

## Arguments

$ARGUMENTS

## Supported Flags

Parse the following flags from $ARGUMENTS:

- `--skip <agents>` Skip specific agents (comma-separated)
  Example: `--skip i18n,naming`

- `--only <agents>` Run only specific agents (comma-separated)
  Example: `--only security,architecture`

- `--no-save` Output to console only, skip saving to docs/code-reviews/

- `--scope <path>` Review specific path instead of git changes
  Example: `--scope src/auth/`

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

Invoke the `code-review` skill with the parsed configuration.

If `--skip` is provided, exclude those agents from the review.
If `--only` is provided, only run those agents.
If `--scope` is provided, review files in that path instead of git changes.
If `--no-save` is provided, output the report to console without saving to file.

## Examples

```bash
# Full review of git changes
/maccing-code-reviewer:review

# Security-focused review
/maccing-code-reviewer:review --only security,architecture

# Skip i18n for non-user-facing code
/maccing-code-reviewer:review --skip i18n

# Review specific directory
/maccing-code-reviewer:review --scope src/api/

# Quick console-only review
/maccing-code-reviewer:review --no-save --only security
```
