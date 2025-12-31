# maccing

Claude Code plugins built for developers who care about code quality.

---

## Installation

    /plugin marketplace add andredezzy/maccing

---

## Updating Plugins

**Manual update:**

    /plugin marketplace update maccing

**Enable auto-update:**

1. Run `/plugin`
2. Select **Marketplaces** tab
3. Select `maccing`
4. Select **Enable auto-update**

**Reinstall to get latest:**

    /plugin install maccing-code-reviewer@maccing

---

## Available Plugins

### maccing-code-reviewer

**Description:** Multi-agent code review with automatic pattern discovery

**Categories:** code-review, quality, security

**Installation:**

    /plugin install maccing-code-reviewer@maccing

**What you get:**

- **Automatic pattern discovery** learns conventions from YOUR codebase
- 6 specialized review agents running in parallel
- Deep multi-pass analysis with ULTRATHINK methodology
- Project-aware rules (uses your explicit rules OR discovers patterns)
- Custom agent extensibility
- Persistent reports in docs/code-reviews/

**Pattern Discovery:**

When no explicit rules exist, the reviewer scans your codebase to discover patterns:

```
★ Pattern Discovery ════════════════════════════════════

naming patterns discovered:

  Boolean Prefixes
  ├─ is*     → 73% (89/122 booleans)
  ├─ has*    → 18% (22/122 booleans)
  └─ can*    →  5% (6/122 booleans)
  ✓ Adopted: Booleans should use is/has/can prefixes

architecture patterns discovered:

  Import Boundaries
  ├─ components/ never imports from pages/  → 100%
  └─ utils/ never imports from components/  → 94%
  ✓ Adopted: Layer boundaries enforced

════════════════════════════════════════════════════════
```

**Review Agents:**

| Agent | Focus | What It Checks |
|-------|-------|----------------|
| **naming-agent** | Naming conventions | Boolean prefixes (`is`, `has`, `should`), interface suffixes, enum casing, component names, constants |
| **code-style-agent** | Formatting patterns | Spacing, blank lines, ternary operators, composition patterns, React keys |
| **clean-code-agent** | Code quality | Unused code, commented code, obvious comments, `any` types, nested ternaries, error handling |
| **architecture-agent** | Layer boundaries | Separation of concerns, dependency direction, circular dependencies, file colocation |
| **security-agent** | Vulnerabilities | SQL injection, XSS, command injection, secrets in code, auth checks, sensitive data in logs |
| **i18n-agent** | Internationalization | Translation keys, hardcoded strings, locale coverage, pluralization |

**Commands:**

| Command | Description |
|---------|-------------|
| `/maccing-code-reviewer:review` | Run full review with all agents |
| `/maccing-code-reviewer:review --only security,architecture` | Run only specific agents |
| `/maccing-code-reviewer:review --skip i18n,naming` | Skip specific agents |
| `/maccing-code-reviewer:review --scope src/api/` | Review specific directory |
| `/maccing-code-reviewer:review --no-save` | Output to console only |

---

## How Pattern Discovery Works

```
┌─────────────────────────────────────────────────────────┐
│                   Rule Resolution                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  For each agent category:                               │
│                                                          │
│    1. Check: Does explicit rule file exist?             │
│       └─ YES → Use explicit rules                       │
│       └─ NO  → Run pattern discovery                    │
│                                                          │
│    2. Pattern discovery:                                │
│       ├─ Scan entire codebase                           │
│       ├─ Extract conventions per category               │
│       ├─ Calculate consistency percentages              │
│       └─ Adopt patterns with >60% consistency           │
│                                                          │
│    3. Agent uses discovered patterns as rules           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Every rule is either:**
- Explicitly defined by you
- Discovered from your actual codebase

No generic defaults are imposed.

---

## Documentation

| Plugin | README | Configuration | Examples |
|--------|--------|---------------|----------|
| **maccing-code-reviewer** | [README](plugins/maccing-code-reviewer/README.md) | `.claude/plugins/maccing/code-reviewer.json` | [View examples](plugins/maccing-code-reviewer/examples/) |

---

## Marketplace Structure

    maccing/
    ├── .claude-plugin/
    │   └── marketplace.json
    └── plugins/
        └── maccing-code-reviewer/
            ├── .claude-plugin/
            │   └── plugin.json
            ├── skills/
            │   └── code-review/
            │       └── SKILL.md
            ├── commands/
            │   └── review.md
            ├── examples/
            │   ├── README.md
            │   ├── NAMING.md
            │   ├── CLEAN_CODE.md
            │   ├── SECURITY.md
            │   └── ARCHITECTURE.md
            └── README.md

---

## Philosophy

- **Discovery-first** — Learn from YOUR codebase, not generic rules
- **Thorough over fast** — Deep multi-pass analysis catches what quick scans miss
- **Evidence over claims** — Every issue includes file:line and correct pattern
- **Systematic over ad-hoc** — Structured methodology beats random checks
- **Project-aware** — Respect your established patterns
- **Transparent** — See what was discovered and why

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

---

## License

MIT
