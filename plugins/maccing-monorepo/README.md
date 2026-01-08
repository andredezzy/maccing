# maccing-monorepo

Monorepo workflow assistance for Claude Code. Auto-detects monorepo tools and helps you run scripts correctly with filters.

## Features

- **Auto-detection**: Supports Turborepo, Nx, pnpm, npm, and yarn workspaces
- **Smart reminders**: Nudges you to run scripts from root with filters
- **Comprehensive skill**: Full guidance on monorepo patterns and best practices
- **Utility commands**: Quick visibility into monorepo structure

## Installation

```bash
# Add marketplace
claude plugin marketplace add andredezzy/maccing

# Install plugin
claude plugin install maccing-monorepo@maccing
```

## How It Works

### SessionStart Hook

When you start a Claude Code session in a monorepo project, the plugin:
1. Detects which monorepo tool is in use
2. Discovers all packages/apps
3. Injects context so Claude understands your project structure

### PostToolUse Hook

When you run scripts from a child folder (e.g., `npm run dev` from `apps/web/`), the plugin reminds you to use root-level commands with filters instead.

## Commands

### `/maccing-monorepo:info`

Display detected monorepo structure:

```
/maccing-monorepo:info
```

Shows tool, root directory, all packages with their available scripts, and the correct filter syntax.

### `/maccing-monorepo:run <task> [package] [flags]`

Construct filter commands:

```bash
# Build all packages
/maccing-monorepo:run build

# Run dev for specific package
/maccing-monorepo:run dev web

# Test affected packages only
/maccing-monorepo:run test --affected

# Execute the command
/maccing-monorepo:run build --execute
```

## Supported Tools

| Tool | Detection | Filter Syntax |
|------|-----------|---------------|
| Turborepo | `turbo.json` | `turbo run <task> --filter=<pkg>` |
| Nx | `nx.json` | `nx <target> <project>` |
| pnpm | `pnpm-workspace.yaml` | `pnpm --filter <pkg> <script>` |
| npm | `package.json` workspaces | `npm run <script> -w <pkg>` |
| yarn | `package.json` workspaces | `yarn workspace <pkg> <script>` |

## Skill

The `monorepo-workflows` skill provides comprehensive guidance on:

- Running scripts correctly with filters
- Managing dependencies (adding to specific packages vs root)
- Understanding build order and caching
- Troubleshooting common issues

Trigger it by asking about monorepo workflows or when working on tasks involving multiple packages.

## Requirements

- `jq` must be installed for JSON parsing
- Claude Code with plugin support

## Troubleshooting

### Check installed version

```bash
cat ~/.claude/plugins/marketplaces/maccing/plugins/maccing-monorepo/.claude-plugin/plugin.json | grep version
```

Expected: `"version": "1.0.1"`

### Plugin not updating

If changes don't appear after update:

```bash
rm -rf ~/.claude/plugins/cache/maccing
rm -rf ~/.claude/plugins/marketplaces/maccing
/plugin marketplace add andredezzy/maccing
/plugin install maccing-monorepo@maccing
```

### Monorepo not detected

If the plugin doesn't detect your monorepo:

1. **Check for config files** at your project root:
   - Turborepo: `turbo.json`
   - Nx: `nx.json`
   - pnpm: `pnpm-workspace.yaml`
   - npm/yarn: `package.json` with `"workspaces"` field

2. **Verify jq is installed:**
   ```bash
   jq --version
   ```

3. **Test detection manually:**
   ```bash
   ~/.claude/plugins/marketplaces/maccing/plugins/maccing-monorepo/scripts/detect-monorepo.sh $(pwd)
   ```

### Hooks not running

If SessionStart or PostToolUse hooks aren't triggering:

1. **Check plugin is installed:**
   ```bash
   ls ~/.claude/plugins/marketplaces/maccing/plugins/maccing-monorepo/hooks/
   ```

2. **Verify scripts are executable:**
   ```bash
   ls -la ~/.claude/plugins/marketplaces/maccing/plugins/maccing-monorepo/hooks/*.sh
   ```

3. **Reinstall plugin:**
   ```bash
   /plugin uninstall maccing-monorepo@maccing
   /plugin install maccing-monorepo@maccing
   ```

### Commands not available

If `/maccing-monorepo:info` or `/maccing-monorepo:run` don't work:

```bash
rm -rf ~/.claude/plugins/cache/maccing
/plugin install maccing-monorepo@maccing
```

## License

MIT
