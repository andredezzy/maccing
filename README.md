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
| [growth](plugins/maccing-growth/README.md) | Paid acquisition + WhatsApp messaging knowledge base | `/plugin install maccing-growth@maccing` |
| [notion](plugins/maccing-notion/README.md) | Notion API engineering reference (databases, formulas, rollups, relations, views/charts, blocks) | `/plugin install maccing-notion@maccing` |

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
