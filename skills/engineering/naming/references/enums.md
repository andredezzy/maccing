# Enums for closed sets

A boolean cannot express a trajectory of more than two states, and a string union gives neither guaranteed call-site autocomplete nor an exhaustiveness check as the set grows. An enum gives autocomplete at the definition, exhaustive checking at every switch, one place to add a case, and self-documenting call sites.

## When each shape is right

- **Plain boolean** — one unambiguous two-state flag (`isEnabled`). The moment a second flag about the same axis appears, you have states, not flags.
- **Enum** — any internal closed set of 3+ states, or exactly 2 where the names themselves carry meaning.
- **String union in the wire's casing** — a value that crosses a serialization or API boundary where the literal must match the external contract exactly. The external casing wins; keep it a union and name the type after the contract it mirrors.

## The exhaustiveness payoff

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

With the lowercase union, a fifth state compiles silently everywhere it should have been handled. With the enum plus a `never` default, the compiler walks you to every switch that must learn the new state.

## Two mutually-exclusive booleans are a state machine in denial

`isActive: boolean; isPending: boolean` permits `isActive && isPending` — a state the domain does not have. The type should make illegal states unrepresentable: one `status` enum replaces the pair and deletes the nonsense combinations.
