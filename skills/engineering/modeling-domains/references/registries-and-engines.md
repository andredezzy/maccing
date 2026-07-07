# One registry per domain

When the members of what looks like a single discriminated union obey different real-world composition rules — some nest freely, others may only appear inside a specific container — they are two domains, not one. Give each its own type union, its own registry, and its own engine.

## The split signal

A single mixed union whose members cannot all legally appear in the same places is the signal that two domains have been fused. Example: block types that nest anywhere vs field types that only exist inside a form block — one `kind` union over both will eventually need "except" rules everywhere. Split into `BlockType` and `FieldType`, each with its own registry.

## The generic factory

Factor the registry mechanism itself into ONE generic factory, instantiated once per concern — one implementation, several typed instances, never copies:

```ts
function createRegistry<K extends string, V>() {
  const entries = new Map<K, V>();
  return {
    register(key: K, value: V) { entries.set(key, value); },
    resolve(key: K): V {
      const v = entries.get(key);
      if (!v) throw new UnknownRegistryKeyError(key);
      return v;
    },
  };
}

export const blockEngine = createRegistry<BlockType, BlockRenderer>();
export const fieldEngine = createRegistry<FieldType, FieldRenderer>();
```

## The bridge — one, explicit, one-direction

Cross-domain interaction flows through exactly one bridge in one direction: the containing side reaches into the contained side's engine, never the reverse. The form-block renderer calls `fieldEngine.resolve(...)`; no field renderer ever knows blocks exist.
