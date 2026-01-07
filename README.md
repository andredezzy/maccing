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

Multi-agent code review with automatic pattern discovery.

    /plugin install maccing-code-reviewer@maccing

**Features:**

- Automatic pattern discovery from YOUR codebase
- 6 specialized review agents running in parallel
- ULTRATHINK methodology for deep analysis
- Persistent reports in docs/code-reviews/

**Quick start:**

    /maccing-code-reviewer:review

[View full documentation](plugins/maccing-code-reviewer/README.md)

### maccing-monorepo

Monorepo workflow assistance with auto-detection and smart reminders.

    /plugin install maccing-monorepo@maccing

**Features:**

- Auto-detects Turborepo, Nx, pnpm, npm, yarn workspaces
- Reminds to run scripts from root with filters
- Comprehensive monorepo-workflows skill
- Commands: `/maccing-monorepo:info`, `/maccing-monorepo:run`

**Quick start:**

    /maccing-monorepo:info

[View full documentation](plugins/maccing-monorepo/README.md)

---

## Philosophy

- **Discovery-first**: Learn from YOUR codebase, not generic rules
- **Thorough over fast**: Deep multi-pass analysis
- **Evidence over claims**: Every issue includes file:line reference
- **Transparent**: See what was discovered and why

---

## Troubleshooting

### Plugin not updating

Clear cache and reinstall:

```bash
rm -rf ~/.claude/plugins/cache/maccing
rm -rf ~/.claude/plugins/marketplaces/maccing
/plugin marketplace add andredezzy/maccing
/plugin install <plugin-name>@maccing
```

### Check installed version

```bash
cat ~/.claude/plugins/marketplaces/maccing/plugins/<plugin-name>/.claude-plugin/plugin.json | grep version
```

### Plugin-specific issues

For detailed troubleshooting guides:

- [maccing-code-reviewer troubleshooting](plugins/maccing-code-reviewer/README.md#troubleshooting)
- [maccing-monorepo troubleshooting](plugins/maccing-monorepo/README.md#troubleshooting)

---

## License

MIT
