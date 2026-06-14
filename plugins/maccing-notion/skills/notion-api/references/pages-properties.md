# Pages, properties, icons & covers

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, approval gate before writes, tree view after structural changes, match-conventions) still apply to everything here.

**Reads:** prefer `read_page` / `read_database` (SKILL.md "MCP tools — pick by job") — they resolve relations→titles and flatten rollups/formulas to scalars. The raw shapes here are for **writes** and for processing a `request` response (e.g. a write's returned object).

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

// Multi-select with options (same color set as select)
{ "PropName": { "multi_select": { "options": [{ "name": "A", "color": "green" }] } } }

// Date
{ "PropName": { "date": {} } }

// Plain text · Checkbox · URL / Email / Phone
{ "PropName": { "rich_text": {} } }
{ "PropName": { "checkbox": {} } }
{ "PropName": { "url": {} } }          // also { "email": {} } · { "phone_number": {} }

// People · Files & media
{ "PropName": { "people": {} } }
{ "PropName": { "files": {} } }

// Auto-computed metadata (no value writes — Notion fills them)
{ "PropName": { "created_time": {} } }   // also created_by · last_edited_time · last_edited_by

// Status (auto-creates default options Not started · In progress · Done) · Unique ID (optional prefix)
{ "PropName": { "status": {} } }
{ "PropName": { "unique_id": {} } }      // or { "unique_id": { "prefix": "TASK" } }
```
- **`status` and `unique_id` columns ARE API-creatable** (live-verified 2026-06-14): `{"status":{}}` creates a status column auto-populated with Notion's default options/groups (**Not started · In progress · Done**) — add/rename options afterward via `PATCH /v1/data_sources/{id}`; `{"unique_id":{}}` (or `{"unique_id":{"prefix":"TASK"}}`) creates an auto-incrementing id column. Both their *values* read/write fine (shapes below).

---

## Reading property values from a raw `request` response (write-response / GET parsing)

> Only needed when parsing a raw `request` response. `read_page` / `read_database` already resolve relations to titles and flatten rollups/formulas to scalars — no manual traversal.

```python
row["properties"]["Title"]["title"][0]["plain_text"]         # title
row["properties"]["Num"]["number"]                           # number (may be null if upstream fields empty)
row["properties"]["Sel"]["select"]["name"]                   # select
row["properties"]["Date"]["date"]["start"]                   # date
row["properties"]["Rel"]["relation"]                         # list of {"id":"..."} — read_database resolves to title strings
row["properties"]["Rollup"]["rollup"]["number"]              # numeric rollup
row["properties"]["Rollup"]["rollup"]["date"]                # date rollup (has .start)
row["properties"]["Rollup"]["rollup"]["array"]               # array rollup
row["properties"]["Formula"]["formula"]["number"]            # number formula — may be null if upstream fields are empty
row["properties"]["Formula"]["formula"]["string"]            # string formula
row["properties"]["Text"]["rich_text"][0]["plain_text"]      # rich_text (array; "" when empty — see title gotcha below)
row["properties"]["Done"]["checkbox"]                        # checkbox → bool
row["properties"]["Tags"]["multi_select"]                    # list of {id,name,color}
row["properties"]["Link"]["url"]                             # url / email / phone_number → string (or null)
row["properties"]["Owner"]["people"]                         # list of user objects {id,name,...}
row["properties"]["Files"]["files"]                          # list of {name, external|file:{url}}
row["properties"]["Stage"]["status"]["name"]                 # status → option name (null if unset)
row["properties"]["ID"]["unique_id"]                         # {prefix, number} → render as f"{prefix}-{number}"
row["properties"]["Created"]["created_time"]                 # ISO string (also last_edited_time)
```

- ⚠️ **A `title` property stores its text under `.title`, NOT `.rich_text`.** A *generic* text-reader that only checks `.rich_text` (e.g. `p.rich_text?.map(t=>t.plain_text)`) silently returns `""` for a title — a classic **migration bug**: you read the source's Title/Name with a rich_text-only helper, get empty strings, and migrate blank titles/notes (no error). A reusable reader must coalesce both: `(p.rich_text ?? p.title ?? []).map(t => t.plain_text).join("")`. (Cost a full 1320-row re-run when missed.)
- `formula.number` may be `null` if upstream referenced fields are empty (e.g., missing number field → formula produces null instead of 0)
- Rollup `Show Original` outputs a **string** even when the target is a number property — the raw API preserves it as a string (verify `read_database`'s handling if numeric coercion matters)

---

## Databases

**Create a database** (inline or full-page) — `POST /v1/databases`; the schema goes under `initial_data_source.properties` (the 2025-09-03+ data-sources model). The response carries `data_sources:[{id,name}]` — grab `data_sources[0].id` for every later property PATCH. (Live-verified 2026-06-14.)
```json
POST /v1/databases
{
  "parent": { "type": "page_id", "page_id": "<page>" },
  "title": [{ "type": "text", "text": { "content": "Months" } }],
  "is_inline": true,
  "icon": { "type": "icon", "icon": { "name": "calendar-month", "color": "gray" } },
  "initial_data_source": { "properties": {
    "Month": { "title": {} },
    "Date":  { "date": {} }
  } }
}
```
- **Database DESCRIPTION is set on the database, NOT the data source:** `PATCH /v1/databases/{database_id} {"description":[{"type":"text","text":{"content":"…"}}]}`. A `description` on `PATCH /v1/data_sources/{id}` returns `400 "The description property is not supported for data sources. Use the Update Database API instead."`
- **Inline DBs append to the page END** — you can't position one before existing blocks via the API; create them in the desired top-to-bottom order (see `blocks.md`).
- **`select`/`multi_select` option colors** — valid: `default`, `gray`, `brown`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `red`. ⚠️ **No `lightgray`** (a 400 lists the valid set) — `lightgray` is valid only for **named icons** (`icon-names.md`), easy to conflate. Use `default` for the lightest select chip.

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

// More property VALUE shapes (POST/PATCH /v1/pages → properties)
// "Text": { "rich_text": [{ "type":"text", "text": { "content":"..." } }] }
// "Done": { "checkbox": true }                                  // boolean, not "true"
// "Tags": { "multi_select": [{ "name":"A" }, { "name":"B" }] }   // array of objects, not strings
// "Link": { "url": "https://..." }                              // email→{"email":".."} · phone→{"phone_number":".."}
// "Owner":{ "people": [{ "id":"<user_id>" }] }                  // user IDs, not emails — resolve via GET /v1/users
// "Files":{ "files": [{ "name":"doc.pdf", "external": { "url":"https://..." } }] }
// "Stage":{ "status": { "name":"In progress" } }                // the option must already exist in the column

// Trash a page
PATCH /v1/pages/{id}   body: { "in_trash": true }

// Remove icon
PATCH /v1/pages/{id}   body: { "icon": null }

// Move (re-parent) a page
POST /v1/pages/{id}/move   body: { "parent": { "type": "page_id", "page_id": "<new_parent_id>" } }
```

**Position values for `POST /v1/pages`** (all object shapes, like the create example above): `{ "type": "page_start" }` | `{ "type": "page_end" }` | `{ "type": "after_block", "after_block": { "id": "<block_id>" } }`

**Rich text write gotchas:**
- `title` is an array, not a string
- `multi_select` requires array of objects `[{"name":"A"}]`, not strings
- `select` and `multi_select` auto-create options by name if they don't exist in the schema — no pre-flight schema write needed
- `people` property uses user IDs, not email addresses
- `date` requires `{"start":"YYYY-MM-DD"}` object, not a plain string
- `checkbox` must be boolean `true`/`false`, not the string `"true"`

---

## Icons, emoji & covers

> **STOP — two different things, don't conflate them:**
> - **Page & database icons** (the icon on a page or on a database itself) → set via the **public API** (`PATCH /v1/pages` / `/v1/databases`) — the table just below.
> - **Database PROPERTY / COLUMN icons** (the little icon next to a *column's* name) → the **public API silently drops these**, BUT they **ARE settable** via the private app API: use the **`upsert_property`** MCP tool (its `icon` field) — **see [`private-api.md`](private-api.md)**. ⚠️ Property/column icons are a common false-negative: **never tell the user they're "UI-only" or "impossible via the API"** — they're not. Route to `private-api.md`.

The `icon` field (for **pages & databases**) is supported via PATCH `/v1/pages` / PATCH `/v1/databases`. Six types:

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

**Property/column icon mechanism** (the STOP callout above has the routing): writing an `icon` key inside a property definition (via `PATCH /v1/data_sources/{id}` or on `POST /v1/databases` at creation) returns `200` but is **silently dropped**; property objects never expose `icon` on read. Public-API-only fallback (no private creds): put an emoji in the property **name**. (Page & database icons themselves DO work via the public API — see the table above; this limit is specific to property/column icons.)

**Custom emoji list** — `GET /v1/custom_emojis`; each object: `id`, `name`, `url`. Cursor-paginated; optional `?name=` for exact-match filtering.

**Covers** — the `cover` field accepts only `external` or `file_upload` types; `emoji` and `icon` types are rejected. Remove with `cover: null`. Notion's built-in gradient covers have no distinct API type — pass their `https://www.notion.so/images/page-cover/…` URL as `external`.

Match the workspace's existing icon style (often Notion named icons like `cash`, `chart-mixed`) per the conventions rule.

