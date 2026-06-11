---
name: notion-api
description: Use when working with the Notion API or MCP — creating, editing, querying, or moving databases, data sources, pages, views (table/board/gallery/chart), formulas, rollups, relations, blocks, icons, or covers; or hitting Notion API/MCP errors (validation_error, pagination, permission, 400/409).
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

**Root bootstrap:** at the topmost ancestor (`parent.type == "workspace"`), check for an AGENTS.md. If absent, propose creating one (approval-gated per the approval-gate rule) that records inferred workspace conventions and a hub/sub-AGENTS.md map per the conventions rule. **Authoring or editing any AGENTS.md is itself test-driven — see `references/agents-md-authoring.md` (mirrors `superpowers:writing-skills`).** This file is the global source of truth; lower AGENTS.md files override on conflict. **The sweep is bidirectional — read the closest AGENTS.md before a change, maintain the closest one after** (every change, at the right level — see "Maintain the nearest governing `AGENTS.md`" under the conventions rule).

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

## MANDATORY — propose and get approval before any write

Every Notion write (create, update, move, rename, trash, icon/cover change, property change) requires a concise proposal and explicit user approval before execution — because structural changes to a workspace are irreversible and the user must retain full agency over their data.
**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law
```
NO WRITE TOUCHES NOTION UNTIL THE USER TYPES AN EXPLICIT APPROVAL — NO EXCEPTIONS
```

### The Gate

Present ONE proposal per logical batch of related writes. Never split a related batch to reduce friction. Structure:

- **(a) Intent** — one sentence: what and why
- **(b) Exact operations** — terse bullet per API call: method, target block/page/db ID (or title), fields changing
- **(c) Preview tree** — Unicode tree of the resulting structure (same format as the tree-view rule) — mark new nodes `[NEW]`, changed nodes `[~]`, trashed nodes `[TRASH]`

Then **stop and wait**. Silence, a question, or a clarifying reply is **not** approval — hold.

After all writes complete, emit the **verified tree** (live-fetched) confirming the result matches the preview.

Read-only operations — `GET`, `/query`, `/search`, reading `AGENTS.md` — proceed freely, no gate.

### Red Flags — STOP, you're rationalizing

| Thought | Reality |
|---|---|
| "It's just a rename, I'll do it and mention it" | Any write, however minor, requires a proposal first |
| "The user clearly wants this, the approval is a formality" | Implicit intent is not approval — present the gate every time |
| "These are two quick writes, I'll propose them one at a time" | Related writes batch into ONE proposal — never split to reduce friction |
| "I'll do the writes now and show the tree after" | Preview tree comes BEFORE execution, verified tree comes AFTER |
| "The user said 'create X' mid-conversation, that's approval enough" | A task description is not an approval — proposal-then-explicit-confirm is the cycle |

### The Bottom Line

Every write is gated: propose (intent + operations + preview tree), wait for explicit approval, execute, verify with a live tree. Reads are always free, writes never are. Non-negotiable.

## MANDATORY — match the workspace's conventions

Before creating, renaming, or styling anything in Notion, infer and follow the workspace's established house style — because a single page that breaks the pattern degrades workspace coherence and forces the user to manually repair it.
**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law
```
NEVER WRITE A SINGLE GLYPH UNTIL YOU KNOW THE HOUSE STYLE
```

### The Inference Gate

**What to infer** — scan for all of the following before any write:

- **Naming casing** — Title Case, sentence case, ALL CAPS, camelCase in page/DB titles?
- **Language** — pt-BR, EN, or a deliberate pt-BR/EN mix (e.g. hub names in pt-BR, property names in EN)?
- **Singular vs plural** — collection/DB names: "Task" or "Tasks", "Month" or "Months"?
- **Hub patterns** — inline DBs with an "X Navigation" header, full-page DBs, linked views, dashboard layouts?
- **Icon/emoji style** — infer which type is used where (`emoji` vs Notion named `icon`) and which color palette applies to which category of page (cross-ref: "Icons, emoji & covers"). **Fixed exception: every `AGENTS.md` page uses the 🤖 emoji icon — a signature marking the agent playbook, independent of the surrounding house style.**
- **Cover style** — external URLs, Notion gradient covers (`https://www.notion.so/images/page-cover/…`), none?
- **Inline vs full-page** — are child DBs always inline, always full-page, or context-dependent?

**How to infer** — in priority order:

1. **Root AGENTS.md first** (cross-ref: "MANDATORY FIRST STEP — read every ancestral AGENTS.md"). If it exists at the topmost workspace ancestor, it is the canonical house-style source of truth.
2. **Bounded paginated live sample** when no root AGENTS.md exists: fetch the root hub page + 1–2 levels of children, fully paginated (`page_size=100`, exhaust all cursors — cross-ref: "MANDATORY — exhaust every paginated list"). That sample is the evidence base; do not generalize beyond it without reading further.

### Flag-then-follow on explicit user conflict

When the user's instruction deviates from inferred conventions (e.g. user says "Backup" but every existing collection is plural like "Backups", "Months"), **do both**:

1. **FLAG** the deviation in the approval-gate proposal — one sentence: `"Note: existing collections are plural ("Backups", "Months") — using your wording "Backup" instead."`
2. **FOLLOW the user's explicit wording** — the flag is informational only; it must never become a negotiation.

### Maintain the nearest governing `AGENTS.md` — after every change

The ancestral sweep is **bidirectional**: you read the closest `AGENTS.md` *before* touching a target, and you **maintain the closest one *after***. So **every** create / edit / move / rename / restyle ends with a maintenance check — not only changes that feel like "a new convention." Ask: *does the `AGENTS.md` that governs this subtree still describe reality?* If the change established or altered a convention, fact, ID, or workflow the playbook should carry, update it in the same approval batch; if nothing changed, the check costs one thought and you move on. "Nothing to update" is a conclusion you reach *after* checking — never a step you skip.

**Write at the right level — closest wins, exactly like reads:**
- **Subtree-local** convention (e.g. "Category rows use gray icons", "this tracker's Months view sorts descending") → the **nearest** ancestor `AGENTS.md` that owns that subtree (the area/hub playbook), **NOT** root.
- **Workspace-wide** convention → the **root** `AGENTS.md`.
- No `AGENTS.md` yet at the level a subtree-local convention belongs → **propose creating one there** (approval-gated; author it test-driven per `references/agents-md-authoring.md`).

Root is the global source of truth and lower files override on conflict — so an area-scoped rule belongs in that area's file, where the agents working there will find it and where it won't pollute the global playbook. Conventions discovered ad-hoc must be written back, never held only in model context.

### Red Flags — STOP, you're rationalizing

| Thought | Reality |
|---|---|
| "I'll just use an emoji here, it looks fine" | You haven't checked whether this page category uses named icons — sample first |
| "User said 'Backup' so I'll pluralize it to match the pattern" | Flag-then-follow is absolute: flag the deviation, use the user's word |
| "I read two pages, that's enough to know the style" | The sample must be fully paginated — partial reads miss outliers and sub-hub overrides |
| "The root AGENTS.md doesn't mention covers, so I'll skip it" | Absence of documentation ≠ no convention; infer from the live sample, then write it back |
| "This is a small rename, conventions don't matter" | Every write sets a precedent; mismatched titles and wrong icon colors accumulate into workspace entropy |
| "Routine edit — no AGENTS.md to maintain" | Every change fires a maintenance check of the governing AGENTS.md; "nothing to update" is a conclusion you reach *after* checking, not a step you skip |
| "I'll record this area rule in the root AGENTS.md" | Closest wins — a subtree-scoped convention belongs in the nearest area/hub AGENTS.md; root is for workspace-wide rules only |

### The Bottom Line

Infer the complete house style from the root AGENTS.md (primary) or a fully-paginated bounded sample (fallback) before any write. Flag user-instruction deviations once, then follow the user. **After every change, maintain the nearest governing AGENTS.md** (the closest one that owns the changed subtree; root only for workspace-wide conventions) — the write-side mirror of the mandatory read-sweep. Non-negotiable.

## MANDATORY — brainstorm the view design before creating or restyling a view

Creating or restyling **any** view is a design decision in two layers: its **data shape** — view type, filter (which rows), sort (order), grouping (`group_by`), which properties are visible and their order, and a self-describing name — **and** its **appearance** — cover source, card size, fit-image, card layout, per-property width. Propose the design and get approval before any API call. The user lives inside a view daily and sees it instantly; an imposed sort, filter, or grouping is as wrong as an imposed cover.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law

```
NO VIEW CREATE OR RESTYLE UNTIL YOU HAVE PROPOSED THE VIEW DESIGN — DATA SHAPE *AND* LOOK — AND THE USER HAS APPROVED IT
```

Not for "obvious" covers, not for "it's just a table", not when defaults look fine, not when the user said "make it look nice" or merely "add a view".

### What counts as a design choice

- **Data shape (EVERY view, including a plain table):** view **type** (`table`/`board`/`gallery`/`calendar`/`timeline`/`list`/`chart`) · **filter** — which rows show · **sort** — property + direction · **grouping** — `group_by` (board columns, sub-groups) · which **properties** are visible + their order · the view **name** (self-describing — never leave `Default view`). Field reference: `references/views.md`.
- **Appearance (visual view types — gallery/board cards):** cover source (`page_cover` / `page_content` / a Files-&-media property / none) · card size (small/medium/large) · fit-image (`contain` vs `cover`/crop) · card layout (`list` vs `compact`) · per-property width. Field reference: `references/gallery-view.md`.

### The Gate

Present a concise design brief — **one line per applicable dimension, each with a recommendation + why**: type · filter · sort · grouping · visible properties · name; plus cover · size + aspect · card layout for visual types. **State EVERY applicable dimension explicitly — especially `sort` and `visible properties`, the two most often silently dropped.** "No sort / Notion default order" and "all properties, default order" are valid recommendations — but they must be *stated*, never omitted: **if your brief has no `sort:` line, you skipped it.** Never bury a sort/filter/group inside the payload. Then **stop and wait** — silence or "looks good" is approval; a new question or a tweak is not.

**Collapse the friction:** if the user already fully specified the design, confirm in ONE sentence instead of a full brief; and fold the brief and the standard approval-gate operations into a single turn ("here's the design I propose; if you approve, here are the exact calls").

### Red Flags — STOP, you're rationalizing

| Thought | Reality |
|---|---|
| "It's just a table — nothing to brainstorm" | Type, filter, sort, and visible props are all choices, even for a plain table |
| "A board obviously groups by Status" | Grouping is a design choice — offer Status vs Priority vs Assignee |
| "I'll just sort by created date" | A default sort IS a decision — surface it, don't bury it in the payload |
| "This view doesn't need a sort, so I won't mention it" | Omitting a dimension = deciding it silently. Every applicable line (sort, visible props) MUST appear — "none/default" is a stated answer, not a skip |
| "'Current sprint' implies the filter" | Which property = which value? Name it and confirm — never guess a filter |
| "'Create a gallery' implies large covers" | Implicit intent ≠ approval — show the brief |
| "Defaults are fine, skip the brief" | "Default" is a design decision you're making for them — surface it |

### The Bottom Line

Draft the design brief (type, filter, sort, grouping, visible props, name — plus cover/size/aspect/layout for visual views), present it, wait for approval, then proceed through the standard approval-gate write cycle. Non-negotiable.

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


## Reference files — load on demand

The heavy API reference is split into sibling files under `references/`. Load only what the task needs — not all of them; for adjacent domains, load both.

| Task | Load |
|---|---|
| Property shapes, reading values, page/DB icons & covers | `references/pages-properties.md` |
| Built-in icon **name catalog** (the `{type:"icon"}` names) | `references/icon-names.md` |
| Blocks, positioning, the **reorder workaround**, Markdown content API | `references/blocks.md` |
| Views — list/create/update/delete, linked views, board/calendar/timeline/list/map/form, column visibility | `references/views.md` |
| **Gallery view** visual config (cover, card size, visible props) + **sourcing B&W cover images** | `references/gallery-view.md` |
| **Authoring / editing an `AGENTS.md`** playbook well (the `writing-skills` discipline, adapted to Notion) | `references/agents-md-authoring.md` |
| Charts — limits & gotchas | `references/charts.md` |
| Formulas (gotchas, pt-BR currency) & number formatting | `references/formulas.md` |
| Relations & rollups | `references/relations-rollups.md` |
| Querying/filtering rows, search, extracting a `data_source_id` from a URL; webhooks, caching, idempotency | `references/patterns.md` |
| **Debugging an API error** (`400`/`409`/`429`/`401`/`403`, `validation_error`, permission) | `references/patterns.md` + the matching domain file above |
