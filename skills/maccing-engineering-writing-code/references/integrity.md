# Integrity — no workaround to pass, nothing left dead

Two failures pass CI and still rot the codebase: a hack that only exists to turn the check green, and code that outlived its last caller. Both trace to observed failures.

## Fix the cause, never buy the green

The reflex under pressure is to make the check pass: a `@ts-expect-error`, a cast to `any`/`never`, a `?? fallback` that masks a null, a `try/catch` that swallows, a skipped test, or a second code path that dodges the failing one. Each turns red to green and leaves the cause in place to fail again later — "I dont want this hacky, all entities should be clean without hackies or workaround"; "is hash-app really neccessary? it feels hacky for me". If the honest fix is bigger than the task, that is a fact to state with its cost — never a licence to smuggle the workaround in.

```ts
// ❌ Green bought with a suppression — the cause (a nullable the type never modelled) is still there.
const user = getUser(id) as User;            // getUser actually returns User | null
return user.email.toLowerCase();             // throws in production the first time it misses

// ✅ Model the real case and handle it.
const user = getUser(id);
if (!user) throw new UserNotFoundError(id);
return user.email.toLowerCase();
```

Diagnosing the cause is `references/research.md` (read the error, find the root); a caught error that is neither re-thrown, logged, nor transformed is `references/organizing-errors.md` (never silently swallow). This rule is the ship decision on top of both: a workaround does not ship.

## The green is earned, not reported

A pass you did not watch is not a pass. A reported green — a subagent's "done", a cached result, a log that reads finished — is an input to verify, never a conclusion: re-run the check yourself, over the real repo, before believing it ("verify liveness, never relay agent claims"). And a review's findings are not advisory — "You should fix ALL the findings." Fix every one, then review again, and repeat until a full pass returns zero: "run a very exhaustive team for review everything, and fix all findings, and again review everything, until zero findings"; the work is done when "all quality checks greens", verified, not when a step along the way claimed to be.

## Nothing outlives its use

When a feature is cut or a path stops being called, the code that served it does not get to stay "just in case" — "Delete = unpublishing. Since I dont want legacy of dead code without usages in my codebase." Deleting the surface means deleting all of it: the export, its callers, its config, its tests, its docs, and any dependency it alone pulled in. A dead export with no consumer is not a smaller version of the feature — it is a claim the codebase makes and cannot keep.

```text
Cutting `legacyExport`:
  ❌ delete legacy-export.ts only     → its config key, its test, and a barrel line still point at a ghost
  ✅ delete the export, its call sites, its config, its test, and the dependency it alone required
```

The test is an exact, repository-wide search for the last consumer: none found → it goes; one found → migrate that consumer first, to an explicit end state, before the delete.
