# maccing-code-reviewer

Multi-agent code review using ULTRATHINK methodology.

---

## What it does

- **6 specialized agents** analyze code in parallel
- **ULTRATHINK methodology** for deep, multi-pass verification
- **Project-aware** reads your rules from CLAUDE.md, rules/*.md
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

## Configuration

On first run, the plugin creates `.claude/plugins/maccing/code-reviewer.json`:

```json
{
  "ruleFiles": ["CLAUDE.md", "rules/CODE_STYLE.md"],
  "agents": ["naming", "code-style", "clean-code", "architecture", "security", "i18n"],
  "customAgents": []
}
```

### Custom Agents

Add custom agents for your stack in `.claude/plugins/maccing/code-reviewer.json`:

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

    docs/code-reviews/YYYY-MM-DD-<branch-name>.md

Example: `docs/code-reviews/2025-12-30-feature-auth.md`

---

## ULTRATHINK Methodology

Each agent executes a rigorous loop for every file:

```
READ -> RULES -> ULTRATHINK -> CHECK -> ULTRATHINK -> RESULT -> NEXT
```

**Phase 1 (ULTRATHINK):** Deep analysis of patterns and potential issues

**Phase 2 (ULTRATHINK):** Validation pass to verify findings and catch edge cases

This methodology ensures thorough, accurate reviews with minimal false positives.

---

## License

MIT
