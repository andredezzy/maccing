# Self-initializing architecture

## Middleware over manual orchestration

Cross-cutting concerns — synchronization, persistence, logging — are transparent middleware that wraps behavior and composes, not imperative save/load/init calls scattered through the codebase at every site that happens to need them.

```ts
// ❌ Every call site orchestrates persistence by hand.
function updateProfile(profile: Profile) {
  store.set("profile", profile);
  saveToDisk(store);
  logChange("profile", profile);
}

// ✅ The store is wrapped once; call sites just express the domain action.
const store = withLogging(withPersistence(createStore()));
function updateProfile(profile: Profile) {
  store.set("profile", profile);
}
```

## Zero ceremony on initialization

Stores, services, and modules initialize themselves — auto-detecting their context, lazily resolving their dependencies, and self-hydrating — rather than requiring explicit load/init/setup calls wired into startup sequences. Reaching for an `init()` call is usually a symptom that the architecture is wrong, not merely that a name is wrong: the component knows what it needs; let it get it on first use.

## Defaults from context

Platform, locale, timezone, and similar defaults come from what the user is genuinely using, detected at initialization — never hardcoded to an assumed value.
