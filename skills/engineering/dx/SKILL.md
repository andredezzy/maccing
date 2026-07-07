---
name: dx
description: 'Use when developer experience is at stake — designing or reviewing any code structure, choosing between implementation approaches, extending existing code, or tempted to add abstraction, configuration, indirection, or generality. Triggers: over-engineering, speculative flexibility, "we might need it later", cognitive load, extension points, a growing conditional, "just add another branch/case/flag", clever code.'
---

# DX

## Overview

DX — developer experience — is the top design priority: it outweighs every other trade-off heuristic. The measure of any structure is the cognitive load it places on the next person who must read, debug, test, or extend it. These are principles to reason from, not templates to copy: derive the best concrete shape for the situation in front of you.

## When to use

- Choosing between two designs that both work
- Extending existing code — before adding a branch, case, flag, or option to something that already has several
- Any pull toward abstraction, configuration, indirection, or generality
- When NOT: mechanical edits with no structural choice

## Quick reference

| # | Principle | The discipline |
|---|---|---|
| 1 | DX outranks everything | Beats every competing heuristic — tidiness, existing patterns, premature-generality worries |
| 2 | Simplicity over cleverness | Simplest design that fully solves the present problem wins; patterns remove complexity, never decorate |
| 3 | Discoverability | Listing a directory should reveal where a new case is meant to be added |
| 4 | Consistency of mental model | One pattern per pluggable concern, applied everywhere — one thing to learn |
| 5 | Open/closed extension | A new case = a new file + one registration — never editing a conditional that grows with every case |
| 6 | Test isolation via seams | Inject a strategy, substitute a small fake; one-line setup |
| 7 | Self-documenting architecture | Structure is the documentation; an interface plus its implementations replaces prose docs |
| 8 | Local reasoning | No state-at-a-distance; pass what a component needs explicitly; caching earns its place only when the computation is expensive AND the input is unavailable at call time AND several callers share the result |
| 9 | The re-evaluation question | Easier to read, debug, test, and extend well into the future? Decide on this alone |

## The extension-seam judgment — run it every time you extend

Before appending a branch, case, or flag to something that already dispatches:

1. Count the cases after your addition.
2. Ask what adding the NEXT case costs — if the answer is "edit this growing block again", you are inside principle 5's failure mode.
3. A registry or handler map earns its place when it makes the next case cheaper AND the current code simpler to read. Two or three short branches usually stay a conditional; five cases with real bodies usually don't.
4. Whichever you choose, state the judgment. Extending by pattern-matching — "matching the existing pattern" without evaluating the seam — is the failure, not the branch itself.

## Common mistakes

- Extending a dispatch block because "that's the existing pattern", with no seam evaluation
- Building machinery for a future someone merely mentioned — "later" is not a requirement
- Treating these principles as templates to satisfy instead of reasoning tools

References: simplicity.md (abstraction pulls, "later" requirements) · extension-points.md (adding cases; the registry recipe) · local-reasoning.md (state, parameters, the caching test, test seams). For deep-module vocabulary (depth, seams, adapters), use mattpocock's codebase-design skill — not re-taught here.
