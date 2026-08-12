## Contents

1. [Compliance & Policies](#10-compliance--policies)
   - [Special Ad Categories](#special-ad-categories)
   - [Targeting Restrictions (Special Ad Categories)](#targeting-restrictions-special-ad-categories)
   - [Financial Services Additional Rules](#financial-services-additional-rules)
   - [Ad Review Process](#ad-review-process)
   - [Restricted Content Categories](#restricted-content-categories)

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

---

