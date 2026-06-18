# Notion's PRIVATE app API (`api/v3`) — the escape hatch for UI-only features

The public REST API (`api.notion.com/v1`) covers most things — **use it first, always.** But Notion's web/desktop app has features the public API silently can't touch: **database property (column) icons**, the UI relative date filters ("This month"), per-view private filter state, and more. Those live in Notion's internal data model, mutated through the **private `api/v3` app API** that the browser uses. This file documents how to drive it — and the sharp edges.

> ⚠️ **READ THIS FIRST — the private API is UNOFFICIAL.**
> - Authenticated by your **browser session cookie** (`token_v2`), not an integration token. Anyone with the cookie can act fully as you.
> - **Undocumented, no stability guarantees** — Notion can change/break it without notice, and using it programmatically is against Notion's Terms.
> - **Aggressively rate-limited / bot-protected** — rapid calls get an HTML bot page or silently no-op.
> - Use it only for **your own workspace**, only when the public API genuinely can't, and **propose it to the user first** (same approval gate as any write). Prefer the public API or a UI action when either suffices.
> - The session cookie **rotates** (logging out invalidates it). Store it ONLY in a gitignored secrets file; never echo, log, or commit it.

## Access — through the bundled `notion` MCP ONLY (never a standalone script)
The private API is reached exclusively via two tools on the self-hosted `notion` MCP server, so the session cookie stays inside one trusted process (`NOTION_TOKEN_V2` + `NOTION_SPACE_ID` in `~/.config/maccing/notion.env`, or the per-project `mcp/.env.local` dev override) and is never handled by agent shell:
- **`upsert_property`** — the safe, verified convenience for the flagship capability (column icons), **batched**: it builds ONE `saveTransactions` for every column icon across every data source + reads them back with retry, reporting each as confirmed / read-throttled / did-not-persist. (It also does the public schema/page writes — see its own description; here it's the icon path that matters.) Reach for raw `private_request` only to drive an op `upsert_property` doesn't cover.
- **`private_request`** — the generic escape hatch: pass `{ endpoint, operations }` for a `saveTransactions` mutation, or `{ endpoint, body }` for any other `api/v3` endpoint (`operations` = the array of ops for `saveTransactions`; `body` = the tool's key for the JSON payload of any other endpoint, e.g. `{ requests: [...] }` for `getRecordValues`); the active-user header and transaction envelope are injected for you. `endpoint` must be a camelCase api/v3 identifier; for `saveTransactions` the tool **rejects** (pre-flight, before the HTTP call) operations missing the trailing collection `update` commit op.

Extending it (a new UI-only capability) is a server change — add a file under `mcp/tools/` and one line to the registry — not a new script. Auth/envelope details below are for understanding and for DevTools capture; you drive it through the tools.

**Throttle handling is built in — do NOT hand-roll backoff.** Both tools auto-pace private calls (a minimum interval) and **adaptively back off** on bot-protection: every throttle (a dropped socket, a 429/503, or an HTML bot-page) pushes a GLOBAL cooldown forward — exponential per consecutive throttle, capped at 30s, cleared on the first success — and the shared promise-chained gate makes EVERY private call wait it out (a retry, a read-back, a concurrent OR a separate later tool call alike). So never `sleep` between MCP calls to space them yourself: on a throttled result just **retry the tool in a moment** — the server self-throttles across calls — and only wait longer if it persists across a few retries. A genuine API error (a JSON validation body) is NOT treated as a throttle, so it won't trigger the cooldown.

## When the public API is enough (don't use this file)
Pages/database icons & covers, properties, rows, views (table/board/gallery/chart), sorts, filters (except UI relative dates), **most** formulas, rollups, relations, blocks — all public. Reach for the private API **only** for the UI-only gaps below. ⚠️ **Exception — two formula sub-cases need special handling:**
- **(a) Parse/list formulas** (`split().map(toNumber(current))` and other list-ops on a `prop()` text reference): the public API **silently constant-folds `prop().split()` to `[]`**, but a **public-API workaround exists** — hand-author the compiled-token form (`{{notion:block_property:…}}.split(";").map(toNumber(current))`), which stores intact (see `formulas.md`). The result is typed `unknown` (display-only; not arithmetic-composable or view-filterable). Use the private `formula2` AST here **only** when you need arithmetic composability or view-filterability.
- **(b) Relation-read formulas** (`current.prop("X")` / `.last().prop("X")` off a related page): these fail in **both** the `prop()` and compiled-token forms (`400 "Type error"`) — **no public-API path exists**. Author them here as a `formula2` AST (see "Author a Formula 2.0 formula" below).

Full diagnosis in `formulas.md`.

## Auth (live-verified 2026-06-11)

| Need | Value |
|---|---|
| Endpoint host | `https://www.notion.so/api/v3/…` (also `app.notion.com`) |
| Cookie | `token_v2` — **the broad-domain `.app.notion.com` cookie** (DevTools → Application → Cookies → Domain `.app.notion.com`). ⚠️ The **exact-host `app.notion.com`** cookie is a *different value* and is **rejected `401` "Could not validate token"**. |
| Header `x-notion-active-user-header` | The user id that has edit access to the target space. A session can carry **multiple accounts**; the WRONG one → `400 "User does not have edit access to record"`. Resolve it from `POST /api/v3/getSpaces` (`{}` body): it returns `{ "<userId>": { "space": { "<spaceId>": … }, … } }` — pick the userId whose `space` map contains your target space. **Required on writes AND on `getRecordValues` reads** (without it, reads return a bot HTML page). |
| `spaceId` | Your workspace/space id (same one in every operation pointer). |

`getSpaces` is also the cheapest auth check: `200` = token valid.

## The transaction envelope

Every mutation is a `POST /api/v3/saveTransactions`:
```jsonc
{ "requestId": "<uuid>",
  "transactions": [{
    "id": "<uuid>", "spaceId": "<space>",
    "operations": [ /* … see below … */ ]
  }] }
```
Each operation: `{ pointer: {table, id, spaceId}, command, path, args }`. `table` is the internal record type (`collection` = a data source, `block` = a page/block). A `data_source_id` from the public API **is** the `collection` id, so all your public-API IDs work here directly.

⚠️ **A schema mutation needs a trailing "commit" op** or `saveTransactions` returns `200` but **silently does not persist**: append an `update` op that bumps the record's editor:
```jsonc
{ "pointer": {"table":"collection","id":"<ds>","spaceId":"<space>"}, "path": [], "command": "update",
  "args": {"last_edited_by_id":"<activeUser>","last_edited_by_table":"notion_user"} }
```

## ⭐ Verified recipe: set a database PROPERTY (column) icon

The flagship case — **impossible via the public API, works here.** Two ops in one transaction:
```jsonc
"operations": [
  { "pointer": {"table":"collection","id":"<ds_id>","spaceId":"<space>"},
    "command": "updateCollectionPropertySchema",
    "path": ["schema", "<property_id>", "icon"],
    "args": { "primitiveOp": { "command": "set", "args": "/icons/cash_gray.svg" } } },
  { "pointer": {"table":"collection","id":"<ds_id>","spaceId":"<space>"}, "path": [], "command": "update",
    "args": {"last_edited_by_id":"<activeUser>","last_edited_by_table":"notion_user"} }
]
```
- **`property_id` is the RAW internal id** — url-DECODE the public API's `%XX`-encoded id (e.g. public `l%3ERV` → `l>RV`).
- **Icon value = `/icons/<file>_<color>.svg`.** Colors = the same 10 as named icons (`gray`/`blue`/…). The `<file>` is an internal asset name that **usually matches** the public icon catalog (`icon-names.md`) — `cash`, `star`, etc. — **but not always**: a valid public name can still no-op here if its private asset name differs (e.g. `chart-mixed` is a valid public name yet silently no-ops as a property icon — `200`, no persist). Always read back to confirm; if absent, the file name is wrong.
- **Remove an icon:** same op, but set the **inner** primitive to null — `"args": { "primitiveOp": { "command": "set", "args": null } }` (the operation-level `args` keeps its `primitiveOp` wrapper; only `primitiveOp.args` becomes `null`).
- **The easy path:** call the **`upsert_property`** MCP tool — `{ properties: [{ target_id: <data_source id>, property: <name or id>, icon, color?, remove_icon? }, …] }`. It resolves the active user, resolves each property NAME→raw id, batches every column icon into **ONE** `saveTransactions`, and **reads the schema back (with retry) to report each icon confirmed / read-throttled / did-not-persist**. (Under the hood it's exactly the ops above — `private_request` lets you send them by hand.) **Batch, don't loop:** one `upsert_property` call for all the columns, never one call per column — bursting many `saveTransactions`+read-backs trips the bot-protection (the read-backs bot-page and falsely report `DID NOT PERSIST` even though the write landed).

## Verify a private write (the public API is blind)
After a private write, verify with `read_page` (a page/row change), `read_database` (a schema/row-set change — property names, types, sorts, filters all surface), **column/property icons → use `describe`** (it reads them via the private API for you — don't hand-roll `getRecordValues` for icons); drop to raw `getRecordValues` **only** for internal fields no reader surfaces (the `formula2` AST, raw `format` flags). Use `read_database` for everything else. It reads the internal record — call it through the tool: `private_request({ endpoint: "getRecordValues", body: { requests: [{ id: "<ds_id>", table: "collection" }] } })` (cookie + active-user header injected). Raw shape, for DevTools reference:
```jsonc
POST /api/v3/getRecordValues   // headers: Cookie + x-notion-active-user-header
{ "requests": [ { "id": "<ds_id>", "table": "collection" } ] }
// → results[0].value.schema["<property_id>"].icon  ==  "/icons/cash_gray.svg"
```
The public `GET /v1/data_sources/{id}` will **never** show it (`property` objects have no `icon` field on read or write).

## ⭐ Verified recipe: author a Formula 2.0 formula (parse / list / relation) the public API can't

The public API stores `formula.expression` as a **string** and compiles it server-side — which **constant-folds `prop("x").split()` to `[]`** and types any parsed-list / related-page value as `unknown` (un-composable, un-filterable; full diagnosis in `formulas.md`). The Notion UI instead stores a **typed `formula2` AST** — every leaf carries a `result_type`. Write that AST directly here and the formula is correct. **Live-verified 2026-06-14** (converted a number column into a live `sum(Reps.split(";").map(toNumber(current)))` that computed `30` from `"12;10;8"`).

**Don't hand-craft the AST — copy a working one.** Author the formula ONCE in the Notion UI (or find a DB that already has it), read its `formula2` back, swap the property pointers, write it to your target.

1. **READ a working example** (`syncRecordValues`, table `collection`):
   ```jsonc
   private_request({ endpoint: "syncRecordValues",
     body: { requests: [{ pointer: { table: "collection", id: "<source_ds_id>" }, version: -1 }] } })
   // → recordMap.collection["<id>"].value.schema["<propId>"] = { type:"formula", version:"v2", formula2:{ code:[…], result_type:{…} } }
   ```
   A Formula 2.0 formula lives under **`formula2.code`** — an array of fragments where a property reference is the token
   `["‣", [["fpp", { name, property:"<rawPropId>", collection:{ id, table:"collection", spaceId } }]]]`
   interleaved with literal code strings (`["sum("]`, `[".split(\";\").map(toNumber(current)))"]`). `result_type` is `{type:"number"|"text"|"date"|"boolean"}`. (A legacy v1 formula instead stores a nested typed-node tree under `formula`; prefer the `formula2` form.)

2. **REPLANT onto the target** — deep-clone `formula2`; in every `fpp` token swap `property`→the target's raw prop id and `collection.id`/`spaceId`→the target's. Then `set` the schema entry **with the mandatory trailing `update` commit op**:
   ```jsonc
   private_request({ endpoint: "saveTransactions", operations: [
     { pointer:{table:"collection", id:"<target_ds_id>", spaceId:"<space>"},
       command:"set", path:["schema","<target_propId>"],
       args:{ name:"Total reps", type:"formula", version:"v2", icon:"/icons/mathematics_gray.svg",
              formula2:{ code:[ ["sum("],
                                ["‣",[["fpp",{name:"Reps", property:"Wr{h",
                                       collection:{id:"<target_ds_id>", table:"collection", spaceId:"<space>"}}]]],
                                [".split(\";\").map(toNumber(current)))"] ],
                         result_type:{type:"number"} } } },
     { pointer:{table:"collection", id:"<target_ds_id>", spaceId:"<space>"}, path:[], command:"update",
       args:{last_edited_by_id:"<activeUser>", last_edited_by_table:"notion_user"} }
   ] })
   ```
   - **`set` replaces the whole schema entry** — include `name`/`type`/`icon`/`version` so you don't drop them. (`update` would *merge*, leaving a stale `number_format` when converting a number→formula.)
   - **Raw prop ids are URL-DECODED** (`Wr%7Bh` → `Wr{h`); `<target_ds_id>` == the collection id == your public `data_source_id`; **`spaceId`** is the 3rd UUID in any public compiled `{{notion:block_property:…}}` token.
   - **The `code` array is freely EDITABLE — not just pointer-swappable.** You can ADD and NEST list-ops to extend a formula, not only re-point an existing one — splice the extra literal fragments + reused `‣`/`fpp` tokens into the array. Live example (2026-06-18): turned a Muscle-Groups `To beat` from *“sum Volume on the latest session”* into *“sum Volume on the latest session whose volume > 0”* (skips cardio / unparseable-rep days) by nesting a sub-query as the reference date — `<rel>.filter(current.<Volume‣> > 0).map(current.<Date‣>).sort().last()` inside the outer `.filter(dateBetween(current.<Date‣>, <that>, "days") == 0).map(current.<Volume‣>).sum()`. (`.sort().last()` = the MAX/latest of a date list; nested `current` scopes to its own enclosing lambda.)

3. **VERIFY** — `200 {}` does NOT prove persistence. Create a probe row, read it back via the **public** API: the formula cell must show the computed value. Then trash the probe row.

**Bonus:** an AST formula with the right `result_type` is type-correct → it composes and is view-filterable (unlike public-string formulas, typed `unknown`). And at **runtime** even existing public-string formulas that reference your new AST formula still evaluate — the `unknown`-type block is author-time only.

### Relation-read encoding (`current.prop` / `.last().prop`) — hand-craftable, no UI seed needed (live-verified 2026-06-17)

The recipe above says "copy a working one," but a relation-read example may not exist anywhere in the workspace (rollups, not formulas, do relation aggregation — so even mature trackers like Net worth have none to copy). You can still hand-craft it directly, because the encoding is now known. **A related-page property read is literal `current.` (inside a `.map`/`.filter`/`.sort` lambda) or `.last().` glued to a typed `‣`/`fpp` mention whose `collection` is the RELATED data source.** Two collections are in play: the relation mention's `collection` = the formula's OWN ds; every `current.`/`.last().`-bound mention's `collection` = the RELATED ds.

- ✅ **Works:** `prop("Rel").sort(current.‣Date).last().‣Weight` → fragments: `["‣",[["fpp",{relation, collection:OWN ds}]]]`, `[".sort(current."]`, `["‣",[["fpp",{name:"Date", property:"<related raw id>", collection:RELATED ds}]]]`, `[").last()."]`, `["‣",[["fpp",{name:"Weight", property:"<related raw id>", collection:RELATED ds}]]]`. Chains like `.last().‣Reps.split(";").first()` glue literal text after the related mention (same as the same-collection split). `result_type` `{type:"text"}` or `{type:"number"}`.
- ❌ **Literal `current.prop("Date")`** (plain text, no mention) → computes **empty** — the related prop never resolves (same wall as the public string compiler).
- ❌ **Bare `‣Weight` mention WITHOUT the `current.` literal** → binds to the OUTER row (reads the formula's-own-collection `Weight`, which is absent) → computes **0 / empty**. The `current.` literal is what binds the typed mention to the lambda item.
- **Diagnostic discipline:** a wrong relation-read AST computes **empty/0, never an error** — so probe in isolation with a signal-producing op (`.map(current.‣X).sum()` → a non-zero number means the bind works) before assembling the full chain. Blind full-formula guesses give no signal.
- **Live example** — Muscle Groups `To beat` = latest log's weight × top-set reps:
  `format(‣Training Log.sort(current.‣Date).last().‣Weight) + " × " + ‣Training Log.sort(current.‣Date).last().‣Reps.split(";").first()`

## ⭐ Verified recipe: reorder / MOVE any block in place (`listAfter` / `listBefore`)

The public API **cannot move an existing block** within its parent (`blocks.md`: child_database/page need a re-parent-out-and-back dance that appends at the end; loose blocks — paragraph, callout, embed — have **no** public move at all and must be recreated). The private app API moves **any** block — loose blocks included — in **one** transaction, via a list op on the parent block's `content`:
```jsonc
private_request({ endpoint: "saveTransactions", operations: [
  { pointer: {table:"block", id:"<parentPageId>", spaceId:"<space>"},
    command: "listAfter", path: ["content"],
    args: { id:"<blockToMove>", after:"<anchorBlockId>" } },   // or listBefore + { before:"<anchor>" }
  { pointer: {table:"collection", id:"<anyDataSourceInSpace>", spaceId:"<space>"}, path:[], command:"update",
    args: {last_edited_by_id:"<activeUser>", last_edited_by_table:"notion_user"} }
] })
```
- **`id` is the block being moved — it's ALREADY in `content`, so `listAfter` RELOCATES it** (the content list is a set of unique ids). No `listRemove` step is needed; a single `listAfter` can't orphan or duplicate the block → the **safe** form (worst case: a no-op you verify and retry, never a removed block).
- **Moves loose blocks too** — paragraphs, callouts, embeds, dividers reorder fine here, which the public API can't do at all. Same op works for `child_database` blocks (a DB block's id == its database id).
- **The trailing commit op must be `table:"collection"`** — `private_request` enforces a collection commit even though this is a *block* transaction. Use any data source in the space (a harmless editor bump); the block move persists regardless. A `table:"block"` commit op fails the tool's pre-flight. *(This collection-commit requirement is the **MCP tool's** pre-flight rule — so it can run its editor-bump verification — not a confirmed `api/v3` constraint; a hand-rolled raw call may well accept a block commit op. Through the tool, just pass a collection op.)*
- **To INSERT a new block at a position:** append it via public `PATCH /v1/blocks/{page}/children` (lands at the end), then `listAfter` it into place. (For a *fresh* append you can instead use the public `position:{type:"after_block",after_block:{id}}` — `blocks.md`; but `listAfter` is the ONLY way to move an **existing** block.)
- **VERIFY** with `read_page(page_id, "outline")` — `200 {}` alone doesn't prove the move landed.
- **Live-verified 2026-06-14** — moved an inline "Gym Navigation" DB to the top of its area page and repositioned 4 spacer paragraphs, one `listAfter` each.

## Discovering NEW operations — the DevTools capture method (reusable)
This is how the property-icon and "This month" formats were found. To learn the exact `command`/`path`/`args` for ANY UI-only action:
1. Open Notion in the browser, DevTools → **Network**, filter `saveTransactions`.
2. Perform the action in the UI (set the column icon, pick "This month", etc.).
3. Inspect the captured POST **payload** → copy the `operations[]`. That IS the format. (Some actions fire `saveTransactionsFanout` — same operation shapes, slightly different envelope.)

## Gotchas (all live-verified)
| Symptom | Cause / fix |
|---|---|
| `401 "Could not validate token"` | Wrong cookie — use the **`.app.notion.com`** (broad-domain) `token_v2`, not the exact-host one. |
| `400 "User does not have edit access"` | `x-notion-active-user-header` is the wrong account — pick the one whose `getSpaces.space` contains the target space. |
| `200 {}` but change didn't persist | Missing the trailing `update` commit op, OR an invalid `/icons/<file>` name (silent no-op). |
| `getRecordValues` returns HTML / reads flaky | Missing `x-notion-active-user-header`, or **rate-limited** — the client auto-paces + adaptively backs off (see Access), so just retry the tool; don't add your own sleeps. |
| Public API doesn't reflect it | Expected — these features are invisible to `api.notion.com/v1`. |
| Batched `upsert_property` (many icons/visibility) → **502 HTML bot page** (`"Non-JSON response"`) | Bot-protection throttle from bursting `saveTransactions` + read-backs. The client now auto-paces + adaptively backs off (see Access), so just **retry the tool in a moment** — it self-throttles; no manual spacing/backoff math. Still **batch, don't loop** (one call for all columns, not N) to cut total calls. For **default column visibility**, prefer the public **view config** (a view's visible-property list — `views.md`) over the private `visible` flag: reliable, not rate-limited. |

---

## For everyone on the PUBLIC API (no private access)
If you can't (or won't) touch the private API, know the public-API limits and fallbacks:
- **Property (column) icons: NOT settable via the public API.** Writing an `icon` key inside a property def (via `PATCH /v1/data_sources/{id}` or on `POST /v1/databases` at creation) returns `200` and is **silently dropped**; reads never expose it. (Pages and databases *do* take icons — see `pages-properties.md`.)
- **Closest public-API fallback — emoji in the property NAME** (verified): `PATCH /v1/data_sources/{id} {"properties":{"Old":{"name":"💰 Old"}}}`. It renders like a column icon. Caveats: formulas referencing the property by name must update (`prop("💰 Old")`); any integration matching by display name sees the new name; the emoji appears in every API read of the name.
