# Gallery view — visual configuration

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules apply — in particular **MANDATORY — brainstorm the visual layout** (propose cover / size / aspect / layout / visible-props and get approval) *and* the standard approval gate, before any gallery write.

> Requires `Notion-Version: 2026-03-11` (gallery config minimum `2025-09-03`).

⚠️ **Maturity:** the Views API is new (early 2026). The **creation location rule and the minimal create below are live-verified**; the `configuration` visual fields (cover/size/aspect/layout/per-property options) are **doc-sourced, not all live-verified** — when using an unusual field, confirm with a test `PATCH` and treat a `400 validation_error` as "that field/name is wrong." Flag uncertainty rather than asserting.

## Creating a gallery view on an EXISTING database (live-verified)

`POST /v1/views` needs a **location param** — exactly one of `database_id`, `view_id`, or `create_database`. For a view on an existing database, pass **`database_id`** (the container) *plus* `data_source_id` (which source). Passing `data_source_id` alone → `400 "Exactly one of database_id, view_id, or create_database must be provided."`

```json
// minimal — verified live
POST /v1/views
{
  "database_id":     "<database_id>",   // the container DB (NOT just the data source)
  "data_source_id":  "<ds_id>",
  "name":            "Gallery",          // sentence case, no emoji (per conventions)
  "type":            "gallery",
  "position":        { "type": "start" } // first tab = the default view
}
```

`position` (tab-bar): `{ "type": "start" }` | `{ "type": "end" }` | `{ "type": "after_view", "view_id": "<id>" }`.

## Visual configuration (doc-sourced — verify unusual fields)

Set on create or `PATCH /v1/views/{id}` via `configuration`:

```json
{
  "configuration": {
    "type": "gallery",            // REQUIRED even in PATCH — discriminator
    "cover": {
      "type": "property",         // "page_cover" | "page_content" | "property"
      "property_id": "JKLM"       // only when type == "property" (a Files & media prop)
    },
    "cover_size":   "large",      // "small" | "medium" | "large"
    "cover_aspect": "cover",      // "contain" (Fit image ON) | "cover" (Fit image OFF / crop)
    "card_layout":  "list",       // "list" (full cards) | "compact" (condensed)
    "properties": [
      { "property_id": "title", "visible": true },
      { "property_id": "ABCD", "visible": true,
        "wrap": false,
        "date_format": "relative",                 // full|short|month_day_year|day_month_year|year_month_day|relative
        "time_format": "12_hour",                  // 12_hour|24_hour|hidden
        "card_property_width_mode": "full_line" },  // full_line|inline  (board-confirmed; gallery unverified)
      { "property_id": "EFGH", "visible": false }
    ]
  }
}
```

### UI label → API field

| Notion UI | API field |
|---|---|
| Card preview: Page cover | `cover.type: "page_cover"` |
| Card preview: Page content | `cover.type: "page_content"` |
| Card preview: a Files & media property | `cover.type: "property"` + `property_id` |
| Card preview: None | `cover: null` (PATCH only) |
| Card size: Small / Medium / Large | `cover_size` |
| Fit image: ON / OFF | `cover_aspect`: `contain` / `cover` |
| Card layout (compact toggle) | `card_layout`: `list` / `compact` |

### Property visibility & order
- **Array position IS the display order** — there is no separate `position` field on a property.
- Hide a property on cards: include it with `visible: false`.
- Hide the title (Name): include the `title` property with `visible: false` — there is no top-level `hide_name`.
- `width` is accepted but has no visual effect in gallery (table-only). `status_show_as: "select" | "checkbox"` controls Status rendering.

### Response-only (never send in a request)
- `cover.type: "page_content_first"` — appears in GET; the request schema rejects it (`400`).
- `properties[*].property_name` — convenience field, read-only.

### Clearing
Any nullable field (`cover`, `cover_size`, `cover_aspect`, `card_layout`, `properties`) → `null` in a PATCH resets to the Notion default.

### UI-only (no API equivalent)
- **Cover image repositioning** (custom focal point on hover) — API controls source + aspect mode only.
- Property-id lookup: `GET /v1/data_sources/{id}` → `properties.<name>.id` (URL-decode if needed).
