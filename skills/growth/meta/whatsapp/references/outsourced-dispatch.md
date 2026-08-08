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

**The decisive advantage** is the failure that already happened. A silently dropped ref put leads on the root account; they had to be reassigned by hand, and a multi-template split test would have been unmeasurable. Per-template accounts cannot see that failure — the leads simply are not there. Phone matching recovers all of it, because the phone still says which cell the contact was in.

**Its one requirement is hard: freeze the segment files after dispatch.** Re-splitting, re-ordering, or de-duplicating them destroys the phone→cell map and voids the whole experiment. Commit the dispatched files unchanged and treat them as read-only from the moment the vendor receives them. There is no way to reconstruct the mapping afterwards.

**Still verify the click path before dispatch:** short link → landing page → signup. Confirm the ref param survives every hop. Attribution now survives a dropped ref, but the referral tree does not — a broken ref still costs you the referral relationship even when the measurement holds. Test one real end-to-end signup per cell and check where it landed, before a single message goes out.

Per-template referral accounts remain a valid second layer when you want the referral tree split by cell as well. They are no longer the primary method.

---

## 4. Worked Example — Reading a Blast

**Every number in this section is invented.** They exist to show which quantities you divide by which, and in what order. None of them is a measurement, none is a benchmark, and none should be planned against. Substitute your own inputs and rerun the arithmetic.

Take one vendor campaign, one template, one consumer funnel, with these invented inputs:

| Input | Invented value |
|---|---|
| Fee paid | 6,000 |
| Messages the vendor reports as sent | 12,000 |
| Delivered share the vendor will evidence | 90%, so 10,800 delivered |
| New signups matched back to the dispatched files (§3) | 120 |
| Of those, made a first payment | 20 |
| Revenue from those 20 | 15,000 |
| Payments after the send date by contacts already registered before it | 9,000 |

Six readings follow, and the order matters — each one narrows the population of the one above it:

| Reading | Arithmetic | Invented result |
|---|---|---|
| Cost per send | 6,000 ÷ 12,000 | 0.50 |
| Cost per **delivered** message | 6,000 ÷ 10,800 | 0.56 |
| Signup rate | 120 ÷ 12,000 | 1.0% |
| Cost per signup | 6,000 ÷ 120 | 50 |
| Cost per depositor | 6,000 ÷ 20 | 300 |
| Attributed ROAS | 15,000 ÷ 6,000 | 2.50x |
| Wide ROAS | (15,000 + 9,000) ÷ 6,000 | 4.00x |

Cost per delivered message is the honest unit price and cost per send is the one the invoice implies; quote the first and keep the second only to show the gap. Cost per depositor is the number that decides whether the channel pays, because it is the only one that has met the product.

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

When a campaign's ROAS leans on a handful of large tickets, publish the depositor count and the top-N share next to the number. A few people carrying most of the return is a fact about those few people, not a fact about the channel. A multiple built on a single-digit number of observations will not repeat, and budgeting on it buys the next campaign at a large multiple of its real expected return. The measurement contract in §10 emits that share beside the revenue total for exactly this reason, so it cannot be left out by accident.

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
| Referral depth and rates | The referral logic in code |
| Payout schedule and fees | The live product, not a deck |
| Minimums and limits | Config or the signup flow |
| Yield or return structure | The product itself |
| Any headline percentage | Whichever of the above defines it |

**Reused copy from a sibling product is the specific trap.** The structure survives the move; the facts do not. Treat any inherited template as unverified until every number in it has a source.

---

## 8. Non-Negotiables Checklist

Every item below is a real gap a campaign left behind. Run all eight.

- [ ] **Save the exact copy before dispatch.** Into `templates.md` in the campaign folder. A lost template means you cannot tell what was said, so you cannot repeat a winner or diagnose a burn.
- [ ] **Wire attribution to the phone, and freeze the segment files** (§3). Verify the click path end to end before any send. Never re-split, re-order, or de-duplicate a dispatched file.
- [ ] **Verify every concrete claim against the product** (§7). Referral depth, payout schedule and fees, minimums, yield structure, headline percentages — each with a cited source.
- [ ] **Apply suppression before splitting the list.** Never send to someone who opted out of your own channel. Never blindly re-send to a list a previous vendor already burned. Suppress first, then split into segments — suppressing afterwards skews the split.
- [ ] **Exclude the people your own product burned.** Where a prior product is wound down, the segment that paid in and never got made whole is the highest-complaint audience that exists, and on WhatsApp a report is one tap. Audited on a real base, most of the people who had paid into a dormant product were net negative, and collectively the shortfall was large enough to make the exclusion obvious. Excluded. Two rules make the exclusion actually work:
  - **Aggregate money per person, not per account row.** Observed defect: the exclusion judged one account row at a time, and hundreds of phones held several accounts — a large share of them only read as net losers once summed. A single zeroed second account laundered them back in as "never paid". Aggregate on the contact key (phone) before classifying.
  - **The exclusion follows the person across lists.** If a burned contact also appears in a clean second source, they stay out. The complaint risk belongs to the person, not to the list they arrived on.
- [ ] **Spend the finite source first.** When lists come from more than one base, they are rarely equally replaceable. Observed: one source was almost entirely consumed by a previous blast and its monthly intake had collapsed by roughly two orders of magnitude, while the other still held a large surplus. Use the finite source **whole** and let the surplus source absorb the shortfall — it is the only one that should be ranked down on quality.
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

**Why a package rather than a copied script.** The alternative is a how-to that every campaign copies into its own file, and copied measurement logic drifts. Five campaigns become five phone-key normalisers and five significance tests, agreeing in shape and free to disagree in arithmetic — and once they disagree there is no way to tell which reading was right, because both were "the method". One versioned implementation that every campaign pins is the fix. A campaign pinned to an old version keeps measuring exactly as it measured, forever, while the next campaign pins a newer one. That is one ruler per campaign *and* no hand-copied forks, which is what a lockfile is for. Package resolution also means no file has to record where the machinery lives.

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

**Control:** `{ treated, control, outcome }` — all three required, and both `treated` and `control` must name a declared cell. `outcome` is a dotted path into the emitted record, so it resolves and validates rather than sitting there as a bare string the reader has to interpret.

**`audience` is load-bearing.** A cold list has no counterfactual — nobody who never heard of the brand arrives unprompted — so arrival *is* the outcome. An own-base list already holds accounts, so arrival measures nothing and commitment is the outcome. Choosing the wrong one produces a number that looks like a result and answers a question nobody asked. Declared as a field, it stops being a judgment call nothing checks: **the engine rejects a control pair whose outcome contradicts the declared audience.**

### The guards the engine enforces

Each of these was a rule held in prose, enforced by whoever remembered it. As mechanism:

| Guard | What the engine does |
|---|---|
| A cut must be a real send time | Any cell may carry `cut_provisional`, and a reading raises a loud banner when arrivals appear against a provisional cut. Measuring against a placeholder is how a campaign reports acquisition that never happened. |
| An own-base list must not be read as acquisition | The `audience` field decides the outcome, and a control pair contradicting it is rejected. |
| No reading below the seven-day floor decides anything | `window_hours` is emitted with every record, and a reading below the floor is not publishable whatever its p-value says. |
| Concentration must not hide in an average | The top-two share is emitted beside the revenue total rather than being found by hand — see §4. |
| A comparison must carry its uncertainty | Every comparison emits its p-value and its control-event count, and it is not publishable unless the difference clears significance and the control holds enough events. Below that, one outlier flips the sign — which has already happened, twice in two days. |

### The map is a prerequisite

Measurement needs to know which table holds a person, which column holds a phone, what counts as money arriving and what counts as money leaving. That binding is the project's, not the skill's, and it lives in the project's database map. **`database-mapping` is the skill that owns it.** Load it first: a campaign whose project is unmapped — or mapped against a schema that has since moved — is not a campaign you can measure, and the engine stops rather than guessing.
