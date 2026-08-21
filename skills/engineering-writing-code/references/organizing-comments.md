# Comments — simple enough to read once

One rule sits above every other here: **a comment is simple and reads clean.** Short sentences. Plain words. One idea per sentence. A comment you have to read twice is a defect even when every word in it is true.

If the why takes more than a few short sentences, the code underneath is too complex. Simplify the code, or move the reasoning to an ADR and link it. Do not grow the comment.

Everything below serves that one rule.

## The shape

1. One sentence saying what this is.
2. Then only what would bite a maintainer — each fact its own short sentence.
3. Stop.

A block that follows this lands in two to six lines on most functions. That is a consequence of having said only what was worth saying, not a budget to spend.

## Tags carry facts; they are not slots to fill

`@param`, `@returns`, `@throws`, `@example`, `@remarks`, `@see` are all fair game. Use whichever one puts a fact where a reader will look for it. A `@param` is often the *best* place for a per-argument hazard, because it sits next to the name it constrains.

What makes a tag line bad is never the tag. It is a line that repeats what the signature already said.

```ts
// ❌ Four tags, zero facts. Every line restates the signature.
 * @param rows The rows to page over
 * @param limit Maximum number of rows to return
 * @param cursorId The cursor id, or null
 * @returns The page

// ✅ Two tags, two facts. `limit` holds no surprise, so it gets no line.
 * @param rows Must extend `limit + 1` past the cursor. `has_more` is read from
 * that surplus, so a short fetch reports the last page one page early.
 * @param cursorId Exclusive. An id missing from `rows` restarts at the first
 * row instead of throwing.
```

Both blocks document the same function. The second is shorter because it dropped the lines that were not carrying anything — not because tags were rationed.

**Never build a lint rule that demands a complete tag set.** Such a rule can only fire on someone who already chose to document something, so it taxes the one contributor with a fact worth recording and leaves silence unpunished. The cheapest way to stay green becomes writing no comment at all. Rules that check a tag is *correct* — that its name matches a real parameter, that it says something — are worth having; rules that check a tag is *present* are not.

## A citation names something a reader can open

An ADR id, a file path, an exported symbol, a URL. Never a bare sequence label like `decision 11` or `ruling D-4`, which resolves to nothing and sends the reader away from the code.

- **A cited symbol exists.** Grep it before you write it. When the mechanism has no name of its own, describe the mechanism rather than inventing a name for it.
- **A cited document says what you claim.** Open it. A citation that resolves but misstates its target survives review, which makes it worse than a dangling one.

With no ADR to point at, state the constraint and cite nothing. An absent citation invites the reader to check the code; a fabricated one does not.

## What rots without anyone touching it

| Shape | Why it rots |
|---|---|
| Defect history — "this used to yield indices, so the header was named 0" | Every future reader pays to learn about a bug that no longer exists. The fixed line is self-evident; the lesson belongs in an ADR. |
| A hardcoded count — "seven non-router modules", "277 call sites" | True the day it was written, wrong by the next commit. State the constraint, never the tally. |
| An orphaned block — two `/** */` in a row where only the second attaches, a block separated from its subject by a blank line, an empty `/** */`, a block describing something that has since moved | It documents nothing, and a reader attributes it to whatever sits below it. |

## A wrong comment is worse than none

Code that lies gets caught by a test. A comment that lies is trusted — by a human skimming, and absolutely by an agent, which has no budget to go and check.

When you touch a line, read the comment above it. If it no longer describes the code, fix it or delete it in the same edit.

## Red flags

- A sentence you had to read twice
- A docblock longer than the function it sits on
- A tag line you could delete without losing a fact
- "See the ruling on…" with no number, path, or link you have opened
- A count, a percentage, or a list length written into prose
- Explaining why the code is no longer wrong
- Reaching for a comment to rescue a confusing function — rename or split it instead
