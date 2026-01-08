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

Generate a layered ASCII diagram following these steps:

#### Diagram Generation Algorithm

1. **Extract package scope**: Get the common scope from package names (e.g., `@gate/` from `@gate/core`)

2. **Filter internal dependencies**: For each package, keep only dependencies matching the scope

3. **Separate apps and packages**:
   - Apps: packages with path starting with `apps/`
   - Packages: everything else

4. **Topological sort packages**:
   - Layer N (foundation): packages with no internal dependencies
   - Layer N-1: packages that only depend on Layer N
   - Continue upward until all packages assigned
   - Packages at same depth share a layer

5. **Calculate box layout**:
   - Total width: 70 characters
   - Boxes per row: divide evenly, wrap if needed
   - Each box: name on line 1, description on line 2 (truncate to fit)

6. **Render APPLICATIONS section**:
   - Outer box with title
   - Inner boxes for each app with vertical connectors (│) at bottom
   - Close outer box with vertical lines passing through

7. **Render PACKAGES section**:
   - Outer box with title
   - For each layer (highest to lowest):
     - Inner boxes with name and description
     - Layer label on right (← Layer N)
     - Vertical connectors (│ and ▼) between layers
   - Close outer box

8. **Add summary lines**:
   - For each app: `appname → dep1, dep2, dep3`

#### Box Drawing Characters

Use these characters for consistent rendering:
- Corners: `┌ ┐ └ ┘`
- Lines: `─ │`
- T-junctions: `├ ┤ ┬ ┴`
- Arrows: `▼`

#### Example Output (8 packages)

```
┌──────────────────────────────────────────────────────────────────────┐
│                            APPLICATIONS                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │
│  │   @gate/mesh    │  │   @gate/tera    │  │   @gate/mcp     │       │
│  │  Backend API    │  │    Frontend     │  │   MCP Server    │       │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘       │
│           │                    │                    │                │
└───────────┼────────────────────┼────────────────────┼────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                              PACKAGES                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐             │
│  │  @gate/tasks  │  │ @gate/ledger  │  │   @gate/ai    │  ← Layer 1  │
│  │  Job queues   │  │  Accounting   │  │ AI artifacts  │             │
│  └───────┬───────┘  └───────┬───────┘  └───────────────┘             │
│          │                  │                                        │
│          ▼                  ▼                                        │
│  ┌─────────────────────────────────────┐                             │
│  │           @gate/database            │              ← Layer 2      │
│  │       Prisma + MongoDB layer        │                             │
│  └──────────────────┬──────────────────┘                             │
│                     │                                                │
│                     ▼                                                │
│  ┌─────────────────────────────────────┐                             │
│  │             @gate/core              │              ← Layer 3      │
│  │    Domain entities and schemas      │                             │
│  └─────────────────────────────────────┘                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

mesh → tasks, ledger, database, core
tera → ai, core
mcp  → database, core
```

#### Example Output (2 packages, simple)

```
┌──────────────────────────────────────────────────────────────────────┐
│                            APPLICATIONS                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────┐                                 │
│  │            @repo/web            │                                 │
│  │         Web application         │                                 │
│  └────────────────┬────────────────┘                                 │
│                   │                                                  │
└───────────────────┼──────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                              PACKAGES                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────┐                                 │
│  │            @repo/ui             │                                 │
│  │        UI component lib         │                                 │
│  └─────────────────────────────────┘                                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

web → ui
```

#### Edge Cases

- **No internal dependencies**: Show packages in single row, no arrows
- **Circular dependencies**: Place in same layer, warn in output
- **Long package names**: Truncate with `...` to fit box width
- **Missing description**: Use package path as fallback

Filter syntax:
  [filter syntax for detected tool]

───────────────────────────────────────────────────────
```

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
