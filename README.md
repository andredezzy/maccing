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

> The `notion` MCP server needs a Notion token — see the [notion bucket README](mcp/notion/README.md) for setup.
>
> The `workspace` MCP server needs a Google OAuth client — see the [google-workspace bucket README](mcp/google-workspace/README.md) for setup.

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
| engineering | dx | DX is the top design priority — every structure judged by the cognitive load on the next person who reads, debugs, tests, or extends it |
| engineering | writing-code | The whole code touch in one skill — a name that says exactly what the thing is, data shaped like the reality it mirrors, one concern per file with errors as a cross-cutting contract, composition as a hard rule for UI, and external surfaces verified against a named source instead of memory |
| growth | growth | Cross-channel paid-acquisition + messaging orchestrator |
| growth | google-ads | Google Ads production reference + scripts |
| growth | tiktok-ads | TikTok Ads production reference |
| growth | meta | Shared Meta platform substrate (BM, verification, enforcement) |
| growth | meta-ads | Meta (Facebook/Instagram) Ads reference |
| growth | whatsapp | WhatsApp Business Platform / Cloud API reference |
| growth | ycloud | YCloud BSP operations |
| growth | ycloud-api | YCloud v2 REST API reference |
| notion | notion | Notion API engineering — databases, formulas, rollups, relations, views/charts, blocks |
| google-workspace | google-workspace | Google Workspace (Calendar/Gmail/Drive/…) via the bundled `workspace` MCP — setup, OAuth, account isolation, tool reference |

Every engineering skill ships only after passing baseline testing against fresh agents (RED→GREEN, per `superpowers:writing-skills`).

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
