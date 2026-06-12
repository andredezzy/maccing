# Useful patterns & production architecture

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, approval gate before writes, tree view after structural changes, match-conventions) still apply to everything here.

**Reads:** start with the mandatory `read_agents_md` sweep, then prefer `read_database` for querying rows (or `read_page` for a single row) — see SKILL.md "MCP tools — pick by job". They take the same `filter`/`sorts`, resolve relations→titles, and `exhaust_all=true` satisfies the pagination law. The raw `request` patterns here are for writes, schema inspection, and what the readers don't cover.

## Useful patterns

**Query rows (reads):** `read_database(database_id, "table", filter={…}, sorts=[…])` — `filter`/`sorts` are the same Notion objects as below, passed verbatim. For counts/sums/grouped totals, use `exhaust_all=true, format="summary", group_by=<prop>` — server-side, no manual loop. For a single row/page, `read_page(page_id, "markdown")` returns its properties (relations resolved) + body; use `read_page(page_id, "outline")` when you need block ids for an edit. Drop to the raw `/query` endpoint when you need a row's **page id** (each result's `.id`, e.g. to write a relation) or other raw response fields the readers don't expose:
```json
POST /v1/data_sources/{id}/query
{
  "page_size": 100,
  "filter": { "property": "Name", "title": { "equals": "June 2026" } },
  "sorts": [{ "timestamp": "created_time", "direction": "descending" }]
}
```

**Get all property IDs** (for building WRITE payloads / authoring formulas — you rarely need raw ids for reads: `read_database` resolves names, and its `# Views` section even surfaces id↔name in view configs):
```python
schema = GET /v1/data_sources/{id}
prop_ids = {name: meta["id"] for name, meta in schema["properties"].items()}
# IDs may be URL-encoded — urllib.parse.unquote(id) to normalize
```

**Read view config:** every `read_database(database_id, format)` call appends every view's complete configuration (cover/preview, `cover_size`, `cover_aspect`, `card_layout`, `group_by`, chart axes, visible/hidden props, sorts, `filter`, `quick_filters`) with property ids resolved to names — no flag. Raw `GET /v1/views` is only for driving it by hand; `POST`/`PATCH /v1/views` for writing views.

**Extract data_source_id from a database URL:**
```python
# 1. Get 36-char UUID from the Notion URL
# 2. GET /v1/databases/{uuid}  → response contains data_sources list
# 3. data_source_id = response["data_sources"][0]["id"]
```

**Formula expressions:** author with `prop("Name")` (what you send in `expression`); Notion compiles it to an opaque internal `{{notion:block_property:<id>:…}}` form seen on read-back — don't hand-author that form.

**Stale `filter_properties` in URL** → 400 `validation_error` "malformed schema ... invalid attribute: <encoded_id>" — remove stale property IDs from query params. (The `request` tool is a pure passthrough — it never appends params on its own; a stale id only appears if you pass it in the `query` arg.)

**Linked database views — creation IS supported** via `POST /v1/views` with a `create_database` block (see `references/views.md` "Create a linked database view embedded in a page"); the integration must have access to the **source** database, not just the page where the linked view is embedded. Wiki-database creation is not exposed by the public API — use the Notion UI.

---

## Production architecture patterns

- **Cache locally** — Notion is not a real-time database; poll or use webhooks
- **Webhook pattern**: receive POST → return 2xx immediately → enqueue async job → fetch via API → update cache; periodic reconciliation as fallback
- **Batch reads**: 2–4 concurrent requests max + global rate limiter
- **Prefer `read_database`** over `/v1/search` for deterministic retrieval of known databases
- **Search filter values (2025-09-03 breaking change):** `POST /v1/search` `filter.value` accepts `'page'` or `'data_source'` — NOT `'database'`
- **Idempotent writes**: use an external ID property to prevent duplicate pages on retry
- **Track sync checkpoints** to recover from missed changes
