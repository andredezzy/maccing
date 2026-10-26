# Local reasoning — no state at a distance

A component's behavior should not depend on what some other code happened to write into a shared store earlier. That implicit, invisible contract is a DX cost: the reader cannot understand the component without reconstructing the history of everything that ran before it.

## The rule

Pass what a component needs as an explicit parameter. Explicit inputs make the component's contract visible at the call site, make tests trivial to set up, and make refactors safe — the compiler shows every caller.

## The caching test

Caching that hides a dependency earns its place only when ALL THREE hold at once:

1. The computation is measurably expensive.
2. The input is genuinely unavailable at call time.
3. Several independent callers share the same result.

Anything less, and the cache is state-at-a-distance wearing a performance costume: pass the value instead.

## Test isolation via seams

Prefer injecting a strategy and substituting a small fake over loading large realistic fixtures; prefer setup that fits in a line over fixture-heavy setup. A test should state only what it actually depends on.

```ts
// ❌ The component reaches into shared state; the test must reconstruct the world.
export function renderGreeting() {
  return `Hello ${appStore.get("user").name}`;
}

// ✅ Explicit parameter; the test is one line.
export function renderGreeting(userName: string) {
  return `Hello ${userName}`;
}

test("greets by name", () => {
  expect(renderGreeting("Ada")).toBe("Hello Ada");
});
```
