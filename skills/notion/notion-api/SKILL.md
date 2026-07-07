---
name: notion-api
description: 'Use BEFORE the first Notion read or write on ANY task touching Notion — the Notion API or its MCP — however trivial: a one-field rename, a page icon/cover, adding one row, a single select color, even just reading a page''s title. Covers creating, editing, querying, or moving databases, data sources, pages, views (table/board/gallery/calendar/timeline/list/chart/dashboard/map/form), formulas, rollups, relations, blocks, icons, covers; and any Notion API/MCP error (validation_error, pagination, permission, 400/409). MANDATORY, never optional — "small", "quick", "obvious", or "well-understood" is the exact trap: every Notion edit still owes this skill''s mandatory first steps (the ancestral-AGENTS.md sweep + house-style match) that a direct quick edit silently skips and corrupts. If the work touches Notion at all, load this FIRST.'
---

> ⚠️ **MANDATORY — this skill governs EVERY Notion task, no exceptions.** If the work touches Notion at all (the API or this MCP), you operate UNDER this skill BEFORE the first read or write — however small: a one-field rename, an icon/cover, one row, a single select color, even a read. **"It's trivial / quick / obvious / well-understood" is the precise rationalization that skips the mandatory first steps** (the ancestral-`AGENTS.md` sweep + house-style match) and silently corrupts the workspace. No Notion operation is too small to require this skill. **Violating the letter of this rule is violating the spirit of this rule.**

> **Using Claude Code? Install the official Notion plugin for high-level workflows.**
> [`makenotion/claude-code-notion-plugin`](https://github.com/makenotion/claude-code-notion-plugin) bundles 4 skills + `/Notion:*` slash commands over the hosted MCP (`mcp.notion.com/mcp`, OAuth). **Recommend installing it and using it for:**
> - **Knowledge Capture** — saving notes/snippets/decisions into Notion
> - **Meeting Intelligence** — meeting notes, summaries, action items
> - **Research Documentation** — collecting and structuring research
> - **Spec-to-Implementation** — turning specs/docs into implementation tasks
>
> THIS skill is the complementary **low-level engineering reference** — the Notion API/formula/rollup/relation/view/chart/block details for building & editing databases programmatically (and debugging Notion API errors).

**Tooling in one line:** reads → `read_agents_md` / `search` (name→id) / `read_page` / `read_database` / `describe` (schema + column icons, or page/object metadata); writes and endpoints the readers don't cover → `request`; create/update a **property** (a database column + its icon, or a page value) → `upsert_property`; re-order a database's **properties** (view columns and/or the canonical order) → `order_properties`; show a live page/database as the canonical ASCII mockup (`render_mockup({ page_id })` / `render_mockup({ database_id, view? })`), or preview how a proposed page/blocks/database WILL look (pass an official shape as `mockup`) — the mandatory way to show how something looks in chat → `render_mockup`; other UI-only writes (relative-date filters) → `private_request`. Full table: "[MCP tools — pick by job](#mcp-tools--pick-by-job)" below.

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

**Root bootstrap:** at the topmost ancestor (`parent.type == "workspace"`), check for an AGENTS.md. If absent, create one that records inferred workspace conventions and a hub/sub-AGENTS.md map per the conventions rule. **Authoring or editing any AGENTS.md is itself test-driven — see `references/agents-md-authoring.md` (mirrors `superpowers:writing-skills`).** This file is the global source of truth; lower AGENTS.md files override on conflict. **The sweep is bidirectional — read the closest AGENTS.md before a change, maintain the closest one after** — enforced as its own hard gate by the **MANDATORY "update the nearest `AGENTS.md` after every write"** rule immediately below (write at the right level — closest wins).

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

## MANDATORY — update the nearest `AGENTS.md` after every write (the sweep's back half)

The ancestral-`AGENTS.md` sweep is **bidirectional**. You read the nearest playbook *before* a change (the read-sweep above); you **MUST update it *after*** any change that alters what it describes. An `AGENTS.md` that still describes a structure you just changed is **actively lying** to the next agent and to the user — a dead database id, a reference to a deleted DB, a renamed thing under its old name, "five databases" when there are three, a hub that moved. Stale architecture notes are *worse* than none, because they are trusted. Maintenance is the back half of the same mandatory sweep, **not** a separate task and **never** something to wait to be asked for.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law
```
NO WRITE-TASK IS COMPLETE UNTIL THE NEAREST GOVERNING AGENTS.md REFLECTS THE NEW REALITY — SAME TASK, UNPROMPTED
```

### The Gate (run after any write that changes structure / ids / names / layout / conventions)
1. **Identify** the nearest governing `AGENTS.md` — the closest one on the root→target path that owns the changed subtree. If a higher one (e.g. the root **map**) also describes what you changed, it is in scope too.
2. **Scan it line-by-line** against what you changed: the architecture/model description and DB count, the **ID table**, property/column lists, view & layout descriptions, hub/section structure, conventions, and "X is hidden / inline / full-page" claims.
3. **Bring every touched line to the new reality** — DELETE references to deleted objects (the most misleading kind of stale), RENAME renamed ones, ADD new structure, FIX counts and positions. A change that establishes a NEW convention is recorded **as a convention**, at the right level (closest wins — `references/agents-md-authoring.md`).
4. **Verify** the playbook reads true end-to-end — no surviving mention of anything you removed or renamed, and no "disregard the section above" disclaimers left as a substitute for actually fixing the section.

**Scope:** structural / architectural writes fire this gate — create / delete / rename / move a database, property, or view; restructure blocks; change a hub or layout; establish a convention. **Pure data-row edits** (logging a value, updating a cell) don't change what the playbook describes — skip the gate for those.

### Red Flags — STOP, you're rationalizing
| Thought | Reality |
|---|---|
| "I'll update the `AGENTS.md` at the end / once the user asks" | The update is the back half of THIS write-task. Maintenance is **never** user-triggered — if you wait to be asked, the playbook is already stale. |
| "It's a small change; the playbook is still basically right" | "Basically right" with a dead id or a deleted-DB reference is **wrong** — and the next agent trusts it. |
| "I deleted the DB; the `AGENTS.md` mention is harmless" | A reference to a **deleted** object is the most misleading stale of all. Remove it. |
| "I made 10 changes — too much to reconcile" | Batch the doc update at the end of the batch; **skipping** it is the violation, not batching. |
| "Only the closest `AGENTS.md` matters" | If a higher file (the root map) also describes what you changed, it is stale too — update both. |
| "I'll add a 'disregard §X above' note instead of rewriting it" | A disclaimer is not maintenance — fix the section so it reads true. |
| "Nothing to update here" | A conclusion you reach **after** scanning the governing file against your change — never a step you skip. |

### The Bottom Line
Read the nearest `AGENTS.md` before; **UPDATE it after** — every structural write-task, the same task, unprompted, at the right level (closest wins; root only for workspace-wide). Leave no playbook describing a workspace that no longer exists. Non-negotiable.

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
  - `GET /v1/views?data_source_id=` — views (every `read_database` call dumps each view's full config; hand-roll this only for a write or a standalone per-view GET)
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

This fires for **`render_mockup`** — the ONE mockup tool (a live page/database by id, or any authored block / page / database shape) — in EVERY context that produced one: a **proposal** ("how it will become"), a **post-write verification** ("how it became"), a **bug-fix / render verification** ("confirm it renders"), or simply because the user asked to **see / show / check / confirm** something. Reading "confirm the fix" or "show me" as license to summarize is the exact failure this rule exists to stop.

NEVER hand-draw the visual instead (Unicode `├──` tree or box-art): a hand-typed mockup drifts — emoji are double-width, borders miscount, chat fonts substitute box-drawing glyphs — and the user sees broken, unclosed boxes. The renderer OWNS all alignment; you supply only structure. The rendered mockup is the DEFAULT and ONLY visual — it **replaces** the bare Unicode tree.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law

```
EVERY MOCKUP YOU PRODUCE IS PASTED VERBATIM INTO YOUR VISIBLE REPLY — A MOCKUP LEFT ONLY IN A TOOL RESULT WAS NEVER SHOWN
```

### The Gate (every time a mockup is produced)

1. **Produce the mockup with `render_mockup`** — the sole mockup renderer. For an EXISTING object, ONE call, no model: **`render_mockup({ page_id })`** or **`render_mockup({ database_id, view? })`** — it fetches + renders the live item (a database shows its real view tabs in Notion's order + the rows that view actually shows, filter+sorts applied). For a **proposal** or synthetic target, build the official shape and pass it as `mockup` (step 2). For a **post-write verification**, `render_mockup({ page_id })` re-fetches the live state, so the mockup reflects VERIFIED reality, never intention.
2. **Build the official shape ONLY for a proposal** (a live object needs just its id — step 1). `mockup` is an EXACT official Notion API shape: a **PageRender** `{ page: PageObject, blocks: BlockObject[] }` (a page + its body blocks); a single **BlockObject** or an **array of BlockObjects**; or a **DatabaseRender** `{ database, dataSource, views, rows }`. Every node is the official object keyed by `type` — e.g. a paragraph is `{ type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: "…" } }] } }`, a page title is a `title` property value. In a **proposal**, model the RESULTING object and mark each change in its own text (`← NEW`, or a note like `moved here` / `trashed`).
3. **Paste the tool's output verbatim into your visible reply.** Never edit it by hand — that re-introduces drift; fix the input and re-render.

(A bare `read_page outline` tree stays fine for your OWN block-id lookups — it is just never what you SHOW the user.)

### Red Flags — STOP, you're rationalizing

| Thought | Reality |
|---|---|
| "The user's in a hurry — a one-line confirm is enough" | The tool output is invisible; your one-liner is ALL they get. Paste the mockup. |
| "Re-printing it adds no value — they already saw it" | They did NOT see it — tool results are hidden in chat. Unpasted = never delivered. |
| "It's a fix/verification, not a page proposal" | Every produced mockup is pasted — proposal, post-write, AND fix/render verification alike. |
| "It's a database/blocks mockup, not a page" | One `render_mockup` covers all of it — a live page/database by id, or an authored page / database / bare blocks. |
| "I'll sketch the boxes by hand, it's faster" | Hand-drawn ASCII drifts (emoji width + miscounts). Use the renderer. |
| "A quick Unicode `├──` tree is enough" | The mockup is the DEFAULT; the tree is for your own id lookups, not the user. |
| "It's only a proposal, not the real page yet" | Proposals MUST show how it will become — render the target model. |
| "I'll paste the render but fix one label by hand" | Editing the output re-introduces drift. Fix the model, re-render, paste verbatim. |
| "`render_mockup` isn't loaded" | It ships with this skill's MCP server — load it; never fall back to hand-drawing. |
| "I changed structure; I'll just describe it in prose" | Every structure change ends with a re-read, rendered, verified mockup. |

### The Bottom Line

Produce a mockup (`render_mockup({ page_id | database_id })` for a live object, or build an official shape → `render_mockup({ mockup })`) → **paste its output verbatim into your visible reply.** The tool result is invisible to the user; an unpasted mockup was never shown. Proposals show how it will become; verifications (post-write OR fix) show the live result. Never hand-draw, never edit the output, never swap it for a summary. Non-negotiable.

## Operate directly — act and report (no approval gate), but do ONLY what was asked

Writes do **not** require a propose-then-wait-for-approval cycle. When the user asks for a change, **make exactly that change and report it**, then verify with a live `render_mockup` / read. This MCP exists to DO the work — not to narrate intentions and wait. **No approval gate, ever.** But act-and-report is licence to do the **requested** work directly — it is **NOT** licence to do *more*.

- **Default — act and report:** the create / update / rename / icon / cover / property / formula / view / move operations the request **entails** proceed directly; show the verified result (a `render_mockup` after structural changes) afterward.
- **Reads** (`GET`, `/query`, `/search`, `AGENTS.md`) are always free.
- **One carve-out — irreversible data loss:** before a **permanent delete, or a trash/archive that removes data and can't be cleanly undone**, give a one-line heads-up. Basic prudence before destruction, not an approval gate — it never applies to routine creates/edits.
- **The user's instructions / governing `AGENTS.md` win.** If the user (in chat or a playbook) sets a different write protocol, follow it over this default.

### MANDATORY — the scope boundary (the half that's easy to forget)

**The writes you perform = EXACTLY what the user's request entails. Nothing extra.** Do NOT, on your own judgement, create unrequested objects or take unrequested "prudent" steps — **no backups, no safety/pre-refactor copies, no archive pages, no helper databases, no extra properties/views/rows** the user didn't ask for. If you believe an extra step is genuinely worth doing, **say so in your report as a one-line suggestion** — never perform it. This is the OTHER side of "no approval gate": you don't *wait* for permission, and you don't *take* unrequested scope either.

**Violating the letter of this rule is violating the spirit of this rule.** "Acting directly" never widens the scope.

#### Red flags — STOP, you're about to over-reach
| Thought | Reality |
|---|---|
| "I'll back this up first, just in case" | The user didn't ask for a backup. Don't create one — *suggest* it in your report. |
| "A safety / pre-refactor copy is prudent before this restructure" | Prudence ≠ permission to add objects. Do the asked change; offer the safeguard as a note. |
| "While I'm here I'll also add this helper DB / property / view" | Scope = the request. Anything the user didn't ask for is scope creep. |
| "It clearly serves the task, so I'll just do it" | "Serves the task" is the exact rationalization that adds unrequested work. Didn't ask → don't do → suggest. |
| "Acting directly means I can do whatever helps" | Acting directly = do the REQUEST directly, no approval gate. It does not enlarge the scope. |

### The bottom line
Act directly, **no approval gate**, on **exactly what was asked** — no more, no less. Extra ideas are *suggestions in your report*, never silent writes. The verified mockup after a structural change is how the user reviews. Non-negotiable.

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
- **Language** — pt-BR, EN, or a deliberate mix (e.g. navigation labels in one language, data-property names in another)?
- **Singular vs plural** — collection/DB names: "Task" or "Tasks", "Month" or "Months"?
- **Hub patterns** — inline DBs with an "X Navigation" header, full-page DBs, linked views, dashboard layouts?
- **Icon/emoji style** — infer which type is used where (`emoji` vs Notion named `icon`) and which color palette applies to which category of page (cross-ref: "Icons, emoji & covers"). **Fixed exception: every `AGENTS.md` page uses the 🤖 emoji icon — a signature marking the agent playbook, independent of the surrounding house style.**
- **Cover style** — external URLs, Notion gradient covers (`https://www.notion.so/images/page-cover/…`), none?
- **Inline vs full-page** — are child DBs always inline, always full-page, or context-dependent?

**How to infer** — in priority order:

1. **Root AGENTS.md first** (cross-ref: "MANDATORY FIRST STEP — read every ancestral AGENTS.md"). If it exists at the topmost workspace ancestor, it is the canonical house-style source of truth.
2. **Bounded paginated live sample** when no root AGENTS.md exists: fetch the root hub page + 1–2 levels of children, fully paginated (`page_size=100`, exhaust all cursors — cross-ref: "MANDATORY — exhaust every paginated list"). That sample is the evidence base; do not generalize beyond it without reading further.

### MANDATORY — write new content in the workspace's language; never introduce a second one

The inferred **language** is a hard default, not a hint. **All new content you create — area/page/database/property/view names, select-option labels, headings, callouts, descriptions — goes in the language already in use**. **NEVER introduce a second language on your own** — not because the user lives in that locale, not because it "feels natural," not because a data SOURCE is in it.

**Foreign-language source data is the trap:** when you seed or import from a source in another language (a Portuguese-language food database, a Spanish API…), **translate the values into the workspace language as you import** — do not pour the source's language into the workspace. The only things that stay in the source language are genuine proper nouns with no translation, or content the user EXPLICITLY says to keep.

**Violating the letter of this rule is violating the spirit of this rule.**

| Thought | Reality |
|---|---|
| "The user is Brazilian, so pt-BR labels feel natural" | Match the workspace's established language, not the user's locale — infer from the root AGENTS.md or a live sample. |
| "The source data is in a foreign language, so its groups/names should be too" | Translate the source into the workspace language on import — never import its language. |
| "A pt-BR/EN mix is fine here" | Only if the workspace ALREADY does a deliberate, documented mix. Otherwise it's one language — don't invent a mix. |
| "I'll build it in pt-BR now and translate later if needed" | Building in the wrong language forces a full rework. Default to the workspace language from the first glyph. |

### Flag-then-follow on explicit user conflict

When the user's instruction deviates from inferred conventions (e.g. user says "Backup" but every existing collection is plural like "Backups", "Months"), **do both**:

1. **FLAG** the deviation in your report — one sentence: `"Note: existing collections are plural ("Backups", "Months") — using your wording "Backup" instead."`
2. **FOLLOW the user's explicit wording** — the flag is informational only; it must never become a negotiation.

### Maintain the nearest governing `AGENTS.md` — after every change

**Enforcement** of after-every-write maintenance is its own MANDATORY hard gate above — **"update the nearest `AGENTS.md` after every write."** What this section adds is *where* that update is written — the LEVEL:

**Write at the right level — closest wins, exactly like reads:**
- **Subtree-local** convention (e.g. "Category rows use gray icons", "this tracker's Months view sorts descending") → the **nearest** ancestor `AGENTS.md` that owns that subtree (the area/hub playbook), **NOT** root.
- **Workspace-wide** convention → the **root** `AGENTS.md`.
- No `AGENTS.md` yet at the level a subtree-local convention belongs → **create one there** (author it test-driven per `references/agents-md-authoring.md`).

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

## MANDATORY — design every dimension of a view before creating it (no silent defaults)

Creating or restyling **any** view is a design decision in two layers: its **data shape** — view type, filter (which rows), sort (order), grouping (`group_by`), which properties are visible and their order, and a self-describing name — **and** its **appearance** — cover source, card size, fit-image, card layout, per-property width. Decide every dimension deliberately before any API call, then act and report. The user lives inside a view daily and sees it instantly; an imposed sort, filter, or grouping is as wrong as an imposed cover.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law

```
NO VIEW CREATE OR RESTYLE UNTIL EVERY DIMENSION — DATA SHAPE *AND* LOOK — IS DECIDED; THEN ACT DIRECTLY AND REPORT THE RESULT
```

Not for "obvious" covers, not for "it's just a table", not when defaults look fine, not when the user said "make it look nice" or merely "add a view".

### What counts as a design choice

- **Data shape (EVERY view, including a plain table):** view **type** (`table`/`board`/`gallery`/`calendar`/`timeline`/`list`/`chart` + `dashboard`/`map`/`form` — see `references/views.md`) · **filter** — which rows show · **sort** — property + direction · **grouping** — `group_by` (board columns, sub-groups) · which **properties** are visible + their order · the view **name** (self-describing — never leave `Default view`) · the view **icon** (the switcher-tab icon — a gray named icon, like every property/column gets one; private `collection_view_icon`). Field reference: `references/views.md`.
- **Appearance (visual view types — gallery/board cards):** cover source (`page_cover` / `page_content` / a Files-&-media property / none) · card size (small/medium/large) · fit-image (`contain` vs `cover`/crop) · card layout (`list` vs `compact`) · per-property width. Field reference: `references/gallery-view.md`.

### The Self-Check

Before writing, mentally verify every applicable dimension — **one decision per applicable line**: type · filter · sort · grouping · visible properties · name; plus cover · size + aspect · card layout for visual types. **State EVERY applicable dimension explicitly — especially `sort` and `visible properties`, the two most often silently dropped.** "No sort / Notion default order" and "all properties, default order" are valid decisions — but they must be *decided*, never silently skipped: **if your internal check has no `sort:` decision, you skipped it.** Never bury a sort/filter/group inside the payload without deciding it.

After writing, report the decisions made and paste the verified `render_mockup`.

### Red Flags — STOP, you're rationalizing

| Thought | Reality |
|---|---|
| "It's just a table — nothing to brainstorm" | Type, filter, sort, and visible props are all choices, even for a plain table |
| "A board obviously groups by Status" | Grouping is a design choice — offer Status vs Priority vs Assignee |
| "I'll just sort by created date" | A default sort IS a decision — surface it, don't bury it in the payload |
| "This view doesn't need a sort, so I won't mention it" | Omitting a dimension = deciding it silently. Every applicable line (sort, visible props) MUST appear — "none/default" is a stated answer, not a skip |
| "'Current sprint' implies the filter" | Which property = which value? Name it and confirm — never guess a filter |
| "'Create a gallery' implies large covers" | Implicit intent ≠ a decided dimension — decide it explicitly before writing |
| "Defaults are fine, skip the brief" | "Default" is a design decision you're making for them — surface it |

### The Bottom Line

Decide every dimension (type, filter, sort, grouping, visible props, name — plus cover/size/aspect/layout for visual views) before writing, then act directly and report; verify with `render_mockup` after. Non-negotiable.

## MANDATORY — design the whole object before creating it (logical *and* aesthetic)

Creating any structure-bearing object — a **database** (and its underlying data source), a **page**, or **new properties** on one — is a design act. Decide EVERY logical AND aesthetic choice before the first `POST`/`PATCH`, then create it directly and report. A column with no icon, a select with default colors, an unformatted number: each is a decision made silently for the user.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law

```
NO CREATE (data source, page, or property) UNTIL ITS FULL DESIGN — LOGICAL + AESTHETIC — IS DECIDED; THEN ACT DIRECTLY AND REPORT
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

Every create decides the whole object — data model, names, descriptions, views, icons, colors, formats — conforming to the nearest `AGENTS.md`; then apply directly in one batch (`upsert_property` for columns + icons + values, `request` for the db/page + its icon/cover), report the result, and record any new convention back. Non-negotiable.

## MANDATORY — enumerate EVERY design dimension for EVERY object before the build begins (the pre-build completeness self-check)

The two rules above fire **per-object, at create-time** — so a whole build designed up front (a tracker, hub, or refactor, often via `brainstorming` + `writing-plans`) can proceed while every icon, cover, option colour, view sort, format, and description stays silently undecided, and the user gets a skeleton instead of a finished workspace. This self-check fires **once, before the first write**, ensuring every per-object decision is made before touching the API.

**Applies to any build with two or more design dimensions to decide** — a multi-database tracker or hub, OR a single database that gains a view, a select/status option, a cover, or **two or more properties in one batch**. (A lone single-property add that changes no view/option/cover runs under the per-object rules above.)

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law

```
NO BUILD BEGINS UNTIL EVERY OBJECT × EVERY DIMENSION IS DECIDED — NO SILENT DEFAULTS, NO SKELETON-NOW-DETAILS-LATER
```

Not "the user specified most of it", not "some are obvious", not "we'll decide covers at the gallery gate", not "it's just a quick tracker."

### The Self-Check — a Pre-build Design Document (internal, then act)

One section per object. **Decide, per object, every applicable line from the two rules above** — database: name/casing/inline/description/icon/cover/parent; property: type · format · option names+colours · relation · rollup · formula+guards · column-icon · default-visibility (`upsert_property.visible`) · description; view: type · name · icon (the tab icon — `collection_view_icon`, private) · filter · sort · group · visible+order · gallery/board cover-source+size+fit+layout · tab-position (`references/views.md`). Each is **stated, or `none / N/A` with a reason** — a blank line is a silent skip; "default" is spelled out. Whole-build-level additions and the easily-missed:

- **Default-view rename** — name what each DB's auto `Default view` becomes AND give that renamed view its own full VIEW entry (filter/sort/group/visible) like any other; the rename supplies the name only.
- **Relation reverse property** — it is a full property: state its name (house casing/language), icon, and default visibility, not just "dual".
- **Linked views in a page body** — a linked database view embedded in a page is a full VIEW (type/filter/sort/group/visible/name/card-look), not a body-block reference.
- **page_cover galleries** — source each existing row's cover here (verified Unsplash URL via WebSearch→WebFetch→200; the sourcing loop + cover taste live in `references/visual-design.md`); for a not-yet-populated DB, commit the **search query + style** and cross-check every row has a cover before the build is "done".
- **A named page's cover** (area / nav / section) is sourced HERE — the "commit at creation" exemption is for not-yet-created DB *rows* only.
- **Refactor / rebuild → a MIGRATION block** — for each existing DB: row count (`read_database`), every property that must survive (old name → new name/type), every relation to re-wire, every formula referencing an old name. A property you drop is stated `OUT OF SCOPE` with a reason. All decided in this same self-check turn — *enumerating only the headline table and silently ignoring the others is the classic migration miss.*

**Stated, not skipped:** `none` / `no filter` / `no sort` / `all default order` are valid stated answers. `TBD`/`OR`/`somehow`/`optional`/`must-confirm` are gaps — resolve now (a location is a *specific proposed* value via `search`, never a question handed back) or mark **out of scope**. When the **user explicitly defers** a dimension ("no icons yet", "views later"), record it as **`deferred by user — out of scope`** (a stated answer) and don't re-propose it until they re-open it.

Once every dimension is decided, **build directly** — create each object and verify with a `render_mockup` / read **after**; do not pause between objects.

**This is a SELF-check, not an approval gate — and a dimension the user didn't specify is YOUR call, never a reason to wait.** When the user hasn't stated a dimension, **you decide a sensible default that conforms to the nearest `AGENTS.md` / house style, and build.** "The user gave no property names / icons / colours / view sorts" is NOT a reason to present a design and wait for sign-off — decide them and act. The only thing that ever pauses you is a *genuinely consequential, genuinely ambiguous* choice with no sensible default — then ask **one specific question** (a question, not a design-for-approval). **Never present the full design and wait for a go.**

| Thought | Reality |
|---|---|
| "The user gave no dimensions, so I'll present a design and wait" | A missing dimension is YOUR decision (sensible default + nearest `AGENTS.md`). Decide it and build — not a gate. |
| "It's a multi-database build, so I should get approval first" | Multi-object → do the self-check (decide every dimension), then build directly. No approval, ever. |
| "I'll show the full plan and wait for the go-ahead" | That's the banned approval gate. Decide → act → report. A single specific question for genuine ambiguity is fine; a design-for-sign-off is not. |

**Verify the build matched the design — the loop isn't closed until you check.** A dimension can be decided yet silently dropped at write-time, or no-op'd by the API (a column icon the public API can't set, a formula that didn't compile). So when the build's objects are written, **re-read every one** (`describe` + `read_database`) and emit a **dimension-by-dimension audit** (designed → live) across all of them; any mismatch triggers an immediate remediation write before the build is "complete". A designed-but-undelivered dimension is the same miss, one step later.

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

Any build with more than one dimension to decide requires a complete internal self-check before the first write — every object's icon, cover (verified URL), colours, formats, descriptions, visibility, and every view's full design decided as a whole. Once the self-check is complete, build directly and report. Skeleton-now-aesthetics-later is the failure this stops. Non-negotiable.

## MANDATORY — the FINISHING PASS: before "done", verify what `render_mockup` CANNOT show

The pre-build self-check above designs every dimension; this fires at the **other end** — **before you tell the user a page / hub / view is complete.** The recurring failure: the functional build is finished, `render_mockup` is run, the ASCII "looks fine," and it's declared done — but the ASCII **cannot render the very things that are usually wrong**, so "the render looked fine" becomes false confidence and the user is left to catch each gap one by one. Every rule below ALREADY lives in the references; the miss is never *knowing* them — it's never *running the pass*. This is the forcing function.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law
```
"render_mockup LOOKS FINE" IS NOT "DONE" — RUN THE FINISHING PASS AGAINST THE LIVE CONFIG BEFORE REPORTING ANY PAGE / HUB / VIEW COMPLETE
```

### What `render_mockup` CANNOT show — confirm each against the LIVE config, not the mockup
| Invisible in the ASCII | Confirm via | Rule |
|---|---|---|
| Gallery **card covers** (coverless vs shown) | `read_database` → Views: `configuration.cover == {type:"page_cover"}` (+ `cover_size`/`cover_aspect`) | a gallery is **coverless by default** — rows HAVING covers is not enough (gallery-view.md) |
| A **leftover default view** / gallery-vs-table tabs | `read_database` → Views list | a nav hub is the **gallery ONLY** — DELETE the auto `Table` / `Default view` (gallery-view.md) |
| **Multi-bucket = N stacked DBs vs ONE tabbed block** | `read_page` outline → count `child_database` blocks per section | time/status slices of one DB are TABS on ONE linked block (views.md) |
| Real **block spacing** | `read_page` outline → the block sequence | an empty `paragraph` between EVERY back-to-back section — callout↔first block, a DB↔the next block (heading / page-link / DB), stacked views (visual-design.md §4) |
| **Inline vs link** (`↗`) | block `.parent == the page` AND `is_inline` | a moved DB renders as a link unless re-parented (blocks.md) |
| **Column widths** / truncated headers | `read_database` → Views: each visible column `width` fits its header | (views.md → Column width) |
| **Hidden collection name** + **peek mode** | `getRecordValues` on the `collection_view` `format` | nav-hub views hide the name + open Full page (views.md) |
| **View tab icons** | `getRecordValues` → `format.collection_view_icon` | EVERY view tab has a gray named icon — private-only (views.md) |

### The pass — apply, then confirm each row above from the live config
1. **Spacing** — an empty paragraph between every back-to-back section (no two block-level sections touch).
2. **Galleries** — covers ON (`page_cover` + size + aspect); the hub is the gallery ONLY (leftover default view deleted); collection name hidden + Full-page peek (nav hubs).
3. **Multi-bucket views** — ONE tabbed linked block per domain, never N stacked blocks.
4. **Columns** — table widths fit their headers.
5. **THEN** `render_mockup` + paste it (the paste gate) — but every item above is confirmed from the live config, because the mockup can't show them.

### Red Flags — STOP, you're rationalizing
| Thought | Reality |
|---|---|
| "`render_mockup` looks fine, so it's done" | The ASCII can't show covers, spacing, tabs, inline-vs-link, or widths — the usual breakages. Confirm them against the live config. |
| "The cards have covers — the rows have page covers" | The **view** must enable `cover:{type:"page_cover"}`; a default gallery is coverless even when every row has a cover. |
| "I spaced the main sections" | EVERY boundary gets a spacer — including callout↔first block and last-DB↔page-link, not just the obvious ones. |
| "The gallery works; the extra Table tab is harmless" | A nav hub is gallery-ONLY — delete the leftover default view. |
| "It's the same data four ways; four blocks is fine" | Four filters of one DB = four TABS on one block, not four blocks. |
| "I'll let the user catch what's off" | Each thing the user points out is one this pass would have caught. Run it before reporting, every time. |

### The Bottom Line
A page/hub/view is "done" only after the finishing pass — spacers at every boundary, galleries covered + gallery-only + name-hidden, multi-bucket as tabs, columns fitting — each confirmed from the LIVE config, because `render_mockup` shows none of it. "The render looked fine" is the exact failure this stops. Non-negotiable.

## MANDATORY — every operation runs through the agent; NEVER hand a step to the user's UI

The user installed this MCP so the AGENT performs the change. Telling them "open Notion and edit this yourself" is a failure, not a fallback — it defeats the automation's entire purpose.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law
```
NOTHING IS "UI-ONLY" UNTIL THE PRIVATE api/v3 PATH HAS BEEN TRIED — NEVER PUNT A WRITE BACK TO THE USER
```

Public REST first; when it 400s or silently folds — parse/list/**relation-read** formulas, column/property icons, block reorder, relative-date filters, default visibility — the private `api/v3` path does it via `private_request` (`saveTransactions`: `formula2` AST planting, `listAfter`/`listBefore`, schema/icon ops). **A relation-read formula with no copyable example is STILL agent-authorable** — crack the `formula2` AST by isolated probing (private-api.md → "Relation-read encoding"). Live-proof: a strength-log DB relation-read formula (a `sort → last → string-concat` over a relation) was planted entirely via the agent, zero UI.

### Red Flags — STOP, you're rationalizing
| Thought | Reality |
|---|---|
| "This is UI-only — the user has to do it" | Almost nothing is. Try the private api/v3 path first. |
| "I'll just give them the formula to paste in the UI" | That IS the forbidden punt. Plant the `formula2` AST yourself. |
| "Hand-crafting the AST is error-prone, so ask the user" | A wrong relation-read AST computes empty/0 (not an error) — probe in isolation for signal, then assemble. Don't punt. |
| "It's faster if they just click it" | Speed for you ≠ the point. They installed this so they DON'T touch the UI. |

### The Bottom Line
Exhaust public → private `api/v3` before ever suggesting a manual UI action. If something is truly impossible via every API path, state exactly why — never default to "you do it." Non-negotiable.

## MCP tools — pick by job

This skill drives the `notion` MCP, which exposes **ten tools**. Reads default to the five readers; `request` is for writes and the endpoints readers don't cover.

| Job | Tool |
|---|---|
| The ancestral `AGENTS.md` sweep (mandatory first step) | **`read_agents_md(id)`** — one call does the whole climb + precedence; the `id` is any target (page/row/block/database/data_source) |
| Find a page or data source **by name → id** | **`search(query, object_type?)`** — compact ranked hits (`object · "title" · full id · parent`) over `POST /v1/search`; the name→id resolver (ids are FULL — copy straight into read_page/read_database/describe/read_agents_md), so you don't pay the raw endpoint's tens-of-KB page objects. `object_type` = `page` \| `data_source` (never `database`). Ranked, NOT exhaustive; `exhaust_all=true` pages to the end |
| Read a page or DB row — properties **and** body | **`read_page(page_id, format)`** — `markdown` (properties as YAML frontmatter + body) · `outline` (block-id tree with optional `depth`, default 2, for planning edits) · `text` (markdown with markup stripped — also gets the YAML property frontmatter by default). Relations→titles, rollups/formulas→scalars, blocks recovered, ~22× smaller than raw JSON. Optional `include_properties=false` suppresses the YAML property frontmatter on **markdown + text** (default `true`). To SHOW the page as a mockup → `render_mockup({ page_id })` |
| Query DB rows — list / count / sum / grouped total | **`read_database(database_id, format, …)`** (`database_id` = the DB UUID **or** a `data_source_id`; auto-resolved) — `table` · `kv` · `tsv` · `summary` (overall or grouped totals; add `group_by` to group by a column). Optional `fields` to limit columns; `filter`/`sorts` are Notion objects passed verbatim; `exhaust_all=true` returns every row and **satisfies the pagination law** (row pagination only). Its output ALWAYS appends a `# Schema` section (every column `name · type · detail` — rollup function+relation, relation dual/single, select option count; **same granularity as `describe`** minus column icons; formula bodies elided) and a `# Views` section. To SHOW the database as a mockup → `render_mockup({ database_id })` (its default view, or pass `view`). (`describe` adds, on top of this, a **metadata header** — title · id · icon · parent — **and** column icons. ⚠️ A data source's own `icon` field is always `none` (even when `describe` is given a `database_id` — it resolves to the data source); the **DB icon lives on the database wrapper** — read it via `request('GET','/v1/databases/{id}')` → `icon`, not `describe`.) Row **page ids are NOT in the output** — use raw `POST /v1/data_sources/{id}/query` (`.id` per result) when you need an id (e.g. to write a relation) |
| Inspect a database's **views** (view design) | **Already in every `read_database` output** — the trailing `# Views` section dumps each view's complete config (covers/preview, card size, aspect, layout, visible/hidden props, sorts, **filters, quick_filters**, chart axes; property ids resolved to names). **NB — it lists EVERY view sharing this `data_source_id`, including views on OTHER linked-DB containers (a different `database_id` — e.g. a linked view embedded on another page), not just tabs of the queried DB. Check a view's parent `database_id` (`GET /v1/views/{id}`) before assuming it's a tab on this DB or PATCHing it.** No flag needed — the reader path for view design (raw `GET /v1/views` not needed) |
| Describe an object's **structure** — a data source's column schema **+ column icons**, or a page's icon/cover + property types | **`describe(id)`** — any id (page/row/database/data_source). Data source → **title · id · icon · parent** (metadata header; its own `icon` is always `none` — the DB icon is on the database wrapper, `GET /v1/databases/{id}`) + `name · type · detail` per column (formula bodies elided) **+ each column's icon** (best-effort private when `NOTION_TOKEN_V2` set; silently omitted otherwise — the public API can't read column icons). Page → its **public** icon, cover, title, parent + property types. Complements `read_page` (values) and `read_database` (rows). Standalone schema read; `read_database` already inlines the **types** |
| Any **write** (incl. creating/editing views via `POST`/`PATCH /v1/views`); `.parent` inspection; block-children subtrees not covered by `read_page` | **`request(method, path, body?, query?)`** — the full REST surface |
| Create/update a **property** — a database **column** (name, type, format, options+colors, description, **+ its icon, + default visibility**) or a **page property value** | **`upsert_property({ properties:[{target_id, property, value?, icon?, color?, visible?, remove?, remove_icon?}] })`** — the write-dual of `describe`, **batched** across any mix of data sources + pages. `value` = a verbatim Notion property object (a schema def for a data_source, a value for a page); `icon` sets the **column** icon and `visible` sets the property's **new-view / card DEFAULT** visibility (the `collection_page_properties` flag) — both data_source-only private per-property attributes. ⚠️ `visible` does NOT hide a property from the **row-detail panel** (what you see when you OPEN a row) — that is a SEPARATE private collection field, `format.property_visibility` (`{property, visibility:"hide"}`); see `references/views.md`. To READ current column icons, use `describe`; for per-VIEW column order, `order_properties` |
| Re-order a database's **properties** (order ONLY — visibility is a separate concern) | **`order_properties({ data_source_id, order:[names], targets? })`** — one `order` list applied to a composable set of `targets`: **`"all"`** = every view's column order — **all view types**, not just tables (gallery/board/list/chart card-property order too; public; incl. any linked-DB views of this data source embedded on other pages) · **`"page"`** = the canonical order (row-detail panel + new-view default — private app API) · a **view id** = one view. Default `["all"]`; `["all","page"]` = everywhere in one call. Title is kept first **only when unlisted** — to move it, list `title` (the Name property) in `order` at the desired spot; the title column **IS reorderable in table views** (live-verified 2026-06-14 — not pinned). Unlisted properties keep their relative order; each target's existing **visibility/width is PRESERVED**. **NB:** a "column" is a property rendered in a view — there's no per-property "order index"; order is a *list* (per-view `configuration.properties` and canonical `collection_page_properties`). For a property's default **visibility**, use `upsert_property.visible`; to redefine a property, `upsert_property` |
| Show a page / database / blocks in chat — a **live** item, a **proposal** ("how it will become"), or a **post-write verification** | **`render_mockup({ page_id \| database_id \| mockup })`** — the ONE mockup renderer. **Live:** pass `page_id` or `database_id` (+ optional `view`, `width`, `depth`) — it fetches + renders (a database shows its real view tabs + the rows that view shows, filter+sorts applied). **Proposal:** pass `mockup` = an EXACT official Notion shape — a `PageRender` `{ page: PageObject, blocks: BlockObject[] }`, a single `BlockObject`, a `BlockObject[]`, or a `DatabaseRender` `{ database, dataSource, views, rows }`. The renderer OWNS alignment (display-width / emoji-safe) — you supply only structure; it returns flawless box-art (cover · icon · title · callouts · child-page/database refs). **Every mockup is self-fencing** — the renderer already wraps the box-art in a code fence (backtick-safe, so an embedded code block can't break out), so paste it verbatim and NEVER wrap it in your own fence. A **database** additionally renders a bold markdown header (`◷ **Title**` then a `Views:` line with the SELECTED view in real **bold**) as PROSE *above* that fenced grid — bold shows only OUTSIDE a fence — so that header is part of the verbatim output too. **MANDATORY** default visual (see "paste every mockup into the chat, verbatim"); paste its output verbatim into your visible reply — the tool result is invisible to the user — never hand-draw. ⚠️ **It CANNOT distinguish an inline database from a LINK/reference to one** (it fetches and renders a linked DB's content as if inline) — to verify a view is genuinely inline (not a `↗` link), check the block's `.parent` + `is_inline`, not the mockup (`references/blocks.md`) |
| Any **other** UI-only feature the public API can't do (UI relative-date filters, private view state) | **`private_request`** — the general private app API (api/v3) escape hatch; ToS-risk, own workspace only (`references/private-api.md`) |

A manual `GET /v1/blocks/{id}/children` loop, a `GET /v1/pages/{id}` to read properties, or a `POST /query` count/sum/property-read is a **smell in a read context** — reach for a reader. (Exception: `POST /v1/data_sources/{id}/query` is still correct when you need a row's `.id` — the readers don't expose page ids.) `format` is required on **`read_page`** and **`read_database`** (the other readers take no `format`: `describe`/`read_agents_md` take only `id`; `search` takes `query`); reader output is plain text (the row/text formats end with a trailing `# …` summary).

## Data model & versions

- API base: `https://api.notion.com/v1` — header `Notion-Version: 2026-03-11`
- SDK: the `@notionhq/client` TypeScript SDK needs **v5.12.0+** for `2026-03-11` — note this SDK is on the **5.x** line (npm-verified 2026-06: latest `5.22.0`, `5.12.0` exists), NOT the legacy 2.x; relevant only to external app developers — the bundled `notion` MCP server makes raw HTTP calls (no Notion SDK)
- Databases are queried/mutated via `/v1/data_sources/{id}` — prefer it over the **legacy** `/v1/databases/{id}` (only `GET /v1/databases/{id}` — for id-resolution and `.parent` — and `PATCH /v1/databases/{id}` — for property mutations and DB moves — still coexist on 2026-03-11; `POST /v1/databases/{id}/query` was **removed** → `400 Invalid request URL` — use `/v1/data_sources/{id}/query`). The **data-source** endpoint covers schema `PATCH`, row queries, **and** relation targets: a relation/rollup property references a `data_source_id`, not a `database_id` (a 2026-03-11 change; pre-2026 priors that say `database_id` are stale)
- `POST /v1/databases` response → use `data_sources[0]['id']` as the data source ID; `is_inline: true` supported at creation
- **Create a DB row** with `POST /v1/pages` `parent: { type: "data_source_id", data_source_id }` — **NOT** `{ database_id }` (400 on 2026-03-11). **This binds external scripts / SDK / seed code you write, too:** query `/v1/data_sources/{id}/query`, create rows with a `data_source_id` parent, read a schema via `GET /v1/data_sources/{id}` — **never** the legacy `/v1/databases/{id}` query/parent/GET-schema paths. A seed or import script that hits `/databases/{id}/query` or uses a `{ database_id }` page parent **will 400** (`invalid_request_url` / `validation_error`). (Live-verified 2026-06-19: a food-data seed script failed twice on exactly these before being corrected to `/data_sources`.)
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
- Don't hand-roll inter-request `sleep` — both clients pace/back off internally (the private client auto-paces a 280 ms min interval + adaptive cooldown; the public client retries 429/503 with exponential backoff, above)
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
| Views — list/create/update/delete, linked views, board/calendar/timeline/list/chart/dashboard/map/form, column visibility, **view filters & sorts** (date conditions, rollup/formula filterability) | `references/views.md` |
| **Design / aesthetics / taste** — the *which / when / why* of covers (B&W Unsplash + sourcing loop), icons, gallery look, **the KPI stat-tile pattern**, layout & spacing, visual hierarchy, colour, hub/dashboard patterns (the mechanics live in the rows below) | `references/visual-design.md` |
| **Gallery view** visual config (cover, card size, visible props) — API mechanics | `references/gallery-view.md` |
| **Authoring / editing an `AGENTS.md`** playbook well (the `writing-skills` discipline, adapted to Notion) | `references/agents-md-authoring.md` |
| Charts — limits & gotchas | `references/charts.md` |
| Formulas (gotchas; **`prop().split()` folds to `[]` — use compiled-token workaround for display-only storage (public API); relation-read formulas (`current.prop()`/`.last().prop()`) are NOT public-API-writable → private `formula2` AST required**; arithmetic over a parsed list also requires private AST; pt-BR currency) & number formatting | `references/formulas.md` |
| Relations — shapes, dual & the one-sided-desync trap, the ~25-item read cap, **reading a relation in a formula** (list-ops + the latest-value-by-date flagship), **auto-linking new rows to a card** (template + blue-"New"-button gotcha), & rollups | `references/relations.md` |
| Querying/filtering rows, search, extracting a `data_source_id` from a URL; webhooks, caching, idempotency | `references/patterns.md` |
| **Debugging an API error** (`400`/`409`/`429`/`401`/`403`, `validation_error`, permission) | `references/patterns.md` + the matching domain file above |
