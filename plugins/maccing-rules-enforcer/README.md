# maccing-rules-enforcer

Enforces project rules by injecting them at every prompt. Combats instruction decay through multi-hook reinforcement.

## The Problem

Claude ignores CLAUDE.md instructions because:

- Instructions at conversation start lose attention weight over time
- Claude Code's system says rules "may or may not be relevant"
- Long conversations cause instruction decay

## The Solution

Inject your rules at multiple points in the conversation lifecycle:

| Hook | When | Purpose |
|------|------|---------|
| SessionStart | Session begins | Full rules at start |
| UserPromptSubmit | Every prompt | Full rules in recent context |
| PreCompact | Before compression | Preserve rules through summarization |
| Stop | Before stopping | Force verification against all rules |

## Installation

```
/plugin install maccing-rules-enforcer@maccing
```

## Setup

Place your rules in one of these locations (searched in order):

1. `rules/RULES.md` (recommended)
2. `RULES.md`
3. `.claude/RULES.md`
4. `CLAUDE.md`
5. `.claude/CLAUDE.md`
6. `.claude/rules/*.md` (all files concatenated)

## Usage

Once installed, the plugin works automatically. No commands needed.

To check status:

```
/maccing-rules-enforcer:rules
```

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│ Session Start                                                   │
│   └─► Full rules injected via additionalContext                 │
├─────────────────────────────────────────────────────────────────┤
│ Every Prompt                                                    │
│   └─► Full rules injected via stdout (before your prompt)       │
├─────────────────────────────────────────────────────────────────┤
│ Context Compression                                             │
│   └─► Full rules re-injected (survives summarization)           │
├─────────────────────────────────────────────────────────────────┤
│ Before Stopping                                                 │
│   └─► Claude blocked until rules verification acknowledged      │
└─────────────────────────────────────────────────────────────────┘
```

## Token Cost

Each injection adds ~500-1000 tokens depending on your rules file size.

| Rules File Size | Tokens per Injection |
|-----------------|---------------------|
| Small (~100 lines) | ~400 tokens |
| Medium (~200 lines) | ~700 tokens |
| Large (~350 lines) | ~1000 tokens |

This cost is offset by:

- Eliminated correction loops
- Fewer rule violations to fix
- More consistent code quality

## Troubleshooting

### Rules not being injected

1. Check rules file exists:
   ```bash
   ls -la rules/RULES.md
   ```

2. Verify plugin is enabled:
   ```
   /plugin list
   ```

3. Test detection script:
   ```bash
   echo '{"cwd": "'$(pwd)'"}' | ~/.claude/plugins/cache/maccing/maccing-rules-enforcer/hooks/session-start.sh
   ```

### Stop hook too aggressive

The Stop hook blocks Claude from stopping until rules are verified. If this is too strict, disable it with a local override:

```json
// .claude/settings.local.json
{
  "hooks": {
    "Stop": []
  }
}
```

### High token usage

If token costs are too high, you can disable the UserPromptSubmit hook (most expensive) while keeping others:

```json
// .claude/settings.local.json
{
  "hooks": {
    "UserPromptSubmit": []
  }
}
```

## Philosophy

- **Recency over position**: Rules in recent context get more attention
- **Repetition over trust**: Inject rules multiple times, don't trust once
- **Full over partial**: Complete rules, not summaries
- **Verification over assumption**: Force explicit rule checking before done

## License

MIT
