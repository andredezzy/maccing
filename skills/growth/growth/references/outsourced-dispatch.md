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

## 3. Attribution: One Referral Account Per Template

A vendor cannot be trusted to report conversions, and a delivery report says nothing about revenue. **Build attribution into the link.**

Give each template its own signup URL with a distinct `?ref=<account>`. Signups then land in that account's referral tree, and per-template performance falls straight out of your own database with zero vendor cooperation.

| Template | Link | Reads out as |
|---|---|---|
| A | `<signup-url>?ref=<account-a>` | Referrals under `<account-a>` |
| B | `<signup-url>?ref=<account-b>` | Referrals under `<account-b>` |

**Verify the whole click path before dispatch:** short link → landing page → signup. Confirm the ref param survives every hop.

Observed failure: a silently dropped ref put leads on the root account. They had to be reassigned by hand, and a 5-template split test would have been unmeasurable. Test one real end-to-end signup per template and check where it landed, before a single message goes out.

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
| ROAS — new signups only | 2,24x |
| ROAS — including reactivation of already-registered contacts | 9,13x |

**The lesson: ~75% of the revenue came from reactivating dormant registered users, not from new signups.** (The gap between the two ROAS figures is the reactivation revenue.)

So a cold list of strangers and a list salted with dormant users are **different bets**, and the second one is far better. Before buying a blast, ask what share of the list already exists in your database — that share, not the new-signup rate, is what the campaign is really priced against. Match the vendor's list against your own users after the campaign and report both ROAS figures; the new-signup-only figure alone understates the result by ~4x.

---

## 5. Non-Negotiables Checklist

Every item below is a real gap a vendor left behind. Run all five per campaign.

- [ ] **Save the exact copy before dispatch.** Into `templates.md` in the campaign folder. A lost template means you cannot tell what was said, so you cannot repeat a winner or diagnose a burn.
- [ ] **One referral account per template** (§3), with the click path verified end to end before any send.
- [ ] **Apply suppression before splitting the list.** Never send to someone who opted out of your own channel. Never blindly re-send to a list a previous vendor already burned. Suppress first, then split into segments — suppressing afterwards skews the split.
- [ ] **Record price and send date the day it runs.** Ledger row per `references/cost-tracking.md`; campaign README updated the same turn.
- [ ] **Demand opt-out and complaint counts as part of the vendor report.** Agree this before paying. A vendor that only reports sends and reads is hiding the number that predicts the next campaign's performance.

---

## 6. A Vendor Is Not a Firewall

Your brand and your domain travel **inside** the vendor's messages, and Meta correlates entities across them. A vendor blast can still splash back on your own assets.

Observed: a display-name rejection on an owned asset turned out to be **entity correlation**, not a site problem — the brand had been carried by traffic the owned asset never sent.

- Record the correlation risk per vendor in `meta/vendors/<vendor>/README.md`, alongside price and channel.
- Do not assume isolation. Outsourcing moves the **number** off your books, not the **brand**.
- If an owned asset gets rejected or restricted shortly after a vendor campaign, treat correlation as a live hypothesis before debugging the asset itself.
