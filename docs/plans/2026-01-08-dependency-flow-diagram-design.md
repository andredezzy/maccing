# Dependency Flow Diagram Enhancement

## Overview

Enhance the monorepo plugin's `/maccing-monorepo:info` command to generate granular dependency flow diagrams with real arrows linking specific packages to their dependencies.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Target complexity | Adaptive (all sizes) |
| Arrow style | Layered with vertical flow |
| Detail level | Full detail (every package gets a box) |
| Layer algorithm | Hybrid: apps on top, topological sort for packages |
| Box sizing | Responsive rows (70 char width, even distribution) |

## Algorithm

### Phase 1: Dependency Analysis

- Parse each package's `dependencies` and `devDependencies`
- Filter to only internal workspace packages (matching monorepo scope, e.g., `@gate/`)
- Build directed graph: `packageA → [packageB, packageC]`

### Phase 2: Layer Assignment

- Separate apps (`apps/*`) from packages (`packages/*`)
- Apps always go in Layer 0 (top)
- For packages, perform topological sort:
  - Foundation (Layer N): packages with no internal dependencies
  - Layer N-1: packages that only depend on Layer N
  - Continue upward until all packages assigned
- Packages at same dependency depth share a layer

### Phase 3: Rendering

- Calculate box widths to fill 70 characters per row evenly
- Render Layer 0 (apps) in APPLICATIONS box
- Render remaining layers in PACKAGES box with arrows between layers
- Add summary lines at bottom: `app → dep1, dep2, dep3`

### Edge Cases

- Circular dependencies: detect and warn, place in same layer
- No internal deps: package goes to foundation layer
- Single package: simplified single-box diagram
- Very long names: truncate with `...`
- Many packages per layer: wrap to multiple rows

## Visual Output Format

```
★ monorepo ───────────────────────────────────────────

Tool:     turborepo
Root:     /path/to/project

Packages:
  apps/mesh (@gate/mesh)
  ├─ dev, build, test

  packages/core (@gate/core)
  ├─ dev, build, test

Dependency Flow:

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

───────────────────────────────────────────────────────
```

## Box Format

Each box contains:
- Line 1: Package name (e.g., `@gate/mesh`)
- Line 2: Short description from `package.json` (truncated to fit, max ~20 chars)

Description source priority:
1. `description` field from `package.json`
2. Infer from package name
3. Show relative path as fallback

## Implementation

### Files to Modify

1. **`scripts/detect-monorepo.sh`**
   - Already extracts dependencies (line 76)
   - Filter for internal workspace packages only
   - Extract package scope from root package.json

2. **`commands/info.md`**
   - Replace static diagram template with dynamic generation algorithm
   - Add layer calculation and box sizing steps
   - Update diagram rules section

### Execution Logic

```
1. Parse JSON from detect-monorepo.sh
2. Extract package scope from first package name (e.g., @gate/)
3. Filter dependencies to only those matching scope
4. Build dependency graph: {pkg: [internal deps]}
5. Separate apps/ from packages/
6. Topological sort packages into layers
7. Calculate box widths per row (70 char total, even distribution)
8. Render APPLICATIONS section with arrows
9. Render PACKAGES section with layered arrows
10. Add summary lines: app → dep1, dep2, dep3
```

## Documentation Updates

After implementation, update:

1. **`plugins/maccing-monorepo/commands/info.md`**: New dynamic algorithm
2. **`plugins/maccing-monorepo/README.md`**: Updated example output
3. **`plugins/maccing-monorepo/skills/monorepo-workflows/SKILL.md`**: If references info output
4. **`rules/patterns/ASCII.md`**: Add "Layered Dependency Diagram" pattern
5. **`README.md`** (root): Update monorepo plugin example if present

## Version Update

Bump to next minor version in:
- `plugins/maccing-monorepo/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `plugins/maccing-monorepo/README.md`
