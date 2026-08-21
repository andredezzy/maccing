# Visual structure — beyond what formatters enforce

Biome/Prettier normalize spacing and line width; they do not group your statements, name your types, or stop divider art. These three rules are the human half.

## Blank lines are mandatory grouping

Group related statements; separate unrelated groups with a blank line — cleanup, assignment, and logical blocks each read as one visual unit. A dense wall of code is unacceptable; whitespace is a readability tool, not decoration.

## No inline structural types

Name every return type, parameter object, and multi-member union. The threshold: 2+ properties, or 2+ non-primitive union members → extract a named type. A trivial single-member nullable stays inline.

```ts
// ❌ The shape is anonymous three levels deep.
function summarize(): { total: number; items: { id: string; qty: number }[] } { /* … */ }

// ✅ The names carry the meaning.
interface OrderSummary { total: number; items: OrderLine[] }
function summarize(): OrderSummary { /* … */ }
```

## No decorative dividers

A comment is plain text — never dressed up with rules or box-drawing (`// ────────`). If a file needs visual section breaks to navigate, that is the signal it holds several responsibilities and should be split; within a file, plain comments and blank lines are enough.

## Comments state the current fact

A comment says what the thing is and the one fact that would bite — never its history, never a changelog line. Keep it readable by humans and agents alike; an agent has no budget to go and check, so it simply trusts what you wrote.

What earns a comment, what a doc tag must add, how a citation has to resolve, and the three shapes that rot on their own: `references/organizing-comments.md`. That file is content; the dividers rule above is only formatting.
