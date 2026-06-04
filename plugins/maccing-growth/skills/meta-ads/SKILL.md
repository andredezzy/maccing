---
name: meta-ads
description: Meta Ads (Facebook + Instagram) production reference. Use when managing Meta/Facebook/Instagram ad campaigns, creating ads, CAPI setup, audience targeting, creative testing, or automating via Marketing API. Triggers on "meta ads", "facebook ads", "instagram ads", "CAPI", "conversions API", "meta pixel", "advantage+", "lookalike audience", "custom audience", "meta campaign", "facebook campaign", "ad set", "ad creative", "click-to-whatsapp", "CTWA".
---

# Meta Ads (Facebook + Instagram) Skill

Comprehensive production reference for Meta Ads. Covers Marketing API, campaign types, targeting, creative, bidding, CAPI, tracking, reporting, compliance, automation, and 2025-2026 best practices.

```
MANDATORY: Read project context BEFORE any action.
ALWAYS read: .maccing/growth/README.md (if exists)
             .maccing/growth/meta/<bm>/ads/<account>/README.md (if exists)
These contain current state: BM status, pipeline progress, pending actions.
Without reading them, you WILL operate on stale data.
```

**Related skill:** `whatsapp` — load when working with CTWA ads, WhatsApp message dispatch, template creation, bulk sending, or WhatsApp Flows. This skill covers the ad side (campaign setup, CAPI attribution, remarketing audiences); `whatsapp` covers the messaging side (Cloud API, templates, pricing, webhooks).

**Current API version:** v25.0 (Feb 2026) — minimum supported: v22.0 (as of Sep 2025)

---

## Table of Contents

1. [API Overview & Authentication](#1-api-overview--authentication)
2. [Campaign Structure & Objectives](#2-campaign-structure--objectives)
3. [Audience Targeting](#3-audience-targeting)
4. [Ad Formats & Creative](#4-ad-formats--creative)
5. [Bidding & Budget](#5-bidding--budget)
6. [Conversions API (CAPI)](#6-conversions-api-capi)
7. [Pixel & Tracking](#7-pixel--tracking)
8. [Reporting & Analytics](#8-reporting--analytics)
9. [Meta Business Suite & Ads Manager](#9-meta-business-suite--ads-manager)
10. [Compliance & Policies](#10-compliance--policies)
11. [Automation & Scripts](#11-automation--scripts)
12. [2025-2026 Best Practices](#12-2025-2026-best-practices)

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

## 3. Audience Targeting

### Targeting Hierarchy (2026 Reality)

The paradigm has shifted fundamentally:
- **Interest targeting:** Now suggestions, not hard constraints (in most objectives)
- **Detailed targeting exclusions:** Removed from Ads Manager in March 2025
- **Interest categories:** Consolidated into broader groupings (Jun 2025)
- **The primary targeting tool is now your creative** — it signals who should see the ad

### Targeting Types & API Fields

```json
{
  "targeting": {
    "geo_locations": {
      "countries": ["US", "CA"],
      "regions": [{"key": "4081"}],
      "cities": [{"key": "2418779", "radius": 25, "distance_unit": "mile"}],
      "zips": [{"key": "US:94102"}]
    },
    "age_min": 25,
    "age_max": 54,
    "genders": [1, 2],
    "interests": [{"id": "6003107902433", "name": "Fitness"}],
    "behaviors": [{"id": "6002714895372", "name": "Engaged Shoppers"}],
    "custom_audiences": [{"id": "{CUSTOM_AUDIENCE_ID}"}],
    "excluded_custom_audiences": [{"id": "{PURCHASERS_AUDIENCE_ID}"}],
    "lookalike_audiences": [{"id": "{LOOKALIKE_AUDIENCE_ID}"}],
    "publisher_platforms": ["facebook", "instagram"],
    "facebook_positions": ["feed", "video_feeds", "reels"],
    "instagram_positions": ["stream", "story", "reels"]
  }
}
```

### Advantage+ Audience vs Detailed Targeting

| Dimension | Advantage+ Audience | Detailed Targeting |
|-----------|--------------------|--------------------|
| How it works | AI finds buyers based on conversion signals; interests are soft hints | Manual interest/behavior/demo layers |
| Hard constraints | Location, minimum age only | All parameters are enforced |
| Performance (Meta internal) | 32% lower CPA, 13% lower cost per catalog sale | Baseline |
| When to use | 50+ weekly conversions, $50+/day, scaling campaigns | New accounts, niche B2B, budgets <$30/day |
| CPA difference | Up to 32% lower | Baseline |
| CTR improvement | 11-15% higher | Baseline |

**Advantage+ Audience setup:** Set location and age as hard controls. Place customer exclusions in "Controls" section. Treat interests/demographics as suggestions only. Creative drives audience signal.

### Custom Audiences

**Types available:**

| Type | Source | Retention |
|------|--------|-----------|
| Website Custom Audience | Meta Pixel events | Up to 180 days |
| App Activity | Mobile SDK events | Up to 180 days |
| Customer List | Uploaded CSV (hashed email/phone) | Upload fresh every 90 days |
| Engagement | Video views, IG/FB engagement, Lead Form openers | Up to 365 days |
| Offline Events | Via CAPI with offline action_source | Configurable |

**Customer List upload fields (hashed SHA256):**
- `em` — email
- `ph` — phone (E.164 format)
- `fn`, `ln` — first/last name (lowercase)
- `zip`, `ct`, `st`, `country` — address components
- `doby`, `dobm`, `dobd` — date of birth components
- `uid` — your external customer ID

**Match rate:** Meta matches 40-60% of uploaded lists.

### Lookalike Audiences

**API creation:**

```json
POST /act_{AD_ACCOUNT_ID}/customaudiences
{
  "name": "LLA 1% - Purchasers",
  "subtype": "LOOKALIKE",
  "origin_audience_id": "{SEED_AUDIENCE_ID}",
  "lookalike_spec": {
    "type": "similarity",
    "ratio": 0.01,
    "country": "US"
  }
}
```

**Best practices:**

| Factor | Recommendation |
|--------|---------------|
| Seed size | 1,000 minimum; 10,000+ for significantly better results |
| Seed quality | Top 10% by LTV or closed-won customers, NOT all form fills |
| Recency | Recent purchasers (last 90 days) outperform all-time |
| Percentage | 1-2% for highest similarity; 3-10% for broader scale |
| Refresh | Every 90 days with fresh data |
| Exclusion | Exclude seed audience from LLA campaigns to keep prospecting clean |

**Performance note:** LLAs built from closed-won customers deliver 20-40% downstream ROI improvement vs LLAs built from form fills.

### Geo Targeting

- Country, region, city, DMA, zip code
- Radius targeting from city (in miles or kilometers)
- Can include and exclude locations
- For Special Ad Categories (Finance, Housing, Employment): minimum 15-mile radius, no zip targeting, no location exclusions
- For local lead gen: geo filter is the ONE manual filter still worth enforcing in 2026

### Interest/Behavior Targeting Status (2026)

- Still technically available but treated as "suggestions" in most objectives
- Meta consolidated many specific interests into broader groups (Jun 2025)
- Specific removal examples: EDM fans, SUVs, vegan food — merged into broad groups
- Detailed targeting exclusions removed from Ads Manager (March 2025)
- Practical advice: use broad targeting + strong CAPI signal instead of interest stacking

---

## 4. Ad Formats & Creative

### Format Overview

| Format | Placements | Best For |
|--------|-----------|----------|
| Single Image | Feed, Stories, Reels, Marketplace, Right Column | Product showcase, offers |
| Single Video | Feed, Stories, Reels, Audience Network | Demo, testimonials, UGC |
| Carousel | Feed, Stories | Product catalog, multi-feature, storytelling |
| Collection | Feed, Instant Experience | E-commerce browsing |
| Stories | Stories only | Full-screen immersive |
| Reels | Reels only | Discovery, entertainment-first |
| Catalog/Dynamic | Feed, Reels, Stories | Retargeting, dynamic product ads |
| Lead Form | Feed, Stories | Direct lead capture |

### Creative Specifications (2026)

#### Image Ads

| Placement | Recommended Size | Aspect Ratio | Max File Size | Formats |
|-----------|-----------------|--------------|---------------|---------|
| Feed (FB+IG) | 1080×1350 px | 4:5 (vertical) | 30 MB | JPG, PNG |
| Feed (square) | 1080×1080 px | 1:1 | 30 MB | JPG, PNG |
| Stories | 1080×1920 px | 9:16 | 30 MB | JPG, PNG |
| Reels | 1080×1920 px | 9:16 | 30 MB | JPG, PNG |
| Right Column (desktop only) | 1080×1080 px | 1:1 | 30 MB | JPG, PNG |
| Marketplace | 1080×1080 px | 1:1 | 30 MB | JPG, PNG |
| Messenger | 1200×628 px | 1.91:1 | 30 MB | JPG, PNG |

**Source file recommendation:** Export at 1440×1440 px or higher for retina sharpness.

#### Video Ads

| Placement | Recommended Size | Duration | Max File | Codec |
|-----------|-----------------|----------|----------|-------|
| Feed (FB+IG) | 1080×1350 (4:5) or 1080×1080 (1:1) | 15-60s optimal | 4 GB | H.264 + AAC |
| Feed vertical | 1080×1920 (9:16) | 15-60s optimal | 4 GB | H.264 + AAC |
| Stories | 1080×1920 (9:16) | Up to 15s per card | 4 GB | H.264 + AAC |
| Facebook Reels | 1080×1920 (9:16) | No maximum limit | 4 GB | H.264 + AAC |
| Instagram Reels | 1080×1920 (9:16) | Up to 15 min | 4 GB | H.264 + AAC |

**Export settings:** MP4 or MOV, H.264 video, AAC audio at 128 kbps+, up to 30 fps, 5,000-10,000 kbps bitrate for 1080p. Audio required (even music-only).

**Safe zones:**
- Stories/Reels: Keep critical content away from top 250px and bottom 250-340px (UI elements)
- Reels: Keep bottom 35% clear for UI overlay
- Reels: Keep sides 6% clear

#### Carousel Ads

- 2-10 cards per carousel
- Each card: 1080×1080 px (1:1), max 30 MB/image, 4 GB/video
- All cards must share the same aspect ratio
- Can mix images and videos
- Unique landing URL per card
- Text: 40-char headline, 20-char description, 125-char primary text (applies to whole carousel)

**Update as of Jan 2026:** Instagram Explore feed removed — ads previously running there now serve in Reels.

#### Text Limits

| Element | Limit |
|---------|-------|
| Primary text | 125 characters visible (truncated after) |
| Headline | 40 characters |
| Description | 25-30 characters |
| Messenger headline | 20 characters only |
| Carousel headline per card | 40 characters |
| Carousel description per card | 20 characters |

**Text overlay:** Officially no 20% rule, but ads with heavy image text still experience reduced delivery and higher costs.

### Advantage+ Creative

Meta's AI system that automatically tests creative variations:

- Supports: up to 10 images/videos, 5 headlines, 5 primary texts, 5 descriptions, 5 CTA buttons
- Automatically varies: backgrounds, formats, text placements, music, responsive layouts
- Uses ML on audience data, user activity, interest signals, behavioral data
- Acts as a live feedback loop, refreshing assets based on real-time performance

**DCO (Dynamic Creative Optimization) process:**
1. Upload creative assets (images, videos, copy variants)
2. Meta tests combinations across audience segments
3. Algorithm identifies winning combos per audience segment
4. Winning combos get more delivery; losers get less
5. Creative is refreshed to prevent fatigue

**Performance results:** Studies show 33% install lift on ad networks, 65% on socials from creative optimization. One fintech case: 40% ROAS increase, 82% CPP decrease.

**Enable DCO in API:**
```json
POST /act_{AD_ACCOUNT_ID}/adcreatives
{
  "name": "DCO Creative",
  "asset_feed_spec": {
    "images": [{"hash": "abc..."}, {"hash": "def..."}],
    "titles": [{"text": "Headline 1"}, {"text": "Headline 2"}],
    "bodies": [{"text": "Primary text 1"}, {"text": "Primary text 2"}],
    "call_to_action_types": ["SHOP_NOW", "LEARN_MORE"],
    "link_urls": [{"website_url": "https://example.com"}]
  }
}
```

### UGC (User-Generated Content) Ads

**Why UGC outperforms polished production:**
- 92% of consumers trust UGC over traditional ads
- 4x higher CTR vs traditional ads
- 50% lower CPC
- 31% more memorable
- Authentic content outperforms studio ads "9 out of 10 accounts"

**High-performing UGC types:**
- Selfie-style customer testimonials (vertical, raw)
- Tradesperson/expert at work explaining product
- How-to routines showing product in real-life context
- Unboxings and first impressions
- Before/after transformations (real, not staged)

**Hook formula for UGC video (first 3 seconds):**
- Pattern interrupt (unexpected visual or sound)
- Specific claim ("How I cut my CPL from $82 to $19 in 14 days")
- Direct question to target audience
- Before/after cut directly to result

**Whitelisting / Creator Licensing:**
Run ads through the creator's profile. The ad shows as from the influencer, not the brand. Access via Meta's Partnership Ads (formerly Branded Content ads).

**Legal requirement:** Always get written permission before repurposing customer-created content.

### Catalog / Product Feed Ads (Advantage+ Catalog)

**Feed format:** CSV, TSV, RSS XML, or ATOM XML

**Required fields:**

| Field | Format | Notes |
|-------|--------|-------|
| `id` | String | Unique product SKU |
| `title` | String | Product name |
| `description` | String | Detailed description |
| `availability` | Enum | `in stock`, `out of stock`, `preorder`, `available for order`, `discontinued` |
| `condition` | Enum | `new`, `refurbished`, `used` |
| `price` | `XX.XX CUR` | e.g., `29.99 USD` |
| `link` | URL | Product page |
| `image_link` | URL | Main image |
| `brand` | String | Manufacturer/brand |

**Highly recommended fields:** `sale_price`, `google_product_category`, `product_type`, `additional_image_link` (up to 20), `custom_label_0-4`

**Custom labels strategy:**
- `custom_label_0`: Margin tier (high/medium/low)
- `custom_label_1`: Seasonal (holiday/summer/evergreen)
- `custom_label_2`: Performance (bestseller/new/slow-mover)
- `custom_label_3`: Inventory level (overstock/limited/normal)
- `custom_label_4`: Price tier

**Setup path:** Commerce Manager → Add Catalog → Ecommerce → choose feed delivery method → map columns → validate via Diagnostics → 24-48h approval

**Dynamic Media (September 2025 change):** 100% enforcement of Dynamic Media started October 20, 2025. All new Advantage+ Catalog ads must include Dynamic Media functionality.

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

## 6. Conversions API (CAPI)

### Why CAPI is Non-Negotiable in 2026

- iOS 14.5+ opted out majority of users from IDFA tracking
- Ad blockers block 15-40% of Pixel events
- CAPI bypasses browser restrictions: near-100% data accuracy vs 60-85% pixel-only
- Pixel-only accounts are penalized in ad quality scores
- Properly configured CAPI + Pixel = 10-34% more reported conversions

**Offline Conversions API deprecated May 2025.** All offline tracking now via CAPI with `action_source: "physical_store"` or `"system_generated"`.

### Three Implementation Methods

| Method | Setup Time | Monthly Cost | Best For |
|--------|------------|--------------|----------|
| CAPI Gateway (Meta's no-code) | 2-4 hours | $10-400+/pixel | Meta-only, quick setup |
| Server-Side GTM (Stape/sGTM) | 4-8 hours | $10-50 | Multi-platform (Meta+Google+TikTok) |
| Direct/Manual API | 20-40 dev hours | $500-5,000 setup | Custom platforms, offline events |

**Recommended:** Server-Side GTM for most advertisers. Direct API for custom platforms or complex offline flows.

**CAPI Gateway (Meta native):**
- Events Manager → Data Sources → select Pixel → Conversions API → Set up gateway
- Pay-as-you-go: $10/month/pixel; Unlimited: $100/month for 100 pixels
- Available zones: US (North America), Belgium (Europe), Brazil (South America), Singapore (Asia Pacific), Japan (Asia Northeast)
- **Mandatory:** Use European zone for any EU traffic (GDPR)
- Limitation: Only mirrors browser Pixel events; cannot capture server-only conversions

**sGTM (Stape/server-side GTM):**
- Centralized hub: one server container sends to Meta, Google, TikTok
- Templates available in Stape for all Meta CAPI tags and triggers
- Enables enriching events with server-side data before sending

### CAPI Endpoint & Required Parameters

```
POST https://graph.facebook.com/v25.0/{PIXEL_ID}/events?access_token={TOKEN}
```

```json
{
  "data": [
    {
      "event_name": "Purchase",
      "event_time": 1746700000,
      "event_id": "uuid-v4-unique-per-event",
      "action_source": "website",
      "event_source_url": "https://example.com/thank-you",
      "user_data": {
        "em": ["sha256_hashed_email"],
        "ph": ["sha256_hashed_phone"],
        "fn": "sha256_hashed_firstname",
        "ln": "sha256_hashed_lastname",
        "fbp": "_fbp_cookie_value_DO_NOT_HASH",
        "fbc": "_fbc_click_id_value_DO_NOT_HASH",
        "client_ip_address": "203.0.113.1",
        "client_user_agent": "Mozilla/5.0..."
      },
      "custom_data": {
        "currency": "USD",
        "value": 149.99,
        "order_id": "ORD-12345",
        "content_ids": ["SKU-001", "SKU-002"],
        "content_type": "product"
      }
    }
  ]
}
```

**`action_source` values:**
- `"website"` — web purchase
- `"physical_store"` — in-store (replaces old Offline API)
- `"system_generated"` — CRM event (demo booked, closed-won)
- `"app"` — mobile app event
- `"email"` — email interaction
- `"phone_call"` — phone conversion
- `"business_messaging"` — WhatsApp / messaging channel conversion (use with `messaging_channel`)

### User Data Parameters (EMQ Impact)

| Parameter | Hashing | EMQ Impact | Notes |
|-----------|---------|------------|-------|
| `em` (email) | SHA256 required | +4 points | Highest single-field impact |
| `ph` (phone) | SHA256 required (E.164 first) | +3 points | Include country code |
| `fn`, `ln` | SHA256 required (lowercase) | +1-2 points | First/last name |
| `fbp` | **DO NOT HASH** | High | Browser ID from `_fbp` cookie |
| `fbc` | **DO NOT HASH** | High | Click ID from `fbclid` parameter |
| `client_ip_address` | No hashing | Medium | Server's request IP |
| `client_user_agent` | No hashing | Medium | Browser UA string |
| `external_id` | SHA256 | Medium | Your customer ID |

**Critical gotcha:** `fbp` and `fbc` must NOT be hashed. These are Meta's own browser-set values.

### Event Match Quality (EMQ) Score

Scale: 0-10 per event.

**Targets:**
- Purchase events: 8.8-9.3
- AddToCart: 8.0+
- PageView: 6.5-7.5
- Meta baseline: ~6.0

**To maximize EMQ:**
1. Send hashed email with every event
2. Send hashed phone with every event
3. Include `fbp` and `fbc` (from cookies, unhashed)
4. Enable Advanced Matching in Events Manager
5. Send events within 1 hour of occurrence

EMQ updates every 48 hours. Meaningful performance gains appear within 2-4 weeks.

### Event Deduplication

**How it works:** Meta matches on `event_name` + `event_id` within a 48-hour window. Keeps only one event per pair.

**Implementation:**
1. Generate a UUID v4 or ULID for each conversion event
2. Pass identical `event_id` to both Meta Pixel (`fbq('track', 'Purchase', {}, {eventID: 'uuid'})`) and CAPI POST body
3. Exact string match required (case-sensitive, no whitespace)
4. Pixel fires first naturally (browser-side instant); CAPI arrives seconds later — Meta deduplicates correctly

**Common errors:**
- Hashing `fbp`/`fbc` — breaks matching
- Fabricating `fbc` values without actual ad clicks
- Delayed event transmission (>1 hour)
- Mismatched `event_id` between Pixel and CAPI
- Wrong `action_source` values

### Supported Standard Events

| Event | When to Fire |
|-------|-------------|
| `Purchase` | Transaction complete |
| `AddToCart` | Product added to cart |
| `InitiateCheckout` | Checkout page opened |
| `AddPaymentInfo` | Payment details entered |
| `Lead` | Lead form submitted |
| `CompleteRegistration` | Account registered |
| `ViewContent` | Product page viewed |
| `Search` | Site search performed |
| `AddToWishlist` | Wishlist interaction |
| `Contact` | Contact form submitted |
| `Schedule` | Appointment booked |
| `StartTrial` | Free trial started |
| `Subscribe` | Subscription activated |

**CRM integration tip:** Capture and store `fbclid` with contact records at initial conversion. Fire `Purchase` or `Schedule` events via CAPI with original lead's match keys when they close — this trains Meta to optimize toward actual customers, delivering 15-30% lower CPL with higher win rates.

---

## 7. Pixel & Tracking

### Meta Pixel Setup

**Installation options:**
1. Direct `<script>` tag in page `<head>` (manual)
2. Google Tag Manager (client-side, standard)
3. Shopify/WooCommerce native integration
4. Partner integrations

**Standard Pixel code:**
```html
<script>
!function(f,b,e,v,n,t,s){...}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '{PIXEL_ID}');
fbq('track', 'PageView');
</script>
```

**Standard events with deduplication:**
```javascript
fbq('track', 'Purchase', {
  value: 149.99,
  currency: 'USD',
  content_ids: ['SKU-001'],
  content_type: 'product'
}, {
  eventID: 'your-unique-event-id'
});
```

**Run Pixel + CAPI together always.** Pixel for real-time behavioral signals; CAPI for reliable conversion recording.

### Aggregated Event Measurement (AEM)

**Current state (as of June 2025):** Manual AEM configuration has been REMOVED. No more event prioritization interface, no more 8-event limit.

- AEM now runs automatically behind the scenes
- Meta aggregates all eligible events without manual intervention
- The "Aggregated Event Measurement" tab no longer exists in Events Manager
- Domain verification still recommended (not required for AEM specifically)

**What remains from iOS 14.5+ era:**
- Apple's ATT (App Tracking Transparency) still requires user permission for app tracking
- Web events through Pixel are still affected by browser restrictions (ITP, ad blockers)
- Solution: CAPI fills the gap. AEM aggregates both Pixel and CAPI signals automatically.

### Domain Verification

**Required for:** Link ownership claims, iOS app setup
**Strongly recommended for:** All advertisers running ads, using custom conversions, or configuring event measurement

**Setup path:** Events Manager → Connected Assets → Domains → Add → verify via DNS TXT record or HTML meta tag

### iOS 14.5+ Impact & Mitigations

**The problem:** Apple's ATT requires opt-in for cross-app tracking. Majority of iOS users opted out.

**Current mitigations:**
1. **CAPI** — server-side events bypass client restrictions entirely
2. **Automated AEM** — Meta models conversions from statistical signals
3. **First-party data** — email capture + CRM → Customer Match for targeting
4. **Broad targeting** — less reliance on precise individual tracking
5. **Aggregated reporting** — some iOS data modeled, not exact

**sGTM advantage:** Server-side container sets first-party cookies (1P-scoped), extending cookie lifetime beyond browser ITP limits.

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

## 10. Compliance & Policies

### Special Ad Categories

Four categories require explicit declaration before campaign creation:

| Category | API Value | Covers |
|----------|-----------|--------|
| Housing | `HOUSING` | Home sales, rentals, mortgages, home improvement |
| Employment | `EMPLOYMENT` | Job listings, internships, staffing, certification programs |
| Finance | `CREDIT` (legacy) / `FINANCIAL_PRODUCTS_AND_SERVICES` | Banking, savings, insurance, investment, credit, loans |
| Social Issues / Elections / Politics | `ISSUES_ELECTIONS_POLITICS` | Public opinion influence, political candidates |

**Finance category expansion (Jan 21, 2025):** Now covers banking services, savings accounts, insurance, investment services — not just credit. U.S. financial advertisers must use `FINANCIAL_PRODUCTS_AND_SERVICES` category.

**Declare in campaign creation:**
```json
{
  "special_ad_categories": ["FINANCIAL_PRODUCTS_AND_SERVICES"]
}
```

### Targeting Restrictions (Special Ad Categories)

When a special ad category is declared:

| Targeting Option | Finance/Housing/Employment | Social Issues/Politics |
|-----------------|--------------------------|----------------------|
| Age targeting | Locked to 18-65+ | Locked to 18+ |
| Gender | All genders required | All genders required |
| Geo minimum radius | 15 miles | Varies by country |
| ZIP code targeting | Prohibited | Prohibited |
| Location exclusions | Prohibited | Varies |
| Lookalike Audiences | Not available | Not available |
| Detailed targeting | Heavily restricted | Restricted |
| Advantage+ targeting expansion | Not available | Not available |
| Customer List Custom Audiences | Upload directly only; no cross-account sharing (from March 2025) | Varies |

### Financial Services Additional Rules

- Must not directly request PII (SSN, bank account numbers) in ads
- Business admin must review and accept Meta's non-discrimination policy in Business Settings
- As of Jan 13, 2025: domains associated with implied Special Ad Category data have pixels/CAPI blocked at domain level
- Custom audiences from customer lists: restricted to direct upload only; no cross-account sharing

### Ad Review Process

- Automated AI review (seconds to minutes for most ads)
- Human review for sensitive content (1-24 hours)
- Edge cases: up to 48 hours
- Factors that trigger human review: financial services, health claims, political content, new accounts, unusual spend patterns

**Account Quality path:** Business Suite → Account Quality → view active issues, warnings, and appeal rejected ads

**Appeal path:** Business Suite → Account Quality → Ad Account → Not Approved → Request Review

**Three strikes = account suspension** for policy violations.

### Restricted Content Categories

**Absolute prohibitions (never allowed):**
- Illegal products/services
- Discriminatory content based on protected characteristics
- Tobacco/e-cigarettes
- Illegal drugs
- Weapons without required licensing
- Content targeting under-18s with inappropriate material

**Restricted (allowed with conditions):**
- Alcohol (age-gating required, country restrictions)
- Gambling/gaming (country license required, user opt-in)
- Pharmaceuticals/supplements (no prescription drug claims; no unapproved health claims)
- Crypto/DeFi (requires pre-approval in most markets)
- Adult content (requires special permission; no explicit content)
- Debt relief / credit repair (special category + disclosure)

**Financial content rules:**
- No guaranteed returns claims
- No misleading investment performance representations
- No high-pressure sales tactics
- Crypto: requires licensing in supported countries; banned in most markets without approval

### Ad Fatigue & Creative Health

Use the `creative_fatigue` webhook (see Section 1) to get real-time fatigue alerts. Meta provides three levels: Low, Medium, High.

**Manual fatigue signals:**
- Frequency > 2.5 (prospecting) → begin creative refresh
- Frequency > 3.0 → urgent refresh
- CTR decline > 20% over 7-14 days → replace creative
- CPM increase > 50% while CTR flat → algorithm deprioritizing

---

## 11. Automation & Scripts

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

---

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

## Click-to-WhatsApp Ads (CTWA)

### Overview

CTWA ads on Facebook/Instagram feature a "Send Message" CTA that opens WhatsApp chat directly. No landing page needed. Available in feed, stories, reels, and WhatsApp Status (new 2025).

### Supported Objectives

| Objective | Best For |
|---|---|
| Engagement (recommended) | Maximize conversation volume, lead gen |
| Leads | Replace lead forms with conversation |
| Sales/Conversions | Purchase-intent (requires CAPI to close loop) |
| Traffic | Multi-channel campaigns via wa.me link |

### Setup Flow

1. Create campaign → select Engagement objective
2. Ad Set → conversion location: **WhatsApp**
3. Link Facebook Page + select WhatsApp Business number
4. Configure welcome message (auto-fill or pre-filled) + quick reply buttons (up to 4)
5. Build creative: image/video + headline + primary text

### 72-Hour Free Window

When user contacts via CTWA ad, ALL messages (including marketing templates) are free for 72 hours from first response. This is the key economic advantage over cold broadcast.

### Attribution: ctwa_clid

When a user messages via CTWA ad, the WhatsApp webhook includes `referral.ctwa_clid` — this is the attribution key. Store it mapped to phone number (Redis, 90-day TTL).

To attribute conversions back to the ad:

```typescript
// CAPI payload for WhatsApp conversion
{
  event_name: "Purchase",
  action_source: "business_messaging",
  messaging_channel: "whatsapp",
  user_data: {
    whatsapp_business_account_id: WABA_ID,
    ctwa_clid: storedCtwaClid,
    ph: [hashedPhone]
  },
  custom_data: { value: 129.99, currency: "USD" }
}
```

Without CAPI + `ctwa_clid`, WhatsApp conversions are a black hole — Meta only sees "conversation started", never revenue.

### CTWA vs Landing Page

| Dimension | Landing Page | WhatsApp Direct |
|---|---|---|
| CVR | Baseline | 2-3x higher |
| CAC | Baseline | 30%+ lower |
| Qualification | Form fields pre-qualify | Requires chatbot/human |
| Response time | Async | Real-time expected (<5 min) |

### Cost Per Conversation by Country

Example calculations (Meta ad → WhatsApp chat initiated):

| Country | CPM | Est. CPC | 60% chat rate | Cost/conversation |
|---|---|---|---|---|
| India | $2.60 | $0.20 | $0.33 | + $0 (72hr free) |
| Pakistan | $2.20 | $0.19 | $0.32 | + $0 (72hr free) |
| Bangladesh | $2.00 | $0.16 | $0.27 | + $0 (72hr free) |
| Philippines | $3.50 | $0.28 | $0.47 | + $0 (72hr free) |
| Thailand | $3.90 | $0.40 | $0.67 | + $0 (72hr free) |
| Indonesia | $2.80 | $0.18 | $0.30 | + $0 (72hr free) |
| Malaysia | $4.80 | $0.55 | $0.92 | + $0 (72hr free) |
| Brazil | $4.20 | $0.35 | $0.58 | + $0 (72hr free) |

Follow-up marketing templates (after 72hr) add per-message costs (see `whatsapp` skill for rates).

### WhatsApp Marketing Messages in Ads Manager

Since July 2025, WhatsApp marketing message campaigns can be managed from Ads Manager:
- Placement: **WhatsApp Marketing Messages**
- Audience: Custom audiences only (opted-in subscriber lists)
- Meta AI optimizes which subscribers receive the message
- **US pause:** Marketing templates to US +1 numbers paused since April 2025

### Remarketing via WhatsApp Contacts

1. Export opted-in WhatsApp contact list (phone numbers)
2. SHA-256 hash all phones
3. Upload as Custom Audience in Ads Manager
4. Use for: CTWA retargeting on FB/IG, Lookalike creation (1-2%), re-engagement campaigns

---

## Defensive Intelligence: Brazilian Black Hat Ecosystem

Understanding the black hat Meta ecosystem in Brazil is defensive knowledge for legitimate financial services companies. The classifier groups all advertisers in a niche together — knowing what triggers penalties helps avoid guilt by association.

### Glossary (Market Jargon)

| Term | Meaning |
|---|---|
| BM | Business Manager (Meta Business Suite) |
| CA250, CA1500 | Ad account tier by daily spend limit (R$250, R$1500) |
| Disposable BM | Throwaway BM bought from the gray market, run aggressively until inevitable ban (also called "BM balão" in Brazilian dispatch circles) |
| Capitão / Soldado | Hierarchical BM structure: Captain holds pixel, Soldiers absorb bans |
| Aquecer | Warming: simulating organic behavior for weeks before advertising |
| Contingência | Rotating stock of profiles, BMs, pages, pixels ready to replace banned ones |
| Cloaking | Showing safe page to Meta bot, real offer to users |
| Pre-sell / Advertorial | Intermediate page (fake article) between ad and checkout |
| Score | Meta's internal reputation score for profiles, BMs, pixels |
| Reativada | BM recovered via appeal, considered more stable post-recovery |
| BM Verify | Business Verification status |

### What Meta's Classifier Detects

**Profile signals:** account age, history consistency, reverse image search on photo, validated phone/email, IP history, friend network plausibility, organic activity before advertising.

**BM signals:** time between creation and first ad, speed of payment method addition, number of ad accounts created sequentially, linked CNPJ status, verification status, payment/ban history.

**Creative signals:** similarity hash to previously banned creatives, copy text classifier triggers, landing page cloaking detection, user report rate, "hide ad" rate.

**Behavioral signals:** login time patterns, navigation patterns, stable vs rotating IP, stable vs changing fingerprint, automation-typical actions (uniform scroll, precisely regular clicks).

**Network signals (cascade mechanism):** BMs linked to same profile, profiles linked to same IP, shared payment methods across accounts, domains used in banned BMs, pixels with bad history. One ban can propagate across everything connected.

### Why Legitimate Financial Companies Get Flagged

1. **Niche guilt by association:** forex, trading, investment keywords trigger the same classifiers that catch black hat operators running unregulated offshore casinos and fake binary options
2. **Domain contamination:** if affiliates or partners run ads to your domain from their BMs and get banned, your domain gets flagged
3. **Creative pattern matching:** any ad mentioning "earn", "profit", "returns", "guaranteed" triggers classifiers trained on thousands of black hat scam ads in Portuguese
4. **New account suspicion:** new BMs in financial niche get extra scrutiny because black hat operators create and burn BMs constantly

### Defense Playbook for Legitimate Companies

#### 1. Business Verification (critical)

Complete Business Verification with real CNPJ, real address, institutional email on company domain. Verified BMs get higher tolerance threshold before automatic ban and access to premium support. This is the single highest-ROI action.

#### 2. Domain hygiene

- Operate only on main company domain (no disposable subdomains)
- Public WHOIS when possible
- Valid SSL, visible privacy policy and terms of use
- Real contact information
- NEVER let affiliates run ads to your domain from their BMs

#### 3. Institutional creative positioning

Emphasize regulation, security, transparency, real team (photos, names, bios). Meta's classifier is trained to distinguish this from the aggressive black hat pattern. Companies positioning as institutions get significantly less friction.

#### 4. Compliance disclaimers in every ad

Include standard financial disclaimers ("past performance does not guarantee future results", "risk of loss", "no guaranteed returns"). Not just regulatory compliance — consistent presence of disclaimers creates a pattern the classifier recognizes as legitimate regulated advertiser.

#### 5. Payment hygiene

Pay Meta with company corporate card matching the BM's CNPJ and billing address. Never use personal employee cards or cards with history on other BMs. Meta cross-references cards: a card used on a banned account "stamps" any new account it's added to.

#### 6. Affiliate separation

If running an affiliate program, maintain contractual and technical separation. Affiliates advertise from their own BMs and pixels, not company infrastructure. Linking affiliates to your main domain exposes it to contamination.

#### 7. Active classifier monitoring

Regularly check Account Quality scores in Business Manager, ad feedback metrics (positive/negative), and account health indicators. Fast reaction to drops is cheaper than recovering from full ban.

### Black Hat Infrastructure Overview (Know Your Enemy)

| Component | What It Is | Why It Matters for Defense |
|---|---|---|
| Antidetect browsers | Browsers with unique fingerprints per profile (Dolphin Anty, Multilogin) | Meta flags multiple accounts from same fingerprint — ensure your legitimate setup has clean, consistent fingerprint |
| Residential proxies | IPs from real connections, $30-200/mo | Meta correlates IPs — never share VPN/proxy with anyone else's ad accounts |
| Disposable virtual cards | Cards from fintechs, used once per BM | Your corporate card should be exclusively yours, never shared |
| Domain rotation | Pools of cheap domains, burned when flagged | Your stable domain is a signal of legitimacy — longevity helps |
| Pixel farming | Fake conversion events to train algorithm | Your real conversion data (CAPI) is a legitimacy signal — send it |
| BM supply chain | Pre-verified BMs sold on npprteam.shop ($19-59), perfilantigo.com (R$39+), mendesbmilimitada.com.br | Thousands of disposable BMs in circulation — legitimate operations must differentiate via stable identity |
| Profile farming | Teams simulate organic behavior on purchased accounts for weeks (shopping via FB login, groups, stories) | Meta's trust score rewards age and activity — legitimate accounts naturally accumulate this |

### Meta's AI Enforcement Classifier (Deep Intelligence)

**Layer 1: Content ML models** — recognize what's in photos/text, predict policy violations. Most violations removed automatically before anyone sees them. Covers languages spoken by 98% of internet users including Portuguese regional slang.

**Layer 2: Behavioral/network graph** — cross-account signal aggregation via shared devices, IPs, phone numbers, payment cards, and BM structure. Violation in one node propagates to connected nodes. This is what triggers cluster bans.

**Layer 3: Human review queue** — uncertain cases queued for human review teams + physical device farms with real operators.

**2025 upgrade confirmed:** AI for adult content detection caught 2x more violations than humans while decreasing mistakes by 60%. Similar upgrades applied to financial fraud and impersonation detection.

**Account Integrity classifier (2025-2026):** Specifically targets account farming, coordinated inauthentic behavior, and linked-account structures. Uses device fingerprints, phone number associations, and behavioral patterns. This is the classifier that fires when multiple BMs share operational infrastructure.

**False positive problem (documented):** May-June 2025 ML filter upgrade caused major wave of innocent content flagged. July 2025: Meta removed 135,000 accounts + 500,000 linked accounts as collateral from graph propagation. The system is acknowledged to be "too aggressive" in some areas.

### BM Ban Triggers (Confirmed 2025-2026)

| Category | Trigger | Severity |
|---|---|---|
| **Authenticity** | Creating BM with purchased/fake profile | Critical |
| **Authenticity** | Profile registered on Windows (higher suspicion than mobile) | Medium |
| **Authenticity** | Profile under 90 days creating a BM | High |
| **Network** | Login from multiple IPs/geos in short windows | High |
| **Network** | IP previously associated with banned BM ("dirty list") | Critical |
| **Network** | Shared device fingerprint across multiple BMs | Critical |
| **Financial** | Rapid budget scaling ($20 → $500 in <7 days) | High |
| **Financial** | Card previously on banned BM (dirty-list 6-12 months) | Critical |
| **Financial** | Payment geo mismatch vs declared business geo | Medium |
| **Policy** | UBP (Unacceptable Business Practices): MLM, returns, health claims | Critical |
| **Policy** | High chargeback rates on payment processor | High |
| **Operational** | Adding admin profile under checkpoint/restriction | High |
| **Operational** | Adding multiple ad accounts in first 7 days | Medium |
| **Operational** | Creating BM immediately after profile creation | High |

### BM Ban Cascade (How It Propagates)

**BM restriction → All assets inside:** Instantaneous. Every user, ad account, page, pixel, WABA under that BM goes down simultaneously.

**Admin profile ban → BM risk:** If sole admin is banned, BM becomes disabled. Mitigation: always 2+ admin profiles.

**Cluster-linked BMs:** BMs sharing device fingerprint, proxy IP, or payment card get linked in Meta's graph. One ban cascades to ALL linked BMs within hours.

**Cross-platform cascade (2025-2026):** Instagram + Facebook + WhatsApp + Threads are identity-linked. A flag on any platform can cascade across the entire identity graph.

**Direction of BM-WABA cascade:**
- BM disabled → ALL WABAs lose API access, numbers go to "Disabled" (catastrophic)
- WABA/number banned → BM survives, other assets unaffected (granular, recoverable)
- Phone number ban is the more recoverable event. BM ban is catastrophic.

### BM Appeal Process

**Tier 1 (Automated):** "Request Review" in Business Support Home. Resolves ~35% of false positives within 24h. No human involved.

**Tier 2 (Human review):** Policy team review. 3-5 business days. Must provide specific compliance explanation, not generic denial.

**Tier 3 (Policy Advisory Board):** Complex/high-value cases. 10-15 business days. Rare.

**Critical deadline:** After 180 days disabled, reinstatement is not possible.

**Recovery Action Plan (new 2026):** Complete compliance training → submit corrective action plan → pass re-certification → account reinstated with 30-day probation (all ads manually reviewed during probation).

### Asset Isolation Strategy

Each independent BM operation requires complete isolation:

| Component | Rule |
|---|---|
| Antidetect profile | Unique per BM, never reuse |
| Proxy IP | One per BM, never share |
| Payment card | One per BM, dirty-list persists 6-12 months |
| Admin profile | Unique per BM, never share admin across BMs |
| Email/phone | Unique per BM, shared contacts create graph links |

**Architecture:**
- **Vault BM:** stores pixels, pages, conversion data — NEVER runs campaigns
- **Campaign BM:** runs ads, takes the ban risk — disposable
- **WABA BM:** holds WhatsApp Business Account — should be separate from campaign BM if WABA is strategic

**For WABA isolation:** the BM holding WABA should have NO advertising activity. A clean BM with only WABA reduces exposure. Keep a warm spare WABA in a separate portfolio.

### Profile Types and Survival Rates

| Type | Source | Survival Rate | Price |
|---|---|---|---|
| Self-reg (autoreg) | Bot-created, no history | ~10% on first action | Cheapest (bulk) |
| CPRD | Pre-verified, minimal history | Moderate | Mid-range |
| Farm (farmado) | Manually cultivated weeks/months | ~90% | R$80-200 |
| King/Real | 1+ month manual cultivation, full docs | Highest | Premium |
| Aged (antigo) | 2008-2015 era, high trust score | High if warmed | R$39+ |

**Profile warming phases:**
1. Days 1-3: 4G/5G only, humanized photo, 3-5 real contacts
2. Days 4-9: Join sticker groups, receive 50-200 media files from established accounts (builds receive/send ratio)
3. Days 7-14: Join groups, like/comment/share, view stories, connect to Mercado Livre/Shopee via FB login
4. Day 14+: Create or join BM, run small engagement campaigns R$5/day

### Niche Classification in Brazil

| Category | Examples | Risk for Meta Classifier |
|---|---|---|
| Black (prohibited) | Offshore casino, unregulated forex with guaranteed returns, nutra with medical claims, crypto scams | Instant ban |
| Gray (edge) | Dropshipping with long delivery, "earn R$10k in 30 days" infoproducts, crypto education | High scrutiny, frequent disapprovals |
| White (legitimate) | Regulated financial services, licensed trading platforms, educational content with disclaimers | Low risk if properly positioned |

A legitimate operator in the White category (e.g. a regulated financial-services company) differentiates from black-hat operators by: (a) regulatory registration, (b) no guaranteed-return promises, (c) documented compliance, (d) a verified BM with a real CNPJ.

### 2025-2026 Trends

- **Intensified Meta crackdowns:** verified BMs getting mass-disabled alongside common ones. Verification increases scrutiny for violators. July 2025: 135k accounts + 500k linked removed in single sweep.
- **AI on both sides:** Meta uses AI for cloaking detection, image analysis, behavioral anomaly detection. Black hat operators use AI for mass creative generation and synthetic profile creation.
- **Account Integrity ban wave (July 2025-present):** Shared workplace devices/IPs causing legitimate accounts flagged as "linked accounts". Cascading blocks via guilt-by-association.
- **CNPJ cross-verification:** Meta now cross-references CNPJ with Brazilian public databases (Receita Federal), flagging inconsistencies (inactive CNPJ, mismatched address). Benefits legitimate companies.
- **CPF/CNPJ blacklisting:** Brazilian documents linked to permanently banned BMs create persistent blacklist entries. Total investment loss, blocking of all linked accounts.
- **Financial identity verification (March 2026):** Meta now requires identity verification for financial product advertisers (banking, lending, fintech, crypto) as additional compliance layer.
- **Regulatory convergence:** CVM, Banco Central, Senacon, ANPD increasingly monitoring digital advertising in sensitive niches. Receita Federal cross-referencing Pix transactions with tax returns.
- **Meta ML detection rate:** reportedly detects 95% of traditional proxy connections, VPNs, shared residential IPs. Only mobile proxies remain effective.
- **BM supply chain scale:** npprteam.shop's top product (Verified BM with WABAs, $59) has 1,713 orders — thousands of disposable BMs in active circulation.

---

## Operational Infrastructure: Proxy, Profile, Antidetect

> **Scope:** This section covers multi-account awareness — understanding how Meta scores infrastructure quality and how the market works — so legitimate operators can make informed decisions about their own setup. Operational how-to for running non-owned purchased accounts is outside scope here.

### Proxy Types and Meta Trust Scores

Meta's classifier assigns trust scores based on connection type. Understanding this helps legitimate operators choose the right infrastructure for their own accounts and understand why account isolation matters.

| Type | Meta Trust | Legitimate Use Case |
|---|---|---|
| **Mobile 4G/LTE** | Highest | Dedicated mobile connection for a single account |
| **Static Residential/ISP** | High | Dedicated residential IP for a stable account |
| **Residential Rotating** | Medium | Scraping / research (not for BM management) |
| **Datacenter** | Zero | Never for Meta accounts — instant signal |

**Key defense insight:** Meta correlates IP history across accounts. A company's legitimate ad accounts should never share IPs with third-party accounts (agencies, partners, affiliates) — shared IPs create graph links that can cause cascade bans. Each BM should have a dedicated, clean connection.

### Antidetect Browsers (Awareness)

The Brazilian black hat market primarily uses antidetect browsers to isolate account fingerprints. Legitimate operators encounter this market when managing multiple client BMs or running agency operations. Major tools in circulation:

| Browser | Market Share BR | Use in BR market |
|---|---|---|
| **AdsPower** | #1 (24% of BR operators) | Most common for multi-BM management |
| **GoLogin** | Popular | Mid-tier |
| **Dolphin Anty** | Popular for automation | Frequently used for automated operations |
| **Multilogin** | Premium/enterprise | High-end isolation |

**Defense implication:** Meta's fingerprint detection identifies antidetect browser signatures. Legitimate operators managing multiple client BMs in a browser that mimics antidetect behavior may trigger false positives. Use standard browsers for legitimate agency work where possible; ensure each client BM has a consistent, stable access pattern.

### BM Architecture for WABA

```
Profile Principal (aged, high-trust)
  └── BM Disparo (purchased)
        ├── WABA (WhatsApp Business Account)
        │     └── Phone number + templates
        └── Admin backup (cheaper profile)

If Profile Principal falls → BM survives via backup admin
If BM falls → WABA and phone number are lost (non-transferable)
```

**Critical:** WABA cannot be transferred between BMs. Choose the BM carefully. Add backup admin immediately.

### BM Types (Market Reference)

| Type | Description | Price Range | Risk |
|---|---|---|---|
| BM zerada | Fresh, no history | R$50-150 | High (no trust) |
| BM verificada | Business Verification done | R$90-250 | Medium |
| BM ilimitada | High-score creator profile | R$400-1500 | Medium |
| BM agência | Agency-allocated shared access | % of spend + fee | Low-medium |
| Disposable BM | Disposable, burn after use | R$80-300 total setup | Expected to die |
| BM reativada | Recovered from ban via appeal | Variable | Paradoxically stable |
| BM com linha de crédito | Monthly billing unlocked | Premium | High (heavily monitored) |
| BM disparo | Set up for WhatsApp dispatch | Variable | Depends on tier |

