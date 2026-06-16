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

**Tooling in one line:** reads → `read_agents_md` / `search` (name→id) / `read_page` / `read_database` / `describe` (schema + column icons, or page/object metadata); writes and endpoints the readers don't cover → `request`; create/update a **property** (a database column + its icon, or a page value) → `upsert_property`; re-order a database's **properties** (view columns and/or the canonical order) → `order_properties`; render any page/database/blocks as the canonical ASCII mockup (the mandatory way to show how something looks in chat) → `render_mockup`; other UI-only writes (relative-date filters) → `private_request`. Full table: "[MCP tools — pick by job](#mcp-tools--pick-by-job)" below.

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

1. **Sweep — call `read_agents_md(<target id>)`.** That one call *is* this Gate: it climbs `.parent` root→target — accepting **any** target id (page, database row, block, database, or data_source) — finds every ancestral `AGENTS.md`, reads each, and returns them root→closest with precedence applied (closest wins). Read and obey them top→down.
2. **Only then** perform the requested operation.

**Fallback — only if `read_agents_md` errors, or you have no id yet** — do the climb by hand. ⚠️ **The GETs below are for `.parent` traversal ONLY — never to read content or properties (use `read_page` for that).**
- **Build the root→target chain** — `GET /v1/pages/{id}` (or `/v1/databases/{id}`, `/v1/data_sources/{id}`) → read `.parent`, repeat until `type == "workspace"`, branching on `.parent.type`: `page_id` → `.parent.page_id`; `block_id` → `GET /v1/blocks/{id}` → its parent; `data_source_id`/`database_id` → `GET /v1/databases/{.parent.database_id}` (a row's `.parent` carries **both** `data_source_id` and `database_id`; climb via the `database_id`) → continue from **that database's** own `.parent` (its parent page, where the DB's `AGENTS.md` lives beside the `child_database` block — not on the rows).
- **At each page, top→down, find its `AGENTS.md`** — `GET /v1/blocks/{page_id}/children` (or `read_page(page_id, "outline")` for the child tree; `page_size=100`, paginate on `start_cursor`) → match `type == "child_page"` **and** `child_page.title == "AGENTS.md"`. Read its content via `read_page(agents_id, format="text")` (handles toggle recursion + block recovery), obey top→down; closer-to-target wins on conflict.
- **No id yet?** Descend: `POST /v1/search {"filter":{"property":"object","value":"page"}}` → first level = `parent.type == "workspace"`; walk down `child_page` blocks to the target, reading `AGENTS.md` at each step.

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

### The loop

**For database rows, `read_database(database_id, format, exhaust_all=true)` runs this loop for you** — it fetches until `has_more == false` server-side and returns every row flattened (`format: "summary"` for a grouped sum/total). That *satisfies* this law; it is not a bypass. Hand-roll the loop below only for the endpoints the readers don't cover — block children and views (the `search` reader takes `exhaust_all` to page hits to the end).

```python
# hand-roll ONLY for block children / views — NOT for DB rows (read_database exhaust_all=true) or search (search reader exhaust_all=true)
results, cursor = [], None
while True:
    page = GET /v1/blocks/{id}/children   # query:{page_size:100,start_cursor:cursor} (or GET /v1/views?data_source_id=)
    results += page["results"]
    if not page["has_more"]:
        break
    cursor = page["next_cursor"]              # feed back as the next start_cursor
# ONLY NOW: len(results), "none found", any conclusion
```

- **Cursor placement differs by verb:** `POST .../query` and `POST /v1/search` take `start_cursor` in the **body**; `GET /v1/blocks/{id}/children` and `GET /v1/views?data_source_id=` take `start_cursor` in the **query string**. `page_size` max 100 — a full 100-row page almost always means `has_more: true`.
- **Every list-shaped response carries its own `has_more`/`next_cursor` — all are covered:**
  - `POST /v1/data_sources/{id}/query` — rows
  - `GET /v1/blocks/{id}/children` — page/block content (for a page body tree `read_page(page_id, "outline")` handles this automatically; hand-roll only for block subtrees the readers don't cover). **The `AGENTS.md` sweep is covered too** — a dropped cursor can hide an `AGENTS.md` on a long page → you skip a playbook you were required to obey
  - `POST /v1/search` — hits
  - `GET /v1/views?data_source_id=` — views (every `read_database` call already dumps each view's full config; hand-roll this only for a write or a standalone per-view GET)
- **Relation values paginate too (the sneaky one):** a row's `properties.<Rel>.relation` array is itself capped (~25) and carries its OWN `has_more: true`. The query cursor does **not** expand it — you must call `GET /v1/pages/{page_id}/properties/{property_id}` and paginate THAT to the end. A relation that "only has 25 items" is the tell that you're holding a fragment. ⚠️ **`read_page`/`read_database` do NOT expand this either** — they resolve relations to titles but map only the (~25-capped) `relation` array the page/query returned (`readers/page.ts` `flattenProperty` reads `property.relation` directly, no per-property pagination). So for a relation expected to exceed ~25 entries — even in a read-only flow — page `GET /v1/pages/{page_id}/properties/{property_id}` to the end yourself. (Rollups/aggregations are computed server-side and are NOT affected by this cap; only the raw relation/title LIST truncates.)

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

## MANDATORY — paste every mockup into the chat, verbatim (the MCP tool result is INVISIBLE to the user)

**The user never sees your MCP tool results.** In the Claude Code chat, every tool call's output — including the ASCII a mockup tool returns — is collapsed/hidden; the user reads ONLY the text of your visible reply. So a mockup that lives only in a tool result is a mockup **the user never saw**. Therefore: **every time you produce a mockup, copy its full output verbatim into your visible message** — a one-line caption around it is welcome; replacing it with a prose summary ("all 9 cards render ✓") is a violation, because to the user you showed *nothing*.

This fires for the WHOLE mockup family — **`render_mockup`** (any block, page, or standalone database) and **`read_page` / `read_database` with `format:"mockup"`** — in EVERY context that produced one: a **proposal** ("how it will become"), a **post-write verification** ("how it became"), a **bug-fix / render verification** ("confirm it renders"), or simply because the user asked to **see / show / check / confirm** something. Reading "confirm the fix" or "show me" as license to summarize is the exact failure this rule exists to stop.

NEVER hand-draw the visual instead (Unicode `├──` tree or box-art): a hand-typed mockup drifts — emoji are double-width, borders miscount, chat fonts substitute box-drawing glyphs — and the user sees broken, unclosed boxes. The renderer OWNS all alignment; you supply only structure. The rendered mockup is the DEFAULT and ONLY visual — it **replaces** the bare Unicode tree.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law

```
EVERY MOCKUP YOU PRODUCE IS PASTED VERBATIM INTO YOUR VISIBLE REPLY — A MOCKUP LEFT ONLY IN A TOOL RESULT WAS NEVER SHOWN
```

### The Gate (every time a mockup is produced)

1. **Produce the mockup.** For an existing object, the one-call path is the live readers — `read_page` / `read_database` with `format:"mockup"`. For a **proposal** or a synthetic target, build the block model and call `render_mockup`. For a **post-write verification**, re-read live state first (`read_page(page_id, "outline")`, fully paginated) so it reflects VERIFIED reality, never intention.
2. **Build the model when rendering one** — `render_mockup` takes `mockup`: a single block OR an array of blocks. EVERYTHING is a block keyed by `type`. A page is `{ type: "page", title, icon?, cover?, description?, width?, children[] }`, and `children` are the body blocks in document order: inline DB → `gallery` (cards = `icon`+`name`+metric `lines`) or `table` (`columns`+`rows`) by its default view type; full-page DB or sub-page → `page_link`; profile/info box → `callout`; widget → `embed`; blank spacer → `paragraph`. A standalone database is `{ type: "database", database: { title, icon?, description?, width?, views[], view? } }`. In a **proposal**, model the RESULTING object and mark each change in the node's own text (a card/line `← NEW`, a `page_link` `note` like `moved here` / `trashed`).
3. **Paste the tool's output verbatim into your visible reply.** Never edit it by hand — that re-introduces drift; fix the model and re-render.

(A bare `read_page outline` tree stays fine for your OWN block-id lookups — it is just never what you SHOW the user.)

### Red Flags — STOP, you're rationalizing

| Thought | Reality |
|---|---|
| "The user's in a hurry — a one-line confirm is enough" | The tool output is invisible; your one-liner is ALL they get. Paste the mockup. |
| "Re-printing it adds no value — they already saw it" | They did NOT see it — tool results are hidden in chat. Unpasted = never delivered. |
| "It's a fix/verification, not a page proposal" | Every produced mockup is pasted — proposal, post-write, AND fix/render verification alike. |
| "It's a database/blocks mockup, not a page" | One `render_mockup` covers all of it (page, database, bare blocks) AND `read_*` `format:"mockup"` equally. |
| "I'll sketch the boxes by hand, it's faster" | Hand-drawn ASCII drifts (emoji width + miscounts). Use the renderer. |
| "A quick Unicode `├──` tree is enough" | The mockup is the DEFAULT; the tree is for your own id lookups, not the user. |
| "It's only a proposal, not the real page yet" | Proposals MUST show how it will become — render the target model. |
| "I'll paste the render but fix one label by hand" | Editing the output re-introduces drift. Fix the model, re-render, paste verbatim. |
| "`render_mockup` isn't loaded" | It ships with this skill's MCP server — load it; never fall back to hand-drawing. |
| "I changed structure; I'll just describe it in prose" | Every structure change ends with a re-read, rendered, verified mockup. |

### The Bottom Line

Produce a mockup (one-call `read_*` `format:"mockup"`, or build a block model → `render_mockup`) → **paste its output verbatim into your visible reply.** The tool result is invisible to the user; an unpasted mockup was never shown. Proposals show how it will become; verifications (post-write OR fix) show the live result. Never hand-draw, never edit the output, never swap it for a summary. Non-negotiable.

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
- **(c) Preview mockup** — the RESULTING page rendered via **`render_mockup`** ("how it will become"; see the render-mockup rule above), pasted verbatim — mark each change in the node's own text (`← NEW` / `← moved` / `← trashed`)

Then **stop and wait**. Silence, a question, or a clarifying reply is **not** approval — hold.

After all writes complete, emit the **verified mockup** — re-read the live page(s) and `render_mockup` them — confirming the result matches the preview.

Read-only operations — `GET`, `/query`, `/search`, reading `AGENTS.md` — proceed freely, no gate.

### Red Flags — STOP, you're rationalizing

| Thought | Reality |
|---|---|
| "It's just a rename, I'll do it and mention it" | Any write, however minor, requires a proposal first |
| "The user clearly wants this, the approval is a formality" | Implicit intent is not approval — present the gate every time |
| "These are two quick writes, I'll propose them one at a time" | Related writes batch into ONE proposal — never split to reduce friction |
| "I'll do the writes now and show the mockup after" | Preview mockup comes BEFORE execution, verified mockup comes AFTER |
| "The user said 'create X' mid-conversation, that's approval enough" | A task description is not an approval — proposal-then-explicit-confirm is the cycle |

### The Bottom Line

Every write is gated: propose (intent + operations + preview mockup), wait for explicit approval, execute, verify with a live rendered mockup. Reads are always free, writes never are. Non-negotiable.

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

**Collapse the friction:** ONLY when the user has already stated EVERY applicable dimension (verified line-by-line — type, filter, sort, grouping, visible props, name, and cover/size/aspect/layout for visual types), confirm in ONE sentence instead of a full brief; fold the brief and the approval-gate operations into a single turn ("here's the design I propose; if you approve, here are the exact calls"). A single unstated dimension forbids the collapse — present the full brief. "Add a gallery" specifies the type, not the design. In a **multi-object build**, this per-view collapse is unavailable until the pre-build completeness gate's document (the rule below) is approved.

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

## MANDATORY — design the whole object before creating it (logical *and* aesthetic)

Creating any structure-bearing object — a **data source / database**, a **page**, or **new properties** on one — is a design act. Propose the COMPLETE design — every logical AND aesthetic choice — in the approval batch, before the first `POST`/`PATCH`. A column with no icon, a select with default colors, an unformatted number: each is a decision you made silently for the user.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law

```
NO CREATE (data source, page, or property) UNTIL ITS FULL DESIGN — LOGICAL + AESTHETIC — IS PROPOSED AND APPROVED
```

### What to design — state every applicable line ("default" is a stated answer, never a skip)

- **Logical** — the data model (columns + types; relations/rollups/formulas; domain-faithful nesting); **names** (house-style casing/language, singular vs plural); property **descriptions**; the **view(s)** + their data shape *(→ the view-design rule above)*.
- **Aesthetic** — page **icon** + **cover**; **every column's icon** (gray named, matching the column's meaning); **select/status option colors**; **number/currency formats** (pt-BR `R$`); gallery/card look + layout.

Conform to the nearest `AGENTS.md` (read its recorded conventions; if none exist for this concern, brainstorm fresh **and record them back** per the conventions rule). Apply in one batch: **`upsert_property`** sets the column defs + their icons (and any page values); `request` creates the database/page and sets the page icon/cover.

### Red Flags — STOP, you're rationalizing

| Thought | Reality |
|---|---|
| "I'll create the columns now and add icons later" | Icons are part of the design — propose them in the same batch; `upsert_property` makes it one call |
| "Default option colors / number format are fine" | "Default" is a choice you're making for them — surface it |
| "It's just a quick column add" | A new column with no icon breaks the workspace's column-icon convention — propose its icon |
| "The icon doesn't matter for a hidden/rollup column" | Every column carries one for consistency; pick one that matches its meaning |

### The Bottom Line

Every create proposes the whole object — data model, names, descriptions, views, icons, colors, formats — conforming to the nearest `AGENTS.md`, in one approval batch; then apply (`upsert_property` for columns + icons + values, `request` for the db/page + its icon/cover) and record any new convention back. Non-negotiable.

## MANDATORY — enumerate EVERY design dimension for EVERY object before the build is approved (the pre-build completeness gate)

The two rules above fire **per-object, at create-time** — so a whole build designed up front (a tracker, hub, or refactor, often via `brainstorming` + `writing-plans`) can be fully approved while every icon, cover, option colour, view sort, format, and description stays silently undecided, and the user gets a skeleton instead of a finished workspace. This gate fires **once, before the first write**, putting every per-object decision in one reviewable document.

**Applies to any build with two or more design dimensions to decide** — a multi-database tracker or hub, OR a single database that gains a view, a select/status option, a cover, or **two or more properties in one batch**. (A lone single-property add that changes no view/option/cover runs under the per-object rules above.)

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law

```
NO BUILD BEGINS UNTIL A COMPLETE DESIGN DOCUMENT — EVERY OBJECT, EVERY DIMENSION — IS PRESENTED AND APPROVED IN ONE TURN
```

Not "the user specified most of it", not "some are obvious", not "we'll decide covers at the gallery gate", not "it's just a quick tracker."

### The Gate — a Pre-build Design Document

One section per object. **Reproduce, per object, every applicable line from the two rules above** — database: name/casing/inline/description/icon/cover/parent; property: type · format · option names+colours · relation · rollup · formula+guards · column-icon · default-visibility (`upsert_property.visible`) · description; view: type · name · filter · sort · group · visible+order · gallery/board cover-source+size+fit+layout · tab-position (`references/views.md`). Each is **stated, or `none / N/A` with a reason** — a blank line is a silent skip; "default" is spelled out. Whole-build-level additions and the easily-missed:

- **Default-view rename** — name what each DB's auto `Default view` becomes AND give that renamed view its own full VIEW entry (filter/sort/group/visible) like any other; the rename supplies the name only.
- **Relation reverse property** — it is a full property: state its name (house casing/language), icon, and default visibility, not just "dual".
- **Linked views in a page body** — a linked database view embedded in a page is a full VIEW (type/filter/sort/group/visible/name/card-look), not a body-block reference.
- **page_cover galleries** — source each existing row's cover here (verified Unsplash URL via WebSearch→WebFetch→200, `references/gallery-view.md`); for a not-yet-populated DB, commit the **search query + style** and cross-check every row has a cover before the build is "done".
- **A named page's cover** (area / nav / section) is sourced HERE — the "commit at creation" exemption is for not-yet-created DB *rows* only.
- **Refactor / rebuild → a MIGRATION block** — for each existing DB: row count (`read_database`), every property that must survive (old name → new name/type), every relation to re-wire, every formula referencing an old name. A property you drop is stated `OUT OF SCOPE` with a reason. Approved in this same turn — *enumerating only the headline table and silently ignoring the others is the classic migration miss.*

**Stated, not skipped:** `none` / `no filter` / `no sort` / `all default order` are valid stated answers. `TBD`/`OR`/`somehow`/`optional`/`must-confirm` are gaps — resolve now (a location is a *specific proposed* value via `search`, never a question handed back) or mark **out of scope**. When the **user explicitly defers** a dimension ("no icons yet", "views later"), record it as **`deferred by user — out of scope`** (a stated answer) and don't re-propose it until they re-open it.

Present it, **stop and wait**. After approval, execution goes straight to the write cycle (intent + operations + preview mockup) per object — **the per-object design-brief steps of the two rules above are already satisfied by this approved document**; do not re-seek design approval.

**Verify the build matched the design — the loop isn't closed until you check.** A dimension can be approved yet silently dropped at write-time, or no-op'd by the API (a column icon the public API can't set, a formula that didn't compile). So when the build's objects are written, **re-read every one** (`describe` + `read_database`) and emit a **dimension-by-dimension audit** (designed → live) across all of them; any mismatch triggers an immediate remediation write before the build is "complete". A designed-but-undelivered dimension is the same miss, one step later.

**Collapse** to a one-sentence confirm ONLY when the user already stated EVERY line for EVERY object, verified line-by-line. The per-view and per-object collapse shortcuts **cannot proxy** for this gate; in a multi-object build they are unavailable until this document is approved.

### Red Flags — STOP, you're rationalizing

| Thought | Reality |
|---|---|
| "I'll design the aesthetics at each object's gate as I build" | Per-object gates fire AFTER the build starts — holistic review needs every dimension before the first write |
| "I enumerated all the objects, so the design is done" | Object names + types are a skeleton; every dimension (sort, icon, cover, colour, format, visibility) for each must appear |
| "Option colours can stay at Notion defaults for now" | "Defaults" = random colours the user didn't choose — state every option's name + colour (`gray` is stated; silence is not) |
| "A board is basically a table — no card settings" | A board card has cover-source / size / fit / layout like a gallery — state them |
| "I stated the reverse-property name — the relation's covered" | The reverse property is a full property: its casing/language, icon, and visibility are separate stated dimensions |
| "`Default-view rename: <Name>` covers the default view" | The rename supplies the name only; the renamed view needs its own full VIEW entry |
| "I specified the view type and name — position's obvious" | Tab-bar position is a stated dimension; creation order ≠ intended order |
| "This formula/rollup is complex — I'll mark it out of scope" | `out of scope` is for dimensions the USER deferred. A *required* computed column can't be self-deferred — give its full expression now, or block the build with "unresolved required formula — needs your call" |
| "The view-design collapse fired, so I can build that view" | The per-view collapse applies to single-view tasks only; in a multi-object build this gate supersedes it |
| "Collapse applies — they specified most of it" | Collapse needs ALL lines for ALL objects; one missing line forbids it — verify line-by-line |

### The Bottom Line

Any build with more than one dimension to decide gets one pre-build design document — every object's icon, cover (verified URL), colours, formats, descriptions, visibility, and every view's full design — approved as a whole before the first write. Approval of that document IS the per-object design approval; execution then runs the write cycle per object. Skeleton-now-aesthetics-later is the failure this stops. Non-negotiable.

## MCP tools — pick by job

This skill drives the `notion` MCP, which exposes **ten tools**. Reads default to the five readers; `request` is for writes and the endpoints readers don't cover.

| Job | Tool |
|---|---|
| The ancestral `AGENTS.md` sweep (mandatory first step) | **`read_agents_md(id)`** — one call does the whole climb + precedence; the `id` is any target (page/row/block/database/data_source) |
| Find a page or data source **by name → id** | **`search(query, object_type?)`** — compact ranked hits (`object · "title" · short id · parent`) over `POST /v1/search`; the name→id resolver, so you don't pay the raw endpoint's tens-of-KB page objects. `object_type` = `page` \| `data_source` (never `database`). Ranked, NOT exhaustive; `exhaust_all=true` pages to the end |
| Read a page or DB row — properties **and** body | **`read_page(page_id, format)`** — `markdown` (properties as YAML frontmatter + body) · `outline` (block-id tree with optional `depth`, for planning edits) · `text` · `mockup` (render the LIVE page as the canonical ASCII page mockup — the one-call way to SHOW how a page looks). Relations→titles, rollups/formulas→scalars, blocks recovered, ~22× smaller than raw JSON. Optional `include_properties=false` suppresses the YAML property frontmatter (default `true`) |
| Query DB rows — list / count / sum / grouped total | **`read_database(database_id, format, …)`** (`database_id` = the DB UUID **or** a `data_source_id`; auto-resolved) — `table` · `kv` · `tsv` · `summary` (overall or grouped totals; add `group_by` to group by a column) · `mockup` (render the live DB as the ASCII view mockup — its DEFAULT view, or pass `view` by name/id/index; samples the rows that view shows, with its filter+sorts applied). Optional `fields` to limit columns; `filter`/`sorts` are Notion objects passed verbatim; `exhaust_all=true` returns every row and **satisfies the pagination law** (row pagination only). Its output ALSO appends a `# Schema` section (every column `name · type · detail` — rollup function+relation, relation dual/single, select option count; **same granularity as `describe`** minus column icons; formula bodies elided) and a `# Views` section — both appended for the row formats only (`table`/`kv`/`tsv`/`summary`); `format:"mockup"` returns the ASCII mockup alone. (`describe` adds, on top of this, a **metadata header** — title · id · icon · parent — **and** column icons. ⚠️ A data source's own `icon` field is always `none` (even when `describe` is given a `database_id` — it resolves to the data source); the **DB icon lives on the database wrapper** — read it via `request('GET','/v1/databases/{id}')` → `icon`, not `describe`.) Row **page ids are NOT in the output** — use raw `POST /v1/data_sources/{id}/query` (`.id` per result) when you need an id (e.g. to write a relation) |
| Inspect a database's **views** (view design) | **Already in every `read_database` output** — the trailing `# Views` section dumps each view's complete config (covers/preview, card size, aspect, layout, visible/hidden props, sorts, **filters, quick_filters**, chart axes; property ids resolved to names). **NB — it lists EVERY view sharing this `data_source_id`, including views on OTHER linked-DB containers (a different `database_id` — e.g. a linked view embedded on another page), not just tabs of the queried DB. Check a view's parent `database_id` (`GET /v1/views/{id}`) before assuming it's a tab on this DB or PATCHing it.** No flag needed — the reader path for view design (raw `GET /v1/views` not needed) |
| Describe an object's **structure** — a data source's column schema **+ column icons**, or a page's icon/cover + property types | **`describe(id)`** — any id (page/row/database/data_source). Data source → **title · id · icon · parent** (metadata header; its own `icon` is always `none` — the DB icon is on the database wrapper, `GET /v1/databases/{id}`) + `name · type · detail` per column (formula bodies elided) **+ each column's icon** (best-effort private when `NOTION_TOKEN_V2` set; silently omitted otherwise — the public API can't read column icons). Page → its **public** icon, cover, title, parent + property types. Complements `read_page` (values) and `read_database` (rows). Standalone schema read; `read_database` already inlines the **types** |
| Any **write** (incl. creating/editing views via `POST`/`PATCH /v1/views`); `.parent` inspection; block-children subtrees not covered by `read_page` | **`request(method, path, body?, query?)`** — the full REST surface |
| Create/update a **property** — a database **column** (name, type, format, options+colors, description, **+ its icon, + default visibility**) or a **page property value** | **`upsert_property({ properties:[{target_id, property, value?, icon?, color?, visible?, remove?, remove_icon?}] })`** — the write-dual of `describe`, **batched** across any mix of data sources + pages. `value` = a verbatim Notion property object (a schema def for a data_source, a value for a page); `icon` sets the **column** icon and `visible` sets the property's **default visibility** (row-detail + new-view default) — both data_source-only private per-property attributes. Replaces `set_property_icon`. To READ current column icons, use `describe`; for per-VIEW column order, `order_properties` |
| Re-order a database's **properties** (order ONLY — visibility is a separate concern) | **`order_properties({ data_source_id, order:[names], targets? })`** — one `order` list applied to a composable set of `targets`: **`"all"`** = every view's column order — **all view types**, not just tables (gallery/board/list/chart card-property order too; public; incl. any linked-DB views of this data source embedded on other pages) · **`"page"`** = the canonical order (row-detail panel + new-view default — private app API) · a **view id** = one view. Default `["all"]`; `["all","page"]` = everywhere in one call. Title is kept first **only when unlisted** — to move it, list `title` (the Name property) in `order` at the desired spot; the title column **IS reorderable in table views** (live-verified 2026-06-14 — not pinned). Unlisted properties keep their relative order; each target's existing **visibility/width is PRESERVED**. **NB:** a "column" is a property rendered in a view — there's no per-property "order index"; order is a *list* (per-view `configuration.properties` and canonical `collection_page_properties`). For a property's default **visibility**, use `upsert_property.visible`; to redefine a property, `upsert_property` |
| Show a page / database / blocks in chat — a **proposal** ("how it will become") or a **post-write verification** | **`render_mockup({ mockup })`** — renders the canonical fixed-width ASCII **mockup** of any block, page, or standalone database (cover · icon · title · callouts · inline DBs as galleries/tables with view tabs + `+ New` · full-page-DB & sub-page links). The renderer OWNS alignment (display-width / emoji-safe) — you build the block model (`mockup` = one block or an array; a page is `{type:"page", title, icon?, cover?, description?, width?, children[]}`, a database is `{type:"database", database:{…}}`), it returns flawless boxes. **MANDATORY** default visual (see "paste every mockup into the chat, verbatim"); paste its output verbatim into your visible reply — the tool result is invisible to the user — never hand-draw |
| Any **other** UI-only feature the public API can't do (UI relative-date filters, private view state) | **`private_request`** — the general private app API (api/v3) escape hatch; ToS-risk, own workspace only (`references/private-api.md`) |

A manual `GET /v1/blocks/{id}/children` loop, a `GET /v1/pages/{id}` to read properties, or a `POST /query` count/sum/property-read is a **smell in a read context** — reach for a reader. (Exception: `POST /v1/data_sources/{id}/query` is still correct when you need a row's `.id` — the readers don't expose page ids.) `format` is required on **`read_page`** and **`read_database`** (the other readers take no `format`: `describe`/`read_agents_md` take only `id`; `search` takes `query`); reader output is plain text with a trailing `# …` summary line.

## Data model & versions

- API base: `https://api.notion.com/v1` — header `Notion-Version: 2026-03-11`
- SDK: the `@notionhq/client` TypeScript SDK needs **v5.12.0+** for `2026-03-11` — note this SDK is on the **5.x** line (npm-verified 2026-06: latest `5.22.0`, `5.12.0` exists), NOT the legacy 2.x; relevant only to external app developers — the bundled `notion` MCP server makes raw HTTP calls (no Notion SDK)
- Databases are queried/mutated via `/v1/data_sources/{id}` — prefer it over the **legacy** `/v1/databases/{id}` (only its **GET / PATCH** still coexist on 2026-03-11; `POST /v1/databases/{id}/query` was **removed** → `400 Invalid request URL` — use `/v1/data_sources/{id}/query`). The **data-source** endpoint covers schema `PATCH`, row queries, **and** relation targets: a relation/rollup property references a `data_source_id`, not a `database_id` (a 2026-03-11 change; pre-2026 priors that say `database_id` are stale)
- `POST /v1/databases` response → use `data_sources[0]['id']` as the data source ID; `is_inline: true` supported at creation
- Inline DB IDs (from block children, i.e. a `child_database` block id) ARE valid `database_id` values (resolve via `GET /v1/databases/{id}` → `data_sources[0].id`) but are **NOT** valid `data_source_id` values (`GET /v1/data_sources/{that-id}` → **404** "Could not find data_source" — the data_source_id is a *distinct* UUID) and NOT a valid `page_id` for `GET /pages/{id}`. (`read_database` accepts either and auto-resolves a database_id → its data_source, so the practical flow is unchanged.)
- Search API: `filter.value` accepts `'page'` or `'data_source'` — **not** `'database'` (breaking change in 2025-09-03)

**Version 2026-03-11 breaking changes** (requires SDK v5.12.0+):
1. Append-block `after` param → `position` object (see `references/blocks.md`)
2. `archived` field renamed to `in_trash` everywhere
3. `transcription` block type renamed to `meeting_notes`

---

## Auth / MCP pattern

- Tool selection → "MCP tools — pick by job" above. `request`'s `query` arg is the GET query-string — the only way to send `start_cursor`/`page_size` to `GET /v1/blocks/{id}/children` and `GET /v1/views?data_source_id=…`.
- ⚠️ **Database PROPERTY/COLUMN icons (the icon next to a column name) ARE settable** via `upsert_property` (or raw `private_request`) — the public API silently drops them — so when asked whether a property/column icon can be set via the API, the answer is **YES, never "UI-only/impossible."** Recipe → `references/private-api.md`.
- Large results (>~80k chars) overflow MCP token limit → saved to `~/.claude/projects/.../tool-results/mcp-notion-*.txt`
- Rate limit (public client): **429/503** retried for ALL methods; **502** retried for **GET/HEAD only** (writes are NEVER retried on 502 — the request may have landed). Backoff is exponential `700ms × 2^attempt` (700/1400/2800 ms), **max 4 attempts** (3 retries); a positive `Retry-After` header overrides the computed wait. (`notion-public.ts`)
- Safe inter-request pace: `time.sleep(0.03)` in loops
- **Hosted MCP** (`mcp.notion.com/mcp`): 180 req/min general, 30 req/min search; provides `notion-search`, `notion-fetch`, `notion-create-pages`, `notion-update-page`, `notion-move-pages`, `notion-duplicate-page`, `notion-create-database`, `notion-update-data-source`, `notion-create-view`, `notion-update-view`, `notion-query-data-sources` (Enterprise+AI), `notion-query-database-view` (Business+), `notion-create-comment`, `notion-get-comments`, `notion-get-teams`, `notion-get-users`, `notion-get-user`, `notion-get-self`
- **Verify token on first use**: `GET /v1/users/me` → 401 = invalid token; 403/404 = token valid but content not shared with integration

**Permission model — two layers required:**
1. Integration capability scopes (read/write/delete declared in integration settings)
2. User explicitly shares page/database with the integration via `...` > Connections menu

---

## Core endpoints

**Reads:** prefer `read_page` (pages/rows) and `read_database` (`/query`) over the raw endpoints below — they are for writes and for what the readers don't cover (see the tool table).

```
GET    /v1/data_sources/{id}              # DB schema (properties map with ids + types)
PATCH  /v1/data_sources/{id}             # add/modify/delete/rename properties
POST   /v1/data_sources/{id}/query       # query rows; body: {page_size,filter,sorts,start_cursor}
GET    /v1/databases/{id}                # resolve database_id → data_sources[0].id; also .parent
GET    /v1/pages/{id}                    # page metadata + .parent — for content/properties use read_page
PATCH  /v1/pages/{id}                    # update page properties / icon / cover / in_trash
POST   /v1/pages                         # create page or DB row
GET    /v1/pages/{id}/markdown           # PREFER read_page(page_id,"markdown"); raw GET truncates large pages + skips block recovery
PATCH  /v1/pages/{id}/markdown           # update page content via Markdown
POST   /v1/databases                     # create database — then inspect via read_database / GET /v1/data_sources/{ds}
POST   /v1/pages/{id}/move               # re-parent a page (move to a new parent page)
PATCH  /v1/databases/{id}                # move a database (set {parent}); also the legacy schema path
GET    /v1/blocks/{id}/children          # child blocks — PREFER read_page(page_id,"outline"); hand-roll only for non-page subtrees
PATCH  /v1/blocks/{id}/children         # add children — position: start | end | after_block (blocks.md); NOT just append
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
| Property shapes, reading values, **page/DB** icons & covers (for **property/column** icons use the private-API row below, NOT this one) | `references/pages-properties.md` |
| **Property/column icons** (the icon next to a column name), **authoring parse/list/relation formulas (the typed `formula2` AST)** **& other UI-only features the public API can't do** — column icons via `upsert_property`; other UI-only writes via `private_request` (never answer "impossible") | `references/private-api.md` |
| Built-in icon **name catalog** (the `{type:"icon"}` names) | `references/icon-names.md` |
| Blocks, positioning, the **reorder workaround**, Markdown content API | `references/blocks.md` |
| Views — list/create/update/delete, linked views, board/calendar/timeline/list/map/form, column visibility, **view filters & sorts** (date conditions, rollup/formula filterability) | `references/views.md` |
| **Gallery view** visual config (cover, card size, visible props) + **sourcing B&W cover images** | `references/gallery-view.md` |
| **Authoring / editing an `AGENTS.md`** playbook well (the `writing-skills` discipline, adapted to Notion) | `references/agents-md-authoring.md` |
| Charts — limits & gotchas | `references/charts.md` |
| Formulas (gotchas; **`prop().split()` folds to `[]`; parse/list/relation formulas are NOT public-API-writable → use the private `formula2` AST**; pt-BR currency) & number formatting | `references/formulas.md` |
| Relations & rollups | `references/relations-rollups.md` |
| Querying/filtering rows, search, extracting a `data_source_id` from a URL; webhooks, caching, idempotency | `references/patterns.md` |
| **Debugging an API error** (`400`/`409`/`429`/`401`/`403`, `validation_error`, permission) | `references/patterns.md` + the matching domain file above |
