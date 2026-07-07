# Official Notion API as the render source of truth — Design

**Date:** 2026-06-16
**Module:** `plugins/maccing-notion/mcp/src/`
**Type:** Large redesign — replace the hand-rolled simplified render model with the exact official Notion API objects as the canonical, render-from declarations.

## Goal

Today the renderer consumes a hand-rolled, simplified model (`Block`/`DatabaseView`/`Page` + `render/schema.ts`) that *approximates* Notion. Replace that with the **exact official Notion API object shapes** as the single source of truth, living one-file-per-object under `notion/`, and have the renderer render **directly from those official shapes**. The simplified model and its mappers are deleted.

## Decisions (settled with the user)

1. **Source of truth = the official Notion API objects, mirrored in `notion/`** (not the `@notionhq/client` SDK dependency, not a derived subset). The renderer consumes the official shapes directly.
2. **`render_mockup` accepts official shapes only** — no compact authoring shim. Live reads pass real objects through; a "how it will look" proposal is an official-shaped object the agent constructs.
3. **The one non-atomic case is a thin bundle of official objects** — `DatabaseRender` (confirmed). By the same necessity, `PageRender` (a page object + its block children) is the analogous bundle, since the API never returns page-with-body or database-with-rows as a single object.
4. **Spec the whole design** (all three phases), phased in the implementation plan.

## Why a thin bundle is unavoidable (and acceptable)

The Notion API returns objects piecemeal: a **page object** carries properties/icon/cover but NOT its body (blocks are a separate `GET /v1/blocks/{id}/children`); a **database** is a wrapper over **data_sources**, whose **views** (`GET /v1/views`) and **rows** (`POST /v1/data_sources/{id}/query`) are separate calls again. A *visual* of a page or a database therefore requires several official objects combined. The two render bundles hold **only exact official objects** — they are compositions, not simplified shapes:

- **`PageRender = { page: PageObject, blocks: BlockObject[] }`**
- **`DatabaseRender = { database: DatabaseObject, dataSource: DataSourceObject, views: ViewObject[], rows: PageObject[] }`**

Everything else the renderer consumes IS a single official object (a `BlockObject`, a `BlockObject[]`).

## Architecture

### The canon — `notion/` mirrors the official API, one file per object

Each file is the exact field-for-field mirror of a Notion API object: a zod schema + the `z.infer` type, **verified against current `developers.notion.com` object references** at implementation time (never from memory). Server-generated metadata (`id`, `created_time`, `last_edited_time`, `created_by`, `last_edited_by`, `has_children`, `archived`, `in_trash`, `url`, `public_url`) is modeled **optional** so a hand-authored proposal object (which has no id/timestamps) still validates; the type discriminant + the type-specific payload are required. Proposed layout:

```
notion/
  rich-text.ts            # RichTextObject (text|mention|equation + annotations + plain_text)
  user.ts                 # UserObject (person|bot)
  parent.ts               # ParentRef (page_id|block_id|database_id|data_source_id|workspace) — replaces readers/parent.ts's loose type
  file.ts                 # FileObject (external|file|file_upload), Icon (emoji|file|custom_emoji), Cover
  blocks/
    paragraph.ts heading.ts list-item.ts to-do.ts toggle.ts quote.ts callout.ts
    divider.ts code.ts equation.ts media.ts bookmark.ts embed.ts
    column-list.ts column.ts table.ts table-row.ts breadcrumb.ts table-of-contents.ts
    synced-block.ts child-page.ts child-database.ts link-to-page.ts template.ts unsupported.ts
    block.ts              # the BlockObject discriminated union (assembled from the above, recursive via children)
  property-values/
    title.ts rich-text.ts number.ts select.ts status.ts multi-select.ts date.ts people.ts
    files.ts checkbox.ts url.ts email.ts phone-number.ts formula.ts relation.ts rollup.ts
    created-time.ts created-by.ts last-edited-time.ts last-edited-by.ts unique-id.ts verification.ts button.ts
    property-value.ts     # the PropertyValue discriminated union
  property-schema.ts      # the data_source column definitions (id, name, type, <type> config) — discriminated union
  page.ts                 # PageObject (properties: Record<name, PropertyValue>, icon, cover, parent)
  database.ts             # DatabaseObject (the 2026 wrapper: title, icon, data_sources[])
  data-source.ts          # DataSourceObject (properties: Record<name, PropertySchema>, parent.database_id)
  view.ts                 # ViewObject (type, name, configuration: { properties[], filter, sorts, group_by })
  query.ts                # QueryResult ({ object:"list", results: PageObject[], has_more, next_cursor })
  render-bundles.ts       # PageRender, DatabaseRender (thin compositions of the above official objects)
```

The existing API clients (`notion/public-client.ts`, `private-client.ts`, `ids.ts`) stay; the loose hand-rolled response types currently scattered in `readers/` (`RawBlock`, `RawPage`, `NotionPropertyValue`, the parent ref) are **replaced** by these official schemas.

### The renderer consumes official shapes

Every renderer is rewritten to read the official payload. Examples of the shift:
- `paragraph` reads `block.paragraph.rich_text` (→ plain text via a shared `richTextToPlain(RichText[])`) and `block.paragraph.children`, not `block.text`.
- `callout` reads `block.callout.rich_text` + `block.callout.icon` + `block.callout.children`.
- `image` reads `block.image.{type, external?.url | file?.url, caption}`.
- A database VIEW renders from the `ViewObject.configuration` (visible `property_id`s → column names resolved via `DataSourceObject.properties`) + the `rows: PageObject[]` (each cell = `richTextToPlain`/flatten of the row's `PropertyValue`). The flatten logic currently in `database-model.ts` (`flattenValue`/`viewToBlock`) **moves into the view renderers / a shared `notion/property-values` reader**, now consuming official `PropertyValue`s.

The renderers keep their one-file-per-type structure and the two-engine split (block engine + view engine) from the prior refactor — only their INPUT type changes (official objects instead of the simplified model). The `registry`/`engine` dispatch is unchanged; `BlockObject.type` / `ViewObject.type` is the discriminant.

### Tools

- `read_page`: fetch the page object + its block tree, hand the `PageRender` bundle to the renderer for the mockup format. The `pageFromNotion` mapper (`page-model.ts`) is **deleted**.
- `read_database`: fetch database + data_source + views + sampled rows, build the `DatabaseRender` bundle, render it. The `databaseToModel` mapper (`database-model.ts`) is **deleted** (its flattening/grouping logic relocates into the view renderers + property-value readers).
- `render_mockup`: input schema becomes `PageRender | BlockObject | BlockObject[] | DatabaseRender` (the official shapes + the two bundles). `render/schema.ts` is **deleted**; the input zod comes from the `notion/` canon. A proposal mockup is now an official-shaped object.

### Entry

`render(mockup: PageRender | BlockObject | BlockObject[] | DatabaseRender, width?)` routes: a `PageRender` → page chrome + `renderBlocks(blocks)`; a `DatabaseRender` → the database renderer (header + view tabs + selected view from views+rows); a block or block-array → the block engine; then `finish`. The acyclic-runtime invariant and the generic `createRegistry<T>()` carry over.

## Behavior changes

- **`render_mockup` input shape changes** (breaking): it now takes official Notion objects / the two render bundles, not the compact `{type:"table", columns, rows}` shapes. A hand-authored proposal is heavier but exact. (This is the explicit, chosen tradeoff.)
- **Rendered output stays faithful** to today's mockups (same ASCII visuals) — the *input* changes, not the look. Where today's output and the official-shaped render legitimately differ, the official-shaped result wins (it's the source of truth).
- `read_page` / `read_database` mockup output is unchanged in appearance; their internals stop going through the deleted mappers.

## Testing

- **Canon (Phase 1):** for each official schema, a zod round-trip test against a **real captured API response fixture** (a small, redacted real object per type — proving the schema accepts what Notion actually returns) plus a rejection test for a malformed object.
- **Renderers (Phase 2):** each renderer's existing alignment/box-closure invariants are preserved, re-expressed on official-shaped inputs (fixtures from Phase 1). The `DatabaseRender` flatten (rows → cells) gets unit tests on official `PropertyValue`s (porting the current `flattenValue` test matrix to official shapes).
- **Tools (Phase 3):** `render_mockup` accepts official shapes / bundles and rejects the old compact shapes; `read_*` feed official objects end-to-end.
- Gates per repo norm every step: `bunx tsc --noEmit`, `bunx biome check src`, `bun test`, the runtime-acyclic invariant; converge with the adversarial multi-pass review before shipping each phase.

## Phasing (the plan will break these into tasks)

- **Phase 1 — The canon.** Define the official zod+types under `notion/`, one file per object, each verified against current docs + a real-response fixture. Replace the loose `readers/` response types with these. No renderer change yet (the simplified model still drives rendering). Ships green; the canon is now available + tested.
- **Phase 2 — Renderer + bundles.** Introduce `PageRender`/`DatabaseRender`; rewrite the block + view renderers to consume official objects; move the flatten/group logic into the renderers/property-value readers; delete the simplified `Block`/`DatabaseView`/`Page` model and `render/schema.ts`.
- **Phase 3 — Tools.** Rewire `read_page`/`read_database` to build + render the official bundles; switch `render_mockup`'s input to the canon; delete `page-model.ts` + `database-model.ts`. Update the render_mockup tool description.

## Dimensions checklist

- **Data / logic:** the `notion/` canon (≈60 object/property/block schemas), the two render bundles, the relocated flatten/group logic — fully specified above; exact field lists are produced per-object at implementation time from current docs (a deliberate verify-don't-guess step, not a deferral).
- **Presentation:** ASCII mockups stay visually identical; only the input shape changes.
- **Operational:** N/A — in-process render library + API client; no new runtime infra.
- **Infra:** build/test gates + the runtime-acyclic invariant + the per-object fixture tests — covered.

## Out of scope / risks

- **No `@notionhq/client` dependency** — we hand-mirror (per the chosen option). Risk: the official object shapes are large and evolve; mitigated by per-object fixture tests against real responses, and by keeping metadata optional.
- **Block-type completeness** — Phase 1 mirrors the block types the renderer supports plus the common official ones; truly exotic/rare blocks degrade to `unsupported` (as today). Adding a new block type stays one-file-per-type.
- **`heading_4`** and other official blocks the current model lacks are added as part of the canon (the redesign is the moment to close those gaps).
- **Magnitude:** this is the largest change in the module's history — ≈60 schemas + a full renderer rewrite + tool rewiring + a near-total test rewrite. The phasing keeps each phase independently green and reviewable.
