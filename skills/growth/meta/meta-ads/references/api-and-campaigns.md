## Contents

1. [API Overview & Authentication](#1-api-overview--authentication)
   - [Current Version Status](#current-version-status)
   - [Base URL](#base-url)
   - [Campaign Hierarchy](#campaign-hierarchy)
   - [Authentication Setup](#authentication-setup)
   - [Core CRUD Endpoints](#core-crud-endpoints)
   - [Campaign Creation](#campaign-creation-minimum-required-fields)
   - [Ad Set Creation](#ad-set-creation-minimum-required-fields)
   - [Ad Creative + Ad Creation](#ad-creative--ad-creation)
   - [Rate Limits](#rate-limits)
   - [Batch API](#batch-api)
   - [Webhooks (Ad Account)](#webhooks-ad-account)
2. [Campaign Structure & Objectives](#2-campaign-structure--objectives)
   - [ODAX Objectives Map](#odax-objectives-map-v210-required-for-all-new-campaigns)
   - [Advantage+ Campaigns](#advantage-campaigns-the-new-default)
   - [Campaign Objective Selection Decision Tree](#campaign-objective-selection-decision-tree)

---

## 1. API Overview & Authentication

### Current Version Status

| Version | Release | Status |
|---------|---------|--------|
| v25.0 | Feb 18, 2026 | Current |
| v24.0 | Apr 8, 2026 (orig Oct 8, 2025) | Supported |
| v23.0 | Jan 15, 2026 | Supported |
| v22.0 | Feb 11, 2026 | Minimum (required since Sep 9, 2025) |
| v21.0 | Jun 26, 2025 | Deprecated |
| v20.0 | Jan 31, 2025 | Deprecated |

**Breaking change in v25.0:** Advantage+ Shopping and App Campaign creation/duplication deprecated. Effective for ALL API versions on May 19, 2026.

**Breaking change in v24.0:** Facebook video feeds placement deprecated — migrate to Facebook Reels. Messenger lead ads creation blocked via API (still available in Ads Manager). Batch API payload limited to 30 MB.

**Breaking change in v23.0:** Advantage+ Audience now default-enabled for new ad sets. `instagram_actor_id` replaced by `instagram_user_id`.

**Breaking change in v22.0:** `instagram_actor_id` → migrate to `instagram_user_id`. `promotions` field → use `promotion_details`.

**Breaking change in v21.0:** ODAX (Outcome-Driven Ad Experience) objectives required for ALL new campaigns.

**Breaking change in v20.0:** Offline Conversions API discontinued May 2025 — use standard CAPI with `action_source` instead. Sponsored Messages ad creation removed.

### Base URL

```
https://graph.facebook.com/v25.0/
```

### Campaign Hierarchy

```
Business Manager
  └── Ad Account (act_XXXXXXXXX)
        └── Campaign (objective, budget type)
              └── Ad Set (audience, placement, schedule, budget)
                    └── Ad (creative + ad set link)
                          └── Ad Creative (images, video, copy, CTA)
```

### Authentication Setup

**Recommended for production:** System User Access Token (non-expiring).

**7-step setup:**
1. Go to developers.facebook.com → create app (Business use case) → enable Marketing API → get App ID
2. In Business Manager → Business Settings → Users → System Users → Add
3. Assign system user admin/advertiser access to the ad account and the app
4. Generate token: System Users → Generate New Token → select app → grant scopes
5. Required OAuth scopes: `ads_management` (write), `ads_read` (read), optionally `business_management`
6. For client accounts (third-party): requires Standard Access + business verification + app review
7. Test: `GET /me/adaccounts` and `GET /act_{AD_ACCOUNT_ID}/campaigns`

**Token types:**

| Type | Lifespan | Use Case |
|------|----------|----------|
| Short-lived user token | ~1 hour | Testing in Graph Explorer |
| Long-lived user token | ~60 days | Scripts with manual renewal |
| System user token | Non-expiring (or 60-day optional) | Production server-to-server |

**Security rules:**
- NEVER embed tokens in client-side code
- Store encrypted in secure environments
- System user and token owner must be in same Business Manager
- To generate expiring system token: add `set_token_expires_in_60_days=true`

### Core CRUD Endpoints

| Operation | Endpoint | Method |
|-----------|----------|--------|
| List campaigns | `/act_{AD_ACCOUNT_ID}/campaigns` | GET |
| Create campaign | `/act_{AD_ACCOUNT_ID}/campaigns` | POST |
| Update campaign | `/{CAMPAIGN_ID}` | POST |
| Delete campaign | `/{CAMPAIGN_ID}` | DELETE |
| List ad sets | `/act_{AD_ACCOUNT_ID}/adsets` | GET |
| Create ad set | `/act_{AD_ACCOUNT_ID}/adsets` | POST |
| List ads | `/act_{AD_ACCOUNT_ID}/ads` | GET |
| Create ad creative | `/act_{AD_ACCOUNT_ID}/adcreatives` | POST |
| Create ad | `/act_{AD_ACCOUNT_ID}/ads` | POST |
| Upload image | `/act_{AD_ACCOUNT_ID}/adimages` | POST |
| Upload video | `/act_{AD_ACCOUNT_ID}/advideos` | POST |
| Get insights | `/{OBJECT_ID}/insights` | GET |

### Campaign Creation (minimum required fields)

```json
POST /act_{AD_ACCOUNT_ID}/campaigns
{
  "name": "Campaign Name",
  "objective": "OUTCOME_SALES",
  "status": "PAUSED",
  "buying_type": "AUCTION",
  "special_ad_categories": []
}
```

**ODAX Objectives (required from v21.0+):**
- `OUTCOME_AWARENESS` — Reach, Brand Awareness, Video Views
- `OUTCOME_TRAFFIC` — Link Clicks, Landing Page Views
- `OUTCOME_ENGAGEMENT` — Post Engagement, Video Views, Followers
- `OUTCOME_LEADS` — Lead Gen Forms, Conversions (leads), Calls
- `OUTCOME_APP_PROMOTION` — App Installs, App Events
- `OUTCOME_SALES` — Purchases, Catalog Sales, Conversions

### Ad Set Creation (minimum required fields)

```json
POST /act_{AD_ACCOUNT_ID}/adsets
{
  "name": "Ad Set Name",
  "campaign_id": "{CAMPAIGN_ID}",
  "daily_budget": 5000,
  "billing_event": "IMPRESSIONS",
  "optimization_goal": "OFFSITE_CONVERSIONS",
  "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
  "targeting": {
    "geo_locations": { "countries": ["US"] },
    "age_min": 18,
    "age_max": 65
  },
  "start_time": "2026-05-10T00:00:00+0000",
  "status": "PAUSED"
}
```

**Budget is in cents.** `daily_budget: 5000` = $50.00/day.

### Ad Creative + Ad Creation

```json
POST /act_{AD_ACCOUNT_ID}/adcreatives
{
  "name": "Creative Name",
  "object_story_spec": {
    "page_id": "{PAGE_ID}",
    "link_data": {
      "link": "https://example.com",
      "message": "Primary text here",
      "image_hash": "{IMAGE_HASH}",
      "call_to_action": {
        "type": "SHOP_NOW",
        "value": { "link": "https://example.com" }
      }
    }
  }
}

POST /act_{AD_ACCOUNT_ID}/ads
{
  "name": "Ad Name",
  "adset_id": "{AD_SET_ID}",
  "creative": { "creative_id": "{CREATIVE_ID}" },
  "status": "PAUSED"
}
```

**Social proof tip:** Use `object_story_id: "{PAGE_ID}_{POST_ID}"` to run dark posts from existing page posts — all engagement accumulates on the single post across all ad variations.

### Rate Limits

**System:** Business Use Case (BUC) Rate Limits. Applied per ad account per use case.

| Tier | Max Score | Decay Rate | Block Duration |
|------|-----------|------------|----------------|
| Development | 60 pts | 300 seconds | 300 seconds |
| Standard | 9,000 pts | 300 seconds | 60 seconds |

- Read call = 1 point
- Write call = 3 points
- Heavy Insights queries count more

**Key headers to monitor:**
- `X-Business-Use-Case-Usage` — how close to BUC rate limit
- `x-fb-ads-insights-throttle` — Insights API throttle status

**Error codes:**
- `613` — Rate limit exceeded
- `80004` — Rate limit reached
- `100` — Missing/invalid param or permission
- `200` — Permission denied
- `803` — Object not found

**Best practices:**
- Exponential backoff: 1s, 2s, 4s, 8s between retries
- Distribute calls evenly; avoid traffic spikes
- Use batch requests to minimize total call count
- For Insights: use async requests for large queries

### Batch API

Up to **50 requests per batch**. POST to any endpoint with a `batch` JSON array:

```
POST /act_{AD_ACCOUNT_ID}?batch=[...operations]&access_token={TOKEN}
```

Each operation:
```json
{
  "method": "POST",
  "relative_url": "act_{AD_ACCOUNT_ID}/campaigns",
  "body": "name=Test+Campaign&objective=OUTCOME_SALES&status=PAUSED&buying_type=AUCTION"
}
```

**Dependent requests** (sequential): Reference previous result with `{result=create-campaign:$.id}`.

**Response:** Array of `{code, headers, body}` objects matching request order. Failed ops return error codes; successful ops complete normally. Timeout returns `null` for incomplete requests.

**Batch payload limit:** 30 MB (as of v24.0).

### Webhooks (Ad Account)

Subscribe to real-time notifications at `POST /{ad-account-id}/subscribed_apps`.

**Subscribable fields:**

| Field | Trigger |
|-------|---------|
| `with_issues_ad_objects` | Campaign/ad set/ad enters WITH_ISSUES status |
| `in_process_ad_objects` | Object finishes processing, exits IN_PROCESS |
| `ad_recommendations` | New optimization recommendations generated |
| `creative_fatigue` | Ad enters/exits fatigue (Low/Medium/High levels) |
| `product_set_issue` | Product set has issues affecting ads |

**Requirements:** App needs `ads_management` permission. Webhook endpoint must use HTTPS + TLS 1.2+. Verify with X-Hub-Signature-256 header.

---

## 2. Campaign Structure & Objectives

### ODAX Objectives Map (v21.0+, required for all new campaigns)

| ODAX Objective | Legacy Equivalent | Use When |
|----------------|-------------------|----------|
| `OUTCOME_AWARENESS` | REACH, BRAND_AWARENESS | Top-funnel brand building; CPM optimization |
| `OUTCOME_TRAFFIC` | TRAFFIC | Drive landing page views; not conversion-focused |
| `OUTCOME_ENGAGEMENT` | ENGAGEMENT | Video views, post likes, page follows |
| `OUTCOME_LEADS` | LEAD_GENERATION | Lead forms, consultation bookings, B2B |
| `OUTCOME_APP_PROMOTION` | APP_INSTALLS | Mobile app install and re-engagement |
| `OUTCOME_SALES` | CONVERSIONS, CATALOG_SALES | E-commerce purchases, catalog, value optimization |

### Advantage+ Campaigns (The New Default)

As of v23.0+, Meta's ecosystem has converged on a unified "Advantage+ Campaign Experience." Legacy ASC/AAC APIs are fully deprecated by May 19, 2026.

**Three levers that unlock Advantage+:**

| Lever | Setting | What It Does |
|-------|---------|--------------|
| Advantage+ Budget | Campaign-level CBO with approved bid strategy | AI allocates spend across ad sets |
| Advantage+ Audience | Geo + age as hard constraints only | AI finds audiences beyond your suggestions |
| Advantage+ Placement | All placements eligible, no exclusions | AI picks best placements per impression |

**Approved bid strategies for Advantage+ Budget:**
- `LOWEST_COST_WITHOUT_CAP`
- `COST_CAP`
- `LOWEST_COST_WITH_BID_CAP`
- `LOWEST_COST_WITH_MIN_ROAS`

**Campaign state field:** `advantage_state_info` (introduced v23.0) — indicates if a campaign is in Advantage+ mode.

**Campaign-type states after migration:**
- Sales: `ADVANTAGE_PLUS_SALES`
- App: `ADVANTAGE_PLUS_APP`
- Leads: `ADVANTAGE_PLUS_LEADS`
- All show `smart_promotion_type: GUIDED_CREATION`

**Performance benchmarks (Meta internal data):**
- 22% average ROAS improvement vs legacy structure
- 32% lower CPA in e-commerce and lead gen
- 13% lower cost per catalog sale vs manual targeting

**ASC limitations:**
- Cannot exclude existing customers from targeting
- No demographic-level control (age, gender, interests) as hard filters
- No placement selection/exclusion
- Limited reporting visibility into optimization decisions
- Max 150 total ads, 50 per ad set

**Use Advantage+ when:**
- Scaling broad prospecting or mid-funnel conversions
- 50+ conversions/week per ad set
- Strong creative assets available
- Products with wide market appeal

**Use manual campaigns when:**
- Niche B2B with small, well-defined audiences
- Testing specific creative or audience hypotheses
- Budget under $30/day (insufficient data for AI)
- Hyper-local campaigns with tight geo focus

### Campaign Objective Selection Decision Tree

```
Goal: Drive awareness / reach?
  → OUTCOME_AWARENESS

Goal: Drive website traffic (non-conversion)?
  → OUTCOME_TRAFFIC

Goal: Collect leads / form submissions?
  → OUTCOME_LEADS

Goal: App installs or re-engagement?
  → OUTCOME_APP_PROMOTION

Goal: E-commerce sales / catalog?
  → OUTCOME_SALES (+ catalog if product feed available)

Goal: Video views / engagement?
  → OUTCOME_ENGAGEMENT
```

---

## API Quick Reference

### Campaign Objectives (v21.0+ ODAX)

```
OUTCOME_AWARENESS
OUTCOME_TRAFFIC
OUTCOME_ENGAGEMENT
OUTCOME_LEADS
OUTCOME_APP_PROMOTION
OUTCOME_SALES
```

### Optimization Goals

```
REACH, IMPRESSIONS, LINK_CLICKS, LANDING_PAGE_VIEWS,
OFFSITE_CONVERSIONS, VALUE, APP_INSTALLS, APP_EVENTS,
LEAD_GENERATION, QUALITY_LEAD, THRUPLAY, VIDEO_VIEWS,
REPLIES, ENGAGED_USERS, POST_ENGAGEMENT
```

### Bid Strategies

```
LOWEST_COST_WITHOUT_CAP        # Highest Volume
COST_CAP                       # Cost Cap
LOWEST_COST_WITH_BID_CAP       # Bid Cap
LOWEST_COST_WITH_MIN_ROAS      # ROAS Goal
VALUE_BASED                    # Maximize Value / Maximize ROAS
```

### Status Values

```
ACTIVE, PAUSED, DELETED, ARCHIVED, IN_PROCESS, WITH_ISSUES
```

### Special Ad Categories

```
EMPLOYMENT
HOUSING
CREDIT (legacy)
FINANCIAL_PRODUCTS_AND_SERVICES (2025+)
ISSUES_ELECTIONS_POLITICS
```

### Placement Fields

```json
{
  "publisher_platforms": ["facebook", "instagram", "messenger", "audience_network"],
  "facebook_positions": ["feed", "reels", "right_hand_column", "marketplace", "search", "story"],
  "instagram_positions": ["stream", "story", "reels"],
  "messenger_positions": ["messenger_home"],
  "audience_network_positions": ["classic", "rewarded_video"]
}
```

### WhatsApp Marketing Messages in Ads Manager

Since July 2025, WhatsApp marketing message campaigns can be managed from Ads Manager:
- Placement: **WhatsApp Marketing Messages**
- Audience: Custom audiences only (opted-in subscriber lists)
- Meta AI optimizes which subscribers receive the message
- **US pause:** Marketing templates to US +1 numbers paused since April 2025

---

## Automation Patterns

### Marketing API Automation Patterns

**Pattern 1: Daily performance monitor + auto-pause**
```python
import requests

def check_and_pause_underperformers(ad_account_id, token, cpa_threshold):
    # Get ad set performance (last 3 days)
    url = f"https://graph.facebook.com/v25.0/act_{ad_account_id}/insights"
    params = {
        "level": "adset",
        "date_preset": "last_3d",
        "fields": "adset_id,adset_name,spend,cost_per_action_type,campaign_learning_stage_info",
        "action_attribution_windows": '["7d_click","1d_view"]',
        "access_token": token
    }
    data = requests.get(url, params=params).json()

    for row in data.get("data", []):
        # Skip ad sets still in learning phase
        learning_stage = row.get("campaign_learning_stage_info", {})
        if learning_stage.get("status") == "LEARNING":
            continue

        spend = float(row.get("spend", 0))
        actions = row.get("cost_per_action_type", [])
        purchase_cpa = next(
            (float(a["value"]) for a in actions if a["action_type"] == "purchase"),
            None
        )

        # Pause if spent 2x threshold with no purchase, or CPA > threshold
        if spend > cpa_threshold * 2 and purchase_cpa is None:
            pause_ad_set(row["adset_id"], token)
        elif purchase_cpa and purchase_cpa > cpa_threshold * 1.5 and spend > cpa_threshold:
            pause_ad_set(row["adset_id"], token)

def pause_ad_set(adset_id, token):
    url = f"https://graph.facebook.com/v25.0/{adset_id}"
    requests.post(url, data={"status": "PAUSED", "access_token": token})
```

**Pattern 2: Budget scaling (winners)**
```python
def scale_winners(ad_account_id, token, roas_threshold, scale_percent=0.20):
    url = f"https://graph.facebook.com/v25.0/act_{ad_account_id}/insights"
    params = {
        "level": "adset",
        "date_preset": "last_7d",
        "fields": "adset_id,spend,purchase_roas",
        "access_token": token
    }
    data = requests.get(url, params=params).json()

    for row in data.get("data", []):
        roas_data = row.get("purchase_roas", [])
        if not roas_data:
            continue
        roas = float(roas_data[0].get("value", 0))

        if roas >= roas_threshold:
            # Get current budget
            adset_url = f"https://graph.facebook.com/v25.0/{row['adset_id']}"
            adset = requests.get(adset_url, params={
                "fields": "daily_budget",
                "access_token": token
            }).json()
            current_budget = int(adset.get("daily_budget", 0))
            new_budget = int(current_budget * (1 + scale_percent))
            # POST new budget
            requests.post(adset_url, data={
                "daily_budget": new_budget,
                "access_token": token
            })
```

**Pattern 3: Batch campaign creation**
```python
import json, requests

def batch_create_ad_sets(ad_account_id, token, ad_sets):
    batch = []
    for i, adset in enumerate(ad_sets):
        batch.append({
            "method": "POST",
            "relative_url": f"act_{ad_account_id}/adsets",
            "body": "&".join(f"{k}={v}" for k, v in adset.items()),
            "name": f"create-adset-{i}"
        })

    # Batches of max 50
    for chunk in [batch[i:i+50] for i in range(0, len(batch), 50)]:
        response = requests.post(
            f"https://graph.facebook.com/v25.0/",
            data={
                "batch": json.dumps(chunk),
                "access_token": token,
                "include_headers": "false"
            }
        )
        results = response.json()
        for result in results:
            if result["code"] != 200:
                print(f"Error: {result['body']}")
```

### Automated Rules via API

```python
def create_automation_rule(ad_account_id, token, rule_name, conditions, action):
    url = f"https://graph.facebook.com/v25.0/act_{ad_account_id}/adrules_library"
    rule_data = {
        "name": rule_name,
        "entity_type": "ADSET",
        "evaluation_spec": {
            "evaluation_type": "TRIGGER",
            "filters": conditions,
            "trigger": {"type": "TIME_SERIES", "field": "time"}
        },
        "execution_spec": {
            "execution_type": action["type"],
            "execution_options": action.get("options", {})
        },
        "schedule_spec": {
            "schedule_type": "SEMI_HOURLY"
        }
    }
    requests.post(url, json={"access_token": token, **rule_data})
```

### Creative Rotation Strategy

1. Launch 3-5 creative concepts per ad set
2. After 7 days or 50 optimization events per variant: identify winners
3. Scale budget to top 2-3 performers; pause bottom performers
4. Refresh creative every 2-3 weeks (before frequency hits 2.5)
5. Never let creative library drop below 3 active assets per ad set

**Creative testing velocity target (2026):** 15-50+ active creatives needed for Meta's algorithm to properly optimize. Aim for 10-30 new creatives/month in active accounts.

---
