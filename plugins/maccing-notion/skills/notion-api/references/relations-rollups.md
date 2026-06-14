# Relations & rollups

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, approval gate before writes, tree view after structural changes, match-conventions) still apply to everything here.

**Reads:** use `read_database` (`exhaust_all=true`) for reading row **values** — not a manual `/query` loop; it resolves relation values to **titles** (no raw `[{id}]` parsing). For a single row, `read_page(page_id, "markdown")` resolves its relations/rollups too. ⚠️ The readers do **not** expose a row's **page id** — to get the id for a relation write, use raw `request` `POST /v1/data_sources/{id}/query` (each result has `.id`). The PATCH calls below are the write steps.

## Rollups

- Add rollup: `PATCH /v1/data_sources/{id}` with the full property envelope — `{ "properties": { "MyRollup": { "rollup": { "relation_property_name": "RelProp", "rollup_property_name": "TargetProp", "function": "sum" } } } }` (the `{ "properties": { "<name>": … } }` wrapper is required, same as every schema PATCH)
- Functions include: `sum`, `max`, `min`, `count`, `latest_date`, `earliest_date`, etc.
- **No rollup-of-rollup** — API returns: `"Cannot create a rollup of a related rollup property."` (applies to any rollup-of-rollup, including date rollups)
  - **Live cross-DB aggregation workaround** — a per-row formula `if(formatDate(prop("Month date"),"YYYYMM") == formatDate(now(),"YYYYMM"), prop("Value"), 0)` summed by a rollup on the category relation: the "current-period value" pattern. Full recipe + cautions in `formulas.md` → "Live category aggregation".
- When creating a rollup referencing a new relation, Notion auto-names the reverse property `"Related to X (DB Name)"` — **rename it BEFORE adding the rollup**, not after; using the unrenamed name produces 400 'Cannot create rollup with relation property':
  ```json
  PATCH /v1/data_sources/{id}
  { "properties": { "Related to X (DB Name)": { "name": "Related to X" } } }
  ```
- Rollup recompute lag: querying immediately after a schema change may return `null` — retry with brief backoff (a few seconds) until non-null before depending on the value
- `read_page`/`read_database` return rollup values as plain scalars. (If using raw `request` instead: `latest_date` → `rollup.date.start`, numeric → `rollup.number` — the readers flatten these for you.)

---

## Relations

- Dual (two-way) relation auto-names reverse property `"Related to <SourceDB> (<TargetDB>)"` — rename before use
- **Single → dual conversion does NOT backfill** existing rows onto the reverse side — new rows auto-mirror; pre-existing rows need explicit PATCH **from the target/reverse side** (patching from the source/forward side is a silent no-op):
  ```python
  # Query BOTH data sources via raw POST /v1/data_sources/{id}/query (each result carries .id + the relation prop) —
  # read_database returns titles/values, not the page ids the PATCH needs, so the raw query is required here. Build
  # category_page_id → [snapshot_ids] from those results, then patch from the TARGET side:
  PATCH /v1/pages/{category_id}
  { "properties": { "Snapshots": { "relation": [{"id": s_id} for s_id in snapshot_ids] } } }
  ```
  Batch ≤100 relation entries per PATCH.
- Upgrading single → dual:
  ```json
  PATCH /v1/data_sources/{id}
  { "properties": { "RelProp": { "relation": { "data_source_id": "...", "type": "dual_property", "dual_property": {} } } } }
  ```
- Set relation value on a page (get the target row's page id from raw `POST /v1/data_sources/{id}/query` — `.id` per result; the readers don't expose page ids):
  ```json
  PATCH /v1/pages/{page_id}
  { "properties": { "Month": { "relation": [{ "id": "<target_page_id>" }] } } }
  ```
- Multi-database Notion setups (e.g. per-month child databases) may each have their own separate Categories database — categories are NOT automatically shared; unify by name when migrating or restructuring

