# Errors — the cross-cutting contract

## Placement: top-level `errors/`, one class per file

An error type's real owner is the contract between the code that throws it and every place that catches it — which belongs to neither side. Colocating it inside the thrower forces every catcher to import from, and couple to, the thrower's module. The dedicated folder is the deliberate, narrow exception to colocating-with-owner.

```text
errors/
  user-not-found-error.ts
src/
  user-service.ts   // imports from ../errors/
  router.ts         // imports from ../errors/
```

```ts
// errors/user-not-found-error.ts
export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User not found: ${id}`);
    this.name = "UserNotFoundError";
  }
}
```

## Catch by instanceof, never by message

```ts
// ❌ Brittle: breaks on any wording change, matches accidental lookalikes.
catch (err) { if (String(err).includes("not found")) return notFound(); throw err; }

// ✅ The class IS the contract.
catch (err) { if (err instanceof UserNotFoundError) return notFound(); throw err; }
```

Error messages are developer-facing: write them in English regardless of the product's locale. Only genuinely user-facing copy follows the product locale.

## Never silently swallow

Every catch re-throws, logs with intent, or transforms into a domain error. An empty catch is always a bug — in development and production alike. Log-and-continue is swallowing with extra steps unless continuing is a designed, stated behavior.
