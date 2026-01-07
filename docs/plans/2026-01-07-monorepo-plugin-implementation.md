# Monorepo Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Claude Code plugin that helps work effectively in monorepo projects with auto-detection, hooks, and comprehensive guidance.

**Architecture:** Bash scripts for hooks (no runtime dependencies), detection script reused by both hooks, skill and commands for user interaction.

**Tech Stack:** Bash, jq (JSON parsing), Claude Code plugin system

---

## Task 1: Create Plugin Scaffold

**Files:**
- Create: `plugins/maccing-monorepo/.claude-plugin/plugin.json`
- Create: `plugins/maccing-monorepo/README.md`

**Step 1: Create plugin directory structure**

```bash
mkdir -p plugins/maccing-monorepo/.claude-plugin
mkdir -p plugins/maccing-monorepo/hooks
mkdir -p plugins/maccing-monorepo/scripts
mkdir -p plugins/maccing-monorepo/skills/monorepo-workflows
mkdir -p plugins/maccing-monorepo/commands
```

**Step 2: Create plugin.json manifest**

Write to `plugins/maccing-monorepo/.claude-plugin/plugin.json`:

```json
{
  "name": "maccing-monorepo",
  "version": "1.0.0",
  "description": "Monorepo workflow assistance with auto-detection, root-level script enforcement, and comprehensive guidance for Turborepo, Nx, pnpm, npm, and yarn workspaces.",
  "author": {
    "name": "Andre Dezzy",
    "email": "andredezzy@users.noreply.github.com",
    "url": "https://github.com/andredezzy"
  },
  "homepage": "https://github.com/andredezzy/maccing",
  "repository": "https://github.com/andredezzy/maccing",
  "license": "MIT",
  "keywords": ["monorepo", "turborepo", "nx", "pnpm", "workspaces"],
  "hooks": "./hooks/hooks.json",
  "skills": "./skills/",
  "commands": ["./commands/"]
}
```

**Step 3: Create placeholder README.md**

Write to `plugins/maccing-monorepo/README.md`:

```markdown
# maccing-monorepo

Monorepo workflow assistance for Claude Code.

## Features

- Auto-detects monorepo tools (Turborepo, Nx, pnpm, npm, yarn workspaces)
- Reminds to run scripts from root with filters
- Comprehensive skill for monorepo best practices
- Utility commands for visibility

## Installation

TBD

## Usage

TBD
```

**Step 4: Commit scaffold**

```bash
git add plugins/maccing-monorepo/
git commit -m "feat(monorepo): create plugin scaffold"
```

---

## Task 2: Create Detection Script

**Files:**
- Create: `plugins/maccing-monorepo/scripts/detect-monorepo.sh`

**Step 1: Create detection script**

Write to `plugins/maccing-monorepo/scripts/detect-monorepo.sh`:

```bash
#!/bin/bash
# Detects monorepo tool and discovers packages
# Usage: detect-monorepo.sh [start_dir]
# Output: JSON with tool, root, filter_syntax, packages

set -e

START_DIR="${1:-$(pwd)}"
CURRENT="$START_DIR"

# Find monorepo root by searching upward
find_root() {
    while [ "$CURRENT" != "/" ]; do
        # Priority 1: Turborepo
        if [ -f "$CURRENT/turbo.json" ]; then
            echo "turborepo:$CURRENT"
            return 0
        fi
        # Priority 2: Nx
        if [ -f "$CURRENT/nx.json" ]; then
            echo "nx:$CURRENT"
            return 0
        fi
        # Priority 3: pnpm
        if [ -f "$CURRENT/pnpm-workspace.yaml" ]; then
            echo "pnpm:$CURRENT"
            return 0
        fi
        # Priority 4/5: npm/yarn (check package.json for workspaces)
        if [ -f "$CURRENT/package.json" ]; then
            if grep -q '"workspaces"' "$CURRENT/package.json" 2>/dev/null; then
                # Detect yarn vs npm
                if [ -f "$CURRENT/yarn.lock" ]; then
                    echo "yarn:$CURRENT"
                else
                    echo "npm:$CURRENT"
                fi
                return 0
            fi
        fi
        CURRENT=$(dirname "$CURRENT")
    done
    echo "none:"
    return 1
}

# Get filter syntax for each tool
get_filter_syntax() {
    local tool="$1"
    case "$tool" in
        turborepo) echo "turbo run <task> --filter=<package>" ;;
        nx) echo "nx <target> <project>" ;;
        pnpm) echo "pnpm --filter <package> <script>" ;;
        npm) echo "npm run <script> -w <package>" ;;
        yarn) echo "yarn workspace <package> <script>" ;;
        *) echo "" ;;
    esac
}

# Discover packages based on tool
discover_packages() {
    local tool="$1"
    local root="$2"
    local packages="[]"

    case "$tool" in
        turborepo|pnpm|npm|yarn)
            # Find all package.json files in workspace directories
            packages=$(find "$root" -name "package.json" -not -path "*/node_modules/*" -not -path "$root/package.json" 2>/dev/null | while read -r pkg; do
                local dir=$(dirname "$pkg")
                local rel_path="${dir#$root/}"
                local name=$(jq -r '.name // empty' "$pkg" 2>/dev/null)
                local scripts=$(jq -r '.scripts | keys | join(",")' "$pkg" 2>/dev/null || echo "")
                if [ -n "$name" ]; then
                    echo "{\"name\":\"$name\",\"path\":\"$rel_path\",\"scripts\":\"$scripts\"}"
                fi
            done | jq -s '.' 2>/dev/null || echo "[]")
            ;;
        nx)
            # Find all project.json files
            packages=$(find "$root" -name "project.json" -not -path "*/node_modules/*" 2>/dev/null | while read -r proj; do
                local dir=$(dirname "$proj")
                local rel_path="${dir#$root/}"
                local name=$(jq -r '.name // empty' "$proj" 2>/dev/null)
                local targets=$(jq -r '.targets | keys | join(",")' "$proj" 2>/dev/null || echo "")
                if [ -n "$name" ]; then
                    echo "{\"name\":\"$name\",\"path\":\"$rel_path\",\"scripts\":\"$targets\"}"
                fi
            done | jq -s '.' 2>/dev/null || echo "[]")
            ;;
    esac

    echo "$packages"
}

# Main
RESULT=$(find_root)
TOOL="${RESULT%%:*}"
ROOT="${RESULT#*:}"

if [ "$TOOL" = "none" ]; then
    echo '{"tool":null,"root":null,"filter_syntax":null,"packages":[]}'
    exit 0
fi

FILTER_SYNTAX=$(get_filter_syntax "$TOOL")
PACKAGES=$(discover_packages "$TOOL" "$ROOT")

jq -n \
    --arg tool "$TOOL" \
    --arg root "$ROOT" \
    --arg filter_syntax "$FILTER_SYNTAX" \
    --argjson packages "$PACKAGES" \
    '{tool: $tool, root: $root, filter_syntax: $filter_syntax, packages: $packages}'
```

**Step 2: Make script executable**

```bash
chmod +x plugins/maccing-monorepo/scripts/detect-monorepo.sh
```

**Step 3: Test detection script manually**

```bash
# Test on a non-monorepo directory (should return null)
./plugins/maccing-monorepo/scripts/detect-monorepo.sh /tmp
# Expected: {"tool":null,"root":null,"filter_syntax":null,"packages":[]}
```

**Step 4: Commit detection script**

```bash
git add plugins/maccing-monorepo/scripts/
git commit -m "feat(monorepo): add detection script for monorepo tools"
```

---

## Task 3: Create SessionStart Hook

**Files:**
- Create: `plugins/maccing-monorepo/hooks/session-start.sh`

**Step 1: Create SessionStart hook script**

Write to `plugins/maccing-monorepo/hooks/session-start.sh`:

```bash
#!/bin/bash
# SessionStart hook: Detects monorepo and injects context
# Receives JSON on stdin with cwd field

set -e

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DETECT_SCRIPT="$PLUGIN_ROOT/scripts/detect-monorepo.sh"

# Read hook input
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

if [ -z "$CWD" ]; then
    exit 0
fi

# Run detection
DETECTION=$("$DETECT_SCRIPT" "$CWD")
TOOL=$(echo "$DETECTION" | jq -r '.tool // empty')

if [ -z "$TOOL" ] || [ "$TOOL" = "null" ]; then
    exit 0
fi

ROOT=$(echo "$DETECTION" | jq -r '.root')
FILTER_SYNTAX=$(echo "$DETECTION" | jq -r '.filter_syntax')
PACKAGES=$(echo "$DETECTION" | jq -r '.packages')

# Format package list
PACKAGE_LIST=$(echo "$PACKAGES" | jq -r '.[] | "  - \(.name) (\(.path)): \(.scripts)"' 2>/dev/null || echo "  (no packages found)")

# Build context message
CONTEXT="This is a ${TOOL^} monorepo.
Root: $ROOT
Packages:
$PACKAGE_LIST

Run scripts from root using: $FILTER_SYNTAX"

# Output JSON for context injection
jq -n \
    --arg context "$CONTEXT" \
    '{
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": $context
        }
    }'

exit 0
```

**Step 2: Make script executable**

```bash
chmod +x plugins/maccing-monorepo/hooks/session-start.sh
```

**Step 3: Commit SessionStart hook**

```bash
git add plugins/maccing-monorepo/hooks/session-start.sh
git commit -m "feat(monorepo): add SessionStart hook for context injection"
```

---

## Task 4: Create PostToolUse Hook

**Files:**
- Create: `plugins/maccing-monorepo/hooks/post-tool-use.sh`

**Step 1: Create PostToolUse hook script**

Write to `plugins/maccing-monorepo/hooks/post-tool-use.sh`:

```bash
#!/bin/bash
# PostToolUse hook: Reminds to run scripts from root with filters
# Matches: Bash tool only
# Receives JSON on stdin with tool_input.command and cwd

set -e

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DETECT_SCRIPT="$PLUGIN_ROOT/scripts/detect-monorepo.sh"

# Script patterns that should run from root
SCRIPT_PATTERNS="^(npm run|npm exec|npx|yarn|pnpm|turbo|nx|jest|vitest|eslint|prettier|tsc)"

# Read hook input
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$CWD" ] || [ -z "$COMMAND" ]; then
    exit 0
fi

# Check if command matches script patterns
if ! echo "$COMMAND" | grep -qE "$SCRIPT_PATTERNS"; then
    exit 0
fi

# Run detection
DETECTION=$("$DETECT_SCRIPT" "$CWD")
TOOL=$(echo "$DETECTION" | jq -r '.tool // empty')

if [ -z "$TOOL" ] || [ "$TOOL" = "null" ]; then
    exit 0
fi

ROOT=$(echo "$DETECTION" | jq -r '.root')
FILTER_SYNTAX=$(echo "$DETECTION" | jq -r '.filter_syntax')

# Check if already at root
if [ "$CWD" = "$ROOT" ]; then
    exit 0
fi

# Calculate relative path from root
REL_PATH="${CWD#$ROOT/}"

# Try to find package name for current directory
PACKAGE_NAME=""
if [ -f "$CWD/package.json" ]; then
    PACKAGE_NAME=$(jq -r '.name // empty' "$CWD/package.json" 2>/dev/null)
fi

# Extract task from command
TASK=""
case "$COMMAND" in
    npm\ run\ *) TASK=$(echo "$COMMAND" | sed 's/npm run //' | awk '{print $1}') ;;
    yarn\ *) TASK=$(echo "$COMMAND" | awk '{print $2}') ;;
    pnpm\ *) TASK=$(echo "$COMMAND" | awk '{print $2}') ;;
    *) TASK="<task>" ;;
esac

# Build suggestion based on tool
case "$TOOL" in
    turborepo)
        if [ -n "$PACKAGE_NAME" ]; then
            SUGGESTION="turbo run $TASK --filter=$PACKAGE_NAME"
        else
            SUGGESTION="turbo run $TASK --filter=./$REL_PATH"
        fi
        ;;
    nx)
        if [ -n "$PACKAGE_NAME" ]; then
            SUGGESTION="nx $TASK $PACKAGE_NAME"
        else
            SUGGESTION="nx $TASK <project>"
        fi
        ;;
    pnpm)
        if [ -n "$PACKAGE_NAME" ]; then
            SUGGESTION="pnpm --filter $PACKAGE_NAME $TASK"
        else
            SUGGESTION="pnpm --filter ./$REL_PATH $TASK"
        fi
        ;;
    npm)
        if [ -n "$PACKAGE_NAME" ]; then
            SUGGESTION="npm run $TASK -w $PACKAGE_NAME"
        else
            SUGGESTION="npm run $TASK -w ./$REL_PATH"
        fi
        ;;
    yarn)
        if [ -n "$PACKAGE_NAME" ]; then
            SUGGESTION="yarn workspace $PACKAGE_NAME $TASK"
        else
            SUGGESTION="yarn workspace <package> $TASK"
        fi
        ;;
esac

# Build context message
CONTEXT="You ran \`$COMMAND\` from $REL_PATH/. For better caching and consistency, run from monorepo root ($ROOT): \`$SUGGESTION\`"

# Output JSON for context injection (allow, don't block)
jq -n \
    --arg context "$CONTEXT" \
    '{
        "decision": "allow",
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": $context
        }
    }'

exit 0
```

**Step 2: Make script executable**

```bash
chmod +x plugins/maccing-monorepo/hooks/post-tool-use.sh
```

**Step 3: Commit PostToolUse hook**

```bash
git add plugins/maccing-monorepo/hooks/post-tool-use.sh
git commit -m "feat(monorepo): add PostToolUse hook for script reminders"
```

---

## Task 5: Create Hooks Configuration

**Files:**
- Create: `plugins/maccing-monorepo/hooks/hooks.json`

**Step 1: Create hooks.json**

Write to `plugins/maccing-monorepo/hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/post-tool-use.sh"
          }
        ]
      }
    ]
  }
}
```

**Step 2: Commit hooks configuration**

```bash
git add plugins/maccing-monorepo/hooks/hooks.json
git commit -m "feat(monorepo): add hooks configuration"
```

---

## Task 6: Create Monorepo Workflows Skill

**Files:**
- Create: `plugins/maccing-monorepo/skills/monorepo-workflows/SKILL.md`

**Step 1: Create skill file**

Write to `plugins/maccing-monorepo/skills/monorepo-workflows/SKILL.md`:

```markdown
---
name: monorepo-workflows
description: |
  Comprehensive monorepo guidance for running tasks, managing dependencies, and understanding structure.
  Use when working in a detected monorepo project and needing help with:
  - Running scripts correctly with filters
  - Adding dependencies to specific packages
  - Understanding build order and caching
  - Troubleshooting common monorepo issues
---

# Monorepo Workflows

This skill provides comprehensive guidance for working in monorepo projects.

---

## Core Principle

**Always run scripts from the monorepo root using filters.**

Benefits:
- Better caching (shared cache across packages)
- Consistent task execution
- Proper dependency ordering
- Single source of truth for task definitions

---

## Running Scripts

### Turborepo

```bash
# Run task for specific package
turbo run build --filter=@repo/web

# Run task for package and its dependencies
turbo run build --filter=@repo/web...

# Run task for packages that changed since main
turbo run test --filter=[main...HEAD]

# Exclude a package
turbo run lint --filter=!@repo/docs

# Run for all packages
turbo run build
```

### Nx

```bash
# Run target for specific project
nx build web
# or
nx run web:build

# Run for affected projects
nx affected --target=build

# Run for all projects
nx run-many --target=build --all

# Exclude projects
nx run-many --target=test --all --exclude=docs
```

### pnpm Workspaces

```bash
# Run script for specific package
pnpm --filter @repo/web build
# or
pnpm --filter @repo/web run build

# Run for package and dependencies
pnpm --filter @repo/web... build

# Run for all packages
pnpm -r build
# or
pnpm --recursive build
```

### npm Workspaces

```bash
# Run script for specific package
npm run build -w @repo/web
# or
npm run build --workspace=@repo/web

# Run for all workspaces
npm run build --workspaces

# Run if script exists (skip packages without it)
npm run build --workspaces --if-present
```

### yarn Workspaces

```bash
# Run script for specific package
yarn workspace @repo/web build

# Run for all workspaces
yarn workspaces run build

# Yarn 2+ (berry)
yarn workspaces foreach run build
```

---

## Managing Dependencies

### Adding to a Specific Package

```bash
# Turborepo (uses underlying package manager)
cd packages/web && pnpm add lodash
# Better: use filter
pnpm add lodash --filter @repo/web

# pnpm
pnpm add lodash --filter @repo/web

# npm
npm install lodash -w @repo/web

# yarn
yarn workspace @repo/web add lodash

# Nx
nx run web:add --args="lodash"
```

### Shared Dependencies (Root)

Add to root `package.json` for:
- Build tools (typescript, eslint, prettier)
- Testing frameworks (jest, vitest)
- Shared dev dependencies

```bash
# pnpm (add to root)
pnpm add -D typescript -w

# npm
npm install -D typescript

# yarn
yarn add -D typescript -W
```

### Internal Package References

Reference workspace packages in `package.json`:

```json
{
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/utils": "workspace:^"
  }
}
```

---

## Build Order and Caching

### Understanding Task Pipelines

Turborepo `turbo.json`:
```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

- `^build`: Run build in dependencies first
- `outputs`: Cache these directories

### Bypassing Cache

```bash
# Turborepo
turbo run build --force

# Nx
nx build web --skip-nx-cache

# Clear cache entirely (Turborepo)
turbo daemon stop && rm -rf node_modules/.cache/turbo
```

### Parallel vs Sequential

Most tools run tasks in parallel by default when dependencies allow.

```bash
# Turborepo: limit concurrency
turbo run build --concurrency=2

# Nx: limit parallel
nx run-many --target=build --parallel=2
```

---

## Troubleshooting

### "Package not found" errors

1. Check package name matches `package.json`:
   ```bash
   cat packages/web/package.json | jq '.name'
   ```

2. Verify workspace configuration:
   ```bash
   # pnpm
   cat pnpm-workspace.yaml

   # npm/yarn
   cat package.json | jq '.workspaces'
   ```

3. Run package manager install:
   ```bash
   pnpm install
   # or
   npm install
   ```

### Circular dependency issues

1. Check dependency graph:
   ```bash
   # Turborepo
   turbo run build --graph

   # Nx
   nx graph
   ```

2. Look for cycles in the visualization

3. Refactor: extract shared code to a new package

### Cache invalidation problems

1. Check inputs configuration (Turborepo):
   ```json
   {
     "tasks": {
       "build": {
         "inputs": ["src/**", "package.json", "tsconfig.json"]
       }
     }
   }
   ```

2. Verify outputs are correct

3. Force rebuild to compare:
   ```bash
   turbo run build --force
   ```

---

## Quick Reference

| Action | Turborepo | Nx | pnpm |
|--------|-----------|----|----|
| Single package | `--filter=pkg` | `nx target pkg` | `--filter pkg` |
| With deps | `--filter=pkg...` | (automatic) | `--filter pkg...` |
| Affected | `--filter=[main...HEAD]` | `nx affected` | N/A |
| All | (default) | `--all` | `-r` |
| Exclude | `--filter=!pkg` | `--exclude=pkg` | `--filter=!pkg` |
```

**Step 2: Commit skill**

```bash
git add plugins/maccing-monorepo/skills/
git commit -m "feat(monorepo): add comprehensive monorepo-workflows skill"
```

---

## Task 7: Create Info Command

**Files:**
- Create: `plugins/maccing-monorepo/commands/info.md`

**Step 1: Create info command**

Write to `plugins/maccing-monorepo/commands/info.md`:

```markdown
---
description: Display detected monorepo structure and packages
---

# Monorepo Info Command

Display the detected monorepo tool, root directory, and all packages with their available scripts.

## Arguments

$ARGUMENTS

## Execution

1. Run the detection script to get monorepo information
2. Format and display the results

### Step 1: Run Detection

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/detect-monorepo.sh" "$(pwd)"
```

### Step 2: Format Output

Parse the JSON output and display in this format (using backticks for colored output):

`★ monorepo ───────────────────────────────────────────`

Tool:     `[tool name]`
Root:     `[root path]`

Packages:

  `[path]` ([package name])
  ├─ [comma-separated scripts]

  `[path]` ([package name])
  ├─ [comma-separated scripts]

Filter syntax:
  `[filter syntax for detected tool]`

`───────────────────────────────────────────────────────`

### Step 3: Handle No Monorepo

If no monorepo is detected, output:

`★ monorepo ───────────────────────────────────────────`

Status: `Not detected`

No monorepo configuration found in current directory or parents.

Supported tools:
- Turborepo (turbo.json)
- Nx (nx.json)
- pnpm (pnpm-workspace.yaml)
- npm/yarn (package.json with workspaces)

`───────────────────────────────────────────────────────`

## Examples

```bash
# Show monorepo info
/maccing-monorepo:info
```
```

**Step 2: Commit info command**

```bash
git add plugins/maccing-monorepo/commands/info.md
git commit -m "feat(monorepo): add info command"
```

---

## Task 8: Create Run Command

**Files:**
- Create: `plugins/maccing-monorepo/commands/run.md`

**Step 1: Create run command**

Write to `plugins/maccing-monorepo/commands/run.md`:

```markdown
---
description: Construct and optionally execute monorepo filter commands
---

# Monorepo Run Command

Help construct the correct command for running tasks in monorepo packages with proper filters.

## Arguments

$ARGUMENTS

Arguments are parsed as: `<task> [package] [flags]`

- `task`: The script/target to run (required)
- `package`: Package name or shorthand (optional, runs all if omitted)
- `--affected`: Only run for packages changed since main branch
- `--execute`: Execute the command after showing it

## Execution

### Step 1: Parse Arguments

Extract task, package, and flags from arguments.

### Step 2: Run Detection

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/detect-monorepo.sh" "$(pwd)"
```

### Step 3: Map Package Shorthand

If package is provided as shorthand (e.g., "web"), find the full package name from detected packages.

### Step 4: Construct Command

Based on detected tool:

**Turborepo:**
- All packages: `turbo run <task>`
- Specific: `turbo run <task> --filter=<package>`
- Affected: `turbo run <task> --filter=[main...HEAD]`

**Nx:**
- All packages: `nx run-many --target=<task> --all`
- Specific: `nx <task> <package>`
- Affected: `nx affected --target=<task>`

**pnpm:**
- All packages: `pnpm -r <task>`
- Specific: `pnpm --filter <package> <task>`
- Affected: N/A (suggest git-based approach)

**npm:**
- All packages: `npm run <task> --workspaces`
- Specific: `npm run <task> -w <package>`
- Affected: N/A

**yarn:**
- All packages: `yarn workspaces run <task>`
- Specific: `yarn workspace <package> <task>`
- Affected: N/A

### Step 5: Output

`★ monorepo:run ────────────────────────────────────────`

Task:    `<task>`
Package: `<package or "all">`
Tool:    `<detected tool>`

Command:
```bash
<constructed command>
```

`───────────────────────────────────────────────────────`

### Step 6: Execute (if --execute flag)

If `--execute` flag is provided:
1. Ask user for confirmation
2. Run the constructed command
3. Show output

## Examples

```bash
# Show command for building all packages
/maccing-monorepo:run build

# Show command for specific package
/maccing-monorepo:run dev web

# Show command for affected packages
/maccing-monorepo:run test --affected

# Execute the command
/maccing-monorepo:run build web --execute
```
```

**Step 2: Commit run command**

```bash
git add plugins/maccing-monorepo/commands/run.md
git commit -m "feat(monorepo): add run command"
```

---

## Task 9: Complete README

**Files:**
- Modify: `plugins/maccing-monorepo/README.md`

**Step 1: Write complete README**

Write to `plugins/maccing-monorepo/README.md`:

```markdown
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
```

**Step 2: Commit README**

```bash
git add plugins/maccing-monorepo/README.md
git commit -m "docs(monorepo): complete README documentation"
```

---

## Task 10: Update Marketplace Manifest

**Files:**
- Modify: `.claude-plugin/marketplace.json`

**Step 1: Read current marketplace.json**

```bash
cat .claude-plugin/marketplace.json
```

**Step 2: Add maccing-monorepo entry**

Add to the plugins array in `.claude-plugin/marketplace.json`:

```json
{
  "name": "maccing-monorepo",
  "source": "./plugins/maccing-monorepo",
  "description": "Monorepo workflow assistance with auto-detection for Turborepo, Nx, pnpm, npm, and yarn workspaces.",
  "version": "1.0.0",
  "author": { "name": "Andre Dezzy" },
  "keywords": ["monorepo", "turborepo", "nx", "pnpm", "workspaces"],
  "license": "MIT"
}
```

**Step 3: Commit marketplace update**

```bash
git add .claude-plugin/marketplace.json
git commit -m "feat: add maccing-monorepo to marketplace"
```

---

## Task 11: Test Plugin Locally

**Step 1: Test plugin loading**

```bash
claude --plugin-dir ./plugins/maccing-monorepo
```

Verify no errors on load.

**Step 2: Test commands**

In a monorepo project:
```bash
/maccing-monorepo:info
/maccing-monorepo:run build
```

**Step 3: Test hooks**

Start a session in a monorepo and verify:
- SessionStart injects context about packages
- Running `npm run dev` from child folder shows reminder

**Step 4: Document any fixes needed**

If issues found, fix and commit with appropriate message.

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Create plugin scaffold (plugin.json, README) |
| 2 | Create detection script |
| 3 | Create SessionStart hook |
| 4 | Create PostToolUse hook |
| 5 | Create hooks configuration |
| 6 | Create monorepo-workflows skill |
| 7 | Create info command |
| 8 | Create run command |
| 9 | Complete README documentation |
| 10 | Update marketplace manifest |
| 11 | Test plugin locally |
