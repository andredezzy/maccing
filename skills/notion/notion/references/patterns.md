# Useful patterns & production architecture

Part of the `notion` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, act-and-report (no approval gate), render_mockup after structural changes, match-conventions) still apply to everything here.

**Reads:** start with the mandatory `read_agents_md` sweep, then `search` to resolve a name→id, `read_database` for querying rows (or `read_page` for a single row), and `describe` for a data source's metadata header + column schema (+ column icons) or a page's metadata — see SKILL.md "MCP tools — pick by job". The row readers take the same `filter`/`sorts`, resolve relations→titles, and `exhaust_all=true` satisfies the pagination law. The raw `request` patterns here are for writes and what the readers don't cover.

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

**Inspect the schema** — `describe(data_source_id)` returns a **metadata header** (title · id · icon · parent) plus every column as `name · type · detail` (formula bodies elided) and each column's icon; far cleaner than the raw GET, whose compiled-formula blobs bloat the response. Drop to the raw GET below only when you need the raw property-**id** map for WRITE payloads / formula authoring (you rarely need raw ids for reads: `read_database` resolves names, and its row-format output's `# Views` section even surfaces id↔name in view configs):
```python
schema = GET /v1/data_sources/{id}
prop_ids = {name: meta["id"] for name, meta in schema["properties"].items()}
# IDs may be URL-encoded — urllib.parse.unquote(id) to normalize
```

**Read view config:** every row-format `read_database(database_id, format)` call (`table`/`kv`/`tsv`/`summary`) appends every view's complete configuration (cover/preview, `cover_size`, `cover_aspect`, `card_layout`, `group_by`, chart axes, visible/hidden props, sorts, `filter`, `quick_filters`) with property ids resolved to names — no flag, on every format. Raw `GET /v1/views` is only for driving it by hand; `POST`/`PATCH /v1/views` for writing views.

**Extract data_source_id from a database URL:**
```python
# 1. Get 36-char UUID from the Notion URL
# 2. GET /v1/databases/{uuid}  → response contains data_sources list
# 3. data_source_id = response["data_sources"][0]["id"]
```

**Formula expressions:** author with `prop("Name")` (what you send in `expression`); Notion compiles it to an opaque internal `{{notion:block_property:<propId>:<dsId>:<spaceId>}}` form seen on read-back — *normally* don't hand-author that form. **Exception (live-verified):** `prop("text").split(...)` and other list-ops on a `prop()` reference fold to `[]` via the public API, and the **compiled-token form survives the fold** — so for split/list ops on a text property, hand-authoring the token IS the public-API workaround (still typed `unknown`, hence display-only). Full rules → `formulas.md`; the type-correct private-AST path → `private-api.md`.

**Stale `filter_properties` in URL** → 400 `validation_error` "malformed schema ... invalid attribute: <encoded_id>" — remove stale property IDs from query params. (The `request` tool is a pure passthrough — it never appends params on its own; a stale id only appears if you pass it in the `query` arg.)

**Linked database views — creation IS supported** via `POST /v1/views` with a `create_database` block (see `views.md` "Create a linked database view embedded in a page"); the integration must have access to the **source** database, not just the page where the linked view is embedded. Wiki-database creation is not exposed by the public API — use the Notion UI.

**Move-intact backup / area-refactor** — reorganise an area (rename, restructure, split) without touching or losing any data, relation, or dual-relation. Keep the original in a dated backup, build the new structure in parallel.
1. **Create** a dated backup page under the area (`POST /v1/pages`, save its id).
2. **Re-parent** every top-level database (`PATCH /v1/databases/{id}` `{"parent":{"type":"page_id","page_id":"<new_parent_id>"}}`) and page (`POST /v1/pages/{id}/move`) into it — rows, values, relations, dual-relations all survive (only the parent pointer changes; a move, not a copy, so relation ids stay valid). `POST /v1/pages/{id}/move` also appends at the end (no position control) — move back-to-front or reorder via the private `listAfter` op afterward.
3. **Layout fidelity** (two `blocks.md` constraints): loose blocks can't be moved via the **public** API (recreate + trash — OR, with private access, move them in place via the private `listAfter` op, `private-api.md`), and databases can't enter columns via the API (UI-only). So: `read_page(area,"outline")` to record the original order FIRST → recreate the loose blocks at the backup + sequence the DB/page moves to match the recorded order → accept that side-by-side columns degrade to stacked (finish columns in the UI).
4. **Verify** — `read_page(backup,"outline")` + `read_page(area,"outline")`, emit both outlines in your report (post-structural `render_mockup`). The backup is now a safe, readable source for a later read-and-migrate pass.

**Bulk row migration between data sources** — moving hundreds–thousands of rows from an old DB into a new model. The public API has **no bulk create** (one `POST /v1/pages` per row), so:
- **For more than ~100 rows, write a SCRIPT, not MCP calls.** A small Bun/Node program using the **public integration token** (read from the gitignored env — never echoed/committed) is the right tool; thousands of sequential MCP `request` calls is impractical. Pace to ~3 req/s; retry `429`/`5xx` with backoff. (The private `token_v2` stays MCP-only — `private-api.md` — but the public token in a one-off ETL script is fine.)
- **Idempotent upsert by an external key.** Add a hidden `Source ID` (rich_text) on the target holding the source row's page id. Each run: query the target once → build `Source ID → target id` → `PATCH` existing / `POST` new. Re-runnable after any interruption (no dupes), and re-runnable after you fix a transform bug.
- **Read source values with a both-types reader** — `(p.rich_text ?? p.title ?? []).map(t=>t.plain_text).join("")`. A title-only or rich_text-only helper silently drops the other (`pages-properties.md`) — a blank-field migration bug.
- **`--dry-run` first** (build the full plan, print counts + sample mapped rows, write nothing) and **probe-first** (above) the compute chain on a throwaway connected row-set — *before* the bulk run.
- **Fix bad encodings in flight, don't carry them over.** Structured data jammed into a string (set codes `"1FS;2WS;1TS;"`, delimited multi-values) should become **clean typed fields** (separate numbers/selects, a `Total` formula) — parse the legacy string in the ETL, don't replicate the mess.

**Probe-first verification (API-built DB):** before bulk-migrating into a freshly-built, zero-row database, validate the whole compute chain with ONE transient connected row-set — create a row in each DB, linked together, then read them back: every formula and rollup should show its computed value (e.g. `Metric` = `PropA × PropB`; a `sum` rollup = the children's total). **Trash the probe rows** before migrating. This catches formula type errors, wrong rollup functions, and broken relations while it's cheap to fix. (Used live: validated formulas and Σ-/count-/max-rollups end-to-end, then trashed the probe rows.)

**Reader false-negative — "0 blocks" ≠ empty page:** `read_page(id, "outline")` on a **non-existent or mistyped page id** returns `0 blocks` with **no error** — it reads as "the page is empty." (Bit us once via a mis-padded UUID → a wrong "the area is empty" conclusion before a build.) Before concluding a page is empty, confirm the id resolves: `GET /v1/pages/{id}` (404 = bad id), or reach it via a known parent's children.

---

## Production architecture patterns

- **Cache locally** — Notion is not a real-time database; poll or use webhooks
- **Webhook pattern**: receive POST → return 2xx immediately → enqueue async job → fetch via API → update cache; periodic reconciliation as fallback
- **Batch reads**: 2–4 concurrent requests max + global rate limiter
- **Prefer `read_database`** over `/v1/search` for deterministic retrieval of known databases
- **Search filter values (2025-09-03 breaking change):** `POST /v1/search` `filter.value` accepts `'page'` or `'data_source'` — NOT `'database'`
- **Idempotent writes**: use an external ID property to prevent duplicate pages on retry
- **Track sync checkpoints** to recover from missed changes
