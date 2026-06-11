# Views API — listing, creating, linked views, columns

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, approval gate before writes, tree view after structural changes, match-conventions) still apply to everything here.

## Views API

```
GET    /v1/views?data_source_id={ds}   # list views — returns MINIMAL objects (id, type, created_time) only
GET    /v1/views/{view_id}             # full detail incl. name + configuration — call individually per view
POST   /v1/views                       # create view
PATCH  /v1/views/{view_id}            # update view
DELETE /v1/views/{view_id}            # delete view
```

**INVALID**: `GET /v1/data_sources/{ds}/views` → 400

**Two-step pattern to list views with names:**
```python
# Step 1: list (minimal)
views = GET /v1/views?data_source_id={ds}   # returns id, type, created_time only
# Step 2: fetch each for name + configuration
details = [GET /v1/views/{v['id']} for v in views['results']]
```

**Create a linked database view embedded in a page** (only API mechanism):
```json
POST /v1/views
{
  "data_source_id": "<ds_id>",
  "name": "Holdings",
  "type": "table",
  "create_database": {
    "parent": { "type": "page_id", "page_id": "<page_id>" },
    "position": { "type": "after_block", "after_block": { "id": "<block_id>" } }
  },
  "filter": { "property": "Active", "checkbox": { "equals": true } }
}
```
- `create_database.position` is optional; controls where the linked-DB block is inserted on the parent page

**View tab-bar positioning** (top-level field on `POST /v1/views`):
```json
{ "position": { "type": "start" } }
{ "position": { "type": "end" } }
{ "position": { "type": "after_view", "view_id": "<view_id>" } }
```

**Create a chart view:**
```json
POST /v1/views
{
  "data_source_id": "<ds_id>",
  "name": "Net Worth Over Time",
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
> Note: chart views do NOT take `database_id` as a top-level field alongside `data_source_id` — only one of `database_id`, `view_id`, or `create_database` may be used as a location param, and chart views use `data_source_id` alone.

**Number/KPI chart** uses `value: {aggregator, property_id}` instead of `x_axis`/`y_axis`.

Full aggregator vocabulary: `count`, `count_values`, `sum`, `average`, `median`, `min`, `max`, `range`, `unique`, `empty`, `not_empty`, `percent_empty`, `percent_not_empty`, `checked`, `unchecked`, `percent_checked`, `percent_unchecked`, `earliest_date`, `latest_date`, `date_range`

**Board view** requires `group_by` with `type` AND `sort`:
```json
{ "configuration": { "type": "board", "group_by": { "type": "select", "property_id": "...", "sort": { "type": "descending" } } } }
```

**Supported view types:** `table`, `board`, `list`, `calendar`, `timeline`, `gallery`, `chart`, `dashboard`, `map`, `form`

**Update view column visibility:**
```json
PATCH /v1/views/{id}
{ "configuration": { "type": "table", "properties": [{ "property_id": "<id>", "visible": false }] } }
```
Property IDs come from `GET /v1/data_sources/{id}` → `properties.<name>.id`. May be URL-encoded → `urllib.parse.unquote()`.

**Sort a view** (`sorts` is a **top-level view field**, NOT inside `configuration` — table, gallery, board, list, …):
```json
PATCH /v1/views/{id}
{ "sorts": [ { "property": "<PROPERTY NAME>", "direction": "ascending" | "descending" } ] }
```
- Send the property **name**, not the id — the API normalizes it and **stores the `property_id`**, so a later GET shows `"property": "<id>"` (e.g. you send `"Date"`, GET returns `"S=Vn"`). Live-verified 2026-03-11.
- **Property-based only** (no `timestamp` sorts on views). When multiple sorts are given, the first in the array wins ties. `"sorts": null` clears all sorts.
- Combine with `configuration`, `filter`, `name` in the **same** PATCH — only provided fields change. (This is how a gallery gets both its look and its order in one call — see `references/gallery-view.md`.)

