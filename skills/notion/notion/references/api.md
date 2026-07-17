# The raw REST API surface — versions, data model, auth, core endpoints, payload limits

Part of the `notion` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, act-and-report (no approval gate), render_mockup after structural changes, match-conventions) still apply to everything here.

## Data model & versions

- API base: `https://api.notion.com/v1` — header `Notion-Version: 2026-03-11`
- SDK: the `@notionhq/client` TypeScript SDK needs **v5.12.0+** for `2026-03-11` — note this SDK is on the **5.x** line (npm-verified 2026-06: latest `5.22.0`, `5.12.0` exists), NOT the legacy 2.x; relevant only to external app developers — the bundled `notion` MCP server makes raw HTTP calls (no Notion SDK)
- Databases are queried/mutated via `/v1/data_sources/{id}` — prefer it over the **legacy** `/v1/databases/{id}` (only `GET /v1/databases/{id}` — for id-resolution and `.parent` — and `PATCH /v1/databases/{id}` — for property mutations and DB moves — still coexist on 2026-03-11; `POST /v1/databases/{id}/query` was **removed** → `400 Invalid request URL` — use `/v1/data_sources/{id}/query`). The **data-source** endpoint covers schema `PATCH`, row queries, **and** relation targets: a relation/rollup property references a `data_source_id`, not a `database_id` (a 2026-03-11 change; pre-2026 priors that say `database_id` are stale)
- `POST /v1/databases` response → use `data_sources[0]['id']` as the data source ID; `is_inline: true` supported at creation
- **Create a DB row** with `POST /v1/pages` `parent: { type: "data_source_id", data_source_id }` — **NOT** `{ database_id }` (400 on 2026-03-11). **This binds external scripts / SDK / seed code you write, too:** query `/v1/data_sources/{id}/query`, create rows with a `data_source_id` parent, read a schema via `GET /v1/data_sources/{id}` — **never** the legacy `/v1/databases/{id}` query/parent/GET-schema paths. A seed or import script that hits `/databases/{id}/query` or uses a `{ database_id }` page parent **will 400** (`invalid_request_url` / `validation_error`). (Live-verified 2026-06-19: a food-data seed script failed twice on exactly these before being corrected to `/data_sources`.)
- Inline DB IDs (from block children, i.e. a `child_database` block id) ARE valid `database_id` values (resolve via `GET /v1/databases/{id}` → `data_sources[0].id`) but are **NOT** valid `data_source_id` values (`GET /v1/data_sources/{that-id}` → **404** "Could not find data_source" — the data_source_id is a *distinct* UUID) and NOT a valid `page_id` for `GET /pages/{id}`. (`read_database` accepts either and auto-resolves a database_id → its data_source, so the practical flow is unchanged.)
- Search API: `filter.value` accepts `'page'` or `'data_source'` — **not** `'database'` (breaking change in 2025-09-03)

**Version 2026-03-11 breaking changes** (requires SDK v5.12.0+):
1. Append-block `after` param → `position` object (see `references/blocks.md`)
2. `archived` field renamed to `in_trash` everywhere
3. `transcription` block type renamed to `meeting_notes`

---

## Auth / MCP pattern

- Tool selection → "MCP tools — pick by job" above. `request`'s `query` arg is the GET query-string — the only way to send `start_cursor`/`page_size` to `GET /v1/blocks/{id}/children` and `GET /v1/views?data_source_id=…`.
- ⚠️ **Database PROPERTY/COLUMN icons (the icon next to a column name) ARE settable** via `upsert_property` (or raw `private_request`) — the public API silently drops them — so when asked whether a property/column icon can be set via the API, the answer is **YES, never "UI-only/impossible."** Recipe → `references/private-api.md`.
- Large results (>~80k chars) overflow MCP token limit → saved to `~/.claude/projects/.../tool-results/mcp-notion-*.txt`
- Rate limit (public client): **429/503** retried for ALL methods; **502** retried for **GET/HEAD only** (writes are NEVER retried on 502 — the request may have landed). Backoff is exponential `700ms × 2^attempt` (700/1400/2800 ms), **max 4 attempts** (3 retries); a positive `Retry-After` header overrides the computed wait. (`notion-public.ts`)
- Don't hand-roll inter-request `sleep` — both clients pace/back off internally (the private client auto-paces a 280 ms min interval + adaptive cooldown; the public client retries 429/503 with exponential backoff, above)
- **Hosted MCP** (`mcp.notion.com/mcp`): 180 req/min general, 30 req/min search; provides `notion-search`, `notion-fetch`, `notion-create-pages`, `notion-update-page`, `notion-move-pages`, `notion-duplicate-page`, `notion-create-database`, `notion-update-data-source`, `notion-create-view`, `notion-update-view`, `notion-query-data-sources` (Enterprise+AI), `notion-query-database-view` (Business+), `notion-create-comment`, `notion-get-comments`, `notion-get-teams`, `notion-get-users`, `notion-get-user`, `notion-get-self`
- **Verify token on first use**: `GET /v1/users/me` → 401 = invalid token; 403/404 = token valid but content not shared with integration

**Permission model — two layers required:**
1. Integration capability scopes (read/write/delete declared in integration settings)
2. User explicitly shares page/database with the integration via `...` > Connections menu

---

## Core endpoints

**Reads:** prefer `read_page` (pages/rows) and `read_database` (`/query`) over the raw endpoints below — they are for writes and for what the readers don't cover (see the tool table).

```
GET    /v1/data_sources/{id}              # DB schema (properties map with ids + types)
PATCH  /v1/data_sources/{id}             # add/modify/delete/rename properties
POST   /v1/data_sources/{id}/query       # query rows; body: {page_size,filter,sorts,start_cursor}
GET    /v1/databases/{id}                # resolve database_id → data_sources[0].id; also .parent
GET    /v1/pages/{id}                    # page metadata + .parent — for content/properties use read_page
PATCH  /v1/pages/{id}                    # update page properties / icon / cover / in_trash
POST   /v1/pages                         # create page or DB row
GET    /v1/pages/{id}/markdown           # PREFER read_page(page_id,"markdown"); raw GET truncates large pages + skips block recovery
PATCH  /v1/pages/{id}/markdown           # update page content via Markdown
POST   /v1/databases                     # create database — then inspect via read_database / GET /v1/data_sources/{ds}
POST   /v1/pages/{id}/move               # re-parent a page (move to a new parent page)
PATCH  /v1/databases/{id}                # move a database (set {parent}); also the legacy schema path
GET    /v1/blocks/{id}/children          # child blocks — PREFER read_page(page_id,"outline"); hand-roll only for non-page subtrees
PATCH  /v1/blocks/{id}/children         # add children — position: start | end | after_block (blocks.md); NOT just append
DELETE /v1/blocks/{id}                   # delete a content block
```

Paginate queries: **mandatory** — loop on `next_cursor` until `has_more == false` before counting/summing/concluding (see [MANDATORY — exhaust every paginated list](#mandatory--exhaust-every-paginated-list-never-act-on-a-partial-set)). `page_size` max 100.

Add/modify/delete properties in one PATCH:
```json
{
  "properties": {
    "NewProp":     { "number": { "format": "real" } },
    "RenamedProp": { "name": "Better Name" },
    "DeadProp":    null
  }
}
```

**Payload size constraints:**
- 500KB max per request
- 100 blocks per append request
- 2,000 chars per rich text element
- 100 items per relation property per PATCH
- 100 multi-select options
- Database schema max 500 properties or 50KB
