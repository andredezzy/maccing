# Visual design, taste & aesthetics — building beautiful Notion pages

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. This is the **taste layer**: *which* visual choice, *when*, and *why*. The **mechanics** (the exact API fields to set a cover/icon/gallery) live in `pages-properties.md` (page cover/icon), `gallery-view.md` (gallery config), `icon-names.md` (the named-icon catalog), and `blocks.md` (block layout/spacing) — this file is the judgment that drives them.

**Always defer to the workspace's own house style first** — infer it from the root `AGENTS.md` or a bounded live sample (cross-ref SKILL.md "match the workspace's conventions"). These are house-agnostic *defaults* that fill the gaps the house style doesn't specify; they make a page look hand-crafted, not generated. Visual choices are part of the **pre-build self-check** (SKILL.md → *design the whole object before creating it*): decide theme/covers/sizes deliberately, then **act and report** — no approval gate; the verified `render_mockup` after the write is how the user reviews.

## First principle — hierarchy, then restraint

Every rule below is downstream of **one** question: **is the most important thing on this surface the most visually prominent thing, by a clear margin?** When two elements compete, **de-emphasise the secondary** (gray it, shrink it, drop its label) before amplifying the primary — the primary is already at full strength, so making it louder leaves nothing in reserve.

And one posture: **restraint is the default.** The burden of proof is on *adding* — a colour, a label, a divider, a cover, a card property, a heading. Add only when you can name the reason; when in doubt, remove. A "generated-looking" page is almost always an over-built one.

**Do not — the "generated page" tells** (each an AI reflex, not a decision):
- **A blue/indigo accent by default.** Blue is the model's reflex, not a choice — pick the accent for *meaning*, or inherit the house accent; when nothing needs one, the page is gray + a single cover.
- **Emoji on a structural page or database** — gray named icons only (§2).
- **A gradient/overlay-heavy or full-colour cover** where a quiet B&W (§1) or no cover belongs.
- **A cover on every page regardless of depth** — deeply-nested working pages don't get one (§1).

## 1. Covers

- **Black-and-white is the default polish.** Source from Unsplash and desaturate with the imgix param **`&sat=-100`** (turns ANY colour photo grayscale — no need to find a B&W original). A desaturated cover never fights an accent colour elsewhere on the page and reads sharp in both light and dark mode — Notion applies **no** dark-mode filter to covers, so a saturated photo would glow against the dark canvas; desaturating removes that. House cover URL shape: `https://images.unsplash.com/photo-<id>?ixlib=rb-4.1.0&q=85&fm=jpg&w=1600&crop=entropy&cs=srgb&sat=-100`.
- **Dimensions & safe band.** Notion crops the cover per viewport. Target **1500×600 (5:2)**; keep key content inside a centered **~1170×230** band — anything outside risks cropping on tablet/mobile. Preserve Unsplash's `ixid` param (analytics-compliance).
- **Subject choice.** Prefer wide, horizontally-dominant subjects (architecture, landscape, abstract texture, equipment) — the banner crop is short and wide. **Avoid portraits** (a desaturated face reads somber).
- **Built-in gradient/gallery covers** (Notion CDN — solids, gradients, NASA/Webb, museum art) load fastest; set them as `external` with the CDN URL captured from a page already using one (there is no documented id list).
- **When a cover helps vs clutters.** Helps: hub/dashboard pages, gallery-card pages, public-facing pages (identity + first impression). Clutters: deeply-nested working pages, purely tabular pages, and pages opened dozens of times a day (the cover eats vertical viewport on every open).

### Sourcing covers — the source-verify-apply loop (live-verified, Unsplash)

Cards pointed at `page_cover` are only as good as the page covers behind them. Sourcing covers is a deliberate **visual choice** — decide the theme per house style, source + verify candidates, apply the best, and **show the verified result in your report** (offer a swap if a different one fits better); no approval gate.

1. **Find real photos.** Unsplash sits behind a bot wall — do **not** scrape its search HTML or defeat the bot challenge. `WebSearch` (e.g. `allowed_domains:["unsplash.com"]`) for the theme to get photo-**page** URLs, then `WebFetch` each page for "the exact `images.unsplash.com/photo-…` URL" (the og:image). Skip any that resolve only to `plus.unsplash.com` (premium → unusable).
2. **Build the URL** in the house cover style; append **`&sat=-100`** for B&W.
3. **Verify before applying — no broken covers.** `WebFetch` each URL, confirm `200` + `content-type: image/*`; drop any 4xx/5xx or `plus.unsplash.com` redirect.
4. **Apply the best.** Get each row's page id via `POST /v1/data_sources/{id}/query` (`.id` per result), then `PATCH /v1/pages/{id}` `{ "cover": { "type":"external", "external": { "url":"<verified url>" } } }`, then point the gallery at them (`gallery-view.md`).
5. **Report it.** Show the applied B&W result (download `curl -o`, display via Read) with page URL + photographer for attribution; flag any thematic mismatch and offer a swap. (Act-and-report — you don't pause for a go-ahead before applying.)

> **Reuse-from-workspace shortcut:** a cover already in the workspace (read it off any page via `GET /v1/pages/{id}` → `.cover.external.url`) is guaranteed valid + on-brand. Good when you need a cover fast — but a cover used as a page **banner** or a sibling card shows the *same image twice* on one screen; pick a distinct one per surface.

## 2. Icons

- **Notion built-in named icons, colour `gray`** — not emoji — for every structural surface (area/hub/section pages, database **page icons**, **gallery cards**, and database **column** icons). Named icons adapt to light/dark mode; emoji are fixed-colour and vanish in one mode. (Public API sets **page + gallery-card** icons: `icon: { "type":"icon", "icon": { "name":"<name>", "color":"gray" } }` — catalog in `icon-names.md`. ⚠️ **Column icons are silently dropped by the public API** — set them via the private `upsert_property`; see `pages-properties.md`.) Emoji are reserved for informal/personal notes.
- **Same icon for the same concept across databases** — a date → the same icon everywhere; a summed-quantity rollup → `activity`; a count → `hashtag`. Users pattern-match icons before reading labels; repetition reads as craft.
- **Where icons matter most:** (1) sidebar/top-level pages (the only cue when the sidebar is collapsed); (2) gallery cards (the icon is the fallback thumbnail when a cover is missing); (3) database columns (at-a-glance column ID). Callout icons are styling, not navigation.
- **Fixed exception:** every `AGENTS.md` page uses the 🤖 emoji — a signature, independent of the gray-icon rule.
- **Accessibility caveat (gray icons).** Notion's gray icon colour (#A6A299) is only ~2.55:1 on white — below the WCAG AA 3:1 non-text floor. Gray is right for *decorative / secondary* icons; where an icon is a **meaning-bearing primary control** (a collapsed-sidebar nav icon the user must read at a glance), prefer the **default (darker) icon colour** so it stays legible. (Verified 2026-06.)

## 3. Galleries & cards

**Never ship naked cards.** A `page_cover` card is only as good as the cover + icon behind it. Before pointing a gallery at `page_cover`, ensure **every row has BOTH a cover and a page icon** — a coverless card is a grey void that breaks the grid.

**Card budget: ≤ 2–3 properties.** The gallery's whole advantage is speed-scanning; a 4th property makes the card read like a mini-table. **Keep `title visible:true` whenever the card's identity is its NAME** — navigation launchers AND KPI/stat-tiles (the metric name labels the card). Hide the title ONLY for a purely-visual gallery where the cover image alone says what the card is — and note `title visible:false` removes the card name *entirely* (no surviving heading — `gallery-view.md`), so a nameless metric tile is the tell you hid it by mistake.

**Nav gallery vs content gallery are sized differently** (benchmarked against hand-built hubs):

| | **Navigation** hub (rows = sub-pages, a launcher) | **Content** gallery (rows ARE the subject) |
|---|---|---|
| `cover_size` | **`small`** (tidy launcher) | **`medium`** (let the subject breathe) |
| `cover_aspect` | `cover` | `cover` |
| visible props | title + a one-line `Description` only | title + 1–2 key stats (a rollup/number) |
| schema | **no "Cover" text column** — covers are *page covers*, not a property | same |

- Card **descriptions are short imperatives**, one line, sentence case ("Log and review your training") — never paragraphs.
- **When a gallery beats a table:** each row has a distinct image; the user is *browsing/discovering* rather than comparing values across rows; card identity (who/what) matters more than the numbers. A table wins for cross-row comparison, heavy text, or sort/filter-driven work.

### The KPI / stat-tile pattern — one card per metric (live-verified 2026-06-17)

A row of small covered tiles, each showing **one** number, is the most legible "at a glance" dashboard. Because **gallery cards == database ROWS**, N metrics = **N rows** — not N columns. The catch and the recipe:

- **Card config — `cover_size: small`, `title visible:true`, ≤ 2 props.** Stat-tiles are scanned in a ROW, so use **`small`** covers — NOT the `medium` of a browse-the-subject content gallery (the table above; `medium` here makes oversized, page-eating cards). And the **title MUST stay `visible:true`** — it is the metric NAME (`Calories`/`Protein`/…), the card's whole label; `title visible:false` blanks the card name (`gallery-view.md`). Show only: title + the native ring/bar + one `Value`/label line — nothing else.
- **Native progress — RING on a card, BAR in a table.** A circular **ring** reads best on a stat *card* (compact, sits under the cover); a horizontal **bar** reads best in a *table* row (the column header labels it). Same `show_as` setting (`pages-properties.md` → "Progress bars") — pick the shape by surface, and prefer it over a hand-rolled `▓▓░░` text formula (text bar = fallback only for a label-less card or a public-API-only build).
- **Uniform progress colour → the COVER carries identity.** `show_as` colour is per-COLUMN, so every card's ring/bar shares one colour — you can't colour one metric red and the next blue on a single column. Differentiate the cards by a distinct **cover photo + icon** each (B&W, §1); the colour stays one accent, the imagery does the telling-apart.
- **The discriminator is the row title; the value must branch on it.** Every shared formula/rollup computes *identically on every row* (they read the same relations), so the only thing that differs per card is the title. To show a *different* value per card, add ONE **Display formula** that branches on the title:
  `if(<title-token> == "<metric A name>", format(<metric A>) + " kg", format(<metric B>))`. Show only this `Value` on the card; hide the underlying metric columns.
- **Reference sibling formulas via compiled tokens, never `prop()`.** `prop("A formula")` → `400 Type error` (the public API unknown-types a formula referenced by name). Use the compiled token `{{notion:block_property:<encoded id>:<ds>:<space>}}` (`formulas.md`). `format(<token>)` even *launders* an `unknown`-typed relation-read formula into text.
- **Don't mix `prop()` with `{{tokens}}` in one expression.** An expression that's part-uncompiled (`prop("Name")`) and part-compiled (`{{…}}`) → `400 Type error`. Make it **all tokens** — reference the title as `{{notion:block_property:title:<ds>:<space>}}` too.
- **The view `type` is immutable via the public API.** `PATCH /v1/views/{id} {type:"gallery"}` returns `200` but stays `table` (silent no-op); sending a gallery `configuration` onto a table view → `400 "Configuration type \"gallery\" does not match view type \"table\""`. **Fix:** `POST /v1/views` a fresh gallery view (`database_id` + `data_source_id`, `position:{type:"start"}`), then `DELETE /v1/views/{old table view}` so the gallery is the sole/default view (capture the old view's filter/sort first — `DELETE` is irreversible; or keep it as a second tab instead).
- **Covers + order.** Give each metric row a B&W cover + gray icon (§1–2). ⚠️ A new gallery is **coverless by default** — the rows' covers only appear once you set **`cover:{type:"page_cover"}`** on the view config (+ `cover_size`/`cover_aspect`); set it in the same step as the covers (`gallery-view.md`). Order the cards with a top-level `sorts` on the title — e.g. ascending so the headline metric leads.
- **The gallery's NAME = the dimension that VARIES between siblings — never a qualifier every card already states.** When sibling KPI galleries stack and every card shares one period/unit/scope (all cards titled `This week …`, or all `$`, or all `/day`), that qualifier belongs on the cards **XOR** the heading — *never both*. Two galleries whose cards all say "this week" get headings naming only the DISTINGUISHING domain — `Sales` / `Support` — **never** `Sales · this week` / `Support · this week`: the period in the heading repeating the period on every card is a **redundant double-label** (the cross-gallery cousin of §5's "three labels for one thing"). The shown collection name is a heading; strip from it anything the cards beneath already say. (Live-verified 2026-06-24 — two stacked weekly galleries first built as `<Domain> · this week`, each with `This week <metric>` cards, read as a stutter until the headings were cut to the bare domain.)
- **Stacking sibling galleries? The spacer is PART of the plant, not a follow-up.** Back-to-back inline galleries render flush (§4) — create + position the separating empty `paragraph` in the SAME step that positions the second gallery. Forgetting it (plant gallery → "done") is the standard stacked-dashboard miss; bind the spacer to the gallery so it can't be skipped.

## 4. Layout & spacing

- **Whitespace is a tool — space stacked sections.** Two inline databases (or any back-to-back sections) render with no gap and read as cramped; a database immediately under a heading reads as that heading's *label*, not a new section. Insert an **empty `paragraph`** between ANY back-to-back sections — a callout above its first section, two stacked linked views, **two stacked KPI/stat galleries**, a section group and the next (mechanic in `blocks.md`). Group *related* blocks tightly; separate *unrelated* ones with a spacer. **A spacer is PAIRED with its section** — when you DELETE or MOVE a block/section, remove its now-orphaned spacer in the SAME edit, and never leave a **leading or trailing empty `paragraph`** at a page's top/bottom (a deleted callout's spacer becomes dead space at the top).
- **Columns** for genuinely parallel content (TOC + body, metadata + description, an icon nav grid). Avoid columns that merely compress text into ellipsis-truncation — Notion does not reflow truncated text. A blank column is the only fine-grained horizontal spacer.
- **Dividers sparingly — and NEVER between two databases / two views of one area.** A `divider` reads as a hard chapter break: between a stat-card gallery and its data table (or any two related DBs) it wrongly splits things that belong together — use a blank-line **spacer**. Reserve dividers for genuinely distinct top-level zones (every 2–3 sections, max), blank line above/below; a full-width image can stand in. Overused dividers are visual noise.

## 5. Visual hierarchy

- **The container already labels its content — climb the implicit-label ladder, strip everything above the rung you need.** Every block inherits identity from where it sits, in order: **parent-page context → database name → view name / tab bar → proximity**. Keep only the LOWEST rung that still identifies it; every label above that merely repeats the obvious and is noise. Consequences:
  - **Context collapses labels.** A daily-totals DB inline on an area page whose title already names the domain needs **no DB title at all** — its `Today · This week · All` view tabs plus the page context already say it. **Hide the DB title** — for an inline / linked hub block that means **`hide_inline_collection_name: true` on the BLOCK**, NOT `hide_linked_collection_name` on the views (a no-op for inline hub blocks — `views.md`) — and let the tab bar BE the label.
  - **Single-view block → rename the one view, hide the title.** With the DB title hidden, a one-view block shows that view's name as a compact **pill** instead of a big heading — so name the view the section's name (e.g. rename `Default view` → `Summary`).
  - A `heading` block + DB title + view name is **three labels for one thing** — collapse to one. Add an explicit `heading` ONLY when context, DB-name, AND view-name all fail to identify the section.
- **Callouts as hero / info boxes.** Callouts carry built-in margin + padding, so they read as "elevated" without extra markup. A transparent/default callout with a bold first line = a page-top hero; a *coloured* background is reserved for a semantic class (gray = note/aside, blue = info, yellow = warning, red = critical). A coloured callout wrapping an embedded database visually groups it as a named section.
- **Headings are semantic, not font sizes.** H1 page-section, H2 sub-section, H3 block-label. Misusing a level for size corrupts the auto-generated table of contents and assistive navigation.
- **Cap weight tiers at three per surface — and in Notion your headings already ARE the tiers.** The three levers are H1 → H2 → H3 (near-black heading → gray body → light-gray small). Once a surface spends its heading levels on structure, do **not** add a *fourth* weight on top — no bold or accent-coloured body text, **no bold key-labels inside a callout**, no callout-hero stacked above three heading levels. Reaching for emphasis beyond the headings means you're over budget: collapse a heading level, or let proximity and position carry it. **Telltale wrong pattern:** H1 + H2 + H3 *and* bolded values *and* a coloured callout on one page. (The §6 colour cap, ≤ 3, is a separate budget; both apply.)
- **One lever per element — size OR weight OR colour, never all three at once.** A section header earns prominence from its heading *level* (its weight); it does not also need enlarged size and an accent colour. Stacking all three is shouting — and it spends the contrast you'll want for the next level down. **Telltale wrong pattern:** a heading that is large + bold + accent-coloured simultaneously.

## 6. Colour

- **≤ 3 colours total, and every colour must *mean* something.** One neutral (gray backgrounds/text), one primary accent (active/current, CTAs, key labels), one semantic (green/red status). If a coloured element can't answer "what does this colour signal?", make it gray.
- **Gray is the baseline for de-emphasis** — the eye reads contrast, not hue, so graying secondary text and icons builds hierarchy without colour noise, letting the content be the figure. **Accessibility caveat:** Notion's light-mode gray text (#787774) is ~4.48:1 on white — a hair under the WCAG AA 4.5:1 floor for body copy (it *passes* for large/bold text). Where the workspace must meet AA, keep **body text and small metadata at default near-black**, and reserve gray for headings, bold column labels, and genuinely secondary chrome. (Verified 2026-06.)
- **Monochrome is the only mode-proof aesthetic.** Black/near-black text, white/near-white background, gray secondary, one accent, a `sat=-100` cover, gray icons — the single palette that renders correctly across light mode, dark mode, and every device without per-mode tuning.
- **Select/multi-select tag colours map to status, reused identically across every database** — never alphabetical or random; a stable colour→meaning map builds instant recognition.
- **A coloured callout's semantic must survive dark mode — pin it to the ICON, not the background.** In dark mode Notion collapses every callout background toward near-black (the yellow / blue / red / green tints land within ~1.0–1.3:1 of each other — effectively indistinguishable), so background hue alone can't carry the meaning there. Always pair a coloured callout with a **semantic icon + bold first-line label**; the gray/default background is the only fully mode-proof one. (Verified 2026-06.)

## 7. Dashboard / hub patterns

- **Above the fold = zero-click actionable.** The first ~600px should hold a greeting/date callout, today's filtered tasks/habits, and one key metric or progress indicator. Everything else is navigation and detail below. (A "progress indicator" = Notion's **native Bar/Ring** display on a numeric property — NOT a hand-rolled `▓▓░░` text formula; see `pages-properties.md` → "Progress bars".)
- **3-level hierarchy:** Hub → Category pages → individual databases. The hub holds **no raw database content** — only linked/**filtered** views of at most ~5 databases (filter to "due today" / "status = active"); unfiltered hundred-row databases on a hub are the #1 load-time complaint. The hub is a launchpad, not a data-entry point.
- **Column rhythm:** full-width hero/greeting on top → a 2–4-column row of KPI stat-tiles (small gallery, §3) → a 2-column working area (wider primary list left, narrower context right) → full-width reference DBs at the bottom. Attention flows broad → parallel → detail.
- **Multiple time/status slices of ONE database = view TABS on ONE block, never N stacked blocks.** A section showing **Today / Tomorrow / Next 7 days / Last 7 days** (or Active/Done, This week/Last week, by-owner) of the *same* database is **one** inline linked-DB block with **one filtered view per tab** — the user switches tabs in place. Four databases stacked for four filters is the telltale wrong build: four drag-handles, four repeated gray DB names, four "＋ New" rows, four times the vertical space — and it reads as four *different* databases, not one sliced four ways. One block = one thing to restyle, one heading, a compact tab bar. (Mechanic: first view via `create_database`, the rest via `database_id` + `after_view`; default/leftmost tab = the block's `view_ids[0]` — `views.md`.)

## Before you call it done — self-audit

Run this before reporting a page/hub finished:
- **Hierarchy** — is the single most important thing the most prominent, by a clear margin?
- **Colour** — ≤ 3 colours, each answering "what does this signal?"; no decoration colour, no reflexive blue?
- **Contrast tiers** — ≤ 3 visual-weight tiers; body/metadata at near-black (not gray); no fourth tier from bold body text?
- **Labels** — every heading/label earns its place; nothing repeats what page context, DB name, or view tab already says (§5)?
- **Spacing** — one blank-paragraph spacer between back-to-back sections; no divider between two related DBs; no orphaned leading/trailing spacer?
- **Cards** — every gallery card has BOTH a cover and a gray icon; ≤ 2–3 props; stat-tiles use `cover_size: small` + `title visible:true`?
- **Mode-proof** — colours survive dark mode (callout semantics on icon + bold, not background); cover is `sat=-100`?
- **Icons** — gray named icons (not emoji) on structural surfaces; primary-nav icons legible (default colour where gray is too faint)?

---

Sources (deep-research, 2026-06): Notion VIP *Design Usable, Delightful Notion Pages*; super.so guides (gallery view, cover size, callout block, database views); notion.com help (galleries, dashboards, page icons & covers) + blog *Updating the Design of Notion Pages*; developers.notion.com *Update Page*; docs.imgix.com *sat*; matthiasfrank.de *Notion Colors*; notioneverything.com *Notion Icons*. Plus this skill's own live-verified findings (the KPI-gallery pattern, the B&W Unsplash loop, view-type immutability). 2026-06 verification: WCAG AA contrast (W3C, WebAIM) for the gray-text/icon caveats; Notion dark-mode colour behaviour (matthiasfrank.de) for the callout + cover notes.
