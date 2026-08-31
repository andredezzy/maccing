---
name: maccing-notion
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

**Tooling in one line:** reads → `read_agents_md` / `search` (name→id) / `read_page` / `read_database` / `describe` (schema + column icons, or page/object metadata); writes and endpoints the readers don't cover → `request` (**many rows at once → one `request` with `bodies: [...]`, never a call per row**); create/update a **property** (a database column + its icon, or a page value) → `upsert_property`; re-order a database's **properties** (view columns and/or the canonical order) → `order_properties`; other UI-only writes (relative-date filters) → `private_request`. Verify any write by re-reading the live object — `read_page` / `read_database` / `describe` — never assume it landed. Full table: "[MCP tools — pick by job](#mcp-tools--pick-by-job)" below.

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

## Operate directly — act and report (no approval gate), but do ONLY what was asked

Writes do **not** require a propose-then-wait-for-approval cycle. When the user asks for a change, **make exactly that change and report it**, then verify with the narrowest read that shows the change — a fields-limited `read_database`, a pick-projected `request`, a `read_page` of just the affected row/block — never a whole-object re-read for a one-field change. This MCP exists to DO the work — not to narrate intentions and wait. **No approval gate, ever.** But act-and-report is licence to do the **requested** work directly — it is **NOT** licence to do *more*.

- **Default — act and report:** the create / update / rename / icon / cover / property / formula / view / move operations the request **entails** proceed directly; show the verified result (a live re-read after structural changes) afterward.
- **Many rows in one call — `bodies`, not a loop.** When a request entails creating or updating **more than one** row, send them together: `request` with `bodies: [ {...}, {...} ]` fires the same method+path once per entry, concurrently, and reports a per-index result. Do NOT emit one `request` per row. The write itself is cheap (~0.7s); what costs is the model turn spent deciding each call, so eighteen rows one-at-a-time is eighteen turns of latency the user waits through for work that takes one. A partial failure names the failing indices — re-send only those.
- **Reads** (`GET`, `/query`, `/search`, `AGENTS.md`) are always free.
- **Report in prose, backed by live-read evidence — NEVER hand-draw an ASCII box-art or tree rendering of Notion content as a substitute.** Describe the result in words, citing the fields you actually read back; a hand-typed rendering drifts from reality (misaligned glyphs, invented detail) and proves nothing a live read didn't already show.
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
Act directly, **no approval gate**, on **exactly what was asked** — no more, no less. Extra ideas are *suggestions in your report*, never silent writes. A live re-read after a structural change, reported in prose, is how the user reviews. Non-negotiable.

## MANDATORY — every operation runs through the agent; NEVER hand a step to the user's UI

The user installed this MCP so the AGENT performs the change. Telling them "open Notion and edit this yourself" is a failure, not a fallback — it defeats the automation's entire purpose.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law
```
NOTHING IS "UI-ONLY" UNTIL THE PRIVATE api/v3 PATH HAS BEEN TRIED — NEVER PUNT A WRITE BACK TO THE USER
```

Public REST first; when it 400s or silently folds — parse/list/**relation-read** formulas, column/property icons, block reorder, relative-date filters, default visibility — the private `api/v3` path does it via `private_request` (`saveTransactions`: `formula2` AST planting, `listAfter`/`listBefore`, schema/icon ops). **A relation-read formula with no copyable example is STILL agent-authorable** — crack the `formula2` AST by isolated probing (private-api.md → "Relation-read encoding"). Live-proof: a strength-log DB relation-read formula (a `sort → last → string-concat` over a relation) was planted entirely via the agent, zero UI.

**The rule's subject is Notion OPERATIONS — CREDENTIALS are outside it.** When the private path fails AUTH (a `401` / `getSpaces failed` on a token that previously worked), the cookie has expired: **STOP and ASK the user for a fresh `token_v2`** (private-api.md → auth warning). Asking for a credential is not the forbidden punt — the punt is handing over *work*; a credential is the user's to hand over. NEVER go get it yourself (their browser via any automation, their disk, any side channel) without their explicit permission for that specific act.

### Red Flags — STOP, you're rationalizing
| Thought | Reality |
|---|---|
| "This is UI-only — the user has to do it" | Almost nothing is. Try the private api/v3 path first. |
| "I'll just give them the formula to paste in the UI" | That IS the forbidden punt. Plant the `formula2` AST yourself. |
| "Hand-crafting the AST is error-prone, so ask the user" | A wrong relation-read AST computes empty/0 (not an error) — probe in isolation for signal, then assemble. Don't punt. |
| "It's faster if they just click it" | Speed for you ≠ the point. They installed this so they DON'T touch the UI. |
| "The token expired — I'll grab a fresh cookie from their browser myself" | A credential is NOT an operation. Ask the user for it; browser/side-channel harvesting needs their explicit permission, every time. |

### The Bottom Line
Exhaust public → private `api/v3` before ever suggesting a manual UI action. If something is truly impossible via every API path, state exactly why — never default to "you do it." Non-negotiable.

## MANDATORY — read `references/authoring.md` before you create or restyle anything

Creating, restyling, or restructuring any Notion object — a database, data
source, page, view, property, icon, or cover — is governed by five Iron Laws
that live in `references/authoring.md`: match the workspace's house style,
design every dimension of a view, design the whole object, enumerate every
design dimension before a multi-object build, and run the finishing pass before
reporting done.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law

```
BEFORE the first create/restyle/restructure call in a session:
  1. skill_view(name='maccing-notion', file_path='references/authoring.md')
  2. Read it completely.
  3. Only then create.
A write attempted without it is a violation of this skill, not a shortcut.
```

Read-only work never needs this file, which is exactly why it is not in the core:
a task that only queries should not pay for authoring rules it cannot use. The
moment a read turns into a write, the gate fires — including mid-task, when the
user follows up with a change.

If the file cannot be loaded, return `BLOCKED` and perform no write.

## MCP tools — pick by job

This skill drives the `notion` MCP, which exposes **nine tools**. Reads default to the five readers; `request` is for writes and the endpoints readers don't cover.

| Job | Tool |
|---|---|
| The ancestral `AGENTS.md` sweep (mandatory first step) | **`read_agents_md(id)`** — one call does the whole climb + precedence; the `id` is any target (page/row/block/database/data_source) |
| Find a page or data source **by name → id** | **`search(query, object_type?)`** — compact ranked hits (`object · "title" · full id · parent`) over `POST /v1/search`; the name→id resolver (ids are FULL — copy straight into read_page/read_database/describe/read_agents_md), so you don't pay the raw endpoint's tens-of-KB page objects. `object_type` = `page` \| `data_source` (never `database`). Ranked, NOT exhaustive; `exhaust_all=true` pages to the end |
| Read a page or DB row — properties **and** body | **`read_page(page_id, format)`** — `markdown` (properties as YAML frontmatter + body) · `outline` (block-id tree with optional `depth`, default 2, for planning edits) · `text` (markdown with markup stripped — also gets the YAML property frontmatter by default). Relations→titles, rollups/formulas→scalars, blocks recovered, ~22× smaller than raw JSON. Optional `include_properties=false` suppresses the YAML property frontmatter on **markdown + text** (default `true`) |
| Query DB rows — list / count / sum / grouped total | **`read_database(database_id, format, …)`** (`database_id` = the DB UUID **or** a `data_source_id`; auto-resolved) — `table` · `kv` · `tsv` · `summary` (overall or grouped totals; add `group_by` to group by a column). Optional `fields` to limit columns; `filter`/`sorts` are Notion objects passed verbatim; `exhaust_all=true` returns every row and **satisfies the pagination law** (row pagination only). Its output appends a `# Schema` section on `schema:'full'` (the **default** — every column `name · type · detail` — rollup function+relation, relation dual/single, select option count; **same granularity as `describe`** minus column icons; formula bodies elided; `schema:'none'` omits the section, e.g. once you already have the columns from an earlier `describe`/`read_database` this session) and a `# Views` section — `views:'summary'` (**default**) is one line per view; **`views:'full'`** dumps each view's complete config (view-design work, and REQUIRED before any view `PATCH`). `include_ids` (default `false`) prepends each row's page id as an `_id` column on `table`/`tsv`/`kv`. (`describe` adds, on top of this, a **metadata header** — title · id · icon · parent — **and** column icons. ⚠️ A data source's own `icon` field is always `none` (even when `describe` is given a `database_id` — it resolves to the data source); the **DB icon lives on the database wrapper** — read it via `request('GET','/v1/databases/{id}')` → `icon`, not `describe`.) |
| Inspect a database's **views** (view design) | **In every `read_database` output** — the trailing `# Views` section; pass **`views:'full'`** (REQUIRED before any view PATCH) for each view's complete config (covers/preview, card size, aspect, layout, visible/hidden props, sorts, **filters, quick_filters**, chart axes; property ids resolved to names) — the default `views:'summary'` is one line per view only. **NB — it lists EVERY view sharing this `data_source_id`, including views on OTHER linked-DB containers (a different `database_id` — e.g. a linked view embedded on another page), not just tabs of the queried DB. Check a view's parent `database_id` (`GET /v1/views/{id}`) before assuming it's a tab on this DB or PATCHing it.** No raw `GET /v1/views` needed — the reader path covers view design |
| Describe an object's **structure** — a data source's column schema **+ column icons**, or a page's icon/cover + property types | **`describe(id)`** — any id (page/row/database/data_source). Data source → **title · id · icon · parent** (metadata header; its own `icon` is always `none` — the DB icon is on the database wrapper, `GET /v1/databases/{id}`) + `name · type · detail` per column (formula bodies elided) **+ each column's icon** (best-effort private when `NOTION_TOKEN_V2` set; silently omitted otherwise — the public API can't read column icons). Page → its **public** icon, cover, title, parent + property types. Complements `read_page` (values) and `read_database` (rows). Standalone schema read; `read_database` already inlines the **types** |
| Any **write** (incl. creating/editing views via `POST`/`PATCH /v1/views`); `.parent` inspection; block-children subtrees not covered by `read_page` | **`request(method, path, body?, query?, pick?)`** — the full REST surface. Optional `pick: string[]` projects dot/bracket paths from the response body into `{path: value}` (`[]` maps an array; a missing path → `null`) |
| Create/update a **property** — a database **column** (name, type, format, options+colors, description, **+ its icon, + default visibility**) or a **page property value** | **`upsert_property({ properties:[{target_id, property, value?, icon?, color?, visible?, remove?, remove_icon?}] })`** — the write-dual of `describe`, **batched** across any mix of data sources + pages. `value` = a verbatim Notion property object (a schema def for a data_source, a value for a page); `icon` sets the **column** icon and `visible` sets the property's **new-view / card DEFAULT** visibility (the `collection_page_properties` flag) — both data_source-only private per-property attributes. ⚠️ `visible` does NOT hide a property from the **row-detail panel** (what you see when you OPEN a row) — that is a SEPARATE private collection field, `format.property_visibility` (`{property, visibility:"hide"}`); see `references/views.md`. To READ current column icons, use `describe`; for per-VIEW column order, `order_properties` |
| Re-order a database's **properties** (order ONLY — visibility is a separate concern) | **`order_properties({ data_source_id, order:[names], targets? })`** — one `order` list applied to a composable set of `targets`: **`"all"`** = every view's column order — **all view types**, not just tables (gallery/board/list/chart card-property order too; public; incl. any linked-DB views of this data source embedded on other pages) · **`"page"`** = the canonical order (row-detail panel + new-view default — private app API) · a **view id** = one view. Default `["all"]`; `["all","page"]` = everywhere in one call. Title is kept first **only when unlisted** — to move it, list `title` (the Name property) in `order` at the desired spot; the title column **IS reorderable in table views** (live-verified 2026-06-14 — not pinned). Unlisted properties keep their relative order; each target's existing **visibility/width is PRESERVED**. **NB:** a "column" is a property rendered in a view — there's no per-property "order index"; order is a *list* (per-view `configuration.properties` and canonical `collection_page_properties`). For a property's default **visibility**, use `upsert_property.visible`; to redefine a property, `upsert_property` |
| Any **other** UI-only feature the public API can't do (UI relative-date filters, private view state) | **`private_request`** — the general private app API (api/v3) escape hatch; ToS-risk, own workspace only (`references/private-api.md`). Same optional `pick` response projection as `request` |

A manual `GET /v1/blocks/{id}/children` loop, a `GET /v1/pages/{id}` to read properties, or a `POST /query` count/sum/property-read is a **smell in a read context** — reach for a reader; for a row's page id, `read_database(…, include_ids=true)`. A `request`/`private_request` call whose response won't be fully used — every write echo, a lookup needing only a few fields — passes `pick`: `pick:["id"]` on a row create, `pick:["results[].id"]` on an id query; taking the full echo unread is the **write-side smell**. `format` is required on **`read_page`** and **`read_database`** (the other readers take no `format`: `describe`/`read_agents_md` take only `id`; `search` takes `query`); reader output is plain text (the row/text formats end with a trailing `# …` summary).

## Reference files — load on demand

The heavy API reference is split into sibling files under `references/`. Load only what the task needs — not all of them; for adjacent domains, load both.

| Task | Load |
|---|---|
| **Creating, restyling, or restructuring anything** — house style, view design, whole-object design, the pre-build enumeration, the finishing pass (five Iron Laws; mandatory before the first write of a session) | `references/authoring.md` |
| The raw REST surface — API base/version, the data-source model & 2026-03-11 breaking changes, auth/MCP pattern, core endpoint paths, payload limits (load before any raw `request` write) | `references/api.md` |
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
