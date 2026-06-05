---
name: whatsapp
description: WhatsApp Business Platform (Cloud API) production reference for the maccing growth stack. Covers Cloud API setup, message types, templates (creation, approval, pacing, strategy), per-message pricing, webhooks, bulk sending at scale, WhatsApp Flows, media handling, Node.js/TypeScript SDK, error codes, compliance (LGPD, opt-in/opt-out), Calling API, MM Lite, Business Management API, business profile fields, dispatch operations (chip warming, direct API setup, BSP migration, number longevity), and 2025-2026 platform changes. Use when the user asks about whatsapp, whatsapp api, cloud api, WABA, BSP, whatsapp template, whatsapp marketing, message template, WhatsApp dispatch, WhatsApp number quality, WhatsApp Brazil, WhatsApp opt-in, WhatsApp webhook, WhatsApp flows, WhatsApp pricing, or anything related to sending or receiving WhatsApp messages via the Cloud API.
---

# WhatsApp Business Platform — Production Reference (2025-2026)

> Naming: Meta's umbrella is **WhatsApp Business Platform**; the current API is the **Cloud API**. "WhatsApp Business API" is legacy phrasing (the On-Premises API sunset Oct 23, 2025). "WABA" (WhatsApp Business Account) is an account entity, **not** an API. API current version: v23.0+. All conversation-based pricing replaced by per-message pricing July 1, 2025.

> **Depends on:** the `meta` skill (BM health, verification, account quality/classifier, proxy/isolation, disposable-BM strategy, ban mechanics). ALWAYS load `meta` first. Do NOT load `meta-ads` unless doing CTWA.

> **Related:** `meta-ads` (CTWA campaign setup + CAPI attribution); `ycloud` (our BSP platform) + `ycloud-api` (YCloud v2 REST API).

---

```
MANDATORY: Read project context BEFORE any action.
ALWAYS read: .maccing/growth/README.md (if exists)
             .maccing/growth/meta/<bm>/whatsapp/<waba>/README.md (if exists)
These contain current state: BM status, pipeline day, checklist progress.
Without reading them, you WILL operate on stale data.
```

---

## 1. Platform Overview

### WhatsApp Business App vs. Cloud API

| Dimension | WhatsApp Business App | WhatsApp Cloud API |
|---|---|---|
| Target | Small business, 1-2 agents | Enterprise, automation, scale |
| Access | Free mobile app | REST API (Meta-hosted) |
| Volume | Manual, limited | Programmatic, unlimited |
| Automation | None | Full (chatbots, CRM, flows) |
| Templates | Basic | Full template library |
| Multi-agent | No | Yes (via inbox platform) |
| Analytics | None | Full metrics API |
| Cost | Free | Per-message charges apply |

**On-Premises API:** Permanently shut down October 23, 2025. Cloud API is the only path. Error code 1005 = number still on on-prem.

**Integration paths:**
1. **Direct Cloud API** — REST against Meta directly. Full control, requires engineering effort.
2. **BSP (Business Solution Provider)** — managed infrastructure with inbox, automation, analytics UI. Our BSP: YCloud (see `ycloud` skill).

---

## 2. Cloud API Setup

**Prerequisites:** Meta Developer account, verified Meta Business Manager, verified business entity, phone number not previously on any WhatsApp account.

**Step-by-step:**
1. Create Meta Business Account at `business.facebook.com`
2. Register as Meta Developer at `developers.facebook.com`
3. Create a **Business** type app → Set Up WhatsApp product
4. Add phone number → verify via SMS or voice call
5. Generate **System User permanent token** (Admin role, permissions: `whatsapp_business_messaging`, `whatsapp_business_management`, `catalog_management`) — never use the 24h temporary token in production
6. Configure HTTPS webhook endpoint → subscribe to the `messages` field
7. (Optional) Apply for OBA blue badge (WABA 30+ days old, verified, 2FA, notable coverage)

**API version:** v23.0. Base URL: `https://graph.facebook.com/v23.0/{phone_number_id}/messages`. Pin to a specific version in production.

**Webhook verification handler:**
```typescript
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});
```

---

## 13. WhatsApp Business Calling API (July 2025)

GA July 15, 2025. Voice calls directly within WhatsApp conversations.

**CSW interaction:** A user-initiated call opens and resets the 24-hour Customer Service Window, identical to an inbound message. After a call, businesses can send free-form service messages and free utility templates for 24 hours.

**Two call types:** user-initiated (inbound) and brand-initiated (outbound, to opted-in users).

**Requirements:** System User token with `whatsapp_business_messaging`, HTTPS webhook subscribed to `calls` field, WebRTC implementation (or BSP), IVR via DTMF.

**Key features:** full conversation thread visible during call, click-to-call buttons in interactive/template messages, IVR via DTMF.

---

## 14. Marketing Messages Lite API (MM Lite)

Launched April 2025. A dedicated API for marketing broadcasts using Meta's ads AI to optimize delivery timing and recipient selection.

| Aspect | MM Lite API | Cloud API |
|---|---|---|
| Purpose | Marketing broadcasts | All message types |
| AI optimization | Yes (Meta ads AI) | No |
| Delivery rate | Up to 9% higher | Standard |
| US users | Not delivered | Not delivered (since April 2025) |
| Interaction | One-way (templates only) | Two-way |

**When to use:** large marketing broadcasts → MM Lite; customer support, utility, two-way → Cloud API.

**Note for 360dialog / Gupshup users:** prefer MM API route to avoid their ~6-7% marketing surcharge that applies only on the standard Cloud API endpoint.

---

## 15. WhatsApp Business Management API

**Phone Number Management:** `GET /{WABA_ID}/phone_numbers`, add/register numbers programmatically, set display names, manage 2FA PINs.

**Template Management:**
```
POST /{WABA_ID}/message_templates  # Create
GET  /{WABA_ID}/message_templates  # List (filter: ?status=APPROVED)
POST /{TEMPLATE_ID}                # Update
DELETE /{TEMPLATE_ID}              # Delete
```

**QR Code Management:** `POST /{PHONE_NUMBER_ID}/message_qrdls` — create pre-filled chat QR codes.

**Analytics:** `GET /{WABA_ID}/analytics?start=...&end=...&granularity=DAY&metric_types=SENT,DELIVERED,READ`

---

## 16. Business Profile Fields

Fields on the per-number WhatsApp Business Profile:
- Display name (requires approval; must match external branding)
- Description (up to 256 characters)
- Category (from predefined list)
- Website URL (up to 2 URLs)
- Email address
- Address
- Profile photo (`about` tagline)

**Update profile:**
```
POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/whatsapp_business_profile
{
  "messaging_product": "whatsapp",
  "about": "Your tagline",
  "address": "123 Main St",
  "description": "Your business description",
  "email": "contact@example.com",
  "websites": ["https://example.com"],
  "vertical": "RETAIL"
}
```

> Verification, OBA requirements, display-name approval mechanics, and business profile compliance (financial niche) are in the `meta` skill.

---

## 18. 2025-2026 Key Changes Summary

| Change | Date | Impact |
|---|---|---|
| On-Premises API sunset | October 23, 2025 | All must use Cloud API |
| Per-message pricing (PMP replaces CBP) | July 1, 2025 | Each template message billed individually |
| Utility free in CSW | July 1, 2025 | Utility templates inside 24h window are free |
| Auth rates -65% to -78% (LATAM) | July 1, 2025 | Major OTP cost reduction |
| Marketing blocked to US numbers | April 1, 2025 | No marketing to US users (error 131049) |
| MM Lite API launched | April 2025 | AI-optimized marketing delivery |
| Messaging limits: portfolio-level | October 7, 2025 | All numbers in portfolio share tier |
| Tier evaluation: every 6 hours | 2025 | Faster scaling |
| WhatsApp Business Calling GA | July 15, 2025 | Voice calls in WhatsApp |
| Blue badge replaces green badge | 2024 (rolled out 2024-2025) | UI change only; existing badges converted |
| Service conversations unlimited-free | November 1, 2024 | No monthly cap; all service conversations free |
| Utility/Auth body cap: 512 chars | October 1, 2025 | Error 2388040 if exceeded at creation |
| Flagged phone-number status eliminated | October 7, 2025 | Red quality only blocks advancement, no auto-downgrade |
| Verified tier floor raised to 2,000/day | October 7, 2025 | Was 1,000 |
| HTTPS URL requirement for templates | January 1, 2026 | Shorteners rejected; must be live HTTPS |
| Brazil BRL local billing | July 1, 2026 | Eligible accounts billed in BRL |
| Meta CA cert change (mTLS) | March 31, 2026 | Update trust store: meta-outbound-api-ca-2025-12.pem |
| BSUID added to webhooks | March 31, 2026 | New `identity.user_id` field |
| BSUID may replace phone in `from` | June 2026+ | CRM must handle both identifiers |
| AI chatbot restriction | 2026 | Only task-specific AI allowed |
| Auto-categorization enforcement | April 9/16, 2025 | Meta auto-corrects category; repeat offenders lose UTILITY access 7 days |
| Carousel messages (interactive) | February 2026 | 2-10 card carousels in CSW |
| Business App + Cloud API coexistence | January 2026 | Same number, both modes |

---

## 19. Quick Reference

### Essential Endpoints

```
POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/messages        # Send message
POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/media           # Upload media
GET  https://graph.facebook.com/v23.0/{MEDIA_ID}                        # Get media URL
POST https://graph.facebook.com/v23.0/{WABA_ID}/message_templates       # Create template
GET  https://graph.facebook.com/v23.0/{WABA_ID}/message_templates       # List templates
GET  https://graph.facebook.com/v23.0/{WABA_ID}/phone_numbers           # Get phone numbers
POST https://graph.facebook.com/v23.0/{WABA_ID}/flows                   # Create flow
POST https://graph.facebook.com/v23.0/{FLOW_ID}/publish                 # Publish flow
GET  https://graph.facebook.com/v23.0/{WABA_ID}/analytics               # Analytics
```

### Required Permissions

```
whatsapp_business_messaging    # Send/receive messages
whatsapp_business_management   # Manage templates, phone numbers, settings
catalog_management             # Product catalog integration (optional)
```

### New Integration Checklist

- [ ] Meta Business account created and verified
- [ ] App created in Meta Developer dashboard
- [ ] Phone number added and verified (6-digit code)
- [ ] System User created with Admin role
- [ ] Permanent access token generated and stored securely
- [ ] Webhook endpoint deployed with HTTPS
- [ ] Webhook verification challenge handler implemented
- [ ] Webhook signature verification implemented (`x-hub-signature-256`)
- [ ] `messages` field subscribed in webhook settings
- [ ] At least one template created and approved
- [ ] Opt-in collection mechanism in place before any proactive messaging
- [ ] Env vars: `WA_PHONE_NUMBER_ID`, `WA_BUSINESS_ACCOUNT_ID`, `WA_ACCESS_TOKEN`, `APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`
- [ ] CRM stores both phone number AND BSUID fields
- [ ] Error handling with retry logic implemented
- [ ] Idempotent webhook processing with message ID deduplication

### Cost Calculation Formula

```
Monthly Cost = Σ (messages_delivered × country_rate × category_multiplier)
             - volume_discounts (utility/auth only)
             - free_CSW_utility_messages
             - free_72h_CTWA_messages

Effective Rate: Marketing >> Utility > Authentication >> Service (free)
```

---

## Routing Table

| Intent | Reference | Use for |
|---|---|---|
| Message types, payloads, interactive messages, typing indicator, read receipt | [reference/message-types.md](reference/message-types.md) | All send-message JSON shapes; text, image, video, document, audio, sticker, location, contacts, reaction, buttons, lists, flows, typing |
| Template creation, approval, pacing, limits, dispatch strategy | [reference/templates.md](reference/templates.md) | Creating templates via API, template JSON, approval process, quality states, pacing vs pausing, Template Strategy for marketing broadcasts (copy, image headers, forbidden words, opt-out) |
| Scale, throughput tiers, daily limits, quality rating, queue management | [reference/sending-and-scale.md](reference/sending-and-scale.md) | 80 MPS throughput, messaging limit tiers, quality system, bulk send queue code |
| WhatsApp Flows (native in-chat forms, appointments, surveys) | [reference/flows.md](reference/flows.md) | Flow JSON schema, API endpoints, dynamic flows backend, payment flows (Brazil/India) |
| Webhook events, payloads, signature verification, BSUID, best practices | [reference/webhooks.md](reference/webhooks.md) | Incoming message webhooks, status updates, BSUID June 2026 change, Express handler code, queue-first architecture |
| Media upload, retrieve, download, caching | [reference/media.md](reference/media.md) | Supported formats, size limits, upload/retrieve/download API, media ID reuse strategy |
| Node.js/TypeScript SDK, raw fetch, integration patterns | [reference/integration-sdk.md](reference/integration-sdk.md) | `@great-detail/whatsapp` SDK setup, webhook handler, raw fetch, order lifecycle/CTWA/CRM patterns |
| Error codes, retry logic, delivery failures, 131026/131049/132015 | [reference/error-codes.md](reference/error-codes.md) | Full error code table by category, retry strategy TypeScript snippet, real-world broadcast baselines |
| Opt-in/opt-out, LGPD (Brazil), GDPR, anti-spam, content restrictions | [reference/compliance.md](reference/compliance.md) | Consent requirements, opt-out recognition, LGPD 5-year retention, 2026 AI restriction |
| Per-message pricing, free windows (CSW/CTWA), Meta rate card, cost optimization | [reference/pricing-and-billing.md](reference/pricing-and-billing.md) | PMP rates by market, free window rules, volume tier discounts, Meta base rate card, cost calc; BSP comparison lives in `ycloud` skill |
| Chip warming, direct Cloud API setup, BSP migration, number quality/longevity, cold lists | [reference/dispatch-operations.md](reference/dispatch-operations.md) | Unofficial API chip warming ramp, direct Cloud API setup sequence, switching BSP / migrating WABA (PIN reset, device-trust gotchas), success metrics, quality recovery, cold list strategy |
| Disposable BM pipeline, proxy/isolation stack, BM sources, profile acquisition, phone number strategy, display name strategy | `meta` skill | Full disposable-BM strategy, proxy comparison table, BM setup sequence, Number Warming Protocol (official WABA), business profile compliance (financial niche), phone number acquisition |
| YCloud BSP platform (campaigns, inbox, contacts, webhooks, BSP comparison table) | `ycloud` skill | BSP platform operations, campaign management, YCloud features, BSP pricing comparison table |
| YCloud v2 REST API (send message, list messages, webhook endpoints, pagination) | `ycloud-api` skill | YCloud API reference, pagination gotchas (`page` not `offset`), HMAC signature, campaign-send lag caveat, broadcast monitoring |
