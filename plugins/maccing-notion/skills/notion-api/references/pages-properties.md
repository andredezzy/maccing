# Pages, properties, icons & covers

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, approval gate before writes, tree view after structural changes, match-conventions) still apply to everything here.

## Property creation shapes

```json
// Number
{ "PropName": { "number": { "format": "real" } } }

// Formula
{ "PropName": { "formula": { "expression": "prop(\"Foo\") + prop(\"Bar\")" } } }

// Rollup
{ "PropName": { "rollup": { "relation_property_name": "RelProp", "rollup_property_name": "TargetProp", "function": "sum" } } }

// Relation (dual / two-way)
{ "PropName": { "relation": { "data_source_id": "<target_ds_id>", "type": "dual_property", "dual_property": {} } } }

// Relation (single)
{ "PropName": { "relation": { "data_source_id": "<target_ds_id>", "type": "single_property", "single_property": {} } } }

// Select with options
{ "PropName": { "select": { "options": [{ "name": "A", "color": "blue" }] } } }

// Date
{ "PropName": { "date": {} } }
```

---

## Reading property values from query results

```python
row["properties"]["Title"]["title"][0]["plain_text"]         # title
row["properties"]["Num"]["number"]                           # number (may be null if upstream fields empty)
row["properties"]["Sel"]["select"]["name"]                   # select
row["properties"]["Date"]["date"]["start"]                   # date
row["properties"]["Rel"]["relation"]                         # list of {"id":"..."}
row["properties"]["Rollup"]["rollup"]["number"]              # numeric rollup
row["properties"]["Rollup"]["rollup"]["date"]                # date rollup (has .start)
row["properties"]["Rollup"]["rollup"]["array"]               # array rollup
row["properties"]["Formula"]["formula"]["number"]            # number formula — may be null if upstream fields are empty
row["properties"]["Formula"]["formula"]["string"]            # string formula
```

- `formula.number` may be `null` if upstream referenced fields are empty (e.g., missing number field → formula produces null instead of 0)
- Rollup `Show Original` setting always outputs a **string** type even when targeting a number property

---

## Pages

```json
// Create page
POST /v1/pages
{
  "parent": { "type": "page_id", "page_id": "..." },
  "icon": { "type": "emoji", "emoji": "📊" },
  "cover": { "type": "external", "external": { "url": "https://www.notion.so/images/page-cover/gradients_3.png" } },
  "properties": { "title": { "title": [{ "type": "text", "text": { "content": "My Page" } }] } },
  "position": { "type": "page_start" }
}

// Create DB row
POST /v1/pages
{
  "parent": { "type": "data_source_id", "data_source_id": "..." },
  "properties": {
    "Name":     { "title": [{ "type": "text", "text": { "content": "Row title" } }] },
    "Amount":   { "number": 42.5 },
    "Category": { "select": { "name": "Crypto" } },
    "Month":    { "relation": [{ "id": "<related_page_id>" }] }
  }
}

// Trash a page
PATCH /v1/pages/{id}   body: { "in_trash": true }

// Remove icon
PATCH /v1/pages/{id}   body: { "icon": null }
```

**Position values for `POST /v1/pages`:** `page_start`, `page_end`, or `{ "type": "after_block", "after_block": { "id": "<block_id>" } }`

**Rich text write gotchas:**
- `title` is an array, not a string
- `multi_select` requires array of objects `[{"name":"A"}]`, not strings
- `select` option must already exist in schema or the call fails
- `people` property uses user IDs, not email addresses
- `date` requires `{"start":"YYYY-MM-DD"}` object, not a plain string
- `checkbox` must be boolean `true`/`false`, not the string `"true"`

---

## Icons, emoji & covers

The `icon` field is supported on pages and databases (PATCH `/v1/pages`, PATCH `/v1/databases`). Six types:

| Type | JSON shape | Notes |
|---|---|---|
| `emoji` | `{"type":"emoji","emoji":"📊"}` | Any Unicode emoji; settable |
| `icon` | `{"type":"icon","icon":{"name":"cash","color":"gray"}}` | Notion built-in named icons; settable since Mar 25 2026. `name` required, `color` optional. Full name catalog → [`icon-names.md`](icon-names.md) (Notion's set is proprietary/unofficial — verify unusual names with a test PATCH) |
| `custom_emoji` | `{"type":"custom_emoji","custom_emoji":{"id":"<uuid>"}}` | Settable; list workspace set via `GET /v1/custom_emojis` (cursor-paginated, `?name=` exact filter, `page_size` ≤ 100) |
| `external` | `{"type":"external","external":{"url":"https://…"}}` | Settable; any public URL |
| `file_upload` | `{"type":"file_upload","file_upload":{"id":"<FileUpload id>"}}` | Requires `POST /v1/file_uploads` → upload binary → reference id once `status == "uploaded"`; PDFs not valid for page icons |
| `file` | *(read-only)* | Notion-hosted (UI-uploaded) — appears in GET responses only, cannot be set |

**Removal** — set `icon: null` to strip the icon entirely.

**Named-icon colors** — valid values: `gray`, `lightgray`, `brown`, `yellow`, `orange`, `green`, `blue`, `purple`, `pink`, `red`. `"default"` is not a valid value — omit `color` entirely to use the default appearance.

**Custom emoji list** — `GET /v1/custom_emojis`; each object: `id`, `name`, `url`. Cursor-paginated; optional `?name=` for exact-match filtering.

**Covers** — the `cover` field accepts only `external` or `file_upload` types; `emoji` and `icon` types are rejected. Remove with `cover: null`. Notion's built-in gradient covers have no distinct API type — pass their `https://www.notion.so/images/page-cover/…` URL as `external`.

Match the workspace's existing icon style (often Notion named icons like `cash`, `chart-mixed`) per the conventions rule.

