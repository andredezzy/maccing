# maccing-notion · v0.8.0

Notion API engineering reference for coding agents — the low-level details for building and editing Notion databases programmatically, and debugging Notion API errors. Ships a self-hosted `notion` MCP server so the agent can call the Notion REST API directly.

## Install

```
/plugin install maccing-notion@maccing
```

## Skills

| Skill | Purpose |
|-------|---------|
| notion-api | Notion API/MCP reference: a **MANDATORY ancestral-`AGENTS.md` sweep** before any operation, `data_sources` model & versions, auth/MCP pattern, core endpoints, property-creation shapes, reading property values, pages, Notion-flavored Markdown, blocks & positioning, Views API (create/update/delete, linked views, board/calendar/timeline/list/map/form, column visibility), **view filtering — complete date-condition vocabulary + relative strings, the exact current-calendar-month recipe, rollup-filter wrapper**, **formula filterability forensics (UI-created vs API-created, type-ambiguous branches, the self-relation rollup-wrap workaround — all live-verified)**, charts, rollups, relations, pt-BR number formatting via arithmetic, and production architecture patterns. Triggers on building/editing databases, formulas, rollups, relations, views, charts, page blocks, or hitting Notion API errors. |

### Reference files (loaded on demand)

| File | Covers |
|------|--------|
| `references/pages-properties.md` | Property shapes, reading values, page/DB icons & covers |
| `references/icon-names.md` | Built-in icon name catalog (885 verified names) |
| `references/blocks.md` | Blocks, positioning, the reorder workaround, Markdown content API |
| `references/views.md` | Views — list/create/update/delete, linked views, board/calendar/timeline/list/map/form, column visibility, **view filtering with date conditions and formula filterability** |
| `references/gallery-view.md` | Gallery view visual config (cover, card size, visible props) + sourcing B&W cover images |
| `references/agents-md-authoring.md` | Authoring/editing an `AGENTS.md` playbook (writing-skills discipline, adapted to Notion) |
| `references/charts.md` | Charts — limits & gotchas |
| `references/formulas.md` | Formulas (gotchas, pt-BR currency) & number formatting |
| `references/relations-rollups.md` | Relations & rollups |
| `references/patterns.md` | Querying/filtering rows, search, extracting a `data_source_id` from a URL; webhooks, caching, idempotency; debugging API errors (400/409/429/401/403, `validation_error`, permission) |

## MCP server

The plugin bundles a [Bun](https://bun.sh) MCP server (`mcp/src/server.ts`), built on the official [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) and registered via `.mcp.json` as the `notion` server. Tools: **`request`** — a full-control passthrough to `https://api.notion.com` that always sends `Notion-Version: 2026-03-11` (views, data sources, databases, pages, blocks, search, comments, file uploads); **`private_request`** + **`set_property_icon`** — the unofficial private app API for UI-only features the public API can't do (e.g. database property/column icons; see `skills/notion-api/references/private-api.md`).

**Setup — provide a token** (a Notion internal-integration Personal Access Token from notion.so/profile/integrations → Personal access tokens). Create `~/.config/maccing/notion.env` (chmod 600, outside the repo and cache — so it survives plugin version bumps):

```sh
mkdir -p ~/.config/maccing && chmod 600 ~/.config/maccing/notion.env  # after creating it
export NOTION_TOKEN=ntn_...
# Optional — private-API features (database property/column icons, other UI-only ops):
export NOTION_TOKEN_V2=v03%3A...
export NOTION_SPACE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

The launcher (`mcp/start.sh`) loads that stable file first, then `mcp/.env.local` (gitignored, dev override — wins because it's sourced last), then any inherited env (`.mcp.json` forwards `${NOTION_TOKEN}` as a fallback). Override the path with `MACCING_NOTION_ENV`. Secrets are never committed. Requires `bun` on `PATH` (or `~/.bun/bin/bun`).

## Relationship to the official Notion plugin

This skill is the **complementary low-level reference**. For high-level workflows in Claude Code, also install the official [`makenotion/claude-code-notion-plugin`](https://github.com/makenotion/claude-code-notion-plugin) and use it for Knowledge Capture, Meeting Intelligence, Research Documentation, and Spec-to-Implementation. Reach for `notion-api` when you're engineering databases/formulas/views directly against the API or debugging its errors.
