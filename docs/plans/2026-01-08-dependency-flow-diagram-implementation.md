# Dependency Flow Diagram Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement granular dependency flow diagrams showing real arrows between specific packages.

**Architecture:** Update the `/maccing-monorepo:info` command to generate layered ASCII diagrams with topological sorting. Apps always on top, packages sorted by dependency depth below, with vertical arrows connecting dependencies.

**Tech Stack:** Bash script enhancements, Markdown command definition, ASCII box-drawing characters.

---

## Task 1: Enhance detect-monorepo.sh for Internal Dependency Filtering

**Files:**
- Modify: `plugins/maccing-monorepo/scripts/detect-monorepo.sh:76`

**Step 1: Update dependency extraction to include all internal deps**

Current line 76 only extracts deps starting with `@`. Update to output internal dependencies as a JSON array for better parsing.

Replace lines 75-78:
```bash
# Extract internal dependencies (workspace packages)
local deps=$(jq -r '(.dependencies // {}) + (.devDependencies // {}) | keys | .[]' "$pkg" 2>/dev/null | grep -E '^@' | tr '\n' ',' | sed 's/,$//' || echo "")
if [ -n "$name" ]; then
    echo "{\"name\":\"$name\",\"path\":\"$rel_path\",\"description\":\"$description\",\"scripts\":\"$scripts\",\"dependencies\":\"$deps\"}"
fi
```

With:
```bash
# Extract all scoped dependencies (will filter for internal later)
local deps=$(jq -r '(.dependencies // {}) + (.devDependencies // {}) | keys | map(select(startswith("@"))) | join(",")' "$pkg" 2>/dev/null || echo "")
if [ -n "$name" ]; then
    echo "{\"name\":\"$name\",\"path\":\"$rel_path\",\"description\":\"$description\",\"scripts\":\"$scripts\",\"dependencies\":\"$deps\"}"
fi
```

**Step 2: Test the script**

Run:
```bash
cd /Users/andrevictor/www/Payme-Works/gate && /Users/andrevictor/www/Andre-Dezzy/maccing/plugins/maccing-monorepo/scripts/detect-monorepo.sh "$(pwd)" | jq '.packages[] | {name, dependencies}'
```

Expected: Each package shows its dependencies as comma-separated string.

**Step 3: Commit**

```bash
git add plugins/maccing-monorepo/scripts/detect-monorepo.sh
git commit -m "$(cat <<'EOF'
refactor(monorepo): improve dependency extraction in detect script

Use jq for cleaner filtering of scoped dependencies.
EOF
)"
```

---

## Task 2: Update info.md Command with Layered Diagram Algorithm

**Files:**
- Modify: `plugins/maccing-monorepo/commands/info.md`

**Step 1: Replace the Dependency Flow section**

Replace lines 44-76 (the entire Dependency Flow section and diagram template) with the new algorithm:

```markdown
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
```

**Step 2: Update diagram rules section**

Replace lines 80-86 (old diagram rules) to reference the algorithm above. Delete the redundant rules since they're now in the algorithm.

**Step 3: Test the command**

Run:
```bash
cd /Users/andrevictor/www/Payme-Works/gate && claude --plugin-dir /Users/andrevictor/www/Andre-Dezzy/maccing/plugins/maccing-monorepo
```

Then: `/maccing-monorepo:info`

Expected: Layered diagram with real dependency arrows.

**Step 4: Commit**

```bash
git add plugins/maccing-monorepo/commands/info.md
git commit -m "$(cat <<'EOF'
feat(monorepo): add layered dependency flow diagram algorithm

Replace static diagram template with dynamic generation:
- Topological sort for layer assignment
- Apps on top, packages sorted by dependency depth
- Vertical arrows connecting actual dependencies
- Responsive box sizing for 70 char width
EOF
)"
```

---

## Task 3: Update ASCII Patterns Documentation

**Files:**
- Modify: `rules/patterns/ASCII.md`

**Step 1: Add Layered Dependency Diagram pattern**

Add new section after the `<vertical>` pattern (around line 102):

```markdown
  <layered-dependency>
  ## Layered Dependency Diagram

  For monorepo dependency visualization with multiple layers:

  ```
  ┌──────────────────────────────────────────────────────────────────────┐
  │                            APPLICATIONS                              │
  ├──────────────────────────────────────────────────────────────────────┤
  │                                                                      │
  │  ┌─────────────────┐  ┌─────────────────┐                            │
  │  │   @scope/app1   │  │   @scope/app2   │                            │
  │  │  Description    │  │  Description    │                            │
  │  └────────┬────────┘  └────────┬────────┘                            │
  │           │                    │                                     │
  └───────────┼────────────────────┼─────────────────────────────────────┘
              │                    │
              ▼                    ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                              PACKAGES                                │
  ├──────────────────────────────────────────────────────────────────────┤
  │                                                                      │
  │  ┌─────────────────────────────────┐                      ← Layer 1  │
  │  │          @scope/pkg1            │                                 │
  │  │         Description             │                                 │
  │  └────────────────┬────────────────┘                                 │
  │                   │                                                  │
  │                   ▼                                                  │
  │  ┌─────────────────────────────────┐                      ← Layer 2  │
  │  │          @scope/pkg2            │                                 │
  │  │         Description             │                                 │
  │  └─────────────────────────────────┘                                 │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘

  app1 → pkg1, pkg2
  app2 → pkg1
  ```

  Rules:
  - Fixed width: 70 characters
  - Apps always in top section
  - Packages sorted by dependency depth (foundation at bottom)
  - Vertical connectors (│ ▼) link actual dependencies
  - Layer labels on right margin
  - Summary at bottom: `app → dep1, dep2`
  </layered-dependency>
```

**Step 2: Commit**

```bash
git add rules/patterns/ASCII.md
git commit -m "$(cat <<'EOF'
docs: add layered dependency diagram pattern

New ASCII pattern for monorepo dependency visualization.
EOF
)"
```

---

## Task 4: Update Plugin README

**Files:**
- Modify: `plugins/maccing-monorepo/README.md`

**Step 1: Add example diagram output**

After line 46 ("Shows tool, root directory..."), add an example:

```markdown

Example output:

```
★ monorepo ───────────────────────────────────────────

Tool:     turborepo
Root:     /path/to/project

Packages:
  apps/web (@repo/web)
  ├─ dev, build, test

  packages/ui (@repo/ui)
  ├─ dev, build

Dependency Flow:

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

───────────────────────────────────────────────────────
```
```

**Step 2: Commit**

```bash
git add plugins/maccing-monorepo/README.md
git commit -m "$(cat <<'EOF'
docs(monorepo): add example diagram output to README
EOF
)"
```

---

## Task 5: Version Bump

**Files:**
- Modify: `plugins/maccing-monorepo/.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `plugins/maccing-monorepo/README.md`

**Step 1: Update plugin.json version**

Change line 3:
```json
"version": "1.2.0",
```
To:
```json
"version": "1.3.0",
```

**Step 2: Update marketplace.json version**

Change line 28:
```json
"version": "1.2.0",
```
To:
```json
"version": "1.3.0",
```

**Step 3: Update README expected version**

Change line 100:
```markdown
Expected: `"version": "1.2.0"`
```
To:
```markdown
Expected: `"version": "1.3.0"`
```

**Step 4: Commit**

```bash
git add plugins/maccing-monorepo/.claude-plugin/plugin.json .claude-plugin/marketplace.json plugins/maccing-monorepo/README.md
git commit -m "$(cat <<'EOF'
chore(monorepo): bump version to 1.3.0

New feature: layered dependency flow diagrams.
EOF
)"
```

---

## Task 6: Update Root README (if needed)

**Files:**
- Check: `README.md` (root)

**Step 1: Check if monorepo plugin example exists**

Read the root README and check if it has an example of the monorepo info output.

**Step 2: Update if present**

If there's an example diagram, update it to match the new layered format.

**Step 3: Commit if changed**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: update monorepo plugin example in root README
EOF
)"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Enhance dependency extraction | `scripts/detect-monorepo.sh` |
| 2 | Update info command with algorithm | `commands/info.md` |
| 3 | Add ASCII pattern documentation | `rules/patterns/ASCII.md` |
| 4 | Update plugin README | `plugins/maccing-monorepo/README.md` |
| 5 | Version bump | 3 files |
| 6 | Update root README | `README.md` |
