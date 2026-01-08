---
description: Display detected monorepo structure and packages
---

# Monorepo Info Command

Display the detected monorepo tool, root directory, packages, and dependency flow diagram.

## Arguments

$ARGUMENTS

## Execution

1. Run the detection script to get monorepo information
2. Format and display the results with dependency diagram

### Step 1: Run Detection

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/detect-monorepo.sh" "$(pwd)"
```

The script returns JSON with: tool, root, filter_syntax, packages (each with name, path, description, scripts, dependencies).

### Step 2: Format Output

Parse the JSON output and display in this format:

```
★ monorepo ───────────────────────────────────────────

Tool:     [tool name]
Root:     [root path]

Packages:

  [path] ([package name])
  ├─ [comma-separated scripts]

  [path] ([package name])
  ├─ [comma-separated scripts]

Dependency Flow:

  ┌────────────────────────────────────────────────────────────────┐
  │                        APPLICATIONS                            │
  │                                                                │
  │  ┌───────────────────────────┐  ┌───────────────────────────┐  │
  │  │        [app path]         │  │        [app path]         │  │
  │  │     [description]         │  │     [description]         │  │
  │  │  [key deps from pkg.json] │  │  [key deps from pkg.json] │  │
  │  └─────────────┬─────────────┘  └─────────────┬─────────────┘  │
  │                │                              │                │
  └────────────────┼──────────────────────────────┼────────────────┘
                   │                              │
                   ▼                              ▼
  ┌────────────────────────────────────────────────────────────────┐
  │                          PACKAGES                              │
  │                                                                │
  │  ┌───────────────────────────┐  ┌───────────────────────────┐  │
  │  │       [pkg path]          │  │       [pkg path]          │  │
  │  │     [description]         │  │     [description]         │  │
  │  │  [key deps from pkg.json] │  │  [key deps from pkg.json] │  │
  │  └───────────────────────────┘  └───────────────────────────┘  │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘

  [app1] → [internal deps]
  [app2] → [internal deps]

Filter syntax:
  [filter syntax for detected tool]

───────────────────────────────────────────────────────
```

### Diagram Rules

1. **Separate apps and packages**: apps/ in APPLICATIONS box, packages/ in PACKAGES box
2. **Show descriptions**: Use description from package.json, or infer from dependencies
3. **Show key dependencies**: List 2-3 main dependencies (React, Next.js, etc.)
4. **Show internal deps**: At bottom, list which internal packages each app depends on
5. **Box drawing**: Use ┌ ┐ └ ┘ ─ │ ┬ ┴ ├ ┤ ▼ characters
6. **Fixed width**: Keep lines under 70 characters for terminal compatibility

### Step 3: Handle No Monorepo

If no monorepo is detected, output:

```
★ monorepo ───────────────────────────────────────────

Status: Not detected

No monorepo configuration found in current directory or parents.

Supported tools:
- Turborepo (turbo.json)
- Nx (nx.json)
- pnpm (pnpm-workspace.yaml)
- npm/yarn (package.json with workspaces)

───────────────────────────────────────────────────────
```

## Examples

```bash
# Show monorepo info
/maccing-monorepo:info
```
