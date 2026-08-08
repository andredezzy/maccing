---
name: database-mapping
description: Use BEFORE the first read or write of a project's database map on ANY task that touches it, however trivial — one column rename, one new status value, one allowlist entry, or merely checking whether the map still matches the schema. Covers writing or changing `MAPPING.md`, binding schema tables and columns to the four generic roles (person, revenue, churn, conversion), the `| field | value |` grammar a parser reads, fingerprint verification and every stale-fingerprint failure, phone normalisation and match-key questions, phone-format rejections in markets whose area codes vary in length, adding or unbinding a role, and any export query the map carries. MANDATORY, never optional — "small", "quick", "obvious" or "I already know that column" is the exact trap — an unverified map computes confident numbers from a schema that has moved, and a wrong number is indistinguishable from a right one at the point where somebody acts on it. If the work touches a database map at all, load this FIRST.
---

# Database mapping — binding a schema to four roles

```
MANDATORY — before anything else, and before any clarifying question:
1. LOCATE the map. It lives at `.maccing/database/MAPPING.md` in the project
   being worked on. Read it.
2. VERIFY its fingerprint against the live schema:
   read the `## Fingerprint` table, open the schema file at the recorded path,
   extract each named model/table block in the order listed, concatenate them,
   hash the result with sha256, and compare against the recorded hash.
3. STOP if the file is absent, or if the two hashes differ. Do not compute a
   single number, do not "use the map anyway, it is probably fine". Repair the
   binding first, then rehash and record the new hash.

MAPPED = the file exists AND its fingerprint matches. Anything else routes back
to this skill before a number is produced. A written date cannot detect drift;
a hash can.
```

---

## What the map is

One markdown file per project. It describes that project's database and stops there: which table is a person, which column holds a phone, which event means value arrived, how this market writes a phone number, and one export query per role. The prose around the tables carries the reasoning — *why* a join reaches a person through an intermediate table, *why* one status counts and its neighbour does not. A parser reads only the tables; a human reads all of it.

`MAPPING.md` is uppercase because it is the document of its folder, the same convention `README.md` follows.

The map holds export queries because the data path is a one-shot manual export to local files, not a live connection. That preserves the gate around it: credentials from the secret store, the host verified before connecting, exported files deleted when the run is done.

---

## The four roles

Everything a schema is asked to supply collapses into four:

| Role | Binds | Required |
|---|---|---|
| `person` | the account entity — its id, its phone, its creation timestamp | yes |
| `conversion` | the commitment event — when it happened, its value, its state, and which states count | yes |
| `revenue` | the positive event: value arriving, in whatever form the project counts value | no |
| `churn` | the negative event: value leaving, a refund, a cancellation, an unsubscribe | no |

**Why `revenue` and `churn` are optional, and why that is not a loophole.**

`churn` is the negative event *whatever form it takes*. A project that never collects money still has a negative event — somebody unsubscribes, somebody cancels — and that project binds `churn` to it. The role is not "money going out"; money going out is one instance of it. Reaching for the monetary reading and concluding "we have no money, so no churn" is the common mistake, and it silently discards the one signal that tells you a list is being burned.

Only a project with no negative event at all leaves the role unbound. Then the emitted record **omits the role** rather than reporting zero. Unbound and empty are different facts: zero churn is a finding, no churn binding is an absence of measurement, and a record that renders them identically invites somebody to act on the second as though it were the first. The same reasoning governs `revenue`.

Binding a role you cannot honestly fill is worse than leaving it out. If the nearest column means something adjacent but not the same, leave the role unbound and say so in the prose.

---

## The grammar

The map is markdown a human reads, with tables a parser reads.

- A **section** is an `##` heading. Only these headings are read: `## Phone format`, `## Fingerprint`, `## Role: person`, `## Role: revenue`, `## Role: churn`, `## Role: conversion`.
- Under each section the parser reads the **first pipe table** whose header row is `| field | value |`. Rows are `| key | value |`. Everything else under the heading is prose, and prose is ignored.
- A value listing several items is comma-separated: `ACTIVE, COMPLETED`.
- Any `## Role:` section may carry a fenced ` ```sql ` block. It is recorded as that role's export query and **never executed** — the data path is a one-shot manual export.
- `## Role: revenue` and `## Role: churn` may be absent. `person` and `conversion` are required.
- **An unknown key inside a read table is an error, not a warning.** A typo that parses as silence is exactly how a binding goes missing without anyone noticing: the section is present, the table is present, the run succeeds, and one column was never read.

### `## Phone format`

| key | type | meaning |
|---|---|---|
| `country_code` | digits | dialled before the national number, no `+`. Dropped when present |
| `area_digits` | integer | length of the area code. Must be > 0 |
| `subscriber_digits` | integer | trailing digits that stay stable across dialling-plan reforms. Must be > 0 |
| `max_unparseable_rate` | 0..1 | abort above this share of unparseable numbers |
| `shared_account_ceiling` | integer | a phone answering for this many accounts is a switchboard, not a person, and is dropped from the index — otherwise every list containing it inherits all of them |
| `area_codes` | list, optional | allowlist of real area codes. Length alone accepts codes that do not exist |

Never inferred, never defaulted. A guessed dialling plan produces keys that look fine and match nothing.

### `## Fingerprint`

| key | type | meaning |
|---|---|---|
| `schema` | path | repo-relative path to the schema file |
| `models` | list | the model/table blocks whose text is hashed |
| `sha256` | hex | hash of those blocks, in the order listed |

List every model the map binds. A model left off the list can be renamed under the map without the hash noticing.

### `## Role: person`

| key | required | meaning |
|---|---|---|
| `export` | yes | filename inside the exports directory |
| `id` | yes | column holding the account identifier |
| `phone` | yes | column holding the phone |
| `created_at` | yes | column holding the account's creation timestamp |

### `## Role: revenue` and `## Role: churn`

| key | required | meaning |
|---|---|---|
| `export` | yes | filename inside the exports directory |
| `person` | yes | column referencing the person's id |
| `at` | yes | column holding the event timestamp |
| `amount` | yes | column holding the value |

### `## Role: conversion`

| key | required | meaning |
|---|---|---|
| `export` | yes | filename inside the exports directory |
| `person` | yes | column referencing the person's id |
| `at` | yes | column holding the commitment timestamp |
| `at_fallback` | no | used when `at` is empty on a row |
| `amount` | yes | column holding the value |
| `status` | yes | column holding the state |
| `valid_statuses` | yes | states that count as committed |
| `split` | yes | column separating new value from value that already existed in the system |
| `recycled_when` | yes | value of `split` meaning the value was already in the system rather than new |

`export` is a **filename**, never a directory and never an absolute path. The directory is supplied by whatever reads the map, at read time. A map that records a directory has started describing a machine instead of a database.

### Worked example — every value below is invented

````markdown
## Phone format

| field | value |
|---|---|
| country_code | 99 |
| area_digits | 3 |
| subscriber_digits | 7 |
| max_unparseable_rate | 0.05 |
| shared_account_ceiling | 3 |

## Role: person

| field | value |
|---|---|
| export | person.csv |
| id | id |
| phone | digits |
| created_at | created_at |

```sql
\copy (select id, regexp_replace(phone,'\D','','g') as digits, created_at from account) to 'person.csv' csv header
```
````

There is no country whose calling code is `99`; the dialling plan above is a fabrication for illustration. Read the real values off the market the project actually operates in, and write down where they came from.

---

## The phone key, generalised

Matching an external list against a user base means collapsing every way one number can be written into a single string, so both sides can be hashed once and joined. The rule, stated without a country in it:

1. Strip every non-digit, then strip leading zeros.
2. If the declared `country_code` is present as a prefix, drop it.
3. The key is the **first `area_digits` and the last `subscriber_digits`** of what remains.

**Step 3 is the part worth explaining, because it looks arbitrary and is not.** Some dialling plans insert a digit between the area code and the subscriber number — a reform adds a leading digit to mobile numbers, and the same person appears with one length in an old record and one digit longer in a new one. Both are valid. Keeping the two ends and discarding whatever sits between them collapses both writings to one key, because the reform touched the middle and left the ends alone.

Where a plan has never done this, `area_digits + subscriber_digits` equals the full national length, the middle is empty, and nothing is discarded. The same rule degenerates correctly instead of needing a second code path for the ordinary case.

Invented worked example, using the fabricated plan above — country code `99`, 3 area digits, 7 subscriber digits:

| written as | digits | after stripping zeros | after dropping `99` | key |
|---|---|---|---|---|
| `+99 481 555-0134` | `994815550134` | `994815550134` | `4815550134` | `4815550134` |
| `0099 481 9 555-0134` | `009948195550134` | `9948195550134` | `48195550134` | `4815550134` |

Ten digits and eleven digits, one key.

**What this cannot do, said plainly rather than discovered later.** A fixed `area_digits` assumes every area code in the market has the same length. That holds in a good many markets and fails in several real ones — the United Kingdom and Germany both run variable-length area codes, and no pair of fixed numbers describes them. Such a configuration must be **rejected by name**, not accommodated by picking numbers that fit most of the range: numbers that fit most of the range produce silently wrong keys for the rest. The answer is a second normalisation strategy, added when a project actually needs one — not different values in these two fields.

**On reaching for a library first.** Established phone libraries validate and format *one* number, and their comparison primitive answers "are these two the same?" pairwise. A join needs a *key*, and none of them canonicalises the two valid national lengths of one subscriber to a single string, because that is a dialling-plan fact rather than a validity fact. Use a library for validity and formatting. The key stays hand-written and stays small.

---

## Why the map is markdown and not config

Half the map's value is the reasoning, and a config file has nowhere to put it. The binding "this column is the commitment timestamp" is a third of what a reader needs; the rest is *why this column and not the one beside it*, *why this status counts*, *why the join detours through another table*. Serialise the bindings alone and the next person re-derives the reasoning from scratch, badly, or does not re-derive it and assumes.

Markdown keeps both in one artifact: tables a parser reads, prose a human reads, no drift between a config and the document explaining it, because there is only one file.

So write the prose. A map whose sections carry only tables is a config file with a different extension, and it will be wrong within two schema changes because nobody will know what the bindings were protecting.

---

## The map names no consumer

The map describes a database. It must never learn what reads it.

- **No path to any script, program or package.** Not a relative path, not an absolute one, not a home directory. Whatever reads the map is found by its own runtime's resolution rules; nothing here records where it lives.
- **No output column names.** The map says which table and column fill a role. What a reader labels the result is the reader's business, and role names are generic enough that no translation table is needed on either side.
- **No knowledge of any particular reader existing.** Two readers, or none, must make no difference to this file.

The test: if a second, entirely unrelated program started reading this map tomorrow, would a single line need changing? If yes, that line describes a consumer and does not belong here.

---

## Failure is loud

A number that cannot be parsed must never be dropped in silence.

- `max_unparseable_rate` declares a ceiling. Above it, the run **aborts** and reports the count. A misconfigured dialling plan and a genuinely unmatched list both produce zero matches, and only one of those is a result. Silence lets the first be read as the second.
- A configuration the fixed-length rule cannot express is rejected by name, not mangled.
- A stale fingerprint stops the run. It does not warn and continue.
- An unknown key in a read table is an error, not a warning.

Set `max_unparseable_rate` from what the data actually looks like, and write down the reasoning beside it. A ceiling set high enough never to fire is the same as having none.

### Errors by name

| Condition | Error |
|---|---|
| file missing | `MapMissingError` — names the path it looked for |
| a required section absent | `MapSectionError` — names the section |
| a required key absent | `MapFieldError` — names section and key |
| unknown key in a read table | `MapFieldError` — names section and key |
| `area_digits` or `subscriber_digits` < 1 | `PhoneFormatError` — states that a market with variable-length area codes cannot be expressed by fixed lengths, and that a second strategy is needed rather than different numbers |
| fingerprint mismatch | `MapStaleError` — names the schema path and both hashes |

---

## Writing or changing a map

1. Read the schema. Identify the account entity, then work outward to the events.
2. Bind `person` and `conversion`. These are required; a project that cannot fill them is not mappable yet, and saying so is the correct outcome.
3. Bind `revenue` and `churn` if an honest binding exists. Reach past the monetary reading before concluding `churn` is unavailable.
4. Establish the phone format from the market, not from a sample of the data. Add `area_codes` if the list of real codes is known — length alone accepts codes that do not exist.
5. Write one export query per bound role, selecting exactly the bound columns and nothing else.
6. Write the prose. Every non-obvious binding gets a sentence saying why.
7. Hash the named model blocks and record the fingerprint last, so it covers the schema the bindings were actually written against.

When the schema changes: re-read the affected bindings first, fix them, and only then rehash. Rehashing first turns the check into a rubber stamp — it will pass, and it will pass against bindings nobody re-read.

---

## Checklist

- [ ] The map exists at the project's `.maccing/database/MAPPING.md`.
- [ ] Its fingerprint was recomputed from the live schema and matches.
- [ ] `person` and `conversion` are bound; `revenue` and `churn` are bound or deliberately absent, with the absence explained in prose.
- [ ] `## Phone format` carries real values for this market, with `area_digits` and `subscriber_digits` both greater than zero.
- [ ] `max_unparseable_rate` is set from observed data, with its reasoning written down.
- [ ] Every bound role has an export query selecting exactly its bound columns.
- [ ] Every `export` value is a bare filename, not a path.
- [ ] No key appears that the grammar above does not define.
- [ ] The file contains no path to any consumer, and no output column names.
- [ ] Every non-obvious binding has a sentence of prose saying why.
