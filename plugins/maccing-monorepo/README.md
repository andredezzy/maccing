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

## License

MIT
