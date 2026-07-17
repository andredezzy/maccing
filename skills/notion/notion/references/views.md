# Views API — listing, creating, linked views, columns

Part of the `notion` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, act-and-report (no approval gate), a live re-read after structural changes, match-conventions) still apply to everything here.

## Views API

```
GET    /v1/views?data_source_id={ds}   # list views — returns MINIMAL objects (id only; live-verified) — GET each for type/name/config
GET    /v1/views/{view_id}             # full detail incl. name + configuration — call individually per view
POST   /v1/views                       # create view
PATCH  /v1/views/{view_id}            # update view
DELETE /v1/views/{view_id}            # delete view
```

**INVALID**: `GET /v1/data_sources/{ds}/views` → 400

**Reads:** to INSPECT views (names + complete config, property ids resolved to names), call **`read_database(database_id, format, views:'full')`** — every call (`table`/`kv`/`tsv`/`summary`) appends a `# Views` section; the default `views:'summary'` is one line per view only, **not enough to inspect or PATCH a view** — pass `views:'full'` to dump each view's full configuration (sorts, `filter`, `quick_filters`, and all visual props). Use raw `request` for view **writes** (`POST`/`PATCH /v1/views`) — always fetch `views:'full'` FIRST to see the current config before a PATCH. Raw read equivalent, only when driving it by hand: `GET /v1/views?data_source_id={ds}` (a minimal list of **ids only** — paginate `has_more` per the Iron Law) then `GET /v1/views/{id}` per result for type + name + configuration.

**Create a linked database view embedded in a page** (only API mechanism):
```json
POST /v1/views
{
  "data_source_id": "<ds_id>",
  "name": "Filtered table",
  "type": "table",
  "create_database": {
    "parent": { "type": "page_id", "page_id": "<page_id>" },
    "position": { "type": "after_block", "block_id": "<block_id>" }
  },
  "filter": { "property": "Active", "checkbox": { "equals": true } }
}
```
- `create_database` is the location locator here, so no top-level `database_id` is needed; for a view on an **existing** database, `database_id` IS required (see the chart example below). `create_database.position` is optional; controls where the linked-DB block is inserted on the parent page.
- ⚠️ **`create_database.position` uses a FLAT `block_id`** — `{ "type":"after_block", "block_id":"<id>" }` — the **opposite** of `PATCH /v1/blocks/{id}/children`, whose `after_block` is a nested `{ "id":"<id>" }` (blocks.md). The nested form here → `400 create_database.position.block_id should be defined`. Live-verified 2026-06-19.

> ⚠️ **MANDATORY — one inline block with multiple view TABS vs. N separate blocks (the #1 multi-view mistake).** Every `POST /v1/views` carrying a `create_database` object spawns a **brand-new, separate** inline database block. So building a multi-bucket dashboard — **Today / Tomorrow / Next 7 days / Last 7 days** (or Active/Done, by-owner, …) of the **same** database — by calling `create_database` once per bucket yields **N stacked separate databases** (N drag-handles, N gray headings, N "＋ New" rows), **NOT** N tabs. Almost never what's wanted. **Recipe for tabs on ONE block:**
> 1. **First view** → `create_database` (plants the block). Capture the response's `parent.database_id` — that is the new linked-DB **block id**.
> 2. **Every other view** → POST with **`database_id` = that block id**, **+ `data_source_id`**, **+ `position: { "type":"after_view", "view_id":"<prev view id>" }`**, and **NO `create_database`**. Each tab keeps its OWN `filter`/`sorts`/visible columns (different tabs can show different columns).
>
> **Tab order + default tab = the block's `view_ids` array** (`view_ids[0]` is the leftmost/default tab). `position:after_view` sets order *at creation* but can land off; to fix the order or change which tab is default, **set `view_ids` via the private API** — `saveTransactions` `{command:"set", path:["view_ids"], args:[<ordered view ids>]}` on the `block` (`private-api.md`). Live-verified 2026-06-19 (a tracker dashboard mistakenly built as 4 separate blocks per section → rebuilt to 1 block × 4 tabs; `view_ids` set to put **Today** first).

**View tab-bar positioning** (top-level field on `POST /v1/views`):
```json
{ "position": { "type": "start" } }
{ "position": { "type": "end" } }
{ "position": { "type": "after_view", "view_id": "<view_id>" } }
```

**After adding a view, rename the leftover `Default view`.** Notion auto-names a database's first view generically — **`Default view`** (or a bare type name like `Table`). That name only makes sense while it's the *only* view. The moment you `POST` a second view, `Default view` is misleading — it's no longer "the" default, just an unlabelled table sitting next to your named view. **So adding a view is a two-write job:** create the new view, **and** rename the old generic one to say what it actually is.
```json
PATCH /v1/views/{old_view_id}
{ "name": "Table" }   // illustrative — or purpose-based: "All categories", "Backlog"
```
Name it by what it IS — by **type** to match a type-named sibling (a `Gallery` view → rename the table to `Table`), or by **purpose** (`All categories`, `Backlog`). Every tab must be self-describing: a database showing a `Gallery` tab next to a `Default view` tab is **unfinished, not clean**. Detect the leftover from the view-list detail already fetched above — `name === "Default view"` (or a `name` equal to the bare view `type`).

**Create a chart view:**
```json
POST /v1/views
{
  "database_id": "<database_id>",
  "data_source_id": "<ds_id>",
  "name": "Trend chart",
  "type": "chart",
  "configuration": {
    "type": "chart",
    "chart_type": "line",
    "x_axis": { "type": "date", "property_id": "<prop_id>", "group_by": "month", "sort": { "type": "ascending" } },
    "y_axis": { "aggregator": "sum", "property_id": "<prop_id>" },
    "color_theme": "blue",
    "height": "medium",
    "smooth_line": true,
    "hide_line_fill_area": false,
    "cumulative": false,
    "legend_position": "off"
  }
}
```
> Note: like every `POST /v1/views` on an existing database, pass the location param `database_id` (the container — the Notion DB UUID from `GET /v1/databases/{id}` or the page URL) **plus** `data_source_id` (which source — `data_sources[0].id`). `data_source_id` alone → `400 "Exactly one of database_id, view_id, or create_database must be provided."` (live-verified 2026-03-11 — see `gallery-view.md`). When using a `create_database` block instead (linked view on a new page), omit `database_id` — that block specifies the parent.

**Number/KPI chart** uses `value: {aggregator, property_id}` instead of `x_axis`/`y_axis`.

Full aggregator vocabulary: `count`, `count_values`, `sum`, `average`, `median`, `min`, `max`, `range`, `unique`, `empty`, `not_empty`, `percent_empty`, `percent_not_empty`, `checked`, `unchecked`, `percent_checked`, `percent_unchecked`, `earliest_date`, `latest_date`, `date_range`

**Board view** requires `group_by` with `type` AND `sort`:
```json
{ "configuration": { "type": "board", "group_by": { "type": "select", "property_id": "...", "sort": { "type": "descending" } } } }
```
(`configuration` excerpt — a full create POST also needs `database_id` + `data_source_id` + `name` + `type`, as in the chart example above.)

**Group ANY view (table / list / …) by a property — and the DATE rule.** Same `group_by` config; it's a oneOf with two shapes:
- **Simple types** (`select` · `multi_select` · `status` · `relation` · `person` · `created_by` · `last_edited_by` · `text` · `title` · `number` · `checkbox` · `url` · `email` · `phone_number`): `group_by: { "type": <that type>, "property_id": "<id>", "sort": {...} }`.
- **Date/time types** (`date` · `created_time` · `last_edited_time`): MUST add a nested `group_by` **granularity** — `{ "type": "date", "property_id": "<id>", "group_by": "day", "sort": { "type": "descending" } }` (granularity ∈ `day` / `week` / `month` / `year` / `relative`). ⚠️ Missing the granularity → `400 "group_by.group_by should be defined"`; missing `type` → `400 "type should be defined"` — you need BOTH. `formula` is NOT a valid `group_by.type` (group by a real property, not a formula).
- **`PATCH /v1/views/{id}` MERGES `configuration`** — sending only `group_by` preserves the column `properties` (no need to resend the whole list). Live-verified 2026-06-17 (a log DB's table view grouped by Date, day granularity, descending).
- **Hide empty groups — undocumented but PUBLIC.** Add `"hide_empty_groups": true` **inside** the `group_by` object (`{ "type":"date", …, "sort":{…}, "hide_empty_groups": true }`). The public API accepts, persists, and echoes it back even though it's absent from the docs. Live-verified 2026-06-18.
- **Group sort ≠ row sort — two different fields.** `group_by.sort` orders the GROUPS; the view's **top-level `sorts: [{ "property", "direction" }]`** orders the ROWS *within* each group. To sequence rows inside a group (e.g. a numbered plan whose titles are `"1 · …"` … `"7 · …"`), set a top-level `sorts` on that property — the `group_by.sort` won't touch row order. Live-verified 2026-06-18.

**Supported view types:** `table`, `board`, `list`, `calendar`, `timeline`, `gallery`, `chart`, `dashboard` _(Business+ only; required POST fields unverified — see charts.md)_, `map` _(availability/required fields unverified)_, `form`, `feed` _(append-only feed-layout view; required POST fields unverified — mark accordingly)_

**"Open pages in" (peek mode) — a PRIVATE-only view setting.** How a row opens — **Side peek** / **Center peek** / **Full page** — is NOT in the public view `configuration` (which carries only type/properties/cover/sorts/filter). It lives in the collection_view's `format.collection_peek_mode`. Set it via the private app API (DevTools-captured from the UI's `saveTransactionsFanout`; live-verified 2026-06-14):
```jsonc
private_request({ endpoint: "saveTransactions", operations: [
  { pointer: {table:"collection_view", id:"<view_id>", spaceId:"<space>"},
    command: "update", path: ["format"], args: { collection_peek_mode: "full_page" } },   // or "side_peek"
  { pointer: {table:"collection", id:"<any data source in the space>", spaceId:"<space>"}, path:[], command:"update",
    args: {last_edited_by_id:"<activeUser>", last_edited_by_table:"notion_user"} } ]})
```
- Values: **`"full_page"`** (Full page) · **`"side_peek"`** (Side peek). **Center peek** (a gallery's default) = the field **absent** — to reset, set it back to `null`/drop the key.
- Read it back: `private_request({ endpoint:"getRecordValues", body:{ requests:[{ id:"<view_id>", table:"collection_view" }] } })` → `format.collection_peek_mode`. (The `200 {}` write doesn't prove persistence — verify.)
- **House style:** navigation-hub galleries (an "X Navigation" gallery whose rows are sub-pages) should open **Full page** — set `collection_peek_mode:"full_page"` on every nav-hub gallery view.

**Hide an inline/linked block's TITLE heading — `hide_inline_collection_name` (PRIVATE-only).** Not the same as hiding the `title` *card* property (`gallery-view.md`, `properties:[{property_id:"title",visible:false}]`): this hides the gray **database-name heading** (`↗ <DB name>`) rendered ABOVE the view tabs of an inline/linked collection_view block. The public view `configuration` has no flag for it. ⚠️ **The flag lives on the `collection_view` BLOCK's `format` — NOT on the views.** Set it ONCE, on the block:
```jsonc
private_request({ endpoint: "saveTransactions", operations: [
  { pointer: {table:"block", id:"<collection_view BLOCK id>", spaceId:"<space>"},
    command: "update", path: ["format"], args: { hide_inline_collection_name: true } },
  { pointer: {table:"collection", id:"<any data source in the space>", spaceId:"<space>"}, path:[], command:"update",
    args: {last_edited_by_id:"<activeUser>", last_edited_by_table:"notion_user"} } ]})
```
- **ONE op on the BLOCK — not one-per-view.** `<BLOCK id>` = the linked-DB block (the `parent.database_id` returned by `create_database`; its `view_ids` are the tabs). Read back via `getRecordValues` on the **`block`** → `format.hide_inline_collection_name`. The `200 {}` write doesn't prove it rendered — verify (read-back / browser). Live-verified 2026-06-24 — two existing daily-hub linked blocks (a log view + a due-list view) hide their name exactly this way.
- ⚠️ **`hide_linked_collection_name` on the *views* is a NO-OP for inline hub blocks** — it writes cleanly and reads back `true`, yet the `↗ <DB name>` heading KEEPS rendering; only the BLOCK-level `hide_inline_collection_name` (above) actually hides it. Live-verified 2026-06-24 — a hub linked block carried `hide_linked_collection_name:true` on all 4 views and still showed its name; one `hide_inline_collection_name:true` on the block hid it. **When unsure which flag/level, copy a WORKING sibling block's `format` — never trust a flag because its name sounds right.**
- **House style:** navigation-hub galleries + daily-hub linked blocks hide the title — set `hide_inline_collection_name:true` on the BLOCK (pairs with `collection_peek_mode:"full_page"` on the views above).
- **`hide_linked_collection_name` hides only the gray *database* name; the *view* name still renders as the block's label** — a "This week" table view shows a "This week" pill even with the collection name hidden. Live-verified 2026-06-17 (an inline daily hub).
- **A linked/inline block ALWAYS shows its SOURCE-database name by default** — a gray **`↗ <DB name>`** heading above the tabs (the `↗` marks it a linked view). So a hub/section linked block needs **exactly ONE label**; pick one and suppress the rest:
  - a **section `heading`** above it (the house pattern for stacked daily sections) → then `hide_inline_collection_name:true` on the **block** is **REQUIRED, not taste** — skip it and you get a **redundant double-label** (the heading **plus** the `↗ <DB name>` line);
  - the **collection name** as the label → then add **no** heading;
  - **just the view-name pill** (name hidden, no heading) → the leanest hub look (`visual-design.md` §5).
- **⚠️ Before adding a heading to a linked block, confirm it's genuinely unlabeled** (the sibling of the width caveat below) — a `collection_view` block's own title field can read empty even while the live block still shows a label (the source-DB name, `↗ <DB name>`, or a view-name pill if hidden). **Check the source DB's name (`read_database`/`describe`) or the live UI before inferring "no label → add a heading"** — an empty title field is NOT proof the block appears unlabeled. Mis-reading it that way is the #1 cause of an accidental redundant heading. Live-verified 2026-06-23 — a hub's linked log block had an empty own-title while the live UI showed `↗ <DB name>`; a heading added on the false "unlabeled" inference produced a double-label until the name was hidden.

**View icon — the switcher-TAB icon (`collection_view_icon`, PRIVATE-only).** The icon on a view's tab (left of the view name) is **not** in the public API — `PATCH /v1/views/{id}` with an `icon` returns `200` but silently DROPS it (the returned view has no `icon` field). It's a private `format` string on the `collection_view`, set exactly like peek mode / hide-name:
```jsonc
private_request({ endpoint: "saveTransactions", operations: [
  { pointer: {table:"collection_view", id:"<view_id>", spaceId:"<space>"},
    command: "set", path: ["format","collection_view_icon"], args: "/icons/<name>_gray.svg" },
  { pointer: {table:"collection", id:"<any data source in the space>", spaceId:"<space>"}, path:[], command:"update",
    args: {last_edited_by_id:"<activeUser>", last_edited_by_table:"notion_user"} } ]})
```
- **Value is a STRING:** a Notion named-icon path `"/icons/<name>_<color>.svg"` (same catalog as page/column icons — `icon-names.md`), an emoji char, or an absolute image URL. House style → a **gray named icon** (`/icons/<name>_gray.svg`).
- **One per VIEW** — each tab carries its own; without it the tab shows the generic view-TYPE glyph (the table/gallery icon). Read back via `getRecordValues` on the `collection_view` → `format.collection_view_icon`; the `200 {}` write doesn't prove it rendered — verify (read-back / UI).
- **House style — EVERY view gets an icon** (a per-view design dimension, sibling to the column-icon rule): a nav-hub view = the hub's own icon (`navigation`); time-bucket / dashboard tabs get a semantic gray icon (Today `calendar-day`, Tomorrow `arrow-right`, Next 7 days `fast-forward`, Last 7 days `history`). Live-verified 2026-06-19 (field confirmed from yowynn/notion types + two captured recordMaps; confirmed rendering in-workspace).

**View `type` is immutable.** You can't change a view's type via `PATCH` — `PATCH /v1/views/{id} {"configuration":{"type":"gallery",…}}` on a table view → `400 "Configuration type \"gallery\" does not match view type \"table\""`. To "convert" a table to a gallery (or any type change), **`POST` a NEW view** of the target type (`position:{type:"start"}` makes it the default tab) then DELETE /v1/views/{old view id} so the new type is the sole/default view — or, if you want both tabs to coexist, rename the old one instead. Live-verified 2026-06-14.

**Curate a table view's columns — visibility + order + width are ONE spec, set in ONE `properties` PATCH (REPLACE, not merge).** **Fetch the view's current full config FIRST** — `read_database(…, views:'full')` (or `GET /v1/views/{id}`) — you need every existing property's visibility/width to build the replacement array. ⚠️ Whatever array you send becomes the COMPLETE visible set: every property you OMIT auto-reverts to `visible:false`. So a "hide one column" PATCH that lists only that one property **blanks the whole table** (every other column disappears). ALWAYS send the FULL set you want VISIBLE — each `visible:true`, in left-to-right order, **and each carrying a `width` sized to fit its header** (mandatory, not optional polish — see *Column width* below; omit the widths and every column falls back to the ~200 px default, producing a sprawling, ragged table that overflows its container) — and omit the rest (they hide themselves). Only `properties` is replaced; sibling `configuration` keys (`frozen_column_index`, `subtasks`, `group_by`) are preserved. Live-verified 2026-06-19 (a one-property PATCH hid all 14 other columns).
```json
PATCH /v1/views/{id}
{ "configuration": { "type": "table", "properties": [
    { "property_id": "<id A>", "visible": true, "width": 220 },
    { "property_id": "<id B>", "visible": true, "width": 120 }
] } }   // → A then B visible; EVERY other column auto-hidden
```

**Hide a property from the ROW-DETAIL PANEL (what you see when you OPEN a row) — `property_visibility` (PRIVATE, on the COLLECTION).** ⚠️ Three "visibility" knobs are easy to confuse — pick the right one:
- a **view's** columns → `configuration.properties[].visible` (per-view, public — above);
- `upsert_property.visible` → the property's **new-view / card default** (`collection_page_properties`) — does NOT touch the row-detail panel;
- the **row-detail panel** (the Order/Description rows shown when you OPEN a page) → the COLLECTION's `format.property_visibility` — an array of `{ "property":"<id>", "visibility":"show" | "hide" }` (a property omitted from the array shows by default).

Set it via private `saveTransactions` on the `collection` (its id == the data_source id):
```jsonc
private_request({ endpoint: "saveTransactions", operations: [
  { pointer: {table:"collection", id:"<ds id>", spaceId:"<space>"},
    command: "set", path: ["format","property_visibility"],
    args: [ {property:"<prop id>", visibility:"hide"}, {property:"<keep>", visibility:"show"} ] },
  { pointer: {table:"collection", id:"<ds id>", spaceId:"<space>"}, path:[], command:"update",
    args: {last_edited_by_id:"<activeUser>", last_edited_by_table:"notion_user"} } ]})
```
Read back via `getRecordValues` on the `collection` → `format.property_visibility`; the `200 {}` write doesn't prove it rendered — verify in the UI. Live-verified 2026-06-19 (hid a nav-hub `Order` from the row-detail panel; `upsert_property.visible:false` only set `collection_page_properties` and did NOT hide it — the original wrong guess).

**Reorder columns** — send the full `configuration.properties` array in the desired left-to-right order (same PATCH; include every property with its `visible`/`width`). **The title column IS reorderable** — placing the `title` entry mid-array renders it there (live-verified 2026-06-14: a log DB title column repositioned mid-array, after another property); it is NOT pinned first as older Notion behaved. (`order_properties` does this across views — list `title` in `order` to move it.)

**Column width (table views) — set it on EVERY visible column of a curating PATCH; it is part of the column spec, never optional polish.** `configuration.properties[].width` is an **integer in PIXELS** — table views only (gallery/board accept it but ignore it, `gallery-view.md`). No documented max; **default ≈ 200** when unset. API-set widths render AS-SET — the UI's ~100 px drag-resize minimum does NOT clamp them — so a too-small width truncates the **HEADER** (type-icon + label + sort caret), e.g. `Last edited` at width 110 renders `Last edit…`. Budget by the longer of header-vs-content: a short label + 1–2-digit number ≈ 90–110; a date (`June 19, 2026`) ≈ 140; a title / long relation ≈ 220–320. Set width in the SAME full-`properties` PATCH as visibility + order (one array, one call — see the replace-not-merge rule above). Siblings in `configuration`: **`frozen_column_index`** (int — freeze the first N columns from the left; `-1` = none) and **`wrap_cells`** (bool). Live-verified 2026-06-19. ⚠️ **Verify a width via the view's `configuration.properties[].width` read-back** (or a UI glance) — don't assume a PATCH took effect as intended.
⚠️ **A freshly API-built DB's default view often renders with ALL columns hidden.** After `POST /v1/databases` + PATCH-adding properties (relations/formulas/rollups) + `order_properties`, the default view's `configuration.properties` can come back all `visible:false` — a blank table. **Always explicitly PATCH each view's full visible-column list** (list the ones you want `visible:true` first, then the rest `false`) — don't assume new properties show. Live-verified 2026-06-14.
Property IDs come from `GET /v1/data_sources/{id}` → `properties.<name>.id`. (For column **names** alone, `read_database` output is enough — drop to the schema GET only when a raw **id** is needed for the PATCH body.) May be URL-encoded → `urllib.parse.unquote()`.

**Sort a view** (`sorts` is a **top-level view field**, NOT inside `configuration` — table, gallery, board, list, …):
```json
PATCH /v1/views/{id}
{ "sorts": [ { "property": "<PROPERTY NAME>", "direction": "ascending" | "descending" } ] }
```
- Send the property **name**, not the id — the API normalizes it and **stores the `property_id`**, so a later GET shows `"property": "<id>"` (e.g. you send `"Date"`, GET returns `"<propId>"`). Live-verified 2026-03-11.
- **Property-based only** (no `timestamp` sorts on views). When multiple sorts are given, the first in the array wins ties. `"sorts": null` clears all sorts.
- Combine with `configuration`, `filter`, `name` in the **same** PATCH — only provided fields change. (This is how a gallery gets both its look and its order in one call — see `gallery-view.md`.)

### Filter a view

`filter` is a top-level PATCH field; full replacement; **same condition schema as a `POST /v1/data_sources/{id}/query` filter**. Compose with `and` / `or`.

**Date conditions — the COMPLETE set** (a wrong condition 400s with this list): `equals` · `before` · `after` · `on_or_before` · `on_or_after` (each takes an ISO-8601 string **or** a relative string) · `is_empty` · `is_not_empty` · and the empty-object windows `past_week` / `past_month` / `past_year`, `next_week` / `next_month` / `next_year`, and **`this_week`**.
- **Relative date STRINGS** (the only ones — used with equals/before/after/on_or_before/on_or_after): `"today"`, `"tomorrow"`, `"yesterday"`, `"one_week_ago"`, `"one_week_from_now"`, `"one_month_ago"`, `"one_month_from_now"`.
- ⚠️ **Relative dates resolve in the VIEWER's timezone — and any API-side read resolves them in UTC, so it can be a day off.** The live Notion UI evaluates `"today"`/`"tomorrow"` (and the date-group buckets) against the **account's timezone**; API-side relative-date evaluation (`read_database`, `request`) uses **UTC / server time**. During the offset window (e.g. evening in UTC−3, already next-day UTC) they disagree by a full calendar day. Consequences: (1) a row meant for the *user's* tomorrow must be dated the **user's local tomorrow**, not UTC's; (2) **do NOT trust a UTC-evaluated read to verify a relative-date-filtered view** — it'll bucket rows a day off and show the wrong "Today/Tomorrow." Set dates from the user's local date and confirm in their UI. Live-verified 2026-06-18 (a "Tomorrow" plan read back empty because the rows sat on the user's tomorrow while UTC had already rolled over).
- ⚠️ **There is NO `this_month` / `this_year` / `last_month`** — only `this_week`. Don't invent them; they `400`.

**Filtering a ROLLUP** wraps the inner filter in `rollup` (a bare `date`/`number` 400s: *"property type … rollup does not match filter date"*). For a single-value date rollup (`latest_date`/`earliest_date`):
```json
{ "property": "Month date", "rollup": { "date": { "after": "one_month_ago" } } }
```
There is **no `condition` key** — just `rollup: { date: {…} }`. (Multi-value rollups use `rollup: { any|every|none: {…} }`.)

⚠️ **Formula filterability depends on WHERE the formula was created** (forensically isolated 2026-06-11, same workspace, same `Notion-Version: 2026-03-11`):
- **UI-created formulas filter fine** — `formula: { string | checkbox | number | date: {…} }` (note: `boolean` is NOT a valid sub-key — the schema dump lists exactly those four). Live-verified `200` on a number formula and a string formula from a UI-built database.
- **API-created (or API-rewritten) formulas are NOT filterable** → `400 Unable to filter based on a formula of unknown type`. The public API write path stores the `expression` but never compiles the result-type metadata the filter layer reads. Live-verified identical 400 on a plain boolean (`prop("Value") > 1000`, no rollup), a rollup-derived boolean, and a number formula — across `2022-06-28`/`2025-09-03`/`2026-03-11` via `data_sources/{id}/query` (the legacy `POST /v1/databases/{id}/query` was **removed** on `2026-03-11` → `400 Invalid request URL`); rewriting via the legacy `PATCH /v1/databases/{id}` does NOT repair it. (The error is about the formula's missing compiled type, NOT about rollup-derivation, and NOT about all formulas.)
- **Consequences:** in an **API-built** database, never design a filter around a formula (e.g. an `Is current month` boolean) — **filter the underlying property instead** (e.g. the `Month date` rollup directly). Conversely, do **not** rewrite a UI-created formula via the API if any view/query filters on it — the API rewrite is presumed to strip the compiled type and break those filters (untested — treat as breaking until verified). A UI re-save may recompile/repair an API-created formula (untested — do not rely on it).
- **Second cause of the same 400 — type-ambiguous formulas (hits UI-created ones too):** branches returning different types (`if(prop("Due"), dateAdd(prop("Due"),1,"days"), "")` → date branch + string branch) make the result type unresolvable. Fix per Notion's own help ("Common formula errors"): make every branch one type — use **`empty()`**, not `""`/`null`, for the no-value branch. So when "unknown type" hits a UI-created formula, check for mixed branches before blaming anything else.
- The schema never exposes a formula's resolved type (only `expression`) — to learn it, read a row's value: `page.properties[name].formula.type`.
- Formulas (including rollup-derived ones) always work for *computing* and for feeding rollups — only their *filterability* depends on creation path and type-resolvability.

**✅ API-only workaround — wrap the formula in a function-typed ROLLUP and filter that** (live-verified 2026-06-11 for boolean, number, and date formulas; a rollup's filter type comes from its *function*, so the unfilterable formula underneath stops mattering):
1. **Relation:** reuse an existing relation that points at the rows (e.g. a `sum` rollup over a formula on a related DB filters fine), or add a **`Self` relation** on the same data source — `PATCH /v1/data_sources/{id}  {"properties": {"Self": {"relation": {"data_source_id": "<this ds>", "type": "single_property", "single_property": {}}}}}` (the outer `{"properties": {…}}` envelope AND the `type` discriminant are both required — see `pages-properties.md`) — and self-link each row: `PATCH /v1/pages/{row} {"properties": {"Self": {"relation": [{"id": "<row's own id>"}]}}}`. (New rows need the self-link → create row, then patch — fold into the row-creation routine.)
2. **Rollup over the formula** — pick the function by the formula's type: boolean → `checked` · number → `sum` (or `max`) · date → `latest_date`.
3. **Filter the rollup:** boolean → `{"property": "<rollup>", "rollup": {"number": {"greater_than": 0}}}` (`checked` returns a COUNT — a number — so the filter type is `number`, not `checkbox`) · number → `rollup.number` conditions · date → `rollup.date` conditions (incl. relative strings).

Pitfalls (all live-verified): **create the rollup in a SEPARATE PATCH after the formula + relation exist** — defining them in one PATCH fails (`Invalid rollup schema … Cannot create rollup with rollup property`). `show_original` + `any.checkbox` returns 200 but matches nothing — the `any`/`every`/`none` inner vocabulary has **no `formula` member**, so element-wise filters never match formula values; only function-typed rollups work. **Strings have no typed rollup function** — reshape the formula to emit a boolean/number instead. A schema-write `result_type` hint is silently dropped (useless). Formulas that *reference* rollups (e.g. `Real Value = Value × USD-Rate-rollup`) wrap fine — the no-rollup-of-rollup rule only blocks rolling up a related *rollup property* directly.

**Exact "current calendar month", dynamic, NO month-rollover fuzz** (data dated on the 1st of each month):
```json
{ "and": [
  { "property": "Month date", "rollup": { "date": { "after":        "one_month_ago" } } },
  { "property": "Month date", "rollup": { "date": { "on_or_before":  "today"         } } }
] }
```
`past_month` is a rolling ~30-day window, so on the 1st–2nd of a new month it still contains the previous month's 1st → two months show. The **strict `after "one_month_ago"`** drops the previous month's 1st even on day 1 (calendar-aware anchor + `>`), so it's exact every day; `on_or_before "today"` excludes any future-dated month. Live-verified 2026-06-11.

⚠️ **The UI's relative filters ("This month", "Last month", "This year", …) are UI-ONLY — invisible to the public API.** They live in the view's internal `format.property_filters` (private app API: `date_is_relative_to` / `{type:"relative", value:"surrounding", unit:"month"}`). `GET /v1/views/{id}` on a view that has a UI "This month" filter returns **only** the API-settable conditions (the UI relative filter is absent), and `PATCH` cannot set them. To reproduce "This month" via the API, use the `after one_month_ago` recipe above. Live-verified 2026-06-11.

