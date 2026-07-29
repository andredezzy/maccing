# Outsourced Dispatch Doctrine

Rules for paying a third party to send messages **for** you, on **their** numbers and **their** infrastructure. This is a different bet from sending off your own WABA, and it is governed here — not by the WhatsApp sending rules, which assume you own the number. Read this in full before briefing or paying a dispatch vendor. Project state for these campaigns lives under `.maccing/growth/meta/vendors/<vendor>/<channel>/<YYYY-MM-DD>-<slug>/` (git-tracked per Iron Law 0b).

---

## 1. Outsource or Send From Your Own WABA?

The trade is not price. It is **which asset absorbs the damage when a blast goes badly.**

| | Own WABA | Vendor |
|---|---|---|
| Numbers | Yours | Theirs |
| Practical daily ceiling | ~200/day observed | 10k+ per campaign |
| Cost of a burn | The channel — quality rating drops, tier upgrades block, ramp restarts | Money only |
| Recovery | Slow. Observed Red→Green in ~4 days of zero volume, against the documented 7–14 day protocol (7 days to recalculate, 7 more at Green/Yellow to fully clear) — see the `whatsapp` skill, `references/sending-and-scale.md` | None needed; you buy the next campaign |
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

Outsourced dispatch is **not** more expensive per message. Check the ratio before assuming it is a premium.

| Route | Observed 2026 | Per message |
|---|---|---|
| Vendor (BR, flat rate) | R$ 3.000 for a 10k-lead blast | **R$ 0,294** |
| Own WABA (CPDM) | ≈ US$ 0,064 per delivered message | **≈ R$ 0,35** |

The vendor was **cheaper per send** here. What the money buys is **volume and risk transfer**, not a cheaper message.

Two caveats on the comparison:

- Vendor price is per **send**; CPDM is per **delivered** message. A vendor's real cost per delivered message is higher by its undelivered share, which you usually cannot audit.
- CPDM is currency-specific and moves with the rate card. Re-derive it from the current ledger before comparing (`references/cost-tracking.md` §6), never quote this table as today's number.

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

**The decisive advantage** is the failure that already happened. A silently dropped ref put leads on the root account; they had to be reassigned by hand, and a 5-template split test would have been unmeasurable. Per-template accounts cannot see that failure — the leads simply are not there. Phone matching recovers all of it, because the phone still says which cell the contact was in.

**Its one requirement is hard: freeze the segment files after dispatch.** Re-splitting, re-ordering, or de-duplicating them destroys the phone→cell map and voids the whole experiment. Commit the dispatched files unchanged and treat them as read-only from the moment the vendor receives them. There is no way to reconstruct the mapping afterwards.

**Still verify the click path before dispatch:** short link → landing page → signup. Confirm the ref param survives every hop. Attribution now survives a dropped ref, but the referral tree does not — a broken ref still costs you the referral relationship even when the measurement holds. Test one real end-to-end signup per cell and check where it landed, before a single message goes out.

Per-template referral accounts remain a valid second layer when you want the referral tree split by cell as well. They are no longer the primary method.

---

## 4. Benchmark — 10k BR Blast (2026-06)

One vendor campaign, one template, a BR consumer funnel. Figures are as measured, not projected.

| Metric | Value |
|---|---|
| Cost | R$ 3.000 |
| Sends | 10.197 |
| Templates | 1 |
| Read rate (matched sample) | 72% |
| New signups | 71 (0,70% of sends) |
| Of those, deposited | 17 |
| CPA per signup | R$ 42,25 |
| CPA per depositor | R$ 176,47 |

### The two ROAS figures are not equally trustworthy

| Figure | Counts | Status |
|---|---|---|
| **2,24x** | Revenue from the 71 new signups | **Attributed. Budget on this one.** |
| 9,13x | The above, plus every deposit by an already-registered contact in the list after the send date | Loosely attributed. Never plan against it. |

The wider figure counts deposits made **after** the campaign date, not deposits made **because** of it. Two facts break the causal reading:

- **Eight people carry it.** R$ 20.663 of the R$ 20.670 gap came from 8 depositors, averaging R$ 2.583 each. They were existing large-ticket investors who plausibly would have deposited anyway.
- **The sample was not random.** The 125 already-registered contacts were a strange intersection: present in a purchased cold list *and* already registered. Their deposit rate does not extrapolate to a list of dormant users.

Budget on 2,24x. Report 9,13x if you like, labelled as loosely attributed, and never size a campaign against it.

### The insight that does survive

A list salted with dormant registered users behaves differently from a list of strangers, and that share is worth knowing **before** you buy. Ask the vendor what overlap to expect, and match the list against your own users after the campaign. Just do not book the reactivation revenue as revenue the campaign earned.

### General rule — report the concentration, not just the multiple

When a campaign's ROAS leans on a handful of large tickets, publish the depositor count and the top-N share next to the number. Eight people carrying 75% of the return is a fact about eight people, not a fact about the channel. A multiple built on 8 observations will not repeat, and budgeting on it buys the next campaign at roughly 4x its real expected return.

---

## 5. Designing the Split Test

A vendor blast is an experiment. Most of its value is lost to bad design, not to a bad template.

**One variable per cell, all read against a single control.** An interaction cell (copy × photo) measures a second-order effect. It needs the most statistical power, and this kind of campaign has the least, so it returns noise that reads as signal. Spend that cell on another single-variable contrast instead.

**Identical audience mix in every cell.** Sort the pool by quality tier and deal round-robin, so every cell lands within one lead of the same composition. Observed target: five cells of 2.000 whose tier counts differed by at most 1, and whose two source bases split 33/67 in every cell. Without this, a difference between cells may be the list rather than the template — which is the entire experiment. Have the build script **assert** the balance and refuse to emit unbalanced files.

**Hold the confounders still.** Same opener, same structure, same button, same opt-out line, same dispatch hour across all cells. If a variant changes both facts and framing, it measures neither.

**When the control is a known winner, keep it verbatim** — including the parts you believe are wrong. Correcting the control turns a controlled comparison into an indicative one. Put the correction in a variant cell, where it becomes a measurable question instead of an unrecorded assumption.

---

## 6. Statistical Power, and Why You Must Demand Clicks

The single highest-leverage ask in the vendor brief, and it costs nothing.

At a 0,70% signup rate, five cells of 2.000 sends yield ~14 signups each. That is what such a cell can detect:

| Primary metric | Base rate | Min. detectable difference | At 80% power |
|---|---|---|---|
| Signups | 0,70% | **+74%** | +105% |
| Clicks | ~5% | +27% | +39% |
| Clicks | ~8% | **+21%** | +30% |

Two consequences, stated plainly:

1. **Demand per-segment click counts in the vendor contract.** Moving the primary metric from signups to clicks roughly triples sensitivity for zero extra spend. Signups stay the **decision** metric; clicks become the **reading** metric.
2. **Do not kill a variant on a small difference.** "B beat A by 20%" at n=2.000 is noise. Only large effects are legible at this scale — which is fine, because template-level effects usually are.

Redo the numbers for your own rates:

```
MDE ≈ 1,96 × √2 × √(p(1−p)/n) ÷ p
```

`p` = base rate, `n` = cell size. The result is a **relative** lift, two-sided at 95% confidence. That form carries the z_α term only, so it is a 50%-power figure — the honest planning number. For 80% power multiply by `(1,96 + 0,84) / 1,96 ≈ 1,43`, which is the last column above.

---

## 7. Verify the Copy Against the Product Before Dispatch

Observed, and expensive: a vendor campaign ran copy describing **a different product entirely** — a sibling product that had been wound down. Every specific was wrong: the referral depth, the payout schedule, the minimum, the yield structure. It converted anyway, so nobody caught it. The only element that matched the real product was the image.

This matters beyond honesty. The copy promised instant withdrawal on a product that pays on fixed dates. That promise breaks at the user's first withdrawal attempt — a churn mechanism sitting immediately downstream of the metric everyone watches, and a live candidate for why only 17 of 71 signups deposited.

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
- [ ] **Exclude the people your own product burned.** Where a prior product is wound down, the segment that paid in and never got made whole is the highest-complaint audience that exists, and on WhatsApp a report is one tap. Observed: 68% of everyone who paid into a dormant product was net negative, collectively −R$ 645.692. Excluded. Two rules make the exclusion actually work:
  - **Aggregate money per person, not per account row.** Observed defect: the exclusion judged one account row at a time, and 340 phones held several accounts — 150 of which only read as net losers once summed. A single zeroed second account laundered them back in as "never paid". Aggregate on the contact key (phone) before classifying.
  - **The exclusion follows the person across lists.** If a burned contact also appears in a clean second source, they stay out. The complaint risk belongs to the person, not to the list they arrived on.
- [ ] **Spend the finite source first.** When lists come from more than one base, they are rarely equally replaceable. Observed: one source was ~98% consumed by a previous blast and its intake had collapsed from 4.260 to 45 leads/month, while the other held thousands of surplus contacts. Use the finite source **whole** and let the surplus source absorb the shortfall — it is the only one that should be ranked down on quality.
- [ ] **Record price and send date the day it runs.** Ledger row per `references/cost-tracking.md`; campaign README updated the same turn. Record how many usable leads remain in each base after the campaign — in the observed case both bases were dead or dying, which means the channel itself has a countdown. Write that down before it is a surprise.
- [ ] **Demand opt-out and complaint counts as part of the vendor report.** Agree this before paying, alongside per-segment click counts (§6). A vendor that only reports sends and reads is hiding the number that predicts the next campaign's performance.

---

## 9. A Vendor Is Not a Firewall

Your brand and your domain travel **inside** the vendor's messages, and Meta correlates entities across them. A vendor blast can still splash back on your own assets.

Observed: a display-name rejection on an owned asset turned out to be **entity correlation**, not a site problem — the brand had been carried by traffic the owned asset never sent.

- Record the correlation risk per vendor in `meta/vendors/<vendor>/README.md`, alongside price and channel.
- Do not assume isolation. Outsourcing moves the **number** off your books, not the **brand**.
- If an owned asset gets rejected or restricted shortly after a vendor campaign, treat correlation as a live hypothesis before debugging the asset itself.
