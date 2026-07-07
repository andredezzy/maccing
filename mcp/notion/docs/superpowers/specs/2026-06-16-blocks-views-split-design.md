# Split blocks from database views — two engines, official-only — Design

**Date:** 2026-06-16
**Module:** `plugins/maccing-notion/mcp/src/render/`
**Type:** Behavior-preserving structural refactor + one net-new view (`feed`)

## Goal

The render module conflates two distinct Notion domains in one `MockupBlock` union and one registry: **blocks** (page content) and **database views**. Separate them into two parallel systems so that `Block` contains *only* official Notion blocks and database views get their own type union, registry, engine, and renderer files. While doing so, make the view set match Notion's *complete* official set (API + UI), which adds the missing `feed` view.

## Why (verified domain facts)

Notion's API and product treat these as different things:

- **Blocks** are page content. The API block `type` set: paragraph, heading_1–4, bulleted/numbered_list_item, to_do, toggle, quote, callout, divider, code, equation, image/video/audio/file/pdf, bookmark, link_preview, embed, column_list/column, table/table_row, breadcrumb, table_of_contents, synced_block, child_page, child_database, link_to_page, template, transcription, … There is **no** `dashboard`/`chart`/`form`/`map`/`feed` block.
- **Database views** are a separate concept. A view's `type` is one of **11** official values: `table`, `board`, `gallery`, `list`, `calendar`, `timeline`, `chart`, `form`, `map`, `dashboard`, `feed`. (`feed` is a recent UI addition not yet in the API `view.type` enum — but it is an official Notion view, so we support it for hand-authored mockups.) `Layouts` is **not** a view type — it's Notion's umbrella term for choosing a view layout.

Sources: [Notion API — Working with views](https://developers.notion.com/guides/data-apis/working-with-views), [Notion — Using database views](https://www.notion.com/help/guides/using-database-views), [Notion — Feed view](https://www.notion.com/help/feeds), [Notion — Dashboards view](https://www.notion.com/help/dashboards), [Notion — Map view](https://www.notion.com/help/maps).

Today one `renderBlock` dispatches both blocks and views; a `database` block renders its views by calling `renderBlock` on each (they share the union), and a `dashboard` renders widgets via `renderBlock`. That shared union is the smell this refactor removes.

## Decisions (settled with the user)

1. **View placement — faithful.** A view exists *only* inside a database. `render_mockup`'s top level accepts a `Page`, a `Block`, or `Block[]` (a `database` block carries its views); a bare top-level view is no longer valid input.
2. **Dashboard widgets are views.** A dashboard aggregates other database views, so `dashboard.widgets[].view: DatabaseView` (view-engine recursion). No view ever contains a block.
3. **Engine implementation — one generic factory, two instances.** `createRegistry<T>()` is written once and instantiated for blocks and for views.
4. **`page` is its own root concept**, not a block (a page is a page object, not an API block).
5. **Support all official views (API + UI)** → the view set is the full **11**, which adds the net-new `feed` renderer.

## Target architecture

### Type contracts

- **`Block`** — official Notion blocks only: paragraph, heading (legacy), heading_1/2/3, bulleted_list_item, numbered_list_item, to_do, toggle, quote, callout, divider, code, equation, image/video/audio/file/pdf, bookmark/link_preview, embed, column_list, simple_table, breadcrumb, table_of_contents, synced_block, page_link, unsupported, and **`database`** (the one bridge node — an inline database that holds views).
- **`DatabaseView`** — the 11 official views: table, board, gallery, list, calendar, timeline, chart, form, map, dashboard, **feed**. `dashboard.widgets: { title: string; view: DatabaseView }[]`.
- **`Page`** — a root renderable, not a block: `{ title: string; icon?: string; cover?: string; description?: string; width?: number; children: Block[] }`.
- **`DatabaseModel`** — `{ title: string; icon?: string; description?: string; width?: number; views: DatabaseView[]; view?: number | "all" }`.
- **`DatabaseBlock`** — `{ type: "database"; database: DatabaseModel }` (the `database` member of `Block`).
- **New `feed` view shape:** `{ type: "feed"; name: string; views?: string[]; posts: { icon?: string; title: string; preview?: string; meta?: string }[] }` — rendered as the view tab-bar + a single-column stack of "post" cards (icon+title · preview line · meta), faithful to Notion's scrollable feed.

### Engines — one generic factory, two instances

- `render/registry.ts` — `createRegistry<TNode extends { type: string }>()` returns `{ register, render }` (a `Map<string, Renderer<TNode>>` + single-dispatch). Imports nothing (a runtime sink).
- `render/blocks/engine.ts` — the `Block` union (imports each block member type `import type`) + `const { register: registerBlock, render: renderBlock } = createRegistry<Block>()` + `renderBlocks(blocks, width, depth)` (the block list-walker: TIGHT inter-item spacing + numbered-list ordinals).
- `render/blocks/database/views/engine.ts` — the `DatabaseView` union (imports each view member type `import type`) + `const { register: registerView, render: renderView } = createRegistry<DatabaseView>()` + `renderViews(views, width)` (the view list-walker: simple blank-line stacking; used by `dashboard` and by the `database` block's `view:"all"`).

The single-dispatch registry is shared; the two list-walkers stay domain-specific (block spacing ≠ view stacking).

### File structure

```
render/
  registry.ts                  # createRegistry<T>() — shared generic (sink)
  index.ts                     # render(root: Page | Block | Block[], width?) + public re-exports
  page.ts                      # Page type + renderPage (NOT registered; the entry calls it)
  page-model.ts                # pageFromNotion(rawPage, blocks): Page  (renamed from pageToBlock)
  database-model.ts            # databaseToModel(...): DatabaseModel
  box.ts · text.ts             # shared primitives
  schema.ts                    # zod: pageSchema · blockSchema · viewSchema · databaseModelSchema · mockupSchema
  blocks/
    engine.ts                  # Block union + registerBlock / renderBlock / renderBlocks
    index.ts                   # side-effect: import every block file (registration)
    text.ts                    # paragraph · headings · lists · to_do · toggle · quote · callout
    media.ts                   # image/…/pdf · bookmark · link_preview · embed · code · equation
    layout.ts                  # divider · column_list · simple_table · breadcrumb · toc · synced_block · page_link · unsupported
    database/
      database.ts              # `database` Block renderer + DatabaseModel + DatabaseBlock (bridges → view engine)
      header.ts                # view tab-bar chrome (was database-header.ts)
      views/
        engine.ts              # DatabaseView union + registerView / renderView / renderViews
        index.ts               # side-effect: import every view file (registration)
        table.ts · board.ts · gallery.ts · list.ts · calendar.ts
        timeline.ts · chart.ts · form.ts · map.ts · dashboard.ts · feed.ts
```

Each `views/<type>.ts` owns exactly one view: its `DatabaseView` member type + renderer + `registerView("<type>", …)`. Adding a future view = one new file + one registration line.

### The one bridge — and acyclicity

`blocks/database/database.ts` renders the DB icon/title header, then calls `renderView`/`renderViews` for the selected view(s). This is the only block→view edge. Views never render blocks. Runtime import edges: every block/view file → its engine (`register*`); `database.ts` → view engine (`renderView`); engines and `registry.ts` import nothing at runtime (type-only imports erase). The graph stays an acyclic DAG, so `architecture.test.ts` (runtime-cycle check) stays green.

### Entry and tool surface

- `render(root: Page | Block | Block[], width?)` — routes: a `Page` → `renderPage` (chrome + `renderBlocks(children)`); an array → `renderBlocks`; a single block → `renderBlock`; then `finish`.
- `read_page` → `render(pageFromNotion(...))`. `read_database` → `render({ type: "database", database: model })`. `render_mockup` → parses `mockupSchema` (= `pageSchema | blockSchema | Block[]`) and calls `render`. A bare top-level view is rejected (faithful).

### Schema

`schema.ts` splits the recursive union into `blockSchema` (`z.ZodType<Block>`) and `viewSchema` (`z.ZodType<DatabaseView>`, includes `feed`), plus `pageSchema` and `databaseModelSchema` (uses `viewSchema`). `mockupSchema = z.union([pageSchema, blockSchema, z.array(blockSchema)])`. The `z.ZodType<…>` annotations keep each wire schema tied to its TS type (drift = compile error).

## Behavior

Rendered output is **identical** for pages, databases, and content. Three intentional changes:

1. **Bare top-level view rejected** by `render_mockup` (faithful placement). The current standalone-view tests move to view-engine unit tests (`renderView` directly).
2. **`feed` view added** — net-new render capability.
3. **`dashboard.widgets[].view`** narrows from `Block` to `DatabaseView`. The existing dashboard test uses a `chart` widget (a view), so its output is unchanged.

## Testing

- `render/blocks/database/views/*.test.ts` (or one `views.test.ts`) — unit-test each view renderer via `renderView`, including the relocated standalone-view cases and a new `feed` case.
- Block renderer tests stay; page/database/content cases in `index.test.ts` rewire to `Page`/`Block`/`render`.
- `architecture.test.ts` continues to enforce a runtime-acyclic graph (the two-engine split must preserve it).
- Gates per repo norm: `bunx tsc --noEmit`, `bunx biome check src`, `bun test` — all clean. Converge with the established adversarial multi-pass review (5 consecutive clean passes) before shipping.

## Dimensions checklist

- **Data / logic:** `Block`, `DatabaseView`, `Page`, `DatabaseModel`, `DatabaseBlock`, the `feed` shape, the one bridge — fully specified above.
- **Presentation:** existing mockups byte-identical; `feed` gets a new single-column layout (specified).
- **Operational:** N/A — pure in-process render library, no runtime infra.
- **Infra:** build/test gates + the runtime-acyclic invariant test — covered.

## Out of scope (follow-ups, flagged)

- **Block-side completeness** — the model still lacks some official *blocks* (`heading_4`, `transcription`, `template`). This refactor is the block/view *split* + *view* completeness; block completeness is a separate later pass.
- **`Layouts` / `Feed`-in-API** — `Layouts` is correctly excluded (not a view type). If the API later adds `feed` to its `view.type` enum, no change is needed (we already model it).

## Implementation phases (detail to be produced by writing-plans)

1. Add `render/registry.ts` (`createRegistry<T>()`); refactor `blocks/engine.ts` to use it (behavior-preserving).
2. Add the view engine (`blocks/database/views/engine.ts`) via the factory.
3. Move view renderers + their types from `blocks/{cards,data,list,time}.ts` into `blocks/database/views/<type>.ts` (one per view); move `database-header.ts` → `blocks/database/header.ts`.
4. Rewire `blocks/database/database.ts` to call `renderView`/`renderViews`; `DatabaseModel.views: DatabaseView[]`.
5. Extract `Page` as a root concept (`page.ts` + entry routing); rename `pageToBlock` → `pageFromNotion` returning `Page`.
6. Split `schema.ts` (`blockSchema`/`viewSchema`/`pageSchema`); `render_mockup` accepts `Page | Block | Block[]`.
7. Add the `feed` view (type + renderer + schema + test).
8. Reorg tests (view unit tests; relocate standalone-view cases; add `feed` test).
9. Verify all gates + acyclic invariant + the 5-pass adversarial review.
