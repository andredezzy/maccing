# Relations & rollups

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, approval gate before writes, tree view after structural changes, match-conventions) still apply to everything here.

## Rollups

- Add rollup: `PATCH /v1/data_sources/{id}` with the full property envelope — `{ "properties": { "MyRollup": { "rollup": { "relation_property_name": "RelProp", "rollup_property_name": "TargetProp", "function": "sum" } } } }` (the `{ "properties": { "<name>": … } }` wrapper is required, same as every schema PATCH)
- Functions include: `sum`, `max`, `min`, `count`, `latest_date`, `earliest_date`, etc.
- **No rollup-of-rollup** — API returns: `"Cannot create a rollup of a related rollup property."` (applies to any rollup-of-rollup, including date rollups)
- When creating a rollup referencing a new relation, Notion auto-names the reverse property `"Related to X (DB Name)"` — **rename it BEFORE adding the rollup**, not after; using the unrenamed name produces 400 'Cannot create rollup with relation property':
  ```json
  PATCH /v1/data_sources/{id}
  { "properties": { "Related to X (DB Name)": { "name": "Related to X" } } }
  ```
- Rollup recompute lag: querying immediately after schema change may return `null` — wait ~5s
- `latest_date` rollup → `rollup.date.start`; numeric rollups → `rollup.number`

---

## Relations

- Dual (two-way) relation auto-names reverse property `"Related to <SourceDB> (<TargetDB>)"` — rename before use
- **Single → dual conversion does NOT backfill** existing rows onto the reverse side — new rows auto-mirror; pre-existing rows need explicit PATCH **from the target/reverse side** (patching from the source/forward side is a silent no-op):
  ```python
  # Build map: category_page_id → [snapshot_ids], then patch from the TARGET side:
  PATCH /v1/pages/{category_id}
  { "properties": { "Snapshots": { "relation": [{"id": s_id} for s_id in snapshot_ids] } } }
  ```
  Batch ≤100 relation entries per PATCH.
- Upgrading single → dual:
  ```json
  PATCH /v1/data_sources/{id}
  { "properties": { "RelProp": { "relation": { "data_source_id": "...", "type": "dual_property", "dual_property": {} } } } }
  ```
- Set relation value on a page:
  ```json
  { "properties": { "Month": { "relation": [{ "id": "<target_page_id>" }] } } }
  ```
- Multi-database Notion setups (e.g. per-month child databases) may each have their own separate Categories database — categories are NOT automatically shared; unify by name when migrating or restructuring

