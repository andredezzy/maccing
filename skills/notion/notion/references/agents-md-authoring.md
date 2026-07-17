# Authoring AGENTS.md playbooks on Notion

Part of the `notion` skill — loaded on demand. The SKILL.md MANDATORY rules still apply (sweep, pagination, match-conventions). The sweep rule covers **reading & obeying** AGENTS.md pages; **this file is the complement — how to WRITE and EDIT them well.**

**Core principle:** an AGENTS.md page **is a skill for future agents.** So authoring one **is test-driven** — you do not know it works until a *fresh* agent, given only that page plus a task, actually obeys it. This mirrors `superpowers:writing-skills`, adapted to Notion playbook pages.

**REQUIRED BACKGROUND:** `superpowers:writing-skills` (and the `superpowers:test-driven-development` RED→GREEN→REFACTOR cycle it builds on). Everything below is those principles applied to a Notion page instead of a `SKILL.md`.

### The Iron Law

```
NO AGENTS.md SHIPS (OR EDIT LANDS) UNTIL A FRESH AGENT, GIVEN ONLY IT + A REAL TASK, OBEYS IT
```

Applies to new playbooks AND edits. Not for "obvious" rules, not for a one-line addition. An untested rule is an untested rule. **Violating the letter of this rule is violating the spirit of it.**

## When to write one

- **Root (workspace) AGENTS.md** — the canonical source of truth: house style + a map of the workspace + the working agreement. Every other AGENTS.md inherits from it.
- **Sub AGENTS.md** — a subtree's own schema, conventions, and **overrides**; the closest-to-target file wins on conflict. Write one when a subtree has rules the root doesn't capture (a tracker's data model, a closed vocabulary, a "never store derived values" rule).
- All AGENTS.md pages carry the fixed 🤖 icon (signature), regardless of surrounding house style (set via `PATCH /v1/pages/{id}` `icon: {type:'emoji', emoji:'🤖'}` — see `pages-properties.md`).

## 1. The opening is a trigger, not a summary (CSO)

The top callout must let a future agent answer **"do these rules bind me here, right now?"** — so it states **what subtree it governs + that it inherits/overrides the parent**, NOT a recap of the workflow.

- ✅ `Agent guide for the Recipes subtree. Read before any read/write here. Inherits the root workspace AGENTS.md; this file wins on conflict for its subtree.`
- ❌ `This guide explains how to add a recipe: first create the row, then set properties, then…` (a workflow dump — the agent follows the summary and skips the actual rules below).

Use words an agent will recognize/search: the subtree name, DB names, property names, the error or mistake the rule prevents.

## 2. Keep it terse (token efficiency)

An AGENTS.md is re-read into context **on every task touching its subtree.** Every token is paid repeatedly — `read_agents_md` pulls every ancestor file (root → closest) in one call on each task (it accepts any target id — page, row, block, database, or data_source), so a verbose root AGENTS.md costs tokens on every Notion operation workspace-wide.

- Tables/bullets over prose. One concrete example, not three.
- Push heavy detail (long schemas, formula source, ID lists) into **toggles or a child sub-page**, not the top level.
- **Don't repeat the root** — reference it ("conform to root house style") and only state the *overrides/additions*.

## 3. Keep it operational, not a chronicle

An `AGENTS.md` is read **in full, on every task** touching its subtree — every non-binding line taxes all of them. Apply one test per line: **does an agent need this, as text, to act correctly here, right now?**

- **Yes** → keep it. This is the binding core: house-style deltas, the current map + ids, current schema/conventions, the recurring-task procedure, current view config, red flags.
- **No, it's dated narrative** (what changed, and when) → Notion page-history / git.
  **Conditional exception — if the line (or a clause inside it) still states a rule that binds today, keep that rule, rewritten present-tense, not as a dated diff.** A line can be narrative *and* binding at once: *"Bodyweight logging moved off this page on 2026-06-19, now on a dedicated bodyweight page"* carries a live fact (where it lives now) — keep that, drop only the date. Same for *"switched from a rolling 7-day window to calendar weeks"* or *"never schedule the same muscle group within 48h (Chest was double-booked Fri→Sun)"* — both read like changelog, but each states practice still in force. Keep them as: *"Track weekly volume by calendar week, not a rolling window."* / *"Never schedule the same muscle group within 48h."*
- **No, it's general Notion-API mechanism** (a formula pattern, a rollup limitation, a formatter quirk) → one pointer line to the `notion` skill — already loaded whenever the sweep runs, so re-explaining it here adds no gate value.
- **No, it's a domain-knowledge essay** (training doctrine, nutrition science — evaluative, not operational) → a linked, **non-`AGENTS.md`** reference, opened only when the task needs it.

## 4. Bulletproof the rules (close loopholes)

Agents rationalize under pressure. For each non-negotiable, don't just state it — forbid the workaround:

- State the rule, then the specific escape it blocks: *"Never store a derived value as a static number — not 'just this once', not 'to cache it'. Only formulas/rollups."*
- Add **`Violating the letter is violating the spirit.`** once, early — it kills a whole class of "I'm following the intent" excuses.
- Iron-Law the few true non-negotiables; everything else is a normal bullet (don't inflate).
- Build a small **Red-Flags / rationalization table** from the mistakes agents actually make in *this* subtree (you'll harvest these from the test in §6).

## 5. One concern per section; match the skeleton

Mirror the workspace's existing AGENTS.md shape so any agent reads every playbook the same way: scope callout → numbered H2 sections (map · schema · conventions · working agreement). One excellent, concrete, house-style-matching example beats a generic one.

## 6. TEST it — RED → GREEN → REFACTOR (the Iron Law in practice)

Before you finalize a new AGENTS.md or land an edit:

1. **RED** — spawn a *fresh* subagent (Agent tool) given **only** this AGENTS.md (+ the root) and a representative task for the subtree (e.g. "add a recipe", "add a month"). Watch it work. Capture, verbatim, every rule it **misreads, skips, or rationalizes around.** (No baseline failure observed = you don't yet know the playbook teaches the right thing.)
2. **GREEN** — rewrite the offending rule to address that exact failure: tighten wording, close the loophole, add the missing fact. Don't add content for hypothetical failures — only the ones you saw.
3. **REFACTOR** — re-run the task with the revised page. New rationalization? Add an explicit counter (and a Red-Flags row). Repeat until it complies **under pressure** (combine time pressure + "the user's in a hurry" + a tempting shortcut).

This whole loop is a *read-only* dry run (the subagent proposes; you don't execute its writes), so it needs **no approval gate** — only the real write to the AGENTS.md page does (act-and-report per SKILL.md — no approval gate).

## Red Flags — STOP, you're writing a bad playbook

| Thought | Reality |
|---|---|
| "The opening should explain how to do the task" | That's a workflow dump — agents follow it and skip the rules. State *when it binds*, not *how*. |
| "The rule is obvious, no need to test" | Obvious to you ≠ obeyed by a fresh agent. Run the RED dry-run. |
| "I'll just add this rule, it's one line" | One-line edits are edits. Same Iron Law — test it. |
| "I'll restate the root's house style here too" | Duplication rots. Reference the root; write only the overrides. |
| "It's got a date on it, so it's changelog" | A dated line can still carry a live rule — extract the rule, drop only the date. |
| "More rules = safer" | Token bloat buries the non-negotiables. Iron-Law the few that matter; trim the rest. |
| "It reads well to me" | Reading ≠ obeying. The test is a fresh agent under pressure, not your proofread. |

## The Bottom Line

Write the AGENTS.md as a skill: a trigger-style opening, terse, bulletproofed against rationalization, matching the workspace skeleton — then **prove it** by handing it to a fresh agent and watching them comply. Untested playbook = untested rule. Non-negotiable.
