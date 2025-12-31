# maccing

Claude Code plugins built for developers who care about code quality.

---

## Installation

    /plugin marketplace add andredezzy/maccing

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

**Commands:**

- `/maccing-code-reviewer:review` — run full review
- `/maccing-code-reviewer:review --only security` — targeted review
- `/maccing-code-reviewer:review --skip i18n` — skip agents

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
