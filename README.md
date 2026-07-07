# maccing

*Maxxing plugins and skills for coding agents.*

One plugin, many skills, two bundled MCP servers. Two ways to install, depending on your agent.

**[Claude Code plugin](#claude-code-plugin)** — the full experience: skills, the `/maccing:growth` command, and bundled MCP servers (`notion`, `workspace`), with marketplace auto-update.

**[Agent skills via skills.sh](#agent-skills-skillssh)** — the `SKILL.md` files only, installable into 70+ coding agents (Cursor, Codex, Gemini CLI, Windsurf, Zed, …).

## Claude Code plugin

```
/plugin marketplace add andredezzy/maccing
/plugin install maccing@maccing
```

**Update:**

```
/plugin marketplace update maccing
```

Or enable auto-update: `/plugin` > Marketplaces > maccing > Enable auto-update.

> The `notion` MCP server needs a Notion token — see the [notion bucket README](skills/notion/README.md) for setup.
>
> The `workspace` MCP server needs a Google OAuth client — see the [google-workspace bucket README](skills/google-workspace/README.md) for setup.

### Migrating from the old plugins

maccing used to ship as three plugins (`maccing-growth`, `maccing-notion`, `google-workspace`). Those install names are gone — uninstall them and install `maccing@maccing`. Three things changed names:

- **MCP tools:** `mcp__plugin_maccing-notion_notion__*` → `mcp__plugin_maccing_notion__*`, and `mcp__plugin_google-workspace_workspace__*` → `mcp__plugin_maccing_workspace__*`. Update any permission allow-lists or hooks that pin the old prefixes.
- **Skill namespaces:** everything now lives under `maccing:` (e.g. `maccing:growth`). Bare skill names are unchanged.
- **The growth command:** `/growth` is now `/maccing:growth`.

## Agent skills (skills.sh)

Install the skills into any supported agent with the [`skills`](https://skills.sh/) CLI. This installs the `SKILL.md` files only — **not** the command or the MCP servers (those are Claude Code plugin features).

```bash
# all skills
npx skills add andredezzy/maccing

# preview what would install (no writes)
npx skills add andredezzy/maccing --list

# a single skill
npx skills add andredezzy/maccing -s reasoning

# install globally (user-level) instead of the current project
npx skills add andredezzy/maccing -g
```

> **Using Claude Code?** Install the plugin instead — skills.sh copies would duplicate the plugin's skills.

## Skills

| Bucket | Skill | Purpose |
|--------|-------|---------|
| — | reasoning | Operating manual for hard problems: read the real ask, verify by re-deriving, label known vs guessed, attack your own conclusion, answer → reasoning → risk |
| growth | growth | Cross-channel paid-acquisition + messaging orchestrator |
| growth | google-ads | Google Ads production reference + scripts |
| growth | tiktok-ads | TikTok Ads production reference |
| growth | meta | Shared Meta platform substrate (BM, verification, enforcement) |
| growth | meta-ads | Meta (Facebook/Instagram) Ads reference |
| growth | whatsapp | WhatsApp Business Platform / Cloud API reference |
| growth | ycloud | YCloud BSP operations |
| growth | ycloud-api | YCloud v2 REST API reference |
| notion | notion-api | Notion API engineering — databases, formulas, rollups, relations, views/charts, blocks |
| google-workspace | google-workspace | Google Workspace (Calendar/Gmail/Drive/…) via the bundled `workspace` MCP — setup, OAuth, account isolation, tool reference |

An `engineering/` bucket (dx, naming, organizing-code, modeling-domains, researching-before-coding, composing-ui) is landing skill by skill — each one ships only after passing baseline testing against fresh agents.

## Troubleshooting

**Claude Code — clear cache and reinstall:**

```bash
rm -rf ~/.claude/plugins/cache/maccing
rm -rf ~/.claude/plugins/marketplaces/maccing
/plugin marketplace add andredezzy/maccing
```

**skills.sh — list installed / remove:**

```bash
npx skills list
npx skills remove <skill>
```

## License

MIT
