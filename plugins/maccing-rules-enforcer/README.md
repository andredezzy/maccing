# maccing-rules-enforcer

Enforces project rules by injecting them at every prompt. Combats instruction decay through multi-hook reinforcement.

## Features

- **Full injection**: Injects complete rules at session start and every prompt
- **Compression survival**: Re-injects rules after context compaction
- **Stop verification**: Blocks task completion until rules are verified
- **Auto-detection**: Finds rules/RULES.md, CLAUDE.md, or .claude/rules/*.md

## Installation

```bash
# Add marketplace
/plugin marketplace add andredezzy/maccing

# Install plugin
/plugin install maccing-rules-enforcer@maccing
```

## How It Works

### SessionStart Hook

When you start a Claude Code session, the plugin:
1. Detects rules file location
2. Reads the full rules content
3. Injects it as additionalContext so Claude sees it immediately

### UserPromptSubmit Hook

Before every prompt you send, the plugin:
1. Re-reads the rules file
2. Outputs to stdout (which gets injected before your prompt)
3. Creates "recency bias" keeping rules in recent context

### PreCompact Hook

Before context compression, the plugin:
1. Preserves rules content
2. Re-injects after summarization
3. Ensures rules survive long conversations

### Stop Hook

When Claude tries to stop, the plugin:
1. Checks if verification was already requested this session
2. If first time: blocks stop, presents rules with verification checklist
3. If already verified: allows stop to proceed
4. Marker is cleaned up on next session start

## Commands

### `/maccing-rules-enforcer:rules`

Display current enforcement status:

```
/maccing-rules-enforcer:rules
```

Shows detected rules source, enabled hooks, and token cost.

Example output:

```
★ rules-enforcer ─────────────────────────────────

Status: ACTIVE

Rules Source:
  • rules/RULES.md (primary)
  • .claude/rules/*.md (supplementary)

Hooks Enabled:
  ✓ SessionStart     (full rules at session start)
  ✓ UserPromptSubmit (full rules every prompt)
  ✓ PreCompact       (re-inject after compression)
  ✓ Stop             (verification before stopping)

Token Cost: ~800 tokens per injection

─────────────────────────────────────────────────
```

## Supported Rules Locations

| Priority | Path | Description |
|----------|------|-------------|
| 1 | `rules/RULES.md` | Recommended location |
| 2 | `RULES.md` | Project root |
| 3 | `.claude/RULES.md` | Claude config folder |
| 4 | `CLAUDE.md` | Standard Claude instructions |
| 5 | `.claude/CLAUDE.md` | Claude config folder |
| 6 | `.claude/rules/*.md` | Multiple rule files (concatenated) |

## Token Cost

Each injection adds ~500-1000 tokens depending on your rules file size.

| Rules File Size | Tokens per Injection |
|-----------------|---------------------|
| Small (~100 lines) | ~400 tokens |
| Medium (~200 lines) | ~700 tokens |
| Large (~350 lines) | ~1000 tokens |

This cost is offset by eliminated correction loops and fewer rule violations.

## Requirements

- `jq` must be installed for JSON parsing
- Claude Code with plugin support

## Troubleshooting

### Check installed version

```bash
cat ~/.claude/plugins/marketplaces/maccing/plugins/maccing-rules-enforcer/.claude-plugin/plugin.json | grep version
```

Expected: `"version": "1.0.2"`

### Plugin not updating

If changes don't appear after update:

```bash
rm -rf ~/.claude/plugins/cache/maccing
rm -rf ~/.claude/plugins/marketplaces/maccing
/plugin marketplace add andredezzy/maccing
/plugin install maccing-rules-enforcer@maccing
```

### Rules not detected

If the plugin doesn't detect your rules:

1. **Check for rules file** at expected locations:
   ```bash
   ls -la rules/RULES.md RULES.md CLAUDE.md .claude/RULES.md .claude/rules/ 2>/dev/null
   ```

2. **Verify jq is installed:**
   ```bash
   jq --version
   ```

3. **Test detection manually:**
   ```bash
   ~/.claude/plugins/marketplaces/maccing/plugins/maccing-rules-enforcer/scripts/detect-rules.sh $(pwd)
   ```

### Hooks not running

If SessionStart or other hooks aren't triggering:

1. **Check plugin is installed:**
   ```bash
   ls ~/.claude/plugins/marketplaces/maccing/plugins/maccing-rules-enforcer/hooks/
   ```

2. **Verify scripts are executable:**
   ```bash
   ls -la ~/.claude/plugins/marketplaces/maccing/plugins/maccing-rules-enforcer/hooks/*.sh
   ```

3. **Reinstall plugin:**
   ```bash
   /plugin uninstall maccing-rules-enforcer@maccing
   /plugin install maccing-rules-enforcer@maccing
   ```

### Stop hook infinite loop (fixed in v1.0.2)

If you experience an infinite loop where the stop hook keeps blocking, update to v1.0.2+:

```bash
/plugin uninstall maccing-rules-enforcer@maccing
/plugin install maccing-rules-enforcer@maccing
```

v1.0.2 fixed macOS compatibility for the hash calculation. The stop hook now only blocks once per session. If still experiencing issues, disable it:

```json
// .claude/settings.local.json
{
  "hooks": {
    "Stop": []
  }
}
```

### High token usage

If token costs are too high, disable UserPromptSubmit (most expensive):

```json
// .claude/settings.local.json
{
  "hooks": {
    "UserPromptSubmit": []
  }
}
```

## License

MIT
