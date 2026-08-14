# @maccing/growth

*Campaign measurement. Your database or a directory of exports in, one record per measured group out.*

> **Runs on Bun 1.0 or newer, and on nothing else.** There is no Node build, and there will not be one while the engine reads files through `Bun.file`. The reasoning is under [Install](#install).

A campaign reaches a list of people at a known moment. Afterwards someone has to say what happened, and the honest version of that sentence needs numbers: how many of the people reached already had an account, how many arrived after the send, how fast they arrived, how much of the money came from two of them, and whether the difference against a group nobody touched survives the sample sizes that produced it.

This package computes that. It knows four roles — a **person**, **revenue** arriving, **churn** leaving, a **conversion** committing — and nothing else. It does not know your schema, your product, your market's dialling plan, or what the campaign was for. All of that lives in your project: you hand it a source of rows and a declaration of the groups you sent to, and it hands back what happened.

## Install

```bash
bun add @maccing/growth
```

`exports` points at TypeScript source, and Node refuses to strip types from any file under `node_modules` — on every version, by design — so importing this package there fails with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. Compiling to JavaScript would not rescue it, because the engine reads through `Bun.file` and hashes through `Bun.CryptoHasher`: the build would import cleanly under Node and then throw `Bun is not defined` on the first call, which is the worse of the two failures because it arrives later and reads like a bug in your own code. So `engines` names Bun and refuses Node outright — `"node": "<0"` is a range no release satisfies, and it is deliberate rather than a typo — which buys an `EBADENGINE` warning from npm at install time instead of a stack trace at run time.

`engines` declares a floor of Bun 1.0, which is the support commitment; this release was tested on Bun 1.3.14.

Pinning is most of why the measurement lives in a package at all. A folder with its own manifest names an exact version and holds it, so the arithmetic behind an old reading stops moving: re-running that reading reproduces it instead of re-deriving it under today's code. A consumer inside this repository depends on it by path instead — `"@maccing/growth": "file:../relative/path/to/packages/growth"` — and every caller resolving through that one manifest gets the same working copy. That is one shared version for a whole tree of callers, not a pin per caller: editing `src/` changes what a script written months ago measures the next time it runs.

While the version is `0.x` the record shape and the row contract can change on a minor bump, so pin exactly wherever a stored reading has to keep reproducing.

## The one import

```ts
import { measure } from "@maccing/growth/meta/whatsapp/campaigns/metrics";
```

`measure` is the entry point and the only one most callers need. Alongside it the module re-exports `postgres`, `files` and the `Source` type, so a caller can build a source without a second import; the thresholds `WINDOW_FLOOR_HOURS`, `MIN_CONTROL_EVENTS` and `MAX_P`, and `is_publishable`, the gate that reads them; the `COUNTABLE_OUTCOMES` table; every type below; and every named error, so a caller can catch by class instead of matching on a message.

## Where the rows come from

`measure` never opens a database and never reads a schema. It asks a `Source` for rows, four times,
by role:

```ts
type Source = { rows(role: RoleName): Promise<{ header: string[]; records: Record<string, string>[] }> };
```

Two adapters ship with the package:

```ts
import { postgres, files } from "@maccing/growth/meta/whatsapp/campaigns/source";

postgres(process.env.DATABASE_URL!, { queries: { lead: "select …", conversion: "select …" } });
files("campaigns/exports"); // lead.csv, revenue.csv, churn.csv, conversion.csv
```

`postgres` uses `Bun.sql`, which is built into the runtime this package already targets, so it costs
no dependency. `files` reads what `psql \copy` writes, which keeps the manual path open for anyone
who wants to inspect the rows a reading was built from. Anything else answering `rows` works too —
an API client, a warehouse, a fixture — and that is the point of the interface being one method.

Values are strings on the way in. That is deliberate rather than lazy: every guard in the engine
parses text, so a Postgres source cannot bypass a check a CSV source still runs, and two sources
cannot disagree about identical data.

## The row contract

Columns are named by the contract, not by your database. A query aliases to them, a CSV header
spells them.

| Role | Required columns | Optional |
|---|---|---|
| `lead` | `id`, `phone`, `created_at` | `referrer` |
| `revenue` | `lead`, `at`, `amount` | — |
| `churn` | `lead`, `at`, `amount` | — |
| `conversion` | `lead`, `at`, `amount`, `committed` | `at_fallback`, `recycled` |

`committed` and `recycled` cross the boundary as the literal strings `true` or `false`; anything
else is an error rather than being quietly read as false. This is the one place the old design lost
numbers silently — it named your product's status values, so renaming an enum member in a migration
left every reading at zero with nothing to say about it. A predicate belongs in the query that knows
the vocabulary, and its answer is a boolean.

`at_fallback` is read only where `at` is blank. Omitting `recycled` declares that the product has no
recycled-balance concept, and the record omits the breakdown rather than publishing two zeros.

`referrer` is the id of the person directly above this one in a referral network — one scalar, not a
chain, because the engine walks the tree itself and a chain does not cross a CSV cell cleanly. Any
product where one account can bring another has this column somewhere; a product where none can
omits it.
Naming it turns on the record's `referrals` block: everyone below a cell who arrived after the cut,
at any depth, with their money and contracts counted apart from the cell's own. Omitting it
declares that the product has no network, and the block is absent rather than zero.

The block is **two sibling groups and no total**, split on which side of the cut the person above
sits. `under_acquired` is a chain the campaign started — it brought somebody who brought others.
`under_pre_existing` is referring done by people who already held accounts, which they do with or
without a campaign. Each group carries its own `accounts`, `conversions` and, where those roles are
bound, `revenue` and `churn`.

There is no combined figure, on purpose: the sum is the number that lies. A control cell that
received nothing still shows a large `under_pre_existing`, because the people on it go on referring
regardless, and a single total would publish that as campaign reach. Adding the two is a decision a
caller makes in the open.

Two things the walk does that a naive one would not. It **continues through** a person who predates
the cut and only stops counting at them, because somebody who joined last month and recruited three
people last night sits between the cell and three genuine arrivals. And it indexes **every row that
carries an id**, including rows with no readable phone: a cell is found by phone, the people below
it are found by the tree, and a referral signup may never have given a number.

**Timestamps must arrive as text.** A driver turns a Postgres `timestamp without time zone` into a
`Date` by reading the stored wall clock in the *client's* timezone, so the same row becomes a
different instant on every machine that measures it — `23:49:45` is one moment in London and another
in São Paulo, with nothing to say so. The driver cannot tell you which columns were naive, because a
real `timestamptz` arrives correctly through the same path. So a `Date` reaching this boundary is
`TimestampDriverError` rather than a guess: cast it in the query, with `at::text` for a naive
`timestamp` or `to_char(at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MSZ')` for a `timestamptz`.
`files()` is unaffected — a CSV already carries text.

**A role can be unbound.** A source that answers with neither a header nor a row is saying it does
not carry that role at all, which the record distinguishes from a role that carries nothing: a
product with no withdrawals reports a churn of zero, a product with no concept of churn reports no
churn at all. `files` does this for an absent `revenue.csv` or `churn.csv`, and `postgres` for a
role its `queries` never names. Only those two may be unbound — `lead` is the index everything else
joins against, and `conversion` is the campaign.

## Phone numbers

There is nothing to configure. The key is `country:stable_national`, the market is inferred from the
numbers themselves, and reform handling is per-market: Brazil drops the `9` inserted at the head of
a mobile subscriber part, and elsewhere the national number is already stable.

This matters more than it sounds. A key that dropped the market would merge `PT:912345678` and
`BR:912345678`, and the only way to avoid that without the market is to refuse foreign numbers
outright — which silently loses every non-local lead in a multi-country campaign. Inference costs
one dependency, `libphonenumber-js`, and the measurement that justified it is in the design note:
on a real base of 10,858 accounts a hand-rolled prefix table and the library agree 99.96% of the
time, and the 0.04% is where bare 10- and 11-digit numbers live, which is exactly the population a
prefix table cannot resolve.

Two guards come with it. A list whose market distribution diverges from the lead index's beyond
`max_market_divergence` (total-variation distance, default `0.5`) is refused as
`MarketDivergenceError` — a wrong-market list parses perfectly and joins against nothing, which on
a cold list is indistinguishable from a campaign nobody answered. And a base where more than 5% of
the identifiers present cannot be keyed stops the run, because a plan that does not describe your
market and a list of people who never registered produce the same zero.

## A worked example

Two cells: one that was messaged, one held back untouched. Both lists are plain text, one identifier per line.

```ts
import { measure } from "@maccing/growth/meta/whatsapp/campaigns/metrics";
import { postgres } from "@maccing/growth/meta/whatsapp/campaigns/source";

const records = await measure({
  source: postgres(process.env.DATABASE_URL!, { queries }),
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
- **`median_lag_days`** is measured from the **cut**, not from the account's own creation: it is the days between the cut and a person's first payment counted from it, medianed over the acquired accounts that paid and rounded to one decimal. An account that arrives ten days after contact and pays the same afternoon reports ten, because what this measures is how long the money took to follow the send. A median over people rather than a mean over events, so somebody paying weekly cannot drag it, and `null` where nobody in the group paid. It appears on `acquired.revenue` only — there is no first-payment lag to take against a base that was already there, and none against money leaving.
- **`revenue` and `churn` appear only where the map bound them.** This record's map declares no churn role, so there is no churn branch — not a zero. Unbound and empty are different facts.
- **`conversions.new_money` and `conversions.recycled`** appear only where the map declares the split, for the same reason.
- **`measured_utc` and `window_hours`** make every reading self-dating. An undated number misleads somebody two weeks later, and the window is what makes the publishability floor mechanical instead of a habit.
- **`publishable`** is `true` only when all four hold: the test returned a p-value, that p-value is below `MAX_P`, the control carried at least `MIN_CONTROL_EVENTS`, and the window has cleared `WINDOW_FLOOR_HOURS` — seven days. An early reading that clears significance is the most confidently wrong number this engine can produce, so the floor outranks the p-value rather than qualifying it. Two of the three comparisons are inclusive and one is not: a control carrying exactly `MIN_CONTROL_EVENTS` and a window standing exactly on `WINDOW_FLOOR_HOURS` are inside, while a p-value sitting exactly on `MAX_P` has not cleared it. The gate is exported as `is_publishable(p, control_events, window_hours)`, so a stored reading can be asked whether a longer window would publish it without being measured again — and so the boundary a p-value can never land on in real data can still be stated in a test.

A control outcome must be a path to something countable, and to something the audience it was read against can produce. Those are one rule and one refusal. The comparison is a two-proportion test over the identifiers each cell listed, so a sum of money is not a candidate: divided by a headcount it is not a proportion, and the test would answer with a p-value that means nothing while reading as publishable. Which paths remain depends on the audience — a `cold` cell is read on `acquired.accounts`, `acquired.revenue.people` or `acquired.churn.people`, an `own_base` cell on `conversions.count` — and the message names what the pair in front of it can be read on rather than what some other pair could. `COUNTABLE_OUTCOMES` exports the union of the two, for a script that wants to check a declaration before measuring; the engine reads the per-audience table alone, because a check against the union could only refuse what the audience check was about to refuse anyway, and refusing one mistake twice sent the reader a first message naming four paths and a second taking three of them back. Both cells of the pair are checked, not just the treated one, so a `cold` cell paired against an `own_base` one is refused whichever outcome it names — the two audiences share no countable path, and the refusal says so instead of inviting a third guess. A path naming a role the map left unbound is refused too, on its own error, because that branch is absent from the record rather than zero.

The two arms must also be disjoint. A pair that names one cell on both sides, or whose lists share identifiers, is refused: a two-proportion test reads two independent samples, and a person counted in both arms is counted as evidence twice, so the control drifts towards the treated cell and whatever difference survives is an artefact of how the two lists were drawn rather than of anything that was sent. One shared identifier is enough to refuse the pair — there is no tolerance to sit under, because a control that keeps one row somebody had already been sent to is the same fault as one that keeps a hundred, only harder to see.

## What it cost, and whether you may divide by it

`measure` answers what each cell did. It never learns what the campaign cost, so a return multiple used to be arithmetic somebody did by hand beside the record. `result` does that division and says whether it stands:

```ts
import { measure, result } from "@maccing/growth/meta/whatsapp/campaigns/metrics";

const records = await measure({ source, cells, controls });
const money = result({ cells, records, cost: 497, revenue: "acquired.revenue.value" });
```

```json
{
  "revenue": "conversions.value",
  "measured": 1876.59,
  "attributable": 0,
  "cost": 386,
  "profit": -386,
  "roas": 0,
  "publishable": false
}
```

**The error it exists to stop is dividing a cost into revenue produced by people who already held accounts.** They buy again without being asked, so a campaign that reaches them and then claims what they spent is publishing the base's ordinary behaviour as its own effect. It flatters every own-base cell that ships without a control, and the flattery is large: the record above is a real campaign whose sixteen contracts all came from cells like that. `measured` is what those cells earned. `attributable` is what the declaration can support. The gap between them is the finding.

The rule is not a new judgment — it reads two things the declaration already carried:

| Cell | Attributable | Why |
|---|---|---|
| `cold` | yes | those accounts did not exist before the cut |
| `own_base` **with** a control | yes | the counterfactual exists, so the lift is readable |
| `own_base` **without** a control | **no** | nobody can say whether they bought because of the campaign |

**Which cells you hand it is a declaration, not the array `measure` got.** Leave out an untouched holdout, which earned nothing on the campaign's behalf, and leave out a cell that overlaps another — a list as handed over beside the part of it confirmed delivered counts the same people twice. Both arms of an A/B stay in: a cell on the `control` side of a copy test still received a message, and nothing in a declaration distinguishes that from a holdout, which is why the engine does not try to guess.

`profit` and `roas` come off `attributable`, never off `measured`. A profit line that counts revenue the record cannot attribute is the whole error, so the field that would carry it does not exist.

`result` is pure — it reads the records `measure` already produced and touches no database, so it runs against a stored `metrics.json` months later. It **never learns a currency and never converts one**: `cost` is in whatever unit the source reports money in, and a cost paid in another currency is divided by the rate before it gets here, in the campaign file, where the rate is visible beside the reading it belongs to.

⚠️ `publishable` here answers *may this revenue be attributed to the campaign*, which is not the question `ControlReading.publishable` answers. That one asks whether a lift cleared significance, a control-event floor and a seven-day window. A campaign can be publishable on this field and carry a control that is not, which is the honest state of most of them: the revenue is genuinely the campaign's and the effect is not yet measurable.

## The failure philosophy

**Every ambiguity throws. Nothing degrades to zero.**

This engine's cheapest wrong answer is zero, and zero is indistinguishable from a real result. A dialling plan that does not match the market, a list file that moved, a column somebody renamed, a cut set to a planning date instead of a send time, a cell whose members were all excluded as probes — each of those produces a record full of zeros that reads exactly like a campaign nobody responded to. One of those two is a finding and the other is a bug, and by the time anyone can tell them apart the number has been in a slide deck for a week.

So the pass refuses at every point where the two are indistinguishable, and each refusal is a distinct exported class saying which one happened:

| Error | Raised when |
|---|---|
| `MapMissingError` | No map at that path, or its fingerprint points at a schema file that is not there |
| `MapSectionError` | A required section is absent, or declared twice, or carries only prose where its field-and-value table should be, or carries two field-and-value tables where the parser can read only one — an unfenced worked example above the real table is the way that arrives, and it installs the example's values; or a block the fingerprint lists is not in the schema, or that block never closes and there is nothing definite to hash |
| `MapFieldError` | A key is missing, unreadable, declared twice in one table, or not one the section defines; a `models` or `valid_statuses` list with nothing in it; half of the `split`/`recycled_when` pair |
| `MapDuplicateBindingError` | The map binds `revenue` and `churn` to one export through the same person, timestamp and amount columns — a churn section written by copying the revenue one and changing the heading. Both roles then read the identical rows and the record publishes churn as an exact copy of revenue: the same money arriving and leaving, from the same people at the same instants. A shared export is allowed where any one of the three columns differs, because one file can honestly carry both directions |
| `MapStaleError` | The schema has changed since the map recorded its hash |
| `PhoneFormatError` | A declared numbering plan this engine cannot honour |
| `UnparseablePhonesError` | More of the person export — or of one cell's own lists — is unreadable than the map permits. `source` says which, so a caller does not have to read the sentence to know which file to open |
| `MissingExportError` | A bound export, or a file a cell lists, is not where it was said to be |
| `ExportColumnError` | A column the map binds is absent from that export's header |
| `MissingColumnError` | A column a cell names by hand — its phone `column`, or its `filter.column` — is absent from its list file's header |
| `DuplicateColumnError` | A CSV header naming one column twice, where something in the run reads that name: a column the map binds for a role, or the `column` or `filter.column` a cell declares — including the first column a list falls back to when it declares neither. Only the second survives into each row, so the read takes whatever the second query put there while the header check meant to catch that passes. A repeat among the columns nothing reads is measured rather than refused, and the message names what reads the one it refuses on |
| `UnterminatedQuoteError` | A quoted field that never closes, naming the line the quote was opened on. The rest of the file would otherwise disappear into that one field |
| `TextListOptionError` | A `.txt` list declared with a `column` or a `filter`, which a file of one identifier per line has nowhere to hold |
| `UnsupportedListFormatError` | A list in a format the reader will not guess at |
| `ExportValueError` | A bound amount column is empty on a row, or holding something that is not a number — the message says which of the two. A column absent from the file is `ExportColumnError`, checked against the header before any row is read |
| `ExportBlankColumnError` | A bound column is in the header but empty or unreadable on every row of an export that has rows — a timestamp nothing can be placed by, or a person export whose phone column indexes nobody. The message names which, because the consequence differs: events that never accumulate, or an audience that never matches. An export with no rows at all is a fact and passes |
| `ExportStatusError` | A conversion export with rows, not one of which carries a status the map counts as committed — every row is dropped by the status filter and the cell reads as a campaign nobody committed to |
| `ExportJoinError` | A role's export whose rows reference nobody in the person export, so the join lands on nothing and the whole file falls out of every cell. Every row in it can be well-formed and still reference nobody, which is what makes this silent in every other check. Raised ahead of the blank-column and status checks on the same file: an export bound to the wrong role usually carries one of those faults as well, and neither of their remedies can make a file that describes other things describe these people |
| `ExportRepeatedPersonError` | The person export carries the same identifier on more than one row — one row per person and wallet is the usual cause. Each copy becomes its own account, so that person arrives, pays and commits once per copy and every published figure comes out multiplied. Rows carrying no identifier are counted on neither side: a blank is a left join that matched nothing, and it already collects nothing |
| `TimestampError` | An exported timestamp reached the parser and could not be read as a moment. A *cut* that cannot be read is `CellDeclarationError` instead, so the refusal names the cell that declared it |
| `CellDeclarationError` | A cell cannot be measured as written — a cut nothing can read as a moment, blank cut, sub-millisecond cut, a cut later than the moment of reading, a cut naming a day its month does not have (the runtime rolls `2030-02-30` forward to 2 March and the record would still publish 30 February), duplicate name |
| `EmptyCellError` | A cell's lists yielded no usable identifier, before or after its exclusions. `after_exclusions` says which, because the remedies differ: a wrong column or an over-narrow filter, against an `exclude` list that swallowed everything |
| `UnmatchedBaseError` | An `own_base` cell not one of whose listed identifiers answers for an account. The declaration is the claim that these people already hold accounts, so nothing matched contradicts it and every count would publish as a base that was reached and did nothing. The same zeros on a `cold` cell are measured, because there they are the finding. Raised only where the person export built an index at all: an export with no rows leaves nothing for any cell to match, and naming the cell would send the reader to the wrong file |
| `CellExclusionError` | A cell's `exclude` names an entry that cannot be read as a number in the declared format, so it would subtract nobody and leave a probe counted as a member |
| `OverflowedTotalError` | A published money total summed past the range a number here can hold. Every row behind it is finite and passed the per-row check; the sum is what left the range, and a non-finite number serialises as `null` — the same `null` this record uses for a role the map never bound, so the overflow would read as a documented absence. The message names the record's own dotted path to the field |
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
