# Example Rule Templates

This folder contains **optional reference templates** for explicit rule files.

---

## How Rules Work

The maccing-code-reviewer uses a **discovery-first approach**:

1. **Explicit rules** — If you provide rule files, they are used directly
2. **Pattern discovery** — If no explicit rules exist, patterns are discovered from your codebase

You do NOT need to copy these files. The reviewer will automatically learn your codebase conventions.

---

## When to Use These Templates

Use these templates if you want to:

- **Override discovered patterns** with explicit rules
- **Establish conventions** before your codebase is large enough for discovery
- **Enforce stricter standards** than your codebase currently follows

---

## How to Use

1. Copy the desired template to your project root or `rules/` folder
2. Customize the rules to match your team's conventions
3. Reference the file in your config:

```json
{
  "ruleFiles": ["rules/NAMING.md", "rules/ARCHITECTURE.md"]
}
```

---

## Available Templates

| File | Description |
|------|-------------|
| `NAMING.md` | Boolean prefixes, function naming, constants, components |
| `CLEAN_CODE.md` | Type safety, error handling, comments, code organization |
| `SECURITY.md` | Input validation, auth patterns, secret handling |
| `ARCHITECTURE.md` | Layer boundaries, import directions, file colocation |

---

## Philosophy

These templates represent common industry conventions. However, **your codebase is the source of truth**. The reviewer respects your established patterns over generic rules.

If you have no explicit rules, the reviewer will:
- Scan your entire codebase
- Identify patterns with >60% consistency
- Use those patterns as rules for the review

This ensures the reviewer works WITH your codebase, not against it.
