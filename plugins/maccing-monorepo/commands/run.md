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

`────────────────────────────────────────────────────────`

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
