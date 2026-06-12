# Gallery view — visual configuration

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules apply — in particular **MANDATORY — brainstorm the view design** (propose type / filter / sort / grouping / visible-props + cover / size / aspect / layout and get approval) *and* the standard approval gate, before any gallery write.

**Reads:** to inspect the existing gallery config (cover/preview, card size, aspect, layout, visible props, sorts) use `read_database(database_id, format, include_views=true)` — full config with property ids resolved to names. `read_database` reads row values; `read_page(page_id, "outline")` reads the block tree. Schema/property-id lookup for PATCH bodies needs `GET /v1/data_sources/{id}`; but `include_views=true` output carries both `property_id` and resolved `property_name` in the view config, so you can often harvest the ids you need from there first.

> Requires `Notion-Version: 2026-03-11` (gallery config minimum `2025-09-03`).

⚠️ **Maturity:** the Views API is new (early 2026). **Live-verified 2026-03-11** (on a real gallery): the creation location rule, the minimal create, **`cover:{type:"page_cover"}`, `cover_size` (small/medium/large), `cover_aspect` (contain/cover), `properties[]` with `visible`, and top-level `sorts`** (top-level PATCH field, not inside `configuration`; see `views.md`) — all confirmed in one `PATCH`. Still **doc-sourced / not all live-verified**: `card_layout`, `cover` via `property`/`page_content`, and the per-property options (`wrap`, `date_format`, `card_property_width_mode`). For those, confirm with a test `PATCH` and treat `400 validation_error` as "that field/name is wrong." Flag uncertainty rather than asserting.

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
Any nullable field (`cover`, `cover_size`, `cover_aspect`, `card_layout`, `properties`) → `null` in a PATCH may reset to the Notion default (doc-sourced — verify; ⚠️ `properties: null` in particular could **clear all visibility rows** rather than restore defaults, so test before using it).

### UI-only (no API equivalent)
- **Cover image repositioning** (custom focal point on hover) — API controls source + aspect mode only.

## Sourcing cover images (when `cover:{type:"page_cover"}`)

Cards with `page_cover` are only as good as the page covers behind them. When the rows have no covers, sourcing them is a **visual choice → it belongs in the brainstorm gate** (SKILL.md "brainstorm the view design"): propose the theme, source candidates, **show them to the user**, and let them pick before any write.

**Brainstorm-the-images loop (live-verified, Unsplash):**
1. **Find real photos.** Unsplash sits behind a bot wall — do **not** scrape its search HTML and do **not** defeat the bot challenge. Instead `WebSearch` (e.g. `allowed_domains:["unsplash.com"]`) for the theme to get photo-**page** URLs, then `WebFetch` each page asking for "the exact `images.unsplash.com/photo-…` URL" — the og:image. Skip any that resolve only to `plus.unsplash.com` (premium → unusable).
2. **Build the URL** in the workspace's cover style, e.g. `…?ixlib=rb-4.1.0&q=85&fm=jpg&w=1200&crop=entropy&cs=srgb`. For **black-and-white**, append the imgix param **`&sat=-100`** (desaturates any colour photo — no need to find a B&W original).
3. **Verify before proposing — no broken covers.** `WebFetch` each URL and confirm a `200` with `content-type: image/*`; drop any that 4xx/5xx or redirect to `plus.unsplash.com`.
4. **Show the user.** Download each image locally (`curl -o`, or any fetch-to-file) and display it via the Read tool so they see the actual B&W result; give the page URL + photographer for attribution. **Flag thematic mismatches** (e.g. a "Bitcoin" chart photo landing on a non-crypto category) — surface it, offer a swap.
5. **Apply only after approval** — get each row's page id via `POST /v1/data_sources/{id}/query` (`.id` per result; the readers don't expose page ids), then `PATCH /v1/pages/{id}` `{ "cover": { "type":"external", "external": { "url":"<verified url>" } } }` per row, then point the gallery at them with `PATCH /v1/views/{view_id}` `{ "configuration": { "type": "gallery", "cover": { "type": "page_cover" } } }` (the `type: "gallery"` discriminator is required even in PATCH).

> Page covers take **external** URLs; the imgix params (`sat`, `w`, `crop`, …) are honoured by `images.unsplash.com`. Match the workspace's existing cover convention (house style) — colour vs B&W, Unsplash vs gradient — and flag-then-follow if the user asks for something different.
