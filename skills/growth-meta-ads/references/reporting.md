## Contents

1. [Reporting & Analytics](#8-reporting--analytics)
   - [Insights API](#insights-api)
   - [Attribution Windows (2026 State)](#attribution-windows-2026-state)
   - [Key Metrics](#key-metrics)
   - [Data Retention Limits (2026)](#data-retention-limits-2026)
   - [Async Reporting](#async-reporting)
2. [Meta Business Suite & Ads Manager](#9-meta-business-suite--ads-manager)
   - [A/B Testing (Experiments Tool)](#ab-testing-experiments-tool)
   - [Creative Hub](#creative-hub)
   - [Automation Rules](#automation-rules)

---

## 8. Reporting & Analytics

### Insights API

**Base endpoint:** `GET /{OBJECT_ID}/insights`

**Available levels:** `account`, `campaign`, `adset`, `ad`

**Common query parameters:**

| Parameter | Values | Notes |
|-----------|--------|-------|
| `level` | `account`, `campaign`, `adset`, `ad` | Aggregation level |
| `date_preset` | `today`, `yesterday`, `last_7d`, `last_14d`, `last_28d`, `last_30d`, `last_month`, `last_quarter`, `last_year` | Preset date ranges |
| `since` / `until` | `YYYY-MM-DD` | Custom date range |
| `time_increment` | `1`, `7`, `28`, `monthly`, `all_days` | Data broken by day/week/month |
| `breakdowns` | `age`, `gender`, `country`, `region`, `device_platform`, `publisher_platform`, `platform_position`, `impression_device` | Segment data |
| `fields` | Comma-separated metric list | What to return |
| `action_attribution_windows` | See below | Attribution window |

**Sample query — campaign-level 30d report:**
```
GET /act_{AD_ACCOUNT_ID}/insights
?level=campaign
&date_preset=last_30d
&fields=campaign_name,impressions,reach,clicks,spend,cpm,cpc,ctr,actions,action_values,cost_per_action_type
&action_attribution_windows=["7d_click","1d_view"]
```

**Sample query — ad-level breakdown by device:**
```
GET /act_{AD_ACCOUNT_ID}/insights
?level=ad
&date_preset=last_14d
&breakdowns=device_platform
&fields=ad_name,impressions,clicks,spend,actions,cost_per_action_type
```

### Attribution Windows (2026 State)

**Available windows:**

| Window | API Value | Status |
|--------|-----------|--------|
| 1-day click | `1d_click` | Active |
| 7-day click | `7d_click` | Active — **new default** |
| 28-day click | `28d_click` | Active (reporting only, not optimization) |
| 1-day view | `1d_view` | Active |
| 1-day engaged view | `1d_engaged_view` | Active |
| 7-day view | `7d_view` | **REMOVED Jan 12, 2026** |
| 28-day view | `28d_view` | **REMOVED Jan 12, 2026** |

**Meta recommended standard:** `7d_click` + `1d_view`

**Critical warning:** Deprecated windows (`7d_view`, `28d_view`) return **empty data silently** — no error. This breaks reporting pipelines without any visible warning. Audit all integrations.

**Impact of removal:** Advertisers who relied on view-through attribution saw 15-40% drops in reported conversions overnight. Not a performance drop — a measurement methodology change.

**Most affected by removal:** B2B companies, high-consideration products, awareness/video campaigns with extended sales cycles.

### Key Metrics

| Metric | Field Name | Notes |
|--------|-----------|-------|
| Impressions | `impressions` | Total ad views |
| Reach | `reach` | Unique people reached |
| Frequency | `frequency` | impressions/reach |
| Clicks | `clicks` | All clicks |
| Link Clicks | `inline_link_clicks` | Clicks on links only |
| CTR | `ctr` | All-click CTR |
| Link CTR | `inline_link_click_ctr` | Link-specific CTR |
| CPM | `cpm` | Cost per 1,000 impressions |
| CPC | `cpc` | Cost per click |
| Spend | `spend` | Total spend |
| Actions | `actions` | Conversions by type |
| Action Values | `action_values` | Revenue by conversion type |
| Cost Per Action | `cost_per_action_type` | CPA by event type |
| ROAS | `purchase_roas` | Return on ad spend |
| Quality Ranking | `quality_ranking` | vs. competitors |
| Engagement Rate Ranking | `engagement_rate_ranking` | Expected engagement rank |
| Conversion Rate Ranking | `conversion_rate_ranking` | Expected CVR rank |
| Video Views | `video_p25_watched_actions` through `video_p100_watched_actions` | 25%/50%/75%/100% completion |

### Data Retention Limits (2026)

| Data Type | Retention Limit |
|-----------|----------------|
| Standard metrics | Unlimited historical |
| Unique count fields (`unique_actions`, `cost_per_unique_action_type`) | 13 months |
| Hourly breakdowns | 13 months |
| Frequency breakdowns | 6 months |

**Action:** Export historical data before retention windows expire.

### Async Reporting

For large queries (many campaigns × many breakdowns × long date ranges), use async:

```
POST /act_{AD_ACCOUNT_ID}/insights
?level=ad
&date_preset=last_year
&async=true
```

Returns: `{"report_run_id": "{JOB_ID}"}`

Poll status: `GET /{JOB_ID}?fields=async_status,async_percent_completion`

Download: `GET /{JOB_ID}/insights`

**Marketing Mix Modeling (MMM) breakdowns** are now async-only (no real-time sync access).

**v25.0 improvement:** Async reports now return detailed error info: `error_code`, `error_message`, `error_subcode`, `error_user_title`, `error_user_msg`.

---

## 9. Meta Business Suite & Ads Manager

### A/B Testing (Experiments Tool)

**Two methods:**
1. **Experiments Tool** — structured split test with guaranteed traffic isolation, proper randomization, statistical rigor (recommended)
2. **Manual duplication** — duplicate campaign with single variable change (faster but less controlled)

**Statistical standard:** 95% confidence (p < 0.05). Meta's tool defaults to 90% for faster directional learning.

**Recommended test specs:**
- Duration: 7-14 days minimum
- Budget: $100/day per variation minimum
- Conversions per variation: 50+ to exit learning phase before reading
- One variable changed per test (creative, headline, audience, or bid — never two at once)

**2025 research caveat:** A 2025 Journal of Marketing study found "divergent delivery" — Meta's algorithm can show different ads to systematically different user types even within randomized A/B tests, which can skew results. Use Experiments Tool (not manual duplication) to minimize this.

**Test hierarchy (highest to lowest impact):**
1. Creative concept/angle
2. Ad format (video vs static vs UGC)
3. Hook (first 3 seconds / headline)
4. Offer/CTA
5. Audience (Advantage+ vs detailed vs custom)

### Creative Hub

Access: Ads Manager → Plan → Creative Hub

- Mock up ad creative for all placements before launching
- Share previews with clients/team via direct link
- Preview across all device types and placements
- Convert mockups directly into ad creatives via API or UI

### Automation Rules

**Access path:** Ads Manager → Campaigns/Ad Sets/Ads tab → Rules → Create Rule

**Rule limit:** 250 rules per advertiser account (including inactive).

**Rule components:**
1. **What to apply to:** Campaign / Ad Set / Ad
2. **Conditions:** Metrics thresholds (CPA, ROAS, frequency, CTR, spend, etc.)
3. **Action:** Pause, resume, increase budget, decrease budget, send notification
4. **Time range:** Lookback window for condition evaluation
5. **Schedule:** Continuous, daily, or custom

**Essential rule templates:**

```
Rule 1: Budget Protection (Pause overspending ad sets)
Condition: Cost Per Result > {1.5x target CPA}
           AND Spend > {2x target CPA}
           AND NOT in learning phase
Action: Pause ad set

Rule 2: Winner Scaling
Condition: ROAS > {target ROAS}
           AND Conversions > 10 (last 3 days)
           AND Frequency < 2.5
Action: Increase daily budget by 20%
Frequency: Daily

Rule 3: Creative Fatigue Kill
Condition: Ad Frequency > 3.0
           AND CTR < 0.9%
Action: Pause ad + send notification

Rule 4: Weekend Budget Reduction
Condition: Weekend hours
           AND ROAS < {weekday ROAS - 20%}
Action: Decrease budget by 30%

Rule 5: Dayparting Boost
Condition: Hour of day = 17-21 (peak hours)
Action: Increase manual bid by 20%
Note: Requires lifetime budget
```

**Critical gotches:**
- Add "NOT in learning phase" condition to all performance rules
- Use 3-7 day lookback windows, never same-day data
- Allow 20-30% variance before triggering pauses
- Review weekly in first month; adjust thresholds seasonally
- Rules without proper tracking data (missing CAPI) make wrong decisions

---
