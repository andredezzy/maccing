---
name: organizing-code
description: 'Use when creating, splitting, or moving files; defining error classes or writing catch blocks; adding helpers, wrappers, or utils; structuring test files; or deciding where types, env vars, or server/client context live. Triggers: a file doing several things, circular imports, barrel files, a function that only forwards its arguments, a buildX(config) helper re-reading inputs a component already receives, an empty catch, a dense wall of code, inline multi-property object types, section-divider comments.'
---

# Organizing Code

## Overview

The file tree is the documentation: every file one concern, named for what lives there; every function earning its existence. Errors are a cross-cutting contract, not the thrower's property.

## When to use

- Creating/splitting files, adding error classes or catch blocks, adding helpers or wrappers, structuring tests
- When NOT: content-only edits inside an already-well-placed file

## Quick reference

| # | Rule |
|---|---|
| 1 | No barrel files or kind-based dirs (types/, shared/) — code lives with its owner |
| 2 | Custom errors in top-level `errors/`, one class per file — never colocated in the thrower |
| 3 | Catch by `instanceof`, never by matching message strings; error messages in English |
| 4 | One responsibility per file; the file name is the documentation |
| 5 | Split by responsibility, not size; inline once-used short helpers |
| 6 | Local duplication beats a single-caller abstraction — extraction needs several call sites |
| 7 | Ownership of a derivation follows ownership of its inputs — the component already holding them builds the value and returns it as an output; consumers receive it |
| 8 | No pure pass-through wrappers — forwarding-only functions are defects (see the existence test) |
| 9 | OOP only for stateful responsibility with a lifecycle; plain functions for stateless transforms |
| 10 | Entry points are thin orchestrators — no business logic |
| 11 | A single-static-method class is a function (mapper-namespace exception) |
| 12 | No circular runtime imports — extract the shared dependency; type-only cycles are fine |
| 13 | Env vars owned by apps; packages receive config via injection |
| 14 | Server context and client context live in separate files |
| 15 | One test file per file-under-test, named after it; e2e tests belong to infrastructure files |
| 16 | Never silently swallow an error — every catch re-throws, logs, or transforms; empty catch = bug |
| 17 | Blank lines group related statements — no dense walls |
| 18 | No inline structural types — 2+ properties or 2+ non-primitive union members → named type |
| 19 | No decorative section-divider comments — needing them signals a split |

## The errors/ placement rule — the observed failure

When adding a custom error, the reflex is to define it inside the module that throws it. That couples every catcher to the thrower's module — but the error's real owner is the CONTRACT between throw site and catch sites, which belongs to neither. Place every `Error` subclass in a top-level `errors/` folder, one file per class; both sides import from there. Even for one error. Even in a small project — the second catcher always comes.

## The derived-value rule — the observed failure

When several consumers need a value computed from inputs an existing component already receives (connection URLs from the passwords and service names a data stack holds), the reflex is a `buildX(config)` helper that re-reads those inputs — a new module, or an export beside the owner. Both re-derive knowledge the owner already defines and let the two drift. The derivation is the owner's output: build the value inside the component, return it alongside its other outputs, and pass it to consumers as a parameter. Rule 6's several call sites licenses extraction only when no component already owns the inputs — several consumers of a derived value get a producer, not a shared re-reader.

## Common mistakes

- Defining the error class in the service that throws it ("it's used here") — the placement rule has no small-project exception
- Extracting a helper the moment two lines repeat inside one function — rule 6 requires several call sites
- Adding a `buildX(config)` helper for a value derivable inside the component that already receives that config — the owner returns it as an output (rule 7), even when the helper sits in the owner's file
- try/catch that logs-and-continues — that is swallowing with extra steps (rule 16)

References: errors.md (placement, instanceof, never-swallow) · extraction-and-wrappers.md (inline-over-extraction, derivation-follows-inputs + the pass-through existence test) · file-boundaries.md (barrels, responsibilities, entry points, OOP vs functions, imports, env vars, context) · test-files.md (test layout, e2e ownership) · visual-structure.md (blank-line grouping, named types, no dividers — beyond what formatters enforce).
