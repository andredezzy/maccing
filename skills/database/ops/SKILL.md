---
name: database-ops
description: 'Use BEFORE the first read or write against any non-local database, however small: a `SELECT` against production, any SQL run by hand, a single-row lookup, a support investigation touching live rows, a data fix, a schema or migration check, an export, or writing up what was done afterwards. Covers the mandatory first step (which host, credentials from the secret store, read or write), the dry-run-and-approval gate on every INSERT/UPDATE/DELETE, the dated case file recording the exact query and its observed output, host identity verification, and deleting exports when the work is finished. MANDATORY, never optional — "quick lookup", "obvious fix", "just a SELECT", or "it is read-only anyway" is the exact trap: those are the queries that reach production with no record and an unverified host. If the task touches live or production data at all, load this FIRST. Requires database-mapping before any operation that needs to know which table holds what.'
---

# Database Ops

## Overview

This skill is the discipline for operating on data that other people depend on. It is not a query cookbook and it is not tied to any one schema — the schema lives in `database-mapping`, and this skill governs how you are allowed to touch what that map describes.

The whole thing rests on one asymmetry. A read that goes wrong wastes your time. A write that goes wrong spends someone else's money, deletes someone else's history, or quietly corrupts a row that nobody notices for three months. Every rule below exists because that asymmetry is real and because the pressure to skip the rule is strongest exactly when the operation is most dangerous — late, urgent, and "obvious".

## Step 0 — the mandatory first step

Do this before the first statement of any session against a non-local database. It costs about thirty seconds and it is not skippable for small operations, because "small" is not a property you can establish before you know where you are.

Answer three questions, out loud, in the case file:

1. **Which host am I on?** Not which host I intended, not which host the last command used — which host this connection actually resolves to. Verify it (see [Host verification](#host-verification)), then write the answer down.
2. **Where did the credential come from?** It must come from the secret store. Not a `.env` file you found, not a connection string pasted in the scrollback, not one you remember from last week. A credential lying around in a file is a credential nobody rotated and nobody scoped, and the string in your scrollback may well point at a host that is no longer the one you want.
3. **Does this operation read or write?** State it before you start. This is the fork in the road: reads proceed freely, writes enter the gate. Deciding which one you are doing *after* you have written the statement is how an "investigation" turns into an UPDATE without anyone approving anything.

If you cannot answer all three, you are not ready to run anything.

## Reads are free, writes are gated

SELECT is unlimited. Investigate as much as you like, from as many angles as you like — over-reading is never the failure mode. Local databases (`localhost`, `127.0.0.1`) are exempt from the gate entirely; do what you want there.

Everything that changes state — INSERT, UPDATE, DELETE, DDL, and any transaction block containing them — passes this gate:

1. **Investigate.** Read the current state of exactly the rows you intend to touch.
2. **Produce the dry run.** The exact statement you will execute; the full identifiers of every affected row; each affected value as it is now; each value as it will be afterwards; the count of rows the statement will match; and the statement that undoes it.
3. **Present it and wait.** A human approves the dry run. Not the plan, not the goal — the dry run.
4. **Execute**, unchanged. If the statement you run differs by so much as a predicate from the one that was approved, it was not approved.
5. **Verify.** Re-read the affected rows and show what they now contain.

### The dry run is the artifact being approved

This is the part that gets misunderstood, so it is worth being blunt about. When someone says "yes, fix it", they have approved an *outcome*. They have not seen the predicate. The predicate is where the damage lives: a `WHERE` clause missing one condition turns a three-row fix into a table-wide overwrite, and the outcome the approver had in mind is identical in both cases. Only the dry run distinguishes them, because only the dry run states the row count and lists the identifiers.

So the object under review is the text of the statement and the list of rows it matches. Approval of anything else — the ticket, the diagnosis, your summary of what you are about to do — is not approval of the write.

An invented example of a dry run at the right level of detail:

```
Statement:
  UPDATE account SET status = 'active' WHERE id IN ('a1b2', 'c3d4');

Matches: 2 rows (verified by running the same predicate as a SELECT first)

  id     status (now)   status (after)
  a1b2   suspended      active
  c3d4   suspended      active

Undo:
  UPDATE account SET status = 'suspended' WHERE id IN ('a1b2', 'c3d4');
```

The identifiers and values there are invented for illustration. Note the row count is *measured*, by running the identical predicate as a SELECT, rather than asserted from what you believe the data looks like.

### Rationalizations

| Excuse | Reality |
|---|---|
| "This is a one-line fix" | Row count, not statement length, decides the blast radius. One line can match every row in the table. |
| "They already asked me to fix it" | Asking for an outcome is not approving a predicate. Those are different objects. |
| "It is only seeded or throwaway data" | It is sitting in the production database, next to everything else, matched by the same `WHERE` clause. |
| "It is urgent" | Then produce the dry run quickly. Urgency compresses the writing, not the approval. |
| "I will verify afterwards" | Verification tells you what you broke. It does not unbreak it. |
| "It is just a rollback" | A rollback is a write. It gets its own dry run and its own approval. |
| "I know this schema" | Knowing the schema is not authorization, and confidence is precisely the state in which people forget a predicate. |

## The case file

Every operation leaves a dated file. Reads included.

**Why.** An operation with no record cannot be checked afterwards by anyone, including you. When a number looks wrong next week, the only question that matters is "what exactly was run, and what came back?", and the only acceptable answer is a transcript. "I ran something like this" is not a record — it is a reconstruction from memory, produced by the person with the strongest incentive to remember it as correct. The case file also removes an entire class of argument: with the exact query and the exact output on disk, disagreements are about interpretation instead of about what happened.

**The record is literal.** Paste the statement as executed and the output as returned. Not a paraphrase, not a rounded summary, not "returned about forty rows". If the output is enormous, record the shape faithfully — the first rows verbatim, the exact total count, and how you obtained the count — and say that you truncated. A summary is a claim; the transcript is evidence.

**Write it as you go.** Open the file before the first statement, with the context and what you expect to find. Update it after each phase. A case file written entirely at the end records your conclusion, not your path, and the path is where the mistakes are visible.

**Shape:**

```markdown
# <short title>

Date: YYYY-MM-DD
Host: <which database, verified how>
Type: read | write | both

## What was asked
<the request, in the requester's terms, and what would count as done>

## What was run
<each statement, verbatim, in order>

## What came back
<the output, verbatim; note explicitly if truncated and how>

## What changed
<writes only: table, row identifier, field, before, after — one line per field>
<the undo statement>

## Verification
<the post-write read, verbatim, with its output>

## Outcome
<what the requester needs to know, and any artifact created or deleted>
```

Drop the write-only sections when nothing was written. Keep the rest even for a two-minute lookup; a two-minute lookup that later turns out to have answered the wrong question is exactly the case you will want to reread.

Case files belong in the project, not in this skill — they contain that project's data. Put them in a project-local directory, one file per operation, named `YYYY-MM-DD-<slug>.md`. `.maccing/database/ops/` is the default if the project has no established place. Any artifact an operation produces goes beside its case file, sharing the date and slug.

## Host verification

Verify identity as its own step, before the operation, and read the answer.

**The failure this prevents:** some tools perform a login, a context switch, or a default-target resolution *as part of* running your command. When that happens, the output can describe the session you were in before, not the one you asked for — the command succeeds, prints plausible rows, and those rows come from the wrong place. Nothing about the output announces this. It looks exactly like a correct result, which is why it survives review.

Two habits close it:

- **Ask who you are as a separate command**, and look at the response. An identity check folded into the same invocation as the work can be answered by the previous context. A standalone check that you then read cannot.
- **Pin the target explicitly.** Name the host, database, project, or account in the command itself rather than inheriting whichever default is currently active. Defaults are ambient state; ambient state changes without telling you. An explicit target is wrong loudly instead of quietly.

Then record in the case file which host you verified and how you verified it. "Production" is not a host. The identity the server reported back is.

## Exports are deleted when done

A CSV of production rows on your disk is the same data with none of the protections around it. No access control, no audit trail, no retention policy, no encryption, and no expiry — and unlike the database, nobody is watching it. It also drifts: within an hour it is a stale copy of the truth that someone may later read as though it were current.

Lifecycle, all four steps:

1. **Export** the narrowest set of columns and rows that answers the question. Every extra column is extra exposure for no benefit.
2. **Use** it, next to the case file, under the same date and slug.
3. **Delete** it when the operation closes. Not "eventually" — as the closing step of the operation, in the same session.
4. **Record the deletion** in the case file, naming the file that no longer exists. Otherwise the next reader sees a referenced artifact and cannot tell whether it was cleaned up or is still sitting on someone's laptop.

If the export genuinely must outlive the operation, that is a decision someone else makes explicitly, and the case file records who made it and where the file went. Silence is not that decision.

**One artifact is not an export in this sense, and deleting it destroys the record.** The before-state you captured to build the dry run — the rows as they stood, with the values the write was about to change — is the evidence the case file's own "what changed" section rests on. It is narrow by construction, it is dated, and it is the only thing that lets anyone later check that the undo statement was correct. Keep it beside the case file under the same date and slug, and say in the file that it is kept and why. The rule above is about the broad pull taken to answer a question, which has served its purpose the moment the answer is written down; a project may also record, once and in one place rather than per operation, that these narrow snapshots are kept as part of its record. What is never allowed is a wide export left lying around because nobody decided anything.

## `database-mapping` is a required substrate

Load the `database-mapping` skill before any operation that depends on knowing which table holds what, what a column actually means, or how two entities relate. This skill governs *how* you may touch data; that one tells you *what* you are touching.

Do not infer the schema from table names. Names lie — through renames that were never propagated, columns kept for backward compatibility, two plausible tables where only one is authoritative, and flags whose meaning inverted at some point. Guessing produces a query that runs, returns rows, and answers a different question than the one you were asked. That failure is invisible in the output and only surfaces once someone acts on the answer.

Naming the skill explicitly matters: the reach has to work in any project and any harness, with no hook, index, or auto-loading mechanism present to make the connection for you.

## Why `database-ops` and not `ops`

In the trade, "ops" means infrastructure, deployments, and being on call. This skill deploys nothing, restarts nothing, and pages nobody. A skill called `ops` therefore advertises a job it does not do — an agent looking for deployment procedure loads it and finds query discipline, and an agent about to write to production does not think to reach for it because the write is not, in the ordinary sense, an "ops" task.

`database-ops` says which ops, and it pairs by name with `database-mapping`. One tells you what the data is; the other tells you what you are allowed to do to it.
