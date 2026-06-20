# Aesthetics, design & taste — building beautiful Notion pages

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. This is the **taste layer**: *which* visual choice, *when*, and *why*. The **mechanics** (the exact API fields to set a cover/icon/gallery) live in `pages-properties.md` (page cover/icon), `gallery-view.md` (gallery config), `icon-names.md` (the named-icon catalog), and `blocks.md` (block layout/spacing) — this file is the judgment that drives them.

**Always defer to the workspace's own house style first** — infer it from the root `AGENTS.md` or a bounded live sample (cross-ref SKILL.md "match the workspace's conventions"). These are house-agnostic *defaults* that fill the gaps the house style doesn't specify; they make a page look hand-crafted, not generated. Visual choices are **brainstorm-gated** — propose theme/covers/sizes and show the user before writing.

## 1. Covers

- **Black-and-white is the default polish.** Source from Unsplash and desaturate with the imgix param **`&sat=-100`** (turns ANY colour photo grayscale — no need to find a B&W original). A desaturated cover never fights an accent colour elsewhere on the page and reads sharp in both light and dark mode. House cover URL shape: `https://images.unsplash.com/photo-<id>?ixlib=rb-4.1.0&q=85&fm=jpg&w=1600&crop=entropy&cs=srgb&sat=-100`.
- **Dimensions & safe band.** Notion crops the cover per viewport. Target **1500×600 (5:2)**; keep key content inside a centered **~1170×230** band — anything outside risks cropping on tablet/mobile. Preserve Unsplash's `ixid` param (analytics-compliance).
- **Subject choice.** Prefer wide, horizontally-dominant subjects (architecture, landscape, abstract texture, equipment) — the banner crop is short and wide. **Avoid portraits** (a desaturated face reads somber).
- **Built-in gradient/gallery covers** (Notion CDN — solids, gradients, NASA/Webb, museum art) load fastest; set them as `external` with the CDN URL captured from a page already using one (there is no documented id list).
- **When a cover helps vs clutters.** Helps: hub/dashboard pages, gallery-card pages, public-facing pages (identity + first impression). Clutters: deeply-nested working pages, purely tabular pages, and pages opened dozens of times a day (the cover eats vertical viewport on every open).

### Sourcing covers — the brainstorm-the-images loop (live-verified, Unsplash)

Cards pointed at `page_cover` are only as good as the page covers behind them. Sourcing covers is a **visual choice → it belongs in the brainstorm gate**: propose the theme, source candidates, **show them**, let the user pick before any write.

1. **Find real photos.** Unsplash sits behind a bot wall — do **not** scrape its search HTML or defeat the bot challenge. `WebSearch` (e.g. `allowed_domains:["unsplash.com"]`) for the theme to get photo-**page** URLs, then `WebFetch` each page for "the exact `images.unsplash.com/photo-…` URL" (the og:image). Skip any that resolve only to `plus.unsplash.com` (premium → unusable).
2. **Build the URL** in the house cover style; append **`&sat=-100`** for B&W.
3. **Verify before proposing — no broken covers.** `WebFetch` each URL, confirm `200` + `content-type: image/*`; drop any 4xx/5xx or `plus.unsplash.com` redirect.
4. **Show the user.** Download (`curl -o`) and display via Read so they see the real B&W result; give page URL + photographer for attribution. **Flag thematic mismatches** and offer a swap.
5. **Apply only after approval** — get each row's page id via `POST /v1/data_sources/{id}/query` (`.id` per result), then `PATCH /v1/pages/{id}` `{ "cover": { "type":"external", "external": { "url":"<verified url>" } } }`, then point the gallery at them (`gallery-view.md`).

> **Reuse-from-workspace shortcut:** a cover already in the workspace (read it off any page via `GET /v1/pages/{id}` → `.cover.external.url`) is guaranteed valid + on-brand. Good when you need a cover fast — but a cover used as a page **banner** or a sibling card shows the *same image twice* on one screen; pick a distinct one per surface.

## 2. Icons

- **Notion built-in named icons, colour `gray`** — not emoji — for every structural surface (area/hub/section pages, database **page icons**, **gallery cards**, and database **column** icons). Named icons adapt to light/dark mode; emoji are fixed-colour and vanish in one mode. (Public API: `icon: { "type":"icon", "icon": { "name":"<name>", "color":"gray" } }` — catalog in `icon-names.md`.) Emoji are reserved for informal/personal notes.
- **Same icon for the same concept across databases** — a date → the same icon everywhere; a Σ-volume metric → `activity`; a count → `hashtag`/`number`. Users pattern-match icons before reading labels; repetition reads as craft.
- **Where icons matter most:** (1) sidebar/top-level pages (the only cue when the sidebar is collapsed); (2) gallery cards (the icon is the fallback thumbnail when a cover is missing); (3) database columns (at-a-glance column ID). Callout icons are styling, not navigation.
- **Fixed exception:** every `AGENTS.md` page uses the 🤖 emoji — a signature, independent of the gray-icon rule.

## 3. Galleries & cards

**Never ship naked cards.** A `page_cover` card is only as good as the cover + icon behind it. Before pointing a gallery at `page_cover`, ensure **every row has BOTH a cover and a page icon** — a coverless card is a grey void that breaks the grid.

**Card budget: ≤ 2–3 properties.** The gallery's whole advantage is speed-scanning; a 4th property makes the card read like a mini-table. Hide the title for pure-visual galleries; keep it for navigational ones.

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

- **The discriminator is the row title; the value must branch on it.** Every shared formula/rollup computes *identically on every row* (they read the same relations), so the only thing that differs per card is the title. To show a *different* value per card, add ONE **Display formula** that branches on the title:
  `if(<title-token> == "This week volume", format(<metric A>) + " kg", format(<metric B>))`. Show only this `Value` on the card; hide the underlying metric columns.
- **Reference sibling formulas via compiled tokens, never `prop()`.** `prop("A formula")` → `400 Type error` (the public API unknown-types a formula referenced by name). Use the compiled token `{{notion:block_property:<encoded id>:<ds>:<space>}}` (`formulas.md`). `format(<token>)` even *launders* an `unknown`-typed relation-read formula into text.
- **Don't mix `prop()` with `{{tokens}}` in one expression.** An expression that's part-uncompiled (`prop("Name")`) and part-compiled (`{{…}}`) → `400 Type error`. Make it **all tokens** — reference the title as `{{notion:block_property:title:<ds>:<space>}}` too.
- **The view `type` is immutable via the public API.** `PATCH /v1/views/{id} {type:"gallery"}` returns `200` but stays `table` (silent no-op); sending a gallery `configuration` onto a table view → `400 "Configuration type \"gallery\" does not match view type \"table\""`. **Fix:** `POST /v1/views` a fresh gallery view (`database_id` + `data_source_id`, `position:{type:"start"}`), then `DELETE /v1/views/{old table view}` so the gallery is the sole/default view.
- **Covers + order.** Give each metric row a B&W cover + gray icon (§1–2). ⚠️ A new gallery is **coverless by default** — the rows' covers only appear once you set **`cover:{type:"page_cover"}`** on the view config (+ `cover_size`/`cover_aspect`); set it in the same step as the covers (`gallery-view.md`). Order the cards with a top-level `sorts` on the title — e.g. ascending so the headline metric leads.

## 4. Layout & spacing

- **Whitespace is a tool — space stacked sections.** Two inline databases (or any back-to-back sections) render with no gap and read as cramped; a database immediately under a heading reads as that heading's *label*, not a new section. Insert an **empty `paragraph`** between ANY back-to-back sections — a callout above its first section, two stacked linked views, a section group and the next (mechanic in `blocks.md`). Group *related* blocks tightly; separate *unrelated* ones with a spacer. **A spacer is PAIRED with its section** — when you DELETE or MOVE a block/section, remove its now-orphaned spacer in the SAME edit, and never leave a **leading or trailing empty `paragraph`** at a page's top/bottom (a deleted callout's spacer becomes dead space at the top).
- **Columns** for genuinely parallel content (TOC + body, metadata + description, an icon nav grid). Avoid columns that merely compress text into ellipsis-truncation — Notion does not reflow truncated text. A blank column is the only fine-grained horizontal spacer.
- **Dividers sparingly** — a `divider` only at major section breaks (every 2–3 sections, max), with a blank line above/below. Overused dividers are visual noise; a full-width image can stand in at chapter breaks.

## 5. Visual hierarchy

- **Let a view's NAME be the section title.** A heading block + the database title + the view name is three labels for one thing. Name the view ("This week", "What's due"), hide the database/collection title (`hide_linked_collection_name` for linked views — `views.md`), and **don't stack a redundant `heading` above it**.
- **Callouts as hero / info boxes.** Callouts carry built-in margin + padding, so they read as "elevated" without extra markup. A transparent/default callout with a bold first line = a page-top hero; a *coloured* background is reserved for a semantic class (gray = note/aside, blue = info, yellow = warning, red = critical). A coloured callout wrapping an embedded database visually groups it as a named section.
- **Headings are semantic, not font sizes.** H1 page-section, H2 sub-section, H3 block-label. Misusing a level for size corrupts the auto-generated table of contents and assistive navigation.

## 6. Colour

- **≤ 3 colours total, and every colour must *mean* something.** One neutral (gray backgrounds/text), one primary accent (active/current, CTAs, key labels), one semantic (green/red status). If a coloured element can't answer "what does this colour signal?", make it gray.
- **Gray is the baseline.** Default icons, secondary text, and metadata to gray — the eye reads contrast, not hue; gray achieves the hierarchy without colour noise, letting the content be the figure.
- **Monochrome is the only mode-proof aesthetic.** Black/near-black text, white/near-white background, gray secondary, one accent, a `sat=-100` cover, gray icons — the single palette that renders correctly across light mode, dark mode, and every device without per-mode tuning.
- **Select/multi-select tag colours map to status, reused identically across every database** — never alphabetical or random; a stable colour→meaning map builds instant recognition.

## 7. Dashboard / hub patterns

- **Above the fold = zero-click actionable.** The first ~600px should hold a greeting/date callout, today's filtered tasks/habits, and one key metric or progress indicator. Everything else is navigation and detail below.
- **3-level hierarchy:** Hub → Category pages → individual databases. The hub holds **no raw database content** — only linked/**filtered** views of at most ~5 databases (filter to "due today" / "status = active"); unfiltered hundred-row databases on a hub are the #1 load-time complaint. The hub is a launchpad, not a data-entry point.
- **Column rhythm:** full-width hero/greeting on top → a 2–4-column row of KPI stat-tiles (small gallery, §3) → a 2-column working area (wider primary list left, narrower context right) → full-width reference DBs at the bottom. Attention flows broad → parallel → detail.
- **Multiple time/status slices of ONE database = view TABS on ONE block, never N stacked blocks.** A section showing **Today / Tomorrow / Next 7 days / Last 7 days** (or Active/Done, This week/Last week, by-owner) of the *same* database is **one** inline linked-DB block with **one filtered view per tab** — the user switches tabs in place. Four databases stacked for four filters is the telltale wrong build: four drag-handles, four repeated gray DB names, four "＋ New" rows, four times the vertical space — and it reads as four *different* databases, not one sliced four ways. One block = one thing to restyle, one heading, a compact tab bar. (Mechanic: first view via `create_database`, the rest via `database_id` + `after_view`; default/leftmost tab = the block's `view_ids[0]` — `views.md`.)

---

Sources (deep-research, 2026-06): Notion VIP *Design Usable, Delightful Notion Pages*; super.so guides (gallery view, cover size, callout block, database views); notion.com help (galleries, dashboards, page icons & covers) + blog *Updating the Design of Notion Pages*; developers.notion.com *Update Page*; docs.imgix.com *sat*; matthiasfrank.de *Notion Colors*; notioneverything.com *Notion Icons*. Plus this skill's own live-verified findings (the KPI-gallery pattern, the B&W Unsplash loop, view-type immutability).
