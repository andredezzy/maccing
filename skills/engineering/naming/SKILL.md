---
name: naming
description: 'Use when naming anything — files, functions, types, variables, enum members — or choosing between a boolean, string union, and enum for a set of states. Triggers: a status/state field, vague or abbreviated names, single-letter values, Base-prefixed classes, Contract-suffixed interfaces, casing questions, PascalCase filenames, a name that covers only part of what the function does.'
---

# Naming

## Overview

A name says exactly what the thing is — and a closed set of states gets an enum, not a pile of booleans or a lowercase union. Precision is the fewest unambiguous words, not padding.

## When to use

- Introducing or renaming any identifier, file, type, or state field
- When NOT: prose or user-facing copy (product voice rules apply there)

## Quick reference

| # | Rule |
|---|---|
| 1 | Closed set of states → enum: 3+ states always, 2 when the names carry meaning; a plain boolean stays right for one unambiguous flag |
| 2 | Enum keys AND values UPPERCASE; a value crossing a wire/serialization boundary keeps the external contract's exact casing as a string union instead |
| 3 | Names are precise — never a vague gesture at the general area |
| 4 | Name the whole behavior, not the salient sub-step; prefer the established domain term; avoid sibling collisions |
| 5 | Spell out truncations that cost decoding; no bare single letters; genuinely universal short forms (id, URL, dx) are exempt |
| 6 | No manufactured verbosity — drop suffixes that add no meaning; if removing a word loses nothing, remove it |
| 7 | Dot-suffixes in filenames only for framework kinds (service, controller, test…); every other file is the kebab-case of its main export — `user-not-found-error.ts`, never `UserNotFoundError.ts` |
| 8 | No `Base` prefix — the interface owns the plain concept name; a skeleton is named for the capability it adds |
| 9 | No `Contract` suffix — the interface IS the concept; on collision pick the next precise domain word |

## The state-field judgment — the observed failure

Replacing `isActive`/`isPending` with a `status` field is the right move — but a lowercase string union is the halfway house. A closed set of 3+ states is an enum, UPPERCASE on both sides: autocomplete at the definition, exhaustive switches, one place to add a state. Reach for the union ONLY when the values cross a wire boundary that dictates their exact casing — then the external contract wins and you say so.

```ts
// ❌ Halfway: no exhaustiveness anchor, casing drifts into string-land
type SubscriptionStatus = "pending" | "active" | "suspended" | "inactive";

// ✅ Internal closed set
enum SubscriptionStatus { PENDING = "PENDING", ACTIVE = "ACTIVE", SUSPENDED = "SUSPENDED", INACTIVE = "INACTIVE" }

// ✅ Wire-boundary exception — the API's casing is the contract
type StripeSubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
```

## Common mistakes

- Adding a third boolean instead of a state field — booleans cannot express a trajectory
- `status` as a lowercase union for purely internal states (the observed default)
- `UserNotFoundError.ts` — the class is PascalCase, its FILE is kebab-case (observed in the wild)
- A name that describes one branch of what the function does — the misleading name costs more than a longer one

Load `references/enums.md` for the full enum-vs-boolean-vs-union reasoning and the wire-boundary rule.
