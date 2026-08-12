# Extraction and wrappers — a function must earn its existence

## Inline over premature extraction

Within a single function, do not hoist a shared constant to deduplicate something two sibling branches build, and do not lift a one-off multi-step operation into a helper called from a single site. Both couple things that only coincidentally look alike and force the reader to jump elsewhere to understand a branch. Local duplication beats a DRY abstraction that serves only one caller. DRY governs knowledge that must stay in sync across the codebase, not two branches that happen to resemble each other. Extraction earns its keep at several call sites, or when the extracted unit does real work beyond forwarding.

## Derivation follows its inputs

Several call sites justify extraction only when no component already owns the inputs. A value derived from inputs an existing component already receives — and from knowledge it already defines (names, templates, defaults) — is that component's output: build it inside, return it alongside the other outputs, and let consumers take it as a parameter. A builder that takes the raw config and re-derives the value duplicates the owner's knowledge and drifts when the owner changes; colocating it in the owner's file does not fix that — the defect is re-deriving from raw inputs what the owner should hand over.

```ts
// ❌ Rootless re-reader: duplicates the service-name knowledge createDataStack already defines.
export function buildConnectionUrls(config: StackConfig) {
  const host = `${config.projectName}-postgres.${config.namespace}.svc.cluster.local`;
  return { databaseUrl: `postgres://postgres:${config.postgresPassword}@${host}:5432/${config.projectName}` };
}

// ✅ The owner of the inputs exposes the derivation as an output.
export function createDataStack(config: StackConfig): DataStack {
  const serviceName = `${config.projectName}-postgres`;
  const postgres = deployHelmChart({ name: serviceName, /* … */ });
  const host = `${serviceName}.${config.namespace}.svc.cluster.local`;

  return {
    postgres,
    databaseUrl: `postgres://postgres:${config.postgresPassword}@${host}:5432/${config.projectName}`,
  };
}
```

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
