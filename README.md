# maccing

Claude Code plugins built for developers who care about code quality.

---

## Installation

    /plugin marketplace add andredezzy/maccing

---

## Updating Plugins

**Manual update:**

    /plugin marketplace update maccing

**Enable auto-update:**

1. Run `/plugin`
2. Select **Marketplaces** tab
3. Select `maccing`
4. Select **Enable auto-update**

**Reinstall to get latest:**

    /plugin install maccing-code-reviewer@maccing

---

## Available Plugins

### maccing-code-reviewer

**Description:** Multi-agent code review using ULTRATHINK methodology

**Categories:** code-review, quality, security

**Installation:**

    /plugin install maccing-code-reviewer@maccing

**What you get:**

- 6 specialized review agents running in parallel
- Deep multi-pass analysis with visible progress
- Project-aware rules (reads CLAUDE.md, rules/*.md)
- Custom agent extensibility
- Persistent reports in docs/code-reviews/

**Review Agents:**

| Agent | Focus | What It Checks |
|-------|-------|----------------|
| **naming-agent** | Naming conventions | Boolean prefixes (`is`, `has`, `should`), interface suffixes, enum casing, component names, constants |
| **code-style-agent** | Formatting patterns | Spacing, blank lines, ternary operators, composition patterns, React keys |
| **clean-code-agent** | Code quality | Unused code, commented code, obvious comments, `any` types, nested ternaries, error handling |
| **architecture-agent** | Layer boundaries | Separation of concerns, dependency direction, circular dependencies, file colocation |
| **security-agent** | Vulnerabilities | SQL injection, XSS, command injection, secrets in code, auth checks, sensitive data in logs |
| **i18n-agent** | Internationalization | Translation keys, hardcoded strings, locale coverage, pluralization |

**Commands:**

| Command | Description |
|---------|-------------|
| `/maccing-code-reviewer:review` | Run full review with all agents |
| `/maccing-code-reviewer:review --only security,architecture` | Run only specific agents |
| `/maccing-code-reviewer:review --skip i18n,naming` | Skip specific agents |
| `/maccing-code-reviewer:review --scope src/api/` | Review specific directory |
| `/maccing-code-reviewer:review --no-save` | Output to console only |

---

## Documentation

| Plugin | README | Configuration | Defaults |
|--------|--------|---------------|----------|
| **maccing-code-reviewer** | [README](plugins/maccing-code-reviewer/README.md) | `.claude/plugins/maccing/code-reviewer.json` | [View defaults](plugins/maccing-code-reviewer/defaults/) |

---

## Marketplace Structure

    maccing/
    ├── .claude-plugin/
    │   └── marketplace.json
    └── plugins/
        └── maccing-code-reviewer/
            ├── .claude-plugin/
            │   └── plugin.json
            ├── skills/
            │   └── code-review/
            │       └── SKILL.md
            ├── commands/
            │   └── review.md
            ├── defaults/
            │   ├── NAMING.md
            │   ├── CLEAN_CODE.md
            │   ├── SECURITY.md
            │   └── ARCHITECTURE.md
            └── README.md

---

## Philosophy

- **Thorough over fast** — Deep multi-pass analysis catches what quick scans miss
- **Evidence over claims** — Every issue includes file:line and correct pattern
- **Systematic over ad-hoc** — Structured methodology beats random checks
- **Project-aware** — Your rules, your standards, not generic advice
- **Transparent** — See what agents are doing, not just the results

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

---

## License

MIT
