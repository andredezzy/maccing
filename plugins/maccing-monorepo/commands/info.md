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
