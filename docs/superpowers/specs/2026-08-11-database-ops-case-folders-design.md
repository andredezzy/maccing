# `database-ops`: case folders, kept scripts, and a credential that is never typed

Date: 2026-08-11
Skill: `skills/database/ops/SKILL.md`
Status: implemented, RED→GREEN complete (21 subagent runs)

## What prompted this

A read-only audit against a production database ran to completion under the current
skill and produced, as a by-product, seven scripts and two artifacts. The case file
recorded the SQL faithfully. Everything else it did not record at all.

Three problems fell out of that one operation, and they are related in a way the skill
does not currently name.

**The scripts vanished.** Most of the numbers in that case file came from scripts, not
from SQL — batched reads against a remote endpoint, a retry ladder, a consolidation
pass. One of those scripts was rewritten three times because the first two versions
returned a plausible zero for reasons specific to the endpoint being queried. The
corrected reasoning survived in the case file's prose. **The script that embodied it did
not survive**, so the next reader who wants to re-run the check has to rediscover the same
trap from scratch. A case that keeps its conclusions and discards its method is only half a
record.

Baseline testing later sharpened this. The skill's existing "artifact beside the case file"
rule already catches a script *sometimes* — two of three agents kept theirs unprompted, and one
deleted it as an export at close. The failure is not that method is always lost; it is that
nothing in the skill says which of the three fates a script has, so it gets a different one each
time. Unspecified, not broken.

**The artifacts had nowhere to live.** The skill currently says one file per operation,
named `YYYY-MM-DD-<slug>.md`, with any artifact placed beside it sharing the date and
slug. That works for one artifact. At two artifacts plus a scripts directory it becomes a
prefix convention doing a directory's job, and the operations directory becomes a flat
list where files belonging to one case are adjacent to files belonging to another only by
alphabetical luck.

**Two scripts carried the production connection string inline**, password included. They
were never committed, because the skill has no rule that would have kept them and they
were left in a scratch directory. Fixing the second problem by keeping scripts would
therefore have committed a production credential to a repository. **The natural fix for
the missing-method problem makes the credential problem worse**, and that is the tension
this design exists to resolve.

The credential rule already exists, incidentally. Step 0 requires that the credential
come from the secret store. Nothing in the skill says what may happen to it afterwards,
and "came from the secret store" is satisfied by pulling it correctly and then pasting it
into a shell script.

## Decisions

### 1. A case is a folder, always

```
.maccing/database/ops/
  2026-08-11-<slug>/
    case.md
    <artifact>.txt
    scripts/
      <script>.ts
```

`case.md` is a fixed name, so the entry point is at a predictable path in every case and
a reference to one never has to guess the file name. It is also fixed across languages: the
skill requires a case to keep the language it was worked in, and a fixed English entry point
means a directory of cases worked in different languages is still walkable by path alone.

**Always a folder, including for a two-minute lookup that produces nothing else.** The
alternative — flat until a second file appears, then promote — was rejected because the
skill requires the case to be opened *before the first statement*, which is exactly the
moment you do not yet know how many files the operation will produce. A conditional rule
evaluated at open time against information available only at close time resolves into a
rename mid-operation, and a rename invalidates any path already written down. One shape,
learned once, that never migrates is worth an occasionally-lonely directory.

### 2. Three kinds of artifact, three fates

The current skill has a rule that exports are deleted and a rule that a narrow before-state
snapshot is kept, and it explains the difference in a paragraph. Adding scripts to the
folder needs that distinction stated as a taxonomy rather than as an exception.

The taxonomy sorts *files*, not content. `case.md` itself is not sorted by it — the case file
contains method and evidence both, and is always kept.

| Kind | What it is | Fate |
|---|---|---|
| **Method** | script files — the thing that produced the numbers | kept, in `scripts/` |
| **Evidence** | the narrow before-state a dry run was built from, and any narrow output capture the case cites | kept, in the folder |
| **Bulk data** | wide exports, raw dumps, whole-table pulls | deleted at close, deletion recorded |

**Method that outlives the case does not live in the case.** A script written to answer *this*
question belongs in `scripts/`, where it makes the case reproducible. A script somebody will
re-run — a monthly reconciliation, a check that becomes part of the project's routine — is
project code, and it belongs wherever the project keeps its executables. The case then names
where it went instead of holding a copy; two copies of a script that is still being maintained
is the worse outcome, because the one in the case folder goes stale and nobody notices.

The test for which one you have is not the script's size or quality. It is whether anyone will
run it again on purpose. If yes, it is a deliverable that happened to be born in a case.

**A statement is method too, and it already has a home.** The skill records every statement
verbatim in `## What was run`, which is a complete method record for anything expressible as
one statement. `scripts/` is for method that is a *file* — something with control flow, retry
logic, or a batching pass, which is exactly the material that was being lost. A query does not
graduate into `scripts/` for being long; it graduates when it stops being a query.

Method and evidence are what make a case checkable later. Bulk data is a copy of
production with none of production's protections around it, and it has served its purpose
the moment the answer is written down.

The existing rules do not change; they gain a name. "Exports are deleted" is the bulk-data
row. "The before-state is kept" is the evidence row. Scripts are the row that was missing.

### 3. The credential is never typed

Step 0 extends from *where the credential came from* to *how it travels*. The rule that
matters, and the only one that held under every test: **the credential never appears as a
literal in a command, a script, or a case record.**

How it travels instead depends on one thing — whether the secret store can be asked again.

```sh
# 1. preferred, wherever the store can be called freely: nothing persists anywhere
psql "$(<secret-store command>)" -c "select ..."

# 2. where the store cannot be re-called (rate limit, audited issuance, MFA):
#    one issue, into a mode-0600 file OUTSIDE the repository, deleted at close
#    and the deletion recorded — the export lifecycle, applied to a credential
<secret-store command> > "$XDG_RUNTIME_DIR/db-url"; chmod 600 "$XDG_RUNTIME_DIR/db-url"
psql "$(cat "$XDG_RUNTIME_DIR/db-url")" -c "select ..."

# never, under any tier
psql "postgresql://user:<the actual password>@host/db" -c "select ..."
```

**Tier 2 exists because an earlier draft of this decision was unimplementable.** That draft
said "into an environment variable", full stop. An exported variable does not survive between
an agent's tool calls — each call gets a fresh shell — so an operation that needs the
credential across several commands cannot use an env var to carry it. Where the store answers
freely that is invisible, because tier 1 re-fetches every time and nothing needs carrying. Put
a rate limit on the store and the env-var-only rule forbids the only mechanism left.

Tier 2 is tightly bounded for the reason the skill already gives about exports: a credential
on disk has no access control, no audit trail, no retention policy and no expiry, and nobody
is watching it. Outside the repository so it cannot be committed, `0600` so it is not
readable, deleted at close so it does not outlive the operation, and the deletion recorded so
the next reader can tell cleanup from neglect.

This is what makes keeping scripts safe. A script in `scripts/` is committed with the
case, so a script that would be unsafe to commit is a script that was written wrong — and
the fix is the habit, not a scrubbing pass over the output.

**It also rescues the literal-record rule.** The skill says to paste the statement as
executed, not a paraphrase, because a summary is a claim and a transcript is evidence.
Taken together with a credential written as a literal in the command, that rule instructs the
operator to commit a password. The two rules are only compatible in one direction: make the
command safe, and the literal record is safe for free.

```
run:     psql "$(<secret-store command>)" -c "select ..."
record:  psql "$(<secret-store command>)" -c "select ..."
```

Identical, and publishable. **No redaction exception is introduced**, deliberately: an
exception to "record it literally" is a judgment call, judgment calls are made at the end
of long operations, and a redaction that is forgotten once is a credential in git history
forever. A command that would need redacting was run wrong.

### 4. The scan is recorded, not automated

Before the closing commit, the folder is scanned for credential material — connection
strings, key-shaped values, anything that came out of the secret store.

**This is discipline in the skill body, not a hook.** `hooks/README.md` states the rule
it must obey: no `SKILL.md` may name a file in the hooks directory, because the moment one
does, an adapter has become a requirement and the skill has stopped being portable. The
hooks know about the skills; the skills know nothing about the hooks. A scan implemented as
a git hook would also protect the wrong repository — case folders live in the project being
operated on, not in the repository that ships the skill.

It gets teeth the same way `Prior cases read` does: **its own `## Credential scan` section in
`case.md`, naming what was scanned and what came back.** An unrecorded check is
indistinguishable from a skipped one, and this skill's whole approach to discipline is to
require that the doing be written down.

**A section, not a sentence folded into `Outcome`** — for the reason `Prior cases read` is a
section rather than a clause. A missing heading is visible at a glance, in a diff and in the
rendered file; a missing sentence inside a prose paragraph is not, and the whole point of the
line is that its absence be legible. `Outcome` is also addressed to the requester, and the
scan is not for the requester — it is for whoever audits the record later.

It is named for the credential rather than for the secret store, matching Step 0's own word
("where did the credential come from?"), and it goes **last** in the template: the template
runs in the order the operation ran, and the scan is the last act before the commit.

**That closing sequence is ordered, and only one arrangement works:**

1. Delete the bulk data.
2. Scan the folder.
3. Record the scan in `## Credential scan`.
4. Commit the folder.

A scan run before the deletion did not look at the state that gets committed.

### 5. A project's old flat cases are migrated, once

Decision 1 changes the shape of a case. Projects that ran the previous version of this skill
already hold the old shape on disk — flat `YYYY-MM-DD-<slug>.md` files, some with artifacts
beside them sharing the date and slug. A format already persisted on disk is a real consumer,
so it earns a migration rather than a clean cutover.

It is a migration with an end, not a second supported shape. **The skill never describes how
to read a flat case.** It describes one shape and one conversion, and once the conversion has
run the project holds only the one shape.

```
before/                                  after/
  2026-07-30-refund-check.md               2026-07-30-refund-check/
  2026-07-30-refund-check-rows.csv           case.md
  2026-07-30-refund-check-pull.ts            rows.csv
  2026-08-02-balance-audit.md                scripts/pull.ts
                                           2026-08-02-balance-audit/
                                             case.md
```

1. `YYYY-MM-DD-<slug>.md` becomes `YYYY-MM-DD-<slug>/case.md`.
2. Every remaining file joins the case it shares a date and the **longest run of leading slug
   words** with, that shared run stripped from its name; a script among them lands in `scripts/`.
3. A file sharing no leading word with any case of its date, carrying no date, or tying between
   two cases, stays where it is and is named in the migration record. Guessing which case an
   orphan belonged to is worse than reporting that it has no owner.
4. `git mv`, so history follows each file and the whole conversion is one reviewable commit.

**Step 2 matches words, not characters, and that was a correction.** The rule first written here
moved siblings sharing the case's whole `YYYY-MM-DD-<slug>` prefix — which is how the fixture
this design was tested against happened to be named, because the fixture was invented rather
than sampled. Measured afterwards against a real archive of 177 cases and 84 sibling files, that
rule placed **38 of 84**; the rest are named for the same subject as their case and then diverge
(`<date>-<subject>-rollback.sql` beside `<date>-<subject>-balance-review.md`), so neither name is
a prefix of the other. Matching the shared leading *words* instead places **69 of 84 with
no ambiguous ties**, and the 16 that remain are genuine — no case on their date shares a subject
with them, or they carry no date at all. Reporting those is the rule working, not failing.

**No file's contents are edited, stale cross-references included.** A `Prior cases read`
section naming `2026-07-30-refund-check.md` still resolves after the migration, because the
slug is the case's identity and the slug is exactly what the two shapes share — the folder is
named what the file was named, minus the extension. Rewriting those lines would edit evidence
to correct a cosmetic path, and the record-is-literal rule has no exception for tidying.

**When.** At the point the skill already sends you into that directory: step 1 of every
operation is reading the cases the project already has. Find them in the old shape, convert
them before opening your own case. The conversion is mechanical, it happens once in a
project's life, and the alternative is a directory carrying two shapes that every later reader
has to learn. Where the directory is empty or already folders, no rule fires and nothing
happens.

**The migration is its own case**, recording what moved, what was left, and any orphan found.
It changes the project's records, and the discipline this skill rests on is that the doing gets
written down. The first folder-shaped case in a project is the one recording how the rest
became folders.

| Thought | Reality |
|---|---|
| "I will migrate after this operation" | The operation is urgent and the migration is not, so "after" is precisely the state the next agent finds: two shapes and no rule for either. |
| "These are historical records, leave them alone" | The shape is not the history; the content is. Nothing inside a case changes — only where it sits. |
| "Only the cases I touch need converting" | A half-converted directory is the two-shape problem with extra steps, and nobody can tell it from one nobody finished. |

**This is the rename decision 1 rejected, and the difference is what makes it safe.** Decision
1 refused a shape that migrates because *that* migration was unpredictable — a conditional
evaluated at open time, resolving into a rename mid-operation on a schedule nobody could see
coming. This one is a single dated event, run deliberately, recorded in a case, touching a
directory once and never again. One shape that never migrates is still the goal; reaching it
costs exactly one migration.

## Changes to `SKILL.md`

In file order. Every location where the flat layout is currently spelled out is listed, because
the phrase "under the same date and slug" appears three times and is a leftover of it in each.

| Location | Change |
|---|---|
| Frontmatter `description` | "the dated case file" becomes "the dated case folder"; the closing clause widens from deleting exports to the three fates. This is the routing surface — leaving it describing a flat file makes the skill announce a shape it no longer has |
| MANDATORY block, item 5 | "OPEN the case file" becomes the folder and its `case.md`. This is the sentence decision 1's entire argument rests on, and it is the first thing an agent reads |
| Step 0, item 2 | Extend "where the credential came from" to "and it never appears as a literal in a command, a script, or a record", then the two tiers for how it travels |
| "The case file" → opening line | "Every operation leaves a dated file" becomes a dated folder |
| "The case file" → "The record is literal" | Add the sentence tying literalness to the never-a-literal rule, and state that no redaction exception exists |
| "The case file" → shape block | Add `## Credential scan` as the final section of the template |
| "The case file" → final layout paragraph | Flat `YYYY-MM-DD-<slug>.md` becomes the folder layout above |
| "The case file" → after the layout paragraph | New: the one-time conversion of a project's old flat cases, the four mechanical steps, and the rule that no file's contents are edited by it |
| "Before Step 0 — read the cases" → rationalizations table | Three rows for deferring, skipping, or half-doing the migration. It belongs in that table because that step is where the old shape is discovered |
| "The case file" → "A finished case is committed" | The unit committed is the folder, and the closing sequence is ordered: delete, scan, record, commit |
| "Exports are deleted when done" → heading | The section now governs three fates, so the heading naming one of them is wrong. Proposed: **"What is kept, and what is deleted"** — it is the question the reader actually arrives with |
| Same section, body | Reframe around the taxonomy; scripts join as the kept-method row, with the split between method that belongs to the case and method that outlives it |
| Same section, lifecycle step 2 | "next to the case file, under the same date and slug" becomes "in the case folder" |
| Same section, before-state paragraph | "beside the case file under the same date and slug" becomes "in the case folder" |

## Explicitly not doing

- **No gitignored `data/` directory.** A directory whose correct end state is empty invites
  leaving things in it, and the deletion rule already covers bulk data.
- **No new hook, and no reference to the existing ones.** Ruled out by the portability
  constraint above.
- **No redaction tooling.** Nothing to redact once the credential never appears as a literal.
- **No rule about credential material arriving as query output.** A draft of this spec carried
  one — never `SELECT` a key-shaped column, ask for `IS NOT NULL` instead. It was cut because
  it has no failing test: across four baseline runs against a table holding `api_key` and
  `webhook_secret`, including two where the database map gave no warning about those columns,
  every agent narrowed the select unprompted and none put a secret in the record. The concern
  is real in principle and the behaviour is already reliable, so a rule would be documentation
  of something nobody does wrong. Recorded here so it is not re-added on intuition.
- **No process-table hardening.** An expanded connection string is visible in `ps` output on a
  shared machine. That is real and it is not the failure this design was written from;
  guarding it adds machinery for a threat model that is not the operator's. Considered,
  rejected on scope — though note one baseline agent split the URL into `PG*` variables for
  exactly this reason without being asked, so the concern is natural even if the rule is not
  needed.
- **No committed pattern dictionary.** The repository shipping this skill is public, and a
  curated list of what a project's secrets look like is itself a disclosure.

## Testing

Per this repository's rules, skill edits go through `superpowers:writing-skills` RED→GREEN.
The baseline arm is the *current* `SKILL.md`, not "no skill": this is an edit, so RED means a
fresh agent handed today's skill still produces the wrong behaviour.

**Every run uses a fabricated credential and a throwaway local database.** The RED state of any
credential test is, by construction, *an agent writing a working password into a file* — so the
string it writes must never have been a real one. A spec about credential handling does not get
to leave that implied.

### RED results, 2026-08-11 — 12 runs, three scenarios

The database was bound to a non-loopback address so the skill's `localhost` exemption did not
apply, and every project copy was seeded with a flat prior case, so agents pattern-matched
against the shape the skill currently prescribes.

| # | Behaviour | Result |
|---|---|---|
| 1 | The case is a folder with `case.md` | **RED, 12/12.** Every run flat. Two produced `<date>-<slug>-reconcile.py` beside `<date>-<slug>.md` — the prefix-doing-a-directory's-job pathology this spec predicted in prose |
| 2 | Method survives the close | **RED, as variance.** Of three script-writing runs: one kept it beside the case, one kept it under a different name, one recorded "the fetcher. Deleted at close." Three fates from three agents is missing guidance, not broken behaviour |
| 3 | Credential never a literal in a command, script or record | **No RED, 12/12 clean.** Nothing reached a working tree or git history under any pressure |
| 4 | Credential never in a *file* (the superseded draft rule) | **Failed 5/5** — and the rule was wrong, not the agents. See below |
| 5 | Tier 2 kept outside the repo | **RED, 1/5.** One cached it at `scratch/.dburl` *inside* the working tree, gitignored and deleted, but inside |
| 6 | Tier 2 deletion recorded in the case | **RED, 1/5.** Four recorded it; one deleted the file and wrote nothing |
| 7 | The scan is recorded | **RED, 12/12.** No run recorded a scan. One reported "leak-checked before committing" in chat and wrote nothing in the case — the unrecorded-check case this spec argues from, observed directly |

**Behaviour 4 is why decision 3 was rewritten, and it is not a RED for the new rule.** Under a
secret store that answered freely, every agent used command substitution and no credential
touched disk. Under a store rate-limited to one issue per fifteen minutes, all five wrote it to
a file — and were right to, because an exported variable does not survive between an agent's
tool calls. The draft rule forbade the only mechanism available, so the 5/5 measures a defect in
the rule rather than a failure to follow it.

**Be honest about how thin behaviours 5 and 6 are.** They are what actually justifies writing
tier 2 down, and each failed only once in five. Four of five runs bounded the file correctly
without being told. That is much weaker evidence than the 12/12 behind decisions 1 and 4, and it
means tier 2 is the part of this spec most likely to turn out unnecessary. It is written down
because the two deviations were different runs failing different halves — 2 of 5 got some part
of it wrong — and because the cost of the rule is three clauses while the cost of the miss is a
credential in a repository.

**A scenario shaped one finding, and that is worth stating.** The run that asked for a
re-runnable monthly deliverable produced four scripts in `bin/`, not in the case folder. That is
where the "method that outlives the case" split in decision 2 comes from. It is a real gap, but
it surfaced because the task named a deliverable — a one-off investigation would not have shown
it.

### The migration's own RED, 2026-08-11 — 2 runs

Behaviour 6 — the agent converts a flat ops directory before opening its own case — could not
be baselined against the old skill: with no folder rule there is nothing to migrate *to*. Its
baseline is therefore a copy of the **edited** skill with the migration paragraphs removed and
the folder rule left in.

**RED, 2/2.** Both agents created a folder beside the flat files, and both noticed. One wrote
"the three older cases are flat files; mine is a folder per the current skill. I did not reshape
them." A mixed directory, produced knowingly, for want of a rule.

### GREEN results, 2026-08-11 — 7 runs

Graded against files on disk, never the agents' self-reports.

| Behaviour | Result |
|---|---|
| Case is a folder with `case.md` | **7/7** |
| No flat case left in the directory | **7/7** |
| `## Credential scan` recorded | **7/7** |
| Credential never a literal, tree or history | **7/7** |
| Method kept in `scripts/` | **every run that wrote a one-off script** |
| Migration mechanics | **exact.** `<slug>.md`→`<slug>/case.md`, `<slug>-rows.csv`→`rows.csv`, `<slug>-pull.ts`→`scripts/pull.ts`, orphan left in place and reported, five `git mv` renames so history followed, and a separate migration case recording it |
| Method that outlives the case | the deliverable script landed in `bin/`, and the case said why: "a monthly re-run is project code and a second copy in a case folder goes stale unnoticed" |

**GREEN found a defect in decision 4, and it is fixed.** One run's first credential scan *was*
the leak: written with `grep -n` through `tee`, it copied the fixture password out of the secret
store's own file into an artifact about to be committed. The agent caught it and rewrote the
scan to report files and counts. The skill now says so up front — a scan reports where it hit,
never the line it hit — so nobody has to discover it the way that run did. A rule that records
"what came back" is a rule that will eventually record a secret.

### What the testing cost the spec

Two rules were cut for having no failing test, and one was rewritten for having the wrong
mechanism. That is the process working. The rule this design was *written from* — the credential
never typed — turned out to be the one the evidence changed most, and it changed because a
scenario was built specifically to attack it rather than to confirm it.
