# Formulas & number formatting

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, approval gate before writes, tree view after structural changes, match-conventions) still apply to everything here.

## Formulas — gotchas

**Formula schema is FULL REPLACEMENT** — sending `{formula: {number_format: "real"}}` without `expression` wipes the expression.

**Formula number display format is NOT API-settable** — API schema only stores `expression`. Plain `number` properties DO support `{number: {format: "real"}}`.

**Rewriting a formula via API resets its UI display format** — no way to preserve via API.

**After formula/rollup schema update**: Notion needs ~5s to recompute all rows — `time.sleep(5)` before querying.

**15-layer formula reference chain limit** (increased from 7 in Aug 2024) — Notion silently stops computing when exceeded with no error raised. Chains like formula → formula → rollup consume depth.

**Type constraints:**
- `lets()` **cannot** bind rollup-derived values — and this extends to binding rollup-derived values even via arithmetic expressions like `round(abs(rollup)*100)`; confirmed workaround: skip `lets()` entirely and inline all expressions
- A formula **cannot** reference a formula that references a rollup when doing so would exceed the depth limit or when the referenced formula uses certain rollup operations — in practice, **every operation fails** (format, +0, abs, round, if, floor — all produce Type error); recompute inline from primitives
- Plain rollups ARE referenceable from formulas (arithmetic, `format()`, `if()`, etc.)
- `substring()` rejects rollup-derived strings (the issue is the 'unknown type' Notion assigns to all rollup-derived values, not only rollup-of-formula); `length()` tolerates unknown-typed strings; `substring()` does not; coercing with `+ ""` does NOT help
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
// Current-month detection (auto-advances, zero-maintenance)
if(formatDate(prop("Month date"), "YYYYMM") == formatDate(now(), "YYYYMM"), prop("Value"), 0)

// Cascading rollup switch (no lets)
if(prop("Key") == "A", prop("RollupA"), if(prop("Key") == "B", prop("RollupB"), 0))

// Relation name extraction (not chartable as x-axis)
prop("Category").map(current.prop("Name")).join("")

// Round to 2 decimal places (no round(x,n) overload)
round(prop("Value") * 100) / 100

// Month sort key
formatDate(prop("Date"), "YYYYMM")
```


---

## Number formatting

- Plain number property format: `{number: {format: "real"}}` — set via API, works reliably
- Formula display format (e.g. R$, %, currency): **UI-only** — API silently drops any format field; only `expression` is stored
- Rewriting formula expression via API resets the UI display format to default — no workaround
- **Currency output**: `formatNumber(n,"brl")` → `R$1,234.56` (US separators, and errors on rollup-derived values); for pt-BR `R$ 1.234,56` build with floor/mod arithmetic (see Formulas)

