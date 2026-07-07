# Test file layout

## One test file per file-under-test

Named exactly after it, in the adjacent tests directory. Do not fragment one unit's tests into method-scoped or scenario-named files; merge those.

```text
src/
  user-service.ts
  tests/
    user-service.test.ts
```

## E2E tests belong to infrastructure

End-to-end tests are named after the infrastructure file they exercise — a router, controller, scheduled job, queue consumer, or infra service — never after an application/domain unit or a free-floating "flow" name. Application and domain code get unit tests only.

## The split threshold

Splitting one subject's tests across files is acceptable only when a single file would grow beyond roughly a thousand lines — and the split files keep the subject's name as their shared prefix (`user-service.queries.test.ts`, `user-service.mutations.test.ts`).
