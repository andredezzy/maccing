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

---

## Philosophy

- **Discovery-first**: Learn from YOUR codebase, not generic rules
- **Thorough over fast**: Deep multi-pass analysis
- **Evidence over claims**: Every issue includes file:line reference
- **Transparent**: See what was discovered and why

---

## Troubleshooting

### Check installed version

```bash
cat ~/.claude/plugins/marketplaces/maccing/plugins/maccing-code-reviewer/.claude-plugin/plugin.json | grep version
```

Expected: `"version": "1.1.0"`

### Plugin not updating

```bash
rm -rf ~/.claude/plugins/cache/maccing
rm -rf ~/.claude/plugins/marketplaces/maccing
/plugin marketplace add andredezzy/maccing
/plugin install maccing-code-reviewer@maccing
```

### Conflicting with other plugins

```bash
find ~/.claude/plugins -type d -name "code-review" 2>/dev/null
```

Uninstall conflicting plugins:

```
/plugin uninstall code-review@claude-code-plugins
/plugin uninstall code-review@claude-plugins-official
```

[Full troubleshooting guide](plugins/maccing-code-reviewer/README.md#troubleshooting)

---

## License

MIT
