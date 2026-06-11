---
name: notion-api
description: Use when working with the Notion API or MCP — building/editing databases, formulas, rollups, relations, views, charts, page blocks, or hitting Notion API errors. MANDATORY before any operation — read every ancestral AGENTS.md page from the workspace root down to the target.
---

> **Using Claude Code? Install the official Notion plugin for high-level workflows.**
> [`makenotion/claude-code-notion-plugin`](https://github.com/makenotion/claude-code-notion-plugin) bundles 4 skills + `/Notion:*` slash commands over the hosted MCP (`mcp.notion.com/mcp`, OAuth). **Recommend installing it and using it for:**
> - **Knowledge Capture** — saving notes/snippets/decisions into Notion
> - **Meeting Intelligence** — meeting notes, summaries, action items
> - **Research Documentation** — collecting and structuring research
> - **Spec-to-Implementation** — turning specs/docs into implementation tasks
>
> THIS skill is the complementary **low-level engineering reference** — the Notion API/formula/rollup/relation/view/chart/block details for building & editing databases programmatically (and debugging Notion API errors).

## MANDATORY FIRST STEP — read every ancestral `AGENTS.md`

This runs on **every** Notion task, before you read or write anything. Not optional, not situational, not skippable.

**Core principle:** `AGENTS.md` pages are nested agentic playbooks — the Notion analog of nested `AGENTS.md`/`CLAUDE.md` files. The author put instructions there *specifically so an agent would obey them before touching that subtree.* Skipping them means acting against explicit instructions you simply chose not to read.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law

```
NO READ OR WRITE ON ANY NOTION TARGET UNTIL EVERY ANCESTRAL AGENTS.md HAS BEEN READ AND OBEYED
```

If you have not walked root→target and read every `AGENTS.md` on the path **in this task**, you may not create, edit, move, delete, or draw conclusions from that target. No exceptions — not for "quick" one-field edits, not under time pressure, not when the user "just wants X changed."

### The Gate (run every time)

1. **Build the root→target chain** — climb `.parent` to the workspace:
   `GET /v1/pages/{id}` (or `/v1/databases/{id}`, `/v1/data_sources/{id}`) → read `.parent`, repeat until `type == "workspace"`:
   - `page_id` → that page
   - `block_id` → `GET /v1/blocks/{id}` → its parent
   - `data_source_id` / `database_id` → take `.parent.database_id`, `GET /v1/databases/{database_id}` → its parent (a DB's `AGENTS.md` lives on its **parent page**, beside the `child_database` block — not on the rows)
2. **At each page, top→down, find its `AGENTS.md`** — `GET /v1/blocks/{page_id}/children` (`page_size=100`, paginate on `start_cursor`) → match the block where `type == "child_page"` **and** `child_page.title == "AGENTS.md"`.
3. **Read & obey, top→down** — `GET /v1/blocks/{agents_id}/children` (recurse into toggles/sub-blocks), render to text, follow it. On conflict the lower (closer-to-target) `AGENTS.md` wins.
4. **Only then** perform the requested operation.

*No id yet?* Descend instead: `POST /v1/search {"filter":{"property":"object","value":"page"}}` → first level = results with `parent.type == "workspace"`; walk down through `child_page` blocks to the target, reading `AGENTS.md` at each step.

**Fail closed:** if any node's children can't be listed, STOP and say so. Never operate blind.

### Red Flags — STOP, you're rationalizing

| Thought | Reality |
|---|---|
| "It's just a one-field edit" | The `AGENTS.md` exists *for* edits like this. Read it. |
| "I already read it earlier / last session" | Re-read it this task — playbooks change, context resets. |
| "The user handed me the page id, so I'll go straight in" | An id is a destination, not permission to skip the path. |
| "This page probably has no AGENTS.md" | "Probably" is not "checked." List the children. |
| "I'm only reading, not writing" | Reading without the playbook yields wrong conclusions. Sweep first. |
| "The user is in a hurry" | The sweep is a handful of GETs. Skipping it is what causes rework. |
| "I'll read it after I make the change" | After is too late — the instruction may forbid the change. |

### The Bottom Line

Walk the tree. Read every `AGENTS.md` from root to target. Obey the closest one on conflict. **Only then** act. This is non-negotiable.

## MANDATORY — exhaust every paginated list (never act on a partial set)

This runs on **every** list-shaped response. Notion caps every list. A reply with `has_more: true` is a **fragment, not the data** — counting it, summing it, reporting "your X is X", or concluding "none found" off a fragment produces a confidently-wrong number. Acting on page 1 is the most common way to silently corrupt a total.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law

```
WHILE has_more == true, KEEP FETCHING WITH next_cursor — NO COUNT, SUM, FILTER, OR CONCLUSION ON A LIST UNTIL has_more == false
```

No exceptions — not for "just counting", not for "just a summary", not when "100 rows is surely all of it", not when an unrelated cross-check happened to match.

### The loop (run for every list endpoint)

```python
results, cursor = [], None
while True:
    page = POST /v1/data_sources/{id}/query   # body: {page_size:100, start_cursor:cursor, ...filter/sorts}
    results += page["results"]
    if not page["has_more"]:
        break
    cursor = page["next_cursor"]              # feed back as the next start_cursor
# ONLY NOW: len(results), sums, "none found", any conclusion
```

- **Cursor placement differs by verb:** `POST .../query` and `POST /v1/search` take `start_cursor` in the **body**; `GET /v1/blocks/{id}/children` and `GET /v1/views?data_source_id=` take `start_cursor` in the **query string**. `page_size` max 100 — a full 100-row page almost always means `has_more: true`.
- **Every list-shaped response carries its own `has_more`/`next_cursor` — all are covered:**
  - `POST /v1/data_sources/{id}/query` — rows
  - `GET /v1/blocks/{id}/children` — page/block content, **including the `AGENTS.md` sweep above** (a dropped cursor can hide an `AGENTS.md` on a long page → you skip a playbook you were required to obey)
  - `POST /v1/search` — hits
  - `GET /v1/views?data_source_id=` — views
- **Relation values paginate too (the sneaky one):** a row's `properties.<Rel>.relation` array is itself capped (~25) and carries its OWN `has_more: true`. The query cursor does **not** expand it — you must call `GET /v1/pages/{page_id}/properties/{property_id}` and paginate THAT to the end. A relation that "only has 25 items" is the tell that you're holding a fragment.

### Red Flags — STOP, you're rationalizing

| Thought | Reality |
|---|---|
| "100 rows is surely all of them" | `page_size` max is 100 — a full page almost always means more. Check `has_more`. |
| "The first page is enough for a summary" | A summary off a fragment is a wrong number stated confidently. |
| "The totals happened to match, so I'm fine" | Matching one cross-check ≠ complete. Loop to `has_more: false` anyway. |
| "It's just to count / check if any exist" | Count and existence are exactly what truncation corrupts. |
| "The relation shows 25 — that's the list" | 25 is the relation page cap. Fetch `/properties/{id}` to the end. |
| "I'll note it's partial and move on" | A flagged wrong number is still a wrong number. Fetch the rest, then answer. |

### The Bottom Line

`has_more: true` means you do not yet have the data. Loop on `next_cursor` until it is `false` — for queries, block children, search, views, **and** relation values — *before* any count, sum, filter, or conclusion. Non-negotiable.

## MANDATORY — emit a tree view after every page-structure change

Any write that changes a page's **structure** — creating, moving (re-parenting), renaming, or trashing a child page, database, or content block — MUST be followed in your reply by a verified tree view of the affected page(s). The user reads the tree to confirm the new shape at a glance; skipping it hides what you changed.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law

```
NO STRUCTURE-CHANGING WRITE IS COMPLETE UNTIL YOU RE-READ THE PARENT'S CHILDREN (fully paginated) AND EMIT THE RESULTING TREE
```

### Format (exact)

- Re-read each affected page's children **after** the change (`GET /v1/blocks/{page_id}/children`, exhaust `has_more` per the pagination law) — the tree reflects VERIFIED live state, never your intention.
- Unicode tree: the parent page at the root, children indented with `├──` / `└──` and `│   ` continuation; recurse into changed sub-pages.
- Label by type: page → its title; database → its title; embed/media → a bracketed tag like `[notion2charts chart]`; text block → first words in quotes `"…"`.
- Annotate every node you changed this turn with a trailing `← what changed` (new / moved here / renamed from "…" / trashed). Leave untouched nodes unannotated.

```
Investments
├── Net worth                    ← renamed from "Net worth v2 (rebuild — parallel test)"
└── Net worth (pre-v2 backup)    ← new backup page
    ├── "Archived pre-v2 net-worth tracker…"
    ├── Net worth (old — pre-v2)  ← moved here (data + relations intact, inline)
    └── [notion2charts chart]
```

### The Bottom Line

Change a page's shape → re-read it (fully paginated) → draw the tree, marking what moved / renamed / created / trashed. Every structural change, every time. Non-negotiable.

## Data model & versions

- API base: `https://api.notion.com/v1` — header `Notion-Version: 2026-03-11`
- SDK: TypeScript SDK v5.12.0+ required for 2026-03-11 support
- Databases are queried/mutated via `/v1/data_sources/{id}` (not `/databases/{id}`)
- `POST /v1/databases` response → use `data_sources[0]['id']` as the data source ID; `is_inline: true` supported at creation
- Inline DB IDs (from block children) ARE valid `data_source_id` values but NOT valid `page_id` for `GET /pages/{id}`
- Search API: `filter.value` accepts `'page'` or `'data_source'` — **not** `'database'` (breaking change in 2025-09-03)

**Version 2026-03-11 breaking changes** (requires SDK v5.12.0+):
1. Append-block `after` param → `position` object (see Blocks section)
2. `archived` field renamed to `in_trash` everywhere
3. `transcription` block type renamed to `meeting_notes`

---

## Auth / MCP pattern

- MCP tool: `notion_request` — pass `method`, `path`, `body`
- Large results (>~80k chars) overflow MCP token limit → saved to `~/.claude/projects/.../tool-results/mcp-notion-*.txt`
- Rate limit: HTTP 429/502/503 → exponential backoff `1.2*(attempt+1)s`, up to 5 retries
- Safe inter-request pace: `time.sleep(0.03)` in loops
- **Hosted MCP** (`mcp.notion.com/mcp`): 180 req/min general, 30 req/min search; provides `notion-search`, `notion-fetch`, `notion-create-pages`, `notion-update-page`, `notion-move-pages`, `notion-duplicate-page`, `notion-create-database`, `notion-update-data-source`, `notion-create-view`, `notion-update-view`, `notion-query-data-sources` (Enterprise+AI), `notion-query-database-view` (Business+), `notion-create-comment`, `notion-get-comments`, `notion-get-teams`, `notion-get-users`, `notion-get-user`, `notion-get-self`
- **Verify token on first use**: `GET /v1/users/me` → 401 = invalid token; 403/404 = token valid but content not shared with integration

**Permission model — two layers required:**
1. Integration capability scopes (read/write/delete declared in integration settings)
2. User explicitly shares page/database with the integration via `...` > Connections menu

---

## Core endpoints

```
GET    /v1/data_sources/{id}              # DB schema (properties map with ids + types)
PATCH  /v1/data_sources/{id}             # add/modify/delete/rename properties
POST   /v1/data_sources/{id}/query       # query rows; body: {page_size,filter,sorts,start_cursor}
GET    /v1/pages/{id}                    # page metadata + properties
PATCH  /v1/pages/{id}                    # update page properties / icon / cover / in_trash
POST   /v1/pages                         # create page or DB row
GET    /v1/pages/{id}/markdown           # retrieve page content as Notion-flavored Markdown
PATCH  /v1/pages/{id}/markdown           # update page content via Markdown
POST   /v1/databases                     # create database
GET    /v1/blocks/{id}/children          # child blocks
PATCH  /v1/blocks/{id}/children         # append children (append-only)
DELETE /v1/blocks/{id}                   # delete a content block
```

Paginate queries: **mandatory** — loop on `next_cursor` until `has_more == false` before counting/summing/concluding (see [MANDATORY — exhaust every paginated list](#mandatory--exhaust-every-paginated-list-never-act-on-a-partial-set)). `page_size` max 100.

Add/modify/delete properties in one PATCH:
```json
{
  "properties": {
    "NewProp":     { "number": { "format": "real" } },
    "RenamedProp": { "name": "Better Name" },
    "DeadProp":    null
  }
}
```

**Payload size constraints:**
- 500KB max per request
- 100 blocks per append request
- 2,000 chars per rich text element
- 100 items per relation property per PATCH
- 100 multi-select options
- Database schema max 500 properties or 50KB

---

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

## Notion-flavored Markdown API

Most token-efficient content creation method for agents.

```
POST /v1/pages          # 'markdown' param (mutually exclusive with 'children'/'content')
GET  /v1/pages/{id}/markdown    # retrieve full page as Markdown
PATCH /v1/pages/{id}/markdown   # update page content
```

**Create page with Markdown:**
```json
POST /v1/pages
{
  "parent": { "type": "page_id", "page_id": "..." },
  "markdown": "# My Page\n\nSome content here.\n\n## Section\n\nMore content."
}
```
- First H1 becomes the page title if `properties.title` is omitted
- Use `\n` for newlines in JSON; use `<br>` for line breaks within a paragraph
- `markdown` is mutually exclusive with `children` / `content`

**Update page content** — the body is a **discriminated union; the top-level `type` is MANDATORY** (omit it → 400 `body.type should be defined`). On `Notion-Version: 2026-03-11` the REST API accepts `insert_content`, `replace_content`, and `replace_content_range` — the `update_content` (`old_str`/`new_str`) shape is **rejected** here (400 lists the three valid types), even though Notion's guide still documents it. Empirically confirmed.
```json
// insert_content — ADDITIVE: inserts without deleting/rewriting existing blocks (preferred for edits)
PATCH /v1/pages/{id}/markdown
{ "type": "insert_content",
  "insert_content": {
    "content": "- new bullet\n## New section",    // markdown to insert
    "after": "start text...end text"               // ellipsis selection — insert right AFTER this range
} }
// ...or place at top/bottom instead of `after`:
{ "type": "insert_content", "insert_content": { "content": "...", "position": { "type": "end" } } }  // or "start"

// replace_content — replaces ALL page content with new_str
{ "type": "replace_content", "replace_content": { "new_str": "# Full replacement", "allow_deleting_content": false } }

// replace_content_range — replaces a selected range (ellipsis selection); third valid type
```
- **Ellipsis selection** (`after`): three ASCII dots `...` — text before = start anchor, after = end anchor; content inserts right after the matched range. Pick clean anchors (avoid escaped `\[`, `\$`, bold markers).
- Prefer **`insert_content`** for edits — it never rewrites untouched blocks. ⚠️ `replace_content` / `replace_content_range` **delete** anything not in the new string and **trash child pages/databases** unless guarded ([makenotion#171](https://github.com/makenotion/notion-mcp-server/issues/171)); `allow_deleting_content: true` is required to delete child pages/databases.
- **Markdown round-trips are NOT byte-stable** — Notion normalizes between GET and PATCH (`_italic_`↔`*italic*`, escaping), so never diff page markdown to detect drift; compare blocks/values instead.
- Cannot update synced pages or `meeting_notes` transcripts

**Truncation for large pages:**
- ~20,000 block retrieval limit; response includes `truncated: true` and `unknown_block_ids` array
- Pattern: recursively fetch `unknown_block_ids`, handle `object_not_found` for permission-denied blocks

---

## Blocks & positioning

- **Append-only**: existing blocks cannot be moved or reordered via API — `PATCH /v1/blocks/{id}` only exposes content fields and `in_trash`
- **Re-parenting** — `POST /v1/pages/{id}/move` moves regular **pages** only (no ordering control, and the subject must be a page, not a database). To move a **database** to another page, use `PATCH /v1/databases/{id}` with `{ "parent": { "type": "page_id", "page_id": "..." } }` (API 2025-09-03+, current in 2026-03-11): it relocates the wrapper **in place** — same db `id`, and preserves `is_inline`, **relations, rollups, views, and rows** (it's a move, not a copy; verified live on an inline DB with dual relations + rollups). Reversible by patching `parent` again. **Don't** duplicate-to-move — a duplicate gets a new id and breaks every relation/rollup pointing at the original. (`PATCH /v1/data_sources/{id}` `parent` only moves a data source to a different `database_id`, never to a page; its old views become linked views.)
- Renaming a `child_database` block via `PATCH /v1/blocks/{id}` → 400 — use `PATCH /v1/data_sources/{id}` (title field) instead
- General rule: `child_page` and `child_database` block updates must go through Update page / Update database endpoints respectively
- `child_page` and `child_database` blocks **cannot be appended** via `PATCH /v1/blocks` — use `POST /v1/pages` or `POST /v1/databases`

**Positioning on append (`PATCH /v1/blocks/{page_id}/children`):**
```json
// Prepend  ("start" is different from "page_start" used in POST /v1/pages — gotcha!)
{ "position": { "type": "start" }, "children": [...] }

// Append explicitly (also the default)
{ "position": { "type": "end" }, "children": [...] }

// After a specific block  (note flat block_id field, not nested object)
{ "position": { "type": "after_block", "block_id": "<block_id>" }, "children": [...] }
```

**Positioning on `POST /v1/pages`** uses different values:
```json
{ "position": { "type": "page_start" } }   // top of parent page
{ "position": { "type": "page_end" } }     // bottom of parent page
{ "position": { "type": "after_block", "after_block": { "id": "<block_id>" } } }
```
> The asymmetry between `position.type: "start"` (block append) vs `"page_start"` (page create) is a gotcha — they are different values for the same conceptual operation.

- The old flat `after` param on `PATCH /v1/blocks/{id}/children` was **removed** in 2026-03-11 — integrations using `after` will break

**Linked-database view blocks** appear as `'Untitled'` in `GET /v1/blocks/{page_id}/children` even when the view has a name; `PATCH /v1/blocks/{block_id}` with a title update returns 400.

**Useful block shapes:**
```json
{ "type": "callout", "callout": { "rich_text": [{"type":"text","text":{"content":"..."}}], "icon": {"type":"emoji","emoji":"⚠️"}, "color": "gray_background" } }
{ "type": "code",    "code":    { "rich_text": [{"type":"text","text":{"content":"..."}}], "language": "python" } }
{ "type": "column_list", "column_list": { "children": [ { "type": "column", "column": { "children": [...] } } ] } }
```

**17 block types support nested children:** bulleted/numbered list items, callouts, child database/page, column/column_list, toggleable headings, paragraphs, quotes, synced blocks, tables, to-do items, toggles, tab blocks.

---

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
    "position": { "type": "after_block", "block_id": "<block_id>" }
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

---

## Charts — limits & gotchas

- **Free plan = 1 chart/workspace** (hard billing wall, not configurable; exact slot reclaim behavior after deletion is ambiguous)
- **Y-axis**: plain `number` properties and scalar formulas work; rollups, buttons, unique IDs, and files/media are not supported
  - Workaround if plain number required: add a plain number property, populate via `PATCH /v1/pages/{id}` for each row, keep synced
- **X-axis** type `'formula'` → 400 on donut charts specifically (the donut x_axis allowed list excludes formula); `type: 'relation'` → 400 on donut
  - Workaround: mirror relation name into a `select` property via API, use `x_axis.type: 'select'`
- Chart display limits: max 200 groups and 50 subgroups visible simultaneously
- Chart blocks (`/v1/blocks`) **cannot** be created via API — use `POST /v1/views` with `type: 'chart'`
- Linked-database views, block reordering, column layouts: **UI-only**
- Relative date filters (`past_month`, `this_week`) work in `POST /v1/data_sources/{id}/query` but cause `Something is wrong with your chart data` when used as chart view filters; alternative fixed-date filters (`on_or_after`) may also fail — the root cause in testing was the 1-chart billing wall, not the filter shape, so the exact safe filter form for chart views is unconfirmed
- Dashboard views (`type: 'dashboard'`) require Business+ plan; widgets added via separate `POST /v1/views` calls with `view_id` parent reference; max 4 widgets per row

---

## Formulas — gotchas

**Formula schema is FULL REPLACEMENT** — sending `{formula: {number_format: "real"}}` without `expression` wipes the expression.

**Formula number display format is NOT API-settable** — API schema only stores `expression`. Plain `number` properties DO support `{number: {format: "real"}}`.

**Rewriting a formula via API resets its UI display format** — no way to preserve via API.

**After formula/rollup schema update**: Notion needs ~5s to recompute all rows — `time.sleep(5)` before querying.

**15-layer formula reference chain limit** (increased from 7 in Aug 2024) — Notion silently stops computing when exceeded with no error raised. Chains like formula → formula → rollup consume depth.

**Type constraints:**
- `lets()` **cannot** bind rollup-derived values — and this extends to binding rollup-derived values even via arithmetic expressions like `round(abs(rollup)*100)`; confirmed workaround: skip `lets()` entirely and inline all expressions
- A formula **cannot** reference a formula that references a rollup when doing so would exceed the depth limit or when the referenced formula uses certain rollup operations — in practice, **every operation fails** (format, +0, abs, round, if, floor — all produce Type error); recompute inline from primitives
- Plain rollups ARE referenceable from formulas (arithmetic, `format()`, `if()`, etc.)
- `substring()` rejects rollup-derived strings (the issue is the 'unknown type' Notion assigns to all rollup-derived values, not only rollup-of-formula); `length()` tolerates unknown-typed strings; `substring()` does not; coercing with `+ ""` does NOT help
- Rollup cannot access the End Date of a date range property

**Regex lookahead/lookbehind do NOT work at runtime** (empirically confirmed twice — overrides docs). A pattern like `replaceAll(s, "\B(?=(\d{3})+(?!\d))", ".")` *validates* (no parse error) but returns **`null`** when evaluated. Never rely on `(?=...)`/`(?!...)`/lookbehind in Notion formulas. For thousands separators, group with arithmetic (see Currency below).

**`now()` = real server clock** — `formatDate(now(), "YYYYMM")` returns today's actual date; future-dated rows will never match current month. At the start of a new calendar month before snapshots are entered, `now()`-based formulas that depend on those snapshots will return 0.

**Currency formatting** — `formatNumber(n, "brl")` exists and prepends the symbol, BUT formats with the **source/US locale** (`R$282,536.47` — comma thousands, period decimal), NOT the currency's own locale. Two hard limits (empirically verified):
- It does **NOT** produce pt-BR style (`R$ 282.536,47` — period thousands, comma decimal). For that you must build the string manually.
- It **type-errors on rollup-derived values**: `formatNumber(prop("SomeRollup"), "brl")` → "Type error". Recompute inline from primitives, or wrap a plain number.
```
formatNumber(282536.47, "brl")          // → "R$282,536.47"  (US separators, NOT pt-BR; errors on a rollup)

// Locale-correct pt-BR (no substring, no lookahead — both fail on rollup-derived strings):
// N = value expr; ip=floor(round(abs(N)*100)/100); cents=mod(round(abs(N)*100),100)
// group ip via floor/mod into millions/thousands/units, pad lower groups to 3 digits:
"R$ " + (Mg>0 ? format(Mg)+"."+pad3(Kg)+"."+pad3(Ug)
             : ip>=1000 ? format(Kg)+"."+pad3(Ug) : format(Ug)) + "," + pad2(cents)
// Mg=floor(ip/1e6); Kg=mod(floor(ip/1000),1000); Ug=mod(ip,1000)
// pad3(x)=if(x<10,"00"+format(x),if(x<100,"0"+format(x),format(x))); pad2 similar
```

**Useful formula patterns:**
```
// Current-month detection (auto-advances, zero-maintenance)
if(formatDate(prop("Month date"), "YYYYMM") == formatDate(now(), "YYYYMM"), prop("Value"), 0)

// Cascading rollup switch (no lets)
if(prop("Key") == "A", prop("RollupA"), if(prop("Key") == "B", prop("RollupB"), 0))

// Relation name extraction (not chartable as x-axis)
prop("Category").map(current.prop("Name")).join("")

// Round to 2 decimal places (no round(x,n) overload)
round(prop("Value") * 100) / 100

// Month sort key
formatDate(prop("Date"), "YYYYMM")
```

---

## Rollups

- Add rollup: `PATCH /v1/data_sources/{id}` with `{rollup: {relation_property_name, rollup_property_name, function}}`
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

---

## Number formatting

- Plain number property format: `{number: {format: "real"}}` — set via API, works reliably
- Formula display format (e.g. R$, %, currency): **UI-only** — API silently drops any format field; only `expression` is stored
- Rewriting formula expression via API resets the UI display format to default — no workaround
- **Currency output**: `formatNumber(n,"brl")` → `R$1,234.56` (US separators, and errors on rollup-derived values); for pt-BR `R$ 1.234,56` build with floor/mod arithmetic (see Formulas)

---

## Useful patterns

**Query with filter:**
```json
POST /v1/data_sources/{id}/query
{
  "page_size": 100,
  "filter": { "property": "Name", "title": { "equals": "June 2026" } },
  "sorts": [{ "timestamp": "created_time", "direction": "descending" }]
}
```

**Get all property IDs:**
```python
schema = GET /v1/data_sources/{id}
prop_ids = {name: meta["id"] for name, meta in schema["properties"].items()}
# IDs may be URL-encoded — urllib.parse.unquote(id) to normalize
```

**Extract data_source_id from a database URL:**
```python
# 1. Get 36-char UUID from the Notion URL
# 2. GET /v1/databases/{uuid}  → response contains data_sources list
# 3. data_source_id = response["data_sources"][0]["id"]
```

**Formula expressions** reference property IDs via `block_property:{id}:` syntax in stored expressions.

**Stale `filter_properties` in URL** → 400 `validation_error` "malformed schema ... invalid attribute: <encoded_id>" — remove stale property IDs from query params. Also surfaces when MCP tool auto-appends stale query params to `GET /v1/pages/{id}`.

**Linked databases limitation**: linked database views of a database shown on another page are NOT supported by the API — share the source database directly with the integration. Wiki databases can only be created via the Notion UI.

---

## Production architecture patterns

- **Cache locally** — Notion is not a real-time database; poll or use webhooks
- **Webhook pattern**: receive POST → return 2xx immediately → enqueue async job → fetch via API → update cache; periodic reconciliation as fallback
- **Batch reads**: 2–4 concurrent requests max + global rate limiter
- **Prefer `/v1/data_sources/{id}/query`** over `/v1/search` for deterministic retrieval of known databases
- **Idempotent writes**: use an external ID property to prevent duplicate pages on retry
- **Track sync checkpoints** to recover from missed changes
- **Prefer database queries over search** for structured data retrieval
