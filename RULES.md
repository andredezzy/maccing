# Agent Rules

## Project Overview

**maccing** is an open-source Claude Code plugin marketplace. Each plugin lives in `plugins/<plugin-name>/` with its own manifest, skills, commands, and documentation.

---

## Plugin Development Standards

### Directory Structure (MANDATORY)

Every plugin MUST follow this structure:

```
plugins/<plugin-name>/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest (required)
├── skills/
│   └── <skill-name>/
│       └── SKILL.md          # Skill definition
├── commands/
│   └── <command>.md          # Slash commands
├── examples/                 # Optional rule templates
│   └── *.md                  # UPPERCASE filenames
└── README.md                 # Plugin documentation
```

### Manifest Requirements

Every `plugin.json` must include:
- `name`: kebab-case, prefixed with `maccing-`
- `version`: semantic versioning (MAJOR.MINOR.PATCH)
- `description`: clear, concise explanation
- `author`: name, email, url
- `license`: MIT

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Plugin name | `maccing-<name>` | `maccing-code-reviewer` |
| Skill files | `SKILL.md` | `skills/code-review/SKILL.md` |
| Example files | UPPERCASE | `examples/NAMING.md` |
| Commands | lowercase | `commands/review.md` |

---

## Code Quality Standards

### Documentation Files

- **Filenames MUST be UPPERCASE**: all `.md` files use UPPERCASE names (except README.md)
- **No emojis in documentation**: use ASCII characters and symbols only
- **Use code blocks**: for commands, examples, and file structures

### Markdown Style

```markdown
# Main heading

Brief description.

---

## Section

- **Bold labels**, description follows with comma
- Use code blocks for commands
- Use tables for structured data
```

### Comments and Descriptions

**CRITICAL: Use commas or colons instead of hyphens as separators.**

NEVER use em dashes (—), en dashes (–), or hyphens (-) as separators in comments or descriptions. Use commas or colons instead.

| Wrong | Correct |
|-------|---------|
| `**Label** — description` | `**Label**: description` or `**Label**, description` |
| `**Label** - description` | `**Label**: description` or `**Label**, description` |
| `value - meaning` | `value: meaning` or `value, meaning` |

**Rationale:** Hyphens and dashes can be confused with code operators (subtraction, flags). Commas and colons create natural, readable sentence flow.

Additional rules:
- **Explain "why", not "what"**: Comments should provide context
- **Sentence case**: Capitalize first word after separator

---

## Testing Plugins

### Local Testing (MANDATORY)

Always test plugins locally before committing:

```bash
# Test plugin loading
claude --plugin-dir ./plugins/<plugin-name>

# Verify no errors in output
```

### Testing Checklist

Before pushing changes:
- [ ] Plugin loads without errors
- [ ] Commands are accessible via `/plugin-name:command`
- [ ] Skills trigger on natural language
- [ ] Example files are readable (if provided)
- [ ] README is complete and accurate

---

## Git Workflow

### Commit Messages

Use conventional commits:

```
feat: add new feature
fix: correct bug
docs: update documentation
refactor: restructure code
```

### Branch Strategy

- `main`: stable, release-ready
- `feature/<name>`: new features
- `fix/<name>`: bug fixes

### Before Committing

1. Test plugin locally with `--plugin-dir`
2. Verify all files follow naming conventions
3. Update README if behavior changed
4. Update version in plugin.json for releases

---

## Marketplace Maintenance

### Adding a New Plugin

1. Create directory `plugins/maccing-<name>/`
2. Add `.claude-plugin/plugin.json` manifest
3. Add skills, commands, examples as needed
4. Create comprehensive README.md
5. Add plugin entry to `.claude-plugin/marketplace.json`
6. Test locally before pushing

### Updating Marketplace Manifest

When adding plugins to `marketplace.json`:

```json
{
  "name": "maccing-<plugin-name>",
  "source": "./plugins/maccing-<plugin-name>",
  "description": "Brief description",
  "version": "1.0.0",
  "author": { "name": "Author Name" },
  "keywords": ["relevant", "keywords"],
  "license": "MIT"
}
```

---

## SKILL.md Best Practices

### Structure

```markdown
---
name: skill-name
description: When to use this skill. Be specific about triggers.
---

# Skill Title

Brief overview of what the skill does.

## Step 1: First Action

Detailed instructions...

## Step 2: Next Action

Detailed instructions...
```

### Writing Effective Skills

- **Clear triggers**: Description should explain when the skill activates
- **Step-by-step instructions**: Break down complex processes
- **Include examples**: Show expected inputs and outputs
- **Handle edge cases**: Document what happens in error scenarios

---

## Command Best Practices

### Structure

```markdown
---
description: Brief description of what the command does
---

# Command Title

Detailed instructions for Claude to execute.

## Arguments

$ARGUMENTS

## Supported Flags

- `--flag`, description
- `--another`, description

## Examples

/plugin-name:command --flag value
```

---

## Plugin Output Styling

### Colored Output in Claude Code

Use inline backticks for colored text rendering:

`★ Header with decorators ════════════════════════════`

**Format patterns:**
- Headers: `` `★ Plugin Name ════════════════════` ``
- Separators: `` `════════════════════════════════` ``
- Dividers: `` `────────────────────────────────` ``
- Labels: `` `label-name` `` for inline colored text

**Symbols:**
- `★`: Section headers
- `═`: Major section borders (top/bottom)
- `─`: Minor dividers
- `✖`: Critical/error items
- `▲`: Warning/high priority items

### Output Structure

All plugin output should follow this pattern:

`★ plugin-name ══════════════════════════════════════`

Section Title

Key:   `value`
Label: description

List Items:
- item one
- item two

`════════════════════════════════════════════════════`

### Timestamp Format

Always include date and time in reports:
- Format: `YYYY-MM-DD HH:mm`
- Example: `2025-12-31 14:30`
- Filename: `YYYY-MM-DD-HHmm-<scope>.md`

---

## Philosophy Alignment

All plugins should embody these principles:

- **Discovery-first**: Learn from the codebase, not generic rules
- **Thorough over fast**: Quality analysis over quick results
- **Evidence over claims**: Concrete examples with file:line references
- **Systematic over ad-hoc**: Structured methodology
- **Project-aware**: Respect user's existing conventions
- **Transparent**: Show what's happening, not just results

### Pattern Discovery Approach

Plugins should discover patterns from the user's codebase when explicit rules are not provided:

1. **Scan**: Analyze all relevant files exhaustively
2. **Extract**: Identify conventions per category
3. **Measure**: Calculate consistency percentages
4. **Adopt**: Use patterns with >60% consistency as rules
5. **Report**: Show what was discovered with evidence

No generic defaults should be imposed. Every rule is either:
- Explicitly defined by the user
- Discovered from the actual codebase

---

## Common Commands

```bash
# Test plugin locally
claude --plugin-dir ./plugins/maccing-code-reviewer

# Add marketplace (for users)
claude plugin marketplace add andredezzy/maccing

# Install plugin (for users)
claude plugin install maccing-code-reviewer@maccing

# Validate plugin structure
claude plugin validate ./plugins/maccing-code-reviewer
```

---

## Resources

- [Claude Code Plugin Docs](https://code.claude.com/docs/en/plugins.md)
- [Plugin Reference](https://code.claude.com/docs/en/plugins-reference.md)
- [Marketplace Guide](https://code.claude.com/docs/en/plugin-marketplaces.md)
