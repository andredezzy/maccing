# Monorepo Plugin Design

Date: 2026-01-07

## Overview

**Plugin name:** `maccing-monorepo`

**Purpose:** Help Claude Code work effectively in monorepo projects by enforcing root-level script execution with filters and providing comprehensive monorepo guidance.

**Philosophy:** Guide, don't block. Remind Claude of best practices without being intrusive.

---

## Detection Strategy

The plugin auto-detects monorepo tools in this priority order:

| Priority | Tool | Detection | Filter Syntax |
|----------|------|-----------|---------------|
| 1 | Turborepo | `turbo.json` exists | `turbo run <task> --filter=<pkg>` |
| 2 | Nx | `nx.json` exists | `nx <target> <project>` |
| 3 | pnpm | `pnpm-workspace.yaml` exists | `pnpm --filter <pkg> <script>` |
| 4 | npm | `package.json` has `workspaces` | `npm run <script> -w <pkg>` |
| 5 | yarn | `package.json` has `workspaces` | `yarn workspace <pkg> <script>` |

**Package Discovery:**

For each tool, the plugin discovers packages:
- Turborepo/pnpm/npm/yarn: Parse workspace globs, find all `package.json` files
- Nx: Parse `nx.json` and `project.json` files

Detection runs fresh each time (no caching) to ensure accuracy if packages change during session.

---

## Hooks Architecture

### SessionStart Hook

Runs when Claude Code starts. The hook script will:

1. Search upward from `cwd` to find monorepo root (looking for detection files)
2. Identify which tool is in use
3. Discover all packages/apps in the workspace
4. Output context injection with structure info

**Output example:**

```
This is a Turborepo monorepo.
Root: /Users/you/project
Packages:
  - @repo/web (apps/web): dev, build, test, lint
  - @repo/api (apps/api): dev, build, test
  - @repo/ui (packages/ui): build, lint

Run scripts from root using: turbo run <task> --filter=<package>
```

### PostToolUse Hook (matcher: Bash)

Runs after every Bash command. The hook script will:

1. Parse the executed command from `tool_input.command`
2. Check if it matches script patterns: `npm run`, `yarn`, `pnpm`, `turbo`, `nx`, `jest`, `vitest`, `eslint`, `prettier`, `tsc`
3. Check if `cwd` is NOT the monorepo root
4. If both true: inject reminder context

**Reminder output example:**

```json
{
  "decision": "allow",
  "hookSpecificOutput": {
    "additionalContext": "You ran `npm run dev` from apps/web/. For better caching and consistency, run from monorepo root: `turbo run dev --filter=@repo/web`"
  }
}
```

---

## Comprehensive Skill

**Skill name:** `monorepo-workflows`

**Trigger:** When Claude is working in a detected monorepo and needs guidance on running tasks, managing dependencies, or understanding structure.

**Skill content covers:**

1. **Running scripts correctly**
   - Always run from monorepo root
   - Use tool-specific filter syntax
   - Examples for each detected tool

2. **Dependency management**
   - Adding deps to specific packages: `pnpm add lodash --filter @repo/web`
   - Shared dependencies at root vs per-package
   - Internal package references

3. **Common patterns**
   - Building with dependencies: `turbo run build --filter=web...`
   - Running affected only: `turbo run test --filter=[main...HEAD]`
   - Excluding packages: `--filter=!@repo/docs`

4. **Build order and caching**
   - Understanding task pipelines
   - When to use `--force` to bypass cache
   - Parallel vs sequential execution

5. **Troubleshooting**
   - "Package not found" errors
   - Circular dependency issues
   - Cache invalidation problems

The skill is adaptive: reads the detected tool from SessionStart context and provides syntax specific to that tool.

---

## Utility Commands

### `/monorepo:info`

Displays the detected monorepo structure in a formatted output.

**Output:**

`★ monorepo ───────────────────────────────────────────`

Tool:     `Turborepo`
Root:     `/Users/you/project`

Packages:

  `apps/web` (@repo/web)
  ├─ dev, build, test, lint

  `apps/api` (@repo/api)
  ├─ dev, build, test

  `packages/ui` (@repo/ui)
  ├─ build, lint

Filter syntax:
  `turbo run <task> --filter=<package>`

`───────────────────────────────────────────────────────`

### `/monorepo:run <task> [package]`

Helps construct and explain the correct command.

**Usage examples:**
- `/monorepo:run build`: Shows how to build all packages
- `/monorepo:run dev web`: Shows `turbo run dev --filter=@repo/web`
- `/monorepo:run test --affected`: Shows `turbo run test --filter=[main...HEAD]`

The command will:
1. Detect current tool
2. Map package shorthand to full name (e.g., `web` to `@repo/web`)
3. Output the correct command with explanation
4. Optionally execute it if user confirms

---

## Plugin Structure

```
plugins/maccing-monorepo/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   ├── hooks.json
│   ├── session-start.sh
│   └── post-tool-use.sh
├── scripts/
│   └── detect-monorepo.sh
├── skills/
│   └── monorepo-workflows/
│       └── SKILL.md
├── commands/
│   ├── info.md
│   └── run.md
└── README.md
```

**Hook scripts written in Bash:**
- No runtime dependencies (Node, Python)
- Fast execution
- Uses `jq` for JSON parsing (commonly available)

**Detection script** (`detect-monorepo.sh`):
- Reusable by both hooks
- Outputs JSON: `{"tool": "turborepo", "root": "/path", "packages": [...]}`

---

## Summary

| Component | Purpose |
|-----------|---------|
| **SessionStart hook** | Detect monorepo tool, discover packages, inject context |
| **PostToolUse hook** | Remind Claude to use root + filters when running scripts from child folders |
| **Skill** | Comprehensive monorepo guidance (scripts, deps, patterns, troubleshooting) |
| **`/monorepo:info`** | Display detected structure |
| **`/monorepo:run`** | Help construct correct filter commands |

**Supported tools:** Turborepo, Nx, pnpm workspaces, npm workspaces, yarn workspaces

**Script patterns detected:** `npm`, `yarn`, `pnpm`, `turbo`, `nx`, `jest`, `vitest`, `eslint`, `prettier`, `tsc`
