# Exact type-set fidelity

The model's types are precisely the domain's types — nothing invented, nothing omitted. A type the domain does not have is cruft to remove; a type it does have but you omitted is a gap that will surface as an unhandleable input.

## Verify against the live source, never memory

Before adding or removing a domain type, verify the real, current set against official documentation or the live API. Training knowledge goes stale; real domains gain and lose types over time. One fetch of the current docs costs less than a model that silently rejects a payload the real system sends.

## Containment enforced twice

The rules for what may contain what live in BOTH the static types AND the validated/wire schema, so an element that is only legal inside a container cannot appear bare:

```ts
// Static: a FieldBlock exists only inside a FormBlock's fields array —
// the type system offers no place to put a bare field.
type Block = TextBlock | ImageBlock | FormBlock;
interface FormBlock { kind: "form"; fields: Field[] }

// Wire: the schema enforces the same law for anything deserialized.
const blockSchema: z.ZodType<Block> = z.discriminatedUnion("kind", [
  textBlockSchema,
  imageBlockSchema,
  z.object({ kind: z.literal("form"), fields: z.array(fieldSchema).min(1) }),
]);
```

If only the types enforce it, every external input is a bypass; if only the schema enforces it, every internal construction is one.
