---
name: database-mapping
description: 'Use BEFORE the first read or write of a project''s database map on ANY task that touches it, however trivial — one column rename, one new status value, one new binding, or merely checking whether the map still matches the schema. Also use when a join built on the map returns nothing, when a phone column will not match, when a role has to be added or left unbound, or when a migration has moved something the map names. MANDATORY, never optional — "small", "quick", "obvious" or "I already know that column" is the exact trap: an unverified map computes confident numbers from a schema that has moved, and a wrong number is indistinguishable from a right one at the point where somebody acts on it. If the work touches a database map at all, load this FIRST.'
---

# Database mapping — binding a schema to four roles

```
MANDATORY — before anything else, and before any clarifying question:
1. LOCATE the map. It lives at `.maccing/database/MAPPING.md` in the project
   being worked on. Read it.
2. VERIFY its fingerprint against the live schema:
   read the `## Fingerprint` table, open the schema file at the recorded path,
   and take each named block in the order listed. A block runs from its
   `model <Name> {` **or** `enum <Name> {` line through the first following line
   that is exactly `}`, closing brace included — a schema declares the two the
   same way, and the map lists a name rather than a kind, because some of what a
   map binds is a value rather than a column. Join each block's lines with `\n`,
   then join the blocks with `\n` — no trailing newline anywhere — take the
   sha256 of those UTF-8 bytes as lowercase hex, and compare against the
   recorded hash.
3. STOP if the file is absent, or if the two hashes differ. Do not compute a
   single number, do not "use the map anyway, it is probably fine". Repair the
   binding first, then rehash and record the new hash.

MAPPED = the file exists AND its fingerprint matches. Anything else routes back
to this skill before a number is produced. A written date cannot detect drift;
a hash can.

Nothing else checks this. The parser that used to read this file was deleted and
`verify_fingerprint` went with it, so the hash is verified by whoever loads this
skill and by no program downstream. "Before a number is produced" is a rule you
keep, not one you are stopped from breaking.
```

---

## What the map is

One markdown file per project. It describes that project's database and stops there: which table is the account entity, which column holds a phone, which event means value arrived, what the phone column actually contains, and one export statement per role. The prose around the tables carries the reasoning — *why* a join reaches an account through an intermediate table, *why* one status counts and its neighbour does not. Nothing parses this file. The tables are for scanning and the prose is for trusting, and a person reads both.

`MAPPING.md` is uppercase because it is the document of its folder, the same convention `README.md` follows.

The map keeps one export statement per role because reading this data by hand is still sometimes the right thing to do — a spot check, an ops question, a sample to reason over. It is not the data path and nothing here executes it. The obligation travels with the files anyway: credentials from the secret store, the host verified before connecting, and every exported file deleted when the work is done, because those files are the entire user base with personal data in them.

---

## The four roles

Everything a schema is asked to supply collapses into four:

| Role | Binds | Required |
|---|---|---|
| `lead` | the account entity — its id, its phone, its creation timestamp | yes |
| `conversion` | the commitment event — when it happened, its value, and whether value actually changed hands | yes |
| `revenue` | the positive event: value arriving, in whatever form the project counts value | no |
| `churn` | the negative event: value leaving, a refund, a cancellation, an unsubscribe | no |

**Why `revenue` and `churn` are optional, and why that is not a loophole.**

`churn` is the negative event *whatever form it takes*. A project that never collects money still has a negative event — somebody unsubscribes, somebody cancels — and that project binds `churn` to it. The role is not "money going out"; money going out is one instance of it. Reaching for the monetary reading and concluding "we have no money, so no churn" is the common mistake, and it discards the only account the database keeps of anything leaving: with `churn` unbound, every reading of this base is arrivals-only, and a base emptying as fast as it fills looks identical to one that is growing.

Only a project with no negative event at all leaves the role unbound, and then the map says so in prose. Unbound and empty are different facts: zero churn is a finding, no churn binding is an absence of measurement, and anything that renders them identically invites somebody to act on the second as though it were the first. The same reasoning governs `revenue`.

Binding a role you cannot honestly fill is worse than leaving it out. If the nearest column means something adjacent but not the same, leave the role unbound and say so in the prose.

`revenue` and `churn` bound to the same rows is the other half of that fault, and it arrives by copy: duplicate the revenue block, change the heading, and every field still reads. Money arriving and money leaving are not the same rows. Nothing checks this — a person has to — so the two blocks are worth reading side by side once they are written. Sharing a table is fine where the two directions differ somewhere: `deposited` against `withdrew`, `opened_at` against `closed_at`, a transfer read from the payer on one side and the payee on the other.

---

## What each section carries

There is no grammar here, and no reader to trip: nothing parses this file. A section is an `##` heading. `## Role: lead`, `## Role: revenue`, `## Role: churn` and `## Role: conversion` carry the bindings, `## Fingerprint` carries the hash, and whatever else the map needs a section for it takes one. Under each role heading sits one `| field | value |` table naming, for every column that role has to answer, the database column that answers it — and beneath the table, the prose saying why that column and not the one beside it.

`lead` and `conversion` are required. `revenue` and `churn` are bound where an honest binding exists.

### The columns each role answers

| Role | Must answer | May answer |
|---|---|---|
| `lead` | `id`, `phone`, `created_at` | — |
| `revenue` | `lead`, `at`, `amount` | — |
| `churn` | `lead`, `at`, `amount` | — |
| `conversion` | `lead`, `at`, `amount`, `committed` | `at_fallback`, `recycled` |

`lead` on an event role is the account identifier from `## Role: lead` — not the event's own primary key, and not whatever intermediate key the event table happens to carry. Where an event table has no column pointing at an account, the binding is the join that reaches one and the prose explains the detour. A file emitting the intermediate key under the account's name does not join weakly; it joins not at all, and zero matches reads exactly like a population that never transacted.

`committed` and `recycled` are the two things a `conversion` row states about itself: whether value actually changed hands, and whether that value was already inside the system rather than new. Both are answers rather than columns — each is a condition over one — so the field is the answer's name and the value is the condition. **Bind the predicate, never the column underneath it.** A row carrying a raw status where the answer belongs is not `false`, it is unreadable, and anything that reads it as `false` drops rows out of every count without saying a word. Spell the values out in the prose beneath — which states of a status column mean the money arrived, which value of a payment column means the balance was already ours. Those values are this project's vocabulary, and this file is where project vocabulary belongs.

Leaving `recycled` out says the product has no recycled balance. Reporting it as zero says the product has one and none of it was used. Those are different claims and the map should not blur them; the same distinction separates an unbound `revenue` or `churn` from a measured zero.

`at_fallback` names a second column to read where `at` is blank on a row. Leave it out when there is nothing sensible to fall back to, and treat it firing as something to chase rather than shrug at.

### `## Fingerprint`

| key | type | meaning |
|---|---|---|
| `schema` | path | path to the schema file, resolved from the map's own directory and not from any repository root — a map that has to be told where the repository starts needs configuration to guard anything. An absolute path is honoured as written |
| `models` | list | the blocks whose text is hashed. A name here may be a `model` or an `enum`: the schema declares the two the same way, and the map lists a name rather than a kind |
| `sha256` | hex | hash of those blocks, in the order listed |

List every block the map binds, models and enums alike. A block left off the list can be renamed under the map without the hash noticing — and an enum is not a nicety here, because the conditions behind `committed` and `recycled` test *values* of an enum rather than columns of a model. Rename one of those values and every hashed model block stays byte-identical while the condition reading it quietly matches nothing, or reports every recycled row as value arriving fresh.

The hash covers those blocks and nothing else, joined with a single `\n`, no trailing newline, in the order `models` lists — reordering the list without rehashing produces a false mismatch. The separator is part of the rule: appending a newline to every block instead of joining them shifts the digest by one byte per block, and that fails the first time a brand-new map is checked, which is exactly the false alarm that teaches whoever wrote it to stop reading the guard.

### Writing the tables

- One table per role section, header row `| field | value |`, rows `| column | database column |`. A value listing several items is comma-separated. A second table under the same heading is a document saying two things; delete one.
- A role section may carry a fenced query block holding the export statement for that role. Nothing executes it and nothing reads it; it is written down for whoever runs an export by hand. Alias every column to the name the role answers by, so the statement and the table cannot drift apart.
- **No field naming a filename, a threshold, a ceiling or a tolerance.** Where an export lands and how much unreadable data is too much are facts about whatever is measuring, not about the database, and a table row is a binding rather than a setting. A `\copy` statement naturally names its own destination; that is the statement's business, and it is the one place a filename belongs.

---

## Phone numbers

**The map does not declare a phone key.** Collapsing every way a number can be written into one string is the job of whatever is measuring, and its rules live there. What a map owes a reader is the shape of the data those rules will meet: which column holds a number, which formats sit in it side by side, how many accounts have no number at all, and which numbers answer for many accounts at once. Write those down as counts, each attributed to the export it was taken from.

The market is resolved per number from numbering-plan metadata, so one base may carry several markets and each number keys under its own. A number written bare, carrying no calling code, falls back to the market that dominates the `lead` index.

**Why the map no longer declares a country code, an area length and a subscriber length.** That was the rule here, and it was measured against a real user base rather than argued about: fixed lengths broke 9 of 16 reform reconciliations — the same line written ten digits in an old record and eleven in a new one, which a correct key collapses to one — and invented roughly 113 accounts in countries with no users in the base at all. Fixed lengths cannot express a market whose area codes vary in length, and nothing detects that they cannot: the declared numbers look plausible, the keys come out well-formed, and they are wrong.

**The reasoning a map reader still owes, because it is the trap underneath all of it.** A leading `55` is not necessarily a country code. `55` is also a real Brazilian area code: libphonenumber's own geocoding table maps the prefix `+55 55` to Rio Grande do Sul — the state's central and north-western region, around Santa Maria — so stripping a `55` prefix on sight mutilates every number there. ([`resources/geocoding/en/55.txt`](https://github.com/google/libphonenumber/blob/master/resources/geocoding/en/55.txt), line `5555|Rio Grande do Sul`.) Length decides, not prefix, and the lengths that make length decidable are per-market facts. That is why the key comes from a numbering library rather than a prefix table anybody hand-rolls, and why a map that declared its own lengths was doing damage it could not see.

---

## Why the map is markdown and not config

Half the map's value is the reasoning, and a config file has nowhere to put it. The binding "this column is the commitment timestamp" is a third of what a reader needs; the rest is *why this column and not the one beside it*, *why this status counts*, *why the join detours through another table*. Serialise the bindings alone and the next person re-derives the reasoning from scratch, badly, or does not re-derive it and assumes.

Markdown keeps both in one artifact: tables to scan, prose to trust, and no drift between a set of bindings and the document explaining them, because there is only one file.

So write the prose. A map whose sections carry only tables is a config file with a different extension, and it will be wrong within two schema changes because nobody will know what the bindings were protecting.

---

## The map names no consumer

The map describes a database. It must never learn what reads it.

- **No path to any script, program or package.** Not a relative path, not an absolute one, not a home directory. Whatever reads the map is found by its own runtime's resolution rules; nothing here records where it lives.
- **No output column names beyond the ones the roles answer by.** Those names belong to the roles and are the same wherever the map is read; what anything labels its own results afterwards is its business.
- **No knowledge of any particular reader existing.** Two readers, or none, must make no difference to this file.

The test: if a second, entirely unrelated program started reading this map tomorrow, would a single line need changing? If yes, that line describes a consumer and does not belong here.

---

## Failure is loud

Nothing downstream enforces this file, so loudness is a property of the writing rather than of a program. Say the bad news in the map, in the place a reader will be standing when it matters.

- **A missing map, or a fingerprint that does not match, stops the work here** — at this skill, before a number is derived from it. Repair the binding first, then rehash. There is no guard behind this one.
- **A binding that cannot be filled honestly is left unbound**, with a sentence saying what was reached for and why it was not the same thing. A column meaning something adjacent is the failure this catches, and it is the only thing that catches it.
- **An identifier that is absent and an identifier that cannot be read are different facts.** A column of empty cells is people who never gave the value; a column of unreadable ones is a column being misread. Count each separately, say which export the counts came from, and where an earlier count never split them, say that rather than quoting it.
- **A value nobody checked is not a fact for having been written down.** Every column name, status and payment value in the map was read off the schema or off an export; where one was recalled instead, the map says so rather than letting it stand.

A map that reads as though everything is fine is the one to distrust. Every base has empty columns, one identifier standing for several accounts, and rows meaning something other than they look like. The map is where a reader learns that before a join teaches them.

---

## Writing or changing a map

1. Read the schema. Identify the account entity, then work outward to the events.
2. Bind `lead` and `conversion`. These are required; a project that cannot fill them is not mappable yet, and saying so is the correct outcome.
3. Bind `revenue` and `churn` if an honest binding exists. Reach past the monetary reading before concluding `churn` is unavailable.
4. Describe the phone column rather than keying it: the formats actually present, the markets present and in what proportion, how many accounts have no number, and which numbers answer for many accounts. Declare no country code and no digit lengths.
5. Write one export statement per bound role, selecting exactly the bound columns, aliased to the names the role answers by and nothing else.
6. Write the prose. Every non-obvious binding gets a sentence saying why.
7. Hash the named blocks — `model` and `enum` alike, in the order `models` lists them — and record the fingerprint last, so it covers the schema the bindings were actually written against.

When the schema changes: re-read the affected bindings first, fix them, and only then rehash. Rehashing first turns the check into a rubber stamp — it will pass, and it will pass against bindings nobody re-read.

---

## Checklist

- [ ] The map exists at the project's `.maccing/database/MAPPING.md`.
- [ ] Its fingerprint was recomputed from the live schema and matches.
- [ ] `lead` and `conversion` are bound; `revenue` and `churn` are bound or deliberately absent, with the absence explained in prose.
- [ ] The phone column is described rather than keyed: formats present, markets present and in what proportion, accounts with no number, numbers answering for many accounts — each a count, each attributed to the export it came from.
- [ ] No field anywhere declares a country code, an area length, a subscriber length, a filename, a threshold or a ceiling.
- [ ] Every bound role has an export statement selecting exactly its bound columns, each aliased to the name its role answers by.
- [ ] Each bound role's table answers every column that role must answer — an answer column by binding its condition, not the column underneath it — and names no field the role has no use for.
- [ ] The file contains no path to any consumer, and no output column names beyond the ones the roles answer by.
- [ ] Every non-obvious binding has a sentence of prose saying why.
