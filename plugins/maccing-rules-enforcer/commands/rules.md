---
name: rules
description: Display current project rules and enforcement status
---

# Display Project Rules

Show the user what rules are currently being enforced in this project.

## Steps

1. **Detect rules location** by checking these paths in order:
   - `rules/RULES.md`
   - `RULES.md`
   - `.claude/RULES.md`
   - `CLAUDE.md`
   - `.claude/CLAUDE.md`
   - `.claude/rules/*.md` (all files)

2. **Display status banner:**

```
★ rules-enforcer ─────────────────────────────────

Status: ACTIVE

Rules Source:
  • rules/RULES.md (primary)
  • .claude/rules/*.md (supplementary)

Hooks Enabled:
  ✓ SessionStart     (full rules at session start)
  ✓ UserPromptSubmit (full rules every prompt)
  ✓ PreCompact       (re-inject after compression)
  ✓ Stop             (verification before stopping)

Token Cost: ~800 tokens per injection

─────────────────────────────────────────────────
```

3. **Read and display the full rules content** from detected files.

4. **If no rules found**, display:

```
⚠ rules-enforcer ─────────────────────────────────

Status: NO RULES FOUND

Create a rules file in one of these locations:
  • rules/RULES.md (recommended)
  • RULES.md
  • CLAUDE.md
  • .claude/rules/*.md

─────────────────────────────────────────────────
```
