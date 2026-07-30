---
name: engineering
description: 'Use when writing, shaping, or placing any code — every edit names something, so this loads with the code touch. Triggers: naming an identifier, file, type, or enum member; choosing between a boolean, string union, and enum for a set of states; defining a domain type, database or validation schema, config shape, or wire payload; data that is flat, joined by ID references, or duplicated across fields; creating, splitting, or moving files; error classes, catch blocks, helpers, wrappers, utils, test files; barrel files, circular imports, a function that only forwards its arguments, an empty catch; any UI component, page, route, layout, form, or prop; a god component, dot-notation sub-components, a page marked "use client"; and before writing code against any external library, API, framework, or tool, or proposing a fix after an error.'
---

# Engineering

## Overview

How code is named, shaped, placed, composed, and verified. One skill for the whole
code touch; `dx` owns the priority call about whether a structure should exist at all.

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
| Build a component, page, prop, or form | `references/ui.md` |
| Split a component that grew too large | `references/ui-god-components.md` and `references/ui-compound-components.md` |
| Build a form | `references/ui-forms.md` |
| Fetch data for a screen, or touch `use client` | `references/ui-server-pages.md` |
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

## Common mistakes

- Naming a thing before deciding what it is — shape first, then name.
- Extracting a helper to save characters rather than to hold a rule.
- Reaching for a prohibition when the output is merely the wrong shape; state the shape instead.
- Treating these as templates to satisfy instead of reasoning tools.

For the priority call — whether a structure should exist, what it costs the next reader —
use the `dx` skill. For deep-module vocabulary, use mattpocock's codebase-design skill.
