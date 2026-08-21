---
name: engineering-writing-code
description: 'Use when writing, shaping, or placing any code. Triggers: writing, shortening, or citing from a comment or docblock; naming an identifier, file, type, or enum member; choosing between a boolean, string union, and enum for a set of states; defining a domain type, database or validation schema, config shape, or wire payload; data that is flat, joined by ID references, or duplicated across fields; creating, splitting, or moving files; error classes, catch blocks, helpers, wrappers, utils, test files; barrel files, circular imports, a function that only forwards its arguments, an empty catch; any UI component, page, route, layout, form, or prop; a god component, dot-notation sub-components, a page marked "use client"; a rendered surface that reads as unfinished — a spacing, shadow, hover, transition, or feedback question; reaching for a hack, suppression, or workaround to get green, or leaving orphaned code behind; and before writing code against any external library, API, framework, or tool, or proposing a fix after an error.'
---

# Writing Code

## Overview

How code is named, shaped, placed, composed, and verified — held to one standard: clean code at the
lowest cognitive load for the next person who reads, debugs, tests, or extends it. One skill for the
whole code touch; `engineering-dx` owns the priority call about whether a structure should exist at all.

## The standard

What "good" means here, and what every rule below is in service of:

- **Detail, DX, the eye, performance, architecture — all first-class.** How the code reads and
  how the screen feels are acceptance criteria, not polish deferred to later.
- **The professional, official, researched way — not the clever one.** When a mature tool or trade
  already solved the shape, retrieve its answer and follow it faithfully instead of reinventing a
  weaker bespoke one (`references/research.md`). "How do professional architectures do this?" is the question to answer, from current sources, before coining or designing.
- **Root cause, never the symptom.** No suppression, cast, silent fallback, or parallel path to get
  green. A hack you can smell is a defect. If the honest fix exceeds scope, name it and its cost — never smuggle a workaround in.
- **Leave nothing dead.** Code you stop using, you delete — its callers, config, and docs with it.
  No legacy without a live consumer.
- **Simplest shape that still extends cleanly.** Abstraction earns its place only against a need
  that exists now, never a hypothetical one.

## Route to the reference you need

| About to… | Read |
|---|---|
| Name an identifier, file, type, enum member | `references/naming.md` |
| Pick boolean vs string union vs enum | `references/naming-enums.md` |
| Define a domain type, schema, config, payload | `references/modeling.md` |
| Judge whether a type matches the real thing | `references/modeling-domain-type-fidelity.md` |
| Nest data to mirror the domain | `references/modeling-isomorphic-structure.md` |
| Add a registry, dispatcher, or engine | `references/modeling-registries-and-engines.md` |
| Wire startup/self-initializing architecture | `references/modeling-self-initializing-architecture.md` |
| Create, split, or move a file | `references/organizing.md` and `references/organizing-file-boundaries.md` |
| Write an error class or a catch block | `references/organizing-errors.md` |
| Add a helper, wrapper, or util | `references/organizing-extraction-and-wrappers.md` |
| Structure a test file | `references/organizing-test-files.md` |
| Break up a dense wall of code | `references/organizing-visual-structure.md` |
| Ship a fix without a hack, or cut code cleanly | `references/integrity.md` |
| Build a component, page, prop, or form | `references/ui.md` |
| Split a component that grew too large | `references/ui-god-components.md` and `references/ui-compound-components.md` |
| Build a form | `references/ui-forms.md` |
| Fetch data for a screen, or touch `use client` | `references/ui-server-pages.md` |
| Make a rendered surface feel finished — spacing, feedback, motion, restraint | `references/ui-visual-craft.md` |
| Use an external library, API, or tool | `references/research.md` |
| Sweep a problem's dimensions before fixing | `references/research-dimension-sweep.md` |

## Rules that fire without opening a reference

1. **Retrieve before coining.** Never fabricate an identifier when the framework, the domain,
   or the codebase already has a word for it. Grep first; say so when you coin.
2. **A closed set of 3+ states is an enum**, not a pile of booleans and not a bare lowercase
   union — unless the value crosses a wire boundary that dictates its casing.
3. **Never write a function whose body only forwards its arguments.** Inline it. A helper earns
   its name by holding something a reader would otherwise get wrong.
4. **Structure mirrors the domain.** If the data is flat, joined by ID references, or duplicated
   across fields, the shape is wrong before the names are.
5. **Research before writing against anything external** — especially when you are confident
   from memory. Diagnose the root cause before prescribing a fix.
6. **No workaround to get green; nothing outlives its use.** A hack, suppression, cast, or silent
   fallback that only exists to pass is a defect — fix the cause instead. When a caller or feature
   goes, the code, export, and config that served it go with it (`references/integrity.md`).
7. **A comment states a fact the code cannot, or it does not exist.** A doc tag appears only
   when it adds one — nothing demands a complete tag set. A citation names something openable;
   a bare "decision 11" resolves to nothing. A wrong comment is worse than none
   (`references/organizing-comments.md`).
8. **A rendered surface is reviewed by eye before it's done.** Spacing that breathes, visible
   feedback on every action, motion with intent, restraint on effects — working is not finished
   (`references/ui-visual-craft.md`).

## Common mistakes

- Naming a thing before deciding what it is — shape first, then name
- Extracting a helper to save characters rather than to hold a rule
- Reaching for a prohibition when the output is merely the wrong shape; state the shape instead
- Silencing a symptom — a cast, a broadened type, a swallowed error — instead of fixing the cause
- Shipping a screen that works but reads as unfinished — no breathing room, no feedback on click, a shadow doing too much
- Treating these as templates to satisfy instead of reasoning tools

For the priority call — whether a structure should exist, what it costs the next reader —
use the `engineering-dx` skill. For deep-module vocabulary, use mattpocock's codebase-design skill.
