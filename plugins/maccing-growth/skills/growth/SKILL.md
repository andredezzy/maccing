---
name: growth
description: Growth orchestrator for paid acquisition and owned messaging. Use for ad strategy, metrics, optimization, budgets, creative testing, audience targeting, attribution, scaling, competitive intelligence, and WhatsApp messaging campaigns. Routes to channel skills (google-ads, meta-ads, tiktok-ads, whatsapp). Triggers on "growth", "ads", "paid ads", "PPC", "ROAS", "CPA", "campaign", "ad copy", "retargeting", "attribution", "whatsapp campaign", "outreach".
---

# Paid Advertising: Master Skill

Platform-agnostic knowledge base for paid advertising. Covers strategy, metrics, optimization, competitive intelligence, and defensive techniques. Routes to platform-specific skills for execution.

## Iron Laws

### 0. MANDATORY: Read project context first

If you are operating inside a project repo, BEFORE any action read the project's growth state:

1. `.maccing/growth/README.md` — which vendors/accounts are live vs disposed.
2. The relevant `<vendor>/<account>/README.md` (e.g. `meta/<bm>/README.md`, `meta/<bm>/whatsapp/<waba>/README.md`, `google-ads/<account>/README.md`).

These hold current state: account IDs, budgets, campaign history, template/quality status, pending actions. Without them you operate on stale assumptions.

### 0b. Persist project state under a git-tracked `.maccing/growth/`

When operating inside a project repo, you MUST:

1. Keep all project growth state under `.maccing/growth/<vendor>/.../<account>/`.
2. Verify it is tracked: run `git check-ignore .maccing/`. If ignored, STOP and fix `.gitignore` — project growth memory must be versioned.
3. Commit new/changed `.maccing/growth/` files; never leave them as untracked scratch.
4. Keep ONLY secrets out of git — API keys/tokens via env vars referenced from a gitignored `.env*.local`. Everything else is tracked.

### 1. Orchestrator Role

```
THIS SKILL IS THE BRAIN. PLATFORM SKILLS ARE THE HANDS.
Strategy, metrics, and decisions happen HERE.
Execution happens in platform-specific skills.
```

**Routing:**
- Google Ads execution → `google-ads` skill (Scripts-first)
- TikTok Ads execution → `tiktok-ads` skill (API + MCP)
- Meta/Facebook/Instagram execution → `meta-ads` skill (Marketing API + CAPI + CTWA)
- WhatsApp message dispatch → `whatsapp` skill (Cloud API, templates, bulk sending)
- Other platforms → research + manual guidance

**Project data:** `.maccing/growth/<vendor>/<account>/` — each project has its own README + platform subdirectories (git-tracked per Iron Law 0b).

**Structure:**
```
.maccing/growth/
├── README.md                   # Which vendors/accounts are live vs disposed
├── google-ads/
│   └── <account>/
│       ├── README.md           # Account IDs, campaigns, history
│       └── scripts/            # Executed scripts for this account
├── tiktok-ads/
│   └── <account>/
│       └── README.md           # Pixel, account data, history
├── meta/
│   └── <bm>/
│       ├── README.md           # BM-level: identity, verification, ad accounts
│       ├── site/               # Brand site (BM-level asset)
│       └── whatsapp/
│           └── <number>/
│               └── README.md   # WABA, BSP, templates, quality, metrics
```

### 2. Self-Improving Skill

After every session: add new benchmarks, update techniques, note new patterns, record what worked/failed.

### 3. Exact UI Paths for Manual Actions

```
WHEN GUIDING ANY MANUAL ACTION ON ANY PLATFORM, PROVIDE THE FULL CLICK PATH.
NEVER give vague directions. ALWAYS give the exact click sequence.
```

Every manual instruction MUST include:
- The exact sidebar/menu item to click first
- Every sub-menu, tab, and page element in sequence
- The exact button, toggle, or field to interact with
- The save/confirm action

**Format:** `Sidebar → Sub-menu → Page → Element → Action → Confirm`

**BAD:** "Go to conversions and disable page view"
**GOOD:** "Metas (sidebar) → Conversões → Resumo → clica em 'Visualização de página' → desmarca 'Usar como meta principal da conta' → Salvar"

This applies to ALL platforms (Google Ads, Meta, TikTok, LinkedIn, etc.) and ALL manual guidance.

### 4. Data Before Opinions

Never recommend changes without data. Read metrics first, diagnose second, prescribe third.

### 5. Kill Fast, Scale Slow

Kill underperforming campaigns within 72 hours. Scale winners by max 20% every 5-7 days.

## Core Metrics

### Formulas

| Metric | Formula | Tells You |
|---|---|---|
| CPM | (Spend / Impressions) x 1000 | Cost to reach 1,000 people |
| CPC | Spend / Clicks | Cost per click |
| CTR | (Clicks / Impressions) x 100 | Ad relevance and creative quality |
| CVR | (Conversions / Clicks) x 100 | Landing page + offer quality |
| CPA | Spend / Conversions | Cost per acquisition |
| ROAS | Revenue / Ad Spend | Revenue per dollar spent (not profit) |
| CAC | Total Marketing Cost / New Customers | Fully-loaded acquisition cost |
| LTV | AOV x Purchase Frequency x Lifespan | Total customer lifetime revenue |
| LTV:CAC | LTV / CAC | Sustainability ratio (target 3:1+) |
| MER | Total Revenue / Total Ad Spend | Blended efficiency (platform-agnostic) |
| Impression Share | Your Impressions / Total Eligible | Market capture rate |
| Frequency | Impressions / Reach | Fatigue risk (>3 = danger) |

### Benchmarks (2026)

**Google Search**

| Metric | Average |
|---|---|
| CPC | $2.96 |
| CTR | 6.11% |
| CVR | 7.04% |
| CPA | $53.52 |
| CPM | ~$12.79 |

**Meta (Facebook + Instagram)**

| Metric | Average |
|---|---|
| CPM | $13.48-$14.19 |
| CPC | $1.72 |
| CTR | 1.38-2.59% |
| CPA | $38.17 (median) |
| ROAS | 1.93x (median) |
| CVR | 1.57% |

**TikTok**

| Metric | Average |
|---|---|
| CPM | $9.16-$13.26 |
| CPC | $1.00-$1.02 |
| CTR | 0.5-1.5% (>2% excellent) |
| CVR | ~1.92% |

**Reddit**

| Metric | Average |
|---|---|
| CPM | $3.50-$15.00 |
| CPC | $0.59-$2.50 |
| CTR | 0.2-0.8% |

**LTV:CAC by Industry**

| Industry | Avg CAC | Target LTV:CAC |
|---|---|---|
| Fintech | $1,450 | 3:1+ |
| B2B SaaS | $702 | 3:1+ |
| E-commerce | $70 | 3:1+ |

### Health Indicators

| Signal | Healthy | Warning | Critical |
|---|---|---|---|
| LTV:CAC | >3:1 | 2:1-3:1 | <2:1 |
| Frequency | <2.5 | 2.5-4.0 | >4.0 |
| CTR (Search) | >5% | 3-5% | <3% |
| CTR (Social) | >1.5% | 0.8-1.5% | <0.8% |
| CVR | >5% | 2-5% | <2% |
| Quality Score | 7-10 | 5-6 | 1-4 |

## Platform Selection

| Platform | Best For | Audience | Avg CPM | Min Budget/mo |
|---|---|---|---|---|
| Google Search | High-intent capture | Everyone who searches | $12-15 | $1,000+ |
| Google PMax | Full-funnel automation | Broad + intent | $2-8 | $3,000+ |
| Meta (FB+IG) | B2C demand gen, lookalikes | 18-55+, behavioral | $13-15 | $500-1,000 |
| TikTok | Gen Z/Millennial discovery | 16-35 | $9-13 | $300-500 |
| LinkedIn | B2B, high-value leads | Professionals | $25-50 | $3,000-5,000 |
| Reddit | Niche communities, tech | Researchers | $3-15 | $500 |
| X (Twitter) | Cultural moments, SaaS | News-aware | $6-10 | Declining ROI |
| CTV/OTT | Broad consumer awareness | TV viewers | Varies | $5,000+ |

**Rule:** Advertisers running 3+ platforms outperform single-platform by 25-35% (unverified benchmark).

**Starter stack:** Google Search (demand capture) + Meta (demand generation). Add TikTok or LinkedIn based on audience.

## Campaign Structure (2025-2026)

### STAGs Over SKAGs

SKAGs are obsolete. Use STAGs (Single Theme Ad Groups): 3-20 keywords grouped by intent theme. More data feeds Smart Bidding faster, lower management overhead.

Reserve SKAGs only for top 5-10 highest-revenue keywords where ad relevance control justifies fragmentation.

### Automation Landscape

| Feature | Platform | Status |
|---|---|---|
| Performance Max (PMax) | Google | Standard. Complement, don't replace Search |
| AI Max for Search | Google | Out of beta May 2025. Replaces DSA |
| Advantage+ Shopping | Meta | 70% YoY adoption growth. 9% lower CPA |
| Smart Bidding Exploration | Google | Active. Auto-explores new queries |
| ECPC | Google | Deprecated March 2025 |

### PMax Best Practices
- Asset groups by theme, not by SKU
- Audience signals: Customer Match lists, website visitors, YouTube engagers
- Campaign-level negative keywords (available since Jan 2025)
- Min threshold: 20-30 conversions/month per campaign
- Starting budget: $100-150/day for 4-6 weeks

## Bidding Strategies

### Google Ads Decision Tree

| Strategy | When | Data Needed | Risk |
|---|---|---|---|
| Manual CPC | New campaign, <15 conv/mo | None | Time-intensive |
| Maximize Clicks | Traffic, no conversion data | None | Low |
| Maximize Conversions | Scale volume, flexible CPA | 15-20 conv/mo | Can overspend |
| Target CPA | Predictable cost per lead | 15-30 conv/mo | Limits volume |
| Target ROAS | E-commerce, varying values | 30-50 conv/mo | Can starve spend |
| Max Conversion Value | Revenue over volume | 30+ conv/mo | Similar to tROAS |

**Graduation path:** Manual CPC → Maximize Conversions → Target CPA/ROAS

**Key:** Switching from Target CPA to Target ROAS yields avg 14% more conversion value at similar ROAS.

### Meta Ads Bidding

| Strategy | When |
|---|---|
| Highest Volume | Maximize conversions, flexible CPA |
| Cost Cap | Need average CPA within range |
| ROAS Goal | Revenue-focused, strong CAPI signal |
| Minimum ROAS | Floor ROAS threshold (new late 2025) |

## Ad Copy Frameworks

### By Awareness Level

| Framework | Audience Stage | Structure |
|---|---|---|
| AIDA | Unaware/Problem-aware | Attention → Interest → Desire → Action |
| PAS | Problem-aware | Problem → Agitation → Solution |
| BAB | Solution-aware | Before → After → Bridge |
| Hook-Story-Offer | Any (video) | Pattern interrupt → Narrative → CTA |
| FAB | Product-aware | Features → Advantages → Benefits |

**PAS** is the most versatile. Agitation is the power step: don't skip it.

**Hook-Story-Offer** dominates TikTok and Meta video. First 3 seconds determine 80% of outcome.

**Hybrid approach:** PAS for hook, FAB for body, AIDA for close.

## Creative Testing

### Hierarchy (test in order, highest impact first)

1. **Concept** — Core angle/promise (2x-5x swings)
2. **Format** — Static vs video vs carousel vs UGC
3. **Hook** — First 1-3 seconds / headline
4. **Body/Visual** — Supporting content
5. **CTA** — Button text, offer framing

### Methodology
- Change ONE variable per test
- 95% confidence, minimum 7 days
- 1,000 conversions or 10,000+ impressions per variant for significance
- Use CTR as directional signal for creative tests; CPA/ROAS for concept-level decisions

### The 3-3-3 Framework
3 audiences x 3 creative concepts x 3 ad variations per concept.

### Creative Lifespan

| Platform | Professional | UGC |
|---|---|---|
| TikTok | 1-2 weeks | 7-14 days |
| Meta | 3-4 weeks | 2-3 weeks |
| LinkedIn | 6-8 weeks | 4-6 weeks |
| YouTube | 4-8 weeks | 3-4 weeks |

### Fatigue Signals

| Signal | Threshold | Action |
|---|---|---|
| Frequency | >2.5 (prospecting) | Immediate refresh |
| CTR decline | >20% drop over 7-14 days | Begin refresh |
| CPM increase | >50% while CTR flat | Algorithm deprioritizing |
| CVR drop | >15% week-over-week | Urgent refresh |

## Audience Segmentation

### By Intent Level

| Type | Intent | Best Use |
|---|---|---|
| Remarketing (cart abandon) | Highest | Conversion campaigns |
| Customer Match (CRM) | Very high | Upsell, retention, exclusions |
| In-market | High | Acquisition, bottom-funnel |
| Custom Intent (competitor URLs) | High | Acquisition |
| Lookalike/Similar | Medium | Scaled acquisition |
| Custom Affinity | Low-medium | Awareness |
| Broad Affinity | Low | Brand awareness only |

### Lookalike Best Practices
- Seed with top 10% by LTV, not all customers
- Use recent purchasers (last 90 days)
- 1% = most similar; 10% = broadest
- Result: +17% revenue per transaction, -20% CPA vs interest-based

### Customer Match
Upload hashed email + phone + name + zip. Google matches 40-60%. Use for upsell, exclusion from acquisition, and suppression from discount campaigns.

## Retargeting

### Funnel Stages

| Stage | Audience | Window | Frequency | Message |
|---|---|---|---|---|
| TOFU | Content readers | 30-60 days | 5-7x/week | Educate, trust |
| MOFU | Product visitors | 14-30 days | 7-10x/week | Features, proof |
| BOFU | Cart abandoners | 7-14 days | 10-15x/week | Urgency, discount |
| Post-purchase | Buyers | 30-90 days | 2-3x/week | Upsell, referral |

### Critical Rules
- Exclude recent purchasers from acquisition campaigns
- Exclude BOFU from TOFU campaigns
- Exclude 30-day non-converters (fatigue)
- Sequential messaging > repetition (2-3x higher CVR)

## Budget Allocation

### By Growth Stage

| Stage | Testing | Scaling | Retargeting |
|---|---|---|---|
| Early (proving) | 50% | 30% | 20% |
| Growth (profitable) | 30% | 50% | 20% |
| Scale (optimizing) | 20% | 70-80% | 10-20% |

### Cross-Platform Split (benchmark)
- 40% Google Ads (high-intent)
- 35% Meta (awareness + retargeting)
- 25% Emerging channels (TikTok, LinkedIn, CTV)

### Kill Criteria

| Situation | Action |
|---|---|
| Spent 2x target CPA, 0 conversions | Kill immediately |
| Spent 1.5x target CPA, 1 conversion | 24 more hours |
| CTR <1.0% after 1,000 impressions | Replace creative |
| No KPIs after 72 hours | Kill |

### Scaling Rules
- Max 20-30% budget increase per change
- Wait 5-7 days between increases
- For Target ROAS: lower target by 5-10% when scaling
- Horizontal scaling (new audiences/geos) > vertical (more budget into same)

## Attribution

### Current State (2025-2026)

Google removed First Click, Linear, Time Decay, Position-Based in Oct 2023. Choice is now:

| Model | How | When |
|---|---|---|
| Last Click | 100% to final touchpoint | <200 conv/month |
| Data-Driven (DDA) | ML-distributed credit | >200 conv/month |

**Critical warning:** Platform-native attribution is biased. Every platform over-credits itself. Always compare platform ROAS vs blended MER (total revenue / total ad spend).

TikTok is undervalued by last-click by up to 10.7x due to halo effect on Google search volume (vendor-claimed, not independently verified).

## Quality Score / Relevance

### Google Ads Quality Score (1-10)

| Component | Weight | What Matters |
|---|---|---|
| Expected CTR | Highest | Historical CTR |
| Ad Relevance | Medium | Copy matches query intent |
| Landing Page Experience | Medium | Speed, relevance, mobile, CTA |

**Impact:** QS 5→8+ reduces CPC by 30-50%.

### Meta Relevance Diagnostics

| Ranking | Measures |
|---|---|
| Quality Ranking | Perceived quality vs competitors |
| Engagement Rate | Expected engagement vs competitors |
| Conversion Rate | Expected CVR vs same-goal ads |

High relevance = lower CPM, better delivery, 5-12% cost reduction.

## Landing Page Optimization

### Above-the-Fold Requirements
1. Confirm visitor is in the right place (message match with ad)
2. State primary value proposition
3. Clear CTA

CTAs above the fold: +317% conversion lift (unverified benchmark).

### Speed Benchmarks
- Target: <2 seconds load
- 0.1s improvement = +10% conversions (travel), +8.4% (e-commerce)
- LCP <2.5s, INP <200ms, CLS <0.1

### Message Match
Ad headline and page H1 must use the same language. Disconnects are the #1 driver of Quality Score penalties.

## Conversion Tracking

### Server-Side is Mandatory

| Dimension | Client-Side (Pixel) | Server-Side (API) |
|---|---|---|
| Ad blocker impact | Blocked 15-40% | Bypassed |
| iOS restrictions | Degraded | Minimal impact |
| Data accuracy | 60-85% | Near 100% |
| Reported lift | Baseline | +10-34% more conversions |

**Run both in parallel with event deduplication via shared `event_id`.**

### Platform APIs

| Platform | Solution |
|---|---|
| Google | GA4 Measurement Protocol (server-side) + Enhanced Conversions + sGTM |
| Meta | Conversions API (CAPI) |
| TikTok | Events API |
| LinkedIn | Conversions API |

### GA4 Measurement Protocol
Server-side event tracking via GA4. Details and gotchas → `../google-ads/SKILL.md`.

### Consent Mode V2 (mandatory EEA/UK)
- Requires Google-certified CMP (Cookiebot, OneTrust, etc.)
- Recovers 30-50% of previously lost conversions via modeled fill
- Two signals: `ad_user_data` and `ad_personalization`

### Privacy Landscape
- iOS 14.5+ opted out majority of users from IDFA tracking
- Third-party cookies functionally unreliable (Safari ITP ~30% of browsers)
- First-party data is the imperative: email capture + CRM + Customer Match + sGTM

## Cross-Platform Funnel

### Sequencing

```
TikTok/Meta → Spark awareness, cultural resonance
YouTube → Deepen engagement, explain product
Google Search → Close high-intent traffic
Email/SMS → Retain and upsell
```

### Platform Funnel Roles

| Platform | Stage | Mechanism |
|---|---|---|
| Google Search | Bottom | Purchase intent |
| Google PMax | Full | Automated all-inventory |
| YouTube | Mid/Upper | Video engagement |
| Meta | Mid/Upper | Interest + behavior |
| TikTok | Upper | Discovery + viral |
| LinkedIn | Mid | Professional intent |

## Emerging Trends (2025-2026)

- **AI-generated video ads:** 86% of ad buyers use GenAI for video. 40% of all video ads projected AI-generated by end 2026
- **CTV/OTT:** Digital video captures ~70% of US TV/video ad spend. QR-code CTV ads gaining traction
- **TikTok Search Ads:** 1 in 4 users searches within 30 seconds. +66% CTR, -33% CPA vs standard
- **Shoppable ads:** Buy without leaving app (IG, TikTok, YouTube product tags)
- **Value-based bidding:** Moving from "maximize conversions" to "maximize margin" using COGS-adjusted values
- **Retail Media Networks:** Amazon, Walmart building walled gardens on purchase data
- **AI Max:** Google's full automation replacing DSA. 7% more conversions at similar CPA
- **Broad match renaissance:** Broad match + Smart Bidding + strong conversion signal outperforms exact match in mature accounts

---

# Competitive Intelligence & Defensive Techniques

## Ad Cloaking (How It Works)

Cloaking shows one page to platform reviewers and a different page to real users. Understanding this is essential for detecting when competitors use it and for protecting your own campaigns from false comparisons.

### Architecture: Traffic Distribution Systems (TDS)

Every cloaking setup uses a TDS: an intermediary server that inspects each request and routes to either:
- **White page:** Clean, policy-compliant (shown to bots/reviewers)
- **Black page:** Actual offer/restricted content (shown to real users)

### Detection Signals Used by Cloakers

| Signal | How It Works |
|---|---|
| IP matching | Databases of Google/Meta corporate subnets. Platform IPs get white page |
| User-Agent | Known crawler UAs (Googlebot, facebookexternalhit) get white page |
| JavaScript fingerprint | Screen res, canvas, WebGL, timezone. Headless browsers fail checks |
| Referrer filtering | Clicks from known review tool domains get white page |
| Geolocation | Platform review team locations get white page |
| Behavioral analysis | Scroll depth, mouse movement, time-on-page. Crawlers don't interact |
| Click ID splitting | Presence/absence of gclid, fbclid routes differently |

### Domain Rotation
Operators maintain pools of domains. When one gets flagged, ads point to the next. Automation makes this near-instantaneous.

### Platform Detection Methods
- **Google:** Googlebot crawl + secondary automated systems + real browser review + AI pattern matching. "Circumventing Systems" policy = account suspension
- **Meta:** AI comparison of ad vs landing page + real-device farms with human operators + legal action against scam advertisers
- **TikTok:** Physical device farms with human operators. Less mature detection than Google/Meta

### Risks
- Immediate account ban
- Permanent domain blacklisting
- Payment method suspension
- Legal action (Meta has sued cloaking operators)
- Loss of all account history and Quality Scores

## Ad Policy Circumvention (Detection & Defense)

Competitors in restricted categories sometimes use circumvention techniques. Recognizing these patterns helps you detect unfair competition and protect your own accounts from false-positive policy violations.

### Common Circumvention Signals to Detect

| Signal | What It Indicates |
|---|---|
| Competitor landing page differs from ad copy | Possible bridge page / redirect chain in use |
| Competitor rotates domains frequently | Domain rotation strategy to evade bans |
| Ads from unknown agency accounts for regulated offers | White label abuse (getting restricted content approved via whitelisted accounts) |
| Compliant ads followed by sudden creative pivot | Account warming then switching to restricted content |

### Restricted Categories Most Commonly Targeted
Crypto/DeFi, gambling/casinos, pharma/supplements, make money online, adult content, payday loans.

Google removed 270.7 million gambling-related ads in 2025 alone.

### Protecting Your Own Accounts
- Keep landing page content fully consistent with ad copy — disconnects trigger automated policy review
- Never use redirect chains; direct URLs only
- Run compliant creative from launch; do not "warm" then switch
- If operating in a sensitive vertical, get legal review of landing page content before launch

## Click Fraud & Competitor Sabotage (Detection & Defense)

Click bombing — repeatedly clicking competitor ads to exhaust their budget — is real and common. **Scale:** 15-30% of all ad clicks in competitive markets are fraudulent. H1 2025 global ad fraud rate: 39.7% (unverified benchmark).

### Detection Signals in Your Own Campaigns

| Signal | Indicates |
|---|---|
| High CTR + near-zero conversions | Fraudulent clicks |
| Traffic spikes at unusual hours | Bot activity |
| Clicks concentrated in specific IP ranges | Click farm |
| CVR collapse with stable traffic | Invalid traffic |
| Homogeneous user-agent strings | Automation |

### Protection Tools

| Tool | Strengths |
|---|---|
| ClickCease | Easy setup, 2000+ behavior tests/visit |
| TrafficGuard | Prevention Mode (blocks before spend) |
| ClickPatrol | 4-pillar framework, anomaly detection |
| SpiderAF | Behavioral fingerprinting |

### Google Ads IP Exclusion
Exclude up to 500 IP addresses/ranges. Identify abusing IPs from Click Performance report.

## Gray Hat Techniques (Awareness)

Boundary-pushing conversion tactics (fake urgency, fake social proof, confirmshaming, misleading before/after imagery, fake chat widgets) are widespread in performance marketing and are used by competitors. Be aware they exist; platforms and regulators (FTC, ASA) are increasingly enforcing against them. Avoid them in your own campaigns — detection and enforcement risk is rising, and they erode long-term brand trust.

## Affiliate Fraud (Detection & Defense)

Affiliate fraud inflates reported conversions without real business value. Common fraud types to watch for: cookie stuffing (hidden pixel sets affiliate cookie without a real click — 60% of affiliate fraud), forced clicks (auto-redirects through tracking links), pixel stacking (hidden ad impressions), incentivized traffic (real humans paid to fill forms, passes bot detection), fake leads (synthetic identities), and postback manipulation (fabricated server-side conversion signals).

### Detection Methods
- Behavioral fingerprinting and session tracking
- Duplicate data detection (same email/phone across "unique" conversions)
- Geolocation mismatches (click origin vs conversion IP)
- Time-of-day analysis (bulk fills during off-hours)
- Cross-affiliate correlation
- Zero downstream intent: high opt-out, zero purchases, no email opens

## Counter-Measures Checklist

### Detecting Competitor Techniques Against You
1. Pull Click Performance report, filter by IP
2. Export raw session logs, identify high-frequency IPs
3. Cross-reference against datacenter/proxy CIDR blocks
4. Segment conversions by hour/device vs 4-week baseline
5. Check geographic anomalies in click origin vs target market
6. Monitor brand search volume for unexplained drops (competitor cloaking your brand terms)

### Monitoring Competitor Ads
- **Meta Ad Library:** Free, shows all active ads any account runs
- **Google Ads Transparency Center:** Public disclosure for Google ads
- **SpyFu, SEMrush, SimilarWeb:** Competitive PPC intelligence
- **AdSpy, BigSpy:** Ad creative tracking across networks

### Reporting Violations
- **Google:** Third Party Policy Violation Report Form or "Report this ad" button. 3 strikes = suspension
- **Meta:** Three-dot menu on any ad → Report
- **FTC (USA):** ReportFraud.ftc.gov for deceptive advertising

## Bot Traffic Reality (2025)

- 51%+ of internet traffic is automated
- 37% classified as malicious bots
- H1 2025 global ad fraud rate: 39.7%, peaked 49% in June (unverified benchmark)
- SlopAds scheme (disrupted 2025): peaked at 2.3 billion bid requests/day via hidden WebViews in Android apps

---

# Geo-Targeting & Emerging Markets

## Multi-Country Rules
- NEVER run a single global campaign. Separate by country/cluster + language + budget priority
- Geo-targeted campaigns: +20% higher CVR vs broad
- In bilingual markets (SE Asia), target native language AND English

## Regional Notes

### Southeast Asia
- Digital ad spend: $24.09bn (2025), 15% CAGR through 2031
- Mobile-first (70%+ time online is mobile)
- TikTok + Instagram dominant for discovery, Google Search for intent
- WhatsApp for communication (click-to-WhatsApp ads work well)
- **Google Ads policy (April 2026):** Indonesia, Vietnam, Thailand, Philippines added to mandatory financial services verification. 30-day window to comply or face category suspension. Requires regulatory authorization + AML/KYC documentation.

### Google Search CPC by Country (2025-2026 benchmarks, all industries average)

These figures are for Google Search ads (not AdSense publisher CPC). Sources: WordStream country study, AdAmigo.ai 2026 data.

| Country | Avg CPC (Search) | vs US baseline | CPM (Display/Awareness) |
|---------|-----------------|----------------|------------------------|
| Philippines | $0.25–$0.50 | -75% | ~$3.50 |
| Thailand | $0.42–$0.84 | -58% | ~$3.90 |
| Indonesia | $0.38–$0.76 | -62% | ~$2.80 |
| Malaysia | $0.25–$0.50 | -75% | ~$4.80 |
| Vietnam | $0.24–$0.48 | -76% | ~$2.10 |
| India | $0.23–$0.46 | -77% | ~$2.60 |
| Pakistan | $0.16–$0.32 | -84% | ~$2.20 |
| Bangladesh | $0.21–$0.42 | -79% | ~$2.00 |
| South Korea | $0.56–$1.40 | -72% (but Naver dominates) | ~$10.20 |

**Finance/trading keywords add a 2x–5x premium** on top of the all-industry average above. Philippines financial services: ₱40–120/click (~$0.70–$2.10). India finance: ₹45/click avg (~$0.54), CPL ₹500–1,500.

### Finance & Trading Keyword CPC Estimates for SEA (2025)

No public source publishes exact per-keyword CPC for "copy trading" / "earn money online" in SEA. Derived estimates based on industry multipliers:

| Keyword Category | Estimated CPC Range (SEA) | Notes |
|-----------------|--------------------------|-------|
| "earn money online" / "online jobs" | $0.05–$0.30 | High volume, low quality intent; attracts bots/signal seekers |
| "online trading" / "forex trading" | $0.40–$1.50 | Moderate competition in SEA |
| "copy trading" / "social trading" | $0.30–$1.20 | Lower competition than "forex" in SEA |
| "trading platform" | $0.50–$2.00 | Most competitive finance keyword |
| "invest online" / "investment app" | $0.30–$1.00 | Growing competition |

**Warning:** "earn money online" / "online jobs" keywords in SEA attract extremely high bot/click-farm traffic. Our campaign experience (May 2026) confirms: high CTR, near-zero conversion quality. Heavy negatives required.

### Financial Services Google Ads Benchmarks (Global, Finance & Insurance Category — WordStream 2025)

These are the best available benchmarks. SEA CPCs are ~60–80% lower but CVR and quality patterns are similar:

| Metric | Finance & Insurance | All Industries Avg |
|--------|--------------------|--------------------|
| CTR (Search) | 8.33% | 6.66% |
| CPC | $3.46 (US-anchored) | $5.26 |
| CVR | 2.55% | 7.52% |
| CPA (CPL) | $83.93 | $70.11 |

**Fintech specifically** (B2B fintech per LeverDigital/Varos 2025):
- CVR: 1.23%–2.8% (lower than general finance due to trust barriers)
- CPC: $3–$6 (US market; SEA equivalent: $0.50–$2.00 for trading keywords)
- CPA (free signup): $50–$150 (US); SEA equivalent: $3–$25 depending on keyword quality
- Target CVR for free signup funnel: 5%–10% (optimistic); realistic landing at 2%–4%

### CPA Estimates for Free Sign-Up Funnels in SEA (2025-2026)

Derived from CPC data × typical CVR:

| Country | CPC Range (trading kws) | CVR Estimate | Estimated CPA (sign-up) |
|---------|------------------------|--------------|------------------------|
| Philippines | $0.40–$0.80 | 3%–6% | $7–$27 |
| Indonesia | $0.30–$0.70 | 3%–6% | $5–$23 |
| Malaysia | $0.50–$1.00 | 4%–7% | $7–$25 |
| Thailand | $0.40–$0.90 | 3%–5% | $8–$30 |
| Vietnam | $0.25–$0.60 | 2%–5% | $5–$30 (ad blocker problem) |
| India | $0.20–$0.60 | 3%–5% | $4–$20 |
| Pakistan | $0.10–$0.40 | 2%–4% | $3–$20 |
| Bangladesh | $0.10–$0.35 | 2%–4% | $3–$18 |
| South Korea | $1.00–$3.00 | 4%–8% | $13–$75 (Google only ~30% share) |

Observed in production (a BR free-signup funnel): ~$6 BRL-equivalent CPA at low daily spend — confirms SEA CPAs of $5–$15 are achievable.

### Budget Testing Recommendations for SEA/South Asia (2025)

- **Minimum effective daily budget per country:** $10–$20/day (enough to exit learning phase at SEA CPCs)
- **To exit Smart Bidding learning phase:** Need 15–20 conversions in 30 days = budget must support that at target CPA
- **Multi-country testing stack:** Start with 3–4 markets, $15–$25/day each = $45–$100/day total
- **Proven allocation for 9-country test:**
  - Tier 1 (highest intent, lowest fraud): Malaysia, Philippines, Thailand → 40% of budget
  - Tier 2 (high volume, moderate quality): Indonesia, India → 35% of budget  
  - Tier 3 (test/watch): Vietnam, Bangladesh, Pakistan, South Korea → 25% of budget
- **30-day pilot budget to generate meaningful data:** $900–$1,500 total across 3–4 markets
- **South Korea caveat:** Google only ~30% search share. Naver (62%) requires separate platform + Korean-language creative. Budget accordingly if targeting KR seriously.

### Vietnam-Specific Insights (2025)

- **Ad blocker penetration: ~38%** of internet users block ads (among the highest in Asia)
- **Coc Coc browser** (18% market share, ~51% of local search) has built-in AdBlockPlus integration — Google Ads reach is significantly reduced
- **Google Search CTR on Coc Coc text ads:** 3–6% (comparable to Google when shown)
- **Implication:** Your Google Ads reach in Vietnam is probably 25–35% lower than raw impression numbers suggest. Factor this into CPM math.
- Search advertising is the #1 digital ad format in Vietnam (Google has >90% of search spend despite Coc Coc's browser share)
- Mobile-first: ~46% of internet traffic from smartphones
- Evening peak (8–11 PM local): 3x higher conversion rates vs daytime

### South Korea-Specific Insights (2025)

- **Naver: 62.86% search share** (up from 58% in 2024, reclaimed first place)
- **Google: ~29–31% search share** — still significant but minority
- **Google Ads CPC in Korea: 72% below US average** but this reflects limited competition, not low intent
- **Naver Ads CPC is HIGHER than Google** in Korea — bid-driven (no Quality Score), 10–15 ad spots per SERP
- **For finance/trading:** Google Ads in Korea reaches the younger, international-leaning demographic. Naver reaches the mass market. For copy trading targeting English-literate or internationally-aware Koreans, Google may outperform despite lower market share.
- **PIPA compliance:** Korea's Personal Information Protection Act restricts cross-border data transfers. Server-side tracking from Korean users may require local data handling.
- **Language:** Korean-language ads mandatory for Naver. Google ads can run in English but Korean creatives will outperform on CTR.
- **Minimum Naver CPC:** 70 KRW (~$0.054) — very low floor, but competitive keywords bid much higher.

### South Asia
- India: ~15% annual growth 2024-2029
- Low CPCs vs Western markets (ROI arbitrage)
- YouTube dominant (TikTok banned in India)
- Lightweight landing pages for tier-2/tier-3 cities (2G/feature phones)
- India finance Google Ads: CTR 4.5–7%, CPC ₹45 avg (~$0.54), CPL ₹500–1,500 (~$6–$18)

### Africa
- Mobile-first mandatory, low desktop penetration
- WhatsApp is dominant communication platform
- Extreme regional variation (South Africa, Nigeria, Kenya each different)

---

# Quick Reference

## Campaign Launch Checklist
- [ ] Clear goal defined (CPA target, ROAS target, or awareness KPI)
- [ ] Conversion tracking verified (pixel + server-side + deduplication)
- [ ] Landing page message matches ad copy
- [ ] Landing page loads <2s on mobile
- [ ] Budget set (testing: 2x target CPA/day minimum)
- [ ] Negative keywords added (Google)
- [ ] Audience exclusions set (existing customers, recent converters)
- [ ] Creative: minimum 3 concepts for testing
- [ ] Attribution model selected (Last Click or DDA)
- [ ] Consent Mode V2 if targeting EU/UK

## Weekly Optimization Cadence
1. Review spend vs budget (pacing)
2. Check CPA/ROAS vs targets
3. Review search terms, add negatives (Google)
4. Check creative performance, pause fatigued assets
5. Review audience performance, adjust bids
6. Compare platform ROAS vs blended MER
7. Update this skill with learnings

