## Contents

1. [Compliance & Policies](#10-compliance--policies)
   - [Special Ad Categories](#special-ad-categories)
   - [Targeting Restrictions (Special Ad Categories)](#targeting-restrictions-special-ad-categories)
   - [Financial Services Additional Rules](#financial-services-additional-rules)
   - [Ad Review Process](#ad-review-process)
   - [Restricted Content Categories](#restricted-content-categories)
   - [Ad Fatigue & Creative Health](#ad-fatigue--creative-health)
2. [Automation & Scripts](#11-automation--scripts)
   - [Marketing API Automation Patterns](#marketing-api-automation-patterns)
   - [Automated Rules via API](#automated-rules-via-api)
   - [Creative Rotation Strategy](#creative-rotation-strategy)

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

