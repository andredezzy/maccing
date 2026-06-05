## Contents

1. [Bid Strategies](#bid-strategies)
2. [Budget Types](#budget-types)
3. [Campaign Budget Optimization (CBO) / Advantage Campaign Budget](#campaign-budget-optimization-cbo--advantage-campaign-budget)
4. [Budget Minimums & Learning Phase](#budget-minimums--learning-phase)
5. [Scaling Strategies](#scaling-strategies)

---

## 5. Bidding & Budget

### Bid Strategies

| Strategy | API Value | When To Use |
|----------|-----------|-------------|
| Highest Volume (no cap) | `LOWEST_COST_WITHOUT_CAP` | Maximize conversions, flexible CPA; default for new campaigns |
| Cost Cap | `COST_CAP` | Need average CPA within range; more stable costs, less volume |
| Bid Cap (manual) | `LOWEST_COST_WITH_BID_CAP` | Maximum bid control; can under-deliver |
| ROAS Goal | `LOWEST_COST_WITH_MIN_ROAS` | Revenue-focused, variable product values; requires strong signal |
| Maximize ROAS | `VALUE_BASED` | New (late 2025); optimizes toward highest-value conversions |

**Decision framework:**

```
New campaign, no data → LOWEST_COST_WITHOUT_CAP (learn first)
CPA is critical / consistent cost needed → COST_CAP
Products have variable values → LOWEST_COST_WITH_MIN_ROAS
Brand-new with very tight budget → LOWEST_COST_WITH_BID_CAP (with caution)
```

**Cost Cap practical notes:**
- Set cap 20-30% above target CPA to allow delivery
- If cap is too tight, campaign under-delivers
- Better for accounts with 2+ weeks of conversion history

**ROAS Goal practical notes:**
- Meta bids "as high as needed" to hit ROAS over campaign lifetime
- Requires strong CAPI signal for value optimization
- Set ROAS goal 15-20% below your actual target initially

### Budget Types

| Type | API Field | When To Use |
|------|-----------|-------------|
| Daily Budget | `daily_budget` | Ongoing campaigns; easier to control day-to-day |
| Lifetime Budget | `lifetime_budget` | Campaigns with defined end date; allows dayparting |

**Budget in cents:** `daily_budget: 5000` = $50.00/day.

**v24.0 change:** Daily budget flexibility increased from 25% to 75% of declared budget on any single day (Meta can overspend by 75% but averages out over the week).

### Campaign Budget Optimization (CBO) / Advantage Campaign Budget

Enabled at campaign level. Meta allocates spend dynamically across ad sets.

**API:**
```json
{
  "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
  "daily_budget": 20000,
  "pacing_type": ["standard"]
}
```

**Use CBO when:** 3+ ad sets in a campaign; want Meta to auto-allocate to winners.

**Gotcha:** Use "minimum spend" per ad set to prevent Meta from starving a test ad set.

### Budget Minimums & Learning Phase

**Learning phase:** ~50 optimization events per week per ad set. Until reached, performance is unstable.

**Practical formula for minimum budget:**
```
Min Daily Budget = (Target CPA × 50) / 7
Example: $25 CPA target → ($25 × 50) / 7 = $179/day per ad set
```

**Official minimums (keep campaign live, insufficient for optimization):**
- Awareness: $1/day
- Clicks: $5/day
- Conversions: $10-20/day
- App installs: $40+/day

**Practical minimums (for real performance):**
- Test/exploration: $50/day
- Advantage+ Shopping: $50-100/day minimum, ideally $150+/day
- Per ad set to exit learning: 2× target CPA/day

**Learning phase reset triggers:** Budget changes >20%, bid strategy change, audience change, creative swap, pause/resume for 7+ days. Avoid resetting during active learning.

### Scaling Strategies

| Phase | Budget Change | Frequency |
|-------|--------------|-----------|
| Early (proving) | Test at floor budget | N/A |
| Scaling start | +20% per increase | Every 5-7 days |
| Active scaling | Max +30% per change | Every 5-7 days |
| Aggressive scaling | Duplicate campaign into fresh budget | Weekly |

**Horizontal vs. vertical scaling:**
- **Horizontal** (new audiences, geos, creatives) = safer, no learning reset
- **Vertical** (more budget into same ad set) = triggers learning phase risk above 30%

**Budget timing:** Avoid budget changes on Monday (performance dip) or end of month (higher CPMs). Mid-week changes optimize faster.

---
