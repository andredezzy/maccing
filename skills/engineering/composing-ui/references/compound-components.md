# Compound components

## The composition rule

A prop never controls layout, the conditional rendering of a sub-section, or a behavioral branch — those call for composition: the consumer places named parts, and the structure IS the markup at the call site. Props that carry appearance (className, size) or domain values (title, user) are fine.

## One file per compound, named exports, no dot-notation

The compound lives in ONE file exporting its root and every part as named exports. Dot-notation namespacing (`Card.Header`) breaks React Server Components — never attach parts as properties.

```tsx
// card.tsx — one file, named exports
export function Card({ className, children }: CardProps) {
  return <div className={`card ${className ?? ""}`}>{children}</div>;
}
export function CardHeader({ children }: CardPartProps) { return <header>{children}</header>; }
export function CardBody({ children }: CardPartProps) { return <div className="content">{children}</div>; }
export function CardSidebar({ children }: CardPartProps) { return <aside className="sidebar">{children}</aside>; }
export function CardFooter({ children }: CardPartProps) { return <footer className="footer">{children}</footer>; }
```

```tsx
// screen level — structure comes from composition, not flags
<Card>
  <CardHeader>{title}</CardHeader>
  <CardBody>{children}</CardBody>
  {hasPromotion && <CardSidebar><PromoList /></CardSidebar>}
</Card>
```

The conditional lives at the CALL SITE where the domain knows why — not inside the component as a `showSidebar` flag.

## Placement

Compose at the parent or screen level; a screen folder is a flat set of compound files plus the screen that composes them — no generic sub-components bucket, no nested folders. Compounds colocate with usage; shared primitives (single-element wrappers) live in the shared UI package as source-level exports, one primitive per file, no build step.
