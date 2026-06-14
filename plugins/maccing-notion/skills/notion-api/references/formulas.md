# Formulas & number formatting

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, approval gate before writes, tree view after structural changes, match-conventions) still apply to everything here.

**Reading formula/rollup values:** use `read_database` (a set of rows) or `read_page(page_id, "markdown")` (a single row) — both flatten them to computed scalars server-side, sidestepping the raw API's "unknown type" complications. For aggregates (sum/count/grouped totals) across formula/rollup columns, use `read_database(..., format="summary", exhaust_all=true)`. The gotchas below concern *authoring* and *filtering* formulas (writes).

## Formulas — gotchas

**Formula schema is FULL REPLACEMENT** — sending `{formula: {number_format: "real"}}` without `expression` wipes the expression.

**Formula number display format is NOT API-settable** — API schema only stores `expression`. Plain `number` properties DO support `{number: {format: "real"}}`.

**Rewriting a formula via API resets its UI display format** — no way to preserve via API.

**API-written formulas are NOT filterable** — any formula created/rewritten via the API returns `400 Unable to filter based on a formula of unknown type` on query/view filters; UI-created formulas filter fine. In API-built DBs, filter underlying props/rollups (never the formula); never API-rewrite a UI-created formula a filter depends on. For cross-property conditionals, use the Self-relation + rollup-wrap workaround. **Full rules + recipe → `views.md` "Filter a view".** Live-verified 2026-06-11.

**`prop("text").split(...)` and list-ops on a `prop()` reference are CONSTANT-FOLDED to `[]`** by the public-API string compiler — the property reference is silently dropped, **no error**. Confirmed: `prop("Reps").split(";").join("-")` stores as `join([], "-")`. Affects `.split()`/`.map()`/`.filter()`/`.sort()` applied to a `prop()` authoring reference. Plain arithmetic/concat is unaffected (`prop("Reps") + "!"` keeps the ref); a constant-literal receiver is safe (`"12;10;8".split(";")` stores verbatim).
- **Workaround — the compiled-token receiver survives the fold:** `{{notion:block_property:<URL-encoded prop id>:<data_source_id>:<spaceId>}}.split(";").map(toNumber(current))` stores intact. ⭐ The **3rd UUID in the token is your `spaceId`** — identical in every token across the workspace (it is the space id, NOT a "self"/row marker). Get the prop id from `GET /v1/data_sources/{id}` → `properties.<name>.id`, URL-encode it, paste into the token.
- **…BUT the parsed/list value is typed `unknown` → it CANNOT compose:** `Weight * sum({{ref}}.split(";").map(toNumber(current)))` → `400 "Type error with formula"`. `round()`/`abs()`/`toNumber()`/`+0`/`.sum()` do **not** coerce it. There is **no public-API path** to do arithmetic over a list parsed from a text property. Fixes: (a) store the aggregate as a plain **number** property and compute it at write-time, then build live formulas on that number; or (b) author the whole formula via the private **`formula2` AST** (`private-api.md` → "Author a Formula 2.0 formula") — the AST carries `result_type`, so it composes and is type-correct.

**Mixed-type branches make a formula unfilterable too** (same "unknown type" 400, even UI-created): `if(cond, <date>, "")` mixes date+string → type unresolvable. Every branch must return ONE type — use **`empty()`** (not `""`, not `null`) for the no-value branch. Source: Notion help "Common formula errors".

**After formula/rollup schema update**: Notion needs ~5s to recompute all rows — wait (retry with brief backoff) before querying.

**15-layer formula reference chain limit** (increased from 7 in Aug 2024) — Notion silently stops computing when exceeded with no error raised. Chains like formula → formula → rollup consume depth.

**Type constraints:**
- `lets()` **cannot** bind rollup-derived values — and this extends to binding rollup-derived values even via arithmetic expressions like `round(abs(rollup)*100)`; confirmed workaround: skip `lets()` entirely and inline all expressions
- A formula **cannot** reference a formula that references a rollup when doing so would exceed the depth limit or when the referenced formula uses certain rollup operations — in practice, **every operation fails** (format, +0, abs, round, if, floor — all produce Type error); recompute inline from primitives
- **Formula-referencing-formula fails via the public API even when the referenced formula is purely primitive-based (no rollup).** `prop("Weight") * prop("Total reps")` (Total reps a formula) → Type error at write; `if(cond, prop("Volume"), 0)` (Volume a numeric formula) → Type error. The public string compiler types any referenced **formula** property as `unknown`. **Inline arithmetic from PRIMITIVE props only** (number/text/date) — never reference another formula property in an API-written expression. ⚠️ **CONTRAST — a ROLLUP over a formula column DOES work:** `sum`/`count`/`max` of a formula property through a relation rollup is fine (e.g. a Weeks "Volume" rollup summing the log's Volume *formula*). And at **runtime** a stored formula that references another formula still *evaluates* — the `unknown`-type block is **author-time only**, so a private-AST formula referenced by an already-written public formula still computes correctly.
- Plain rollups ARE referenceable from formulas (arithmetic, `format()`, `if()`, etc.)
- `substring()` rejects rollup-derived strings (the issue is the 'unknown type' Notion assigns to all rollup-derived values, not only rollup-of-formula); `length()` tolerates unknown-typed strings; `substring()` does not; coercing with `+ ""` does NOT help
- **`dateBetween()` also fails on rollup-derived dates** — `dateBetween(now(), prop("<a date rollup>"), "days")` → Type error (the rollup date is `unknown`-typed). Use `dateBetween` with **plain date props** only. To gate by "current week/month" off a related period, compare the **row's own date prop** with `formatDate` (see the ISO-week pattern below), not the rollup date.
- Rollup cannot access the End Date of a date range property

**Regex lookahead/lookbehind do NOT work at runtime** (empirically confirmed twice — overrides docs). A pattern like `replaceAll(s, "\B(?=(\d{3})+(?!\d))", ".")` *validates* (no parse error) but returns **`null`** when evaluated. Never rely on `(?=...)`/`(?!...)`/lookbehind in Notion formulas. For thousands separators, group with arithmetic (see Currency below).

**`now()` = real server clock** — `formatDate(now(), "YYYYMM")` returns today's actual date; future-dated rows will never match current month. At the start of a new calendar month before snapshots are entered, `now()`-based formulas that depend on those snapshots will return 0.

**Currency formatting** — `formatNumber(n, "brl")` exists and prepends the symbol, BUT formats with the **source/US locale** (`R$282,536.47` — comma thousands, period decimal), NOT the currency's own locale. Two hard limits (empirically verified):
- It does **NOT** produce pt-BR style (`R$ 282.536,47` — period thousands, comma decimal). For that you must build the string manually.
- It **type-errors on rollup-derived values**: `formatNumber(prop("SomeRollup"), "brl")` → "Type error". Recompute inline from primitives, or wrap a plain number.
```
formatNumber(282536.47, "brl")          // → "R$282,536.47"  (US separators, NOT pt-BR; errors on a rollup)

// Locale-correct pt-BR (no substring, no lookahead — both fail on rollup-derived strings):
// N = value expr; ip=floor(round(abs(N)*100)/100); cents=mod(round(abs(N)*100),100)
// group ip via floor/mod into millions/thousands/units, pad lower groups to 3 digits:
"R$ " + (Mg>0 ? format(Mg)+"."+pad3(Kg)+"."+pad3(Ug)
             : ip>=1000 ? format(Kg)+"."+pad3(Ug) : format(Ug)) + "," + pad2(cents)
// Mg=floor(ip/1e6); Kg=mod(floor(ip/1000),1000); Ug=mod(ip,1000)
// pad3(x)=if(x<10,"00"+format(x),if(x<100,"0"+format(x),format(x))); pad2 similar
```

**Useful formula patterns:**
```
// Current-month detection (auto-advances, zero-maintenance) — COMPUTE only
if(formatDate(prop("Month date"), "YYYYMM") == formatDate(now(), "YYYYMM"), prop("Value"), 0)
// ⚠ API-created formulas are NOT query/view-filterable ("unknown type" 400) — the API write
//   path never compiles the result-type metadata the filter layer reads; even a plain
//   `prop("Value") > 1000` fails if API-written. UI-created formulas filter fine.
//   So in an API-built DB, to FILTER rows to the current month, filter the Month-date
//   ROLLUP itself with after:"one_month_ago" + on_or_before:"today" — see views.md "Filter a view".

// Cascading rollup switch (no lets)
if(prop("Key") == "A", prop("RollupA"), if(prop("Key") == "B", prop("RollupB"), 0))

// Relation name extraction (not chartable as x-axis)
prop("Category").map(current.prop("Name")).join("")

// Round to 2 decimal places (no round(x,n) overload)
round(prop("Value") * 100) / 100

// Month sort key
formatDate(prop("Date"), "YYYYMM")

// Current ISO-week membership — clean types, public-API-safe (GGGG = ISO week-year; avoids the rollup-date "unknown" trap)
if(formatDate(prop("Date"), "GGGGWW") == formatDate(now(), "GGGGWW"), prop("Value"), 0)
// Rolling-7-day variant (a trailing-7-days window, NOT a Mon–Sun calendar week):
if(dateBetween(now(), prop("Date"), "days") >= 0 and dateBetween(now(), prop("Date"), "days") < 7, prop("Value"), 0)
```

### List operations over relations (Formula 2.0)

A relation property is a **list of pages** — Formula 2.0 exposes `.filter()`, `.map()`, `.sort()`, `.first()`, `.last()` over it, with `current` as the per-item page reference inside each callback.

| Operation | Example | Notes |
|---|---|---|
| `.filter(pred)` | `prop("Rel").filter(current.prop("P") > 0)` | Returns a sub-list; `current` = each page |
| `.map(expr)` | `prop("Rel").map(current.prop("P"))` | Projects a value per page → a list |
| `.sort(key)` | `prop("Rel").sort(current.prop("Date"))` | Ascending by key; chain after filter |
| `.first()` / `.last()` | `…list.first()` / `…list.last()` | First / last (after sort) |
| `.prop("P")` | after `.first()`/`.last()` | Read a property off the resolved page |

> ⚠️ **Every relation list-op in this section that reads a *related page's* property (`current.prop("X")`, `.last().prop("X")`) is UI-ONLY to author via the public REST API.** Writing it as a `formula.expression` string returns `400 "Type error with formula"` — in BOTH the `prop()` and compiled-`{{…}}` forms (empirically confirmed: even `{{relRef}}.map(current.prop("Weight")).sum()` fails). The public string compiler cannot resolve a related-page property's type. To set these programmatically, author the `formula2` AST via the private `api/v3` path — read a UI-authored example back with `syncRecordValues`, replant it onto your target (recipe → `private-api.md` "Author a Formula 2.0 formula").

**Flagship — latest value by date (no rollup can do this):** no rollup function returns "the value from the row with the most recent date". This does:
```
prop("<Relation>").filter(not(empty(current.prop("Date")))).sort(current.prop("Date")).last().prop("<Value>")
```
(1) filter strips date-less rows — null dates poison the sort; (2) sort ascending by date; (3) `.last()` = chronologically latest page; (4) `.prop()` reads its value. ⚠️ **NOT writable via the public REST API** (per the warning above — `current.prop()`/`.last().prop()` off a related page → `400 "Type error"`). Author it in the UI, or via the private `formula2` AST path (`private-api.md`). (Filterability follows the formula's stored type: a **public-string** formula is typed `unknown` → not view-filterable; a UI/AST formula carries a real `result_type`, so it can be — verify against your view if you depend on it.)

### Live category aggregation — current-period value (the no-rollup-of-rollup workaround)

When a Categories DB must show "this period's total per category" live, and rollup-of-rollup is blocked (`relations-rollups.md`): (1) a **per-row formula** on each source row outputting its value only when the row is the current period — `if(formatDate(prop("Month date"),"YYYYMM") == formatDate(now(),"YYYYMM"), prop("Value"), 0)` (the "intersection cell"); (2) a **rollup `sum`** of that formula on the Category relation. Auto-advances with `now()`, zero maintenance. (Filter rows to the current period via the underlying date prop — `after one_month_ago` + `on_or_before today` — not the formula.)

---

## Number formatting

- Plain number property format: `{number: {format: "real"}}` — set via API, works reliably
- Formula display format (R$, %, currency) is **UI-only** and an API expression-rewrite resets it — see the Formulas gotchas above (the same file)
- **Currency output**: `formatNumber(n,"brl")` → `R$1,234.56` (US separators, and errors on rollup-derived values); for pt-BR `R$ 1.234,56` build with floor/mod arithmetic (see Formulas)

