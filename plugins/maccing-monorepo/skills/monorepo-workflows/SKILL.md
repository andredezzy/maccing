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
