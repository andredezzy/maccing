# Naming — say what the thing is; retrieve the word before coining

## Overview

A name says exactly what the thing is — and a closed set of states gets an enum, not a pile of booleans or a lowercase union. Precision is the fewest unambiguous words, not padding. And a name is retrieved before it is coined: the framework, the domain, or the codebase usually already owns the word.

## When to use

- Every code touch — writing code IS naming: each variable, function, type, file, or config key an edit introduces is a naming act, so it happens with the edit itself, never as a separate later step
- Introducing or renaming any identifier, file, type, or state field
- When NOT: prose or user-facing copy (product voice rules apply there)

## Quick reference

| # | Rule |
|---|---|
| 1 | Closed set of states → enum: 3+ states always, 2 when the names carry meaning; a plain boolean stays right for one unambiguous flag |
| 2 | A value crossing a wire/serialization boundary keeps the external contract's exact casing as a string union instead of an enum |
| 3 | Names are precise — never a vague gesture at the general area |
| 4 | Name the whole behavior, not the salient sub-step; prefer the established domain term — and for a mechanism you introduce, retrieve that term first: ask whether the trade already names it, research when unsure (see references/research.md); avoid sibling collisions |
| 5 | NEVER fabricate an identifier — retrieve before coining, in order: the framework/platform's official word for the concept (verified in its docs, not from memory), the domain's established term, the codebase's existing lexicon (grep first); only when all three come up empty, coin — and say the name is coined and why. A fabricated name where an official one exists is a defect to fix on sight — and retrieval means the framework's word for THIS thing: a generic role word (types, api, client) that is merely established somewhere does not outrank it |
| 6 | Spell out truncations that cost decoding; no bare single letters; genuinely universal short forms (id, URL, dx) are exempt |
| 7 | No manufactured verbosity — drop suffixes that add no meaning; if removing a word loses nothing, remove it |
| 8 | Dot-suffixes in filenames only for framework kinds (service, controller, test…); every other file is the kebab-case of its main export — `user-not-found-error.ts`, never `UserNotFoundError.ts` |
| 9 | No `Base` prefix — the interface owns the plain concept name; a skeleton is named for the capability it adds |
| 10 | No `Contract` suffix — the interface IS the concept; on collision pick the next precise domain word |
| 11 | Code is English — identifiers, file and folder names, and route/path segments, regardless of the product's or team's spoken language ("CODE IS ENGLISH") |

## The state-field judgment — the observed failure

Replacing `isActive`/`isPending` with a `status` field is the right move — but a bare string union is the halfway house. A closed set of 3+ states is an enum: autocomplete at the definition, exhaustive switches, one place to add a state. Reach for the union ONLY when the values cross a wire boundary that dictates their exact casing — then the external contract wins and you say so.

```ts
// ❌ Halfway: no exhaustiveness anchor
type SubscriptionStatus = "pending" | "active" | "suspended" | "inactive";

// ✅ Internal closed set
enum SubscriptionStatus { PENDING = "PENDING", ACTIVE = "ACTIVE", SUSPENDED = "SUSPENDED", INACTIVE = "INACTIVE" }

// ✅ Wire-boundary exception — the API's casing is the contract
type StripeSubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
```

## The mechanism-name judgment — the observed failure

When isolating each dependency behind its own concurrency budget, the reflex is to name the mechanism for its parts — `ConcurrencyLimiter`, `Limiter`, a `gate` — each honest about the code and silent about the trade, which calls this a **bulkhead**. The tell is a mechanism you are about to name from scratch: retrieve the trade's term first (research when unsure), because you cannot prefer an established name you never went and got.

```ts
// ❌ Named from its parts — the trade term never retrieved (all three observed)
class ConcurrencyLimiter { /* per-dependency slots */ }   // also seen: class Limiter, a `gate`

// ✅ Named what the trade calls it
class Bulkhead { /* per-dependency slots */ }
```

## The fabricated-name judgment — the observed failure

Every observed coinage arrived with a principled-sounding defense. "`buildAfter` names the precise behavior, not generic dependency" — Pulumi's word for exactly this is `dependsOn`, and at a platform boundary the official term IS the precise term; the synonym is a translation layer every reader must cross. "`previousImage` avoids conflating with Pulumi's internal `dependsOn` mechanism" — a field that exists to feed that mechanism is not conflating by matching its name; dodging platform vocabulary is the defect, not a virtue. Same class: `contract` coined for a tRPC router type export when tRPC's own word is `router`/`AppRouter`.

```ts
// ❌ Coined beside the official word — each defended as "more precise" (all observed)
interface AppImageArgs { buildAfter?: pulumi.Resource }   // also seen: previousImage, priorImage
export type ApiContract = typeof appRouter;

// ✅ The platform's own vocabulary, verified in its docs
interface AppImageArgs { dependsOn?: pulumi.Resource }
export type AppRouter = typeof appRouter;
```

The retrieval can also end with no name at all: a `clampLimit` helper was deleted because the abstraction collapsed — the honest expression was the code itself, inline.

Retrieval can also be laundered: a generic role word — `types`, `api`, `client` — is established *somewhere*, so the coinage certifies itself as retrieved. The order is specificity to the thing: the framework's word for exactly this (`router`, for a tRPC router type export) outranks any ecosystem-wide role word, and rejecting the specific word as "implementation detail" or "less universal than" the generic is the tell that retrieval stopped one level too high. An export that contains no client is not named `client` for its consumers.

## Common mistakes

- Adding a third boolean instead of a state field — booleans cannot express a trajectory
- `status` as a lowercase union for purely internal states (the observed default)
- `UserNotFoundError.ts` — the class is PascalCase, its FILE is kebab-case (observed in the wild)
- A name that describes one branch of what the function does — the misleading name costs more than a longer one
- A coined synonym defended as "more precise than" or "avoiding conflation with" the official term (both observed) — when the thing feeds a platform mechanism, the platform's word is the name

Load `references/naming-enums.md` for the full enum-vs-boolean-vs-union reasoning and the wire-boundary rule.
