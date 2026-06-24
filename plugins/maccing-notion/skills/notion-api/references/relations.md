# Relations & rollups

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, act-and-report (no approval gate), render_mockup after structural changes, match-conventions) still apply to everything here.

**This is the single home for relations** — property shape, create/convert, dual-sync & the one-sided desync trap, the ~25-item read cap, reading a relation in a formula (list-ops + the latest-value flagship), auto-linking new rows, and rollups (which exist only *over* a relation). Two pointers out: the raw property-object catalog → `pages-properties.md`; authoring a relation-read `formula2` AST via the private API → `private-api.md` → "Relation-read encoding".

**Reads:** use `read_database` (`exhaust_all=true`) for reading row **values** — not a manual `/query` loop; it resolves relation values to **titles** (no raw `[{id}]` parsing). For a single row, `read_page(page_id, "markdown")` resolves its relations/rollups too. ⚠️ The readers do **not** expose a row's **page id** — to get the id for a relation write, use raw `request` `POST /v1/data_sources/{id}/query` (each result has `.id`). ⚠️ The readers also do **not** expand a relation past ~25 entries — see "[The ~25-item read cap](#the-25-item-read-cap-the-sneaky-one)".

## Relation property shape

A relation is created/edited via a schema `PATCH /v1/data_sources/{id}`. Two flavours (raw objects catalogued in `pages-properties.md`):

```json
// Dual / two-way — a synced reverse property appears on the target
{ "PropName": { "relation": { "data_source_id": "<target_ds_id>", "type": "dual_property", "dual_property": { "synced_property_name": "<ReverseName>" } } } }
// Single / one-way — no reverse property on the target
{ "PropName": { "relation": { "data_source_id": "<target_ds_id>", "type": "single_property", "single_property": {} } } }
```

⚠️ A relation (and a rollup) references a **`data_source_id`, not a `database_id`** (a 2026-03-11 change — priors saying `database_id` are stale).

## Create & convert

- **Dual (two-way)** auto-names the reverse property `"Related to <SourceDB> (<TargetDB>)"`. **Preferred — name the reverse AT CREATION in one PATCH** via `dual_property.synced_property_name` (no auto-name-then-rename round trip):
  ```json
  PATCH /v1/data_sources/{id}
  { "properties": { "Month": { "relation": { "data_source_id": "<target_ds>", "type": "dual_property", "dual_property": { "synced_property_name": "Weeks" } } } } }
  ```
  The reverse on the target comes back already named `Weeks` (live-verified 2026-06-14). The rename-after path is the **fallback** for a relation that already exists.
- **Upgrade single → dual:**
  ```json
  PATCH /v1/data_sources/{id}
  { "properties": { "RelProp": { "relation": { "data_source_id": "...", "type": "dual_property", "dual_property": {} } } } }
  ```
  ⚠️ **Conversion does NOT backfill** existing rows onto the reverse side — new rows auto-mirror, but pre-existing rows need explicit PATCH **from the target/reverse side** (patching from the source/forward side is a silent no-op):
  ```
  # Query BOTH data sources via raw POST /v1/data_sources/{id}/query (each result carries .id + the relation prop) —
  # read_database returns titles/values, not the page ids the PATCH needs. Build source_page_id → [target_page_ids],
  # then patch from the TARGET side:
  PATCH /v1/pages/{source_page_id}
  { "properties": { "<BackRelProp>": { "relation": [{"id": t_id} for t_id in target_page_ids] } } }
  ```
  Batch ≤100 relation entries per PATCH.
- **Set a relation value on a row** (get the target row's page id from raw `POST /v1/data_sources/{id}/query` — `.id` per result; the readers don't expose page ids):
  ```json
  PATCH /v1/pages/{page_id}
  { "properties": { "Month": { "relation": [{ "id": "<target_page_id>" }] } } }
  ```
- Multi-database Notion setups (e.g. per-month child databases) may each have their own separate Categories database — categories are NOT automatically shared; unify by name when migrating or restructuring.

## Dual-sync & the one-sided desync trap (live-verified 2026-06-21)

A two-way relation stores a pointer on **BOTH** sides. Writing one side the right way syncs the other automatically:

- ✅ **The public API `PATCH /v1/pages/{id}` auto-syncs the partner.** Set a log row's back-relation = a card, and the card's relation gains that row instantly (and vice-versa). This is the way to write — and to repair — a link.
- ❌ **A one-sided write leaves the relation DESYNCED** — the card shows the row but the row's back-relation is empty (or vice-versa), so a relation-read formula, a pre-set template, or a rollup silently misbehaves. Three causes:
  - a **private `api/v3` `saveTransactions`** that sets only ONE side's relation property (the public API would have synced both — a private op writes exactly what you give it);
  - **duplicating a database** (silently downgrades a two-way relation to one-way);
  - on a single→dual conversion, **patching only the source/forward side** (a documented no-op — you must patch the target side, see Create & convert).
- **Detect:** filter the back-relation's DB on "`<BackRel>` is_not_empty" — if it returns fewer rows than are visibly linked on the other side, the relation desynced.
- **Repair:** re-`PATCH` the **row side** via the **public API** (`{"properties":{"<BackRel>":{"relation":[{"id":"<partner_page_id>"}]}}}`) — it re-syncs both sides. Never "repair" with another one-sided private write — that recreates the same state.

## The ~25-item read cap (the sneaky one)

A row's `properties.<Rel>.relation` array is itself **capped at ~25** and carries its OWN `has_more: true`. The query/row cursor does **not** expand it, and `read_page`/`read_database` do **not** either (they map only the ~25-capped `relation` array the page/query returned). For a relation expected to exceed ~25 entries — **even in a read-only flow** — page `GET /v1/pages/{page_id}/properties/{property_id}` to the end yourself. "The relation shows 25" is the tell you're holding a fragment. (Rollups/aggregations are computed server-side and are **not** affected by this cap — only the raw relation/title LIST truncates.) This is the relation-specific case of the skill-wide pagination law (`SKILL.md` → "exhaust every paginated list").

## Reading a relation in a formula (Formula 2.0)

A relation property is a **list of pages** — Formula 2.0 exposes `.filter()`, `.map()`, `.sort()`, `.first()`, `.last()` over it, with `current` as the per-item page reference inside each callback.

| Operation | Example | Notes |
|---|---|---|
| `.filter(pred)` | `prop("Rel").filter(current.prop("P") > 0)` | Returns a sub-list; `current` = each page |
| `.map(expr)` | `prop("Rel").map(current.prop("P"))` | Projects a value per page → a list |
| `.sort(key)` | `prop("Rel").sort(current.prop("Date"))` | Ascending by key; chain after filter |
| `.first()` / `.last()` | `…list.first()` / `…list.last()` | First / last (after sort) |
| `.prop("P")` | after `.first()`/`.last()` | Read a property off the resolved page |

**Flagship — latest value by date (no rollup can do this):** no rollup function returns "the value from the row with the most recent date". This does:
```
prop("<Relation>").filter(not(empty(current.prop("Date")))).sort(current.prop("Date")).last().prop("<Value>")
```
(1) filter strips date-less rows — null dates poison the sort; (2) sort ascending by date; (3) `.last()` = chronologically latest page; (4) `.prop()` reads its value.

⚠️ **A relation list-op that reads a *related page's* property (`current.prop("X")`, `.last().prop("X")`) is UI-ONLY to author via the public REST API** — writing it as a `formula.expression` string returns `400 "Type error with formula"` in BOTH the `prop()` and compiled-`{{…}}` forms (empirically confirmed: even `{{relRef}}.map(current.prop("Value")).sum()` fails). The public string compiler cannot resolve a related-page property's type. To set it programmatically, author the typed **`formula2` AST** via the private path — the full encoding is **hand-craftable, no UI seed needed** → `private-api.md` → "Relation-read encoding". (Filterability follows the stored type: a **public-string** formula is typed `unknown` → not view-filterable; a UI/AST formula carries a real `result_type`, so it can be — verify against your view if you depend on it.)

✅ **RENAMING a locked relation-read formula is SAFE** (only the *expression* is locked). A `PATCH /v1/data_sources/{id}` that sets just the property's `{name}` does **not** recompile its `formula.expression` — name and expression are separate fields, so the relation-read `formula2` AST survives a rename intact (and any dependent formula/rollup that references it by **id** keeps working). Only an EXPRESSION edit Type-errors. Use this to **free a name**: rename the locked formula aside, then create a fresh public formula under the old name — e.g. a thin display **wrapper** (`if(<some condition token>, "—", format(<renamed-formula token>))`) that blanks or reformats the locked value for some rows without touching the AST. Live-verified 2026-06-24.

## Auto-link every new row to a fixed card (feed the latest-value formula)

The relation-read flagship above only sees rows that are IN the relation. To keep it current as new log rows are added with **zero per-entry action**: make the relation DUAL so the log DB gains a synced back-relation, then **pre-set that back-relation on the log DB's default template** = the fixed card. Two API writes:
1. Make it dual (so the LOG DB gains the synced back-relation):
   `PATCH /v1/data_sources/{card_ds} {"properties":{"<Rel>":{"relation":{"data_source_id":"<log_ds>","type":"dual_property","dual_property":{"synced_property_name":"<BackRel>"}}}}}`
2. Pre-set that back-relation on the log DB's default template = the card (the template-editing mechanics — finding the default template id, PATCHing it, the `today` Date token — are in `private-api.md` → "Database row templates"):
   `PATCH /v1/pages/{log_default_template_id} {"properties":{"<BackRel>":{"relation":[{"id":"<card_page_id>"}]}}}`

A row created **from the default template** then carries `<BackRel>` = card → joins the card's relation → the relation-read formula recomputes to the latest. (A `today` Date token on the template also auto-dates the row, so the latest-by-date sort needs no input.)

**⚠️ Which add-action applies the default template is the whole ballgame — the #1 reason a "working" auto-link silently stops.**
- **APPLIES** it: the **blue "New" button** (top-right of the database), its **▾ → the default template**, and in **board view** a column's **"+ Add"**.
- Does **NOT** apply it (→ a BLANK, UNLINKED row): the **inline "+ New" at the BOTTOM of a TABLE view** (the quick-add row — it looks identical but silently skips the template; live-verified 3/3, 2026-06-21), plus **paste / CSV-import / the public API** (`POST /v1/pages {template:{type:"default"}}` is a verified NO-OP).
- **So the instruction to give the user is: add rows with the blue "New" button — NEVER the inline "+ New" at the bottom of the table.**
- **Free plan → NO database automations** (the UI "when row added → set relation" rule needs Plus; it also has no create API). The default template is the free mechanism.
- For **ALL** add-methods (paste/import/API included), Notion's native **webhooks** (API version `2026-03-01`): subscribe `page.created` on the log DB → handler `PATCH`es the new page's back-relation = the card. Needs a public HTTPS endpoint (a localhost MCP server needs a tunnel).

Once linked, the relation feeds the latest-value formula in "Reading a relation in a formula" above. Set/repair the links via the **public API** so both sides sync (see "Dual-sync & the one-sided desync trap").

## Rollups

- Add rollup: `PATCH /v1/data_sources/{id}` with the full property envelope — `{ "properties": { "MyRollup": { "rollup": { "relation_property_name": "RelProp", "rollup_property_name": "TargetProp", "function": "sum" } } } }` (the `{ "properties": { "<name>": … } }` wrapper is required, same as every schema PATCH)
- Functions (the COMPLETE valid set — a wrong one 400s with this list): `count` · `count_values` · **`unique`** (count of DISTINCT values — e.g. `unique` of a Date = number of distinct days = gym visits, NOT row count) · `show_unique` · `empty` · `not_empty` · `percent_empty` · `percent_not_empty` · `sum` · `average` · `median` · `min` · `max` · `range` · `earliest_date` · `latest_date` · `date_range` · `checked` · `unchecked` · `percent_checked` · `percent_unchecked` · `count_per_group` · `percent_per_group` · `show_original`. ⚠️ The distinct-count function is **`unique`**, NOT `count_unique_values` (that 400s). ⚠️ Plain **`count`** counts ALL related rows (one per relation entry) — to count distinct values of a property (sessions/visits, distinct categories) use **`unique`** on that property.
- **No rollup-of-rollup** — API returns: `"Cannot create a rollup of a related rollup property."` Blocks rolling up a *rollup property* directly (any function, including date rollups). ⚠️ **Carve-out — rolling up a *formula* column through a relation WORKS** (`sum`/`count`/`max` of a formula property is fine; e.g. `ParentDB.Metric = sum(ChildDB.Metric)` where the log's Metric is a formula — live-verified 2026-06-14). So to aggregate two hops up (e.g. log→Week→Month), expose the middle value as a **formula** (not a rollup) for the next rollup to consume, or add a direct relation. See `formulas.md` and the "current-period value" workaround below.
  - **Live cross-DB aggregation workaround** — a per-row formula `if(formatDate(prop("Month date"),"YYYYMM") == formatDate(now(),"YYYYMM"), prop("Value"), 0)` summed by a rollup on the category relation: the "current-period value" pattern. Full recipe + cautions in `formulas.md` → "Live category aggregation".
- When creating a rollup referencing a new relation, Notion auto-names the reverse property `"Related to X (DB Name)"` — **rename it BEFORE adding the rollup**, not after; using the unrenamed name produces 400 'Cannot create rollup with relation property':
  ```json
  PATCH /v1/data_sources/{id}
  { "properties": { "Related to X (DB Name)": { "name": "Related to X" } } }
  ```
  (Only applies when the relation was created without `dual_property.synced_property_name` — if you used it at creation, this step is not needed. See "Create & convert" above.)
- Rollup recompute lag: querying immediately after a schema change may return `null` — re-read a moment later until non-null before depending on the value (this is Notion-side propagation delay, NOT a rate limit; the MCP clients handle real throttles themselves)
- `read_page`/`read_database` return rollup values as plain scalars. (If using raw `request` instead: `latest_date` → `rollup.date.start`, numeric → `rollup.number` — the readers flatten these for you.)

## Rollup values inside `formula2` ASTs — unwrap with `.first()`

**`show_original` (and other single-value rollup functions) return an ARRAY when referenced inside a private `formula2` AST.** Even though the rollup resolves to a single scalar in the UI, the compiled token for that rollup has type `list<T>` inside the formula engine. Arithmetic over an unwrapped array yields wrong or empty results.

**Fix: append `.first()` to unwrap to a scalar before use.** Example:

```
// {rollup} = placeholder for the compiled token {{notion:block_property:<propId>:...}} of the rollup property
// Wrong — <rollup-token> is a list, multiplication yields empty/wrong
<rollup-token> * 7

// Correct — `.first()` unwraps to scalar first
<rollup-token>.first() * 7
```

Live-verified 2026-06-19 building a daily-totals tracker (a computed-rollup formula — e.g. a metric rollup × 4 — failed until `.first()` was added).

**Chaining `formula2` formulas is also fragile.** If a `formula2` formula references ANOTHER `formula2` formula via its compiled tokens, the AST can fail to resolve at runtime. **Prefer inlining the dependency** — copy the referenced formula's expression directly into the consuming formula — rather than chaining through a named formula property.
