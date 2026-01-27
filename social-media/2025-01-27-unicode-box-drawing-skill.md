# unicode-box-drawing skill launch

Date: 2025-01-27
Platform: X/Twitter
Skill: unicode-box-drawing

---

## Option A: Problem/Solution Hook

```
Your ASCII diagrams look like this:

+----+    +----+
|    |--->|    |
+----+    +----+

They should look like this:

┌────┐      ┌────┐
│    │─────▶│    │
└────┘      └────┘

I made an agent skill to fix that.

npx skills add andredezzy/maccing -s unicode-box-drawing

Works with Claude Code, Cursor, Windsurf, and 25+ more agents.
```

---

## Option B: Contrarian Hook

```
Stop drawing ASCII boxes by hand.

I wasted hours getting alignment right.

Then I realized:
• Fixed-width lines
• Right-padding
• Breathing room
• Centered content

These rules never change.

So I turned them into an agent skill.

npx skills add andredezzy/maccing -s unicode-box-drawing

Your diagrams will be perfect. Every time.
```

---

## Option C: Visual First (Thread)

**Tweet 1:**
```
This is what happens when agents draw boxes:

┌───────────────┐
│  TITLE       │   ← broken
└──────────────┘

vs what they SHOULD draw:

┌───────────────┐
│     TITLE     │   ← perfect
└───────────────┘

Thread on how I fixed this 🧵
```

**Tweet 2:**
```
The problem: agents don't know the rules.

• Every line must be the same width
• Content needs right-padding
• Empty lines after opening borders
• Center nested content

Without these, boxes break.
```

**Tweet 3:**
```
The solution: teach them once.

I packaged these rules into an agent skill:

┌─────────────────────────────────┐
│                                 │
│   ┌─────────┐    ┌─────────┐    │
│   │ Step 1  │───▶│ Step 2  │    │
│   └─────────┘    └─────────┘    │
│                                 │
└─────────────────────────────────┘

Proper padding. Breathing room. Centered flow.
```

**Tweet 4:**
```
Works with 28+ coding agents:

• Claude Code
• Cursor
• Windsurf
• Cline
• OpenCode
• and more

One command:

npx skills add andredezzy/maccing -s unicode-box-drawing

Open source: github.com/andredezzy/maccing
```

---

## Option D: Short & Punchy

```
Made an agent skill for perfect Unicode box drawings.

┌───────────┐      ┌───────────┐
│  Input    │─────▶│  Output   │
└───────────┘      └───────────┘

No more broken ASCII.
No more alignment issues.
No more wasted time.

npx skills add andredezzy/maccing -s unicode-box-drawing
```

---

## Option E: Bold Claim

```
Your coding agent draws broken diagrams.

Mine doesn't.

The difference? One skill file.

npx skills add andredezzy/maccing -s unicode-box-drawing

Works with Claude Code, Cursor, and 26 other agents.
```

---

## Final Post

```
Made an agent skill for perfect Unicode box drawings.

No more broken ASCII.
No more alignment issues.
No more wasted time.

npx skills add andredezzy/maccing -s unicode-box-drawing
```

---

## Carbon.sh Image Assets

**BROKEN (for comparison):**

```
┌────────────────────────────┐
│        AGENT FLOW            │
├──────────────────────────┤
│                           │
│   ┌───────┐    ┌───────┐    │
│   │ INPUT │───▶│ THINK │  │
│   └───┬───┘    └───┬───┘  │
│       │            │        │
│       ▼            ▼       │
│   ┌───────┐    ┌───────┐ │
│   │  ACT  │    │VERIFY │   │
│   └───────┘    └───────┘  │
│                          │
└──────────────────────────┘
```

**CORRECT (proper alignment):**

```
┌────────────────────────────┐
│        AGENT FLOW          │
├────────────────────────────┤
│                            │
│   ┌───────┐    ┌───────┐   │
│   │ INPUT │───▶│ THINK │   │
│   └───┬───┘    └───┬───┘   │
│       │            │       │
│       ▼            ▼       │
│   ┌───────┐    ┌───────┐   │
│   │  ACT  │    │VERIFY │   │
│   └───────┘    └───────┘   │
│                            │
└────────────────────────────┘
```

---

## Hashtags (optional, use sparingly)

#DevTools #AI #CodingAgents #OpenSource #ClaudeCode

---

## Links

- Skill: https://github.com/andredezzy/maccing/tree/main/skills/unicode-box-drawing
- Install: `npx skills add andredezzy/maccing -s unicode-box-drawing`
- skills.sh: https://skills.sh

---

## Notes

Based on research from:
- [Ship 30 for 30: Viral Thread Hooks](https://www.ship30for30.com/post/how-to-write-viral-twitter-thread-hooks-with-6-clear-examples)
- [Tweet Archivist: Viral Templates](https://www.tweetarchivist.com/viral-tweet-templates-guide)
- [1% Better: Formula for Viral Posts](https://www.1percentbetter.io/p/formula-viral-x-posts)

Key principles applied:
- Bold opening statement
- Visual proof with actual box drawings
- Short lines with whitespace
- Clear CTA with install command
- 80/20 value to promo ratio
