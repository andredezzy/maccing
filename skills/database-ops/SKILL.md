---
name: database-ops
description: 'Use BEFORE the first read or write against any non-local database, however small: a `SELECT` against production, any SQL run by hand, a single-row lookup, a support investigation touching live rows, a data fix, a schema or migration check, an export, or writing up what was done afterwards. Covers reading the prior cases first, the host-and-credential step (secret store, read or write), the dry-run-and-approval gate on every INSERT/UPDATE/DELETE, the dated case folder recording the exact query and its observed output, host identity verification, and what is kept or deleted when the work is finished. MANDATORY, never optional — "quick lookup", "obvious fix", "just a SELECT", or "it is read-only anyway" is the exact trap: those are the queries that reach production with no record and an unverified host. If the task touches live or production data at all, load this FIRST. Requires database-mapping before any operation that needs to know which table holds what.'
---

# Database Ops

```
MANDATORY — before the first statement against any non-local database, and
before any clarifying question:
1. READ the cases this project already has. A prior correction can change
   what you are about to run, which is why it comes first.
2. VERIFY the host as its own command, and read the answer back.
3. NAME where the credential came from. The secret store, or stop.
4. DECLARE read or write, now rather than after the statement is written.
5. OPEN the case folder — `YYYY-MM-DD-<slug>/case.md` — and record 1–4 in it
   before running anything.

Any one of the five you cannot complete means you are not ready to run a
statement. "Quick lookup" does not shorten this list.
```

## Overview

This skill is the discipline for operating on data that other people depend on. It is not a query cookbook and it is not tied to any one schema — the schema lives in `database-mapping`, and this skill governs how you are allowed to touch what that map describes.

The whole thing rests on one asymmetry. A read that goes wrong wastes your time. A write that goes wrong spends someone else's money, deletes someone else's history, or quietly corrupts a row that nobody notices for three months. Every rule below exists because that asymmetry is real and because the pressure to skip the rule is strongest exactly when the operation is most dangerous — late, urgent, and "obvious".

## Before Step 0 — read the cases

The first action of any operation is reading the cases that already exist, and it comes before the host check because it can change what you are about to do.

Past cases are the only place the operator's corrections are written down. When a mutation was wrong and they said so, that sentence is in a case file and nowhere else — not in the schema, not in the code, not in this skill. A directory of them is a record of every way this database has already been got wrong.

Find the ones that share a user, an operation type, or a symptom with the task in front of you. Where nothing matches, read the most recent handful anyway: the corrections are recent, and the patterns transfer further than the subject matter does.

| Signal in a past case | What it means for you |
|---|---|
| A field was changed, then reverted | Do not touch that field in a similar operation |
| The operator corrected the approach | The corrected one is the approach; the original is a trap that already caught someone |
| Rollback SQL was run | Find out why before you repeat the thing that needed rolling back |
| A "Note:" aside | A rule discovered mid-operation, which is where the real ones come from |
| Several rounds of changes | The final state is the pattern; the earlier ones are the mistakes |

### Rationalizations

| Thought | Reality |
|---|---|
| "I already know how to do this" | The cases hold corrections you have not seen. Knowing the mechanism is not knowing what went wrong last time. |
| "This is a different operation" | Corrections transfer across operation types far better than the mechanics do. |
| "I will read them if I get stuck" | Stuck is too late: by then the write has happened. Read first. |
| "There are too many to read" | Filter by relevance, then read the recent ones. Some is not none. |
| "The schema map already tells me this" | The map says what the columns are. A case says which one someone regretted touching. |

**Their values are stale; their lessons are not.** A case records an id, a balance and an ancestors array as they were on the day. Take the approach and the correction from it, and re-read every concrete value live — see the next section.

## Every fact comes from a live query

Every id, balance, status, referrer, count and relationship you state or act on comes from a `SELECT` you ran in this session against this database. Not from memory, not from training data, not from a case file's recorded values, not from inference.

This is not pedantry about sourcing. A failed read that goes unnoticed is indistinguishable from an empty result, and an agent that narrates what it expected to see rather than what it saw will build a dry run on values that never existed. The rule exists because that happened: failed file reads produced confabulated ids and an entire account hierarchy that was not there.

- **Re-query rather than recall.** Ids and balances move. Anything you are about to act on gets re-fetched, however recently you saw it.
- **A read that errored is not data.** If a query fails or returns nothing, stop and say so. Never continue as though it returned what you wanted.
- **Never invent one.** No id, username, count or history that did not come back from a statement. If you do not have it, query it or say you cannot.
- **Build the dry run from fresh state**, not from values carried down the session.

| Thought | Reality |
|---|---|
| "I saw that id earlier" | Earlier could be stale, or from the read that failed. Query it again. |
| "The case file says it is X" | The case file is history. Confirm it against the database now. |
| "That read probably worked" | If you did not see rows, you have no rows. Re-run it. |
| "I remember this account's shape" | Memory is not the database. |

## Full identifiers, full dates, one subject per query

Three habits that keep a read reviewable. They bind every statement and every sentence you write about one — the dry-run gate covers writes, and these are the failures that happen on the way to it, in material nobody thought needed a gate because nothing was being changed.

- **Show the identifier in full.** Never truncate one to `a1b2…` in a dry run, a table, a summary or a chat message. A truncated id cannot be pasted back into a query, cannot be matched against a case file, and conceals the one thing it looks like it is guarding against: two rows that differ only past the cut.
- **Show the date on every record.** The case file carries a single date and that date belongs to the operation, not to the row. A record presented bare reads as current, and "that was already fixed last month" is an argument you can only settle if the date travelled with the row.
- **One subject per query.** Never pull several subjects with `WHERE id IN (…)` and then attribute the rows by eye. Rows come back unordered and unlabelled, one subject can return three and its neighbour none, and the resulting mix-up presents as a finding rather than as an error. Query once per subject, or group and label explicitly so the attribution is in the output instead of in your head. [The wrong subject](#when-a-number-on-a-screen-disagrees-with-the-database) is the same failure seen from the far end; this is the query shape that prevents it.

## Timestamps come back as text or they come back wrong

**Read timestamp columns as text and parse them as UTC.** Where a schema stores `timestamp without time zone` holding UTC — which is the case this discipline governs — the value on the wire is digits with no offset attached, and any client that hands you a native date object has already supplied one. It supplies the *client machine's*. The digits are right; the instant they now denote is wrong, by your own distance from UTC, and the same row therefore reads differently on two laptops. `SET TIME ZONE` does not help, because the conversion happens after the value has left the server.

- Select `col::text`, and parse it as UTC.
- `NOW()` becomes `(NOW() AT TIME ZONE 'utc')::text`.
- A value that only ever crosses a text client such as `psql` is text end to end and is not at risk.

**Printing one wrong is the small failure.** The large one is feeding it back in as a window bound: the shifted bound moves the window by that offset, and every record within the offset of a boundary lands in the neighbouring interval — a whole day's batch attributed to the day before or after, from a query that returns rows, raises nothing and looks entirely well. This has been paid for three times.

## Step 0 — the mandatory first step

Do this before the first statement of any session against a non-local database. It costs about thirty seconds and it is not skippable for small operations, because "small" is not a property you can establish before you know where you are.

Answer three questions, out loud, in the case file:

1. **Which host am I on?** Not which host I intended, not which host the last command used — which host this connection actually resolves to. Verify it (see [Host verification](#host-verification)), then write the answer down.
2. **Where did the credential come from, and how does it travel?** It must come from the secret store. Not a `.env` file you found, not a connection string pasted in the scrollback, not one you remember from last week. A credential lying around in a file is a credential nobody rotated and nobody scoped, and the string in your scrollback may well point at a host that is no longer the one you want.

   Then it travels as a reference, never as a literal. **The credential's characters appear in no command, no script, and no case record** — what appears is the expression that fetches it:

   ```sh
   psql "$(<secret-store command>)" -c "select ..."
   ```

   Where the store answers freely, that is the whole rule: fetch it inside every command and nothing persists anywhere. Where the store cannot be asked twice — a rate limit, audited issuance, an MFA prompt — issue it once into a file **outside the repository**, `chmod 600`, then read from that file the same way. Delete it as part of the close and record the deletion, exactly as an export. An exported shell variable is not a carrier here: it dies with the command that set it.

   This is what lets a script be kept. A script in `scripts/` is committed with the case, so the habit is what makes it safe to commit — not a scrubbing pass afterwards.

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

## The case

Every operation leaves a dated folder. Reads included.

**Why.** An operation with no record cannot be checked afterwards by anyone, including you. When a number looks wrong next week, the only question that matters is "what exactly was run, and what came back?", and the only acceptable answer is a transcript. "I ran something like this" is not a record — it is a reconstruction from memory, produced by the person with the strongest incentive to remember it as correct. The case file also removes an entire class of argument: with the exact query and the exact output on disk, disagreements are about interpretation instead of about what happened.

**The record is literal.** Paste the statement as executed and the output as returned. Not a paraphrase, not a rounded summary, not "returned about forty rows". If the output is enormous, record the shape faithfully — the first rows verbatim, the exact total count, and how you obtained the count — and say that you truncated. A summary is a claim; the transcript is evidence.

This has no redaction exception, and needs none: a statement written per Step 0 carries the fetch expression rather than the credential, so what you ran and what you record are the same publishable line. A statement that would need redacting is one to re-run correctly, not to edit on the way into the file.

**Write it as you go.** Open the file before the first statement, with the context and what you expect to find. Update it after each phase. A case file written entirely at the end records your conclusion, not your path, and the path is where the mistakes are visible.

**It keeps the language it was worked in.** A case file is an artifact of the work rather than prose about it: it records what was asked, the exact statement, and what came back, on a date, by whoever was there. Translating one afterwards produces a paraphrase of evidence made by someone who was not present, and nobody can check a directory of that. So a case worked in Portuguese stays Portuguese, and this is not untidiness to be cleaned up later. Prose *about* the area — a reference someone maintains, a heading — is written in the project's documentation language.

**Shape:**

```markdown
# <short title>

Date: YYYY-MM-DD
Database: <the identity the server reported back, and how you verified it>
Type: read | write | both

## Prior cases read
<which cases were consulted, and one line each on what it changed about the
approach — or "nothing matched; read the most recent five">

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

## Credential scan
<the patterns scanned for, and the files and counts they matched — never the
matched lines themselves. The last thing done before the commit>
```

Drop the write-only sections when nothing was written. Keep the rest even for a two-minute lookup; a two-minute lookup that later turns out to have answered the wrong question is exactly the case you will want to reread.

**`Prior cases read` is what closes the loop.** The reading described above is real work and it is thrown away unless the file names the cases consulted and what each one changed. "Nothing matched; read the most recent five" is a result too: it tells the next agent the gap is genuine rather than unsearched, and spares them re-deriving the same reading from the whole directory.

Cases belong in the project, not in this skill — they contain that project's data. Put them in a project-local directory, one **folder** per operation; `.maccing/database/ops/` is the default if the project has no established place.

```
.maccing/database/ops/
  YYYY-MM-DD-<slug>/
    case.md          <- always this name, so the entry point is at a known path
    <artifact>.txt   <- evidence the case cites
    scripts/
      <script>.ts    <- the method that produced the numbers
```

**A folder every time**, including a two-minute lookup that produces nothing but `case.md`. The folder is opened before the first statement, which is before you can know how many files the operation will make, and a shape that depends on that answer is a shape that has to be renamed halfway through — invalidating every path already written down. `case.md` is fixed across languages too, so a directory of cases worked in different languages stays walkable by path.

**A project still holding flat `YYYY-MM-DD-<slug>.md` cases gets converted, once, before you open your own case.** You are already reading that directory — it is step 1 — and a directory carrying two shapes is one every later reader has to learn.

1. `YYYY-MM-DD-<slug>.md` becomes `YYYY-MM-DD-<slug>/case.md`.
2. Each remaining file goes to the case it shares a date and **the longest run of leading slug words** with. Strip that shared run from its name on the way in; scripts land in `scripts/`.
3. A file sharing no leading word with any case of its date, or carrying no date, stays put and is named in the migration's own case. So does one where two cases tie. An orphan reported beats an orphan guessed.
4. `git mv`, so history follows and the conversion is one reviewable commit.

Step 2 is a run of *words*, not of characters, because an artifact is usually named for the same subject as its case and then diverges: `<date>-<subject>-rollback.sql` belongs to `<date>-<subject>-balance-review.md`, and neither name is a prefix of the other. Matching on the shared subject places it; matching on a literal prefix strands it beside a directory it obviously belongs in.

Contents are never edited, stale cross-references included: a `Prior cases read` line naming `2026-07-30-refund-check.md` still resolves, because the slug is the case's identity and the folder is named exactly what the file was. Editing evidence to tidy a path is not a trade this skill makes. Where the directory is empty or already folders, there is nothing to do.

**A finished case is committed**, and the unit committed is the folder. The close runs in this order, and only this order works:

1. **Delete** the bulk data, and the credential file if Step 0 made one.
2. **Scan** the folder for credential material — connection strings, key-shaped values, anything issued by the secret store.
3. **Record** what you scanned and what came back, under `## Credential scan` — the patterns, and the matching *files and counts*. A scan reports where it hit, never the line it hit: echoing a match copies the credential into the record the scan exists to protect.
4. **Commit** the folder.

A scan run before the deletion did not look at the state that gets committed. The scan is discipline, not tooling: an unrecorded check reads exactly like a skipped one, which is why it lands in the file beside `Prior cases read` rather than in your head.

Committing is not put to the operator. An uncommitted case is a record only its author has, held on one machine, invisible to the next person who asks what was run — precisely the state the case exists to prevent, and asking permission for it only invites "not now".

## Host verification

Verify identity as its own step, before the operation, and read the answer.

**The failure this prevents:** some tools perform a login, a context switch, or a default-target resolution *as part of* running your command. When that happens, the output can describe the session you were in before, not the one you asked for — the command succeeds, prints plausible rows, and those rows come from the wrong place. Nothing about the output announces this. It looks exactly like a correct result, which is why it survives review.

Two habits close it:

- **Ask who you are as a separate command**, and look at the response. An identity check folded into the same invocation as the work can be answered by the previous context. A standalone check that you then read cannot.
- **Pin the target explicitly.** Name the host, database, project, or account in the command itself rather than inheriting whichever default is currently active. Defaults are ambient state; ambient state changes without telling you. An explicit target is wrong loudly instead of quietly.

Then record in the case file which host you verified and how you verified it. "Production" is not a host. The identity the server reported back is. `Database: Production (Neon PostgreSQL)` names an environment and a vendor, and it would read the same against every database that provider holds for you; `Database: app_prod on ep-quiet-meadow-12345, from SELECT current_database(), inet_server_addr()` names the one you were connected to and says what was asked to establish it.

## What is kept, and what is deleted

Three kinds of file come out of an operation, and each has one fate. The taxonomy sorts *files*; `case.md` is not sorted by it and is always kept.

| Kind | What it is | Fate |
|---|---|---|
| **Method** | the scripts that produced the numbers | kept, in `scripts/` |
| **Evidence** | the narrow before-state a dry run was built from, and any narrow output the case cites | kept, in the folder |
| **Bulk data** | wide exports, raw dumps, whole-table pulls | deleted at close, deletion recorded |

Method and evidence are what make a case checkable later. Bulk data is a copy of production with none of production's protections around it, and it has served its purpose the moment the answer is written down.

**A statement is method too, and it already has a home**: `## What was run`, verbatim. `scripts/` is for method that is a *file* — control flow, a retry ladder, a batching pass. A query does not graduate into `scripts/` for being long; it graduates when it stops being a query.

**Method that outlives the case does not live in the case.** A script written to answer *this* question belongs in `scripts/`. A script somebody will re-run — a monthly reconciliation, a check that joins the project's routine — is project code and belongs wherever the project keeps its executables, with the case naming where it went. The test is not size or quality: it is whether anyone will run it again on purpose. Two copies of a live script is the worse outcome, because the one in the case folder goes stale and nobody notices.

A CSV of production rows on your disk is the same data with none of the protections around it. No access control, no audit trail, no retention policy, no encryption, and no expiry — and unlike the database, nobody is watching it. It also drifts: within an hour it is a stale copy of the truth that someone may later read as though it were current.

Bulk-data lifecycle, all four steps:

1. **Export** the narrowest set of columns and rows that answers the question. Every extra column is extra exposure for no benefit.
2. **Use** it, inside the case folder.
3. **Delete** it when the operation closes. Not "eventually" — as the closing step of the operation, in the same session.
4. **Record the deletion** in the case file, naming the file that no longer exists. Otherwise the next reader sees a referenced artifact and cannot tell whether it was cleaned up or is still sitting on someone's laptop.

If the export genuinely must outlive the operation, that is a decision someone else makes explicitly, and the case file records who made it and where the file went. Silence is not that decision.

**The before-state is evidence, not bulk data, and deleting it destroys the record.** The rows as they stood, with the values the write was about to change, are what the case's own "what changed" section rests on. Narrow by construction, dated, and the only thing that lets anyone later check the undo statement was correct. Keep it in the case folder and say in `case.md` that it is kept and why. A project may record once, in one place rather than per operation, that these narrow snapshots are kept as part of its record. What is never allowed is a wide export left lying around because nobody decided anything.

## When a number on a screen disagrees with the database

A support report is almost never a database observation. Someone saw a figure in an interface, and the interface is the end of a chain: a query, a resolver, a use case, a transport, a client cache, a filter, a formatter. Any link can produce the discrepancy, and only one of them is worth a write.

So the discrepancy is not the finding — it is the beginning. Reproduce the number the *interface* produced, not the one you would compute from the tables, and walk the chain until the two answers first diverge. That is where the fault is. Three of the links deserve suspicion before the data does, because each is invisible from a `SELECT`:

- **A cache holding a pre-correction value.** The most common cause of "the balance is wrong" after somebody already fixed it, and the one no query will ever reveal.
- **A filter in the read path.** A layer that hides zeros, or one currency, or one status, makes real rows vanish from a total without touching them.
- **The wrong subject.** A near-identical username or a second account belonging to the same person answers every question correctly, about somebody else.

Only once the chain is walked and the divergence located does a data fix become the right instrument. A write made against a display bug corrupts correct data to match an incorrect screen, and it will pass every verification you write for it, because you will write them against the same wrong belief.

## `database-mapping` is a required substrate

Load the `database-mapping` skill before any operation that depends on knowing which table holds what, what a column actually means, or how two entities relate. This skill governs *how* you may touch data; that one tells you *what* you are touching.

Do not infer the schema from table names. Names lie — through renames that were never propagated, columns kept for backward compatibility, two plausible tables where only one is authoritative, and flags whose meaning inverted at some point. Guessing produces a query that runs, returns rows, and answers a different question than the one you were asked. That failure is invisible in the output and only surfaces once someone acts on the answer.

Naming the skill explicitly matters: the reach has to work in any project and any harness, with no hook, index, or auto-loading mechanism present to make the connection for you.

## Why `database-ops` and not `ops`

In the trade, "ops" means infrastructure, deployments, and being on call. This skill deploys nothing, restarts nothing, and pages nobody. A skill called `ops` therefore advertises a job it does not do — an agent looking for deployment procedure loads it and finds query discipline, and an agent about to write to production does not think to reach for it because the write is not, in the ordinary sense, an "ops" task.

`database-ops` says which ops, and it pairs by name with `database-mapping`. One tells you what the data is; the other tells you what you are allowed to do to it.
