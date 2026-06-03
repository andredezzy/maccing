---
name: whatsapp
description: WhatsApp Business Platform (Cloud API) production reference. Covers setup, message dispatch, templates, per-message pricing, webhooks, bulk sending, Flows, BSP routing, compliance, Node.js/TypeScript SDK, error codes, and 2025-2026 platform changes. Triggers on "whatsapp", "whatsapp api", "cloud api", "WABA", "BSP", "whatsapp template", "whatsapp marketing", "message template".
---

# WhatsApp Business Platform — Production Reference (2025-2026)

> Naming: Meta's umbrella is **WhatsApp Business Platform**; the current API is the **Cloud API**. "WhatsApp Business API" is legacy phrasing (the On-Premises API sunset Oct 23, 2025). "WABA" (WhatsApp Business Account) is an account entity, **not** an API.

> Last researched: May 2026. API current version: v23.0+. All conversation-based pricing deprecated July 1, 2025.

```
MANDATORY: Read project context BEFORE any action.
ALWAYS read: .maccing/growth/README.md (if exists)
             .maccing/growth/meta/<bm>/whatsapp/<waba>/README.md (if exists)
These contain current state: BM status, pipeline day, checklist progress.
Without reading them, you WILL operate on stale data.
```

```
MANDATORY: ALWAYS load the `meta-ads` skill before ANY WhatsApp operation.
WhatsApp Cloud API runs on Meta Business Manager (BM) infrastructure.
BM health, verification, account quality, payment hygiene, and classifier
signals from meta-ads apply directly to WhatsApp messaging.
A BM ban kills BOTH your ads AND your WhatsApp number.
```

**Why this is mandatory:** WhatsApp Business Account (WABA) lives inside the BM. Same BM verification, same account quality score, same payment methods, same cascade ban mechanics. The `meta-ads` skill covers: BM defensive intelligence (classifier signals, black hat ecosystem awareness), CTWA ad attribution (`ctwa_clid`), CAPI conversion tracking (`action_source: business_messaging`), 72-hour free messaging window, remarketing via WhatsApp contacts as Custom Audiences, WhatsApp Marketing Messages placement in Ads Manager, and the full defense playbook for legitimate companies in sensitive niches.

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

### On-Premises API: Sunset (October 23, 2025)

**The On-Premises API was permanently shut down on October 23, 2025.** Cloud API is the only path for all new and existing integrations. Any code referencing on-prem endpoints must be migrated. Error code 1005 is returned when a number is still registered on on-prem.

### Cloud API Architecture

- Hosted entirely on Meta's infrastructure
- No server provisioning or dependency management required
- REST API at `https://graph.facebook.com/{version}/{phone_number_id}/messages`
- End-to-end encrypted via Signal protocol
- Industry-standard TLS for data in transit

### Integration Paths

1. **Direct Cloud API**: Build directly against Meta's REST API. Full control, requires engineering effort.
2. **Business Solution Provider (BSP)**: Managed infrastructure with inbox, automation, analytics UI. Examples: Twilio, Infobip, Wati, Gupshup, SleekFlow.

---

## 2. Cloud API Setup

### Prerequisites

- Meta Developer account at developers.facebook.com
- Meta Business Manager account at business.facebook.com
- Verified business entity
- Phone number not currently active on any WhatsApp account

### Step-by-Step Setup

#### Step 1: Create Meta Business Account
Go to `business.facebook.com`. Provide legal business name, address, phone, website, tax ID. Submit business verification documents (takes 2-10 business days).

#### Step 2: Register as Meta Developer
Visit `developers.facebook.com`, register using the same Facebook account linked to your business. Accept developer terms.

#### Step 3: Create WhatsApp Business App
1. Go to `developers.facebook.com` → My Apps → Create App
2. Choose **Business** as app type
3. Name your app, associate with verified business account
4. Click **Set Up** under the WhatsApp product card

#### Step 4: Add Phone Number
1. In the app dashboard: WhatsApp → Phone Numbers → Add Phone Number
2. Enter a display name (must match external branding)
3. Select country code and enter number
4. Choose verification method: SMS or voice call
5. Enter the 6-digit code

**Restrictions:**
- Number must not be active on any WhatsApp account (personal or business)
- If banned, must appeal first
- Supports landline, mobile, toll-free numbers

#### Step 5: Generate Access Token

**Temporary token** (testing only, 24-hour expiry):
Generated in Meta Developers panel → WhatsApp → API Setup.

**Permanent token** (production, never expires unless revoked):
1. Go to Meta Business Suite → Settings → Users → System Users
2. Create System User with Admin role
3. Assign to your WhatsApp App
4. Grant permissions: `whatsapp_business_messaging`, `whatsapp_business_management`, `catalog_management`
5. Click Generate Token — store it securely immediately

#### Step 6: Configure Webhooks
1. Create an HTTPS endpoint (must have valid SSL certificate)
2. In Meta App Dashboard: WhatsApp → Configuration → Webhook
3. Enter your callback URL and verify token
4. Meta sends a GET verification request; your server must return the `hub.challenge` value
5. Subscribe to the `messages` field

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

#### Step 7: Apply for Official Business Account (optional)
WhatsApp Manager → Account Tools → Phone Numbers → request verified badge. Requirements: WABA at least 30 days old, business verification complete, 2FA enabled, display name approved, notable media coverage. As of August 2025, badge color changed from green to blue (aligned with Facebook/Instagram).

### API Versioning

- Current version: **v23.0** (as of early 2026)
- Base URL: `https://graph.facebook.com/v23.0/{phone_number_id}/messages`
- Meta recommends always using the latest stable version
- Versions are supported for approximately 2 years
- Use `v23.0` not `v{latest}` — pin to a specific version in production

---

## 3. Message Types

### Sending Messages: Core Endpoint

```
POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/messages
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
```

All requests share this base structure:
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "15551234567",
  "type": "<message_type>",
  "<message_type>": { ... }
}
```

**Response format:**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "15551234567", "wa_id": "15551234567" }],
  "messages": [{ "id": "wamid.abc123", "message_status": "accepted" }]
}
```

`message_status` values: `accepted`, `held_for_quality_assessment`, `paused`

> The API response only confirms the message was accepted. Actual delivery is tracked via webhooks.

### Text Message

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "15551234567",
  "type": "text",
  "text": {
    "preview_url": true,
    "body": "Hello! Your order #1234 has shipped."
  }
}
```

- Max body length: 4,096 characters
- `preview_url: true` enables link preview
- Supports bold (`*text*`), italic (`_text_`), strikethrough (`~text~`), code (`` `text` ``)

### Image Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "image",
  "image": {
    "link": "https://example.com/image.jpg",
    "caption": "Optional caption text"
  }
}
```

Or using a media ID (preferred for performance):
```json
{
  "image": {
    "id": "1234567890",
    "caption": "Optional caption"
  }
}
```

### Video Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "video",
  "video": {
    "id": "MEDIA_ID",
    "caption": "Check out this product demo"
  }
}
```

### Document Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "document",
  "document": {
    "id": "MEDIA_ID",
    "filename": "invoice_2026_001.pdf",
    "caption": "Your invoice"
  }
}
```

### Audio Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "audio",
  "audio": {
    "id": "MEDIA_ID"
  }
}
```

### Sticker Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "sticker",
  "sticker": {
    "id": "MEDIA_ID"
  }
}
```

- Stickers must be WebP format, 512x512px, transparent background, max 100KB (static) or 500KB (animated)

### Location Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "location",
  "location": {
    "longitude": -122.425332,
    "latitude": 37.758056,
    "name": "Our Store - Mission District",
    "address": "123 Valencia St, San Francisco, CA"
  }
}
```

### Contacts Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "contacts",
  "contacts": [{
    "name": { "formatted_name": "John Doe", "first_name": "John", "last_name": "Doe" },
    "phones": [{ "phone": "+1 555-123-4567", "type": "WORK", "wa_id": "15551234567" }],
    "emails": [{ "email": "john@example.com", "type": "WORK" }]
  }]
}
```

### Reaction Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "reaction",
  "reaction": {
    "message_id": "wamid.originalMessageId",
    "emoji": "👍"
  }
}
```

### Interactive: Reply Buttons

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "header": {
      "type": "text",
      "text": "Order Status"
    },
    "body": {
      "text": "Your order #1234 is ready. What would you like to do?"
    },
    "footer": {
      "text": "Reply within 24 hours"
    },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "confirm_pickup", "title": "Pick Up Now" } },
        { "type": "reply", "reply": { "id": "schedule_later", "title": "Schedule Later" } },
        { "type": "reply", "reply": { "id": "cancel_order", "title": "Cancel Order" } }
      ]
    }
  }
}
```

- Max 3 buttons
- Button ID: max 256 chars; Title: max 20 chars
- Only available inside 24-hour customer service window (not a template)

### Interactive: List Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "interactive",
  "interactive": {
    "type": "list",
    "header": { "type": "text", "text": "Choose Department" },
    "body": { "text": "How can we help you today?" },
    "footer": { "text": "We reply within 2 hours" },
    "action": {
      "button": "View Options",
      "sections": [
        {
          "title": "Sales",
          "rows": [
            { "id": "new_order", "title": "Place New Order", "description": "Start a new purchase" },
            { "id": "track_order", "title": "Track Order", "description": "Check delivery status" }
          ]
        },
        {
          "title": "Support",
          "rows": [
            { "id": "technical", "title": "Technical Help", "description": "Device or app issues" },
            { "id": "billing", "title": "Billing Query", "description": "Invoice and payment" }
          ]
        }
      ]
    }
  }
}
```

- Max 10 rows total across all sections
- Row ID: max 200 chars; Title: max 24 chars; Description: max 72 chars
- Only available inside 24-hour customer service window

### Interactive: Flow Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "interactive",
  "interactive": {
    "type": "flow",
    "header": { "type": "text", "text": "Book Appointment" },
    "body": { "text": "Select a time slot that works for you" },
    "footer": { "text": "Powered by Our Booking System" },
    "action": {
      "name": "flow",
      "parameters": {
        "flow_message_version": "3",
        "flow_token": "UNIQUE_FLOW_TOKEN",
        "flow_id": "FLOW_ID",
        "flow_cta": "Open Booking",
        "flow_action": "navigate",
        "flow_action_payload": {
          "screen": "APPOINTMENT_SCREEN",
          "data": { "customer_name": "João Silva" }
        }
      }
    }
  }
}
```

### Typing Indicator

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "reaction",
  "status": "typing"
}
```

### Read Receipt

```json
{
  "messaging_product": "whatsapp",
  "status": "read",
  "message_id": "wamid.messageId"
}
```

---

## 4. Message Templates

Templates are the **only message type** that can be sent to users outside a 24-hour customer service window, or to users who haven't messaged you first. They must be pre-approved by Meta.

### Template Categories

| Category | Use Case | Cost | Notes |
|---|---|---|---|
| **Marketing** | Promotions, newsletters, offers | Charged per delivery | Highest cost; no volume discounts |
| **Utility** | Order updates, shipping, account alerts | Charged outside CSW; free inside CSW | Volume discounts apply |
| **Authentication** | OTPs, login codes, 2FA | Charged; lowest domestic rate | **Charged even inside CSW** (unlike Utility which is free inside CSW); auth-international rates apply cross-border |

> **Service messages** (non-template free-form replies within a CSW) are NOT a template category — they are any message type (text, image, interactive, etc.) sent to a user who has an open CSW. They are free since November 1, 2024 and can only be sent within an open window. Service messages do not require template approval.

**Critical:** Marketing templates to US phone numbers are **not delivered** as of April 1, 2025. Meta describes this as a **temporary pause** (not a permanent policy) — the stated intent is to assess when the US market is ready. As of mid-2026, no end date has been announced and the pause remains fully in effect. Error returned: `131049`. Do not plan on US marketing sends until Meta formally lifts it.

### Template Components

```
Header (optional): text | image | video | document
Body (required): up to 1024 chars, variables as {{1}}, {{2}}, ...
Footer (optional): static text, max 60 chars
Buttons (optional): up to 3 buttons
  - URL button: opens a link (supports dynamic URLs with variable)
  - Phone call button: dials a number
  - Quick reply button: sends a predefined text
  - Copy code button (authentication only)
  - One-tap autofill button (authentication only; **Android-only** — iOS users see a copy code button fallback automatically)
```

### Creating a Template (API)

```
POST https://graph.facebook.com/v23.0/{WABA_ID}/message_templates
```

```json
{
  "name": "order_shipped_v2",
  "language": "pt_BR",
  "category": "UTILITY",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Pedido enviado!"
    },
    {
      "type": "BODY",
      "text": "Olá {{1}}, seu pedido #{{2}} foi enviado. Previsão de entrega: {{3}}. Rastreie em: {{4}}",
      "example": {
        "body_text": [["João", "ORD-4521", "5 de maio", "https://track.example.com/abc"]]
      }
    },
    {
      "type": "FOOTER",
      "text": "Responda PARAR para cancelar notificações"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "URL",
          "text": "Rastrear pedido",
          "url": "https://track.example.com/{{1}}",
          "example": ["https://track.example.com/abc123"]
        },
        {
          "type": "QUICK_REPLY",
          "text": "Falar com suporte"
        }
      ]
    }
  ]
}
```

**Template name rules:** lowercase, numbers, underscores only. Example: `order_confirmation_v2`

### Sending a Template Message

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "order_shipped_v2",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "header",
        "parameters": [
          { "type": "text", "text": "Pedido enviado!" }
        ]
      },
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "João" },
          { "type": "text", "text": "ORD-4521" },
          { "type": "text", "text": "5 de maio" },
          { "type": "text", "text": "https://track.example.com/abc" }
        ]
      },
      {
        "type": "button",
        "sub_type": "url",
        "index": "0",
        "parameters": [
          { "type": "text", "text": "abc123" }
        ]
      }
    ]
  }
}
```

### Template with Image Header

```json
{
  "template": {
    "name": "promo_with_image",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "image",
            "image": { "link": "https://example.com/promo.jpg" }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Maria" },
          { "type": "text", "text": "30" }
        ]
      }
    ]
  }
}
```

### Template with Currency / Date-Time Parameters

```json
{
  "type": "body",
  "parameters": [
    {
      "type": "currency",
      "currency": {
        "fallback_value": "R$ 150,00",
        "code": "BRL",
        "amount_1000": 150000
      }
    },
    {
      "type": "date_time",
      "date_time": {
        "fallback_value": "5 de maio de 2026",
        "day_of_month": 5,
        "month": 5,
        "year": 2026
      }
    }
  ]
}
```

### Authentication Template

```json
{
  "name": "verification_code",
  "language": { "code": "pt_BR" },
  "components": [
    {
      "type": "body",
      "parameters": [{ "type": "text", "text": "847291" }]
    },
    {
      "type": "button",
      "sub_type": "url",
      "index": "0",
      "parameters": [{ "type": "text", "text": "847291" }]
    }
  ]
}
```

### Template Approval Process

| Stage | Detail |
|---|---|
| Submission | Via WhatsApp Manager UI or Graph API |
| Initial review | Meta automated + human review |
| Time | Typically minutes to 24 hours; complex content up to 48 hours |
| Status | `PENDING` → `APPROVED` / `REJECTED`; post-approval quality states: `ACTIVE` (High/Medium/Low quality) → `PAUSED` → `DISABLED`; after appeal: `APPEAL_REQUESTED` |
| Appeal | Edit and resubmit (up to 1×/day, 10×/month for Approved templates; rejected/paused templates have unlimited edits). Or file appeal in WhatsApp Manager → rejected template → 'Appeal'. Meta responds in 24–72h. Template name cannot be reused for 30 days after rejection if creating a new one. |
| Required before sending | Template must have `APPROVED` status |

**Common rejection reasons:**
- Misleading or deceptive content
- Requesting sensitive information (passwords, card numbers, SSN)
- Content that mimics system messages
- Excessive capitalization or vague CTAs
- Wrong category for content type (e.g., marketing content submitted as utility)
- Missing opt-out language in marketing templates
- Policy-violating products/services

**Pro tips for approval:**
- Always include examples for all variables
- Match category exactly to content purpose
- Include opt-out language for marketing (`Reply STOP to unsubscribe`)
- Use specific, clear CTAs — "Track your order" beats "Click here"
- Keep variable content clearly described in examples

### Template Limits & Quality

- Max **250** approved templates per WABA for **unverified** portfolios; max **6,000** for **verified** portfolios (where at least one phone number has an approved display name)
- Paused and rejected templates do not count toward the limit
- Templates can be paused automatically when quality drops (blocks, spam reports, low read rates)
- **Paused templates auto-resume** after a timer expires — no manual intervention needed:
  - 1st pause: 3-hour hold then auto-resumes
  - 2nd pause: 6-hour hold then auto-resumes
  - 3rd instance: template moves to `DISABLED`
- `DISABLED` templates can be **edited and resubmitted** (returns to In Review, can be restored to Active — you do NOT need to create a brand-new template)
- Template quality is evaluated on a rolling 7-day feedback window (blocks, spam reports, low read rates)
- Edit limits apply only to **Approved** templates: up to 1 edit per 24-hour window, up to 10 edits per rolling 30-day window. **Rejected and paused templates have unlimited edits.**
- After editing any Approved template (including 0-send ones), it returns to 'In Review' and **cannot be sent** until re-approved (minutes to 24h). Do not edit a template actively scheduled for an imminent broadcast.
- You can retrieve template status via: `GET /{WABA_ID}/message_templates`

### Template Pacing vs. Template Pausing

Meta uses two overlapping quality-control mechanisms:

**Template Pacing** (proactive, at campaign start):
- Applies to: newly created templates, recently unpaused templates, or templates without a High quality rating
- Messages send normally up to a threshold, then remaining messages are **held** (`held_for_quality_assessment` status) for up to 30 minutes
- If early feedback is positive → remaining messages released; if negative → remaining messages **dropped** (error 132015 in this context means dropped-by-pacing, not the same as PAUSED status)
- Portfolio-level pacing also applies to entire WABA for accounts sending <500k templates/year — can drop entire remaining batches

**Template Pausing** (reactive, accumulating quality failures):
- 1st pause: 3-hour auto-resume; 2nd pause: 6-hour auto-resume; 3rd: `DISABLED`

Key distinction: pacing drops queued messages silently within the first 30 minutes; pausing halts the template for hours/permanently based on accumulated feedback over days.

---

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
| United States | $0.025–$0.0150 | $0.004–$0.0088 | $0.004–$0.0088 |
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

## 6. Sending Messages at Scale

### Throughput Tiers

| Level | Speed | Upgrade Trigger |
|---|---|---|
| Standard | 80 messages/second (MPS) | Default for all verified numbers |
| Coexistence | 20 MPS | When number also uses WhatsApp Business App |
| High Volume | Up to 1,000 MPS | Automatic when eligible |

**Auto-upgrade to 1,000 MPS requires:**
1. Portfolio messaging tier must be Unlimited
2. Must message 100,000+ unique users in a 24-hour period
3. Quality rating must be Yellow or Green (not Red)

Upgrade is automatic (takes ~1 minute) and triggers a `THROUGHPUT_UPGRADE` webhook event. No cost for higher throughput.

### Messaging Limit Tiers (Daily Unique Users)

**Since October 7, 2025: limits apply per Business Portfolio, not per phone number.**

| Tier | Daily Unique Users | Notes |
|---|---|---|
| 0 (Unverified) | 250 | Before business verification |
| 1 | 2,000 | After business verification (raised from 1,000 on Oct 7, 2025); empirically confirmed in production on a live WABA |
| 2 | 10,000 | First scaling milestone |
| 3 | 100,000 | Established brands |
| 4 | Unlimited | Enterprise |

**Upcoming (Q1-Q2 2026 rollout, not yet universal):** Meta announced removal of the 2K and 10K intermediate tiers for verified businesses. Once fully deployed, business verification would jump a portfolio directly to 100K/day. Our own WABA (verified BM, May 2026) was at 2,000/day — treat as a pending rollout, not a completed change.

**Tier upgrade logic:**
- Meta evaluates every **6 hours** (changed from 24-48h in 2025)
- Upgrade triggered when: at least 50% of current limit used within any 7-day window AND quality rating is **Green or Yellow (not Red)**
- All phone numbers in the same Business Portfolio share **one combined limit** (draws from the same pool — one number consuming capacity reduces what others can use in that 24-hour window)
- **Portfolio risk:** quality issues (high block/report rates) on any number in the portfolio can affect the shared limit for all other numbers
- **IMPORTANT:** New numbers inherit the portfolio tier limit instantly (Oct 2025), but quality rating starts at zero. The inherited limit is the ceiling, NOT the Day-1 target — warm the number regardless.

### Quality Rating System

| Rating | Color | Impact |
|---|---|---|
| High | Green | Full scaling clearance |
| Medium | Yellow | Warning; monitor closely |
| Low | Red | Tier upgrades blocked |

Quality is computed from the last 7 days of user feedback: blocks, spam reports, opt-outs, engagement rates.

**Key change (October 2025):** Red rating no longer triggers automatic tier downgrade (unless accompanied by policy violations). It only blocks advancement. The **Flagged** phone-number status was also fully eliminated in this update — previously, a number with Red quality for 7 days entered a Flagged state that triggered tier downgrade. Under the new system there is no Flagged state: Red quality only blocks advancement and does not reduce an existing tier (absent policy violations).

**Pair Rate Limiting:** Sending too many messages to the same recipient in a short period triggers error 131056. Space out messages to individual users; WhatsApp limits how fast you can message a single number.

### Queue Management for Bulk Sends

```typescript
import PQueue from 'p-queue';

// Respect 80 MPS default throughput
const queue = new PQueue({
  concurrency: 10,
  interval: 1000,
  intervalCap: 80
});

async function sendBulkMessages(recipients: string[], template: TemplateMessage) {
  const results = await Promise.allSettled(
    recipients.map(phone =>
      queue.add(() => sendWhatsAppMessage(phone, template))
    )
  );
  return results;
}
```

### Best Practices for High-Volume Sending

1. **Warm up new numbers:** Start at 50-100 messages/day (internal/warm contacts only), increasing ~20% per day. The Dispatch Infrastructure section has the canonical detailed ramp (50→100→300→500→1,500→2,000). The 500-1,000/day starting volume is too aggressive for a brand-new number and triggers bot-detection signals. Note: inheriting the portfolio tier limit instantly (Oct 2025 change) does NOT eliminate the need to warm — quality rating is per-number and starts at zero.
2. **Test first:** Send to 50-100 internal contacts before full blast
3. **Segment by relevance:** High-relevance sends → lower block rates → quality stays green
4. **Monitor in real-time:** Watch delivery rates, read rates, and opt-out rates during sends
5. **Respect user-level caps:** Meta limits each user to an undisclosed number of marketing messages per day across all businesses (commonly estimated at ~2/day, but Meta does not publish the exact threshold — it is dynamically adjusted). If your message is blocked by this cap, you get error **131049** (not 130472). Error 130472 is a separate mechanism: recipients in Meta's experiment holdout (~1% of users per region, ongoing since 2023) who cannot receive marketing templates unless a 24h CSW is open, a marketing conversation exists, or the user came via CTWA. These are two distinct errors.
6. **Implement exponential backoff:** For 429/rate-limit errors, back off and retry

---

## 7. WhatsApp Flows

### What Are Flows

WhatsApp Flows are native, app-like interactive experiences embedded directly in a WhatsApp conversation. Users complete multi-step forms, appointments, surveys, or purchases without leaving the chat. Results: 8x+ higher conversion vs. redirecting to a website.

**Available in:** WhatsApp Manager (no-code builder) or via API (JSON definition).

**Supported components:** TextInput, TextArea, Dropdown, DatePicker, RadioButtonsGroup, CheckboxGroup, TextHeading, TextBody, Image, EmbeddedLink, Footer with action buttons.

**Limitations:** Once published, a flow cannot be edited (only deprecated and re-created). Max 50 components per screen. Only layout type is `SingleColumnLayout`.

### Flow JSON Structure

```json
{
  "version": "7.0",
  "data_api_version": "3.0",
  "routing_model": {
    "WELCOME": ["SELECT_DATE", "SKIP"],
    "SELECT_DATE": ["CONFIRM"],
    "CONFIRM": []
  },
  "screens": [
    {
      "id": "WELCOME",
      "title": "Book Appointment",
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Schedule Your Visit"
          },
          {
            "type": "TextBody",
            "text": "Choose a service and preferred date"
          },
          {
            "type": "Dropdown",
            "name": "service",
            "label": "Service Type",
            "required": true,
            "data-source": [
              { "id": "haircut", "title": "Haircut" },
              { "id": "coloring", "title": "Coloring" }
            ]
          },
          {
            "type": "DatePicker",
            "name": "appointment_date",
            "label": "Preferred Date",
            "required": true
          },
          {
            "type": "Footer",
            "label": "Continue",
            "on-click-action": {
              "name": "navigate",
              "next": { "type": "screen", "name": "CONFIRM" },
              "payload": {
                "service": "${form.service}",
                "date": "${form.appointment_date}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "CONFIRM",
      "title": "Confirmation",
      "terminal": true,
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextBody",
            "text": "Appointment booked for ${data.date}"
          },
          {
            "type": "Footer",
            "label": "Done",
            "on-click-action": { "name": "complete" }
          }
        ]
      }
    }
  ]
}
```

### Flow API Endpoints

```
POST /{WABA_ID}/flows          # Create flow
GET /{FLOW_ID}                 # Get flow details
POST /{FLOW_ID}                # Update flow JSON
POST /{FLOW_ID}/publish        # Publish draft flow
POST /{FLOW_ID}/deprecate      # Deprecate published flow
DELETE /{FLOW_ID}              # Delete draft flow only
```

**Create a Flow:**
```json
{
  "name": "Appointment Booking",
  "categories": ["APPOINTMENT_BOOKING"]
}
```

**Update Flow JSON:**
```
POST /{FLOW_ID}
{
  "flow_json": "<escaped JSON string>",
  "name": "Appointment Booking"
}
```

**Publish a Flow:**
```
POST /{FLOW_ID}/publish
```

### Dynamic Flows (Backend Integration)

Set `data_channel_uri` in the flow for real-time backend communication:
```json
{
  "data_api_version": "3.0",
  "routing_model": { ... },
  "screens": [ ... ]
}
```

Meta sends POST requests to your `data_channel_uri` when screens require data, with the payload containing the screen ID and user inputs. Your server responds with the data to populate the next screen.

### Payment Flows

WhatsApp Payments via Messages API is available in **Brazil** (Pix, Boleto, Payment Links) and **India**. Not yet globally available. Businesses receive payment confirmations via delivery reports/webhooks.

---

## 8. Webhooks & Incoming Messages

### Webhook Events

You receive two types of webhook notifications:

1. **Incoming messages:** Customer sent you a message
2. **Status updates:** Your sent message changed status (sent → delivered → read → failed)

### Incoming Text Message Payload

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15551234567",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": { "name": "João Silva" },
          "wa_id": "5511999999999"
        }],
        "messages": [{
          "id": "wamid.abc123",
          "from": "5511999999999",
          "timestamp": "1704067200",
          "type": "text",
          "text": { "body": "Where is my order?" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### Incoming Media Message Payload

```json
{
  "messages": [{
    "id": "wamid.xyz789",
    "from": "5511999999999",
    "type": "image",
    "image": {
      "id": "MEDIA_ID_123456",
      "mime_type": "image/jpeg",
      "sha256": "HASH_VALUE",
      "caption": "Here is the receipt"
    }
  }]
}
```

> Media payloads contain only a `media_id`, not the actual file. You must call the media API to get the download URL, which expires in ~5 minutes.

### Interactive Button Reply Payload

```json
{
  "messages": [{
    "type": "interactive",
    "interactive": {
      "type": "button_reply",
      "button_reply": {
        "id": "confirm_pickup",
        "title": "Pick Up Now"
      }
    }
  }]
}
```

### Interactive List Reply Payload

```json
{
  "messages": [{
    "type": "interactive",
    "interactive": {
      "type": "list_reply",
      "list_reply": {
        "id": "track_order",
        "title": "Track Order",
        "description": "Check delivery status"
      }
    }
  }]
}
```

### Status Update Payload

```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "statuses": [{
          "id": "wamid.abc123",
          "status": "delivered",
          "timestamp": "1704067300",
          "recipient_id": "5511999999999",
          "conversation": {
            "id": "CONVERSATION_ID",
            "origin": { "type": "utility" }
          },
          "pricing": {
            "billable": true,
            "pricing_model": "PMP",
            "category": "utility"
          }
        }]
      }
    }]
  }]
}
```

Status progression: `sent` → `delivered` → `read` (or `failed`)

### BSUID: Critical Change (June 2026)

Starting June 2026, the `from` field in webhooks may contain a **Business-Scoped User ID (BSUID)** instead of a phone number when users have opted into usernames. BSUID format: `CC.alphanumeric` (e.g., `BR.1A2B3C4D5E6F7G8H9I0J`).

**Action required:** Store both phone number AND BSUID in your CRM. Update all webhook handlers to accept both formats in the `from`/`wa_id` fields.

As of March 31, 2026, a new `identity.user_id` field is included in all message webhooks — this is the BSUID.

### Signature Verification (Node.js)

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  rawBody: string,
  signature: string | undefined,
  appSecret: string
): boolean {
  if (!signature) return false;

  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
  } catch {
    return false;
  }
}

// Usage in Express (MUST use raw body — before json() middleware):
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-hub-signature-256'] as string;
  const rawBody = req.body.toString();

  if (!verifyWebhookSignature(rawBody, sig, process.env.APP_SECRET!)) {
    return res.sendStatus(401);
  }

  // Return 200 IMMEDIATELY, process async
  res.status(200).send('OK');

  const payload = JSON.parse(rawBody);
  processWebhookAsync(payload).catch(console.error);
});
```

**Critical March 2026 change:** Meta switched the Certificate Authority for mTLS webhooks on March 31, 2026. Update your trust store with `meta-outbound-api-ca-2025-12.pem` to maintain delivery.

### Webhook Production Best Practices

1. **Return HTTP 200 immediately** — process async. Meta's timeout is 5-10 seconds; slow responses cause retries and duplicate events.
2. **Idempotency is mandatory** — Meta delivers at-least-once. Store processed message IDs with 24h TTL and deduplicate.
3. **Queue-first architecture:** `receive webhook → enqueue → 200 OK → process from queue`
4. **Iterate all arrays** — `entry`, `changes`, `messages`, `statuses` are all arrays; never assume single elements.
5. **Meta retries** for up to 7 days with exponential backoff. A 30-minute outage will deliver all missed webhooks when you come back.
6. **Download media quickly** — media download URLs expire in approximately 5 minutes.
7. **Never use `JSON.parse(req.body)`** for signature verification — use raw buffer before parsing.

```typescript
// Queue-first architecture (BullMQ example)
import { Queue } from 'bullmq';

const whatsappQueue = new Queue('whatsapp-webhooks');

app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  if (!verifyWebhookSignature(req.body.toString(), req.headers['x-hub-signature-256'] as string, process.env.APP_SECRET!)) {
    return res.sendStatus(401);
  }

  await whatsappQueue.add('process', JSON.parse(req.body.toString()), {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  });

  res.status(200).send('OK');
});
```

---

## 9. Media Handling

### Supported Formats & Limits

| Type | Formats | Max Size | Notes |
|---|---|---|---|
| Image | JPEG, PNG | 5 MB | WebP only for stickers |
| Video | MP4, 3GP | 16 MB | H.264 video + AAC audio required |
| Audio | AAC, MP4, MPEG, AMR, OGG | 16 MB | OGG with OPUS codec |
| Document | PDF, DOC(X), XLS(X), PPT(X), TXT | 100 MB | |
| Sticker | WebP | 100 KB (static), 500 KB (animated) | 512x512px, transparent bg |

Upload limit to media API: **64 MB** (but post-processing enforces type-specific limits above).

### Upload Media

```
POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/media
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: multipart/form-data
```

```bash
curl -X POST "https://graph.facebook.com/v23.0/PHONE_NUMBER_ID/media" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -F "file=@./image.jpg;type=image/jpeg" \
  -F "type=image/jpeg" \
  -F "messaging_product=whatsapp"
```

Response:
```json
{ "id": "1234567890123456" }
```

**TypeScript upload example:**
```typescript
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';

async function uploadMedia(filePath: string, mimeType: string, phoneNumberId: string): Promise<string> {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), { contentType: mimeType });
  form.append('type', mimeType);
  form.append('messaging_product', 'whatsapp');

  const response = await axios.post(
    `https://graph.facebook.com/v23.0/${phoneNumberId}/media`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`
      }
    }
  );

  return response.data.id;
}
```

### Retrieve Media URL

```
GET https://graph.facebook.com/v23.0/{MEDIA_ID}
Authorization: Bearer {ACCESS_TOKEN}
```

Response:
```json
{
  "url": "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=...",
  "mime_type": "image/jpeg",
  "sha256": "hash",
  "file_size": 102400,
  "id": "MEDIA_ID",
  "messaging_product": "whatsapp"
}
```

The URL returned expires quickly (~5 minutes). Download immediately.

### Download Media

```bash
curl -OJ \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=..."
```

### Media Caching

- Uploaded media IDs persist for **30 days** on Meta's servers
- **Best practice:** Use media IDs (upload once, reuse) rather than URLs for frequently sent assets (logos, product images, standard docs)
- When sending the same media to thousands of users, upload once and store the ID

---

## 10. Node.js / TypeScript Integration

### Recommended Library: @great-detail/whatsapp

The official Meta Node.js SDK (`WhatsApp/WhatsApp-Nodejs-SDK`) was **archived in June 2023**. Use the active community fork instead:

```bash
npm install @great-detail/whatsapp
# or
bun add @great-detail/whatsapp
```

Compatible with Node.js v22+, Deno v2.4+, Bun v1.2+. Built for Cloud API v23.

### Basic Setup

```typescript
import Client from '@great-detail/whatsapp';

const sdk = new Client({
  request: {
    headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}` }
  }
});
```

### Send Text Message

```typescript
const message = await sdk.message.createMessage({
  phoneNumberID: process.env.WA_PHONE_NUMBER_ID!,
  to: '5511999999999',
  type: 'text',
  text: { body: 'Hello from TypeScript!' }
});

console.log('Message ID:', message.messages[0].id);
```

### Send Template Message

```typescript
const message = await sdk.message.createMessage({
  phoneNumberID: process.env.WA_PHONE_NUMBER_ID!,
  to: '5511999999999',
  type: 'template',
  template: {
    name: 'order_shipped_v2',
    language: { code: 'pt_BR' },
    components: [{
      type: 'body',
      parameters: [
        { type: 'text', text: 'João' },
        { type: 'text', text: 'ORD-4521' },
        { type: 'text', text: '5 de maio' },
        { type: 'text', text: 'https://track.example.com/abc' }
      ]
    }]
  }
});
```

### Upload and Send Media

```typescript
import fs from 'fs';

// Upload
const fileBuffer = fs.readFileSync('./invoice.pdf');
const upload = await sdk.media.upload({
  phoneNumberID: process.env.WA_PHONE_NUMBER_ID!,
  mimeType: 'application/pdf',
  file: fileBuffer
});

// Send using media ID
await sdk.message.createMessage({
  phoneNumberID: process.env.WA_PHONE_NUMBER_ID!,
  to: '5511999999999',
  type: 'document',
  document: {
    id: upload.id,
    filename: 'invoice.pdf',
    caption: 'Your invoice is attached'
  }
});
```

### Webhook Handler (Express)

```typescript
import express from 'express';
import Client from '@great-detail/whatsapp';

const app = express();
const sdk = new Client({
  request: { headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}` } }
});

// Webhook verification
app.get('/webhook', (req, res) => {
  const reg = sdk.webhook.register({
    method: req.method,
    query: req.query as Record<string, string>,
    body: req.body,
    headers: req.headers as Record<string, string>
  });

  if (reg.verifyToken !== process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.end(reg.reject());
  }
  return res.end(reg.accept());
});

// Webhook event handling
app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const event = sdk.webhook.eventNotification({
    method: req.method,
    query: req.query as Record<string, string>,
    body: req.body.toString(),
    headers: req.headers as Record<string, string>
  });

  event.verifySignature(process.env.APP_SECRET!);

  // Return 200 immediately
  res.end(event.accept());

  // Process async
  processEvent(event).catch(console.error);
});

async function processEvent(event: unknown) {
  // Handle incoming messages, status updates, etc.
}
```

### Raw axios/fetch approach (no SDK)

```typescript
const BASE_URL = `https://graph.facebook.com/v23.0/${process.env.WA_PHONE_NUMBER_ID}`;

async function sendMessage(payload: object): Promise<{ id: string }> {
  const response = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new WhatsAppError(error.error.code, error.error.message);
  }

  const data = await response.json();
  return data.messages[0];
}
```

### Environment Variables

```bash
WA_PHONE_NUMBER_ID=          # Phone number ID (not the phone number itself)
WA_BUSINESS_ACCOUNT_ID=      # WhatsApp Business Account ID
WA_ACCESS_TOKEN=             # System user permanent token
APP_SECRET=                  # App secret for webhook signature verification
WEBHOOK_VERIFY_TOKEN=        # Your custom token for webhook verification
```

---

## 11. Error Codes Reference

### Authentication Errors

| Code | Meaning | Fix |
|---|---|---|
| 0 | Auth exception | Generate new access token |
| 3 | API method / capability | Verify permissions |
| 10 | Permission denied | Check token permissions; re-add phone to allowlist |
| 190 | Access token expired | Generate new system user token |

### Rate Limiting Errors

| Code | Meaning | Fix |
|---|---|---|
| 4 | Too many calls (200/hr default) | Throttle requests |
| 130429 | Throughput limit hit (80 MPS) | Reduce sending speed |
| 131048 | Spam rate limit | Improve content quality |
| 131056 | Pair rate limit (too many to same recipient) | Space out messages to one recipient |
| 133016 | Register/deregister rate limit (10 per 72h) | Wait 72 hours |

### Message Delivery Errors

| Code | Meaning | Fix |
|---|---|---|
| 131021 | Recipient cannot be sender | Use separate test number |
| 131026 | Message undeliverable | **4 possible causes (Meta does not identify which):** (1) Number not registered on WhatsApp; (2) Recipient has not accepted the latest WhatsApp ToS/Privacy Policy; (3) Recipient is using an outdated WhatsApp client; (4) Sending an authentication template to a +91 India number (not supported). Remove from list; do not retry. |
| 131047 | 24-hour window expired | Use approved template instead |
| 131049 | Per-user marketing frequency cap (also: US number marketing block since April 2025) | Recipient has hit Meta's per-user daily marketing cap across all businesses. Do NOT retry immediately — wait at least 24h. **Also** returned for ALL marketing template sends to US (+1) numbers since April 1, 2025 (permanent pause, still in effect mid-2026). Switch to utility template (exempt from cap) or wait 24h and retry. |
| 131051 | Unsupported message type | Check API docs for supported types |
| 131052 | Media download error | Verify media URL/ID accessibility |
| 131053 | Media upload error | Check format, size, configuration |
| 130472 | Experiment holdout (~1% of users per region, since June 2023) | Marketing template blocked for experiment participants. Not billed. Do not retry directly. Exceptions where delivery IS allowed even for experiment participants: (1) user messaged your business in last 24h (CSW open), (2) active marketing conversation ongoing, (3) user arrived via CTWA/free-entry-point ad. Affects marketing templates only. |

### Template Errors

| Code | Meaning | Fix |
|---|---|---|
| 132000 | Parameter count mismatch | Verify param count matches template |
| 132001 | Template not found | Check name, language, approval status |
| 132005 | Hydrated text too long | Shorten variables |
| 132007 | Policy violation | Review and revise template content |
| 132012 | Parameter format mismatch | Verify format matches template specs |
| 132015 | Template paused (low quality) | Auto-resumes after 3h (1st pause) or 6h (2nd pause). Stop active campaigns immediately. After auto-resume, evaluate content/targeting. A 3rd trigger moves template to DISABLED (132016). Can also appear when portfolio pacing drops remaining messages mid-campaign. |
| 132016 | Template disabled (repeated low quality) | Edit template content and resubmit for review (status returns to In Review; if approved, restored to Active). Creating a new template is an option but not required. |

### Flow Errors

| Code | Meaning | Fix |
|---|---|---|
| 132068 | Flow blocked | Fix missing inputs or logic errors |
| 132069 | Flow throttled (10 msg/hr) | Improve endpoint health and nav metrics |

### Account Errors

| Code | Meaning | Fix |
|---|---|---|
| 368 | WABA policy violation (account restricted/disabled) | The WhatsApp Business Account has been restricted or disabled for violating Messaging, Commerce, or ToS policy. Can be temporary (1-30 days) or indefinite. Not retryable. Appeal via Business Support Home → select violation → Request Review. Common causes: spam reports, restricted content, excessive blocks. Distinct from 131031 (number-level lock). |
| 131031 | Account locked | Two distinct causes: (1) Policy violation — WABA restricted/disabled. Appeal via Business Support Home. (2) 2FA PIN mismatch — Meta cannot verify the two-step PIN in the request. Fix: disable 2FA on the number, re-register, re-enable 2FA. Check the WhatsApp Manager healthcheck for diagnostic detail. |
| 131042 | Business eligibility / payment issue | One of: (1) payment account not linked to WABA; (2) credit limit exceeded; (3) credit line inactive; (4) WABA suspended/deleted; (5) timezone/currency settings missing or wrong; (6) pending MessagingFor request. Fix: check each condition in WhatsApp Manager billing settings. |
| 130497 | Business account restricted from messaging users in this country | Two causes: (1) Cross-border restriction — your WABA number's registered country does not match the recipient's country. May be fixed by completing the messaging tier scaling path (up to 30 days). **IMPORTANT: Brazil (+55) and Indonesia (+62) appear permanently restricted for foreign-number senders since September 2025** — use a locally-registered number instead; (2) Restricted content — sending prohibited goods/services to a country where they're not allowed. Fix: use a locally-registered number for the target market, or review the WhatsApp Commerce Policy. |
| 133005 | 2FA PIN mismatch | Verify PIN; reset via WhatsApp Manager |
| 133010 | Phone not registered | Complete registration |
| 1005 | Number on deprecated on-premises API | Migrate to Cloud API (on-prem API shut down October 23, 2025) |
| 131000 | Unknown error (something went wrong) | Transient server-side error. Retryable — implement exponential backoff. If persists >5 minutes, check Meta status page. |
| 131005 | Permission denied | Token missing required permission (`whatsapp_business_messaging` or `whatsapp_business_management`). Re-generate token with correct permissions. |
| 131008 | Required parameter missing | API request is missing a required field. Fix the request payload. Not retryable. |
| 131009 | Invalid parameter value | A parameter value does not meet requirements. Fix the request payload. Not retryable. |
| 131016 | Service temporarily unavailable | Transient. Retryable with exponential backoff. Check Meta status page if persistent. |

### Delivery / Send Errors (common in broadcasts)

| Code | Meaning | Interpretation / Fix |
|---|---|---|
| 131026 | Message undeliverable | Recipient can't receive: number not on WhatsApp, hasn't accepted WhatsApp ToS, or invalid. LIST-QUALITY signal — a BSP upload marking a row "valid" checks FORMAT only, NOT WhatsApp-registration. Remove these numbers; do not retry. |
| 131049 | "Not delivered to maintain healthy ecosystem engagement" | Meta's marketing-message throttle / per-user frequency cap. Common on NEW numbers (low trust) and recipients with marketing fatigue. NOT a block/report and NOT a hard penalty — it eases as the number's quality/engagement builds. Mitigate with high engagement (warm contacts) + slow ramp, not by resending. |

**Real-world broadcast baselines** (illustrative, directional):
- An AGED / demo list: a large share fails with 131026 plus some 131049 throttle, so delivery lands well below a fresh list.
- A FRESH list of recent signups: the 131026 failures essentially vanish and delivery jumps well above the aged list.
- **LESSON — list FRESHNESS dominates deliverability:** recently-registered leads (fresh, active numbers) deliver far better than an aged/demo list (the 131026 "not on WhatsApp" failures vanish). And the 131049 throttle eases as the number earns trust (Green). A renewable stream of recent signups is the best warming/nurture pool when you lack internal seeds — and the prospecting "welcome" template fits them (vs established customers, where it mismatches + risks alarming your best relationships).
- **Opt-out via the Quick-Reply button is HEALTHY and DISTINCT from blocks/reports.** A "Parar mensagens" / "Stop" button diverts annoyed recipients into a clean unsubscribe (auto-removed, compliant) instead of a block/report. So a 10-12% button-opt-out is NOT the same as the block-rate thresholds (<0.5% healthy / >2% red), which track blocks+reports and drive quality. Always include an opt-out Quick Reply — it protects the number. Watch button-opt-out as a soft audience-fit signal (climbing → message/audience mismatch), but it doesn't tank quality the way blocks do.
- Inbound replies open a 24h free-form session window = the best warm conversion path. URL-CTA button clicks are NOT reliably reported by BSP analytics — measure conversion at the destination (e.g. WhatsApp group member count), not the BSP click metric.

### Retry Strategy

```typescript
async function sendWithRetry(
  payload: object,
  maxAttempts = 3
): Promise<{ id: string }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await sendMessage(payload);
    } catch (error) {
      if (error instanceof WhatsAppError) {
        // Non-retryable errors
        const nonRetryable = [131021, 131026, 130472, 130497, 132001, 132007, 132016, 133010, 368, 131031];
        // Delayed retryable (after 24h+): [131049]
        // Transient retryable (immediate backoff): [131000, 131016, 2]
        if (nonRetryable.includes(error.code)) {
          throw error;
        }

        // Rate limit: exponential backoff
        if ([4, 130429, 131048, 131056].includes(error.code)) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw new Error('Max retry attempts reached');
}
```

---

## 12. Compliance & Policies

### Opt-In Requirements

**Mandatory:** Businesses must obtain explicit WhatsApp opt-in before sending any proactive messages.

**Valid opt-in sources:**
- Checkout page checkbox (unchecked by default; must be explicitly checked)
- Account signup form
- Click-to-WhatsApp (CTWA) ads — sending the first message counts as opt-in
- QR codes on packaging, in-store, website
- Event registration forms
- Post-purchase confirmation page
- Website chat widget

**Opt-in language must include:**
- Your business name
- Explicit statement they are opting in to receive WhatsApp messages
- Message frequency (if known)

**Invalid:** Pre-ticked checkboxes, prior SMS consent, implied consent.

### Recording Opt-Ins

Store for each contact:
- Timestamp of opt-in
- Source/channel
- Exact consent language shown
- IP address or session ID
- Category of messages consented to

**Retention under LGPD (Brazil):** Retain consent records (timestamp, source, exact consent language, IP) for a minimum of **5 years** after consent revocation. Retain opt-out records for a minimum of 5 years. ANPD active enforcement since 2025 — audits request these records as evidence of compliance.

**Brazil LGPD channel separation:** Email/SMS consent does **not** cover WhatsApp. ANPD guidance requires separate, explicit WhatsApp-specific consent naming the channel, the business, and message type. Re-obtaining consent from email-only lists before WhatsApp outreach is mandatory for LGPD compliance.

### Opt-Out Handling

Recognize and honor: STOP, UNSUBSCRIBE, CANCEL, OPT OUT, NO, PARAR, SAIR.

**Required actions upon opt-out:**
1. Immediately confirm opt-out via final message
2. Stop all promotional sends **immediately** (maximum 24 hours). Brazil's ANPD LGPD guidance treats processing over 48 hours as a fine-eligible violation — immediate processing avoids any exposure.
3. Record timestamp and source of opt-out
4. Add to suppression list
5. Honor for minimum 2 years. Note: WhatsApp policy sets no specific floor — this timeframe is derived from LGPD best-practice guidance for Brazil (maintain opt-out records for at least 2 years after last interaction; consent records for 5 years after revocation, to demonstrate compliance in an ANPD audit).

**Platform-level opt-out (2025-2026):** WhatsApp exposes an 'Offers and Announcements' toggle on business profiles. Users can disable marketing messages without sending a keyword. Subscribe to the `MARKETING_SUBSCRIPTION_UPDATE` webhook event to receive these opt-out signals and suppress affected contacts immediately.

### Anti-Spam Policies

- Meta limits marketing templates per user at an undisclosed daily threshold (commonly estimated at ~2/day across all businesses, but Meta does not publish the exact number and adjusts it dynamically). Error code when exceeded: **131049**. The cap is per-recipient, not per-sender — a recipient receiving 2 marketing messages from other businesses will block your message too, even if your number is warm and high-quality.
- Do not send the same message repeatedly to the same user
- Messages must match the category they're submitted under
- Do not confuse, deceive, mislead, or surprise users

**Account protection:**
- Monitor spam report rate: >2% triggers quality degradation
- Monitor block rate: sudden spikes trigger manual review
- Maintain a deliverability ratio above 90%

### GDPR & Regional Compliance

| Region | Key Requirement |
|---|---|
| EU/EEA | Data Processing Agreement (DPA) with BSP; EU data residency option; explicit GDPR consent |
| Germany | BSP must have EU data residency and DPA |
| India | Comply with DPDPA (Digital Personal Data Protection Act) |
| Brazil | LGPD compliance; explicit consent required per ANPD guidance (active enforcement since 2025). Key obligations: (a) WhatsApp consent must be obtained **separately** from email/SMS — different channels require separate consents; (b) Consent records must be retained for **5 years** after revocation; (c) Marketing messages require explicit consent — transactional messages may use contract-execution basis; (d) Opt-out must be processed within 48 hours (ANPD interpretation); (e) Fines up to 2% of Brazil annual revenue, capped at R$50 million per infraction, now actively enforced. |
| US | TCPA consent separate from WhatsApp opt-in; marketing templates blocked to US numbers since April 2025 |

**2026 AI restriction:** General-purpose AI chatbots are prohibited on WhatsApp. Only task-oriented automation with predictable, business-specific outcomes is allowed (support, booking, order processing).

### Content Restrictions

- No full payment card numbers in messages
- No government ID numbers in messages
- No passwords or security credentials
- No prohibited products (varies by country — check Meta's Prohibited Content policy)
- No misleading business identity

---

## 13. WhatsApp Business Calling API (July 2025)

### Overview

Voice calls directly within WhatsApp conversations. GA on July 15, 2025.

**CSW interaction:** A user-initiated call (via the Calling API) opens and resets the 24-hour Customer Service Window, identical to an inbound message. After a call, businesses can send free-form service messages and free utility templates for 24 hours.

**Two call types:**
- **User-initiated (inbound):** User taps call button in chat
- **Brand-initiated (outbound):** Business calls opted-in user

### Implementation Requirements

1. System User token with `whatsapp_business_messaging` permission
2. HTTPS webhook endpoint subscribed to the `calls` field
3. WebRTC implementation (or BSP that handles it)
4. IVR integration via DTMF support

### Key Features

- Full conversation thread visible during voice call (context intact)
- Call recording (via BSPs like Infobip, not in native API)
- IVR support via DTMF (interactive menus during call)
- Click-to-call buttons in interactive and template messages
- Businesses can disable/enable call icon to control volume

### Results

Early adopters: conversion rate from 2% to 45% when adding calling to the conversation flow.

---

## 14. Marketing Messages Lite API (MM Lite)

### What It Is

Launched April 2025. A dedicated API for marketing broadcasts that uses Meta's ads AI to optimize delivery timing and recipient selection. Not a replacement for Cloud API — they run in parallel.

### Key Differences from Cloud API

| Aspect | MM Lite API | Cloud API |
|---|---|---|
| Purpose | Marketing broadcasts | All message types |
| AI optimization | Yes (Meta ads AI) | No |
| Delivery rate | Up to 9% higher | Standard |
| US users | Not delivered | Not delivered (since April 2025) |
| Interaction | One-way (templates only) | Two-way |
| Integration | Meta Ads Manager | Standard REST API |

### Performance

- Up to 30% higher delivery rates in high-volume campaigns
- Up to 9% higher delivery rates in India specifically
- AI selects which users receive messages based on engagement probability
- Bypasses user-level marketing message caps for qualifying traffic

### When to Use MM Lite vs. Cloud API

| Scenario | Use |
|---|---|
| Marketing broadcast to large list | MM Lite API |
| Customer support / service replies | Cloud API |
| Utility messages (order updates) | Cloud API |
| Two-way conversation / chatbot | Cloud API |
| High-volume promotional campaigns | MM Lite API |

---

## 15. WhatsApp Business Management API

### Key Capabilities

**Phone Number Management:**
- List numbers: `GET /{WABA_ID}/phone_numbers`
- Add/register numbers programmatically
- Set display names
- Manage 2FA PINs

**Template Management:**
- Create: `POST /{WABA_ID}/message_templates`
- List: `GET /{WABA_ID}/message_templates`
- Update: `POST /{TEMPLATE_ID}`
- Delete: `DELETE /{TEMPLATE_ID}`
- Get status: filter by `status=APPROVED` or `status=PENDING`

**QR Code Management:**
- Create QR codes: `POST /{PHONE_NUMBER_ID}/message_qrdls`
- QR codes open a pre-filled WhatsApp chat

**Analytics:**
- Message analytics: `GET /{WABA_ID}/analytics`
- Template analytics (sent, delivered, read, button clicks)
- Granular pricing breakdowns per delivered message

**Analytics query example:**
```
GET /{WABA_ID}/analytics?start=1704067200&end=1706745600&granularity=DAY&metric_types=SENT,DELIVERED,READ
```

---

## 16. Business Profile & Verification

### Business Profile Fields

- Display name (must match external branding; requires approval)
- Description (up to 256 characters)
- Category (from predefined list)
- Website URL (up to 2 URLs)
- Email address
- Address
- Profile photo

**Update profile:**
```
POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/whatsapp_business_profile
{
  "messaging_product": "whatsapp",
  "about": "Your tagline here",
  "address": "123 Main St",
  "description": "Your business description",
  "email": "contact@example.com",
  "websites": ["https://example.com"],
  "vertical": "RETAIL"
}
```

### Business Verification

Required for: messaging tier upgrades beyond 250 messages/day, Official Business Account application, paid Meta ad integrations.

Documents accepted: Tax ID/business registration, incorporation documents, utility bill showing business name and address.

Timeline: 2-10 business days.

### Official Business Account (Blue Badge)

- WABA must be at least 30 days old
- Business verification complete
- 2FA enabled on WABA phone number
- Display name approved and matching external branding
- Business must be "notable" — significant organic media coverage (not paid PR)
- Submit up to 5 supporting links from reputable sources
- Application via BSP only (not self-service)
- Rejection: must wait 30 days before reapplying
- **Note:** As of mid-2024 (announced at Meta Conversations Conference, June 2024; rolled out through 2024-2025), the OBA badge is blue (not green), aligning with Facebook and Instagram verification symbols. Existing green badges converted automatically.

---

## 17. Integration Patterns

### E-Commerce: Order Lifecycle

```
Order Placed
  → [Utility Template] Order confirmation with order number
  → [Utility Template] Shipping notification with tracking link
  → [Utility Template] Delivery confirmation
  → [Service] Handle any customer replies (free in CSW)
  → [Marketing Template] Post-delivery review request (after 3 days)
```

### Lead Nurturing via CTWA

```
User clicks CTWA ad
  → 72-hour free window opens
  → [Marketing Template] Welcome + catalog link
  → [Interactive Buttons] Quick responses (pricing, demo, help)
  → [Flow] Qualification form
  → Human handoff or automated follow-up
```

### Customer Support

```
User sends message
  → 24-hour CSW opens (free window)
  → Bot handles FAQ, order lookup, returns
  → [Interactive Lists] Department routing
  → Human agent for complex issues
  → [Utility Template] Follow-up summary (if within CSW, free)
```

### CRM Integration Pattern

```typescript
// On incoming message webhook
async function handleIncomingMessage(message: WaMessage) {
  // Upsert contact in CRM
  await crm.upsertContact({
    phone: message.from,
    bsuid: message.identity?.user_id, // Store BSUID alongside phone
    name: message.contacts?.[0]?.profile?.name
  });

  // Record interaction
  await crm.addInteraction({
    contactPhone: message.from,
    channel: 'whatsapp',
    direction: 'inbound',
    content: message.text?.body,
    timestamp: new Date(parseInt(message.timestamp) * 1000)
  });

  // Trigger automation
  await automationEngine.trigger('whatsapp_message_received', {
    contact: message.from,
    message: message
  });
}
```

---

## 18. 2025-2026 Key Changes Summary

| Change | Date | Impact |
|---|---|---|
| On-Premises API sunset | October 23, 2025 | All must use Cloud API |
| Per-message pricing (PMP replaces CBP) | July 1, 2025 | Each template message billed individually |
| Utility free in CSW | July 1, 2025 | Utility templates inside 24h window are free |
| Auth rates -65% to -78% (LATAM) | July 1, 2025 | Major OTP cost reduction |
| Marketing blocked to US numbers | April 1, 2025 | No marketing to US users |
| MM Lite API launched | April 2025 | AI-optimized marketing delivery |
| Messaging limits: portfolio-level | October 7, 2025 | All numbers in portfolio share tier |
| Tier evaluation: every 6 hours | 2025 | Faster scaling |
| WhatsApp Business Calling GA | July 15, 2025 | Voice calls in WhatsApp |
| Blue badge replaces green badge | 2024 (announced June 2024, rolled out 2024-2025) | UI change only; existing green badges converted automatically |
| Service conversations unlimited-free | November 1, 2024 | Previous 1,000/month free cap removed; all service conversations now free with no limit |
| Utility/Auth body cap: 512 chars | October 1, 2025 | Utility and Authentication templates capped at 512 chars; error 2388040 at creation if exceeded |
| Flagged phone-number status eliminated | October 7, 2025 | Red quality no longer triggers Flagged state or auto-downgrade; only blocks advancement |
| Verified tier floor raised to 2,000/day | October 7, 2025 | Portfolio-level limit change; verified businesses now start at 2,000/day (was 1,000) |
| HTTPS URL requirement for templates | January 1, 2026 | All templates with URLs must use valid verifiable HTTPS URLs; shorteners rejected |
| Brazil BRL local billing | July 1, 2026 | Eligible Solution Partners and directly-integrated clients with Brazil Sold-To in Billing Hub can create new WABAs billed in BRL |
| Meta CA cert change (mTLS) | March 31, 2026 | Update trust store |
| BSUID added to webhooks | March 31, 2026 | New `identity.user_id` field |
| BSUID may replace phone in `from` | June 2026+ | CRM must handle both identifiers |
| AI chatbot restriction | 2026 | Only task-specific AI allowed |
| WhatsApp Flows v7.0 | 2025-2026 | Enhanced components |
| Auto-categorization enforcement | April 9, 2025 | Meta auto-corrects category at submission (UTILITY submitted as MARKETING → approved as MARKETING, 60-day appeal window). Abuse enforcement added April 16, 2025: repeat offenders lose UTILITY access for 7 days without advance notice. |
| Carousel messages (interactive) | February 2026 | 2-10 card carousels in CSW. Free-form carousels are CSW-only; use carousel template for outbound. |
| Business App + Cloud API coexistence | January 2026 | Same number, both modes |

---

## 19. Quick Reference

### Essential Endpoints

```
# Send message
POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/messages

# Upload media
POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/media

# Get media URL
GET https://graph.facebook.com/v23.0/{MEDIA_ID}

# Create template
POST https://graph.facebook.com/v23.0/{WABA_ID}/message_templates

# List templates
GET https://graph.facebook.com/v23.0/{WABA_ID}/message_templates

# Get phone numbers
GET https://graph.facebook.com/v23.0/{WABA_ID}/phone_numbers

# Create flow
POST https://graph.facebook.com/v23.0/{WABA_ID}/flows

# Publish flow
POST https://graph.facebook.com/v23.0/{FLOW_ID}/publish

# Analytics
GET https://graph.facebook.com/v23.0/{WABA_ID}/analytics
```

### Required Permissions

```
whatsapp_business_messaging    # Send/receive messages
whatsapp_business_management   # Manage templates, phone numbers, settings
catalog_management             # Product catalog integration (optional)
```

### Checklist: New Integration

- [ ] Meta Business account created and verified
- [ ] App created in Meta Developer dashboard
- [ ] Phone number added and verified (6-digit code)
- [ ] System User created with Admin role
- [ ] Permanent access token generated and stored securely
- [ ] Webhook endpoint deployed with HTTPS
- [ ] Webhook verification challenge handler implemented
- [ ] Webhook signature verification implemented
- [ ] `messages` field subscribed in webhook settings
- [ ] At least one template created and approved
- [ ] Opt-in collection mechanism in place before any proactive messaging
- [ ] Environment variables: `WA_PHONE_NUMBER_ID`, `WA_BUSINESS_ACCOUNT_ID`, `WA_ACCESS_TOKEN`, `APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`
- [ ] CRM stores both phone number and BSUID fields
- [ ] Error handling with retry logic implemented
- [ ] Idempotent webhook processing with message ID deduplication

### Checklist: Template Approval

- [ ] Name is lowercase with only letters, numbers, underscores
- [ ] Category matches actual content (not misclassified)
- [ ] All variables have example values provided
- [ ] Marketing templates include opt-out language
- [ ] No sensitive data requested in message body
- [ ] No misleading CTAs or deceptive framing
- [ ] Media header includes example media (if applicable)
- [ ] URL buttons use valid, working URLs

### Cost Calculation Formula

```
Monthly Cost = Σ (messages_delivered × country_rate × category_multiplier)
             - volume_discounts (utility/auth only)
             - free_CSW_utility_messages
             - free_72h_CTWA_messages

Effective Rate = Marketing >> Utility > Authentication >> Service (free)
```

---

## Dispatch Infrastructure (BM Balão Strategy)

### Overview

"BM Balão" = disposable BM purchased from the parallel market, used to validate WhatsApp broadcast channel before investing in permanent infrastructure. Expected lifecycle: weeks to months. When it falls, the validated learnings (template performance, block rates, conversion data) transfer to the permanent BM.

The term "balão" (balloon) in Brazilian gray-market WhatsApp circles refers to a pre-verified Business Manager with WhatsApp Business API already approved and a phone number "inflated" (connected) to a WABA, ready for immediate dispatch without full Meta verification from scratch.

### Full Pipeline Architecture

```
[1] PROFILE ACQUISITION (R$18-216, GGMax/perfilantigo)
     ↓
[2] PROFILE WARMING (7-14 days, antidetect + proxy)
     ↓
[3] BM ACCESS (purchase invite link or create fresh)
     ↓
[4] BM VERIFICATION (pre-verified purchase OR real CNPJ docs)
     ↓
[5] WABA / PHONE NUMBER ATTACHMENT
     ↓
[6] NUMBER WARMING (official API: tier escalation per quality)
     ↓
[7] TEMPLATE CREATION & APPROVAL
     ↓
[8] TEST BROADCAST (50-100 contacts, measure block rate)
     ↓
[9] SCALE DISPATCH (gradual, quality-gated)
     ↓
[10] MONITOR / BURN & REPLACE (when banned)
```

### Required Stack

| Component | Recommended | Cost |
|---|---|---|
| BM Disparo | Purchased with WABA + dispatch tier | R$100-350 (or $19-59 USD international) |
| Profile (primary admin) | BR 2025-2026 / 1-3 Fanpages | ~R$216 |
| Profile (backup admin) | Mix antigo / Sem Fanpages | ~R$18 |
| Proxy | Dedicated SOCKS5 (country-matched) | ~R$30/mês |
| Antidetect browser | AdsPower (free tier, 2 profiles) | R$0 |
| Virtual card | Wise/Revolut (separate from other BMs) | R$0 |
| Total initial | — | ~R$370-620 + ~R$30/mês |

**Isolation rules:**
- NEVER link company domain to balão BM
- NEVER share proxy/card with other BMs
- NEVER use personal profile as admin
- NEVER reuse a card that was on a banned BM (dirty-list persists 6-12 months)
- Treat as disposable from day 1
- **Proxy is a PRECONDITION of opening the antidetect profile, NOT a per-step check.** The profile is NEVER opened without its proxy already attached, so once it is open the proxy is a given. Never re-verify "is the proxy on?" mid-flow, opening the profile already implies it.
- **Between balloons, isolate the IP FAMILY, not just the IP.** Parallel balloons use different proxies AND ideally different IP families (e.g. balloon #1 on IPv6, balloon #2 on IPv4), so Meta cannot graph-link them by adjacent range. Same for card and number: one per balloon.

### Running Balloons in Parallel (Second Balloon)

Running a 2nd (or Nth) balloon in parallel buys redundancy (one falls, the others keep warming) and multiplies daily capacity. The learnings transfer (approved template copy, the warming ramp, the recent-signups nurture pool), only the infrastructure is new.

- **Full isolation BETWEEN balloons**, not just versus the company: separate antidetect profile, separate proxy on a different IP family/range, separate virtual card, separate number. Anything shared lets Meta graph-link them, and one ban then cascades to all.
- **Templates are per-WABA.** Reuse the exact approved copy, but each WABA submits its own templates (approval does not transfer between WABAs).
- **BSP account decision:** the same YCloud account can host a 2nd channel (Free plan allows 2 channels), but that links the two WABAs at the BSP level. A separate YCloud account (different email) is fully isolated. BSP-level linking is far lower risk than Meta-level (proxy/card/pixel) linking, choose by how disposable vs long-lived the balloons are.
- **Split the contact lists.** The renewable recent-signups pool can feed all balloons, but never message the same lead from two numbers (looks like spam, and the per-user marketing cap, error 131049, applies across senders).
- **Stagger the sends.** Avoid broadcasting from both numbers in the same window, spacing keeps the footprints distinct and avoids a correlated quality dip.

### Proxy Selection (which product for a dispatch BM)

Hard requirements, the proxy must be:
- **Dedicated/static**, NEVER rotating. Warming needs one consistent IP, a changing IP reads as account-takeover/bot. Avoid "alta rotacao" / high-rotation / web-scraping proxies.
- **SOCKS5** (full tunnel for the antidetect browser), not HTTP.
- **BR**, matching the operation's country.

Choosing within a provider's catalog (within a provider's catalog):
- **Prefer the "Facebook/Google"-tuned line** (if the vendor tags tiers by target platform): those IPs keep a clean Meta reputation, which matters more than anything else for a WABA. Proven in production.
- **IPv4 vs IPv6:** IPv6-only SOCKS5 is an uncommon residential fingerprint in BR (mild AdsPower detection risk), IPv4 looks more like a real home connection. For a SECOND balloon, picking the opposite family from balloon #1 doubles as cross-balloon isolation.
- **Residential** is the best anti-detection ONLY if static/dedicated. "Turbo"/rotating residential changes IP, bad for warming, confirm it is fixed before buying.
- **Avoid:** rotating/high-rotation, HTTP-only, and any IP flagged for scraping/abuse.

### Tier System (Current State, Oct 2025 Onward)

**Current tier behavior (empirically confirmed in production on a live WABA via YCloud, May 2026):**

| Status | Daily Limit | How to Reach |
|---|---|---|
| Unverified BM | 250 unique conversations/day | Starting point |
| Verified BM (initial) | 2,000/day (Tier 1 per Oct 2025 schema) | Business verification approved |
| Tier 2 | 10,000/day | Auto-scale: 50% of 2,000 limit used in 7 days at Green/Yellow quality |
| Tier 3 | 100,000/day | Auto-scale |
| Tier 4 | Unlimited | Enterprise |

The earlier claim that "Verified BM → direct jump to 100,000/day" was **disproved by production dashboard observation** (verified BM showed 2,000/day, consistent with the standard Oct 2025 tier schema). The '100K jump for verified BMs' is an announced Meta roadmap item (Q1-Q2 2026 rollout), not yet universally applied.

**Tier advancement rule:** At least 50% of current limit used in any 7-day window AND quality rating is Green or Yellow (not Red). Evaluation every 6 hours. Advancement is automatic within hours of meeting criteria.

**Pre-2026 advancement thresholds (now superseded):** The old table showing "500 unique users for Tier 1→2" used incorrect absolute numbers — the actual rule was always "50% of current limit in 7 days." For Tier 1 (1,000 limit) that was ~500 users, but the threshold was proportional not fixed. For Tier 3→4 (10,000 limit) the threshold was ~5,000 (not 20,000). These absolute-number references are now obsolete.

**Key changes (Oct 2025 onward):**
- Tier evaluation now every 6 hours (was 24h)
- Limits apply per Business Portfolio, not per phone number (Oct 2025)
- New numbers added to a verified portfolio inherit the portfolio's tier immediately
- Meta limits per-user marketing messages at an undisclosed daily threshold (estimated ~2/day); exceeded cap returns error **131049** (not 130472)

**Upcoming (Q1-Q2 2026, partial rollout):** Meta intends to remove the 2K and 10K intermediate tiers so verified businesses jump directly to 100K. As of May 2026 this has NOT been universally applied. Treat as pending.

### BM Sources (Market Reference)

**International vendors (serving Brazil):**

| Vendor | Product | Price |
|---|---|---|
| npprteam.shop | Brazil Verified BM $50 limit, WABA-eligible | $19 USD |
| npprteam.shop | Verified BM with Balloons, $250 limit, 1k-2k msg/day, 2 numbers | $59 USD |
| verifiedbm.shop | Verified BM + WhatsApp API | Variable |
| dhaka-bm.com | WhatsApp API BM, 250 or 2000 msg/day | Negotiable |

**Brazilian domestic vendors:**

| Vendor | Product | Price |
|---|---|---|
| perfilantigo.com | BM + profile bundle | R$39+ |
| mendesbmilimitada.com.br | BM Ilimitada (verified profile) | Variable |
| proxybrasil.com | BM Verificada $250 + WhatsApp API | ~R$250 |

**Survival rates by BM type:**

| BM Type | Price (USD) | Daily Limit | Lifespan Under Load |
|---|---|---|---|
| Reinstated BM | $1.60-1.90 | $50 | 1-3 days |
| BM via WhatsApp flow | $0.76-0.95 | $50 | 1-5 days |
| BM3 (3 ad accounts) | $4.10-4.65 | $50 | 5-10 days |
| BM5 $50 limit | $7.51-17.60 | $50 | 7-14 days |
| BM5 $250 limit | $34.90-241.80 | $250 | 14-30 days |
| Verified BM $50 | $24.70-59.00 | $50 | 14-30 days |
| Unlimited BM | $97.02-429.00 | No cap | 30-90+ days |

**Industry reality:** Only 10-20% of purchased BMs survive the first 30 days under real advertising load.

### Number Warming Protocol (Official WABA)

**Post-Oct 2025: new numbers inherit the portfolio's tier instantly** (e.g., verified BM at Tier 2 = 2000/day from day 1). BUT inheriting the LIMIT ≠ safe to use it. Quality rating + pacing system are per-number and built from real behavior. Hitting full limit on a new number looks like bot behavior.

**The limit is the ceiling, NOT the day-1 target. Warm the number regardless:**

| Day | Safe Volume | Recipients |
|---|---|---|
| 1 | 20-50 | WARM only: team + admins + people who expect the message |
| 2 | 50-100 | Engaged/known contacts |
| 3-4 | 100-300 | Semi-warm (prior brand interaction) |
| 5-6 | 200-500 | Warmest subset of cold list — ONLY if quality Green |
| 7 | assess | Review quality before scaling |
| 8-14 | 800-1500 | If Green throughout |
| 15+ | follow tier | Full limit, only if Green holds |

**The #1 ban cause: blasting a cold list on a new number.** New number = zero quality buffer. Cold marketing broadcast (no opt-in) → high block rate → Red status in hours → permanent number ban. A single bad broadcast kills a new number. This is universal across all sources.

**Block rate thresholds (industry-derived, Meta doesn't publish):**
- <0.5% healthy, ~1% Yellow nudge, >2% Red risk, >5% serious ban risk
- On a 50-contact send, 1 block = 2%. First send MUST be warm contacts (0 blocks achievable).

**Quality rating mechanics:**
- Reflects rolling 7-day feedback (blocks, spam reports, read rate, error 131049 frequency saturation)
- Recalculates ~every 24h
- Recovery: Yellow→Green 48-72h, Red→Green 7-14 days, number ban = PERMANENT
- Post-Oct 2025: "Flagged" status eliminated; Red prevents tier upgrade but doesn't auto-downgrade. Sustained Red + any policy violation = immediate disable.

**Emergency stop signals:** quality → Red, Meta warning message, frequent error 131049, read rate <20%.

**Billing before first send:** BSP platform may be free (YCloud), but Meta charges per message deducted from wallet. NO free marketing messages. Top up before Day 1.

**Rules:**
- Randomize send intervals (mimic human timing)
- Monitor BOTH BSP dashboard (delivery/read) AND Meta Business Manager Quality Rating column after every batch
- Financial niche + Brazil = recipients trigger-happy on "report spam" → warm harder

### Chip Warming (Unofficial API Route)

For operators using unofficial APIs (Evolution API, WPPConnect, WasenderAPI) on burner SIMs:

| Period | Daily Limit | Content |
|---|---|---|
| Days 1-3 | Up to 20 messages | Text only, no links/media |
| Days 4-7 | Up to 50 messages | Can add emojis |
| Days 7-14 | Progressive increase | Media allowed |
| Days 14-21 | Begin API automation | Links allowed |
| Days 21-30 | Normal volume | Full content |

**Critical:** Use 4G/5G exclusively during warming. Get inbound messages (sticker groups, contacts calling the number) before sending outbound. A receive-only account builds trust; a send-only account is definitionally a bot.

**Anti-detection for unofficial API:**
- Random delays: 15-45 seconds between each message
- Rest periods: 10-15 minute breaks after every 50 messages
- Spintax rotation: no two messages identical
- Maintain positive sent/received ratio
- Consistent IP: never login from multiple countries
- Persistent session: frequent reconnections flagged as suspicious
- Avoid shortened URLs (bit.ly etc.)

**Risk:** Meta blocked ~7 million WhatsApp accounts in H1 2025. Financial keywords (boleto, PIX, cartão, investimento) trigger higher scrutiny.

### Setup Sequence (Detailed)

#### Verified vs Practitioner Lore (2026 deep-research, primary-sourced)

**Maintenance principle: this skill is ALWAYS retro-fed and corrected from our own live runs.** Every step actually executed gets documented here, and every claim is tagged by provenance, "observed live" (first-party from a real run), "primary-sourced" (Meta/BSP docs), or "practitioner lore" (community convention, unverified). When a real run contradicts the skill, fix the skill in the SAME session. Live observation outranks blog lore and overrides stale claims.

A 2026 multi-source verification pass (23 sources, 25 claims adversarially voted, 11 confirmed / 14 killed) separated what Meta actually documents from widely-repeated community lore. Treat the two differently.

**Confirmed (primary sources, survived adversarial review):**
- **Admin role is required to complete BSP Embedded Signup.** Only the owner/Admin of the Business Portfolio can run the flow, an "Employee" cannot even select the portfolio, and the BSP cannot navigate it for you (you authenticate with your own Facebook Login). When accepting a purchased BM, VERIFY the granted role is Admin / full control, otherwise WABA setup is blocked later. Sources: docs.360dialog.com, docs.gupshup.io (3-0).
- **The system user, not the human admin, is the API identity for dispatch.** WhatsApp API tokens are generated by the BM's system user (a server/software credential that does NOT go through Facebook Login OAuth), which insulates the human profile from API-level actions. The human admin is needed only to start Embedded Signup and assign assets. Personal-user tokens are technically valid but impractical (~24h expiry). Source: developers.facebook.com (2-1).
- **Ban-cascade enforcement is OWNER-based.** Meta's Account Integrity policy disables assets "owned by the same person or entity as an account that has been disabled." This is exactly why per-balloon isolation (separate profile, proxy, card, number) works: it denies Meta the same-owner signal. The stronger "mere network proximity / shared admin also cascades" claim was REFUTED (1-2), and whether simply being admin of a burned BM contaminates your own assets is unverified. Source: transparency.meta.com (3-0).
- **A temporary restriction right after Embedded Signup is NORMAL, not a burn.** Meta auto-reviews business info, website, display name, and Commerce Policy after signup, during which "messaging may be limited" and "the account could appear temporarily restricted." Do not panic-diagnose this as a dead BM, it is expected onboarding. Source: docs.360dialog.com (3-0).

**NOT primary-sourced (practitioner lore, plausible but unverified):**
- The Nome/Sobrenome + "Email comercial" fields: the research found NO doc on this (blog claims refuted 0-3), but the accept wizard's own Step 3 answers it FIRST-PARTY (observed live 2026): your name/email and the actions you take on behalf of the BM are visible to other managers of that business, and "actions on behalf of the business are NOT shared on your personal profile." So the name is the work-display identity and the personal profile is insulated from business-side actions. Full walkthrough in the "BM Invite Acceptance Wizard" section below.
- Why some accepts skip the name wizard (link vs in-app vs direct-provisioning). Open question, no primary source.
- The exact Account Quality UI (color codes, tabs, navigation). All refuted 0-3, trust the LIVE screen, not blog screenshots. Meta renamed "Business Manager" to "Business Portfolio" in 2024, so older guides are stale.
- The gray-market accept hygiene itself (consistent proxy/antidetect IP at accept, the 24h BM rest, the "balao" workflow). No primary sourcing, these are sensible community conventions, undocumented by Meta.

**BM de disparo (WABA-only) does NOT require profile warmup.** Profile warmup (browsing, liking posts, joining groups) protects Facebook ad accounts from Meta's Ads algorithm trust checks. WABA trust is evaluated through Business Portfolio verification + phone number quality rating, which are completely separate systems. A freshly acquired profile can immediately set up WABA without triggering ad-related trust checks because WABA setup involves zero ad account activity.

The only warmup that matters for WhatsApp dispatch is the **gradual message volume increase on the phone number itself** (see Number Warming Protocol above).

**Phase 1: Infrastructure (Day 0)**
1. Install AdsPower, create browser profile(s)
2. Configure dedicated proxy (SOCKS5, BR) per profile
3. Set fingerprint: timezone BRT, language PT-BR, consistent resolution
4. Create separate virtual card (Wise/Revolut)

**Phase 2: Profile Login + BM Accept (Day 1)**
5. Import profile cookies into antidetect
6. Open facebook.com — should land logged in via cookies
7. Check Account Status immediately. **Path: profile photo (top-right) → Ajuda e suporte / Help & support → Status da Conta / Account Status.** It is NOT under Settings or the settings search (not indexed there). Direct URLs: `facebook.com/account_status` or `facebook.com/profile_status/<profile-id>`. Clean = "Sem restrições / Tudo certo com sua conta" (bonus health signal: Marketplace "Ativo"). Any restriction, limited feature, or pending "Confirmação de identidade" demand: do NOT accept the BM, invoke the supplier guarantee.
8. Accept BM invite link in same antidetect session (within supplier deadline!). VERIFY the granted role is **Admin / full control**, NOT "Employee" (an Employee cannot run the later BSP Embedded Signup, confirmed 3-0, see Verified Findings above). The invite-link wizard may ask for a display name + a notification email, this is standard for joining a portfolio, enter the profile's name and leave the supplier's disposable email.
9. Do NOT touch the BM for 24 hours (let Meta's systems settle)

#### BM Invite Acceptance Wizard (Business Portfolio, observed live 2026)

The invite-link accept (`business.facebook.com/invitation/?token=...`) is a 3-step wizard. Meta does not document it publicly, this is first-party observation, an in-app accept via Business Suite notifications may differ.

**Step 1 of 3, "Você recebeu um convite para participar de [BM]":** enter Nome + Sobrenome ("como você quer que apareça neste portfólio empresarial", your display identity inside the portfolio) and a notification "Email comercial" (pre-filled, fine to leave the supplier's disposable one). Optional Meta-marketing checkbox, leave it unchecked. Use the profile's own name for consistency, and NEVER an email that links to the real brand.

**Step 2 of 3, "Analisar informações da empresa" (the burn-check surface):** shows the BM display name, creation date, and **business verification status** (Verificada / Não verificada). "Verificada" is the key win, it means Tier 2 (2000/day) from day one with no document submission. Also shows Razão social + CNPJ, País, and the registered Site (LOCKED on a verified BM, NEVER change it), plus whether the portfolio already has a Page/Instagram/WhatsApp with >1000 followers (a fresh balloon shows none). A fresh, verified, empty, no-violation BR portfolio is the healthy case, pre-existing assets or restriction notices here are the burn signal.

**Step 3 of 3, "Leia e aceite o convite" (first-party answer to the name/insulation question):** re-shows your Nome + Email, then states verbatim:
1. "Seu nome, email e ações que você realiza em nome de [BM] ficarão visíveis para outras pessoas que gerenciam esta empresa." (the name IS the work-display identity, visible to co-managers).
2. "As ações que você realizar em nome dessa empresa NÃO serão compartilhadas no seu perfil pessoal." (Meta's own UI confirms the personal profile is insulated from business-side actions, corroborating the system-user finding).
3. People with full control of the portfolio can see whether you enabled 2FA.
Accepting joins the portfolio and agrees to Meta ToS + Commercial Terms. Click "Aceitar convite".

**The wizard does NOT show or set your ROLE.** Admin vs Employee is whatever the inviter granted, verify it AFTER accepting at `business.facebook.com → Configurações → Pessoas` (your access level). Admin / full control is required for the later BSP Embedded Signup, if it is Employee, ask the supplier to re-grant as Admin.

**Phase 3: Security Hardening + WABA Setup (Day 2, split sessions)**

Hardening and WABA setup can happen on the same day (different entities: profile vs BM), but must NOT happen in the same 2-hour window. The cluster of password change + 2FA + admin changes + asset creation resembles an account takeover to Meta's automated systems. Split into two sessions with a 2-4h rest. **Hardening ALWAYS before WABA** — security changes after WABA is live can trigger re-verification.

**Morning session: Profile Hardening**
9. Change Facebook password, enable 2FA (authenticator app)
10. Add backup profile as second BM admin
11. ⏸ **REST 2-4 hours** — do not perform any BM operations

Note: purchased profiles typically come with temporary/disposable emails (tuamaeaquelaursa.com, mail.tm, tempail, etc.). No need to secure those — just change Facebook password + 2FA. The temp email becomes irrelevant once Facebook credentials are yours.

**Afternoon session: WABA Setup**
14. Fill out Business Information in BM (legal name, address, website, email — must be complete BEFORE Embedded Signup)
15. Choose BSP and initiate Embedded Signup (360dialog, WATI, Disparo Pro, etc.)
16. Create WABA + set display name (Meta reviews display name: 1-3 days)
17. Register phone number via OTP (SMS or voice call)
18. Number active within 60-120 min post-verification
19. Attach virtual card to BM for billing
20. Set WhatsApp profile: picture, business description, category

**Deferred: Remove supplier admin (Day 8+)**
21. Facebook enforces a 7-day restriction: new admins cannot remove other admins for 7 days after accepting the BM invite
22. Do NOT attempt removal before the 7-day window — the blocked attempt itself registers as a BM-level security event
23. Sequence: add backup admin first (Phase 3) → confirm backup has access → remove supplier admin (Day 8+)

**Phone number requirements:**
- Never previously registered on any WhatsApp product (consumer, Business App, or API)
- Must receive SMS or voice calls (no IVR-only, no short codes)
- If migrating from Business App: delete that account first, wait up to 30 days
- Max 2 numbers on unverified BM; 20 after business verification

**Phase 5: Templates (Day 2-3)**
21. Create marketing templates and submit for approval
22. Approval timeline: minutes to 4h (ML-automated), up to 24h if flagged for manual review
23. Pre-design templates before submitting (see Template Strategy below)

**Phase 6: Testing (Day 3-4)**
24. Test broadcast: 50-100 opted-in contacts
25. Measure: delivery rate, read rate, block rate
26. If block rate >2%: stop, review template content
27. If green: proceed to number warmup ramp

**Phase 7: Number Warmup + Scale (Day 4+)**
28. Follow Number Warming Protocol above (50→100→250→500→1,000/day over 15 days)
29. Wait for tier evaluation (every 6 hours)
30. Monitor quality rating daily
31. Scale horizontally by adding numbers under same portfolio (inherit tier)

**Phase 8: Business Verification (submit Day 1, approval 1-14 days)**
32. Submit verification documents simultaneously with setup
33. Verification unlocks: 2,000 conversations/day (Tier 1 per Oct 2025 schema) + up to 20 phone numbers
34. Since Oct 2025: messaging limits are per Business Portfolio, not per number — new numbers added to a verified portfolio inherit the tier immediately

**Timeline: BM purchased → first message sent in 3-5 days** (1 day BM rest + hardening + WABA setup + display name review + template approval). No profile warmup days wasted.

**What was removed and why:**
- ~~7-day profile warmup (browse feed, like posts, join groups)~~: protects ad accounts only. WABA trust model is independent. Confirmed by supplier, Meta developer docs, and Brazilian dispatch community (disparopro.com.br, socialhub.pro, blackrat.pro). No BSP or WABA setup guide mentions profile warmup as a prerequisite.
- ~~Ad warmup campaigns (awareness → engagement → conversion)~~: already removed in 2026-05-10 update.
- ~~Remove supplier admin on Day 2~~: Facebook enforces 7-day wait for new admins to remove other admins. Deferred to Day 8+.

**What was kept:**
- 24h no-use period after BM accept: low-cost precaution to let Meta's systems settle.
- 2-4h rest between hardening and WABA setup: prevents account-takeover behavioral signature.

### Display Name Strategy (Mismatched BM Entity)

Meta does NOT require the display name to match the BM's legal entity name. The real rule: the display name must have a **publicly verifiable relationship** with the business, proven via the website. Confirmed by 360dialog, WATI, AiSensy, Salesforce/Meta docs.

**The website footer strategy (documented, sanctioned solution):**
When the BM legal name differs from the desired brand, the website must show both:
- Display name prominently in header/logo/title
- BM legal entity in footer: `[Brand] — operado por [BM Legal Name] | CNPJ XX.XXX.XXX/0001-XX`

**Display name rules:**
- Must appear on a live, accessible website linked in BM settings
- Cannot be a generic noun alone ("Trading", "Community", "Signals")
- Cannot include "Oficial", "Verificado", or implied status words
- Cannot be all caps unless branded that way everywhere
- Cannot include the agency/intermediary name (that goes in the footer only)
- Minimum 3 characters
- **Forbidden characters:** `~!@#$%^&*()_+:;"'{}[]|<>,/?` — parentheses, pipes, etc. are auto-flagged before human review
- No URLs, symbols, or emoji
- Exception: forbidden formatting rules don't apply if the business already brands that way externally (e.g., "CRED" in all caps). But this must be provable on the website.

**Meta-official format for brand/entity mismatch: "Brand by [Entity]"** (e.g., "Fruit Snacks by Fresh Produce", "Delight Ice-creams by Fresh Dairy"). This is the officially documented and safest approach — uses no special characters, no auto-flag risk. Reserve the parenthetical format only when the site already shows that exact format externally.

**"Brand (Entity)" format — CONFIRMED WORKING (with caveat):**
- Parentheses are in the official forbidden character set, but Meta's policy explicitly states: "These formatting guidelines do not apply to businesses who already brand this way externally."
- "Brand (Entity)" format was accepted during Embedded Signup (empirically confirmed in production, May 2026) — consistent with the external-branding exception (the disposable brand site footer showed the parenthetical format)
- Real-world precedent: "a retailer support line (Company Ltda)" also approved
- Use "Brand (Entity)" only when your site already shows that exact parenthetical branding, not as a general-purpose pattern
- **Rejection risk is LOW-consequence:** display name rejection doesn't ban BM or WABA, can resubmit up to 10x in 30 days

**Verified BMs: website field is LOCKED.**
After business verification, core fields (legal name, website, country, phone, tax ID) become protected. Changing them:
- Triggers re-verification review
- Can cause loss of verified status
- For purchased BMs: identity inconsistency is a red flag → BM suspension risk
- NEVER change the website field on a verified BM

**Implication for BM balão with brand mismatch:**
If the purchased BM's website doesn't mention your brand, you cannot use your brand as the display name. Options:
1. Use the existing BM entity name as display name (e.g., the balloon BM identity name or a variant of it)
2. Check if the existing website has any editable section to add your brand name
3. Create a separate, unverified BM with your own website (loses verified tier benefits)

**What Meta checks during review:**
- Automated: does the name appear on the website? Formatting rules? Prohibited words?
- Human (triggered when automated is uncertain): cross-references display name vs BM identity, checks website connection, checks for trademark conflicts

**What Meta does NOT systematically check:**
- WHOIS domain ownership vs BM entity
- Trademark databases (only obvious conflicts)
- Government business registries

**If rejected:**
- Does NOT ban the BM or WABA (scoped to display name only)
- Number still works but shows phone number instead of name
- Can resubmit up to 10 times in 30 days
- Can appeal with website screenshot showing the footer connection
- If appeal limit hit: 7-60 days locked from changing that name (not a ban)

**Backup names:** always have 2-3 alternatives ready before submitting.

**Critical sequence:** website MUST be live BEFORE submitting display name. Never submit without the site ready.

**Domain requirement:** Meta requires domain verification in the Business Portfolio (DNS TXT record). Free subdomains (vercel.app, netlify.app, github.io) do NOT work because you can't verify a root domain you don't own. Must buy a custom domain.

**Cheap disposable domains (for BM balão, expected to die in 30 days):**
- `.site`, `.store`, `.online`: ~$0.98/yr first year (Namecheap promo)
- `.xyz`: ~$1.58/yr first year (Namecheap)
- ⚠️ Promo price is ONE per TLD per account. Second `.site` on same account costs $1.98. Rotate TLDs across purchases (.site → .store → .online → .xyz) to always get the lowest promo
- Renewal jumps to $20-30+/yr — irrelevant for disposable BMs
- Buy on Namecheap, host on Vercel free tier with custom domain (free SSL)
- Check availability from CLI: `whois <domain>` or `npx domain-check <name> site online xyz store`
- Total cost for disposable WABA website: ~$1 domain + $0 hosting = ~$1

### Template Strategy for Marketing Broadcast

**Categories (post-April 2025: auto-reclassification):**
- Marketing: broadcasts, welcome, community updates, content announcements. $0.0625/msg (Brazil base; verify current rate — April 2026 update may apply)
- Utility: transactional only (order confirm, event reminder for registered user). **~$0.0068/msg** outside CSW; **free** inside 24h CSW (since July 1, 2025)
- Authentication: OTPs only. **~$0.0068/msg** (charged even inside CSW — unlike utility)
- Service: replies within 24h customer window. **Free** (unlimited, no cap since Nov 1, 2024)
- Since April 2025: Meta auto-reclassifies category mismatches (no rejection, just charges higher rate + 60-day dispute window). Never try to sneak marketing into utility.

**Template structure:**
- Variable format: `{{1}}`, `{{2}}` — sequential, no gaps, no named variables
- Template CANNOT start or end with a variable
- Min 3 words of static text per variable
- Always provide sample values at submission
- Body: max **1,024 chars for Marketing** (a brief 550-char cap in early 2025 was rolled back); max **512 chars for Utility and Authentication** (enforced since October 1, 2025 — templates exceeding this are blocked at creation with error 2388040). **Target under 300 chars** for marketing (scroll = -35% read rate).
- **"Read more" / "Leia mais" truncation is a CONVERSION issue only, not a policy risk.** Templates exceeding ~160 chars trigger the fold in WhatsApp UI. This does NOT affect approval, quality rating, or ban probability. Shorten only if A/B data shows truncation hurts CTR for your audience.
- Header text: max 60 chars, 1 variable allowed, no emojis
- Footer: max 60 chars, no variables, no emojis
- Button text: max 20 chars each
- Template names: **lowercase + underscores only** (no spaces, hyphens, capitals)

**Image header strategy:**
- Image headers increase engagement (visual stopping power + brand legitimacy)
- Use **dynamic variable** in header — swap image per send without resubmitting template
- Specs: **800x418 px (1.91:1)**, JPG/PNG, under 200 KB
- Style: clean branded graphic (logo + community name), dark/brand-color background
- Do NOT use: trading charts, financial return claims, text-heavy overlays, generic stock photos
- Load time: irrelevant in Brazil (WhatsApp CDN precompresses)
- Approval: image does not meaningfully increase rejection risk vs text-only. Marketing category is the slow factor (24-48h) regardless.

**Copywriting best practices (WhatsApp Brazil):**
- Structure: **Hook → Value → CTA** (compressed AIDA, not PAS)
- Length: under 300 characters body. 3-4 short lines max. No padding, no "esperamos que esteja bem"
- Tone: informal, direct, conversational (como amigo mandando mensagem). NEVER "prezado cliente"
- Emojis: 2-4 max, functional not decorative. Use 📈 📊 🎯 💡 for finance/education. Avoid 🔥🔥🔥
- Urgency: social proof > pressure words. "Mais de 2.400 membros já participam" > "NÃO PERCA"
- Voice: second person ("você"), brand as guide, user as protagonist
- CTA button: verb + specific outcome ("Entrar no grupo" > "Saiba mais")
- **Shorten by cutting filler words, never by removing letters or using weird spacing.** Character-level obfuscation (e.g., "gr@tis", "i-n-v-e-s-t-a", dots between letters) is read by Meta classifiers as filter-evasion and increases rejection probability. Cut entire sentences or phrases instead.

**Forbidden words/phrases (Portuguese, financial niche):**
- Hard reject: grátis, imperdível, compre agora, ganhe dinheiro, renda extra, duplique seus ganhos, invista agora, lucro garantido, retorno garantido, clique aqui agora, oferta por tempo limitado, não perca, MLM, multinível, PIX grátis, bônus
- Safe alternatives: conteúdo exclusivo, aula, encontro ao vivo, desafio, missão da semana, comunidade, grupo, membros, novidade, acesse, confira, saiba mais, disponível para você, sua jornada, conteúdo liberado, ao vivo hoje

**Opt-out: use Quick Reply button, NOT footer text.**
- Button: "Parar mensagens" (more visible, LGPD-defensible, reduces blocks)
- Footer text opt-out is less visible (60 char limit, users miss it)

**WhatsApp group links in templates: BLOCKED.**
- `chat.whatsapp.com` and `wa.me` links are rejected in CTA buttons
- Workaround: host redirect on your own domain (e.g., `yourdomain.com/grupo` → instant JS redirect to `chat.whatsapp.com/XXXX`). Meta approves your domain, redirect happens post-click.

**First template submission strategy:**
1. Submit 1 template first, wait for approval
2. Send to small batch (50-100 opted-in users) — let quality signals accumulate
3. Submit 2-3 more after first is Active and sent without blocks
4. Every new approved template gets tested on ~1k recipients by Meta — bad signals can pause it

**Approval process:**
- Automated ML classifier first (minutes), human review for borderline cases (up to 24h)
- New WABA + Marketing + financial content = 48-72h (no quality history → manual review path)
- Status "Active-Quality pending" = APPROVED, can send now; quality rating computed after sends
- Rejection gives brief reason code (INVALID_FORMAT, TAG_CONTENT_MISMATCH, ABUSIVE_CONTENT, PROMOTIONAL)
- Rejected templates can be edited and resubmitted with a NEW name
- Max 250 approved templates (unverified), 6000 (verified)
- No strict submission limit, but repeated rejections flag your account
- Stuck in review >48h = yellow flag, >72h = red flag (delete + resubmit with minor change forces fresh ticket)
- **Editing a template with 0 sends carries zero quality risk** — there is no quality score to lose before the first send. Edit limits apply **only to Approved templates**: ~1 edit per 24-hour window, ~10 edits per rolling 30-day window (not calendar month). Rejected and paused templates have **unlimited edits** with no rate limit. After editing any Approved template (even 0-send), it returns to 'In Review' and **cannot be sent** until re-approved (minutes to 24h) — do not edit a template actively scheduled for an imminent broadcast. Edits do not affect the WABA-level quality rating.
- **HTTPS URL requirement (effective January 1, 2026):** Any template containing a URL — in body text or CTA buttons — must use a valid, verifiable HTTPS URL. Blocked: HTTP URLs, bit.ly/tinyurl shorteners, bare domains without https://, unreachable or login-gated pages. Templates are rejected at creation with a descriptive error. This makes the domain-redirect strategy even more critical: your redirect domain (e.g., yourdomain.com/grupo) must be a live, publicly accessible HTTPS endpoint.

### Business Profile Compliance (financial niche)

**The profile IS reviewed by Meta** — reactively (when account is flagged for any reason: spam reports, volume spikes, blocks), not proactively like templates. Meta's terms: "WhatsApp may review, remove, or delete Company Content you share on your business profile." A profile that contradicts the WABA category becomes evidence of deception during review.

**Category + About + Description must tell ONE coherent story.** Mismatch (e.g., category "Education" but description says "managed capital") is a compounding risk during review.

**Profile risk spectrum (Brazil financial/investment):**
| Phrase | Meta risk | CVM risk | Use? |
|---|---|---|---|
| "educação financeira" | None | None | ✅ Safe |
| "comunidade de investidores" | None | None | ✅ Safe |
| "mercado financeiro" / "mercado de capitais" | None | None | ✅ Safe |
| "compartilhamos análises/estratégias" | None | None | ✅ Safe |
| "gestão de capital" | Medium | High (CVM authorization required) | ❌ Avoid |
| "gerenciamos seu capital" | High | Very High | ❌ Never |
| "retorno garantido" / "rentabilidade garantida" | Instant flag | Criminal-level | ❌ Never |

**Key distinction (Brazilian law):**
- Educação financeira (teaching markets/strategies) = NO CVM authorization needed
- Consultoria de investimentos (personalized advice) = CVM registration required
- Gestão de carteiras (managing portfolios) = CVM authorization required
- "Compartilhamos" (we share) is safe; "gerenciamos" (we manage) triggers regulation

**CVM is aggressive (2025):** 24 platforms suspended, R$1k/day fines. Meta + CVM risk are independent but additive — "gestão de capital" hits both at once.

**Complete profile is SAFER than minimal** (counterintuitive but consistent):
- Quality rating depends on message reception, NOT profile completeness
- Empty/sparse profile looks like scam → more blocks → worse quality rating
- Complete + coherent profile looks legitimate during manual review
- Website in profile must match WABA display name footprint (helps display name approval)
- Email: use domain email, NOT Gmail (raises trust questions)
- Address: city/state or "Brasil" is enough — fill it, don't leave empty

**The "surface area" myth:** more profile info = more consistency signals, not more attack surface. The real risk in a BM balão is messaging behavior (spam, opt-ins, volume), not profile text. Write clean copy, don't leave fields empty.

**Website field is CRITICAL for display name approval (not optional):**
- Meta requires a working website to approve a display name (confirmed across 12+ BSP sources)
- The display name must literally APPEAR on the website
- Meta primarily checks the BM-registered website; the profile website field is secondary but also checked
- When brand name ≠ legal entity: the website must show BOTH — brand in header/body, legal entity + CNPJ in footer ("Brand powered by Legal Entity" pattern, recommended by 360dialog/Wati)
- Empty website field = near-certain display name rejection
- If the BM website is locked and doesn't show the brand, the profile website field pointing to a brand-showing site is your ONLY lever — fill it
- Updating the website field during a pending review has no documented downside; reviewer may pick it up
- Profile website field ≠ for isolation. Put the disposable brand site, NOT the real client domain
- Email field: leave empty for isolation if you'd otherwise use the real domain (links WABA → real brand). Website (disposable site) is fine and necessary; email (real domain) is the actual isolation risk.

### Direct Cloud API Setup (No BSP)

For teams with technical capability, direct Cloud API is cheaper (no BSP monthly fee or per-message markup).

**Setup sequence (direct, requires developer account):**
1. Log into `developers.facebook.com` as BM admin
2. Register as developer → verify via SMS (needs real carrier number, see Phone Number Strategy)
3. Create App → type "Business" → associate with BM
4. Add WhatsApp product to the app
5. Create WABA in the app dashboard → set display name (review: up to 24h)
6. Create System User in BM Settings → Users → System Users → Admin role
7. Add assets: Apps → your app → enable `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`
8. Generate permanent token (shown once, save immediately)
9. Register phone number via OTP (needs virgin number)
10. Add payment method at WABA level
11. Create and submit templates
12. Send via: `POST https://graph.facebook.com/{version}/{phone_id}/messages`

**Alternative: BSP Embedded Signup (NO developer account needed):**
If developer account SMS verification is blocked (common with purchased profiles), use a BSP:
1. Sign up on BSP platform (e.g., YCloud free plan at ycloud.com)
2. Go to WhatsApp accounts → WhatsApp Business API → Get started
3. On the onboarding page, scroll to "Embedded Sign-up" section → click **"I'm ready to start"** (NOT the "On boarding" floating button)
4. Facebook Login popup opens → log in as the BM admin profile
5. Select existing Business Manager → create WABA → set display name
6. Add phone number → receive OTP
7. BSP provides API access through their platform

The BSP uses THEIR developer app — you don't need one. You only need Facebook login + BM admin access.

**Token types:**
- Temporary (from app dashboard): expires ~24h, tied to personal account. For testing only.
- System User (permanent): does not expire unless revoked, survives if admin profile gets restricted. Always use for production.

**Webhooks:** not required to send messages. Only needed for delivery receipts. Simple HTTPS endpoint returning 200 OK.

**Rate limits (Cloud API, post-Oct 2025):**
- Tier 0 (unverified): 250 unique users/24h
- Tier 1 (verified): **2,000/24h** (raised from 1,000 on Oct 7, 2025)
- Tier 2: 10,000/24h (auto-scale once 50% of 2,000 used in 7 days at Green/Yellow quality)
- Tier 3: 100,000/24h (auto-scale)
- Unlimited: auto after 100k
- Throughput: 80 msg/sec → 1,000 msg/sec at Unlimited + Green

**Billing (direct API, Brazil 2026):**
- Charging begins at first real message sent (not at WABA creation)
- Marketing: ~$0.0625/msg delivered (base rate; verify — April 2026 Brazil pricing update may apply; BRL billing available from July 2026 for eligible accounts)
- Utility: **~$0.0068/msg** outside CSW; **free** inside 24h CSW (since July 1, 2025)
- Authentication: **~$0.0068/msg** (charged even inside CSW — unlike utility)
- Service (inbound-initiated): **free** within 24h window, no monthly cap (since Nov 1, 2024)
- Payment at WABA level (not BM or app level)
- Wise/Revolut virtual cards work (Visa/Mastercard with international support)
- Meta does NOT require cardholder name to match BM legal name

### BSP Options (if not using Direct API)

> **Note:** Gupshup embedded signup only shows WABAs not already Connected to another BSP. If migrating a live WABA that is currently bound to a different BSP, the real WABA will not appear in the picker until released from the current BSP (see "Switching BSP / Migrating an Existing WABA" section).

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

> **How to read this table:** "Per-msg markup" is what the BSP charges *on top of* Meta's base rate above. Total cost = Meta base rate + markup + monthly fee amortized per message. Sorted approximately cheapest-first for Brazil marketing dispatch at moderate volume.

| Platform | Type | Monthly fee | Free tier | Per-msg markup (Brazil marketing) | Brazil notes | Source / asOf |
|---|---|---|---|---|---|---|
| **YCloud (Free plan)** | BSP | **$0/mo** | Unlimited API; service msgs $0 (empirically confirmed totalPrice:0 in production); utility-in-window $0; shared inbox included; 1 user, 2 channels | **0%** — explicit zero-markup policy; passes Meta rates from wallet; empirically confirmed at ~$0.05–$0.0625/msg for BR marketing | Best Brazil dispatch value: pay only Meta's rate. BRL billing H2 2026. Add-on users $10/user/mo, channels $5/channel/mo. ⚠️ Risk-control auto-flags possible on free tier for financial use cases (observed on a financial-niche account, resolved via support ticket in <24h) — open a support ticket immediately if suspended, false-positive rate is high | ycloud.com/pricing — asOf 2026-06-03 (HIGH) |
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
- **Our empirical ground truth (YCloud, production):** service messages = totalPrice:0 confirmed; Brazil marketing draws from wallet at ~$0.05–$0.0625/msg — consistent with Meta's $0.0625 base at 0% markup.

**MM API vs Cloud API (360dialog / Gupshup):** Meta's Marketing Messages (MM) API route can eliminate BSP surcharges that apply only on the standard `/messages` Cloud API endpoint. If using 360dialog or Gupshup for high-volume Brazil marketing, prefer the MM API/MM Lite route.

**Meta per-message rate (Brazil 2026):** Marketing $0.0625/msg (per-message billing since July 2025, was per-conversation). Service (user-initiated, 24h window) free.

**Cost for low-volume test (23 + 500 msgs):**
- Direct Cloud API: $1.44 / $31.25 (zero markup, needs dev app)
- Gupshup: $1.46 / $31.75
- Twilio: $1.55 / $33.75

**YCloud campaign send file format:** upload `.xlsx` (not `.csv` — CSV is rejected by the campaign UI). First column header must be exactly `phone` with numbers in +E164 format (e.g., +55XXXXXXXXXXX). Additional columns become template variables mapped in order. The UI "Test send" button is greyed out until at least one template variable field is populated with a sample value — fill all variable fields first, then the button activates.

**Monitoring sends via the YCloud API (polling — verified live 2026-06):** the dashboard Analytics/Logs are the GUI view, but per-message status is pullable programmatically. ⚠️ The published YCloud SDKs (Java/Python/PHP) claim there is NO list endpoint (only `retrieve`/`send`/`sendDirectly`) — that is **WRONG**; the live REST API DOES expose a paginated list. Trust the live API over the SDK docs.
- **List:** `GET https://api.ycloud.com/v2/whatsapp/messages?limit=100` (header `X-API-Key: <key>`) → `{offset, limit, length, items:[...]}`. ⚠️ **PAGINATION IS BROKEN/ABSENT (verified live 2026-06):** the `offset` param is **silently IGNORED** (offset=0 and offset=3 return identical rows), there is **no cursor** in the response, and `limit` is **capped at 100** (`limit>100` errors). So the endpoint returns ONLY the **newest 100 messages**, with no way to page beyond. → Fetch ONE `limit=100` page and **dedup by `id`** (do NOT loop offsets — that returns the same page repeatedly and inflates counts ~Nx). `?includeTotal=true` returns the account `total` so you can detect how many older messages are NOT visible. This covers the most-recent campaign(s) (each new send is the newest, always in-window); for full history beyond 100 messages use the campaign UI Analytics. No server-side time/status/`to` filter works → filter client-side by `createTime`/`type`.
- **Per-message fields:** `id`, `wamid`, `status`, `from`, `to`, `type` (text|template|…), `createTime`, `sendTime`, `deliverTime`, `readTime`, `totalPrice`, `pricingCategory` (`service`=free | `marketing` | `utility` | `authentication`); on failure `errorCode` + `whatsappApiError.{code,message}`.
- **Status enum:** `accepted → sent → delivered → read`, or `failed`. (`read` only if the recipient has read receipts on — "delivered" is the reliable floor.)
- **Single message:** `GET /v2/whatsapp/messages/{id}` (the YCloud `id`, NOT the `wamid`).
- **Aggregate a broadcast:** paginate all → group by `(createTime[:10], type, status)`. A UI campaign = the batch of `type:"template"` messages on its send date; split failures by `errorCode` (131026 undeliverable→remove vs 131049 throttle→retryable).
  ```bash
  curl -s "https://api.ycloud.com/v2/whatsapp/messages?limit=100&offset=0" -H "X-API-Key: <key>" \
    | jq '[.items[]|{d:.createTime[0:10],type,status}]|group_by(.d+.type+.status)|map({k:(.[0].d+" "+.[0].type+" "+.[0].status),n:length})'
  ```
- ⚠️ **Campaign-send LAG (critical — the `/messages` list is NOT real-time for campaigns):** messages sent via the console **campaign (bulk UI) do NOT appear in `/v2/whatsapp/messages` for HOURS** (likely a periodic sync, not minutes). Verified 2026-06: a Day-1 campaign was present in the list the next day, but a Day-2 campaign that showed **Completed and charged** was still entirely ABSENT from the list hours later. There is also **NO campaign/bulk API**: `GET /v2/whatsapp/bulkMessages/{id}` → 404, and the `?bulkMessageId=` query param is silently IGNORED (returns the full unfiltered list). **So `/messages` polling is real-time ONLY for API-direct (`sendDirectly`) sends** (those appear instantly). For **real-time CAMPAIGN monitoring use the campaign's UI Analytics/Logs tab** (immediate per-recipient status + the campaign ID is in the URL `…/bulkMessages/detail/…/{id}`) **OR subscribe to `whatsapp.message.updated` webhooks**. Use `/messages` polling for campaigns only as a delayed/next-day reconciliation, not for the freshly-sent batch.
- **Push alternative (better at scale):** subscribe to the `whatsapp.message.updated` webhook (`POST /v2/webhookEndpoints` with `enabledEvents:["whatsapp.message.updated"]`); tag each send with `externalId="<campaignId>:<recipientId>"` so events self-identify, and verify the `YCloud-Signature` HMAC (`t={ts},s={hex}`, signed payload `{t}.{body}.`). There is NO campaign-stats API — webhooks or list-polling are the only programmatic options; aggregate campaign numbers otherwise live only in the UI.
- **Rate limits:** 200 rps / 10,000 rph on reads; the free plan has no extra read restriction.

**Why BSP over Direct API:** BSP uses THEIR developer app — you never need a Meta developer account. This bypasses the SMS verification blocker that affects purchased/antidetect profiles. The Embedded Signup flow only requires Facebook login + BM admin access.

**Direct Cloud API without your own dev account (workaround):** A SECOND Facebook account (contractor/employee with working phone) registers as developer → creates a "Business" Meta App → adds it to your BM → you (BM admin) create a System User → install the app → generate token with `whatsapp_business_messaging`. The token generation itself does NOT need dev SMS verification — only the app creation does, which the second account handles. Cheapest long-term (zero markup), keeps existing WABA, full script control.

### Switching BSP / Migrating an Existing WABA

A WABA lives in the BM, NOT in the BSP. The BSP is just a connected partner (system user with API access). If a BSP suspends you or you want to switch:

**What survives the switch:** phone number, display name, approved templates, quality rating, messaging tier, OBA status.
**What does NOT survive:** message history, contacts/flows stored in the old BSP's dashboard, pending/rejected templates.

**Migration steps:**
1. **Reset/disable 2FA PIN first** (BM admin can do this WITHOUT the old BSP). The old BSP (e.g. YCloud) sets a 6-digit PIN you don't know — must disable it to re-register elsewhere.
   - Exact path (current WhatsApp Manager UI, 2026): `business.facebook.com → Gerenciador do WhatsApp → Números de telefone → select number → tab "Confirmação em duas etapas"` (it's a TAB in the row Insights | Perfil | Automações | Links da mensagem | **Confirmação em duas etapas** | ... — NOT a gear icon)
   - ⚠️ **GOTCHA 1: both "Desativar" and "Alterar PIN" buttons are GREYED/DISABLED until you enable 2FA on the Meta ACCOUNT.** The red warning "A autenticação de dois fatores é necessária para sua conta da Meta" is a hard gate (BMs with enforced 2FA requirement). You must enable account-level 2FA FIRST. Only then do the number-PIN buttons unlock.
   - Enabling account 2FA needs a phone (SMS/WhatsApp) or authenticator app.
   - ⚠️ **GOTCHA 2 (the real killer for purchased/antidetect profiles): the 2FA change itself can be BLOCKED by Meta's device-trust hold.** Message: "Você não pode fazer essa alteração no momento. Notamos que você está usando um dispositivo diferente do que costuma usar... Vamos permitir que você faça essa alteração após usar este dispositivo por um tempo." Meta won't allow security changes (2FA, password) on a freshly-accessed purchased profile in an antidetect browser. This cascades: can't enable 2FA → can't disable number PIN → can't migrate BSP.
   - **Mitigation: this is where profile warmup actually matters.** Profile warmup is NOT needed for WABA SETUP (creation/templates), but device/session trust IS needed for SECURITY CHANGES (2FA, password, PIN, BSP migration). Warm the antidetect profile (daily login + light browsing for several days) so Meta trusts the device, THEN security changes are allowed.
   - **Implication: if you might ever need to migrate BSP or change security settings, warm the profile early.** Don't skip warmup entirely just because WABA creation doesn't need it.
   - After account 2FA is on (device trusted) → click **"Desativar a confirmação em duas etapas"** to remove the number PIN. **Meta then sends a confirmation email to the admin's address — you MUST click the link in that email to complete the disablement.** Without clicking the email link, the PIN is NOT actually removed. Keep access to the admin email during migration.
   - Note: The two-step verification PIN **cannot be disabled via the API** — there is no API endpoint to remove the 2FA feature entirely. The API can only UPDATE the PIN value (`POST /{phone_number_id}` with `pin`). Full disablement requires the WhatsApp Manager UI + email confirmation only.

**If the connected BSP suspends you and you can't migrate (device-trust blocks the PIN reset):** the path of least resistance is recovering the original BSP account (support ticket), NOT forcing a migration. The number stays registered on the original BSP; if it recovers, you send without migration. Force migration only after the device gains trust.

**A BSP "account unavailable / suspended" is very often a FALSE-POSITIVE risk-control auto-flag, NOT a Meta ban — open a support ticket FIRST.** Confirmed real case (YCloud, 2026): account auto-suspended by their security system, recovered in <24h via a support ticket. Support's words on recovery: "your account was mistakenly blocked due to risk control, but it has now been unblocked." The recovery ticket that worked: account email + WABA ID + Phone Number ID + the dual ask ("restore access OR disable the 2-step PIN"). They then asked 3 legitimacy questions before restoring: **(1) Legal name (2) Business website (3) Business type** — answer these with the verified-business identity and the LOWEST-RISK truthful business category (e.g. "Education / educational content"), NOT a financial/investment framing (financial categories are what trip BSP risk-control in the first place; match your WABA profile category). Don't rush into an expensive/risky BSP migration before giving support a chance — migration is the fallback, not the first response to a suspension.

**Cleanest unblock when you DON'T know the PIN (old BSP set it):** ask the old BSP support to EITHER restore your account OR disable the two-step-verification PIN on the number from their side. The BSP that set the PIN can disable it server-side — this bypasses both the account-2FA gate and the device-trust hold entirely. Single best ask in a recovery ticket: "Restore access OR disable 2-step PIN on number X."

**NEVER guess the PIN.** Multiple wrong attempts lock the number for hours/days. If you don't know it and can't disable it (device-trust), don't brute-force — recover via the old BSP or wait for device trust.

**No access-token path to reset the PIN either:** Meta's API can set/reset the number PIN (`POST /{phone_number_id}` with `pin`), but that needs an access token — which needs the BSP (down) or your own dev app (blocked). So the API reset is also gated. The old-BSP-disables-it route is the realistic unblock.

**The NEW BSP's own migration wizard confirms this dependency (Gupshup, 2026):** Gupshup's "Create App" flow asks "How do you want to create your WhatsApp Business Account?" with two options — "New phone number" vs "Migrate a live phone number." The migrate option's own description states verbatim: **"Migrate from other BSP to Gupshup. Your existing BSP will need to disable 2FA to complete migration."** This is independent confirmation that a live-number BSP migration is HARD-GATED on the source BSP disabling two-step verification. The wizard steps are: 1. Let's Started (choose migrate + local storage region, USA default is fine) → 2. Contact Details → 3. Embedded Signup → 4. WABA Phone Selection → 5. Setup Complete. The block lands at step 4. Don't push through embedded signup just to "pre-stage" — it risks tripping fresh device-trust flags on the antidetect profile you're warming, and step 4 can't complete anyway. Stop at step 1, leave the wizard (it's resumable), unblock the PIN via the old BSP first.
2. New BSP → Embedded Signup → select existing BM → **select existing WABA** (not create new)
   - ⚠️ **A live WABA still "Conectado" to the OLD BSP will NOT appear in the new BSP's embedded-signup asset picker.** Meta hides a WABA already bound to one BSP from a different BSP's "share assets" dialog until it's released. Symptom (confirmed Gupshup, 2026): the picker offers only a stray WABA with a **+1 555-xxx-xxxx Meta test number** (auto-provisioned), and searching for your real display name returns nothing. This is the SIGNAL that your real number is still bound to the old BSP — NOT that the WABA was lost.
   - **Verify the WABA actually exists and where:** business.facebook.com → WhatsApp Manager → Telefones → open the WABA-account selector (top-right). It lists ALL WABAs in the BM with their IDs + connection status, regardless of BSP binding. A purchased BM often has 2+ WABAs (your real one + an empty/test one). Your real WABA shows status "Conectado" with the real number; the test WABA shows the +1 555 number.
   - **Don't connect the new BSP to the test WABA** — its +1 555 test number can only message ~5 pre-registered recipients (no real broadcast). Connecting to it wastes the slot and connects nothing useful.
   - **The fix is still releasing the number from the old BSP** (disable 2-step PIN / old-BSP support), after which the real WABA becomes selectable in the new BSP's picker.
3. OTP on the number → number's Cloud API registration moves to new BSP
4. Send

**Caveat — credit line:** if the WABA was created on the old BSP's credit line, you may need to migrate the number to a new WABA under the new BSP's credit line. Number/template/name still travel with it.

**Twilio exception:** Twilio creates a NEW WABA in your BM (doesn't slot into existing) — templates get re-reviewed, display name re-approved. Other BSPs (Gupshup, 360dialog) connect to the existing WABA directly.

**Diagnosing a suspension:** check the number in WhatsApp Manager. If it shows active/healthy there, the BSP (platform) suspended you, not Meta — the number is migratable. If Meta banned the number, no BSP switch fixes it (appeal via Meta Business Support).

### Phone Number Strategy (Brazil, 2025-2026)

**Two separate verifications require different number strategies:**

| Verification | Purpose | What works | What fails |
|---|---|---|---|
| Meta Developer account (Facebook SMS) | One-time SMS to verify developer identity | Physical SIM from major carrier (Vivo/Claro/TIM), carrier-grade eSIM | VoIP, virtual numbers, some MVNO ranges |
| WABA registration (OTP) | Register number on WhatsApp Business API | Physical SIM, eSIM, virtual numbers (Salvy), landline (voice call) | Numbers previously on any WhatsApp product |

**Meta Developer verification is the stricter one.** Meta actively blocks:
- VoIP numbers (Twilio, Vonage, RingCentral ranges)
- Known virtual number ranges
- Some MVNO number ranges (carrier-type identification)
- Rate-limited accounts: 24-48h cooldown after failed attempts

**WABA registration is more lenient.** Accepts mobile, landline (voice OTP), and virtual numbers built for the purpose. The critical requirement is the number has NEVER been on WhatsApp.

**Physical SIM requirements (Brazil, 2025+):**
- CPF + biometric validation required for all new prepaid activations
- 5-10 lines per CPF limit depending on carrier
- Factory-new SIM from carrier store recommended (avoid recycled numbers)
- Keep R$5-10 credit, 1 SMS every 60-90 days to prevent carrier recycling
- After WABA OTP, SIM role is done — but keep accessible 30+ days for re-verification

**MVNO range blocking:** MVNOs (virtual operators running on big carrier networks) get their own number ranges. Meta maintains a blocklist of ranges associated with spam/automation. If one number from an MVNO fails, all numbers in that range likely fail too.

**Salvy (Brazilian MVNO, Y Combinator W24):**
- Legitimate company, 5000+ businesses, 20k+ lines
- Three products: Physical Chip, eSIM (carrier-grade), Número Virtual Móvel
- eSIM = real carrier number (data + calls + SMS), range (11) 9362x
- Número Virtual Móvel = cloud DID, R$29.90/mês, exclusively for WhatsApp API
- The Número Virtual is built for WABA OTP (receives via webhook or voice redirect)
- The Número Virtual will NOT work for Meta Developer SMS verification (VoIP-type, blocked)
- The eSIM MAY work for Developer verification (carrier-grade) but MVNO range risk exists

**Recommended dual-number strategy:**
| Purpose | Best option | Cost |
|---|---|---|
| Developer verification | Physical SIM from Vivo/Claro/TIM (safest) or Salvy eSIM (cheaper, MVNO risk) | R$15-20 (SIM) or ~R$25/mês (eSIM) |
| WABA number | Salvy Número Virtual Móvel | R$29.90/mês |

**Can same number be used for both?** Yes, if using a physical SIM or eSIM. Developer SMS verification does NOT register the number on WhatsApp — it stays "virgin" for WABA. But using separate numbers is safer (isolation).

**Adding phone to purchased Facebook profile — risks:**
- Meta does NOT cross-reference carrier subscriber name vs profile name for SMS verification
- If the number is already a login contact on ANOTHER Facebook/Instagram account → hard block, cannot add
- Adding a number does NOT affect an existing WhatsApp consumer account on that number (separate systems)
- Do NOT merge WhatsApp into Accounts Center — just add as phone contact
- Number CAN be removed after developer verification (switch 2FA to authenticator first)
- Rate limiting: wait 24-48h after a failed verification attempt before trying a different number
- Failed number itself is rate-limited separately (don't retry the same number)

### Virtual Numbers for Brazil

| Provider | Type | Starting Cost | Works for Dev Verification? | Works for WABA? |
|---|---|---|---|---|
| Salvy Número Virtual | Cloud DID (WhatsApp API) | R$29.90/mês | No (VoIP-type) | Yes (built for it) |
| Salvy eSIM | Carrier-grade eSIM | ~R$25/mês | Maybe (MVNO risk) | Yes |
| Calilio | Brazilian mobile | $6/mês | Unknown | Possibly |
| JustCall | Regional DID | Custom | No (VoIP) | Possibly |

**Rule:** Numbers must have valid Brazilian DDD (area code). Many SMS-PVA services provide pre-flagged numbers. Always prefer carrier-grade (SIM/eSIM) over VoIP for any Meta verification.

### Measuring Success

| Metric | Healthy | Warning | Critical |
|---|---|---|---|
| Delivery rate | >95% | 90-95% | <90% |
| Read rate | >70% | 50-70% | <50% |
| Block/report rate | <2% | 2-5% | >5% |
| Quality rating | Green | Yellow | Red (tier downgrade) |
| Open rate | >96% | 90-96% | <90% |
| CTR (link in template) | >15% | 5-15% | <5% |

**Industry benchmarks (2026):**
- Open rate: 96.7-98.2% (well-optimized: ~99%)
- CTR: 15-45% (well-optimized: 25-35%)
- Conversion rate: 5-10% (top performers: up to 18%)
- Delivery rate: 95-99% (well-optimized: 99%+)

**If quality drops to yellow:** stop broadcast, review template content, reduce volume, wait 6h evaluation cycle.
**If quality drops to red:** pause all marketing, switch to utility-only for 7+ days, may need to ramp up tier again.

### Quality Rating Recovery Protocol

1. Pause ALL broadcasts immediately
2. Identify and disable poorly performing templates
3. Clean contact list: remove non-engaged, non-opted-in
4. Wait 7 days for quality score recalculation
5. Resume gradually: best templates → most engaged contacts only
6. If quality holds at Green/Yellow for 7 days: status returns to Connected

### Cost of a Ban Cycle

| Item | Cost |
|---|---|
| New balloon BM | $19-59 USD |
| New profile (primary) | R$216 |
| New profile (backup) | R$18 |
| Proxy (ongoing) | ~R$30/mês |
| Setup time lost | 2-4 days (no profile warmup needed for dispatch BMs) |
| Total replacement | ~R$400-600 + time |

### Burn and Replace Pattern

1. BM banned → all WABA numbers under it deactivated simultaneously
2. Discard banned BM (non-recoverable in balão strategy)
3. Buy new balloon BM ($19-59)
4. If profile survived: reuse with new BM. If not: buy new profile, rewarm
5. Reattach warmed profile to new BM
6. Transfer learnings (template text, contact segments, timing data)
7. Restart from Phase 3 in setup sequence

**Key insight:** Template performance data, contact segment insights, and timing optimizations survive the burn. Only the infrastructure dies.
