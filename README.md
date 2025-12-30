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

**Documentation:** [plugins/maccing-code-reviewer](plugins/maccing-code-reviewer/)

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

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

---

## Author

**Andre Dezzy**

- GitHub: [@andredezzy](https://github.com/andredezzy)

---

## License

MIT
