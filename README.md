# maccing

*Maxxing plugins and skills for coding agents.*

## Quick Start

**Claude Code Plugins**

```
/plugin marketplace add andredezzy/maccing
```

**Agent Skills** ([skills.sh](https://skills.sh/))

```
npx skills add andredezzy/maccing
```

## Plugins

| Plugin | Description | Install |
|--------|-------------|---------|
| [code-reviewer](plugins/maccing-code-reviewer/README.md) | Multi-agent code review with pattern discovery | `/plugin install maccing-code-reviewer@maccing` |
| [monorepo](plugins/maccing-monorepo/README.md) | Monorepo workflow assistance | `/plugin install maccing-monorepo@maccing` |
| [rules-enforcer](plugins/maccing-rules-enforcer/README.md) | Project rules injection at every prompt | `/plugin install maccing-rules-enforcer@maccing` |
| [pictura](plugins/maccing-pictura/README.md) | AI image generation in multiple aspect ratios | `/plugin install maccing-pictura@maccing` |

## Skills

| Skill | Description | Install |
|-------|-------------|---------|
| [unicode-box-drawing](skills/unicode-box-drawing/SKILL.md) | Box drawing patterns for ASCII diagrams | `npx skills add andredezzy/maccing -s unicode-box-drawing` |

## Updating

```
/plugin marketplace update maccing
```

Or enable auto-update: `/plugin` > Marketplaces > maccing > Enable auto-update

## Troubleshooting

**Clear cache and reinstall:**

```bash
rm -rf ~/.claude/plugins/cache/maccing
rm -rf ~/.claude/plugins/marketplaces/maccing
/plugin marketplace add andredezzy/maccing
```

## License

MIT
