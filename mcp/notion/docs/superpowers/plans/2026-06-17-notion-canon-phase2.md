# Notion Canon — Phase 2 (renderer rewrite + bundles + tool rewire) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the ASCII renderer to consume the official Notion API objects (the Phase-1 canon) directly, introduce the `PageRender`/`DatabaseRender` bundles, rewire `read_page`/`read_database`/`render_mockup` onto them, and delete the simplified `Block`/`Page`/`DatabaseView` model + its mappers (`page-model.ts`, `database-model.ts`) + `render/schema.ts`.

**Architecture:** The renderer keeps its two-engine, one-file-per-type registry structure (`createRegistry<T>()`) and ALL its model-agnostic primitives (`box.ts`, `text.ts`, `hcat`, table grids) UNCHANGED. Only the thin field-reading layer changes: each block renderer reads `block.<type>.rich_text` (→ `richTextToPlain`) instead of `block.text`; each view renderer reads official `PageObject` rows + the `ViewObject` configuration, formatting each cell via a shared `renderPropertyValue(PropertyValue)` (the successor to `flattenValue`). The render entry becomes `render(PageRender | BlockObject | BlockObject[] | DatabaseRender, width?)`. We migrate **in place** in dependency order, keeping the gate green at every task boundary, switching the tools as each engine lands and deleting the old model last.

**Tech Stack:** TypeScript, Bun (`bun test`), Zod v4, Biome. Run from `plugins/maccing-notion/mcp/`.

**Spec:** `docs/superpowers/specs/2026-06-16-official-notion-api-canon-design.md`
**Phase-1 canon (already shipped, green):** `src/notion/` — `BlockObject` (`blocks/block.ts`), `PageObject` (`page.ts`), `DatabaseObject` (`database.ts`), `DataSourceObject` (`data-source.ts`), `ViewObject` (`view.ts`), `QueryResult` (`query.ts`), `PropertyValue` (`property-values/property-value.ts`), `PropertySchema` (`property-schema.ts`), `RichTextObject` (`rich-text.ts`), `Icon`/`Cover` (`file.ts`).

## Global Constraints

- **No new dependency.** `zod` v4 is the only schema lib. Bun is the package manager.
- **Render output stays VISUALLY faithful** to today's mockups (same ASCII box-art) — the INPUT shape changes, not the look. Where today's output and the official-shaped render legitimately differ, the official-shaped result wins (it is the source of truth). The box-closure / no-overflow / emoji-width invariants in `src/render/index.test.ts` and `views.test.ts` MUST stay green (re-expressed on official inputs).
- **Reuse, don't reinvent, the primitives.** `box.ts`, `text.ts` (`wordWrap`/`clip`/`padRight`/`displayWidth`), `hcat`, `renderTableGrid`, `databaseHeader`, the calendar/timeline/chart geometry — all stay. Only field reads change.
- **`richTextToPlain`** already lives in `src/readers/page.ts` and reads `.plain_text` off each run — it works on official `RichTextObject[]` unchanged. Import and reuse it; do NOT write a second one.
- **The registry/engine dispatch is unchanged** — `createRegistry<TNode>()` (`render/registry.ts`) stays; only `TNode` becomes the official type (`BlockObject` / a view node).
- **Server metadata is already optional** in the canon, so hand-authored proposal objects validate — the renderer must tolerate missing `id`/timestamps (it already ignores them).
- **Runtime-acyclic invariant** (`src/architecture.test.ts`) MUST stay green.
- **Gate after every task:** `cd plugins/maccing-notion/mcp && bunx tsc --noEmit && bunx biome check --write src && bunx biome check src && bun test` — all green.
- Bun-native; one commit per task with `notion(mcp):` messages.

## Behavior changes (explicit, chosen)

- **Inline databases in a page body** render as `child_database` **references** (a titled `[db] …` line), NOT as full embedded galleries — because an official page body contains `child_database` blocks (id + title), not embedded databases. Full database rendering is the `DatabaseRender` bundle (the `read_database` path). This replaces the old simplified `database` inline block.
- **`render_mockup` input** becomes `PageRender | BlockObject | BlockObject[] | DatabaseRender` (official shapes + the two bundles), replacing the compact `{type:"table", columns, rows}` shapes. A hand-authored proposal is now an official-shaped object.
- **`read_page` mockup** builds a `PageRender` (page object + its block tree with children NESTED into each block's payload). **`read_database` mockup** builds a `DatabaseRender`.

## File structure (Phase 2)

```
CREATE:
  src/notion/render-bundles.ts        # PageRender, DatabaseRender (zod + types) — thin compositions of canon objects
  src/render/property-value.ts        # renderPropertyValue(PropertyValue): string  (successor to flattenValue)
  src/render/property-value.test.ts
REWRITE (field reads only; keep structure + primitives):
  src/render/blocks/engine.ts         # Block union → BlockObject; registry<BlockObject>; renderBlocks reads official type
  src/render/blocks/text.ts           # read block.<type>.rich_text via richTextToPlain; callout reads .rich_text + .icon
  src/render/blocks/media.ts          # read block.<type>.{external?.url|file?.url, caption, language, expression}
  src/render/blocks/layout.ts         # divider/column_list/table/table_row/breadcrumb/toc/synced_block/child_page/child_database/link_to_page/unsupported
  src/render/page.ts                  # Page → PageObject; chrome from title-property + icon(Icon) + cover
  src/render/index.ts                 # render(PageRender|BlockObject|BlockObject[]|DatabaseRender, width?)
  src/render/blocks/database/views/engine.ts   # DatabaseView → a view render node from ViewObject+rows
  src/render/blocks/database/views/*.ts         # each view reads ViewObject config + PageObject[] rows + renderPropertyValue
  src/render/blocks/database/database.ts        # DatabaseRender renderer (header + view tabs + selected view)
  src/render/blocks/database/header.ts          # databaseHeader — keep, fed by official view names
REWIRE:
  src/tools/read-page.ts              # nest children into payloads; pass PageRender to render(); drop pageFromNotion
  src/tools/read-database.ts          # build DatabaseRender; drop databaseToModel/resolveView/groupOptionsFor
  src/tools/render-mockup.ts          # parse with the new official mockupSchema
DELETE (last):
  src/render/page-model.ts (+ .test.ts)      # pageFromNotion/mapBlock/RawBlock/RawPage
  src/render/database-model.ts (+ .test.ts)  # databaseToModel/flattenValue/viewToBlock/resolveView/groupOptionsFor
  src/render/schema.ts                       # blockSchema/pageSchema/viewSchema/mockupSchema (replaced)
```

The render primitives `box.ts`, `text.ts` and their tests are UNTOUCHED.

---

### Task 1: Render bundles + the official cell formatter

**Files:**
- Create: `src/notion/render-bundles.ts`, `src/render/property-value.ts`, `src/render/property-value.test.ts`

**Interfaces:**
- Produces: `pageRender`/`PageRender` (`{ page: PageObject, blocks: BlockObject[] }`), `databaseRender`/`DatabaseRender` (`{ database: DatabaseObject, dataSource: DataSourceObject, views: ViewObject[], rows: PageObject[] }`) — zod compositions of the canon. `renderPropertyValue(value: PropertyValue): string`.

This task is ADDITIVE — nothing consumes these yet, so the gate stays green trivially.

- [ ] **Step 1: Write the failing test** `src/render/property-value.test.ts`. Port the `flattenValue` matrix from `src/render/database-model.test.ts` (read it first) onto official `PropertyValue` shapes. `renderPropertyValue` is the DISPLAY formatter (same output rules as the existing `propertyToString` in `readers/page.ts` — reuse `propertyToString` if it already does exactly this; otherwise mirror it). Cover: title/rich_text (richTextToPlain), number, select/status (.name), multi_select (comma join), checkbox (☑/☐), date (start / start → end), people (names), url/email/phone, files (names), created/last_edited_time, unique_id (PREFIX-N), created_by/last_edited_by (.name), rollup (number or "N item(s)"), formula (route by sub-type), relation ("N linked" — relation is resolved to titles separately by the tool; the cell formatter shows the count or the ids). One assertion per type + a couple null/empty cases + unknown → "".

```ts
import { expect, test } from "bun:test";
import { renderPropertyValue } from "./property-value";

test("renderPropertyValue formats each value type", () => {
  expect(renderPropertyValue({ type: "number", number: 42 })).toBe("42");
  expect(renderPropertyValue({ type: "select", select: { name: "Done" } })).toBe("Done");
  expect(renderPropertyValue({ type: "checkbox", checkbox: true })).toBe("☑");
  expect(renderPropertyValue({ type: "date", date: { start: "2025-06-09", end: "2025-06-11" } })).toBe("2025-06-09 → 2025-06-11");
  // …one per type, ported from database-model.test.ts's flattenValue matrix…
});
```

- [ ] **Step 2: Run it — fails** (`bun test src/render/property-value.test.ts`).

- [ ] **Step 3: Implement.** `render-bundles.ts`:
```ts
import { z } from "zod";
import { block } from "./blocks/block";
import { dataSource } from "./data-source";
import { database } from "./database";
import { page } from "./page";
import { view } from "./view";

export const pageRender = z.object({ page, blocks: z.array(block) });
export type PageRender = z.infer<typeof pageRender>;

export const databaseRender = z.object({
  database,
  dataSource,
  views: z.array(view),
  rows: z.array(page),
});
export type DatabaseRender = z.infer<typeof databaseRender>;
```
(Note: `render-bundles.ts` lives under `src/notion/`, so the imports are `./blocks/block`, `./database`, etc.)
`render/property-value.ts`: `renderPropertyValue(value: PropertyValue): string` — narrow on `value.type` and format. PREFER delegating to the existing `propertyToString` from `../readers/page.ts` if its output exactly matches the flattenValue matrix (it should — it was kept in sync). If it does, `renderPropertyValue` is a thin typed facade over it; if a case differs (e.g. relation), handle that case explicitly and delegate the rest.

- [ ] **Step 4: Run — passes.**
- [ ] **Step 5: Gate + commit** `notion(mcp): render — bundles (PageRender/DatabaseRender) + official cell formatter`.

---

### Task 2: Block renderers + page rendering consume official objects; rewire read_page

**Files:**
- Modify: `src/render/blocks/engine.ts`, `src/render/blocks/text.ts`, `src/render/blocks/media.ts`, `src/render/blocks/layout.ts`, `src/render/page.ts`, `src/render/index.ts`, `src/tools/read-page.ts`
- Modify/replace test: `src/render/index.test.ts` fixtures become official-shaped; `src/render/page-model.test.ts` is superseded (deleted in Task 5)

**Interfaces:**
- Consumes: `BlockObject`, `PageObject`, `Icon` (canon); `PageRender` (Task 1); `richTextToPlain` (`readers/page.ts`); `iconGlyph` (`readers/object.ts` — note it takes the loose `NotionIcon`; the canon `Icon` is structurally compatible for the fields it reads (`type`, `emoji`, `icon.name`) — pass it through, widening at the call site if tsc requires).
- Produces: `render(mockup: PageRender | BlockObject | BlockObject[] | DatabaseRender, width?)`; `Block` is now `= BlockObject`; `renderBlocks(blocks: BlockObject[], width, depth)`.

**The field-read remapping (from the renderer map — apply per renderer, keeping the box-art identical):**
- `engine.ts`: `export type Block = BlockObject` (import from `../../notion/blocks/block`); `createRegistry<BlockObject>()`; `renderBlocks` reads `block.type`; the TIGHT set (`bulleted_list_item`/`numbered_list_item`/`to_do`) unchanged.
- `text.ts`: each text renderer reads `block.<type>.rich_text` → `richTextToPlain(...)` for the line text; `heading_1/2/3/4` read `block.<type>.is_toggleable` and `.children`; `to_do` reads `block.to_do.checked`; `callout` reads `block.callout.rich_text` (→ text, split on `\n` for `lines`) + `block.callout.icon` (→ `iconGlyph`); children come from `block.<type>.children`. Add `heading_4` (renders `####`-equivalent — match the heading style ladder).
- `media.ts`: `image/video/audio/file/pdf` read the file payload (`block.<type>.external?.url ?? block.<type>.file?.url ?? "(uploaded)"`, `.caption` via `richTextToPlain`, `.name` where present); `bookmark`/`embed` read `block.<type>.url` + caption; `link_preview` reads `.url`; `code` reads `block.code.language` + `richTextToPlain(block.code.rich_text)` + caption; `equation` reads `block.equation.expression`.
- `layout.ts`: `divider` (unchanged); `column_list`/`column` read `block.<type>.children` (column_list's children are column blocks, each column's children are blocks); `table` reads `block.table.{has_column_header}` + its `table_row` children, each `block.table_row.cells` (a `RichTextObject[][]`) → `richTextToPlain` per cell → `rows: string[][]`; `breadcrumb` (placeholder); `table_of_contents` (placeholder); `synced_block` reads `block.synced_block.children`; `child_page` → reference `[page] <title>` from `block.child_page.title`; `child_database` → reference `[db] <title>` from `block.child_database.title`; `link_to_page` → reference; `unsupported`/`tab`/`meeting_notes`/`transcription`/`template` → a labeled placeholder (render `tab` as a labeled container if its children are present; the others as a one-line `[meeting notes]`/`[template]` placeholder).
- `page.ts`: `render` a `PageObject`: title from the `title`-type property (`titleOf` in `readers/page.ts` already does this — reuse), `icon` via `iconGlyph(page.icon)`, `cover` band if `page.cover` present; body is `renderBlocks(blocks)`. The `Page` type is replaced by `PageRender` (page + blocks) at the entry.
- `index.ts`: `render(mockup, width?)` routes — `Array.isArray` → `renderBlocks`; has `page` + `blocks` → page chrome + body (PageRender); has `database`+`dataSource` → DatabaseRender renderer (Task 3 — until then, a `child_database`-style stub or throw a clear "not yet" is acceptable WITHIN this task only if the gate stays green; PREFER landing Task 3 before exposing DatabaseRender); a single block / block array → block engine; then `finish`.
- `read-page.ts`: in `fetchBlockTree`, NEST fetched children into the block's payload (`block[block.type].children = await fetchBlockTree(...)`) instead of top-level `block.children`; in the mockup branch, build `{ page: pageResponse.body, blocks: tree }` (a `PageRender`) and call `render(pageRender)`. Drop the `pageFromNotion`/`RawPage`/`RawBlock` imports.

- [ ] **Step 1: Update `src/render/index.test.ts`** — convert the page/block fixtures from simplified shapes to official `BlockObject`/`PageRender` shapes (use the canon: `{ type:"paragraph", paragraph:{ rich_text:[{type:"text",text:{content:"…"}}] } }`, etc.). Keep EVERY invariant assertion (box-closure via `assertBoxesClose`, no-overflow, emoji width, ordered-list threading, bullet depth, checkbox, heading ladder, page chrome). This is the failing test (renderers don't read official fields yet).
- [ ] **Step 2: Run — fails.**
- [ ] **Step 3: Rewrite the renderers + page + entry + read-page** per the remapping above. Keep all box-art/primitives. 
- [ ] **Step 4: Run — `bun test src/render/index.test.ts` passes; full `bun test` green** (the database/view tests still use the OLD model via `database-model.ts` until Task 3 — keep `database-model.ts` + the old view engine intact this task; the `Block` union no longer has a `database` variant, so the old `DatabaseBlock` rendering is temporarily NOT reachable through the block engine — that's fine, read_database still calls the old `databaseToModel`+`render({type:"database",…})` path WHICH NO LONGER TYPE-CHECKS against the new `Block`. To keep green: in THIS task, keep `read-database.ts` rendering through the OLD `render` by temporarily routing its `{type:"database"}` object through the still-present old database renderer — OR move Task 3 to immediately follow and accept that read_database's mockup is the only red until Task 3. Decision: keep `database-model.ts`'s own internal render path callable so read_database stays green; if that's infeasible, SPLIT: land block/page rendering here and the database/view rewrite in Task 3 in the same session before any commit that leaves read_database red. The reviewer must confirm the gate is green at the task boundary.)
- [ ] **Step 5: Gate + commit** `notion(mcp): render — blocks + page consume official BlockObject/PageObject; read_page builds PageRender`.

> Implementation note for the executor: the cleanest way to keep the gate green is to land Task 2 and Task 3 as a pair (block/page first, then view/database) and only commit each once `bunx tsc --noEmit && bun test` is fully green. If decoupling proves to leave `read_database` red, fold Task 3's database entry wiring into Task 2's commit so no commit is left red.

---

### Task 3: View renderers + DatabaseRender consume official objects; rewire read_database

**Files:**
- Modify: `src/render/blocks/database/views/engine.ts`, every `src/render/blocks/database/views/*.ts`, `src/render/blocks/database/database.ts`, `src/render/blocks/database/header.ts`, `src/tools/read-database.ts`
- Modify test: `src/render/blocks/database/views/views.test.ts` (official inputs), `src/render/index.test.ts` (the DatabaseRender kitchen-sink case)

**Interfaces:**
- Consumes: `DatabaseRender` (Task 1), `ViewObject`, `PageObject`, `DataSourceObject`, `PropertySchema`, `renderPropertyValue` (Task 1).
- Produces: the view render engine now takes a "view node" = `{ view: ViewObject, rows: PageObject[], dataSource: DataSourceObject, tabs: string[] }` (or pass these as renderer args). `render(databaseRender)` → header + view tabs + the selected view.

**The migration (relocating `database-model.ts` logic into the renderers):**
- The view renderers stop receiving pre-flattened `string[]`/`GalleryCard[]`. Instead each receives the official `ViewObject` (for its `configuration.properties` visible columns, `group_by`, `date_property_id`), the `PageObject[]` rows, and the `DataSourceObject` (for the column schema → group-by options, title column). Each renderer:
  - resolves visible column NAMES from `view.configuration.properties[].property_id` → `dataSource.properties` (the `resolveView` logic moves here), filtering `visible !== false`;
  - reads each row's cell via `renderPropertyValue(row.properties[columnName])`;
  - `table`: columns × rows grid (reuse `renderTableGrid`);
  - `board`: group rows by `renderPropertyValue(row.properties[groupByName])`, seed empty groups from the schema's status/select options (the `groupOptionsFor` logic moves here), cap dominant column at 6;
  - `gallery`/`list`/`calendar`/`timeline`/`chart`/`form`/`map`/`dashboard`/`feed`: same field-derivation as today but sourced from official rows + config.
- `database.ts`: `render(databaseRender)` builds the tab names from `views.map(v => v.name)`, picks the selected view, renders header (icon/title from `database`/`dataSource`) + the selected view. (The `view?: number|"all"` selection moves to a render option / the tool decides; default 0.)
- `header.ts`: `databaseHeader(name, tabNames, width)` — unchanged primitive, fed official names.
- `read-database.ts`: fetch database + data_source + views + sampled rows → build a `DatabaseRender` → `render(databaseRender)`. Drop `databaseToModel`/`resolveView`/`groupOptionsFor` imports (their logic now lives in the renderers).
- `index.ts`: wire the `DatabaseRender` branch of `render(...)` to the database renderer.

- [ ] **Step 1: Update `views.test.ts` + the index.test.ts DatabaseRender case** to official inputs (a `ViewObject` + `PageObject[]` rows + a `DataSourceObject` schema). Keep every alignment/no-overflow/leap-year/board-seeding/empty-state invariant. Failing test.
- [ ] **Step 2: Run — fails.**
- [ ] **Step 3: Rewrite the view engine + view renderers + database.ts + read-database.ts** per the migration. Keep all geometry/box primitives.
- [ ] **Step 4: Run — full `bun test` green** (including the box-closure invariants on the official-shaped kitchen sink).
- [ ] **Step 5: Gate + commit** `notion(mcp): render — views + DatabaseRender consume official ViewObject/PageObject rows; read_database builds DatabaseRender`.

---

### Task 4: render_mockup accepts the official shapes

**Files:**
- Create: `src/render/mockup-schema.ts` (the official input validator) OR add to `render-bundles.ts`
- Modify: `src/tools/render-mockup.ts`, `src/tools/render-mockup.test.ts`

**Interfaces:**
- Produces: `mockupSchema = z.union([pageRender, block, z.array(block), databaseRender])` — the render_mockup tool's input, from the canon + bundles. `render-mockup.ts` parses with it and calls `render(parsed, width)`.

- [ ] **Step 1: Update `render-mockup.test.ts`** — valid `PageRender` renders; a bare `BlockObject[]` renders; a `DatabaseRender` renders; an invalid block (`{type:"bogus"}`) returns `isError:true`; the old compact `{type:"table",columns,rows}` shape is REJECTED. Failing test.
- [ ] **Step 2: Run — fails.**
- [ ] **Step 3: Implement `mockupSchema`** (union of `pageRender`, `block`, `z.array(block)`, `databaseRender`) and switch `render-mockup.ts` to it. Update the tool DESCRIPTION to say it accepts official Notion objects + the two render bundles.
- [ ] **Step 4: Run — passes.**
- [ ] **Step 5: Gate + commit** `notion(mcp): render_mockup — accept official shapes + render bundles`.

---

### Task 5: Delete the simplified model, mappers, and old wire schema

**Files:**
- Delete: `src/render/page-model.ts`, `src/render/page-model.test.ts`, `src/render/database-model.ts`, `src/render/database-model.test.ts`, `src/render/schema.ts`
- Modify: `src/render/index.ts` (drop the deleted re-exports), any lingering importer

**Interfaces:** none new — this is removal + export cleanup.

- [ ] **Step 1:** `grep -rn "page-model\|database-model\|render/schema\|pageFromNotion\|databaseToModel\|flattenValue\|resolveView\|groupOptionsFor\|mockupSchema\|RawBlock\|RawPage\|\bBlock\b.*from.*engine" src` — confirm every consumer was rewired in Tasks 2–4. Any remaining reference is a missed rewire — fix it.
- [ ] **Step 2:** Delete the five files. Remove their re-exports from `src/render/index.ts`.
- [ ] **Step 3:** `bunx tsc --noEmit` — fix any dangling import (there should be none if Tasks 2–4 were complete). Run `bun test` — the deleted-file tests are gone; everything else green. Run the acyclic test.
- [ ] **Step 4: Gate + commit** `notion(mcp): render — delete simplified model, mappers, and old wire schema (canon is the source of truth)`.

---

### Task 6: Phase 2 convergence — visual + invariant verification

**Files:** none (verification + any surfaced fixes).

- [ ] **Step 1:** Full gate — `bunx tsc --noEmit && bunx biome check src && bun test` (all green, acyclic passes).
- [ ] **Step 2:** Render the kitchen-sink fixtures (every block type + all 11 view types, an emoji-heavy page) through the OFFICIAL path and assert box-closure / no-overflow / emoji-width hold — these invariants are the contract; they must look identical to Phase-1 output for the same logical content.
- [ ] **Step 3:** Adversarial review (independent reviewers) until clean: every renderer reads the correct official field; no simplified-model/mapper/`render/schema.ts` reference remains anywhere; `read_page`/`read_database`/`render_mockup` feed official objects end-to-end; the two bundles are the only non-atomic compositions; `renderPropertyValue` covers every `PropertyValue` type; inline databases render as `child_database` references (the chosen behavior change) and full databases render via `DatabaseRender`.
- [ ] **Step 4:** Commit any review fixes; Phase 2 ships green.

---

## Self-Review

**Spec coverage (design's Phase 2 + Phase 3):** renderer consumes official shapes (Tasks 2–3) ✓; `PageRender`/`DatabaseRender` bundles (Task 1) ✓; flatten/group logic relocated into renderers + `renderPropertyValue` (Tasks 1, 3) ✓; `render_mockup` takes official shapes (Task 4) ✓; `read_page`/`read_database` rewired (Tasks 2–3) ✓; delete simplified model + mappers + `render/schema.ts` (Task 5) ✓; visual faithfulness + invariants preserved (Tasks 2,3,6) ✓. The design's Phase 2 and Phase 3 are merged here because the union change couples the renderer rewrite and the tool rewire — they cannot land green independently.

**Placeholder scan:** the per-renderer field-read remappings are concrete (sourced from the renderer map + the canon field names), not vague TODOs. Each task names exact files, the official field each renderer reads, the invariants to preserve, and a commit. The one judgement call flagged inline (Task 2/3 green-coupling) is an explicit instruction to the executor, not a deferral.

**Type consistency:** `PageRender`/`pageRender`, `DatabaseRender`/`databaseRender`, `renderPropertyValue`, `render(mockup,width?)`, `Block = BlockObject`, `richTextToPlain` (reused), `iconGlyph` (reused), `titleOf` (reused) — names used consistently across tasks. `mockupSchema` is redefined (official) in Task 4 and deleted-old in Task 5.

**Risk:** the renderer rewrite is large and the box-art invariants are exacting; mitigated by (a) reusing ALL primitives unchanged, (b) keeping `index.test.ts`/`views.test.ts` box-closure invariants as the gate, (c) the Task 2/3 green-coupling note, (d) a dedicated convergence task (6).
