## Contents

1. [2025-2026 Best Practices](#12-2025-2026-best-practices)
   - [The Modern Meta Stack](#the-modern-meta-stack)
   - [Account Structure (2026 Standard)](#account-structure-2026-standard)
   - [Targeting in 2026](#targeting-in-2026)
   - [CAPI Setup Checklist](#capi-setup-checklist)
   - [Creative Best Practices](#creative-best-practices)
   - [Bidding Best Practices](#bidding-best-practices)
   - [Learning Phase Management](#learning-phase-management)
   - [Budget Allocation by Funnel](#budget-allocation-by-funnel)
   - [Scaling Checklist](#scaling-checklist)
   - [Reporting & Decision Cadence](#reporting--decision-cadence)
   - [Attribution Strategy](#attribution-strategy)
2. [Common Gotchas](#common-gotchas)

---

## 12. 2025-2026 Best Practices

### The Modern Meta Stack

```
CAPI (server-side) + Pixel (client-side)  → Measurement foundation
Advantage+ Audience (broad)               → Targeting
Advantage+ Placements                     → Delivery
Advantage+ Creative (DCO)                 → Optimization
CBO (campaign budget optimization)        → Budget allocation
```

### Account Structure (2026 Standard)

**Two-campaign model:**

```
Campaign 1: TEST (25% of total budget)
  - CBO, Highest Volume bid
  - Multiple ad sets by creative theme
  - New creatives rotating every 7-14 days
  - 3-5 creative concepts per launch
  - Read results at 50+ events per variant
  - Kill losers at 1.5x target CPA with no conversion

Campaign 2: SCALE (75% of total budget)
  - CBO, Advantage+ enabled
  - Proven winners from Test campaign
  - Original Post IDs (to preserve social proof)
  - Scale budget +20% every 5-7 days
  - Creative refresh every 3-4 weeks
```

**Core principle:** One campaign at $500/day outperforms five campaigns at $100/day. More data per campaign = better learning.

**Avoid:** More than 5 ad sets per campaign. Consolidate ad sets to concentrate learning data.

### Targeting in 2026

| Priority | Approach | Why |
|----------|----------|-----|
| 1 (primary) | Advantage+ Audience, broad geo only | AI outperforms human segmentation at scale |
| 2 (test) | Custom audiences from closed-won | Highest quality signal |
| 3 (scale) | 1-2% Lookalikes from closed-won customers | Most similar buyers |
| 4 (fallback) | Detailed interests (as suggestions only) | Legacy approach, diminishing returns |

**Rule:** Creative IS the targeting. Strong creative signals to Meta's algorithm exactly who to find.

**Exclusions still matter (add to Controls, not Suggestions):**
- Recent purchasers (30-90 days)
- Existing customers (if running prospecting)
- High-value subscribers (if running discount acquisition)

### CAPI Setup Checklist

- [ ] Pixel fires on all key pages (PageView, ViewContent, AddToCart, InitiateCheckout, Purchase)
- [ ] CAPI sends all same events server-side with matching `event_id`
- [ ] `fbp` and `fbc` sent via CAPI (NOT hashed)
- [ ] Email and phone hashed with SHA256 and sent with every event
- [ ] `event_time` within 1 hour of actual event
- [ ] `action_source` correctly set (`website`, `system_generated`, etc.)
- [ ] EMQ score above 7.0 for Purchase events
- [ ] < 10% discrepancy between CAPI event count and actual conversions
- [ ] CRM events (closed-won, demo booked) firing back to Meta with original `fbclid`

### Creative Best Practices

**Format priority (2026):**
1. 9:16 vertical video — Reels, Stories, mobile feed
2. 4:5 vertical image — highest feed CTR
3. 1:1 square — broadest placement compatibility
4. 16:9 horizontal — desktop-only (low priority)

**Video performance rules:**
- First 3 seconds determine 80% of outcome
- Optimal length: 15-30s for Reels/Stories; 30-60s for feed
- Win first 3 seconds with: pattern interrupt, specific claim, direct question, or before/after cut
- Never open with brand logo or name
- Captions mandatory (85% of video watched without sound on mobile)

**UGC vs. polished production:**
- UGC (authentic, raw) wins "9 out of 10 accounts"
- Studio-shot ads read as "advertisement" and are scrolled past
- Hybrid: authentic look + minimal branded overlay (logo, CTA at end)

**Creative volume targets:**
- Test: 3-5 new concepts/launch
- Scale: 15-50+ active creatives in account
- Refresh cycle: 2-3 weeks for prospecting; 3-4 weeks for retargeting

### Bidding Best Practices

1. Start with `LOWEST_COST_WITHOUT_CAP` — let the algorithm learn
2. After 50+ conversions/week: test `COST_CAP` at 1.3× your target CPA
3. For e-commerce with variable order values: `LOWEST_COST_WITH_MIN_ROAS`
4. Never switch bid strategy on an active campaign — duplicate and test in new campaign
5. Budget changes > 20% reset the learning phase

### Learning Phase Management

**Goal:** Exit learning phase ASAP with high-quality signal.

| Action | Effect |
|--------|--------|
| Increase budget (>20%) | Resets learning |
| Change bid strategy | Resets learning |
| Add/remove audiences | Resets learning |
| Swap creative | Does NOT reset (in Advantage+ setup) |
| Pause > 7 days | Resets learning |

**Strategy to exit learning fast:**
1. Start with daily budget = (target CPA × 50) / 7 per ad set
2. Use broad targeting (fewer constraints = more traffic)
3. Use Highest Volume (no cap) bid
4. Use Advantage+ placements (more inventory)
5. Launch with 3-5 creative variations for DCO

### Budget Allocation by Funnel

| Stage | % of Budget | Campaign Type |
|-------|------------|---------------|
| Prospecting (cold) | 70-80% | Advantage+, broad targeting, UGC |
| Retargeting (warm) | 10-20% | Custom audiences, BOFU offers |
| Creative testing | 10-25% | Test campaign, new concepts |

### Scaling Checklist

Before scaling:
- [ ] ROAS > target for 7+ consecutive days
- [ ] Frequency < 2.5 (prospecting)
- [ ] Learning phase exited
- [ ] CAPI fully deployed (EMQ > 7.0)
- [ ] Creative refresh within last 2 weeks

Scaling approach:
- [ ] Increase budget max 20-30% per change
- [ ] Wait 5-7 days between increases
- [ ] Horizontal first (new geos, new audiences) before vertical (more budget)
- [ ] Duplicate top ad sets with fresh budget cap for larger jumps

### Reporting & Decision Cadence

**Daily (5 minutes):**
- Check for automated rule triggers
- Check spend pacing vs budget
- Flag any `WITH_ISSUES` status notifications

**Weekly (30 minutes):**
- CPA/ROAS vs targets (using 7d_click + 1d_view)
- Frequency by ad → identify creative fatigue
- Creative performance ranking → promote winners, pause losers
- Compare platform ROAS vs blended MER

**Monthly (2 hours):**
- Attribution analysis (compare 1d_click vs 7d_click vs 28d_click)
- Audience performance by segment
- Creative concept analysis (which angles convert)
- Budget allocation review (test vs scale split)
- Catalog feed health (if running dynamic ads)

### Attribution Strategy

**Default:** 7-day click + 1-day view

**For brand awareness/video campaigns:** Accept 1-day view only; supplement with MER analysis

**Never rely solely on platform attribution:** Compare Meta-reported ROAS against blended MER (total revenue / total ad spend). Meta over-credits itself.

**For B2B / long sales cycles:** Track `Schedule` and closed-won events via CAPI. Use 28-day click window for comparison reporting. Note: 28-day view no longer available as of Jan 12, 2026.

---

> **API Quick Reference** (Campaign Objectives, Optimization Goals, Bid Strategies, Status Values, Special Ad Categories, Placement Fields) has moved to [api-and-campaigns.md](api-and-campaigns.md).

## Common Gotchas

| Gotcha | Fix |
|--------|-----|
| Budget in dollars → API expects cents | Multiply by 100: $50 → `5000` |
| `fbp`/`fbc` hashed in CAPI | NEVER hash these; send raw cookie values |
| Legacy ASC/AAC APIs deprecated May 2026 | Migrate to unified Advantage+ via ODAX objective + 3 levers |
| 7d_view/28d_view returns empty, not error | Audit all reporting pipelines; update to 7d_click + 1d_view |
| Learning phase reset on budget change > 20% | Make incremental increases; duplicate for big jumps |
| `instagram_actor_id` deprecated in v22.0+ | Use `instagram_user_id` |
| Facebook video feeds placement deprecated v24.0 | Migrate to Facebook Reels placement |
| Batch payload max 30 MB (v24.0+) | Split large batches; reduce payload size |
| Messenger lead ads creation blocked via API | Use Ads Manager UI for Messenger lead ads |
| Offline Conversions API shut down May 2025 | Use CAPI with `action_source: "physical_store"` |
| Frequency >3.0 with no creative refresh plan | Webhook subscription to `creative_fatigue` for alerts |
| Async Insights job returns null | Retry; check `async_percent_completion` before reading |

---

### Creative Rotation Strategy

1. Launch 3-5 creative concepts per ad set
2. After 7 days or 50 optimization events per variant: identify winners
3. Scale budget to top 2-3 performers; pause bottom performers
4. Refresh creative every 2-3 weeks (before frequency hits 2.5)
5. Never let creative library drop below 3 active assets per ad set

**Creative testing velocity target (2026):** 15-50+ active creatives needed for Meta's algorithm to properly optimize. Aim for 10-30 new creatives/month in active accounts.

### Ad Fatigue & Creative Health

Use the `creative_fatigue` webhook (see Section 1) to get real-time fatigue alerts. Meta provides three levels: Low, Medium, High.

**Manual fatigue signals:**
- Frequency > 2.5 (prospecting) → begin creative refresh
- Frequency > 3.0 → urgent refresh
- CTR decline > 20% over 7-14 days → replace creative
- CPM increase > 50% while CTR flat → algorithm deprioritizing

---

