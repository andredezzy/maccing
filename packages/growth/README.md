# @maccing/growth

*Campaign measurement. Exported CSVs plus a map of your own database in, one record per measured group out.*

A campaign reaches a list of people at a known moment. Afterwards someone has to say what happened, and the honest version of that sentence needs numbers: how many of the people reached already had an account, how many arrived after the send, how fast they arrived, how much of the money came from two of them, and whether the difference against a group nobody touched survives the sample sizes that produced it.

This package computes that. It knows four roles — a **person**, **revenue** arriving, **churn** leaving, a **conversion** committing — and nothing else. It does not know your schema, your product, your market's dialling plan, or what the campaign was for. All of that lives in a map file inside your project, which the engine reads and never writes.

## Install

```bash
bun add @maccing/growth
```

## The one import

```ts
import { measure } from "@maccing/growth/meta/whatsapp/campaigns/metrics";
```

`measure` is the entry point and the only one most callers need. Alongside it the module exports `load_map` and `verify_fingerprint`, for a script that wants to read or drift-check a map without measuring anything; the thresholds `WINDOW_FLOOR_HOURS`, `MIN_CONTROL_EVENTS` and `MAX_P`; the `COUNTABLE_OUTCOMES` table; every type below; and every named error, so a caller can catch by class instead of matching on a message.

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
- **`max_unparseable_rate`** — the share of person rows allowed to carry no readable number. Above it the run stops, because a dialling plan that does not describe your market and a list of people who genuinely never registered produce the same zero.
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
      cut: "2031-04-02T19:30:00.000Z",
      lists: ["campaigns/lists/evening-send.txt"],
      audience: "cold",
    },
    {
      name: "held-back",
      cut: "2031-04-02T19:30:00.000Z",
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

## The record

One `CellRecord` per cell, in declaration order. This is the first of the two the call above returns, taken ten days after the cut:

```json
{
  "cell": "evening-send",
  "cut_utc": "2031-04-02T19:30:00.000Z",
  "measured_utc": "2031-04-12T19:30:00.000Z",
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
- **`top2_share`** is the fraction of the total held by the two largest contributors, and it is `null` where the question is meaningless — nothing collected, or fewer than two contributors to compare. An average over a group where two people account for most of the money describes nobody in it, and the concentration is invisible until somebody goes looking.
- **`revenue` and `churn` appear only where the map bound them.** This record's map declares no churn role, so there is no churn branch — not a zero. Unbound and empty are different facts.
- **`conversions.new_money` and `conversions.recycled`** appear only where the map declares the split, for the same reason.
- **`measured_utc` and `window_hours`** make every reading self-dating. An undated number misleads somebody two weeks later, and the window is what makes the publishability floor mechanical instead of a habit.
- **`publishable`** is `true` only when all four hold: the test returned a p-value, that p-value is below `MAX_P`, the control carried at least `MIN_CONTROL_EVENTS`, and the window has cleared `WINDOW_FLOOR_HOURS` — seven days. An early reading that clears significance is the most confidently wrong number this engine can produce, so the floor outranks the p-value rather than qualifying it.

A control outcome must be a path to something countable. The comparison is a two-proportion test over the identifiers each cell listed, so a sum of money is not a candidate: divided by a headcount it is not a proportion, and the test would answer with a p-value that means nothing while reading as publishable. The permitted paths are exported as `COUNTABLE_OUTCOMES`, and anything else is refused by name.

## The failure philosophy

**Every ambiguity throws. Nothing degrades to zero.**

This engine's cheapest wrong answer is zero, and zero is indistinguishable from a real result. A dialling plan that does not match the market, a list file that moved, a column somebody renamed, a cut set to a planning date instead of a send time, a cell whose members were all excluded as probes — each of those produces a record full of zeros that reads exactly like a campaign nobody responded to. One of those two is a finding and the other is a bug, and by the time anyone can tell them apart the number has been in a slide deck for a week.

So the pass refuses at every point where the two are indistinguishable, and each refusal is a distinct exported class saying which one happened:

| Error | Raised when |
|---|---|
| `MapMissingError` | No map at that path, or its fingerprint points at a schema file that is not there |
| `MapSectionError` | A required section is absent, or a block the fingerprint lists is not in the schema |
| `MapFieldError` | A key is missing, unreadable, or not one the section defines |
| `MapStaleError` | The schema has changed since the map recorded its hash |
| `PhoneFormatError` | A declared numbering plan this engine cannot honour |
| `UnparseablePhonesError` | More of the person export is unreadable than the map permits |
| `MissingExportError` | A bound export, or a file a cell lists, is not where it was said to be |
| `ExportColumnError` | A column the map binds is absent from that export's header |
| `MissingColumnError` | A column a cell names is absent from its list file's header |
| `UnsupportedListFormatError` | A list in a format the reader will not guess at |
| `ExportValueError` | A bound amount column holds something that is not a number |
| `TimestampError` | A timestamp reached the parser and could not be read as a moment |
| `CellDeclarationError` | A cell cannot be measured as written — blank cut, sub-millisecond cut, duplicate name |
| `EmptyCellError` | A cell's lists yielded no usable identifier, before or after its exclusions |
| `ProvisionalCutError` | People arrived after a cut the declaration itself calls a placeholder |
| `ControlError` | A pair naming an undeclared cell, contradicting its audience, reading an outcome that is not countable, or a second control on one treated cell |

The last two are worth dwelling on. A provisional cut is a guess, so arrivals dated against it cannot be attributed to anything; the run reports zero arrivals happily and refuses the moment there is something to attribute. And two controls on one treated cell would let the last one silently win, which is a difference nobody would ever see in the output.

## Two limits worth knowing before you bind a map

**The instant resolves to the millisecond.** Event timestamps finer than that are truncated, in silence and on purpose: truncation only ever moves an instant down, towards the start of its own millisecond and never past it, so no event can change which side of the cut it falls on — provided the cut itself sits on a whole millisecond. That premise is the cut's, not the event's, which is why a cut declared finer than a millisecond is refused where cells are declared while events arriving in bulk from an export nobody controls are truncated without comment.

**The join key is built from two fixed lengths.** A number is reduced to its area code plus its trailing subscriber digits, which is what makes the same person's number collapse onto one key whether a source kept the international prefix, kept a leading trunk zero, or predates a numbering reform that inserted a digit. It also means a market whose area codes vary in length cannot be expressed this way at all — no pair of numbers describes it. That case needs a second key strategy, not different values in the table, and `make_key` refuses it by name rather than producing keys that quietly match nothing.

## Licence

MIT
