# Enums — a closed set is not a pile of booleans

A boolean cannot express a trajectory of more than two states. Between an enum and a same-shaped string union, autocomplete and exhaustiveness are a wash — both autocomplete in a typed position, and both catch a new state at a `never`-default switch (below). What an enum adds is a single named home for the values: call sites say `SubscriptionStatus.ACTIVE` — one canonical spelling that greps and renames cleanly, with one place to add a case — where a bare union scatters the raw literal `"active"` across every call site.

## When each shape is right

- **Plain boolean** — one unambiguous two-state flag (`isEnabled`). The moment a second flag about the same axis appears, you have states, not flags.
- **Enum** — any internal closed set of 3+ states, or exactly 2 where the names themselves carry meaning.
- **String union in the wire's casing** — a value that crosses a serialization or API boundary where the literal must match the external contract exactly. The external casing wins; keep it a union and name the type after the contract it mirrors.

## The `never`-default anchor

```ts
enum SubscriptionStatus { PENDING = "PENDING", ACTIVE = "ACTIVE", SUSPENDED = "SUSPENDED", INACTIVE = "INACTIVE" }

function describeSubscription(status: SubscriptionStatus): string {
  switch (status) {
    case SubscriptionStatus.PENDING: return "pending";
    case SubscriptionStatus.ACTIVE: return "active";
    case SubscriptionStatus.SUSPENDED: return "suspended";
    case SubscriptionStatus.INACTIVE: return "inactive";
    default: {
      const unreachable: never = status; // adding a state breaks THIS line, not production
      throw new UnknownSubscriptionStatusError(unreachable);
    }
  }
}
```

Add a fifth state and the `never` assignment stops compiling, walking you to every switch that must learn it. The anchor is the `never` default, not the enum — a union typed the same way behaves identically; what the enum buys on top is the named value at each call site instead of a bare string literal. Drop the `never` default and either shape compiles silently.

## Two mutually-exclusive booleans are a state machine in denial

`isActive: boolean; isPending: boolean` permits `isActive && isPending` — a state the domain does not have. The type should make illegal states unrepresentable: one `status` enum replaces the pair and deletes the nonsense combinations.
