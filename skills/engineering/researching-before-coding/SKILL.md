---
name: researching-before-coding
description: 'Use when about to write code against any external library, API, framework, or tool; when hitting an error, incompatibility, or unfamiliar technology; before proposing a fix or presenting a design. Especially when confident from memory, under time pressure, or when the API "is well known".'
---

# Researching Before Coding

## Overview

Training data is stale: APIs change, packages ship breaking updates, docs move. A claim about an external surface is verified against a named current source, or it is labeled a guess — asserting from memory is never the standard. One fetch always costs less than shipping code broken against a stale API.

## When to use

- Any code touching an external library, API, framework, or CLI — before writing it
- Any error, incompatibility, or unfamiliar technology — before attempting a fix
- Any multi-dimension design — before presenting it
- When NOT: pure internal logic with no external surface

## Quick reference

| # | Rule |
|---|---|
| 1 | Verify against current sources before external-surface code: API shape, version, breaking changes, deprecations — official docs, the repo, the registry; name the source |
| 2 | Research before fixing: understand WHY a working approach works; one researched fix beats ten blind attempts — no guess-test-fail loops |
| 3 | Diagnose before prescribing: read the error, get the exact message, search it, find the root cause — a fix that misses the root cause produces the next failure |
| 4 | Enumerate every dimension before presenting a design: each axis marked specified / not-applicable-with-reason / user-deferred; verify the build against the design dimension by dimension |

## The verify-first recipe

Before the first line against an external surface: (1) name the version actually installed (lockfile, not memory); (2) fetch the matching docs or changelog for the pieces you touch; (3) note anything that moved since your training knowledge; (4) then write. When a fix is requested: get the exact error text FIRST — hypotheses from memory are inputs to verification, never substitutes for it.

## Common mistakes

- "This API is well known" — well-known APIs are exactly the ones that ship breaking majors
- Patching to make an error disappear without stating the root cause
- A design that fully specifies the interesting dimension and silently skips the boring mandatory one (see the dimension sweep)

Load `references/dimension-sweep.md` for the enumerate-every-dimension method.

For hard bugs, escalate to a dedicated debugging discipline — mattpocock's diagnosing-bugs or superpowers systematic-debugging; this skill hands over at the point a reproducible feedback loop is needed.
