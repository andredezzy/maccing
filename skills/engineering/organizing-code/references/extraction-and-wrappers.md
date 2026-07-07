# Extraction and wrappers — a function must earn its existence

## Inline over premature extraction

Within a single function, do not hoist a shared constant to deduplicate something two sibling branches build, and do not lift a one-off multi-step operation into a helper called from a single site. Both couple things that only coincidentally look alike and force the reader to jump elsewhere to understand a branch. Local duplication beats a DRY abstraction that serves only one caller. DRY governs knowledge that must stay in sync across the codebase, not two branches that happen to resemble each other. Extraction earns its keep at several call sites, or when the extracted unit does real work beyond forwarding.

## The pass-through existence test

A function whose whole body forwards its arguments unchanged to one other function is noise — a defect to remove, outranking convenience. Where a callback is expected, pass the target function by reference instead of wrapping it.

A thin function earns its place only when it does real work the call site cannot trivially express:

- transforms or destructures an argument before forwarding
- applies a default, fallback, validation, or error handling
- composes two or more operations into one meaningful unit
- specializes a generic/stringly API into a named, typed operation reused at several sites
- encapsulates module state behind an accessor, or adapts between genuinely different types

The test is decoding-and-indirection cost: if removing the function loses no boundary, no deduplication across several callers, and no clarity — it was a pass-through; delete it.

```ts
// ❌ Forwarding-only: delete it and call sendEmail directly.
function dispatchEmail(to: string, body: string) { return sendEmail(to, body); }

// ✅ Earns its place: default + composition.
function sendReceipt(order: Order) {
  return sendEmail(order.customerEmail, renderReceipt(order), { replyTo: SUPPORT });
}
```
