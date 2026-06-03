---
name: tiktok-ads
description: Use when managing TikTok Ads campaigns, creating ads, optimizing campaigns, checking metrics, or automating TikTok Ads. Triggers on "tiktok ads", "tiktok campaign", "tiktok ads manager", "tiktok pixel", "tiktok events api", "spark ads", "tiktok targeting", "tiktok creatives", "tiktok lead generation".
---

# TikTok Ads Management

Automation-first approach to TikTok Ads. Use MCP servers and the Marketing API for programmatic operations. Browser guidance only when API/MCP can't handle it.

**Project data lives in `.maccing/growth/tiktok-ads/<account>/README.md`.** This file contains only generic, reusable platform knowledge.

## Iron Laws

### 0. MANDATORY: Read Project Context First

```
BEFORE ANY ACTION, ALWAYS READ THE PROJECT FILES:
1. .maccing/growth/README.md (if exists)
2. .maccing/growth/tiktok-ads/<account>/README.md (if exists)
These contain current state: pixel IDs, campaign data, pending actions.
Without reading them, you WILL operate on stale data.
```

### 1. Automation Priority

```
ALWAYS USE MCP OR API FOR OPERATIONS WHEN AVAILABLE.
BROWSER GUIDANCE IS THE FALLBACK, NOT THE DEFAULT.
```

**Priority order:**
1. **TikTok Ads MCP** (`amekala/ads-mcp` or `AdsMCP/tiktok-ads-mcp-server`) — campaign CRUD, reports, analytics
2. **TikTok Marketing API** (via official SDK `tiktok-business-api-sdk-official`) — full lifecycle management
3. **TikTok Events API** — server-side conversion tracking (like GA4 MP)
4. **Browser automation** — account setup, payment config, manual actions only

### 2. Self-Improving Skill

After every session: update patterns, add new API learnings, document what worked/failed.

### 3. Exact UI Paths for Manual Actions

```
WHEN GUIDING ANY MANUAL ACTION, PROVIDE THE FULL CLICK PATH.
NEVER give vague directions. ALWAYS give the exact click sequence.
```

### 4. Data Before Opinions

Never recommend changes without data. Read metrics first, diagnose second, prescribe third.

## Platform Architecture

### Three Separate Platforms

| Platform | URL | Purpose |
|---|---|---|
| **TikTok Business Account** | TikTok app | Organic profile, basic "Promote" feature, NOT an ads account |
| **TikTok Ads Manager** | ads.tiktok.com | Campaign builder, budgets, targeting, creatives, bids |
| **TikTok Business Center** | business.tiktok.com | Admin layer: team permissions, multiple ad accounts, shared pixels |

**Solo advertiser:** Ads Manager is enough. Business Center is for teams/agencies.

### Account Hierarchy

```
Campaign (objective, budget)
  └── Ad Group (targeting, bid, placement, schedule)
       └── Ad (creative, CTA, destination URL)
```

- Campaign daily budget minimum: $50
- Ad group daily budget minimum: $20
- Recommended: 3-5 ad groups per campaign, 3-5 creatives per ad group
- Learning phase: ~50 conversions per ad group before optimization stabilizes

### Permanent Settings (cannot change after creation)

- Country/Region
- Currency
- Timezone
- Business name (on the account record)

## Campaign Objectives

| Category | Objective | Optimizes For | Best For |
|---|---|---|---|
| **Awareness** | Reach | Unique impressions | Brand launches |
| **Consideration** | Traffic | Link clicks | Landing page visits |
| | Video Views | 2s or 6s views | Content-first strategy |
| | Community Interaction | Followers, profile visits | Account growth |
| **Conversion** | Lead Generation | Form submissions | In-app lead capture (Instant Form) |
| | Website Conversions | Site actions (sign-up, purchase) | Registration, purchases |
| | App Promotion | Installs, in-app events | Mobile app installs |
| | Product Sales | Purchases via TikTok Shop | E-commerce |

## Ad Formats

### In-Feed Ads (Standard)

- Appear in For You Page between organic videos
- Full-screen vertical (9:16 required; 1:1 and 16:9 technically supported but underperform)
- Resolution: minimum 540x960px; recommended 1080x1920px
- Duration: up to 60 seconds; 9-15 seconds performs best
- CTA button + display name + caption

### Spark Ads (Boost Organic Posts)

- Boost existing organic TikTok posts as paid ads
- All engagement accumulates back to the organic post permanently
- 132% higher completion rate and 48% higher CVR vs standard in-feed
- Requires authorization code from post owner (7/30/60/365 days)
- Cannot edit caption after authorization

**Authorization flow:**
1. Creator: TikTok app → Profile → Settings → Creator Tools → Ad Settings
2. Select post → Choose duration → Generate Code → Copy
3. Advertiser: Ads Manager → Tools → Advertising Content Library → Spark Ads Publications → Paste code

### Lead Generation Instant Form

- In-app form, no external redirect
- Auto-fills from user's TikTok profile (name, email, phone)
- Higher completion rates than external landing pages
- CRM integration: Salesforce, HubSpot, Zapier, LeadsBridge

## Targeting

### Demographics

| Dimension | Options |
|---|---|
| Age | 13-17, 18-24, 25-34, 35-44, 45-54, 55+ (18+ mandatory for financial content) |
| Gender | All, Male, Female |
| Location | Country, region/state, city-level |
| Language | Device/app language |
| Household Income | US only (Top 5%, 10%, 25%, 50%) |

### Audience Types

| Type | What It Is | Intent Level |
|---|---|---|
| **Interests** | Long-term engagement patterns | Medium |
| **Behaviors** | Recent actions in last 15 days | High |
| **Custom Audiences** | Upload CRM data, website visitors, app users | Highest |
| **Lookalike Audiences** | Similar to source. Narrow 1%, Balanced 5%, Broad 20% | Medium-High |
| **Smart+** | AI-driven fully automated targeting | Varies |

## Bidding Strategies

| Strategy | How It Works | When to Use |
|---|---|---|
| **Lowest Cost** | Spend full budget at cheapest results | Starting out, learning phase |
| **Cost Cap** | Target average CPA you specify | Have target CPA, want volume |
| **Bid Cap** | Maximum per-result bid. Lower volume. | Strict budget discipline |

**Billing methods:** oCPM (conversions), CPC (traffic), CPM (reach), CPV (video views)

**Progression:** Start Lowest Cost → collect 50+ conversions → switch to Cost Cap

## Cost Benchmarks (2025-2026)

### Global Averages

| Metric | All Industries | Finance/Insurance |
|---|---|---|
| CPM | $9.16 | $13-18 |
| CPC | $1.02 | $1.71-2.20 |
| CPV | $0.03 | $0.03-0.08 |
| CTR | 1.0% | 0.72% |
| CVR | 1.8% | 1.02% |
| CPA | $56.67 | $35-75 (leads) |

### Regional Costs

| Region | CPM | CPC | vs. US |
|---|---|---|---|
| United States | $10.72 | $1.18 | Baseline |
| UK/Europe | $8-15 | $0.90-2.00 | -10-25% |
| **Latin America** | **$4.18** | **$0.42** | **-60%** |
| **Southeast Asia** | **$3.05** | **$0.31** | **-70%** |

### Budget Minimums

| Level | Minimum |
|---|---|
| Ad group daily | $20/day |
| Campaign daily | $50/day |
| Meaningful testing | $500-1,000 |
| Seeing results | $5,000+/month |

## Conversion Tracking

### TikTok Pixel (Client-Side)

**Standard events:**

| Event | When to Fire |
|---|---|
| `PageView` | All pages |
| `ViewContent` | Product/plan pages |
| `ClickButton` | CTA buttons |
| `CompleteRegistration` | After sign-up |
| `SubmitForm` | Lead form submissions |
| `Purchase` | After purchase (replaces deprecated `PlaceAnOrder`) |

### TikTok Events API (Server-Side)

Equivalent to Meta CAPI / GA4 Measurement Protocol. Sends events server-to-server.

**Endpoint:** `POST https://business-api.tiktok.com/open_api/v1.3/event/track/`

**Authentication:** `Access-Token` header (NOT `Authorization: Bearer`)

**Payload structure v1.3:**
```json
{
  "event_source": "web",
  "event_source_id": "<pixel_id>",
  "data": [{
    "event": "CompleteRegistration",
    "event_id": "<dedup_id>",
    "event_time": 1717200000,
    "user": {
      "ttclid": "<raw_string>",
      "email": "<sha256_hash>",
      "external_id": "<sha256_hash>"
    },
    "page": { "url": "https://example.com/signup" },
    "properties": { "content_name": "sign_up" }
  }]
}
```

**Critical rules:**
- `event_time`: Unix **seconds** (NOT ISO 8601, NOT milliseconds)
- Event names: **PascalCase** (`CompleteRegistration`, `Purchase`)
- email/externalId: SHA-256 hashed (lowercase + trim BEFORE hashing)
- ttclid: raw string, NOT hashed
- Check `response.ok` before `response.json()` (non-JSON error bodies crash otherwise)
- Success: `code: 0` in response body
- Deduplication via `event_id`: same ID in browser pixel `ttq.track()` and server Events API

**Credentials setup:**
```
Ads Manager → Assets → Events → Web Events → Open pixel → Settings → Generate Access Token
```

## Content Policies

### Industry Selection Impact

| Sector | Restriction Level | Review Time | Documents Required |
|---|---|---|---|
| Fornecedor de serviços de Internet | **Free** | 24h | None |
| Aplicações e software | **Free** | 24h | None |
| Educação | **Free** | 24h | None |
| **Serviços financeiros** | **RESTRICTED** | **3-7 days** | Licenses, disclaimers, 18+ mandatory |

TikTok does NOT cross-reference CNAE codes with sector field. Enforcement is at ad content + landing page level.

### Financial Services Policy

**Universally prohibited:** Binary options, MLM (downline recruitment), pyramid schemes, get-rich-quick, penny auctions, payday loans

**Restricted (requires pre-approval):** Cryptocurrency exchanges, Forex/FX trading, CFDs, financial spread betting

**Allowed with disclaimers:** Licensed investment platforms, banking, insurance, personal finance apps, budgeting tools

**Required disclaimers:** "Investments carry risk", "Past performance does not guarantee future results" — must appear as on-screen TEXT (85% watch muted)

## Creative Best Practices

### Hook (First 2-3 Seconds)

- 71% of users decide to continue watching in first 3 seconds
- Lead with: question, surprising statistic, bold claim, or pattern interrupt

### Video Specs

| Parameter | Recommended |
|---|---|
| Aspect ratio | 9:16 (vertical) — mandatory for best performance |
| Resolution | 1080x1920px |
| Duration | 9-15 seconds (awareness), 30-60 seconds (lead gen) |
| File size | Up to 500MB |
| Format | MP4, MOV |
| Captions | Required — 85% watch muted |

### What Works

- **Educational, not promotional:** "Here's how compound interest works" > "Open an account"
- **FinTok style:** Align with organic financial content (#FinTok, #PersonalFinance)
- **Native look:** Shot vertical on mobile, not studio-produced
- **Trending sounds:** Use TikTok's royalty-free music library

### What Does NOT Work

- Polished corporate ads
- Guaranteed return claims — immediate policy rejection
- Horizontal video — 35-50% performance loss vs vertical
- Making changes during learning phase (first 50 conversions) — resets algorithm

## Account Setup Flow

1. **Go to ads.tiktok.com** → Click "Get Started"
2. **Register** with email + verification code
3. **Business details form:** company name (must match registration), website URL, sector, phone
4. **Customize account** (expand before clicking Continue): timezone, currency
5. **Accept anti-discrimination policy** (two checkboxes)
6. **Payment setup:** Manual (prepaid) recommended for budget control
7. **Account review:** ~24 hours for non-financial sectors

### Post-Setup Checklist

- [ ] Account approved
- [ ] Payment method added
- [ ] TikTok Pixel created and installed
- [ ] Events API access token generated
- [ ] Server-side tracking configured
- [ ] First campaign created
- [ ] MCP server connected (optional)

## Automation & API

### MCP Servers Available

| MCP Server | Capabilities |
|---|---|
| **amekala/ads-mcp** | 31 TikTok tools (campaign CRUD, analytics, creative fatigue). Also supports Google/Meta/LinkedIn. |
| **AdsMCP/tiktok-ads-mcp-server** | Campaign CRUD, analytics, audience/creative management. Self-hosted Python. |
| **ysntony/tiktok-ads-mcp** | Read-only: 6 tools (campaigns, ad groups, ads, reports). |

### Official SDK

```bash
pip install tiktok-business-api-sdk-official
```

### Marketing API Authentication

OAuth 2.0 flow:
1. Register at developers.tiktok.com → Create app (2-3 day review)
2. User authorizes → receive `auth_code`
3. Exchange for access token: `POST /open_api/v1.2/oauth2/access_token/`
4. Pass as `Access-Token` header on all requests

Sandbox available immediately. Production approval: 5-10 business days.

### API Rate Limits

- 1-minute sliding window
- HTTP 429 when exceeded
- `/v2/video/list/`: 600 requests/minute (known specific limit)

## Comparison: TikTok vs Google Ads vs Meta

| Dimension | TikTok | Google Search | Meta (FB/IG) |
|---|---|---|---|
| User intent | Discovery/entertainment | Active search intent | Social/interest-based |
| Funnel stage | Top/mid (demand gen) | Bottom (demand capture) | Mid (demand gen) |
| Primary format | Vertical video | Text (search ads) | Image/video/carousel |
| Average CPC | $1.02 | $3-5 (finance) | $1.10 |
| Min daily budget | $20/ad group | $1 | $1 |
| Learning phase | ~50 conversions | ~1-2 weeks | ~50 conversions |
| MLM policy | **Explicitly banned** | Case-by-case | Case-by-case |
| Binary options | **Banned** | **Banned** | **Banned** |

## ROI Optimization

### Ad Copy Best Practices

- **Character limit:** 12–100 characters. Keep under 50 to avoid "See more" truncation
- **Hook in first 2 seconds:** 30%+ hook rate is benchmark. Below 25% = failing hook
- **Tone:** Conversational, friend-talking, NOT brand-broadcasting. UGC-style outperforms studio by ~50%
- **Length sweet spot:** 15–30 seconds for conversion, 9–15 for awareness
- **Never shorten by removing letters or odd spacing.** Cut whole words/sentences only. Character substitutions (e.g. "l u c r o", "g3stão") and unusual spacing are read as filter-evasion by content-moderation systems and raise rejection risk.

### Ad Copy Formulas (TikTok-Native)

| Formula | Structure | Best For |
|---|---|---|
| Specific Outcome | `[Result] in [timeframe]` | Cold traffic |
| PAS | Problem → Agitate → Solution | Retargeting |
| AIDA | Attention → Interest → Desire → Action | Cold traffic |
| Skeptic Script | "I know what you're thinking..." | Low-trust verticals (finance) |
| 3 Mistakes | "3 mistakes [audience] make..." | Educational content |
| Hook-Proof-Payoff-CTA | Hook (0-3s) → Proof (3-15s) → Payoff (15-25s) → CTA | Universal best performer |

### CTA Strategy

**Dynamic CTA outperforms any single CTA by ~12%.** Select 3-5 relevant options and let TikTok auto-optimize per viewer.

| Objective | Best CTAs to Include |
|---|---|
| Education / Learning platform | Learn More, Sign Up, Subscribe, Get Started |
| Lead generation | Sign Up, Learn More, Get Quote |
| E-commerce | Shop Now, Learn More, View Now |

Always include a **verbal CTA inside the video** at 20-25 second mark. On-screen button is often ignored.

### Low-Budget Optimization ($20/Day)

At $20/day in SEA/South Asia markets, CPMs are $0.20-$2.00 (vs $8-$15 in US). Your $20 buys what $100-$200 buys in Western markets.

**Rules:**
1. One campaign, one ad group at minimum budget (never split across multiple ad groups)
2. Use Automatic Placement
3. Use Campaign Budget Optimization (CBO)
4. No Cost Cap during learning phase (kills delivery on low budgets)
5. Use Lowest Cost bidding
6. Never edit during learning phase (resets algorithm)
7. Increase budget max 20-30% every 48-72 hours
8. Refresh creatives every 10-14 days

**Phase progression:**
- Days 1-7: Traffic objective (conversions need 25+/week to exit learning)
- Days 8-21: Optimize, kill hook rate <20% or CTR <0.5%
- Day 21+: Scale winners, duplicate ad groups with slight targeting variations

### Country-Specific Benchmarks

| Metric | Philippines | Pakistan | Bangladesh |
|---|---|---|---|
| CPM | $0.50–$2.00 | $0.30–$1.50 | $0.20–$1.00 |
| CPC | $0.05–$0.35 | $0.03–$0.20 | $0.02–$0.15 |
| CTR | 0.8–1.5% | Similar | Similar |
| Ad audience | 50M+ adults | 66.9M adults | 46.5M adults |
| Peak hours | 6-9 PM PHT (UTC+8) | 8-11 PM PKT (UTC+5) | 9-11 PM BST (UTC+6) |
| Language | Taglish (Tagalog+English) | Urdu/English mix | Bengali/English mix |

**Key insights:**
- Local language in hooks significantly outperforms English-only for conversion
- Filipino audiences respond strongly to aspirational self-improvement narratives
- Pakistan: Ramadan periods drive massive engagement spikes
- Bangladesh: lowest CPMs globally, optimize video for low bandwidth (compress files)
- Social proof is critical in all 3 markets (real people, real testimonials)

### Financial Education Content Rules

**Allowed:** Financial literacy, "learn to trade", market education, personal finance
**Prohibited:** Revenue claims, P&L screenshots, "guaranteed profits", "passive income"

**Safe framing:** "financial education", "learn to trade", "understand markets", "build knowledge"
**Dangerous framing:** "get rich", "guaranteed profits", "earn money", "passive income"

## Gotchas & Critical Learnings

### Account Setup

| Gotcha | Detail |
|--------|--------|
| **Country is permanent** | Country, currency, timezone CANNOT be changed after creation |
| **Country locks default targeting** | Must change at Ferramentas → Controles de audiência to target other countries |
| **Industry affects review** | "Serviços financeiros" = 3-7 day review. "Internet services" = 24h |
| **Identity verification required** | Phone SMS mandatory before accessing Events Manager |
| **India permanently banned** | TikTok banned in India since June 2020. No advertising possible. |
| **Philippines unavailable** | Philippines not available as targeting option for Brazil-based accounts (as of May 2026). Reason unknown — may be currency/region restriction. |
| **"Binary" in name = instant suspension** | An account whose company name contained a binary-options brand term was auto-suspended on first publish — TikTok bans binary options; avoid such terms in brand naming. |
| **Account suspension is pre-emptive** | Unlike Google Ads (which reviews ads individually), TikTok may suspend the entire account before any ad runs. No opportunity to prove compliance first. |

### Campaign Creation

| Gotcha | Detail |
|--------|--------|
| **"Vendas" has sub-destinations** | Must select "Site" for website conversions (default is TikTok Shop) |
| **URL field is TEXTAREA, not INPUT** | `input[placeholder*="URL"]` won't find it |
| **"Tailored ad variations" popup blocks everything** | Cannot be dismissed. Work around with JS focus |
| **File upload limit in Playwriter** | 50MB limit in remote CDP. Compress with ffmpeg first |

### Events API

| Gotcha | Detail |
|--------|--------|
| **Use v1.3, NOT v1.2** | v1.2 endpoint `/pixel/track/` has different payload structure |
| **Auth header: `Access-Token`** | NOT `Authorization: Bearer` |
| **`event_time`: Unix seconds** | NOT ISO 8601, NOT milliseconds |
| **Event names: PascalCase** | `CompleteRegistration`, `Purchase`. snake_case is silently dropped |
| **`PlaceAnOrder` deprecated** | Use `Purchase` |
| **email/externalId: SHA-256 hashed** | Lowercase + trim BEFORE hashing. ttclid: raw, NOT hashed |

### Browser Automation (Playwriter)

| Gotcha | Detail |
|--------|--------|
| **Extension mode FAILS on TikTok Ads** | Page redirects invalidate CDP sessions. Use `--direct` mode. |
| **Direct mode requires `chrome://inspect/#remote-debugging`** | User must enable manually |
| **`snapshot()` often returns empty** | Use `screenshot()` as fallback |
| **TikTok uses Vue/React** | `evaluate()` to set values doesn't trigger reactivity. Use click + type. |
