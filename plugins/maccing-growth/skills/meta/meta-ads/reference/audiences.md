## Contents

1. [Targeting Hierarchy (2026 Reality)](#targeting-hierarchy-2026-reality)
2. [Targeting Types & API Fields](#targeting-types--api-fields)
3. [Advantage+ Audience vs Detailed Targeting](#advantage-audience-vs-detailed-targeting)
4. [Custom Audiences](#custom-audiences)
5. [Lookalike Audiences](#lookalike-audiences)
6. [Geo Targeting](#geo-targeting)
7. [Interest/Behavior Targeting Status (2026)](#interestbehavior-targeting-status-2026)

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

### Remarketing via WhatsApp Contacts

1. Export opted-in WhatsApp contact list (phone numbers)
2. SHA-256 hash all phones
3. Upload as Custom Audience in Ads Manager
4. Use for: CTWA retargeting on FB/IG, Lookalike creation (1-2%), re-engagement campaigns

---
