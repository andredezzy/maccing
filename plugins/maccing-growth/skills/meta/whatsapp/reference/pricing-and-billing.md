## Contents

- [The Change (CBP → PMP, July 2025)](#the-change)
- [Message Categories & Billing](#message-categories--billing)
- [Free Messaging Windows](#free-messaging-windows)
- [Per-Message Rates (2026, USD approximate)](#per-message-rates-2026-usd-approximate)
- [Authentication-International Rates](#authentication-international-rates)
- [Volume Tier Discounts (Utility & Authentication only)](#volume-tier-discounts-utility--authentication-only)
- [Cost Optimization Strategies](#cost-optimization-strategies)
- [Meta Base Per-Message Rate Card (June 2026)](#meta-base-per-message-rate-card)
- [Pricing Model Notes](#pricing-model-notes)

> **Note:** BSP/platform comparison table rows live in the `ycloud` skill. This file covers Meta base rates, free windows, volume discounts, and cost optimization only.

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

---


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


---

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




**Why BSP over Direct API:** BSP uses THEIR developer app — you never need a Meta developer account. This bypasses the SMS verification blocker that affects purchased/antidetect profiles. The Embedded Signup flow only requires Facebook login + BM admin access.

**Direct Cloud API without your own dev account (workaround):** A SECOND Facebook account (contractor/employee with working phone) registers as developer → creates a "Business" Meta App → adds it to your BM → you (BM admin) create a System User → install the app → generate token with `whatsapp_business_messaging`. The token generation itself does NOT need dev SMS verification — only the app creation does, which the second account handles. Cheapest long-term (zero markup), keeps existing WABA, full script control.

