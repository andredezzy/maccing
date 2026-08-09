# Outsourced Dispatch Doctrine

Rules for paying a third party to send messages **for** you, on **their** numbers and **their** infrastructure. This is a different bet from sending off your own WABA, and it is governed here — not by the WhatsApp sending rules, which assume you own the number. Read this in full before briefing or paying a dispatch vendor. Project state for these campaigns lives under `.maccing/growth/meta/vendors/<vendor>/<channel>/<YYYY-MM-DD>-<slug>/` (git-tracked per Iron Law 0b).

---

## 1. Outsource or Send From Your Own WABA?

The trade is not price. It is **which asset absorbs the damage when a blast goes badly.**

| | Own WABA | Vendor |
|---|---|---|
| Numbers | Yours | Theirs |
| Practical daily ceiling | Your current tier, and no more | Far above any single tier |
| Cost of a burn | The channel — quality rating drops, tier upgrades block, ramp restarts | Money only |
| Recovery | Slow. Observed Red→Green in ~4 days of zero volume, against the documented 7–14 day protocol (7 days to recalculate, 7 more at Green/Yellow to fully clear) — see `references/sending-and-scale.md` | None needed; you buy the next campaign |
| Control | Full — templates, timing, opt-out handling, delivery data | Whatever the vendor agrees to report |

An owned number's quality rating is a **scarce, slow-to-recover asset**. It is earned over weeks of healthy ramp and lost in one bad list.

**Decide by volume and list temperature:**

| Situation | Route |
|---|---|
| Warm, opted-in, engaged list; volume within your tier | Own WABA |
| Cold list, unknown consent, or volume far above your tier | Vendor |
| A test whose failure mode is high block/report rates | Vendor — never spend your rating to learn this |
| Anything requiring reply handling or a free 24h window | Own WABA — a vendor cannot hand you the conversation |

---

## 2. The Unit-Price Finding

Outsourced dispatch is **not** automatically more expensive per message. Check the ratio before assuming it is a premium.

The check is one division. Take the vendor's flat fee, divide it by the sends it buys, and compare the result against your own cost per delivered message derived from the current rate card. Where a vendor sells bulk volume at a flat fee, the per-send figure can land *below* the owned-channel CPDM. When it does, the finding is not that messages got cheaper — what the money buys is **volume and risk transfer**, and a favourable unit price is a side effect of the vendor's own scale, not a discount you negotiated. §4 works the arithmetic on invented inputs.

Two caveats on the comparison:

- Vendor price is per **send**; CPDM is per **delivered** message. A vendor's real cost per delivered message is higher by its undelivered share, which you usually cannot audit.
- CPDM is currency-specific and moves with the rate card. Re-derive both sides from the current ledger before comparing (the `growth` skill, `references/cost-tracking.md` §6). Never carry a figure from a past campaign forward as today's number.

---

## 3. Attribution: Cross-Reference the Phone Against the Segment File

A vendor cannot be trusted to report conversions, and a delivery report says nothing about revenue. Build attribution so it depends on neither the vendor nor the link.

**Default method — match the signup phone back to the file it was dispatched from:**

```
signup phone → which segment file contained it → which cell
```

The phone identifies the cell no matter what the link did. Nothing has to survive a redirect, and no new accounts are needed.

| | One account per template | Phone × segment cross-reference |
|---|---|---|
| New accounts needed | one per cell | none |
| Survives a dropped ref | no | **yes** |
| Depends on vendor reporting | no | no |
| Requires | ref preserved end to end | segment files frozen after dispatch |

**The decisive advantage** is the failure that already happened. A silently dropped ref put leads on the default account; they had to be reassigned by hand, and a multi-template split test would have been unmeasurable. Per-template accounts cannot see that failure — the leads simply are not there. Phone matching recovers all of it, because the phone still says which cell the contact was in.

**Its one requirement is hard: freeze the segment files after dispatch.** Re-splitting, re-ordering, or de-duplicating them destroys the phone→cell map and voids the whole experiment. Commit the dispatched files unchanged and treat them as read-only from the moment the vendor receives them. There is no way to reconstruct the mapping afterwards.

**Still verify the click path before dispatch:** short link → landing page → signup. Confirm the ref param survives every hop. Attribution now survives a dropped ref, but the product's own attribution does not — a broken ref still costs you the link between a signup and its source *inside* the product, even when the measurement holds. Test one real end-to-end signup per cell and check where it landed, before a single message goes out.

Per-template ref accounts remain a valid second layer when you want the product's own attribution split by cell as well. They are no longer the primary method.

---

## 4. Worked Example — Reading a Blast

**Every number in this section is invented.** They exist to show which quantities you divide by which, and in what order. None of them is a measurement, none is a benchmark, and none should be planned against. Substitute your own inputs and rerun the arithmetic.

Take one vendor campaign, one template, one consumer funnel, with these invented inputs:

| Input | Invented value |
|---|---|
| Fee paid | 6,000 |
| Messages the vendor reports as sent | 12,000 |
| Delivered share the vendor will evidence | 90%, so 10,800 delivered |
| New signups matched back to the dispatched files (§3) — arrival, `acquired.accounts` in §10's record | 120 |
| Of those, that converted downstream — `conversions.count` in the same record | 20 |
| Revenue from those 20 | 15,000 |
| Payments after the send date by contacts already registered before it | 9,000 |

Six readings follow, and the order matters — each one narrows the population of the one above it:

| Reading | Arithmetic | Invented result |
|---|---|---|
| Cost per send | 6,000 ÷ 12,000 | 0.50 |
| Cost per **delivered** message | 6,000 ÷ 10,800 | 0.56 |
| Signup rate | 120 ÷ 12,000 | 1.0% |
| Cost per signup | 6,000 ÷ 120 | 50 |
| Cost per conversion | 6,000 ÷ 20 | 300 |
| Attributed ROAS | 15,000 ÷ 6,000 | 2.50x |
| Wide ROAS | (15,000 + 9,000) ÷ 6,000 | 4.00x |

Cost per delivered message is the honest unit price and cost per send is the one the invoice implies; quote the first and keep the second only to show the gap. Cost per conversion is the number that decides whether the channel pays, because it is the only one that has met the product.

### The two ROAS readings are not equally trustworthy

| Figure | Counts | Status |
|---|---|---|
| **Attributed ROAS** | Revenue from accounts that did not exist before the send | **Attributed. Budget on this one.** |
| Wide ROAS | The above, plus every payment made after the send date by a contact who was already registered | Loosely attributed. Never plan against it. |

The wider figure counts money that arrived **after** the campaign, not money that arrived **because** of it. Two facts routinely break the causal reading, and both are worth checking on every campaign:

- **A handful of people carry the gap.** Compute the share of the extra revenue held by the top two or three contributors before you quote the multiple. Where a small number of large-ticket accounts carry most of it, those accounts were plausibly going to pay anyway, and the campaign is being credited with their ordinary behaviour.
- **The sample was not random.** Contacts who are simultaneously present in a purchased cold list *and* already registered with you are a strange intersection, not a representative slice. Their payment rate does not extrapolate to a list of dormant users, and it does not extrapolate to the cold list either.

Budget on the attributed figure. Report the wide one if you like, labelled as loosely attributed, and never size a campaign against it.

### The insight that does survive

A list salted with dormant registered users behaves differently from a list of strangers, and that share is worth knowing **before** you buy. Ask the vendor what overlap to expect, and match the list against your own users after the campaign. Just do not book the reactivation revenue as revenue the campaign earned.

### General rule — report the concentration, not just the multiple

When a campaign's ROAS leans on a handful of large tickets, publish the conversion count and the top-N share next to the number. A few people carrying most of the return is a fact about those few people, not a fact about the channel. A multiple built on a single-digit number of observations will not repeat, and budgeting on it buys the next campaign at a large multiple of its real expected return. The measurement contract in §10 emits that share beside the revenue total for exactly this reason, so it cannot be left out by accident. Read it as a number only when it is one: the engine reports null instead where the group has no whole to take a share of, and §10 lists the three cases.

---

## 5. Designing the Split Test

A vendor blast is an experiment. Most of its value is lost to bad design, not to a bad template.

**One variable per cell, all read against a single control.** An interaction cell (copy × photo) measures a second-order effect. It needs the most statistical power, and this kind of campaign has the least, so it returns noise that reads as signal. Spend that cell on another single-variable contrast instead.

**Identical audience mix in every cell.** Sort the pool by quality tier and deal round-robin, so every cell lands within one lead of the same composition. Using the invented split from §4, the target is five cells of 2,400 whose per-tier counts differ by at most one and whose source bases hold the same proportion in every cell. Without this, a difference between cells may be the list rather than the template — which is the entire experiment. Have the build script **assert** the balance and refuse to emit unbalanced files.

**Hold the confounders still.** Same opener, same structure, same button, same opt-out line, same dispatch hour across all cells. If a variant changes both facts and framing, it measures neither.

**When the control is a known winner, keep it verbatim** — including the parts you believe are wrong. Correcting the control turns a controlled comparison into an indicative one. Put the correction in a variant cell, where it becomes a measurable question instead of an unrecorded assumption.

---

## 6. Statistical Power, and Why You Must Demand Clicks

The single highest-leverage ask in the vendor brief, and it costs nothing.

Continuing the invented example: at a 1.0% signup rate, five cells of 2,400 sends yield about 24 signups each. That is what such a cell can detect:

| Primary metric | Base rate | Min. detectable difference | At 80% power |
|---|---|---|---|
| Signups | 1.0% | **+56%** | +81% |
| Clicks | ~5% | +25% | +35% |
| Clicks | ~8% | **+19%** | +27% |

Two consequences, stated plainly:

1. **Demand per-segment click counts in the vendor contract.** Moving the primary metric from signups to clicks roughly triples sensitivity for zero extra spend. Signups stay the **decision** metric; clicks become the **reading** metric.
2. **Do not kill a variant on a small difference.** "B beat A by 20%" at a cell of a couple of thousand is noise. Only large effects are legible at this scale — which is fine, because template-level effects usually are.

Redo the numbers for your own rates:

```
MDE ≈ 1.96 × √2 × √(p(1−p)/n) ÷ p
```

`p` = base rate, `n` = cell size. The result is a **relative** lift, two-sided at 95% confidence. That form carries the z_α term only, so it is a 50%-power figure — the honest planning number. For 80% power multiply by `(1.96 + 0.84) / 1.96 ≈ 1.43`, which is the last column above.

---

## 7. Verify the Copy Against the Product Before Dispatch

Observed, and expensive: a vendor campaign ran copy describing **a different product entirely** — a sibling product that had been wound down. Every specific was wrong. It converted anyway, so nobody caught it. The only element that matched the real product was the image.

This matters beyond honesty. The copy promised terms the live product does not offer. A promise like that breaks at the user's first attempt to use it — a churn mechanism sitting immediately downstream of the metric everyone watches, and a live candidate for why so few signups ever convert into paying customers.

**Before dispatch, verify every concrete claim against the code or the live site, and cite the source per claim:**

| Claim class | Verify against |
|---|---|
| What the user gets, and on what terms | The logic in code, not a deck and not memory |
| When it happens — timings, schedules, waiting periods | The live product, walked end to end |
| What it costs them — prices, fees, deductions | The live product, not a deck |
| Minimums, limits, and eligibility | Config or the signup flow |
| Any headline number or percentage | Whichever of the above defines it |

**Reused copy from a sibling product is the specific trap.** The structure survives the move; the facts do not. Treat any inherited template as unverified until every number in it has a source.

---

## 8. Non-Negotiables Checklist

Every item below is a real gap a campaign left behind. Run all eight.

- [ ] **Save the exact copy before dispatch.** Into `templates.md` in the campaign folder. A lost template means you cannot tell what was said, so you cannot repeat a winner or diagnose a burn.
- [ ] **Wire attribution to the phone, and freeze the segment files** (§3). Verify the click path end to end before any send. Never re-split, re-order, or de-duplicate a dispatched file.
- [ ] **Verify every concrete claim against the product** (§7). Terms, timings, costs, minimums and limits, headline numbers — each with a cited source.
- [ ] **Apply suppression before splitting the list.** Never send to someone who opted out of your own channel. Never blindly re-send to a list a previous vendor already burned. Suppress first, then split into segments — suppressing afterwards skews the split.
- [ ] **Exclude the audience your own business has already failed.** Where a product was wound down or a promise was not kept, the people who paid for it are the highest-complaint audience that exists, and on WhatsApp a report is one tap. Exclude them by default. This is a reading problem as much as a deliverability one: a campaign can hit its acquisition target while the people it reached are people the business has already let down, and a result read without that context flatters the channel. Record what share of each cell came from that group, so the reading carries it. Two rules make the exclusion actually work:
  - **Aggregate money per person, not per account row.** Observed defect: the exclusion judged one account row at a time, and a single contact can hold several account rows — so a person reads as having come out behind only once their rows are summed. One zeroed second account launders them back in as "never paid". Aggregate on the contact key (phone) before classifying.
  - **The exclusion follows the person across lists.** If a burned contact also appears in a clean second source, they stay out. The complaint risk belongs to the person, not to the list they arrived on.
- [ ] **Spend the finite source first.** When lists come from more than one base, they are rarely equally replaceable. Observed: one source had been almost entirely consumed by a previous blast and its fresh intake had collapsed to a trickle, while the other still held a large surplus. Use the finite source **whole** and let the surplus source absorb the shortfall — it is the only one that should be ranked down on quality.
- [ ] **Record price and send date the day it runs.** Ledger row per the `growth` skill's `references/cost-tracking.md`; campaign README updated the same turn. Record how many usable leads remain in each base after the campaign — where every base is dead or dying, the channel itself has a countdown. Write that down before it is a surprise.
- [ ] **Demand opt-out and complaint counts as part of the vendor report.** Agree this before paying, alongside per-segment click counts (§6). A vendor that only reports sends and reads is hiding the number that predicts the next campaign's performance.

---

## 9. A Vendor Is Not a Firewall

Your brand and your domain travel **inside** the vendor's messages, and Meta correlates entities across them. A vendor blast can still splash back on your own assets.

Observed: a display-name rejection on an owned asset turned out to be **entity correlation**, not a site problem — the brand had been carried by traffic the owned asset never sent.

- Record the correlation risk per vendor in `meta/vendors/<vendor>/README.md`, alongside price and channel.
- Do not assume isolation. Outsourcing moves the **number** off your books, not the **brand**.
- If an owned asset gets rejected or restricted shortly after a vendor campaign, treat correlation as a live hypothesis before debugging the asset itself.

---

## 10. The Measurement Contract

Everything above decides what to send and to whom. This section decides how the result is read. It is deliberately narrow: one implementation, one shape of declaration, and a short list of refusals.

**The machinery is a package.** It is `@maccing/growth`, imported at the subpath `@maccing/growth/meta/whatsapp/campaigns/metrics`:

```ts
import { measure } from "@maccing/growth/meta/whatsapp/campaigns/metrics";
```

Each campaign writes its own short script — twenty lines that declare its cells, declare its controls, call `measure`, and write the result beside the script. **This skill layer ships no executable.** It carries the contract and the reasoning; the arithmetic lives somewhere with a build, a version and a changelog.

**Why a package rather than a copied script.** The alternative is a how-to that every campaign copies into its own file, and copied measurement logic drifts. Five campaigns become five phone-key normalisers and five significance tests, agreeing in shape and free to disagree in arithmetic — and once they disagree there is no way to tell which reading was right, because both were "the method". One implementation that every campaign shares is the fix, and package resolution also means no file has to record where the machinery lives.

**One shared version today, a pin per campaign later.** Nothing is published to a registry yet, so a consumer in the same checkout depends on the package by path — `"@maccing/growth": "file:../relative/path/to/packages/growth"` — and every caller resolving through that one manifest gets the same working copy. That is one shared version for a whole tree of campaigns, not a pin per campaign: editing the package changes what a script written months ago measures the next time it runs, so a re-run of an old campaign is a fresh measurement and is written up as one. Publishing is what makes the pin real, and it is most of why the measurement lives in a package at all. Once a version is on a registry, a campaign folder with its own manifest can name an exact one and hold it — the arithmetic behind an old reading stops moving, so re-running that reading reproduces it instead of re-deriving it under today's code. Until then the honest statement is that every campaign shares one version, and any claim that a campaign pins its own describes the mechanism rather than the current state. Either way there are no hand-copied forks.

### Declaring a cell

A cell is a list plus the moment it was reached.

| Field | Type | Meaning |
|---|---|---|
| `name` | string | join key for controls and for the emitted record |
| `cut` | ISO-8601 UTC | the real send time — not midnight, not the planning date |
| `cut_provisional` | bool, optional | true while no confirmed send time exists |
| `lists` | list of paths | the list files, unioned and de-duplicated by derived key |
| `column` | string, optional | phone column; defaults to the first |
| `filter` | `{ column, value }`, optional | row filter, for one file holding several cells |
| `audience` | `cold` \| `own_base` | decides which outcome is meaningful |
| `exclude` | list of identifiers, optional | planted probes and internal numbers, subtracted before measuring |

A `.txt` list is read as one identifier per line and has nowhere to hold either `column` or `filter`, so declaring one beside a `.txt` is refused rather than ignored — a filter that never runs measures the whole file and reports that wider population under the narrower cell's name. Against a `.csv`, both `column` and `filter.column` are checked against the header before a row is read, separately, so the error names whichever of the two moved.

**Control:** `{ treated, control, outcome }` — all three required, and both `treated` and `control` must name a declared cell. `outcome` is a dotted path into the emitted record, so it resolves and validates rather than sitting there as a bare string the reader has to interpret. Three further refusals sit on the pair itself: the outcome must be one the engine's exported allowlist admits *and* one the two cells' audiences are read on, the two arms must share no identifier — a self-pair is the degenerate case of that and is named as such — and one treated cell may carry only one pair, because a second would overwrite the first reading without a word.

**`audience` is load-bearing.** A cold list has no counterfactual — nobody who never heard of the brand arrives unprompted — so arrival *is* the outcome. An own-base list already holds accounts, so arrival measures nothing and commitment is the outcome. Choosing the wrong one produces a number that looks like a result and answers a question nobody asked. Declared as a field, it stops being a judgment call nothing checks: **the engine rejects a control pair whose outcome contradicts the declared audience.**

### The guards the engine enforces

Each of these was a rule held in prose, enforced by whoever remembered it. As mechanism — and this is the whole list, because a partial one reads as complete and leaves the reader believing the case they hit was allowed:

| Guard | What the engine does |
|---|---|
| A cut must be a real send time | Any cell may carry `cut_provisional`, and the record carries the flag back out. A reading **refuses outright** — `ProvisionalCutError` — when anything counted forward from a provisional cut is non-zero, naming each cell and each count: arrivals, the people who paid or left on either side of the cut, and commitments. `pre_existing.accounts` is deliberately exempt, being a partition of the audience rather than an outcome. Measuring against a placeholder is how a campaign reports acquisition that never happened. |
| A cut must be a cut this engine can honour | `CellDeclarationError` on a blank cut, on one declared finer than a millisecond — the instant resolves to the millisecond, so a finer cut cannot be compared exactly against anything — on one later than the moment of the reading, which makes the window negative and every count zero, exactly like a campaign nobody answered, and on one naming a day its month does not have. The runtime answers `2030-02-30` by counting past the end of February to 2 March rather than refusing it, so the reading would be taken from one day while the record published another: `2026-04-31` and `2026-02-30` are ordinary slips when a send time is copied off a delivery report, and the shift credits the campaign as readily as it robs it. |
| Cells and pairs must be unambiguous | Two cells under one name are refused, because a pair joins on the name and the reading would attach to whichever was measured last. |
| An own-base list must not be read as acquisition | The `audience` field decides the outcome, and a control pair contradicting it is rejected. |
| No reading below the seven-day floor decides anything | `window_hours` is emitted with every record, and `publishable` is false below the floor whatever the p-value says. The floor is arithmetic now, not a reminder. |
| Concentration must not hide in an average | The top-two share is emitted beside the revenue total rather than being found by hand — see §4. It comes back null, not a number, where the group has no whole to take a share of: nothing collected, fewer than two contributors, or any contributor whose events net out below zero. A refund larger than what that person paid shrinks the denominator without shrinking the two largest parts, and the ratio then reads above 1, which is the arithmetic complaining rather than a fact about concentration. |
| A comparison must carry its uncertainty | A control pair may only be read on a **count-valued** field, from an allowlist the engine exports — feeding a money sum to a two-proportion test produces a confident answer to a question that was never asked. Every comparison emits its p-value and its control-event count, and `publishable` is true only when **all four** hold: the test returned a p-value at all, that p is below 0.05, the control carried at least ten events, and the treated cell's window has cleared the floor. Below the event threshold one outlier flips the sign — which has already happened, twice in two days. |
| The two arms must be independent | A pair whose lists share even one identifier is refused, self-pairs included. A two-proportion test reads two independent samples, and a person counted in both arms is counted as evidence twice: the control drifts towards the treated cell and whatever difference survives is an artefact of how the lists were drawn. |
| A cell must have members | A cell that yields no usable identifier is refused, and so is one left empty after its exclusions are subtracted — the two are reported apart, because a wrong file and an over-broad `exclude` are different fixes. Either way the alternative is a row of zeros published for an audience that was never there. |
| An own-base cell must match its own base | An `own_base` cell not one of whose listed identifiers answers for an account is refused — `UnmatchedBaseError`, naming the cell, how many it listed and the export it was matched against. The declaration is the claim that these people already hold accounts, so nothing matched contradicts it and the record would publish a base that was reached and did nothing. It clears both guards above it: readable numbers pass the dialling-plan share and yield keys, so nothing else in the pass ever compares those keys against the index. A `cold` cell matching nobody is measured instead, because there the same zeros are the finding that send was run to get — refusing them would refuse every honest cold reading. Three faults land here and the message names all three: a list of the wrong people, a `column` holding numbers that are not phones, and an export cut narrower than the list. |
| An exclusion must actually subtract somebody | An entry that cannot be read as a number in the format the map declares is refused — `CellExclusionError`, naming the cell and every entry it could not read. This is the one guard in the list aimed at overstatement rather than a silent zero: an entry that yields no key removes nobody, so the planted probe or internal handset stays in the cell and everything that account did is counted as the campaign's. A mistyped digit, an extension pushing the string past a national length and an empty string all land here. An entry that yields a well-formed key for somebody else does not, and cannot: nothing in it distinguishes that from a number the cell could really reach. |
| A file the run needs must be there | Every bound export, and every list file a cell names, is checked before anything is read from it — `MissingExportError`, naming the path and what wanted it. A file measured as absent is a campaign credited with nothing, and that is the same row of zeros as a campaign nobody answered. |
| A bound column must exist | Every column the map binds is checked against that role's export header before anything is counted, optional bindings included — a fallback timestamp or a split column the map names is not optional once named. A renamed column used to produce zeros that read as "nobody converted"; it now names the column and the header it actually found. |
| A bound column must hold something | A timestamp column — or the person export's phone column — that is present and blank, or unreadable, on every row of an export that has rows is refused rather than skipped event by event; so is a conversion export whose rows carry no status the map counts as committed; so is an amount that is missing, blank or not a number. The phone case has to be named separately because an absent identifier is not counted against the dialling-plan share below, so a wholly empty phone column reaches that guard with nothing to report and would otherwise pass as a perfect file that matches nobody. A single value that cannot be read as a moment does not wait for that column-wide check either — `TimestampError` names it and stops there, because a date dropped in silence moves its event to the wrong side of the cut. An export with no rows at all is a fact and passes. |
| Two files must actually join | A role's export whose rows reference nobody in the person export is refused. Every row can be well-formed while the column holds the wrong kind of identifier, and the run would otherwise report a matched audience that did nothing. One shared key is enough to pass; this is not a coverage check. |
| A person must appear once | A person export carrying one identifier on several rows is refused — `ExportRepeatedPersonError`, naming how many rows carried how many distinct identifiers. Each copy becomes its own account, so that person arrives, pays and commits once per copy and every figure the run publishes comes out multiplied, the acquisition rate with it: twenty percent published as forty. It is the inflating direction and nothing downstream separates it from a base whose people genuinely hold several accounts, which is ordinary. The remedy travels in the sentence, because the cause is always the query: the export is missing a `distinct`, or it joins a table that fans out — the wallet table above all, since a person holds one per type and currency. Rows carrying no identifier count on neither side, a blank being a left join that matched nothing and already collecting nothing. |
| A published total must still be a number | A money total that sums past the range a number here can hold is refused — `OverflowedTotalError`, naming the cell and the record's own dotted path to the field. Every row behind such a total is finite and passed the per-row check; it is the sum that leaves the range, and a non-finite number serialises as `null` — the same `null` the record uses for a role the map never bound, so the overflow reads as a documented absence rather than as arithmetic that came apart. Checked at all seven money fields, because a guard at six leaves the seventh publishing the null. |
| A list must be read as declared | A `.txt` carrying a `column` or a `filter`, a column or filter name the header does not carry, a header naming one column twice, a quoted field that never closes, and any extension the reader will not guess at are each their own refusal. Every one of them otherwise ends as a short or empty list that reads as people who did not convert. |
| The dialling plan must match the market | Unreadable identifiers above the share the map allows abort the run and report the count, because a misconfigured plan and a genuinely unmatched list produce the same zero. It is checked twice against the same ceiling — once on the person export, once on each cell's own lists — since junk on the first side empties an audience and junk on the second inflates every rate derived from it. An identifier that is simply absent is not an unreadable one and counts on neither side, and both sides count distinct spellings, so one sentinel repeated down a column is one unknown. A phone answering for as many accounts as the map's ceiling is a switchboard and is dropped from the index, so no list inherits every account behind it. |
| The map must still describe the schema | The fingerprint is verified on every run, never on request, over the schema blocks the map names — `model` and `enum` blocks alike, because a renamed status or a renamed split value changes what every binding means while leaving each model byte-identical. A hash nobody checks is a written date. |

### The map is a prerequisite

Measurement needs to know which table holds a person, which column holds a phone, what counts as money arriving and what counts as money leaving. That binding is the project's, not the skill's, and it lives in the project's database map. **`database-mapping` is the skill that owns it.** Load it first: a campaign whose project is unmapped — or mapped against a schema that has since moved — is not a campaign you can measure, and the engine stops rather than guessing.
