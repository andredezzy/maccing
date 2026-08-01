# God components — decompose on touch

## Detection signals

- Prop explosion: more booleans/variants than domain values (`showSidebar`, `showFooter`, `showAvatar`, `compact`, `highlighted`, `loading`, `variant`…)
- Conditional render forest: JSX where every section hides behind `p.showX &&`
- Every feature request lands as one more flag on the same interface

## The rule

The moment you TOUCH a component showing god signals, the work is decompose-to-parts — never "just add one more prop". The observed failure names the smell and defers it ("flag for later, not blocking"): later never comes; the touch is the forcing function.

## Before / after

```tsx
// ❌ The ask was "add showBadge". The god component grows to 8 flags.
interface CardProps { title: string; showSidebar: boolean; showFooter: boolean; showAvatar: boolean; compact: boolean; highlighted: boolean; loading: boolean; showBadge: boolean; variant: "default" | "warning" | "success"; children: React.ReactNode }
```

```tsx
// ✅ The same touch, done right: parts + call-site composition.
// card.tsx exports Card, CardAvatar, CardTitle, CardBadge, CardBody, CardSidebar, CardFooter.
<Card className={highlighted ? "ring" : ""}>
  <CardAvatar src={user.avatarUrl} />
  <CardTitle>{title}<CardBadge /></CardTitle>
  <CardBody>{children}</CardBody>
  {order.hasNotes && <CardSidebar>{notes}</CardSidebar>}
  <CardFooter>{actions}</CardFooter>
</Card>
```

Loading and density stay as props ONLY if they are appearance (a `size` token) — a `loading` state usually becomes a `CardSkeleton` sibling the caller renders instead.

## Migration is incremental

Decompose the parts the current touch needs; leave a deprecated thin wrapper for old call sites if the codebase is large, and migrate call sites as they are touched. Decompose-on-touch, not big-bang.
