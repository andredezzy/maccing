# notion

Notion API engineering reference for coding agents — the low-level details for building and editing Notion databases programmatically, and debugging Notion API errors. Ships a self-hosted `notion` MCP server so the agent can call the Notion REST API directly.

## Install

```
/plugin install maccing@maccing
```

## Skills

| Skill | Purpose |
|-------|---------|
| notion | Notion API/MCP reference: a **MANDATORY ancestral-`AGENTS.md` sweep** before any operation, `data_sources` model & versions, auth/MCP pattern, core endpoints, property-creation shapes, reading property values, pages, Notion-flavored Markdown, blocks & positioning, Views API (create/update/delete, linked views, board/calendar/timeline/list/map/form, column visibility), **view filtering — complete date-condition vocabulary + relative strings, the exact current-calendar-month recipe, rollup-filter wrapper**, **formula filterability forensics (UI-created vs API-created, type-ambiguous branches, the self-relation rollup-wrap workaround — all live-verified)**, charts, rollups, relations, pt-BR number formatting via arithmetic, and production architecture patterns. Triggers on building/editing databases, formulas, rollups, relations, views, charts, page blocks, or hitting Notion API errors. |

### Reference files (`notion/references/`, loaded on demand)

| File | Covers |
|------|--------|
| `api.md` | The raw REST surface — API base/version, the `data_sources` model & 2026-03-11 breaking changes, auth/MCP pattern, core endpoint paths, payload limits |
| `pages-properties.md` | Property shapes, reading values, page/DB icons & covers |
| `icon-names.md` | Built-in icon name catalog (885 verified names) |
| `blocks.md` | Blocks, positioning, the reorder workaround, Markdown content API |
| `views.md` | Views — list/create/update/delete, linked views, board/calendar/timeline/list/map/form, column visibility, **view filtering with date conditions and formula filterability** |
| `gallery-view.md` | Gallery view visual config (cover, card size, visible props) + sourcing B&W cover images |
| `visual-design.md` | Dashboard visual design — stacked-KPI gallery layout rules |
| `agents-md-authoring.md` | Authoring/editing an `AGENTS.md` playbook (writing-skills discipline, adapted to Notion) |
| `charts.md` | Charts — limits & gotchas |
| `formulas.md` | Formulas (gotchas, pt-BR currency) & number formatting |
| `relations.md` | Relations & rollups |
| `private-api.md` | Unofficial private app API — UI-only features (database property/column icons) and its gotchas |
| `patterns.md` | Querying/filtering rows, search, extracting a `data_source_id` from a URL; webhooks, caching, idempotency; debugging API errors (400/409/429/401/403, `validation_error`, permission) |

## MCP server

The plugin bundles a [Bun](https://bun.sh) MCP server (`mcp/notion/src/server.ts`), built on the official [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) and registered via `.mcp.json` as the `notion` server. Tools: high-level **readers** — `read_agents_md`, `search` (name→id), `read_page`, `read_database`, `describe`; **writers** — `upsert_property` (a database column + its icon, or a page value) and `order_properties` (re-order properties across views and/or the canonical order); **`render_mockup`** — the canonical ASCII mockup renderer for any page/database/blocks; plus two escape hatches: **`request`** — a full-control passthrough to `https://api.notion.com` that always sends `Notion-Version: 2026-03-11` (views, data sources, databases, pages, blocks, search, comments, file uploads); and **`private_request`** — the unofficial private app API for UI-only features the public API can't do (e.g. database property/column icons; see `notion/references/private-api.md`).

**Setup — provide a token** (a Notion internal-integration Personal Access Token from notion.so/profile/integrations → Personal access tokens). Create `~/.config/maccing/notion.env` (chmod 600, outside the repo and cache — so it survives plugin version bumps):

```sh
mkdir -p ~/.config/maccing && chmod 600 ~/.config/maccing/notion.env  # after creating it
export NOTION_TOKEN=ntn_...
# Optional — private-API features (database property/column icons, other UI-only ops):
export NOTION_TOKEN_V2=v03%3A...
export NOTION_SPACE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

The launcher (`mcp/notion/start.sh`) loads that stable file first, then `mcp/notion/.env.local` (gitignored, dev override — wins because it's sourced last), then any inherited env (`.mcp.json` forwards `${NOTION_TOKEN}` as a fallback). Override the path with `MACCING_NOTION_ENV`. Secrets are never committed. Requires `bun` on `PATH` (or `~/.bun/bin/bun`).

## Relationship to the official Notion plugin

This skill is the **complementary low-level reference**. For high-level workflows in Claude Code, also install the official [`makenotion/claude-code-notion-plugin`](https://github.com/makenotion/claude-code-notion-plugin) and use it for Knowledge Capture, Meeting Intelligence, Research Documentation, and Spec-to-Implementation. Reach for `notion` when you're engineering databases/formulas/views directly against the API or debugging its errors.
