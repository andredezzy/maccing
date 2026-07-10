---
name: composing-ui
description: 'Use when creating any UI component, page, route, or layout, adding a prop to an existing one, wiring data fetching for a screen (prefetch, hydration, suspense, skeletons), or touching a component that has grown large — React or any component framework — plus forms, styling, and labels. Triggers: a prop toggling a section, a god component, dot-notation sub-components (Card.Header), raw inputs with hand-rolled validation, title-case labels, "just one more prop", a page marked "use client", a dataset passed as a prop to a client component, a route-level loading file, a page re-checking auth, a client-side re-parse of search params.'
---

# Composing UI

## Overview

Composition is a HARD RULE, not a preference: structure comes from composing named parts, never from props that toggle sections. And a god component gets refactored to composition the moment you touch it — never extended with one more flag.

**Violating the letter of these rules is violating the spirit of these rules.**

## When to use

- Creating any component, adding any prop, building any form, writing any label
- Touching a component with god signals: prop explosion, boolean/variant section toggles, conditional render forests
- When NOT: pure copy changes inside an already-composed part

## Quick reference

| # | Rule |
|---|---|
| 1 | HARD: composition is mandatory — props never control layout, conditional sub-sections, or behavioral branches; appearance and domain-value props are fine |
| 2 | HARD: a god component gets decomposed on touch, not extended — "one more prop" is how it became a god component |
| 3 | No dot-notation namespacing (breaks RSC) — each part is its own named export |
| 4 | One file per compound: root + all parts as named exports (deliberate exception to one-concern-per-file); primitives get their own file |
| 5 | Compose at the parent/screen level; leaf parts live beside the screen; flat screen folder, no sub-components bucket |
| 6 | Compounds colocate with usage; shared primitives live in the UI package, source-level exports, no build step |
| 7 | className over visual props — components expose structure, consumers control appearance |
| 8 | No custom CSS classes in globals — theme variables, imports, resets only |
| 9 | Sentence case for all labels — capitalize as a sentence, never Title Case |
| 10 | Forms use the standard stack: schema-validated form library + resolver — never raw field state with hand-rolled validation |
| 11 | Full component-library adoption: field, control, label, and message components together — no raw inputs with ad-hoc error display |
| 12 | Pages are server components — `"use client"` lives at leaf parts (tables, forms), never at page level |
| 13 | Data crosses the server/client seam through the hydrated query cache — props carry only serializable primitives, never datasets (standalone pages outside the app shell are the documented exception) |
| 14 | HARD: prefetch args byte-match the client's query args — cache-key parity or hydration silently misses |
| 15 | Guards live in layouts (auth, roles, inverse) — pages never re-check; request-scoped caching dedupes layout+page calls |
| 16 | Loading is per-section Suspense + colocated mirror skeleton (values, never labels) — no route-level loading file, no whole-screen boundary; refetch keeps previous data |

## Rationalizations — all observed, all invalid

| Excuse | Reality |
|---|---|
| "You wanted it minimal / it's a two-line change" | The two-line flag IS the god-component growth mechanism. Decomposing is the minimal correct change |
| "Not blocking this change; flag it for later" | Later has no forcing function. The touch is the trigger — rule 2 has no deferral clause |
| "Refactoring is out of scope" | The refactor IS the scope the moment the component shows god signals |
| "The existing pattern uses flags" | Matching a broken pattern extends the breakage |

**Operator override:** if the operator, seeing the trade-off, still orders the flag or the revert — comply; it is their call. But never silently: one line stating what shape remains and where the composed version lives (git history counts). The observed failure is the silent revert that loses the judgment.

## Red flags — STOP and decompose

- About to add a `showX`/`hideX`/`variant` prop that toggles a section
- The props interface has more booleans than domain values
- You wrote "for later" about a smell you just named
- A form with useState per field and a regex
- A page file starting with `"use client"`
- A fetched dataset in a prop crossing the seam
- A `loading.tsx` or single whole-screen suspense boundary
- Prefetch options that drifted from the client's queryOptions
- A page re-checking auth or roles the layout already enforced
- A second, hand-rolled search-params parse in the client

References: compound-components.md (one-file compound, RSC rule, screen-level composition, worked example) · god-components.md (detection signals + the decompose-on-touch refactor, before/after) · forms.md (the schema stack, resolver, full library adoption) · server-pages.md (page recipe, the seam, cache-key parity, loading granularity, layout guards).
