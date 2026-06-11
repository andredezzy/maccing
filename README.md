# maccing

*Maxxing plugins and skills for coding agents.*

Two ways to install, depending on your agent.

**[Claude Code plugins](#claude-code-plugins)** — full plugins: skills, slash commands, and bundled MCP servers, with marketplace auto-update.

**[Agent skills via skills.sh](#agent-skills-skillssh)** — the `SKILL.md` files only, installable into 70+ coding agents (Cursor, Codex, Gemini CLI, Windsurf, Zed, …).

## Claude Code plugins

Add the marketplace once, then install the plugins you want:

```
/plugin marketplace add andredezzy/maccing
/plugin install maccing-growth@maccing
/plugin install maccing-notion@maccing
/plugin install google-workspace@maccing
```

| Plugin | What you get | Install |
|--------|--------------|---------|
| [growth](plugins/maccing-growth/README.md) | 8 skills (growth, google-ads, tiktok-ads, meta, meta-ads, whatsapp, ycloud, ycloud-api) + the `/growth` command | `/plugin install maccing-growth@maccing` |
| [notion](plugins/maccing-notion/README.md) | `notion-api` skill + a bundled self-hosted `notion` MCP server (Bun, official MCP SDK) | `/plugin install maccing-notion@maccing` |
| [google-workspace](plugins/google-workspace/README.md) | `google-workspace` skill + a bundled self-hosted Workspace MCP server (Calendar, Gmail, Drive, Docs, Sheets, Slides, Forms, Tasks, Chat, Contacts) | `/plugin install google-workspace@maccing` |

**Update:**

```
/plugin marketplace update maccing
```

Or enable auto-update: `/plugin` > Marketplaces > maccing > Enable auto-update.

> The `notion` MCP server needs a Notion token — see the [notion plugin README](plugins/maccing-notion/README.md#mcp-server) for setup.
>
> The `google-workspace` MCP server needs a Google OAuth client — see the [google-workspace plugin README](plugins/google-workspace/README.md) for setup.

## Agent skills (skills.sh)

Install the skills into any supported agent with the [`skills`](https://skills.sh/) CLI. This installs the `SKILL.md` files only — **not** the slash commands or the MCP servers (those are Claude Code plugin features).

```bash
# all skills
npx skills add andredezzy/maccing

# preview what would install (no writes)
npx skills add andredezzy/maccing --list

# a single skill
npx skills add andredezzy/maccing -s notion-api

# install globally (user-level) instead of the current project
npx skills add andredezzy/maccing -g
```

| Skill | From | Purpose |
|-------|------|---------|
| growth | growth | Cross-channel paid-acquisition + messaging orchestrator |
| google-ads | growth | Google Ads production reference + scripts |
| tiktok-ads | growth | TikTok Ads production reference |
| meta | growth | Shared Meta platform substrate (BM, verification, enforcement) |
| meta-ads | growth | Meta (Facebook/Instagram) Ads reference |
| whatsapp | growth | WhatsApp Business Platform / Cloud API reference |
| ycloud | growth | YCloud BSP operations |
| ycloud-api | growth | YCloud v2 REST API reference |
| notion-api | notion | Notion API engineering — databases, formulas, rollups, relations, views/charts, blocks |
| google-workspace | google-workspace | Google Workspace (Calendar/Gmail/Drive/…) via the plugin's MCP — setup, OAuth, account isolation, tool reference, calendar color-pattern rule |

> **Using Claude Code via skills.sh?** Prefer `--copy`: `npx skills add andredezzy/maccing --copy`. The CLI's default symlink mode currently has a bug ([#851](https://github.com/vercel-labs/skills/issues/851), [#1355](https://github.com/vercel-labs/skills/issues/1355)) that can skip the `.claude/skills/` link. For the full Claude Code experience — commands + MCP — use the plugin install above instead.

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
