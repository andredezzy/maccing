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

The plugin bundles a [Bun](https://bun.sh) MCP server (`mcp/src/server.ts`), built on the official [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) and registered via `.mcp.json` as the `notion` server. Tools: **`notion_request`** — a full-control passthrough to `https://api.notion.com` that always sends `Notion-Version: 2026-03-11` (views, data sources, databases, pages, blocks, search, comments, file uploads); **`notion_private_request`** + **`notion_set_property_icon`** — the unofficial private app API for UI-only features the public API can't do (e.g. database property/column icons; see `skills/notion-api/references/private-api.md`).

**Setup — provide a token** (a Notion internal-integration Personal Access Token from notion.so/profile/integrations → Personal access tokens) — either `export NOTION_TOKEN=ntn_...` in your shell (`.mcp.json` forwards it), or copy `mcp/.env` → `mcp/.env.local` (gitignored) and fill it in. Private-API features additionally need `NOTION_TOKEN_V2` + `NOTION_SPACE_ID` in `.env.local`.

The launcher (`mcp/start.sh`) loads `mcp/.env.local` (gitignored) if present, else uses whatever is already in the environment. Secrets are never committed. Requires `bun` on `PATH` (or `~/.bun/bin/bun`).

## Relationship to the official Notion plugin

This skill is the **complementary low-level reference**. For high-level workflows in Claude Code, also install the official [`makenotion/claude-code-notion-plugin`](https://github.com/makenotion/claude-code-notion-plugin) and use it for Knowledge Capture, Meeting Intelligence, Research Documentation, and Spec-to-Implementation. Reach for `notion-api` when you're engineering databases/formulas/views directly against the API or debugging its errors.
