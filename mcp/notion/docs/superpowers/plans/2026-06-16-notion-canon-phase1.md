# Notion Canon — Phase 1 (the official-API schemas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the exact official Notion API object shapes as zod schemas + inferred types, one file per object under `src/notion/`, each verified against current docs and a round-trip fixture, then repoint the loose hand-rolled response types (`RawBlock`/`RawPage`/`NotionPropertyValue`/parent ref) at them — with the render output unchanged.

**Architecture:** Each schema mirrors a Notion API object field-for-field, with server-generated metadata (`id`, timestamps, `created_by`/`last_edited_by`, `has_children`, `archived`, `url`, …) modeled OPTIONAL so a hand-authored proposal object also validates; the type discriminant + type-specific payload are required. Discriminated unions (`BlockObject`, `PropertyValue`, `PropertySchema`) are assembled from the per-type files. Phase 1 is additive (Tasks 1–7) then a single repoint task (Task 8); the simplified render model still drives rendering until Phase 2.

**Tech Stack:** TypeScript, Bun (`bun test`), Zod, Biome. Run from `plugins/maccing-notion/mcp/`.

**Spec:** `docs/superpowers/specs/2026-06-16-official-notion-api-canon-design.md`

## Global Constraints

- **No new dependency** — hand-mirror the API; do NOT add `@notionhq/client`. (`zod` is already a dep.)
- **Verify field shapes against CURRENT docs, never memory** — the API uses the 2026 data_sources/views model; confirm each object at `developers.notion.com/reference/*` (and `…/guides/data-apis/working-with-views` for views). If a doc ref 404s or the shape differs from what's written here, the live doc wins — note the deviation in the commit.
- **Server-generated metadata is OPTIONAL** in every object schema (so proposals validate); the `type` discriminant + its payload are required.
- **One file per object/type** under `src/notion/`; assemble unions in a dedicated union file. No barrel/types dumping.
- **Fixtures = the doc's example object** for each type (each `developers.notion.com` object reference ships an example JSON) — copy it (redacting any token-like values) and assert the schema `.parse()`s it.
- **Runtime-acyclic invariant** (`src/architecture.test.ts`) must stay green; cross-file references between schemas are fine (they're type + value imports of pure schema modules — no cycle as long as the union file imports the members, not vice-versa).
- **Gate after every task:** `cd plugins/maccing-notion/mcp && bunx tsc --noEmit && bunx biome check --write src && bunx biome check src && bun test` — all green.
- Bun-native; commit per task with `notion(mcp):` messages.

## File structure (created in Phase 1)

```
src/notion/
  rich-text.ts          # RichTextObject + richText zod
  user.ts               # UserObject + user zod
  file.ts               # FileObject, Icon, Cover + zod
  parent.ts             # ParentRef + parent zod  (replaces readers/parent.ts's NotionParentRef)
  property-values/
    <type>.ts           # one per value type (title, rich_text, …, unique_id, button) — schema + type
    property-value.ts   # PropertyValue discriminated union (imports all the above)
  property-schema.ts    # data_source column definitions (PropertySchema union)
  blocks/
    <type>.ts           # one per block type (paragraph, heading, …, unsupported)
    block.ts            # BlockObject discriminated union (recursive via children)
  page.ts               # PageObject
  database.ts           # DatabaseObject (2026 wrapper w/ data_sources[])
  data-source.ts        # DataSourceObject
  view.ts               # ViewObject (configuration)
  query.ts              # QueryResult
  *.test.ts             # per-family fixture round-trip + rejection tests
```

The clients (`notion/public-client.ts`, `private-client.ts`, `ids.ts`) are untouched in Phase 1.

---

### Task 1: Foundational primitives — rich text, user, file/icon, parent

**Files:**
- Create: `src/notion/rich-text.ts`, `src/notion/user.ts`, `src/notion/file.ts`, `src/notion/parent.ts`
- Test: `src/notion/primitives.test.ts`

**Interfaces:**
- Produces: `richText` (zod) + `RichTextObject` (type); `user` + `UserObject`; `fileObject`/`icon`/`cover` + `FileObject`/`Icon`/`Cover`; `parentRef` + `ParentRef`. Every later task imports these.

Verify against: `/reference/rich-text`, `/reference/user`, `/reference/file-object`, `/reference/emoji-object`, `/reference/parent-object`.

- [ ] **Step 1: Write the failing fixture test** (`src/notion/primitives.test.ts`)

```ts
import { expect, test } from "bun:test";
import { richText } from "./rich-text";
import { parentRef } from "./parent";
import { icon } from "./file";

test("richText parses a real text rich-text object", () => {
  // Example from /reference/rich-text (redacted)
  const fixture = {
    type: "text",
    text: { content: "Hello", link: null },
    annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" },
    plain_text: "Hello",
    href: null,
  };
  expect(() => richText.parse(fixture)).not.toThrow();
});

test("parentRef parses a data_source parent (carries both ids)", () => {
  expect(() => parentRef.parse({ type: "data_source_id", data_source_id: "ds", database_id: "db" })).not.toThrow();
});

test("icon parses emoji and custom_emoji", () => {
  expect(() => icon.parse({ type: "emoji", emoji: "💡" })).not.toThrow();
  expect(() => icon.parse({ type: "external", external: { url: "https://x/i.png" } })).not.toThrow();
});

test("richText rejects a missing discriminant", () => {
  expect(() => richText.parse({ text: { content: "x" } })).toThrow();
});
```

- [ ] **Step 2: Run it — verify it fails** — `bun test src/notion/primitives.test.ts` → FAIL (modules not found).

- [ ] **Step 3: Implement the four primitive files.** Mirror each object's documented fields. Worked example for `rich-text.ts`:

```ts
// src/notion/rich-text.ts — mirrors developers.notion.com/reference/rich-text
import { z } from "zod";

const annotations = z.object({
  bold: z.boolean(),
  italic: z.boolean(),
  strikethrough: z.boolean(),
  underline: z.boolean(),
  code: z.boolean(),
  color: z.string(),
});

export const richText = z.object({
  type: z.enum(["text", "mention", "equation"]),
  text: z.object({ content: z.string(), link: z.object({ url: z.string() }).nullable().optional() }).optional(),
  mention: z.record(z.string(), z.unknown()).optional(), // mention payload varies by mention type — keep open here
  equation: z.object({ expression: z.string() }).optional(),
  annotations: annotations.optional(),
  plain_text: z.string().optional(),
  href: z.string().nullable().optional(),
});
export type RichTextObject = z.infer<typeof richText>;
```

`user.ts` (`UserObject`: `object:"user"`, `id`, `type: "person"|"bot"` optional, `name?`, `avatar_url?`, `person?: {email?}`, `bot?`), `file.ts` (`fileObject`: `type: "external"|"file"|"file_upload"` + the matching payload + `caption?`/`name?`; `icon` = emoji `{type:"emoji", emoji}` | custom_emoji | the file union; `cover` = the file union), and `parent.ts` (`parentRef`: `type: "page_id"|"block_id"|"database_id"|"data_source_id"|"workspace"` + the matching id field(s); a `data_source_id` parent carries BOTH `data_source_id` and `database_id` — both optional-present) follow the same pattern. Export each schema + `z.infer` type. Use the doc's example object as each fixture.

- [ ] **Step 4: Run the test — verify it passes** — `bun test src/notion/primitives.test.ts` → PASS.

- [ ] **Step 5: Full gate + commit**

```bash
cd plugins/maccing-notion/mcp && bunx tsc --noEmit && bunx biome check --write src && bunx biome check src && bun test
git add src/notion/{rich-text,user,file,parent,primitives.test}.ts && git commit -m "notion(mcp): canon — rich text, user, file/icon, parent primitives"
```

---

### Task 2: Property value schemas

**Files:**
- Create: `src/notion/property-values/<type>.ts` (one per value type) + `src/notion/property-values/property-value.ts`
- Test: `src/notion/property-values/property-value.test.ts`

**Interfaces:**
- Consumes: `richText`/`RichTextObject`, `user`, from Task 1.
- Produces: `propertyValue` (zod discriminated/loose union) + `PropertyValue` (type). Consumed by `page.ts` (Task 5) and Phase 2's renderers.

Verify against: `/reference/page-property-values`. Member files (each `{ id?, type, <type>: <value> }`): `title` (`RichTextObject[]`), `rich-text`, `number`, `select` (`{id?,name,color}|null`), `status`, `multi-select` (`[]`), `date` (`{start,end?,time_zone?}|null`), `people` (`UserObject[]`), `files`, `checkbox`, `url`, `email`, `phone-number`, `formula` (`{type, string?|number?|boolean?|date?}`), `relation` (`[{id}]` + the property-level `has_more?`), `rollup` (`{type, number?|date?|array?, function}`), `created-time`, `created-by` (`UserObject`), `last-edited-time`, `last-edited-by` (`UserObject`), `unique-id` (`{prefix?:string|null, number?:number|null}`), `verification`, `button`.

- [ ] **Step 1: Write the failing test** (`property-value.test.ts`)

```ts
import { expect, test } from "bun:test";
import { propertyValue } from "./property-value";

const cases: unknown[] = [
  { id: "a", type: "title", title: [{ type: "text", text: { content: "Hi" }, plain_text: "Hi" }] },
  { id: "b", type: "number", number: 42 },
  { id: "c", type: "select", select: { id: "s", name: "Done", color: "green" } },
  { id: "d", type: "date", date: { start: "2025-06-09", end: null } },
  { id: "e", type: "relation", relation: [{ id: "p1" }], has_more: false },
  { id: "f", type: "unique_id", unique_id: { prefix: "TASK", number: 42 } },
  { id: "g", type: "created_by", created_by: { object: "user", id: "u", name: "Ana" } },
];

test("propertyValue parses every documented value type", () => {
  for (const fixture of cases) expect(() => propertyValue.parse(fixture)).not.toThrow();
});
test("propertyValue rejects an unknown type with no payload", () => {
  expect(() => propertyValue.parse({ type: "bogus" })).toThrow();
});
```

- [ ] **Step 2: Run — verify it fails.**

- [ ] **Step 3: Implement each member file + the union.** Worked example (`property-values/relation.ts`):

```ts
// mirrors the `relation` page property value; the property-level `has_more` flags >25 truncation
import { z } from "zod";
export const relationValue = z.object({
  id: z.string().optional(),
  type: z.literal("relation"),
  relation: z.array(z.object({ id: z.string() })),
  has_more: z.boolean().optional(),
});
export type RelationValue = z.infer<typeof relationValue>;
```

`property-value.ts` assembles them: `export const propertyValue = z.union([titleValue, richTextValue, numberValue, …, buttonValue]); export type PropertyValue = z.infer<typeof propertyValue>;`. Mirror each member's exact payload from the doc; use the doc's examples as fixtures. (Cross-check the value→string mapping the Phase-1 `propertyToString` in `readers/page.ts` already implements — the field names here MUST match what it reads.)

- [ ] **Step 4: Run — verify it passes.**
- [ ] **Step 5: Gate + commit** — `git commit -m "notion(mcp): canon — page property value schemas"`.

---

### Task 3: Property schema (data_source column definitions)

**Files:** Create `src/notion/property-schema.ts`; Test `src/notion/property-schema.test.ts`.

**Interfaces:** Produces `propertySchema` + `PropertySchema` (a column definition `{ id, name, type, <type>: <config> }`). Consumed by `data-source.ts` (Task 6).

Verify against: `/reference/property-object` (the data source schema property objects). Configs to mirror: `select`/`multi_select`/`status` (`{ options: [{id,name,color}] }`), `relation` (`{ data_source_id, type, dual_property?/single_property? }`), `formula` (`{ expression }`), `rollup` (`{ relation_property_name, rollup_property_name, function }`), `number` (`{ format }`), and the value-only types (`title`/`rich_text`/`date`/`people`/`checkbox`/`url`/`email`/`phone_number`/`created_time`/`created_by`/`last_edited_time`/`last_edited_by`/`unique_id`/`button`/`files`) which carry an empty `{}` config.

- [ ] **Steps 1–5** mirror Task 2's shape (failing fixture test from the doc examples → implement the union → pass → gate → commit `notion(mcp): canon — data source property schema`). Worked union example:

```ts
import { z } from "zod";
const base = { id: z.string(), name: z.string() };
const selectConfig = z.object({ options: z.array(z.object({ id: z.string().optional(), name: z.string(), color: z.string().optional() })) });
export const propertySchema = z.union([
  z.object({ ...base, type: z.literal("select"), select: selectConfig }),
  z.object({ ...base, type: z.literal("relation"), relation: z.object({ data_source_id: z.string() }).passthrough() }),
  z.object({ ...base, type: z.literal("formula"), formula: z.object({ expression: z.string() }) }),
  // …one per property type; value-only types carry an empty config object…
  z.object({ ...base, type: z.literal("title"), title: z.record(z.string(), z.unknown()) }),
]);
export type PropertySchema = z.infer<typeof propertySchema>;
```

---

### Task 4: Block schemas

**Files:** Create `src/notion/blocks/<type>.ts` (one per block type) + `src/notion/blocks/block.ts`; Test `src/notion/blocks/block.test.ts`.

**Interfaces:** Consumes `richText`, `icon`/`fileObject`, `parentRef`. Produces `block` (recursive zod) + `BlockObject` (type). Consumed by Phase 2's block renderers.

Verify against: `/reference/block` (the block object + each type's payload). Block types (one file each): `paragraph`, `heading_1`/`heading_2`/`heading_3`/`heading_4` (mirror all the API exposes; the current model lacks `heading_4` — add it), `bulleted_list_item`, `numbered_list_item`, `to_do`, `toggle`, `quote`, `callout`, `divider`, `code`, `equation`, `image`/`video`/`audio`/`file`/`pdf` (the `fileObject` payload), `bookmark`, `link_preview`, `embed`, `column_list`, `column`, `table`, `table_row`, `breadcrumb`, `table_of_contents`, `synced_block`, `child_page`, `child_database`, `link_to_page`, `template`, `unsupported`.

- [ ] **Step 1: Failing test** — parse the doc's example for a representative set (paragraph, heading_1, to_do, callout, code, image, column_list, table, child_database) + a `children`-recursive case; reject an object missing `type`.
- [ ] **Step 2: Run — fails.**
- [ ] **Step 3: Implement.** The block object envelope (worked):

```ts
// src/notion/blocks/_envelope.ts — shared block metadata (all OPTIONAL so proposals validate)
import { z } from "zod";
import { parentRef } from "../parent";
import { user } from "../user";
export const blockMeta = {
  object: z.literal("block").optional(),
  id: z.string().optional(),
  parent: parentRef.optional(),
  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
  created_by: user.optional(),
  last_edited_by: user.optional(),
  has_children: z.boolean().optional(),
  archived: z.boolean().optional(),
  in_trash: z.boolean().optional(),
};
```

Each `blocks/<type>.ts` is `z.object({ ...blockMeta, type: z.literal("<type>"), <type>: <payload> })`. Recursion (`children`) and the union live in `block.ts`:

```ts
// src/notion/blocks/block.ts
import { z } from "zod";
import { paragraph } from "./paragraph"; // …import every member…
export const block: z.ZodType<BlockObject> = z.lazy(() => z.union([paragraph, heading1, /* … */ unsupported]));
export type BlockObject = /* the inferred union — define via the members' inferred types */;
```

Children-bearing payloads reference `z.array(block)` via `z.lazy`. Mirror each payload's exact fields from the doc; use doc examples as fixtures.

- [ ] **Step 4: Run — passes.** **Step 5: Gate + commit** `notion(mcp): canon — block object schemas`.

---

### Task 5: Page object

**Files:** Create `src/notion/page.ts`; Test `src/notion/page.test.ts`.

**Interfaces:** Consumes `parentRef`, `icon`, `cover`, `propertyValue`. Produces `page` + `PageObject` (`properties: Record<string, PropertyValue>`). Consumed by `query.ts` (rows) + the `PageRender` bundle (Phase 2).

Verify against `/reference/page`. Fields: `object:"page"?`, `id?`, timestamps/created_by/last_edited_by (optional), `parent` (optional), `archived?`, `in_trash?`, `icon` (`icon` schema, nullable), `cover` (nullable), `properties: z.record(z.string(), propertyValue)`, `url?`, `public_url?`.

- [ ] **Steps 1–5:** failing test parsing the doc's page example → implement → pass → gate → commit `notion(mcp): canon — page object`.

---

### Task 6: Database + data source objects

**Files:** Create `src/notion/database.ts`, `src/notion/data-source.ts`; Test `src/notion/database.test.ts`.

**Interfaces:** Consumes `richText`, `icon`/`cover`, `parentRef`, `propertySchema`. Produces `database` + `DatabaseObject` (the 2026 wrapper: `title: RichTextObject[]`, `icon`, `cover`, `parent`, `data_sources: [{ id, name }]`); `dataSource` + `DataSourceObject` (`name?`, `properties: z.record(z.string(), propertySchema)`, `parent` (carries `database_id`), `icon?`). Consumed by the `DatabaseRender` bundle (Phase 2).

Verify against `/reference/database` and the data-source reference (confirm current URLs — the 2026 model). 

- [ ] **Steps 1–5:** failing test from the doc examples → implement both → pass → gate → commit `notion(mcp): canon — database + data source objects`.

---

### Task 7: View object + query result

**Files:** Create `src/notion/view.ts`, `src/notion/query.ts`; Test `src/notion/view.test.ts`.

**Interfaces:** Consumes `page`. Produces `view` + `ViewObject` (`id?`, `name`, `type` (the 11 view types incl `feed`), `data_source_id?`, `configuration: { properties: [{ property_id, visible?, width? }], filter?, sorts?, group_by? }`); `queryResult` + `QueryResult` (`object:"list"`, `results: z.array(page)`, `has_more`, `next_cursor`, `type?`). Consumed by the `DatabaseRender` bundle + the view engine (Phase 2). Cross-check field names against the current `readers/views.ts` (`configuration.properties`, `filter`, `sorts`, `group_by`, `date_property_id`).

Verify against `…/guides/data-apis/working-with-views` (and any view object reference). Keep `configuration.filter`/`sorts` loose (`z.unknown()` / passthrough) — they're Notion's verbatim filter/sort objects, large and not needed field-by-field by the renderer.

- [ ] **Steps 1–5:** failing test from real view + query fixtures → implement → pass → gate → commit `notion(mcp): canon — view object + query result`.

---

### Task 8: Repoint the loose response types at the canon

**Files:** Modify `src/readers/page.ts` (`NotionPropertyValue`, `RawPage`, `flattenProperty`), `src/readers/parent.ts` (`NotionParentRef`), `src/render/page-model.ts` (`RawBlock`, `pageFromNotion`), and any importer of those loose types (`tools/read-page.ts`, `tools/read-database.ts`, `render/database-model.ts`).

**Interfaces:** Consumes the canon (Tasks 1–7). Produces: the loose hand-rolled response types are now ALIASES of the official ones (`type NotionPropertyValue = PropertyValue`, `RawPage = PageObject`, `RawBlock = BlockObject`, `NotionParentRef = ParentRef`) — same names, official shapes. Render output is UNCHANGED.

- [ ] **Step 1:** Replace each loose type with `export type X = <OfficialType>` (re-export the official type under the existing name), starting with `NotionParentRef = ParentRef`, `NotionPropertyValue = PropertyValue`, `RawPage = PageObject`, `RawBlock = BlockObject`. Keep the existing function signatures (`flattenProperty`, `pageFromNotion`, `databaseToModel`) — only their input TYPES tighten.

- [ ] **Step 2:** Run `bunx tsc --noEmit` and fix every error the tighter types surface — these are the real field-access mismatches (e.g. a mapper reading `block[block.type]` generically must now narrow on `block.type`, or read the typed payload). Fix by narrowing/reading the official fields; do NOT loosen the official schemas to paper over a bug (a surfaced mismatch is a latent bug to fix).

- [ ] **Step 3:** Run `bun test` — every existing render/reader/tool test must still pass (render output unchanged). If a test breaks, the repoint changed behavior — fix the mapper, not the test, unless the test encoded a bug the official types exposed (then fix the test + note it).

- [ ] **Step 4:** Gate + commit `notion(mcp): repoint loose response types at the official canon (render unchanged)`.

---

### Task 9: Phase 1 verification + convergence review

**Files:** none (verification only).

- [ ] **Step 1:** Full gate — `bunx tsc --noEmit && bunx biome check src && bun test` (all green, acyclic test passes).
- [ ] **Step 2:** Adversarial review (independent reviewers) until clean, checking: every official schema accepts its doc's example fixture and rejects malformed input; metadata is optional everywhere; the unions cover every documented type (no missing block/property/view type); the repoint (Task 8) changed no render output; no loose hand-rolled response type remains except as an alias of the canon.
- [ ] **Step 3:** Commit any review fixes; Phase 1 ships green. (Phases 2–3 get their own plans.)

---

## Self-Review

**Spec coverage (Phase 1 scope):** the `notion/` canon one-file-per-object (Tasks 1–7) ✓; metadata-optional for proposals (Global Constraints + Task 4 envelope) ✓; fixture round-trip tests per family ✓; repoint the loose readers' types, render unchanged (Task 8) ✓; no `@notionhq/client` dep ✓; `heading_4` + gap-filling (Task 4) ✓. Phases 2 (renderer + bundles) and 3 (tools) are explicitly deferred to their own plans.

**Placeholder scan:** the per-object field lists are deferred to **verify-against-the-named-doc** steps (a deliberate verify-don't-guess instruction with an exact source + a fully-worked schema/test pattern per family), NOT vague TODOs. Every task has runnable failing tests, a worked implementation pattern, exact gate commands, and a commit.

**Type consistency:** `richText`/`RichTextObject`, `user`/`UserObject`, `parentRef`/`ParentRef`, `icon`/`cover`, `propertyValue`/`PropertyValue`, `propertySchema`/`PropertySchema`, `block`/`BlockObject`, `page`/`PageObject`, `database`/`DatabaseObject`, `dataSource`/`DataSourceObject`, `view`/`ViewObject`, `queryResult`/`QueryResult` — names used consistently across tasks; Task 8 aliases the loose names to these exact types.
