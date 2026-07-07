# Blocks/Views Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the render module's single `MockupBlock` union + registry into two parallel systems — a `Block` engine (official Notion blocks only) and a `DatabaseView` engine (the 11 official views, incl. the net-new `feed`) — with views colocated one-per-file under `blocks/database/views/`, `page` as its own root concept, and a single one-directional `database → view-engine` bridge.

**Architecture:** A generic `createRegistry<T>()` factory is instantiated twice (blocks, views). View shapes/renderers move under `blocks/database/views/<type>.ts`; the `database` block delegates to the view engine; `page` becomes a root the entry routes to. All cross-engine type references are `import type` so the runtime graph stays an acyclic DAG (`architecture.test.ts` enforces it).

**Tech Stack:** TypeScript, Bun (`bun test`), Zod, Biome. Run from `plugins/maccing-notion/mcp/`.

**Spec:** `docs/superpowers/specs/2026-06-16-blocks-views-split-design.md`

**TDD note:** This is mostly a *behavior-preserving* refactor — the executable "test" for each refactor task is **the full existing suite + typecheck + lint staying green, including the acyclic-import test**. The one net-new behavior (`feed`, Task 7) uses real RED→GREEN TDD. The verification command for every task is:

```bash
cd plugins/maccing-notion/mcp && bunx tsc --noEmit && bunx biome check src && bun test
```
Expected after each task: `tsc` clean, `biome` clean, all tests pass (the count grows only in Tasks 6–7), and the test `the src/ import graph is acyclic (no module cycles)` passes.

**Current layout (starting point):** `render/engine.ts` holds `MockupBlock` union + `register`/`renderBlock`/`renderBlocks`. View renderers live in `render/blocks/{cards,data,list,time}.ts`; block renderers in `render/blocks/{text,media,layout,page,database}.ts` + `database-header.ts`; `render/blocks/index.ts` side-effect-imports them. `render/{index,page-model,database-model,schema,box,text}.ts` at root. After my prior refactor, block types are colocated in their renderer files and `MockupBlock` lives in `engine.ts`.

---

### Task 1: Generic registry factory

**Files:**
- Create: `render/registry.ts`
- Modify: `render/engine.ts`

- [ ] **Step 1: Create the factory**

```ts
// render/registry.ts
// A type→renderer registry with single-block dispatch. ONE implementation, instantiated per domain
// (blocks, database views). Imports nothing — a runtime sink, so neither engine forms an import cycle.

export type Renderer<TNode> = (node: TNode, width: number, depth: number, ordinal: number) => string[];

export interface Registry<TNode extends { type: string }> {
  register: <T extends TNode["type"]>(type: T, render: Renderer<Extract<TNode, { type: T }>>) => void;
  render: (node: TNode, width: number, depth: number, ordinal: number) => string[];
}

/** Create a fresh registry for a node union. `register` narrows the node to its `type` at the call site. */
export function createRegistry<TNode extends { type: string }>(): Registry<TNode> {
  const registry = new Map<string, Renderer<TNode>>();
  return {
    register(type, render) {
      registry.set(type, render as Renderer<TNode>);
    },
    render(node, width, depth, ordinal) {
      return registry.get(node.type)?.(node, width, depth, ordinal) ?? [];
    },
  };
}
```

- [ ] **Step 2: Adopt it in the block engine (no rename yet)**

In `render/engine.ts`, replace the hand-written `const registry = new Map(...)`, `export function register(...)`, and `export function renderBlock(...)` with the factory instance. Keep `MockupBlock`, `BlockRenderer`, and `renderBlocks` as-is for now:

```ts
import { createRegistry } from "./registry";
// …MockupBlock union stays…
const blocks = createRegistry<MockupBlock>();
export const registerBlock = blocks.register;
export const renderBlock = blocks.render;
// Keep a temporary alias so existing block files (which import `register`) still compile this task:
export const register = blocks.register;
// renderBlocks (the list-walker) stays unchanged, calling renderBlock.
```

Keep `export type BlockRenderer<…>` as a re-export of `Renderer<…>` or leave the local alias — whichever keeps `blocks/text.ts`/`media.ts` (which import `BlockRenderer`) compiling unchanged.

- [ ] **Step 3: Verify green**

```bash
cd plugins/maccing-notion/mcp && bunx tsc --noEmit && bunx biome check src && bun test
```
Expected: clean, all tests pass, acyclic test passes.

- [ ] **Step 4: Commit**

```bash
git add render/registry.ts render/engine.ts
git commit -m "render: extract createRegistry<T>() factory; block engine uses it"
```

---

### Task 2: Reorganize the union into `Block` + `DatabaseView` (transitional alias)

This is a pure type reorganization in `render/engine.ts` — still ONE registry, still green. It isolates the view members so the next task can move them.

**Files:**
- Modify: `render/engine.ts`

- [ ] **Step 1: Define the two sub-unions + keep `MockupBlock` as their union**

In `render/engine.ts`, split the existing `MockupBlock` definition into a `Block` union (every member EXCEPT the 10 views and `database`), a `DatabaseView` union (table · board · gallery · list · calendar · timeline · chart · form · map · dashboard — referencing the existing imported member interfaces), keep `DatabaseBlock` and `page` in `Block`, and define:

```ts
export type DatabaseView =
  | TableBlock | GalleryBlock | BoardBlock | ListBlock | CalendarBlock
  | TimelineBlock | ChartBlock | FormBlock | MapBlock | DashboardBlock;

export type Block =
  | { type: "paragraph"; text?: string; children?: Block[] }
  | /* …all current content/media/simple members, with children?: Block[]… */
  | DatabaseBlock
  | PageBlock
  | { type: "unsupported"; label?: string };

// Transitional: existing code still references MockupBlock.
export type MockupBlock = Block | DatabaseView;
```

Change the recursive `children?: MockupBlock[]` fields inside the content-block members to `children?: Block[]` (children are blocks, never views — this is the real contract). `DashboardWidget.view` (in `blocks/data.ts`) currently is `MockupBlock`; leave it as `MockupBlock` THIS task (narrowed in Task 3).

- [ ] **Step 2: Verify green** (same command). `MockupBlock = Block | DatabaseView` keeps every existing reference valid. Expected: clean, all pass.

- [ ] **Step 3: Commit**

```bash
git add render/engine.ts
git commit -m "render: reorganize MockupBlock into Block + DatabaseView (transitional alias)"
```

---

### Task 3: Stand up the view engine + move view renderers under `blocks/database/views/`

The big move. Create the view engine, relocate the 10 view renderers one-per-file, and rewire the `database` block + `dashboard` to dispatch through the **view** engine. After this task views are NO longer in the block registry.

**Files:**
- Create: `render/blocks/database/views/engine.ts`, `render/blocks/database/views/index.ts`
- Create: `render/blocks/database/views/{table,board,gallery,list,calendar,timeline,chart,form,map,dashboard}.ts`
- Create: `render/blocks/database/database.ts`, `render/blocks/database/header.ts`
- Delete: `render/blocks/{cards,data,list,time,database,database-header}.ts`
- Modify: `render/engine.ts`, `render/blocks/index.ts`

- [ ] **Step 1: View engine**

```ts
// render/blocks/database/views/engine.ts
import { createRegistry } from "../../../registry";
import type { BoardBlock, GalleryBlock } from "./gallery"; // …import each view's type, type-only…
import type { TableBlock } from "./table";
// …etc for every view file…

export type DatabaseView =
  | TableBlock | GalleryBlock | BoardBlock | ListBlock | CalendarBlock
  | TimelineBlock | ChartBlock | FormBlock | MapBlock | DashboardBlock;

const views = createRegistry<DatabaseView>();
export const registerView = views.register;
export const renderView = views.render;

/** Stack views with a blank line between (used by `database` view:"all" and by `dashboard` widgets). */
export function renderViews(list: DatabaseView[], width: number): string[] {
  const out: string[] = [];
  for (let index = 0; index < list.length; index++) {
    if (index > 0) out.push("");
    out.push(...renderView(list[index], width, 0, 0));
  }
  return out;
}
```

- [ ] **Step 2: Move each view renderer to its own file**

For each view, create `render/blocks/database/views/<type>.ts` containing that view's member interface(s) + its renderer body (moved verbatim from the current file) + `registerView("<type>", <renderer>)`. Mapping:
- `gallery.ts` ← `GalleryCard`, `GalleryBlock`, `renderGallery` (+ `register("gallery", renderGallery)` → `registerView`). Keep `GalleryCard` exported (used by `database-model.ts`).
- `board.ts` ← `BoardGroup`, `BoardBlock`, `renderBoard`.
- `table.ts` ← `TableBlock` + the inline `register("table", …)` lambda body (from `data.ts`) as `renderTable`.
- `chart.ts` ← `ChartDatum`, `ChartBlock`, `renderChart`. `form.ts` ← `FormField`, `FormBlock`, `renderForm`. `map.ts` ← `MapBlock`, `renderMap`. `dashboard.ts` ← `DashboardWidget`, `DashboardBlock`, `renderDashboard`.
- `list.ts` ← `ListItem`, `ListBlock`, `renderList`. `calendar.ts` ← `CalendarEvent`, `CalendarBlock`, `renderCalendar` (+ `dayOfWeek`/`daysInMonth`/`MONTHS` helpers it uses). `timeline.ts` ← `TimelineRow`, `TimelineBlock`, `renderTimeline`.

Each file imports `registerView` from `./engine`, `box`/`text` primitives from `../../../box`/`../../../text`, and `databaseHeader` from `../header` (Step 3). `dashboard.ts` additionally imports `{ renderView }` from `./engine` and types `DashboardWidget.view: DatabaseView`; its renderer calls `renderView(widget.view, total, 0, 0)` (was `renderBlock`).

- [ ] **Step 3: Move the view chrome**

Move `render/blocks/database-header.ts` → `render/blocks/database/header.ts` (content unchanged; fix its relative imports of `box`/`text` to `../../box`/`../../text`). It exports `databaseHeader`, imported by the view files.

- [ ] **Step 4: The `database` block (bridge)**

```ts
// render/blocks/database/database.ts
import { header } from "../../box";
import { registerBlock } from "../engine";
import { type DatabaseView, renderViews } from "./views/engine";

export interface DatabaseModel {
  title: string; icon?: string; description?: string; width?: number;
  views: DatabaseView[];
  /** which view to render: an index, or "all" for every view stacked. Default 0. */
  view?: number | "all";
}
export interface DatabaseBlock { type: "database"; database: DatabaseModel; }

function renderDatabaseLines(database: DatabaseModel, total: number): string[] {
  const out = header(database.icon, database.title, undefined, database.description, total);
  const which = database.view ?? 0;
  const selected = which === "all" ? database.views : [database.views[which]].filter(Boolean);
  return [...out, ...renderViews(selected, total)];
}
registerBlock("database", (block, width) => renderDatabaseLines(block.database, width));
```

`ViewBlock` (the old alias for the view union) is removed; `database-model.ts` and `engine.ts` switch to `DatabaseView`. `DatabaseModel`/`DatabaseBlock` now live here (moved out of `engine.ts`'s imports — `engine.ts` imports `DatabaseBlock` from this file `import type`).

- [ ] **Step 5: Rewire the union home + registration aggregators**

In `render/engine.ts`: `DatabaseView` and the view member imports move OUT (now in `views/engine.ts`); `MockupBlock` becomes `Block | DatabaseView` by importing `DatabaseView` from `./blocks/database/views/engine` (`import type`); `DatabaseBlock` imported from `./blocks/database/database` (`import type`). Delete the now-unused view-type imports.
Add `render/blocks/database/views/index.ts` (side-effect: `import "./table"; import "./board"; …` for all 10 + `import "./engine"`). In `render/blocks/index.ts`, replace `import "./cards"; import "./data"; import "./list"; import "./time"; import "./database";` with `import "./database/database"; import "./database/views";`.

- [ ] **Step 6: Delete the old files**

```bash
git rm render/blocks/cards.ts render/blocks/data.ts render/blocks/list.ts render/blocks/time.ts render/blocks/database.ts render/blocks/database-header.ts
```

- [ ] **Step 7: Verify green** (same command). Pay attention to the acyclic test — confirm `database/database.ts → views/engine` is the only block→view runtime edge and the view files only import `views/engine` at runtime. Expected: clean, all pass. (Some `index.test.ts`/`database-model.test.ts` cases that render a *standalone* view via `render([{type:"gallery"…}])` will FAIL here — they're handled in Task 6; if blocking, temporarily `test.skip` them with a `// TODO Task 6` and unskip in Task 6.)

- [ ] **Step 8: Commit**

```bash
git add -A render/blocks render/engine.ts
git commit -m "render: split out the database-view engine; views colocated one-per-file under blocks/database/views"
```

---

### Task 4: Finalize the block engine (`MockupBlock` → `Block`)

Drop the transitional alias and the block-engine's `register`/`MockupBlock` names.

**Files:**
- Move: `render/engine.ts` → `render/blocks/engine.ts`
- Modify: every importer of the engine (`render/index.ts`, `render/schema.ts`, `render/page-model.ts`, `render/database-model.ts`, `render/blocks/{text,media,layout,page}.ts`, `render/blocks/database/**`)

- [ ] **Step 1: Move + rename**

`git mv render/engine.ts render/blocks/engine.ts`. Inside: remove `export const register` and `export type MockupBlock = Block | DatabaseView` (the alias). The block engine now exports `Block`, `registerBlock`, `renderBlock`, `renderBlocks`, `BlockRenderer`. The `Block` union no longer includes the 10 views; `MockupBlock` ceases to exist.

- [ ] **Step 2: Update importers**

Replace every `MockupBlock` with `Block`, every `register(` (block registration) with `registerBlock(`, and fix import paths to `./blocks/engine` / `../engine` / `./engine` as appropriate. `DashboardWidget.view` is already `DatabaseView` (Task 3). `children?: Block[]` everywhere. `schema.ts` annotation becomes `z.ZodType<Block>` for the block schema (split fully in Task 6). `database-model.ts` imports `DatabaseView`/`DatabaseModel` from `./blocks/database/...`.

- [ ] **Step 3: Verify green** (same command). Expected: clean, all pass (modulo any standalone-view tests deferred to Task 6).

- [ ] **Step 4: Commit**

```bash
git add -A render
git commit -m "render: rename MockupBlock→Block; block engine moves to blocks/engine.ts (views fully separated)"
```

---

### Task 5: Extract `Page` as a root concept

**Files:**
- Create: `render/page.ts`
- Modify: `render/index.ts`, `render/page-model.ts`, `render/blocks/engine.ts` (remove `PageBlock` from `Block`), delete `render/blocks/page.ts`

- [ ] **Step 1: `Page` type + renderer**

```ts
// render/page.ts
import { header } from "./box";
import { type Block, renderBlocks } from "./blocks/engine";

export interface Page {
  type: "page"; title: string; icon?: string; cover?: string;
  description?: string; width?: number; children: Block[];
}
const DEFAULT_WIDTH = 70;

/** Render a whole page: chrome (cover · icon · title · description) above its block body. Not registered. */
export function renderPage(page: Page, width?: number): string[] {
  const total = page.width ?? width ?? DEFAULT_WIDTH;
  return [...header(page.icon, page.title, page.cover, page.description, total), ...renderBlocks(page.children, total, 0)];
}
```

Remove the `page` member from the `Block` union and delete `render/blocks/page.ts` (its body moves to `renderPage`).

- [ ] **Step 2: Rename the mapper + route the entry**

In `render/page-model.ts`, rename `pageToBlock` → `pageFromNotion`, returning `Page` (`type: "page"`, `children: blocks.map(mapBlock)`). In `render/index.ts`, the entry routes a `Page`:

```ts
import { renderBlock, renderBlocks, type Block } from "./blocks/engine";
import { type Page, renderPage } from "./page";
export type Mockup = Page | Block | Block[];

export function render(mockup: Mockup, width?: number): string {
  const total = width && width > 0 ? width : DEFAULT_WIDTH;
  const lines = Array.isArray(mockup)
    ? renderBlocks(mockup, total, 0)
    : mockup.type === "page"
      ? renderPage(mockup, total)
      : renderBlock(mockup, total, 0, 0);
  return finish(lines);
}
```

Update `read-page.ts` (`render(pageFromNotion(...))`) and `index.ts` re-exports (`export { pageFromNotion } from "./page-model"`, `export type { Page } from "./page"`).

- [ ] **Step 3: Verify green** (same command). Update the `index.test.ts` page cases to build `{ type:"page", …, children }` and call `render`. Expected: clean, all pass.

- [ ] **Step 4: Commit**

```bash
git add -A render && git commit -m "render: extract Page as its own root concept (not a Block); rename pageToBlock→pageFromNotion"
```

---

### Task 6: Split the schema; faithful tool surface; relocate standalone-view tests

**Files:**
- Modify: `render/schema.ts`, `render/tools/../render-mockup.ts` (tool), `render/index.test.ts`, `render/database-model.test.ts`
- Create: `render/blocks/database/views/views.test.ts`

- [ ] **Step 1: Split the zod schema**

In `render/schema.ts`, define `viewSchema: z.ZodType<DatabaseView>` (the 10 view objects incl. the shared `dashboardBlock`), `blockSchema: z.ZodType<Block>` (content/media/simple + the `database` block via `databaseModelSchema`, recursion via `children: z.array(blockSchema)`), `pageSchema` (`type:"page"`, `children: z.array(blockSchema)`), `databaseModelSchema` (`views: z.array(viewSchema)`), and:

```ts
export const mockupSchema = z.union([pageSchema, blockSchema, z.array(blockSchema)]);
```

A bare top-level view is no longer accepted (it is not in `mockupSchema`).

- [ ] **Step 2: Tool routes the split input**

`render_mockup`'s handler: `const parsed = mockupSchema.parse(args.mockup); return ok(render(parsed, width));` (unchanged shape; `render` now accepts `Page | Block | Block[]`).

- [ ] **Step 3: Relocate standalone-view tests**

Move the `index.test.ts`/`database-model.test.ts` cases that rendered a *bare* view (gallery/board/calendar/chart/form/list/timeline/map) into `render/blocks/database/views/views.test.ts`, asserting via `renderView(view, 70, 0, 0)` directly. Keep the database/dashboard cases (which exercise the bridge) in place, rewired to `render({type:"database", database:{…}})`. Unskip anything skipped in Task 3.

- [ ] **Step 4: Verify green** (same command). Test count shifts (view cases relocate). Expected: clean, all pass; a bare-view input to `render_mockup` now errors.

- [ ] **Step 5: Commit**

```bash
git add -A render && git commit -m "render: split block/view/page zod schemas; render_mockup is faithful (no bare views); view unit tests via renderView"
```

---

### Task 7: Add the `feed` view (TDD)

**Files:**
- Create: `render/blocks/database/views/feed.ts`
- Modify: `render/blocks/database/views/engine.ts` (add to union + side-effect index), `render/schema.ts` (add to `viewSchema`), `render/blocks/database/views/views.test.ts`

- [ ] **Step 1: Write the failing test**

In `views.test.ts`:

```ts
test("feed view renders a single-column stack of post cards with the database header", () => {
  const out = renderView(
    { type: "feed", name: "Announcements", views: ["Feed"],
      posts: [{ icon: "📣", title: "Launch", preview: "We shipped it", meta: "2d ago" },
              { title: "Hiring", preview: "Two roles open" }] },
    70, 0, 0,
  ).join("\n");
  expect(out).toContain("◷ Announcements"); // view tab-bar header
  expect(out).toContain("📣 Launch");
  expect(out).toContain("We shipped it");
  expect(out).toContain("2d ago");
  for (const line of out.split("\n")) expect(displayWidth(line)).toBeLessThanOrEqual(70);
});
```

- [ ] **Step 2: Run it — verify it fails**

```bash
cd plugins/maccing-notion/mcp && bun test render/blocks/database/views/views.test.ts
```
Expected: FAIL — `feed` is unregistered so `renderView` returns `[]` (no `◷ Announcements`).

- [ ] **Step 3: Implement `feed.ts`**

```ts
// render/blocks/database/views/feed.ts
import { box } from "../../../box";
import { clip } from "../../../text";
import { registerView } from "./engine";
import { databaseHeader } from "../header";

interface FeedPost { icon?: string; title: string; preview?: string; meta?: string; }
export interface FeedBlock {
  type: "feed"; name: string; views?: string[]; posts: FeedPost[];
}

registerView("feed", (block, width) => {
  const lines = [databaseHeader(block.name, block.views, width)];
  if (block.posts.length === 0) return [...lines, ...box(["(empty)"], width - 2)];
  for (const post of block.posts) {
    const head = clip(`${post.icon ? `${post.icon} ` : ""}${post.title}`, width - 4);
    const body = [head, ...(post.preview ? [clip(post.preview, width - 4)] : []), ...(post.meta ? [clip(post.meta, width - 4)] : [])];
    lines.push(...box(body, width - 2));
  }
  return lines;
});
```

Add `FeedBlock` to the `DatabaseView` union (`engine.ts`, `import type`), add `import "./feed"` to `views/index.ts`, and add a `feed` object to `viewSchema` in `schema.ts`:

```ts
z.object({ type: z.literal("feed"), name: z.string(), views,
  posts: z.array(z.object({ icon: z.string().optional(), title: z.string(),
    preview: z.string().optional(), meta: z.string().optional() })) })
```

- [ ] **Step 4: Run the test — verify it passes**

```bash
cd plugins/maccing-notion/mcp && bun test render/blocks/database/views/views.test.ts
```
Expected: PASS.

- [ ] **Step 5: Full verify + commit**

```bash
cd plugins/maccing-notion/mcp && bunx tsc --noEmit && bunx biome check src && bun test
git add -A render && git commit -m "render: add the feed database view (11th official view type)"
```

---

### Task 8: Final verification + convergence review

**Files:** none (verification only)

- [ ] **Step 1: Full gates**

```bash
cd plugins/maccing-notion/mcp && bunx tsc --noEmit && bunx biome check src && bun test
```
Expected: `tsc` clean, `biome` clean, all tests pass, the acyclic-import test passes.

- [ ] **Step 2: Adversarial convergence review**

Run the established multi-pass adversarial review (independent whole-tree reviewers) until **5 consecutive passes** report zero actionable findings, checking: (a) no view type is reachable from the block engine; (b) the only block→view runtime edge is `blocks/database/database.ts → views/engine`; (c) the `DatabaseView` union = the 11 official views and `viewSchema` mirrors it; (d) `Block` contains no view/`page` member; (e) the rendered output for pages/databases/content is unchanged from before the refactor.

- [ ] **Step 3: Final commit (if review prompted fixes)**

```bash
git add -A render && git commit -m "render: blocks/views split — review fixes"
```

---

## Self-Review

**Spec coverage:** Two engines via factory (T1,T3) ✓ · `Block`/`DatabaseView`/`Page` contracts (T2,T4,T5) ✓ · views one-per-file under `blocks/database/views/` (T3) ✓ · one-directional bridge + acyclic (T3,T8) ✓ · `page` root (T5) ✓ · schema split + faithful tool (T6) ✓ · `feed` added (T7) ✓ · test reorg (T6) ✓. No spec section is unimplemented.

**Placeholder scan:** Move-tasks (T3) describe relocation of *existing, unchanged* renderer bodies rather than re-pasting them — this is a deliberate "move file" instruction, not a "TODO". All net-new code (registry, view engine, `database.ts`, `page.ts`, `feed.ts`, the entry) is shown in full.

**Type consistency:** `Block`/`DatabaseView`/`Page`/`DatabaseModel`/`DatabaseBlock`/`FeedBlock` names are used consistently; `registerBlock`/`renderBlock`/`renderBlocks` (block engine) vs `registerView`/`renderView`/`renderViews` (view engine) are consistent; `pageFromNotion: Page` consistent across T5/T6.
