# @maccing/growth

*Campaign measurement. Exported CSVs plus a map of your own database in, one record per measured group out.*

> **Runs on Bun 1.0 or newer, and on nothing else.** There is no Node build, and there will not be one while the engine reads files through `Bun.file`. The reasoning is under [Install](#install).

A campaign reaches a list of people at a known moment. Afterwards someone has to say what happened, and the honest version of that sentence needs numbers: how many of the people reached already had an account, how many arrived after the send, how fast they arrived, how much of the money came from two of them, and whether the difference against a group nobody touched survives the sample sizes that produced it.

This package computes that. It knows four roles — a **person**, **revenue** arriving, **churn** leaving, a **conversion** committing — and nothing else. It does not know your schema, your product, your market's dialling plan, or what the campaign was for. All of that lives in a map file inside your project, which the engine reads and never writes.

## Install

```bash
bun add @maccing/growth
```

`exports` points at TypeScript source, and Node refuses to strip types from any file under `node_modules` — on every version, by design — so importing this package there fails with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. Compiling to JavaScript would not rescue it, because the engine reads through `Bun.file` and hashes through `Bun.CryptoHasher`: the build would import cleanly under Node and then throw `Bun is not defined` on the first call, which is the worse of the two failures because it arrives later and reads like a bug in your own code. So `engines` names Bun and refuses Node outright — `"node": "<0"` is a range no release satisfies, and it is deliberate rather than a typo — which buys an `EBADENGINE` warning from npm at install time instead of a stack trace at run time.

`engines` declares a floor of Bun 1.0, which is the support commitment; this release was tested on Bun 1.3.14.

Pinning is most of why the measurement lives in a package at all. A folder with its own manifest names an exact version and holds it, so the arithmetic behind an old reading stops moving: re-running that reading reproduces it instead of re-deriving it under today's code. A consumer inside this repository depends on it by path instead — `"@maccing/growth": "file:../relative/path/to/packages/growth"` — and every caller resolving through that one manifest gets the same working copy. That is one shared version for a whole tree of callers, not a pin per caller: editing `src/` changes what a script written months ago measures the next time it runs.

While the version is `0.x` the record shape and the map format can change on a minor bump, so pin exactly wherever a stored reading has to keep reproducing.

## The one import

```ts
import { measure } from "@maccing/growth/meta/whatsapp/campaigns/metrics";
```

`measure` is the entry point and the only one most callers need. Alongside it the module exports `load_map` and `verify_fingerprint`, for a script that wants to read or drift-check a map without measuring anything; the thresholds `WINDOW_FLOOR_HOURS`, `MIN_CONTROL_EVENTS` and `MAX_P`, and `is_publishable`, the gate that reads them; the `COUNTABLE_OUTCOMES` table; every type below; and every named error, so a caller can catch by class instead of matching on a message.

## What the map must declare

The map is a markdown file that lives with your project, not with this package. Most of it is prose — why a join goes through one table rather than another, why one status means money actually arrived — and the parser ignores all of it, reading only the `| field | value |` tables under headings it recognises. That is deliberate: the prose is the half of the document that keeps the bindings honest, so the format puts it first.

Four sections are required (`## Phone format`, `## Fingerprint`, `## Role: person`, `## Role: conversion`) and two are optional (`## Role: revenue`, `## Role: churn`). A role you leave out is a role the record omits — not one it reports as zero.

```markdown
## Phone format

| field | value |
|---|---|
| country_code | 997 |
| area_digits | 3 |
| subscriber_digits | 6 |
| max_unparseable_rate | 0.05 |
| shared_account_ceiling | 6 |

## Fingerprint

| field | value |
|---|---|
| schema | ../db/schema.prisma |
| models | Member, Movement |
| sha256 | 9f0c… |

## Role: person

| field | value |
|---|---|
| export | member.csv |
| id | member_id |
| phone | handset |
| created_at | enrolled_at |

## Role: revenue

| field | value |
|---|---|
| export | inflow.csv |
| person | member_id |
| at | arrived_at |
| amount | amount |

## Role: conversion

| field | value |
|---|---|
| export | commitment.csv |
| person | member_id |
| at | signed_at |
| amount | amount |
| status | state |
| valid_statuses | LIVE, SETTLED |
```

Everything above is invented, including the numbering plan: `997` is not a dialling code any country answers on. Fill in your own.

A few keys are worth explaining rather than listing:

- **`shared_account_ceiling`** — a number answering for this many accounts is a switchboard, a placeholder or a support desk, not a person. It is dropped from the index before any list is matched, so a cell containing it does not inherit all of them.
- **`max_unparseable_rate`** — the share of the identifiers present that may be unreadable before the run stops, because a dialling plan that does not describe your market and a list of people who genuinely never registered produce the same zero. It is checked twice against the same ceiling: once on the person export, once on each cell's own lists. Present is the operative word — a row whose identifier column is empty is an account that never gave a number or a line of somebody's export that was never dispatched to, and neither is a number the plan failed on. Both sides of the fraction count distinct things: distinct people against distinct unreadable spellings, so one sentinel repeated down a column is one unknown rather than a file of them, and a file's duplication cannot decide the verdict.
- **`at_fallback`** (conversion only, optional) — a second timestamp column to read when the primary one is empty.
- **`split`** and **`recycled_when`** (conversion only, optional, declared together or not at all) — a column and the value on it that means money already inside the system rather than new money. Products without a recycled balance leave both out and the record omits the breakdown instead of inventing one made of zeros.
- **`## Fingerprint`** — the schema file and the blocks in it the map claims to describe, plus their hash. It is checked on every run, never on request. A hash nobody checks is a written date, and a written date cannot notice that a column was renamed under the binding that names it.

An unknown key inside any of these tables is an error, not a warning. A mistyped key parses as silence, and a binding that goes missing takes a whole role's numbers with it.

## A worked example

Two cells: one that was messaged, one held back untouched. Both lists are plain text, one identifier per line.

```ts
import { measure } from "@maccing/growth/meta/whatsapp/campaigns/metrics";

const records = await measure({
  map: "campaigns/MAPPING.md",
  exports: "campaigns/exports",
  cells: [
    {
      name: "evening-send",
      cut: "2026-04-02T19:30:00.000Z",
      lists: ["campaigns/lists/evening-send.txt"],
      audience: "cold",
    },
    {
      name: "held-back",
      cut: "2026-04-02T19:30:00.000Z",
      lists: ["campaigns/lists/held-back.txt"],
      audience: "cold",
    },
  ],
  controls: [{ treated: "evening-send", control: "held-back", outcome: "acquired.accounts" }],
});
```

The `cut` is the real moment of contact — not midnight, not the date the campaign was planned. A cut earlier than the truth credits the campaign with people who arrived before anything reached them, and that is the single easiest way to publish a wrong number from this engine. Where no confirmed send time exists yet, say so with `cut_provisional: true` rather than guessing quietly.

`audience` picks what the cell can be compared on. A `cold` list has no counterfactual — nobody who has never heard of you arrives unprompted — so arrival is the effect. An `own_base` list already holds accounts and cannot arrive at all, so commitment is the effect. A control pair that contradicts this is refused, because reading it the other way round gives zero against zero, which is not a null result but a question that was never asked.

Three optional fields on a cell cover the shapes a list actually arrives in. `column` names which column of a `.csv` holds the phone, when it is not the first. `filter` cuts one cell out of a file holding several — better than splitting it into derived files, which are free to drift from the single frozen source the attribution depends on. `exclude` subtracts identifiers before measuring: planted probes and internal numbers, each of which would otherwise inflate the rate of whichever cell it landed in.

Three things about those worth knowing before you rely on them. `column` and `filter` read a `.csv`; a `.txt` list is one identifier per line, and a `column` or `filter` declared beside one is refused with `TextListOptionError` rather than ignored, because a filter that never runs measures the whole file and reports that wider population under the narrower cell's name. Both column names are checked against the file's header before any row is read — a misspelt `column` or a misspelt `filter.column` fails as `MissingColumnError` naming the file and the name that is not in it, rather than surfacing later as an empty cell. And an `exclude` entry that cannot be read as a number in your declared format fails as `CellExclusionError` naming every such entry, because an entry that yields no key subtracts nobody: the probe stays in the cell and everything it did is counted as the campaign's, so that one is the rare fault here that overstates rather than empties.

## The record

One `CellRecord` per cell, in declaration order. This is the first of the two the call above returns, taken ten days after the cut:

```json
{
  "cell": "evening-send",
  "cut_utc": "2026-04-02T19:30:00.000Z",
  "measured_utc": "2026-04-12T19:30:00.000Z",
  "window_hours": 240,
  "audience": { "listed": 40, "matched_phones": 40, "matched_accounts": 40 },
  "acquired": {
    "accounts": 28,
    "within": { "h24": 28, "d7": 28, "d30": 28 },
    "revenue": { "people": 6, "value": 360, "top2_share": 0.58, "median_lag_days": 3.5 }
  },
  "pre_existing": {
    "accounts": 12,
    "revenue": { "people": 0, "value": 0 }
  },
  "conversions": { "count": 4, "value": 500 },
  "control": {
    "against": "held-back",
    "outcome": "acquired.accounts",
    "treated_rate": 70,
    "control_rate": 45,
    "lift": 1.56,
    "control_events": 18,
    "p": 0.024,
    "publishable": true
  }
}
```

Reading it:

- **`audience`** separates three different facts. `listed` is distinct identifiers after de-duplication and exclusions; `matched_phones` is how many of them exist in your person export; `matched_accounts` is how many accounts those phones answer for, which is larger whenever somebody holds two.
- **`acquired` against `pre_existing`** is decided by the cut. An account created *before* the cut was already there; one created at the cut or after it is an arrival. An account with no creation time is placed in neither, because guessing would put it on whichever side flatters the campaign.
- **`within`** is cumulative and each boundary is inclusive: `h24` counts arrivals up to and including twenty-four hours after the cut, `d7` up to seven days, `d30` up to thirty.
- **`top2_share`** is the fraction of the total held by the two largest contributors, and it is `null` where the question is meaningless — nothing collected, fewer than two contributors to compare, or any contributor below zero. That last one is null because a part over a whole only reads as a share while every part is non-negative: a person whose refunds exceed what they paid shrinks the denominator without shrinking the two numerators, and the ratio then comes back above 1 or below 0. An average over a group where two people account for most of the money describes nobody in it, and the concentration is invisible until somebody goes looking.
- **`revenue` and `churn` appear only where the map bound them.** This record's map declares no churn role, so there is no churn branch — not a zero. Unbound and empty are different facts.
- **`conversions.new_money` and `conversions.recycled`** appear only where the map declares the split, for the same reason.
- **`measured_utc` and `window_hours`** make every reading self-dating. An undated number misleads somebody two weeks later, and the window is what makes the publishability floor mechanical instead of a habit.
- **`publishable`** is `true` only when all four hold: the test returned a p-value, that p-value is below `MAX_P`, the control carried at least `MIN_CONTROL_EVENTS`, and the window has cleared `WINDOW_FLOOR_HOURS` — seven days. An early reading that clears significance is the most confidently wrong number this engine can produce, so the floor outranks the p-value rather than qualifying it. Two of the three comparisons are inclusive and one is not: a control carrying exactly `MIN_CONTROL_EVENTS` and a window standing exactly on `WINDOW_FLOOR_HOURS` are inside, while a p-value sitting exactly on `MAX_P` has not cleared it. The gate is exported as `is_publishable(p, control_events, window_hours)`, so a stored reading can be asked whether a longer window would publish it without being measured again — and so the boundary a p-value can never land on in real data can still be stated in a test.

A control outcome must be a path to something countable, and to something the audience it was read against can produce. Those are one rule and one refusal. The comparison is a two-proportion test over the identifiers each cell listed, so a sum of money is not a candidate: divided by a headcount it is not a proportion, and the test would answer with a p-value that means nothing while reading as publishable. Which paths remain depends on the audience — a `cold` cell is read on `acquired.accounts`, `acquired.revenue.people` or `acquired.churn.people`, an `own_base` cell on `conversions.count` — and the message names what the pair in front of it can be read on rather than what some other pair could. `COUNTABLE_OUTCOMES` exports the union of the two, for a script that wants to check a declaration before measuring; the engine reads the per-audience table alone, because a check against the union could only refuse what the audience check was about to refuse anyway, and refusing one mistake twice sent the reader a first message naming four paths and a second taking three of them back. Both cells of the pair are checked, not just the treated one, so a `cold` cell paired against an `own_base` one is refused whichever outcome it names — the two audiences share no countable path, and the refusal says so instead of inviting a third guess. A path naming a role the map left unbound is refused too, on its own error, because that branch is absent from the record rather than zero.

The two arms must also be disjoint. A pair that names one cell on both sides, or whose lists share identifiers, is refused: a two-proportion test reads two independent samples, and a person counted in both arms is counted as evidence twice, so the control drifts towards the treated cell and whatever difference survives is an artefact of how the two lists were drawn rather than of anything that was sent. One shared identifier is enough to refuse the pair — there is no tolerance to sit under, because a control that keeps one row somebody had already been sent to is the same fault as one that keeps a hundred, only harder to see.

## The failure philosophy

**Every ambiguity throws. Nothing degrades to zero.**

This engine's cheapest wrong answer is zero, and zero is indistinguishable from a real result. A dialling plan that does not match the market, a list file that moved, a column somebody renamed, a cut set to a planning date instead of a send time, a cell whose members were all excluded as probes — each of those produces a record full of zeros that reads exactly like a campaign nobody responded to. One of those two is a finding and the other is a bug, and by the time anyone can tell them apart the number has been in a slide deck for a week.

So the pass refuses at every point where the two are indistinguishable, and each refusal is a distinct exported class saying which one happened:

| Error | Raised when |
|---|---|
| `MapMissingError` | No map at that path, or its fingerprint points at a schema file that is not there |
| `MapSectionError` | A required section is absent, or declared twice, or carries only prose where its field-and-value table should be; or a block the fingerprint lists is not in the schema, or that block never closes and there is nothing definite to hash |
| `MapFieldError` | A key is missing, unreadable, or not one the section defines; a `models` or `valid_statuses` list with nothing in it; half of the `split`/`recycled_when` pair |
| `MapStaleError` | The schema has changed since the map recorded its hash |
| `PhoneFormatError` | A declared numbering plan this engine cannot honour |
| `UnparseablePhonesError` | More of the person export — or of one cell's own lists — is unreadable than the map permits. `source` says which, so a caller does not have to read the sentence to know which file to open |
| `MissingExportError` | A bound export, or a file a cell lists, is not where it was said to be |
| `ExportColumnError` | A column the map binds is absent from that export's header |
| `MissingColumnError` | A column a cell names by hand — its phone `column`, or its `filter.column` — is absent from its list file's header |
| `DuplicateColumnError` | A CSV header naming one column twice. Only the second survives into each row, so a binding on that name reads the wrong column while the header check meant to catch it passes |
| `UnterminatedQuoteError` | A quoted field that never closes, naming the line the quote was opened on. The rest of the file would otherwise disappear into that one field |
| `TextListOptionError` | A `.txt` list declared with a `column` or a `filter`, which a file of one identifier per line has nowhere to hold |
| `UnsupportedListFormatError` | A list in a format the reader will not guess at |
| `ExportValueError` | A bound amount column is empty on a row, or holding something that is not a number — the message says which of the two. A column absent from the file is `ExportColumnError`, checked against the header before any row is read |
| `ExportBlankColumnError` | A bound column is in the header but empty or unreadable on every row of an export that has rows — a timestamp nothing can be placed by, or a person export whose phone column indexes nobody. The message names which, because the consequence differs: events that never accumulate, or an audience that never matches. An export with no rows at all is a fact and passes |
| `ExportStatusError` | A conversion export with rows, not one of which carries a status the map counts as committed — every row is dropped by the status filter and the cell reads as a campaign nobody committed to |
| `ExportJoinError` | A role's export whose rows are all well-formed and reference nobody in the person export, so the join lands on nothing and the whole file falls out of every cell |
| `TimestampError` | A timestamp reached the parser and could not be read as a moment |
| `CellDeclarationError` | A cell cannot be measured as written — blank cut, sub-millisecond cut, a cut later than the moment of reading, duplicate name |
| `EmptyCellError` | A cell's lists yielded no usable identifier, before or after its exclusions |
| `CellExclusionError` | A cell's `exclude` names an entry that cannot be read as a number in the declared format, so it would subtract nobody and leave a probe counted as a member |
| `ProvisionalCutError` | Something counted forward from the cut is non-zero on a cell whose own declaration calls that cut a placeholder |
| `ControlError` | A pair naming an undeclared cell, naming one cell on both sides, or whose two arms share so much as one identifier; reading an outcome neither the test nor the audience can take, in one message that names what this pair can be read on; reading a path the record does not carry; or a second control on one treated cell |

The last two are worth dwelling on. A provisional cut is a guess, so nothing dated from it can be attributed to anything: the run reports a cell with nothing counted happily — the record carries `cut_provisional` beside the numbers to say why — and refuses the moment there is something, whether that is an arrival, a commitment, or somebody already registered paying or leaving after the cut. `pre_existing.accounts` is the one count deliberately outside that test, because it partitions the audience instead of measuring an outcome: it is non-zero for practically every own-base cell, and testing it would refuse every provisional cut ever declared on one, which is the quiet case the flag exists to allow. And two controls on one treated cell would let the last one silently win, which is a difference nobody would ever see in the output.

## Two limits worth knowing before you bind a map

**The instant resolves to the millisecond.** Event timestamps finer than that are truncated, in silence and on purpose: truncation only ever moves an instant down, towards the start of its own millisecond and never past it, so no event can change which side of the cut it falls on — provided the cut itself sits on a whole millisecond. That premise is the cut's, not the event's, which is why a cut declared finer than a millisecond is refused where cells are declared while events arriving in bulk from an export nobody controls are truncated without comment.

**The join key is built from two fixed lengths, and length is what reads it.** A value is stripped to digits and its leading zeros dropped, and then the length decides: a string of exactly the national length — `area_digits + subscriber_digits`, or one longer where a reform inserted a digit — is read as a bare national number whatever it begins with, the declared country code included, because in a market whose area codes are as long as its dialling code those are the same digits. Anything longer must carry the declared country code; a longer string with some other prefix belongs to another market and gets no key at all, counting against `max_unparseable_rate` instead. The key itself is the area code plus the trailing subscriber digits, which is what collapses one person's number onto one key whether a source kept the international prefix, kept a leading trunk zero, or predates the reform.

**Discarding the middle collapses two different subscribers as willingly as one subscriber's two writings.** Two numbers agreeing on the area code and on the trailing digits and differing only in between — a national-length number and a reformed one in the same area whose tails coincide — come out as one key, and nothing in the data distinguishes that from one person written two ways. The failure is a false match rather than a missed one: a listed identifier picks up an account that was never on the list, and that account's arrivals, money and commitments are credited to the campaign. `shared_account_ceiling` only bounds it, since a collided pair sits far below any sane ceiling, and `area_codes` cannot help, because both numbers carry a real code. Count the keys holding more than one account on your own export before accepting the trade.

**A market whose area codes vary in length cannot be expressed this way at all** — no pair of numbers describes it — and that case needs a second key strategy rather than different values in the table. Nothing detects it for you. `make_key` validates the format only for being structurally usable: both lengths at least 1, the country code digits only, `max_unparseable_rate` inside 0..1, `shared_account_ceiling` at least 2. A plausible fixed length is accepted and mints silently wrong keys for every code of another length. The one refusal available is the one the author reaches for: `area_digits` declared as `0` says no number fits, and `PhoneFormatError` then names the reason and says a second strategy is needed rather than different numbers here.

## Licence

MIT — see [LICENSE](./LICENSE), which ships in the tarball.
