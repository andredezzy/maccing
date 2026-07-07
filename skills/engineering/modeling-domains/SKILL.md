---
name: modeling-domains
description: 'Use when defining domain types, database or validation schemas, config shapes, wire payloads, or translation/message trees; when adding a domain type, union member, registry, or dispatcher; when data is flat, joined by ID references, duplicated across fields, or its nesting does not match the real-world thing it describes. Distinct from glossary-style domain-modeling: this skill dictates STRUCTURE — isomorphism, containment, registries.'
---

# Modeling Domains

## Overview

The shape of the data mirrors the shape of reality. Every nesting level corresponds to a real, nameable boundary in the thing described; every relation in the model is a relation that exists in the world. The real-world sentence IS the schema: "an order contains items" means items live inside orders.

## When to use

- Designing types, schemas (zod/DB), config files, wire payloads, translation trees
- Adding a domain type, union member, registry, or dispatcher
- When NOT: modeling for a storage engine whose physical format dictates the shape (say so explicitly at the boundary)

## Quick reference

| # | Rule | The discipline |
|---|---|---|
| 1 | Containment nests | "X contains/belongs-to Y" → nest it; do NOT default to id references. An explicit relation is reserved for genuine many-to-many |
| 2 | Isomorphism everywhere | Every nesting level a real boundary — types, config, wire, translations; no concatenated keys |
| 3 | One registry per domain | Never conflate two concept-spaces in one union/dispatcher; a generic registry factory, instantiated per concern; one explicit one-direction bridge |
| 4 | Exact type-set fidelity | The model's types are precisely the domain's — verify the current set against official docs/live API, never memory; containment enforced in static types AND wire schema |
| 5 | Middleware over orchestration | Cross-cutting concerns (persistence, sync, logging) wrap transparently; no scattered save/load calls |
| 6 | Zero-ceremony init | Stores and services self-detect, lazily resolve, self-hydrate — no explicit init/setup wiring |
| 7 | No technology mixing | One framework per project; consistency of the whole beats local optimization |
| 8 | No redundant fields | A derivable value is computed at read time, never stored alongside its sources |
| 9 | Defaults from context | Platform, locale, timezone detected at initialization — never hardcoded assumptions |

## The containment judgment — run it for every relation

Say the relationship as a real-world sentence. "An order **contains** items" → `items: OrderItem[]` inside `Order`. "A tag can be on **many** orders and an order has **many** tags" → an explicit relation. The observed failure mode is the blanket default "model relations by id reference" — that flattens containment the domain actually has, and the model stops teaching the domain. A mixed union whose members cannot all legally appear in the same places is two domains fused — split them (rule 3).

## Common mistakes

- Flat-FK everything "like a SQL dump" — nesting is the default, references the exception
- Concatenated translation keys hiding real structure in a name
- Storing a computed value next to its inputs "for convenience" — it will drift
- Trusting memory for a domain's type-set — real domains gain and lose types; verify against the live source

References: isomorphic-structure.md (nesting = real boundaries; worked domain/config/wire/translation examples; redundant fields) · registries-and-engines.md (one registry per domain, the factory, the bridge, the mixed-union split signal) · domain-type-fidelity.md (exact type-set, live verification, containment in types AND schema) · self-initializing-architecture.md (middleware, zero-ceremony init).

For glossary work (CONTEXT.md, ADRs), use mattpocock's domain-modeling — his skill names the concepts, this one dictates the shapes.
