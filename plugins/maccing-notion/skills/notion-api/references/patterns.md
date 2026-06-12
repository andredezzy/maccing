# Useful patterns & production architecture

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, approval gate before writes, tree view after structural changes, match-conventions) still apply to everything here.

## Useful patterns

**Query with filter:**
```json
POST /v1/data_sources/{id}/query
{
  "page_size": 100,
  "filter": { "property": "Name", "title": { "equals": "June 2026" } },
  "sorts": [{ "timestamp": "created_time", "direction": "descending" }]
}
```

**Get all property IDs:**
```python
schema = GET /v1/data_sources/{id}
prop_ids = {name: meta["id"] for name, meta in schema["properties"].items()}
# IDs may be URL-encoded — urllib.parse.unquote(id) to normalize
```

**Extract data_source_id from a database URL:**
```python
# 1. Get 36-char UUID from the Notion URL
# 2. GET /v1/databases/{uuid}  → response contains data_sources list
# 3. data_source_id = response["data_sources"][0]["id"]
```

**Formula expressions** reference property IDs via `block_property:{id}:` syntax in stored expressions.

**Stale `filter_properties` in URL** → 400 `validation_error` "malformed schema ... invalid attribute: <encoded_id>" — remove stale property IDs from query params. (The `request` tool is a pure passthrough — it never appends params on its own; a stale id only appears if you pass it in the `query` arg.)

**Linked databases limitation**: linked database views of a database shown on another page are NOT supported by the API — share the source database directly with the integration. Wiki databases can only be created via the Notion UI.

---

## Production architecture patterns

- **Cache locally** — Notion is not a real-time database; poll or use webhooks
- **Webhook pattern**: receive POST → return 2xx immediately → enqueue async job → fetch via API → update cache; periodic reconciliation as fallback
- **Batch reads**: 2–4 concurrent requests max + global rate limiter
- **Prefer `/v1/data_sources/{id}/query`** over `/v1/search` for deterministic retrieval of known databases
- **Idempotent writes**: use an external ID property to prevent duplicate pages on retry
- **Track sync checkpoints** to recover from missed changes
- **Prefer database queries over search** for structured data retrieval
