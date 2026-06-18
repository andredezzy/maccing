# Relations & rollups

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, approval gate before writes, tree view after structural changes, match-conventions) still apply to everything here.

**Reads:** use `read_database` (`exhaust_all=true`) for reading row **values** — not a manual `/query` loop; it resolves relation values to **titles** (no raw `[{id}]` parsing). For a single row, `read_page(page_id, "markdown")` resolves its relations/rollups too. ⚠️ The readers do **not** expose a row's **page id** — to get the id for a relation write, use raw `request` `POST /v1/data_sources/{id}/query` (each result has `.id`). The PATCH calls below are the write steps.

## Rollups

- Add rollup: `PATCH /v1/data_sources/{id}` with the full property envelope — `{ "properties": { "MyRollup": { "rollup": { "relation_property_name": "RelProp", "rollup_property_name": "TargetProp", "function": "sum" } } } }` (the `{ "properties": { "<name>": … } }` wrapper is required, same as every schema PATCH)
- Functions (the COMPLETE valid set — a wrong one 400s with this list): `count` · `count_values` · **`unique`** (count of DISTINCT values — e.g. `unique` of a Date = number of distinct days = gym visits, NOT row count) · `show_unique` · `empty` · `not_empty` · `percent_empty` · `percent_not_empty` · `sum` · `average` · `median` · `min` · `max` · `range` · `earliest_date` · `latest_date` · `date_range` · `checked` · `unchecked` · `percent_checked` · `percent_unchecked` · `count_per_group` · `percent_per_group` · `show_original`. ⚠️ The distinct-count function is **`unique`**, NOT `count_unique_values` (that 400s). ⚠️ Plain **`count`** counts ALL related rows (one per relation entry) — to count distinct values of a property (sessions/visits, distinct categories) use **`unique`** on that property.
- **No rollup-of-rollup** — API returns: `"Cannot create a rollup of a related rollup property."` Blocks rolling up a *rollup property* directly (any function, including date rollups). ⚠️ **Carve-out — rolling up a *formula* column through a relation WORKS** (`sum`/`count`/`max` of a formula property is fine; e.g. `Weeks.Hard sets = sum(Training Log.Hard sets)` where the log's Hard sets is a formula — live-verified 2026-06-14). So to aggregate two hops up (e.g. log→Week→Month), expose the middle value as a **formula** (not a rollup) for the next rollup to consume, or add a direct relation. See `formulas.md` and the "current-period value" workaround below.
  - **Live cross-DB aggregation workaround** — a per-row formula `if(formatDate(prop("Month date"),"YYYYMM") == formatDate(now(),"YYYYMM"), prop("Value"), 0)` summed by a rollup on the category relation: the "current-period value" pattern. Full recipe + cautions in `formulas.md` → "Live category aggregation".
- When creating a rollup referencing a new relation, Notion auto-names the reverse property `"Related to X (DB Name)"` — **rename it BEFORE adding the rollup**, not after; using the unrenamed name produces 400 'Cannot create rollup with relation property':
  ```json
  PATCH /v1/data_sources/{id}
  { "properties": { "Related to X (DB Name)": { "name": "Related to X" } } }
  ```
- Rollup recompute lag: querying immediately after a schema change may return `null` — re-read a moment later until non-null before depending on the value (this is Notion-side propagation delay, NOT a rate limit; the MCP clients handle real throttles themselves)
- `read_page`/`read_database` return rollup values as plain scalars. (If using raw `request` instead: `latest_date` → `rollup.date.start`, numeric → `rollup.number` — the readers flatten these for you.)

---

## Relations

- Dual (two-way) relation auto-names the reverse property `"Related to <SourceDB> (<TargetDB>)"`. **Preferred — name the reverse AT CREATION in one PATCH** via `dual_property.synced_property_name` (no auto-name-then-rename round trip):
  ```json
  PATCH /v1/data_sources/{id}
  { "properties": { "Month": { "relation": { "data_source_id": "<target_ds>", "type": "dual_property", "dual_property": { "synced_property_name": "Weeks" } } } } }
  ```
  The reverse on the target comes back already named `Weeks` (live-verified 2026-06-14). The rename-after path below is the **fallback** for a relation that already exists.
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

