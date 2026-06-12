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

## When the public API is enough (don't use this file)
Pages/database icons & covers, properties, rows, views (table/board/gallery/chart), sorts, filters (except UI relative dates), formulas, rollups, relations, blocks — all public. Reach for the private API **only** for the UI-only gaps below.

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
- **The easy path:** call the **`upsert_property`** MCP tool — `{ properties: [{ target_id: <data_source id>, property: <name or id>, icon, color?, remove_icon? }, …] }`. It resolves the active user, resolves each property NAME→raw id, batches every column icon into **ONE** `saveTransactions`, and **reads the schema back (with retry) to report each icon confirmed / read-throttled / did-not-persist**. (Under the hood it's exactly the ops above — `private_request` lets you send them by hand.) **Batch, don't loop:** one `upsert_property` call for all the columns, never one call per column — bursting many `saveTransactions`+read-backs trips the bot-protection (the read-backs bot-page and falsely report `verified:false` even though the write landed).

## Verify a private write (the public API is blind)
After a private write, verify with `read_page` (a page/row change), `read_database` (a schema/row-set change — property names, types, sorts, filters all surface), or `getRecordValues` **only** for fields the readers never expose (property icons, internal flags) — use `read_database` for everything else. It reads the internal record — call it through the tool: `private_request({ endpoint: "getRecordValues", body: { requests: [{ id: "<ds_id>", table: "collection" }] } })` (cookie + active-user header injected). Raw shape, for DevTools reference:
```jsonc
POST /api/v3/getRecordValues   // headers: Cookie + x-notion-active-user-header
{ "requests": [ { "id": "<ds_id>", "table": "collection" } ] }
// → results[0].value.schema["<property_id>"].icon  ==  "/icons/cash_gray.svg"
```
The public `GET /v1/data_sources/{id}` will **never** show it (`property` objects have no `icon` field on read or write).

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
| `getRecordValues` returns HTML / reads flaky | Missing `x-notion-active-user-header`, or **rate-limited**. Space calls out (seconds apart), add retries; don't loop hard. |
| Public API doesn't reflect it | Expected — these features are invisible to `api.notion.com/v1`. |

---

## For everyone on the PUBLIC API (no private access)
If you can't (or won't) touch the private API, know the public-API limits and fallbacks:
- **Property (column) icons: NOT settable via the public API.** Writing an `icon` key inside a property def (via `PATCH /v1/data_sources/{id}` or on `POST /v1/databases` at creation) returns `200` and is **silently dropped**; reads never expose it. (Pages and databases *do* take icons — see `pages-properties.md`.)
- **Closest public-API fallback — emoji in the property NAME** (verified): `PATCH /v1/data_sources/{id} {"properties":{"Old":{"name":"💰 Old"}}}`. It renders like a column icon. Caveats: formulas referencing the property by name must update (`prop("💰 Old")`); any integration matching by display name sees the new name; the emoji appears in every API read of the name.
