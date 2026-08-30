# Authoring: house style, design, and the finishing pass

Everything here fires when you **create, restyle, or restructure** a Notion
object — a database, data source, page, view, property, icon, or cover. None of
it applies to a read.

`SKILL.md` sends you here before the first such operation, and the rules below
are as binding as the ones that stayed in the core file: same Iron Laws, same
letter-and-spirit clause, unchanged wording. They live in a separate file
because a read-only task pays for every character of the core file on every
model call, and a task that never writes should not carry authoring rules it
cannot use.

If you are about to create or restyle anything and have not read this file in
the current session, stop and read it now.

---

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

After writing, report the decisions made and confirm them via a live re-read (`read_database` / `describe`).

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

Decide every dimension (type, filter, sort, grouping, visible props, name — plus cover/size/aspect/layout for visual views) before writing, then act directly and report; verify with a live re-read (`read_database` / `describe`) after — the narrowest-read rule from act-and-report applies. Non-negotiable.


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

Once every dimension is decided, **build directly** — create each object and verify with a live re-read (`describe` / `read_database`) **after**; do not pause between objects.

**This is a SELF-check, not an approval gate — and a dimension the user didn't specify is YOUR call, never a reason to wait.** When the user hasn't stated a dimension, **you decide a sensible default that conforms to the nearest `AGENTS.md` / house style, and build.** "The user gave no property names / icons / colours / view sorts" is NOT a reason to present a design and wait for sign-off — decide them and act. The only thing that ever pauses you is a *genuinely consequential, genuinely ambiguous* choice with no sensible default — then ask **one specific question** (a question, not a design-for-approval). **Never present the full design and wait for a go.**

| Thought | Reality |
|---|---|
| "The user gave no dimensions, so I'll present a design and wait" | A missing dimension is YOUR decision (sensible default + nearest `AGENTS.md`). Decide it and build — not a gate. |
| "It's a multi-database build, so I should get approval first" | Multi-object → do the self-check (decide every dimension), then build directly. No approval, ever. |
| "I'll show the full plan and wait for the go-ahead" | That's the banned approval gate. Decide → act → report. A single specific question for genuine ambiguity is fine; a design-for-sign-off is not. |

**Verify the build matched the design — the loop isn't closed until you check.** A dimension can be decided yet silently dropped at write-time, or no-op'd by the API (a column icon the public API can't set, a formula that didn't compile). So when the build's objects are written, **re-read every one** (`describe` + `read_database` — the narrowest-read rule from act-and-report applies) and emit a **dimension-by-dimension audit** (designed → live) across all of them; any mismatch triggers an immediate remediation write before the build is "complete". A designed-but-undelivered dimension is the same miss, one step later.

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


## MANDATORY — the FINISHING PASS: before "done", confirm every dimension from the LIVE config

The pre-build self-check above designs every dimension; this fires at the **other end** — **before you tell the user a page / hub / view is complete.** The recurring failure: the functional build is finished, a quick glance at the result "looks fine," and it's declared done — but the dimensions that are usually wrong don't surface on a casual look, only in specific fields of the live config, so "it looked fine" becomes false confidence and the user is left to catch each gap one by one. Every rule below ALREADY lives in the references; the miss is never *knowing* them — it's never *running the pass*. This is the forcing function.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law
```
"IT LOOKS FINE" IS NOT "DONE" — RUN THE FINISHING PASS AGAINST THE LIVE CONFIG BEFORE REPORTING ANY PAGE / HUB / VIEW COMPLETE
```

### What a casual glance misses — confirm each against the LIVE config directly
| Easy to miss | Confirm via | Rule |
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
5. **THEN** report the result in prose, citing the live-config evidence for each item confirmed above.

### Red Flags — STOP, you're rationalizing
| Thought | Reality |
|---|---|
| "It looks fine, so it's done" | Covers, spacing, tabs, inline-vs-link, and widths — the usual breakages — don't show up on a casual glance. Confirm them against the live config. |
| "The cards have covers — the rows have page covers" | The **view** must enable `cover:{type:"page_cover"}`; a default gallery is coverless even when every row has a cover. |
| "I spaced the main sections" | EVERY boundary gets a spacer — including callout↔first block and last-DB↔page-link, not just the obvious ones. |
| "The gallery works; the extra Table tab is harmless" | A nav hub is gallery-ONLY — delete the leftover default view. |
| "It's the same data four ways; four blocks is fine" | Four filters of one DB = four TABS on one block, not four blocks. |
| "I'll let the user catch what's off" | Each thing the user points out is one this pass would have caught. Run it before reporting, every time. |

### The Bottom Line
A page/hub/view is "done" only after the finishing pass — spacers at every boundary, galleries covered + gallery-only + name-hidden, multi-bucket as tabs, columns fitting — each confirmed from the LIVE config, not from a casual glance. "It looked fine" is the exact failure this stops. Non-negotiable.

