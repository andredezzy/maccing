# Isomorphic structure — the shape mirrors the thing

Any nested structure you author — domain types, configuration, serialized payloads, and human-facing message/translation trees — should mirror the real composition of what it represents. Every level of nesting corresponds to a real, nameable boundary; each key says what the node IS. Nest as deeply as the real structure genuinely goes, and stop where there is no further real boundary.

## Containment vs relation

```ts
// ❌ Flat-FK by default: the model no longer teaches the domain.
interface Order { id: string; customerId: string; itemIds: string[]; tagIds: string[] }
interface OrderItem { id: string; orderId: string; productId: string; quantity: number }

// ✅ The real-world sentence is the schema: orders CONTAIN items (nest);
// products are referenced (an item points at a catalog product);
// tags are genuinely many-to-many (explicit relation).
interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  createdAt: Date;
}
interface OrderItem { productId: string; quantity: number }
interface OrderTag { orderId: string; tagId: string }
```

The same rule in the validation schema — containment enforced, not just typed:

```ts
const orderSchema = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1),
  items: z.array(orderItemSchema).min(1), // an order without items is not an order
  createdAt: z.coerce.date(),
});
```

## Translation trees

```jsonc
// ❌ Structure hidden in concatenated names
{ "checkout_title": "Checkout", "checkout_payment_card_label": "Card number" }

// ✅ Structure IS the nesting
{ "checkout": { "title": "Checkout", "payment": { "cardNumber": { "label": "Card number", "error": "Enter a valid card number" } }, "submit": "Place order" } }
```

Never flatten distinct levels into a concatenated name that hides the structure, and never invent grouping levels that have no referent in the screen or domain itself.

## No redundant fields

A value that can be derived must not also be stored. `order.total` computed from items at read time cannot drift; a stored copy can and will. Persist the sources, compute the view.
