## Contents

- [The Change (CBP → PMP, July 2025)](#the-change)
- [Message Categories & Billing](#message-categories--billing)
- [Free Messaging Windows](#free-messaging-windows)
- [Per-Message Rates (2026, USD approximate)](#per-message-rates-2026-usd-approximate)
- [Authentication-International Rates](#authentication-international-rates)
- [Volume Tier Discounts (Utility & Authentication only)](#volume-tier-discounts-utility--authentication-only)
- [Cost Optimization Strategies](#cost-optimization-strategies)
- [Meta Base Per-Message Rate Card (June 2026)](#meta-base-per-message-rate-card)
- [BSP / Platform Comparison](#bsp--platform-comparison)
- [Pricing Model Notes](#pricing-model-notes)
- [Why BSP over Direct API / Direct Cloud API without your own dev account](#why-bsp-over-direct-api)

> **Note:** This file covers Meta base rates, free windows, volume discounts, cost optimization, BSP/platform comparison, and pricing model notes.

## 5. Conversation-Based Pricing → Per-Message Pricing (July 2025)

### The Change

**Effective July 1, 2025:** Meta replaced Conversation-Based Pricing (CBP) with Per-Message Pricing (PMP).

- **Before:** One flat fee per 24-hour conversation window, regardless of how many messages
- **After:** Each **delivered** template message is billed individually
- Failed deliveries: not charged
- Service messages (free-form replies within CSW): still free
- Utility templates sent within an open CSW: **free**

### Message Categories & Billing

| Category | Inside CSW | Outside CSW |
|---|---|---|
| Marketing | Charged | Charged |
| Utility | **Free** | Charged |
| Authentication | Charged | Charged |
| Service (free-form) | **Free** | Not allowed |

### Free Messaging Windows

1. **24-hour Customer Service Window (CSW):** Opens when a user sends you any message **or makes/receives a call through the Calling API**. All free-form messages and utility templates sent within this window are free. Window resets with each new inbound message or call from the user. Service conversations have been free with no monthly cap since **November 1, 2024** (Meta removed the previous 1,000 service conversation/month cap on that date).

2. **72-hour Entry Point Window:** When a user on **Android or iOS** initiates contact via a Click-to-WhatsApp (CTWA) ad or Facebook Page CTA button, and the business responds within 24 hours, all messages to that user (including marketing templates) are **free for 72 hours**. Note: desktop and web WhatsApp clients do not trigger this free entry point window.

### Per-Message Rates (2026, USD approximate)

| Market | Marketing | Utility | Authentication |
|---|---|---|---|
| India | $0.0094–$0.0118 | $0.0014–$0.0015 | $0.0014–$0.0015 |
| Indonesia | $0.0283 | $0.022 | $0.022 |
| Brazil | $0.0625 (base; some sources show ~$0.0719 effective April 2026 — verify against current Meta rate card) | $0.0068 (Tier 1/base; volume discounts reduce incrementally) | $0.0068 (Tier 1/base) |
| Mexico | $0.0305 | $0.004–$0.0085 | $0.0085 |
| United States | $0.025–$0.029 | $0.004–$0.0088 | $0.004–$0.0088 |
| United Kingdom | $0.0382–$0.048 | $0.020 | $0.020 |
| Germany | $0.1131–$0.1365 | $0.0456–$0.050 | $0.0456–$0.050 |
| UAE | $0.0499 | $0.0157 | $0.0157 |

> Rates vary slightly by BSP and are updated periodically. Check the official Meta pricing page and your BSP's rate card.

### Authentication-International Rates

Cross-border OTP delivery (sending auth templates to users in a different country than your business number) has higher rates in some markets. UAE, for example, has an auth-international rate of ~$0.051 vs. $0.0157 domestic.

### Volume Tier Discounts (Utility & Authentication only)

Marketing messages receive **no volume discounts**. Utility and authentication qualify for monthly tiered discounts:

| Tier | Volume (monthly) | Discount |
|---|---|---|
| 1 | Standard | 0% |
| 2 | 10,000–100,000 | 5% |
| 3 | 100,000–1,000,000 | 10% |
| 4 | 1,000,000+ | 15-20% |

Tiers reset monthly. Discounts are applied automatically by Meta.

**Regional authentication discounts (July 2025):**
- Brazil: -78%
- Mexico: -65%
- Most LATAM/APAC: avg -74%
- Western Europe utility: -43%
- Middle East utility: -42%

### Cost Optimization Strategies

1. **Leverage the CSW:** Any inbound message opens a free 24-hour window. Trigger customer-side messages via CTWA ads to open free windows before sending utility content.
2. **CTWA ads for marketing:** 72-hour free window makes marketing via ad-initiated conversations much cheaper.
3. **Batch utility in CSW:** If a user contacts you, reply immediately with all utility info (order status, tracking, confirmation) within that free window.
4. **Segment and personalize:** Generic broadcasts drive block rates, which hurt quality rating, which limits throughput tiers.
5. **Clean your contact list:** Charged per delivered message. Failed deliveries aren't charged, but sending to dead numbers wastes API calls and can hurt quality metrics.
6. **Misclassification risk:** Meta can reclassify marketing content submitted as utility. Always match category to actual content.
7. **Fund the wallet per-day, never bulk (disposable/free-tier BSP):** Top up only the current day's send budget plus a small buffer each day, immediately before sending — never pre-fund a multi-day ramp. A suspended or risk-flagged BSP account can freeze a large prepaid balance. Full doctrine: `meta` skill → `disposable-bm-strategy.md` (Number Warming Protocol → "Wallet funding").

---

## WhatsApp Business API: Pricing Reference (June 2026)

> Rates reflect Meta's per-message model (effective July 1, 2025). All BSP markups are layered on top of Meta's base rates. Verify live rates at [developers.facebook.com/documentation/business-messaging/whatsapp/pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) — Meta updates quarterly (Jan 1, Apr 1, Jul 1, Oct 1).

### Meta Base Per-Message Rate Card

> What's free: (1) **Service messages** (user-initiated, within 24h window) — free, no cap, since Nov 1 2024. (2) **Utility templates** sent *within* an open 24h customer-service window — free since Jul 1 2025. (3) **All message types** for 72h after a Click-to-WhatsApp ad or Facebook Page CTA entry point. Undelivered messages are never charged.

| Category | Brazil (BR) | India (IN) | Indonesia (ID) | USA | Notes |
|---|---|---|---|---|---|
| **Marketing** | $0.0625/msg (verify: one source cites $0.07188 effective Apr 1 2026 — unresolved) | $0.0094–$0.0118/msg | $0.0360–$0.0473/msg | $0.025–$0.029/msg | No volume discount for marketing in any market |
| **Utility** | $0.0068–$0.00782/msg (free inside 24h CSW) | $0.0014/msg | $0.0225–$0.0250/msg | $0.004/msg | Volume tiers: ~5–25% discount at 100k–10M+/mo |
| **Authentication** | $0.0068–$0.00782/msg (verify — wide source range, see notes) | $0.0014/msg | $0.0225–$0.0250/msg | $0.004/msg | Auth-International rates apply when recipient country differs from WABA country |
| **Service** | **$0.00 (free)** | **$0.00 (free)** | **$0.00 (free)** | **$0.00 (free)** | Free since Nov 1 2024, no monthly cap |

**Brazil rate notes:** Marketing rate of ~$0.0625 is among the highest globally — ~6x India, ~2.5x US. BRL-native billing (Meta invoicing in R$) expected H2 2026; Meta to publish official BRL rate card by Jul 1 2026. Until then all Brazil accounts billed in USD. April 2026 quarterly update primarily affected India, Saudi Arabia, Pakistan, and Turkey — Brazil marketing rate change in that update is disputed ($0.0625 per engagelab May 2026 vs $0.07188 per SleekFlow citing Apr 1 2026). Use $0.0625 as working baseline and flag for verification.

### BSP / Platform Comparison

> **Note:** Gupshup embedded signup only shows WABAs not already Connected to another BSP. If migrating a live WABA that is currently bound to a different BSP, the real WABA will not appear in the picker until released from the current BSP (see "Switching BSP / Migrating an Existing WABA" section).

> **How to read this table:** "Per-msg markup" is what the BSP charges *on top of* Meta's base rate above. Total cost = Meta base rate + markup + monthly fee amortized per message. Sorted approximately cheapest-first for Brazil marketing dispatch at moderate volume.

| Platform | Type | Monthly fee | Free tier | Per-msg markup (Brazil marketing) | Brazil notes | Source / asOf |
|---|---|---|---|---|---|---|
| **YCloud (Free plan)** | BSP | **$0/mo** | Unlimited API; service msgs $0 (empirically confirmed totalPrice:0 in production); utility-in-window $0; shared inbox included; 1 user, 2 channels | **0%** — explicit zero-markup policy; passes Meta rates from wallet; empirically confirmed at ~$0.05–$0.0625/msg for BR marketing | Best Brazil dispatch value: pay only Meta's rate. BRL billing H2 2026. Add-on users $10/user/mo, channels $5/channel/mo. ⚠️ Risk-control auto-flags possible on free tier for financial use cases (reported by financial-niche accounts, resolved via support ticket in <24h) — open a support ticket immediately if suspended, false-positive rate is high | ycloud.com/pricing — asOf 2026-06-03 (HIGH) |
| **YCloud (Growth)** | BSP | $39/mo | — | 0% | Same zero-markup; $39 unlocks 2 users, 3 channels, 5M AI credits. Message cost unchanged | ycloud.com/pricing — asOf 2026-06-03 (HIGH) |
| **YCloud (Pro)** | BSP | $89/mo | — | 0% | 6 users, 8 channels, 20M AI credits, dedicated account manager | ycloud.com/pricing — asOf 2026-06-03 (HIGH) |
| **YCloud (Enterprise)** | BSP | $399/mo | — | 0% | 40 users, 30 channels, 100M AI credits, 24/7 priority support, permanent storage | ycloud.com/pricing — asOf 2026-06-03 (HIGH) |
| **Bird (formerly MessageBird)** | BSP | $45–$49/mo (Pro); PAYG available | Free plan: 15 AI msgs/day; no WhatsApp free quota confirmed | ~$0.000001–$0.000005/msg processing fee (effectively $0 markup) — passes Meta rates at cost | Near-zero markup makes Bird cost-competitive for high-volume BR dispatch. No BRL billing. Annual contract discounts 10–35% (verify — secondary, asOf 2026-06-03, MEDIUM) | bird.com/en-us/pricing/whatsapp — asOf 2026-06-03 (MEDIUM) |
| **AiSensy (Free)** | BSP | **$0/mo** | WhatsApp API access, live chat dashboard, 10 tags, 5 custom attributes, $1 wallet credit on signup; no time limit. Broadcasts PAYWALLED — free plan can't broadcast | Claimed 0% (verify — not independently confirmed) | India-primary; international USD pricing at $45/$99. No BRL billing. $1 credit = ~16 BR marketing msgs at $0.0625. Brazil customers pay Meta BR rates from wallet | aisensy.com/pricing/usd — asOf 2026-06 (HIGH on plan price; MEDIUM on 0% markup claim) |
| **AiSensy (Basic)** | BSP | $45/mo ($40.50 annual) | — | Claimed 0% (verify) | 5 agents included. Chatbot flows add-on $80/mo. No BRL billing | aisensy.com/pricing/usd — asOf 2026-06 (HIGH) |
| **AiSensy (Pro)** | BSP | $99/mo ($89.10 annual) | — | Claimed 0% (verify) | Additional agents $20/mo each | aisensy.com/pricing/usd — asOf 2026-06 (HIGH) |
| **Respond.io (Starter)** | BSP | $79/mo (annual) / $99/mo (monthly) | 7-day trial; no permanent free plan | **0%** — explicit pass-through; wallet debited at Meta's rate | Unlimited MACs on Starter. Zero markup confirmed on official docs. No BR-specific pricing or BRL billing mentioned. Additional users $12/user/mo | respond.io/pricing — asOf 2026-06 (HIGH) |
| **Respond.io (Growth)** | BSP | $159/mo (annual) / $199/mo (monthly) | 7-day trial | 0% | 1,000 MACs included; overage $12/100 MACs. +$20/user/mo beyond included seats | respond.io/pricing — asOf 2026-06 (HIGH) |
| **Zoko (Starter)** | BSP | $49.99/mo | 7-day trial | +$0.015/conversation (Zoko markup on top of Meta) — only on Starter | Starter is the only Zoko plan with a markup. Not recommended for BR marketing at scale | zoko.io/pricing — asOf 2026-06 (HIGH) |
| **Zoko (Plus)** | BSP | $79.99/mo | 7-day trial | **0%** — Plus/Elite/Max all pass Meta rates through; platform overages $0.002/conversation beyond 5k | D2C/Shopify-focused. Zero markup from Plus upward. No BRL billing | zoko.io/pricing — asOf 2026-06 (HIGH) |
| **Zoko (Elite)** | BSP | $139.99/mo | — | 0% | 10 agents included; $0.001/conversation overage beyond 100k | zoko.io/pricing — asOf 2026-06 (HIGH) |
| **Twilio WhatsApp** | CPaaS | **$0/mo** | $15 trial credit (~222 BR marketing msgs); no production free tier | **+$0.005/msg flat** on every message (sent or received); failed msg $0.001. Total BR marketing: ~$0.0675/msg | PAYG, no subscription. Service msgs cost $0.005 Twilio only (Meta fee waived). No BRL billing (USD invoicing). No PT-BR support. BRL billing expected ~Jul 2026. ⚠️ creates NEW WABA (templates re-reviewed). Best API/DX, curl-friendly | twilio.com/en-us/whatsapp/pricing — asOf 2026-05 (HIGH) |
| **Wati (Growth)** | BSP | $59/mo USD / R$145/mo BRL (localized PT-BR pricing exists) | 7-day trial; no permanent free plan | **~+20%** over Meta base (multiple independent sources); BR marketing all-in ~$0.075/msg | Brazilian PT-BR support 24x5. Growth capped at 3 users (hard limit). Shopify add-on $4.99/mo. 15,000 marketing sends/mo included. Green Tick $50/country. No-code UI, asks to re-submit templates | wati.io/pricing — asOf 2026-05-07 (HIGH) |
| **Wati (Pro)** | BSP | $119/mo USD / R$725/mo BRL | 7-day trial | ~+20% | 24x7 PT-BR support. Additional users R$145/mo | wati.io/pricing — asOf 2026-05-07 (HIGH) |
| **Wati (Business)** | BSP | $279/mo USD / R$1,375/mo BRL | 7-day trial | ~+20% | Additional users R$275/mo | wati.io/pricing — asOf 2026-05-07 (HIGH) |
| **Gupshup (self-serve)** | BSP | **$0/mo** | No free message quota; Meta service msg = $0 Meta charge but Gupshup still bills $0.001/msg on session msgs | **+$0.001/msg** on all message types + **+6% on marketing** via Cloud API (since Jan 1, 2026; avoidable via MM Lite route); MM Lite total: +$0.001 only. BR marketing all-in (Cloud API): ~$0.080/msg; (MM Lite): ~$0.073/msg | Previously cheapest BSP — now carries a 6% marketing surcharge via standard Cloud API since Jan 2026. Use MM Lite API to avoid the surcharge. For pure marketing Cloud API sends, YCloud (0% markup) is now cheaper. Migration via embedded signup only shows WABAs not already Connected to another BSP | gupshup.ai — asOf 2026-06 (MEDIUM) |
| **WANotifier** | BSP | $69/mo (Essentials) | 7-day trial | 0% | Floor too high for testing. Migration to existing WABA supported | wanotifier.com — asOf 2026-06 (MEDIUM) |
| **360dialog (Regular)** | BSP | **€49/mo** (~$59) per number/channel | No free tier; service msgs free per Meta policy | **0% via MM API** (no BSP surcharge); **+7% via standard Cloud API** for marketing (introduced Jan 1 2026). Utility/auth: pass-through at Meta rate | Pure API-access model. No built-in inbox. Best for high-volume developers who can use MM API. No BRL billing (EUR/USD invoicing). Infra-grade, reliable, won't police use case. Volume discounts 5–25% on utility/auth at 100k+/mo | 360dialog.com/pricing — asOf 2026-06-03 (HIGH) |
| **360dialog (Premium)** | BSP | €99/mo (~$119) per number | No free tier | 0% via MM API; +7% via Cloud API for marketing | Higher throughput and support tier | 360dialog.com/pricing — asOf 2026-06-03 (HIGH) |
| **360dialog (High Throughput)** | BSP | €249/mo (~$299) per number | No free tier | 0% via MM API; +7% via Cloud API | Up to 1,000 msg/sec vs 80 msg/sec standard | 360dialog.com/pricing — asOf 2026-06-03 (HIGH) |
| **Trengo (Boost)** | Inbox tool | €299/mo (~$325) annual / €349/mo monthly | 7-day trial; no permanent free plan | **0%** — prepaid wallet debited at Meta's rate; no BSP per-msg markup | EU-based (EUR pricing). Wallet auto-tops up (up to €9,500/cycle for high volume). AI surcharge €0.25–0.30/conversation beyond free allowance. No BRL billing. Not optimized for BR-only broadcast | trengo.com/prices — asOf 2026-06 (HIGH) |
| **Interakt (Starter)** | BSP | ~$12/mo USD / ₹999/mo INR | 14-day trial; no permanent free plan | **~+25%** on marketing (confirmed for India; BR rate not published — extrapolated) | India-primary. No PT-BR support. No BRL billing. Not recommended for BR-primary operations. India pricing, monthly commitment | asOf 2026-03 (MEDIUM) |
| **SocialHub.pro (Start)** | SMB-tool (BR-local) | R$99/mo | Not confirmed | Near-zero BSP markup — platform fee is primary monetization; msgs at Meta base rate from wallet (verify — secondary, asOf 2026-05, MEDIUM) | Brazilian-founded, BRL-priced, PT-BR native. LGPD-aware. Transparent pricing. Good for BR SMB under ~50k msgs/mo | socialhub.pro — asOf 2026-05-19 (MEDIUM) |
| **Zenvia Customer Cloud (Starter)** | Brazil-local CPaaS | $0/mo base + $137 WhatsApp setup in month 1 | 100 "Interactionz" included; effectively very limited for dispatch | **~30–150%+ markup** bundled into "Interactionz" quota model; overage $0.19–$1.00 each | Brazilian-headquartered. BRL billing available. PT-BR support. Opaque Interactionz overage is a cost trap for broadcast. Not recommended for high-volume dispatch | zenvia.com — asOf 2026-04/05 (MEDIUM) |
| **Sinch Engage (Basics)** | BSP | $49/mo + $10/mo WhatsApp add-on | 14-day trial | +$0.003–$0.010/msg estimated (verify — secondary, asOf 2026-06, MEDIUM) | Strong Brazil/LATAM presence (acquired Wavy). WhatsApp requires Social Channels add-on (+$10/mo). Additional users $20/user/mo | sinch.com/engage — asOf 2026-06-03 (MEDIUM) |
| **Infobip** | Enterprise CPaaS | No list price — enterprise contracts only | 60-day trial: 100 msgs each for WA/SMS/Email/Viber + 15 voice calls | Not disclosed; estimated ~25–50% above Meta base (verify — secondary, asOf 2026-06-03, MEDIUM) | Strong Brazil enterprise presence. LGPD tooling. Annual minimum commitments. Volume discounts 20–30% at 10M+/mo | infobip.com — asOf 2026-06-03 (MEDIUM) |
| **Take Blip (blip.ai)** | Brazil-local enterprise | Not published — sales only | Free account: up to 2 agents, limited conversations (testing only) | Not disclosed; secondary: ~R$0.71 all-in vs Meta base ~R$0.31–0.35 (~100%+ markup at list — verify, LOW confidence) | Largest Brazilian WhatsApp BSP; dominant in enterprise. Deliberately opaque pricing. PT-BR support, LGPD-native. Not suitable for SMB or self-serve | blip.ai — asOf 2026-05-19 (LOW) |
| **Meta Cloud API (self-integration)** | Direct | $0 | All service msgs free; utility-in-window free; FEP 72h free | **$0 markup** — you ARE at Meta's base rate; no BSP layer | Requires full in-house WhatsApp Business API integration. WABA registration free. No inbox/CRM tooling included. BRL billing for eligible accounts from Jul 1 2026 | developers.facebook.com — asOf 2026-06-03 (HIGH) |

### Pricing Model Notes

**What you pay has three independent layers:**

1. **Meta's per-message charge** — set by Meta, same for all BSPs, destination-based (recipient country calling code, not sender). Updates quarterly. Brazil marketing ~$0.0625/msg is among the world's highest.
2. **BSP platform/subscription fee** — monthly or annual, ranges from $0 (YCloud Free, AiSensy Free, Gupshup self-serve, Twilio PAYG) to thousands for enterprise CPaaS.
3. **BSP per-message markup** — ranges from 0% (YCloud, Respond.io, Zoko Plus+, Bird, AiSensy claimed, Trengo, 360dialog via MM API) to ~25%+ (Wati ~20%, Interakt ~25%, Zenvia opaque, Take Blip ~100%+ list price).

**What's always free (Meta policy):**
- Service messages (user replies within 24h window): $0, no cap.
- Utility templates sent *within* an open 24h customer-service window: $0.
- All messages for 72h after a Click-to-WhatsApp ad or Facebook Page CTA.

**Brazil-specific:**
- BRL-native billing: Meta and most BSPs still invoice in USD as of June 2026. BRL billing from Meta is expected July 1, 2026 for eligible Solution Partners/directly-integrated clients with Brazil Sold-To in Meta Billing Hub.
- Brazilian-local BSPs (Take Blip, Zenvia, SocialHub.pro) already bill in BRL with NF-e — relevant for LGPD compliance and Brazilian accounting.
- Import taxes (ISS, IRRF, CIDE, PIS/COFINS-Importação, IOF) apply to USD remittances from Brazil; BRL-native billing eliminates this complexity.
- **Empirically confirmed in production (YCloud):** service messages = totalPrice:0; Brazil marketing draws from wallet at ~$0.05–$0.0625/msg — consistent with Meta's $0.0625 base at 0% markup.

**MM API vs Cloud API (360dialog / Gupshup):** Meta's Marketing Messages (MM) API route can eliminate BSP surcharges that apply only on the standard `/messages` Cloud API endpoint. If using 360dialog or Gupshup for high-volume Brazil marketing, prefer the MM API/MM Lite route.

**Meta per-message rate (Brazil 2026):** Marketing $0.0625/msg (per-message billing since July 2025, was per-conversation). Service (user-initiated, 24h window) free.

**Cost for low-volume test (23 + 500 msgs):**
- Direct Cloud API: $1.44 / $31.25 (zero markup, needs dev app)
- Gupshup: $1.46 / $31.75
- Twilio: $1.55 / $33.75

---

### Why BSP over Direct API

**Why BSP over Direct API:** BSP uses THEIR developer app — you never need a Meta developer account. This bypasses the SMS verification blocker that affects purchased/antidetect profiles. The Embedded Signup flow only requires Facebook login + BM admin access.

**Direct Cloud API without your own dev account (workaround):** A SECOND Facebook account (contractor/employee with working phone) registers as developer → creates a "Business" Meta App → adds it to your BM → you (BM admin) create a System User → install the app → generate token with `whatsapp_business_messaging`. The token generation itself does NOT need dev SMS verification — only the app creation does, which the second account handles. Cheapest long-term (zero markup), keeps existing WABA, full script control.

## WhatsApp Payments

### Payment Flows

WhatsApp Payments via Messages API is available in **Brazil** (Pix, Boleto, Payment Links) and **India**. Not yet globally available. Businesses receive payment confirmations via delivery reports/webhooks.
