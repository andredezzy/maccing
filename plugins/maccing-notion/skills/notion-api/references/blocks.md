# Blocks, positioning & the Markdown content API

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, approval gate before writes, tree view after structural changes, match-conventions) still apply to everything here.

**Reads:** to read a page's content use `read_page(page_id, "markdown")`; to inspect its block tree (e.g. find a block id for `after_block`) use `read_page(page_id, "outline")` — both handle pagination and unfetchable-block recovery server-side. The raw block/markdown endpoints here are for **writes/edits** and for what the readers don't render.

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

**Update page content** — the body is a **discriminated union; the top-level `type` is MANDATORY** (omit it → 400 `body.type should be defined`). On `Notion-Version: 2026-03-11` the REST API accepts `insert_content`, `replace_content`, and `replace_content_range` — the `update_content` (`old_str`/`new_str`) shape is **rejected** here (400 lists the three valid types), even though Notion's guide still documents it. Verified 2026-03-11.
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
{ "type": "replace_content_range", "replace_content_range": { "old_str": "start...end", "new_str": "replacement" } }
```
- **Ellipsis selection** (`after`): three ASCII dots `...` — text before = start anchor, after = end anchor; content inserts right after the matched range. Pick clean anchors (avoid escaped `\[`, `\$`, bold markers).
- Prefer **`insert_content`** for edits — it never rewrites untouched blocks. ⚠️ `replace_content` / `replace_content_range` **delete** anything not in the new string and **trash child pages/databases** unless guarded ([makenotion#171](https://github.com/makenotion/notion-mcp-server/issues/171)); `allow_deleting_content` (default `false`) guards child pages/databases on both `replace_content` and `replace_content_range` — set `true` only when deletion is intended.
- **Markdown round-trips are NOT byte-stable** — Notion normalizes between GET and PATCH (`_italic_`↔`*italic*`, escaping), so never diff page markdown to detect drift; compare blocks/values instead.
- Cannot update synced pages or `meeting_notes` transcripts

**Truncation for large pages:** prefer `read_page` for all page reads — it handles truncation and unfetchable-block recovery automatically. (The raw `GET /v1/pages/{id}/markdown` truncates on very large pages and does not recover unfetchable blocks — another reason to use `read_page` instead.)

---

## Blocks & positioning

- **No in-place reorder** — an existing block **cannot be moved or reordered within its parent** via the API. There is no `POST /v1/blocks/{id}/move`; `PATCH /v1/blocks/{id}` only exposes content fields + `in_trash`. Docs verbatim: *"Existing blocks cannot be moved using this endpoint. Once a block is appended as a child, it can't be moved elsewhere via the API."* The `position` object on `PATCH /v1/blocks/{id}/children` (`start`/`end`/`after_block`) places **new** children only. (Verified primary-source, 2026-03-11.)
- **✅ Reorder workaround — `child_database` / `child_page` blocks only**: re-parent them out and back. Re-parenting **appends at the end** (DBs via `PATCH /v1/databases/{id}` `parent`; pages via `POST /v1/pages/{id}/move`), so to set an order: move each sibling OUT to a temp page, then move them back into the target page **in the order you want** — and leave the block that should be first untouched (everything re-appends after it). Verified live (Net-worth migration). Verify the resulting order with `read_page(page_id, "outline")`, not a raw block-children GET. Plain content blocks (paragraph, callout, embed) can't be re-parented at all — reorder is genuinely UI-only for those.
- **Re-parenting** — `POST /v1/pages/{id}/move` moves regular **pages** only (no ordering control, and the subject must be a page, not a database). To move a **database** to another page, use `PATCH /v1/databases/{id}` with `{ "parent": { "type": "page_id", "page_id": "..." } }` (API 2025-09-03+, current in 2026-03-11): it relocates the wrapper **in place** — same db `id`, and preserves `is_inline`, **relations, rollups, views, and rows** (it's a move, not a copy; verified live on an inline DB with dual relations + rollups). Reversible by patching `parent` again. **Don't** duplicate-to-move — a duplicate gets a new id and breaks every relation/rollup pointing at the original. (`PATCH /v1/data_sources/{id}` `parent` only moves a data source to a different `database_id`, never to a page; its old views become linked views.)
- Renaming a `child_database` block via `PATCH /v1/blocks/{id}` → 400 — use `PATCH /v1/data_sources/{id}` (title field) instead
- General rule: `child_page` and `child_database` block updates must go through Update page / Update database endpoints respectively
- `child_page` and `child_database` blocks **cannot be appended** via `PATCH /v1/blocks/{page_id}/children` — use `POST /v1/pages` or `POST /v1/databases` (after creation, read a single row with `read_page(page_id, "markdown")` or query the database with `read_database`; never a raw `/query` loop — except to fetch a row's page `.id`, which only `POST /v1/data_sources/{id}/query` exposes (`.id` per result))
- **Visual spacing between stacked inline DBs** — two inline databases (or any blocks) rendered back-to-back have no gap and read as cramped. Insert an **empty paragraph** between them for breathing room: `PATCH /v1/blocks/{page_id}/children` with `{ "position": {"type":"after_block","after_block":{"id":"<first-db-block-id>"}}, "children":[{ "object":"block", "type":"paragraph", "paragraph":{"rich_text":[]} }] }`. (A `child_database` block's id == its database id.) Live-verified on the Investments tracker (between Categories and Months).

**Positioning on append (`PATCH /v1/blocks/{page_id}/children`):**
```json
// Prepend  ("start" is different from "page_start" used in POST /v1/pages — gotcha!)
{ "position": { "type": "start" }, "children": [...] }

// Append explicitly (also the default)
{ "position": { "type": "end" }, "children": [...] }

// After a specific block — nested object { "id": ... }, NOT a flat block_id
{ "position": { "type": "after_block", "after_block": { "id": "<block_id>" } }, "children": [...] }
```
> ⚠️ **`after_block` is a nested object, same shape as `POST /v1/pages` below — live-verified 2026-03-11.** A flat `{ "type":"after_block", "block_id":"…" }` → `400 position.after_block should be defined`; `after_block` as a bare string → `400 position.after_block should be an object`; omitting `type` → `400 position.type should be defined`. The only valid forms are `{type:"start"}`, `{type:"end"}`, and `{type:"after_block", after_block:{id}}`.

**Positioning on `POST /v1/pages`** uses different values:
```json
{ "position": { "type": "page_start" } }   // top of parent page
{ "position": { "type": "page_end" } }     // bottom of parent page
{ "position": { "type": "after_block", "after_block": { "id": "<block_id>" } } }
```
> The asymmetry between `position.type: "start"` (block append) vs `"page_start"` (page create) is a gotcha — they are different values for the same conceptual operation.

- The old flat `after` param on `PATCH /v1/blocks/{id}/children` was **removed** in 2026-03-11 — integrations using `after` will break

**Linked-database view blocks** appear as `'Untitled'` in the block tree (via `read_page(page_id, "outline")`) even when the view has a name; `PATCH /v1/blocks/{block_id}` with a title update returns 400.

**Useful block shapes:**
```json
{ "type": "callout", "callout": { "rich_text": [{"type":"text","text":{"content":"..."}}], "icon": {"type":"emoji","emoji":"⚠️"}, "color": "gray_background" } }
{ "type": "code",    "code":    { "rich_text": [{"type":"text","text":{"content":"..."}}], "language": "python" } }
{ "type": "column_list", "column_list": { "children": [ { "type": "column", "column": { "children": [...] } } ] } }
```

**17 block types support nested children:** bulleted/numbered list items, callouts, child database/page, column/column_list, toggleable headings, paragraphs, quotes, synced blocks, tables, to-do items, toggles, tab blocks.

