# Gallery view — visual configuration

Part of the `notion` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules apply — in particular **MANDATORY — design every dimension of a view before creating it (no silent defaults)** (SKILL.md) — decide type / filter / sort / grouping / visible-props + cover / size / aspect / layout — then act directly and report; no approval gate. **For the design *taste* — which cover/size/icon, when a gallery beats a table, the KPI-tile pattern — see `visual-design.md`; this file is the API mechanics only.**

**Reads:** every `read_database(database_id, format)` call (`table`/`kv`/`tsv`/`summary`) dumps the gallery config (cover/preview, card size, aspect, layout, visible props, sorts, filters) in a trailing `# Views` section — full config with property ids resolved to names, no flag, every format. `read_database` also reads row values; `read_page(page_id, "outline")` reads the block tree. Schema/property-id lookup for PATCH bodies needs `GET /v1/data_sources/{id}`; but the Views section carries both `property_id` and resolved `property_name`, so you can often harvest the ids you need from there first.

> Requires `Notion-Version: 2026-03-11` (gallery configuration support added in the 2025-09-03 API release; `2026-03-11` is the active version to send).

⚠️ **Maturity:** the Views API is new (early 2026). **Live-verified 2026-03-11** (on a real gallery): the creation location rule, the minimal create, **`cover:{type:"page_cover"}`, `cover_size` (small/medium/large), `cover_aspect` (contain/cover), `properties[]` with `visible`, and top-level `sorts`** (top-level PATCH field, not inside `configuration`; see `views.md`) — all confirmed in one `PATCH`. Still **doc-sourced / not all live-verified**: `card_layout`, `cover` via `property`/`page_content`, and the per-property options (`wrap`, `date_format`, `card_property_width_mode`). For those, confirm with a test `PATCH` and treat `400 validation_error` as "that field/name is wrong." Flag uncertainty rather than asserting.

## Creating a gallery view on an EXISTING database (live-verified)

`POST /v1/views` needs a **location param** — exactly one of `database_id`, `view_id`, or `create_database`. For a view on an existing database, pass **`database_id`** (the container) *plus* `data_source_id` (which source). Passing `data_source_id` alone → `400 "Exactly one of database_id, view_id, or create_database must be provided."`

```json
// minimal — verified live
POST /v1/views
{
  "database_id":     "<database_id>",   // the container DB (NOT just the data source)
  "data_source_id":  "<ds_id>",
  "name":            "Gallery",          // name per the workspace's convention (infer from AGENTS.md); no emoji
  "type":            "gallery",
  "position":        { "type": "start" } // first tab = the default view
}
```

`position` (tab-bar): `{ "type": "start" }` | `{ "type": "end" }` | `{ "type": "after_view", "view_id": "<id>" }`.

⚠️ **A freshly-created gallery shows NO card covers by default** — the minimal create above leaves the card-preview source unset, so even rows that HAVE page covers render as coverless tiles. You must explicitly set **`configuration.cover = {type:"page_cover"}`** (+ `cover_size`/`cover_aspect`) — on create or a follow-up `PATCH`. Easy to forget right after creating the view; set it in the same step you give the rows their covers. (Live-verified 2026-06-18.)

> **A view's `type` is immutable via PATCH.** `PATCH /v1/views/{id} {type:"gallery"}` returns `200` but the view stays `table` (silent no-op); sending a gallery `configuration` onto a table view → `400 "Configuration type \"gallery\" does not match view type \"table\""`. To convert a table to a gallery: **create a fresh gallery view (above) then `DELETE /v1/views/{old view id}`** so the new one is the sole/default view. (Live-verified 2026-06-17.)

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
    "card_layout":  "list",       // doc-sourced: "list"=full cards, "compact"=condensed (verify via test PATCH)
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

> **`configuration.properties` is a FULL REPLACE, not a merge** — whatever array you send becomes the complete card-property spec. Any entry you omit auto-reverts to `visible:false`. Always send the complete desired array. (Analogous to the table-view column rule in `views.md`.)

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
- **The card's NAME *is* the `title` property's `visible` flag** (live-verified 2026-06-21). `title visible:false` **HIDES the card name ENTIRELY** — there is NO separate always-on card heading; the `title` line IS the card name, and there is no top-level `hide_name`. So any gallery whose cards must show **what each row IS** — KPI / stat-tiles (the metric name), navigation launchers — MUST keep **`title visible:true`**. Set it `false` ONLY for a purely-visual gallery where the cover image alone identifies the card. (An earlier version of this note wrongly claimed the heading survives `visible:false` — it does not.)
  - ⚠️ **A card's title visibility is not obvious from a glance** — verify the `title` entry's `visible` flag in the view's `properties[]` directly.
- `width` is accepted but has no visual effect in gallery (table-only). `status_show_as: "select" | "checkbox"` controls Status rendering.

### Response-only (never send in a request)
- `cover.type: "page_content_first"` — appears in GET; the request schema rejects it (`400`).
- `properties[*].property_name` — convenience field, read-only.

### Clearing
Any nullable field (`cover`, `cover_size`, `cover_aspect`, `card_layout`, `properties`) → `null` in a PATCH may reset to the Notion default (doc-sourced — verify; ⚠️ `properties: null` in particular could **clear all visibility rows** rather than restore defaults, so test before using it).

### UI-only (no API equivalent)
- **Cover image repositioning** (custom focal point on hover) — API controls source + aspect mode only.

---

**Design taste — which cover/size/icon, nav-vs-content sizing, never-ship-naked-cards, the KPI stat-tile pattern, and the Unsplash cover-sourcing loop — moved to `visual-design.md`.** This file stays the gallery API mechanics.
