## Contents

1. [Conversions API (CAPI)](#6-conversions-api-capi)
   - [Why CAPI is Non-Negotiable in 2026](#why-capi-is-non-negotiable-in-2026)
   - [Three Implementation Methods](#three-implementation-methods)
   - [CAPI Endpoint & Required Parameters](#capi-endpoint--required-parameters)
   - [User Data Parameters (EMQ Impact)](#user-data-parameters-emq-impact)
   - [Event Match Quality (EMQ) Score](#event-match-quality-emq-score)
   - [Event Deduplication](#event-deduplication)
   - [Supported Standard Events](#supported-standard-events)
2. [Pixel & Tracking](#7-pixel--tracking)
   - [Meta Pixel Setup](#meta-pixel-setup)
   - [Aggregated Event Measurement (AEM)](#aggregated-event-measurement-aem)
   - [Domain Verification](#domain-verification)
   - [iOS 14.5+ Impact & Mitigations](#ios-145-impact--mitigations)

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
