## Contents

1. [Overview](#overview)
2. [Supported Objectives](#supported-objectives)
3. [Setup Flow](#setup-flow)
4. [72-Hour Free Window](#72-hour-free-window)
5. [Attribution: ctwa_clid](#attribution-ctwa_clid)
6. [CTWA vs Landing Page](#ctwa-vs-landing-page)
7. [Cost Per Conversation by Country](#cost-per-conversation-by-country)
8. [WhatsApp Marketing Messages in Ads Manager](#whatsapp-marketing-messages-in-ads-manager)
9. [Remarketing via WhatsApp Contacts](#remarketing-via-whatsapp-contacts)

---

## Click-to-WhatsApp Ads (CTWA)

### Overview

CTWA ads on Facebook/Instagram feature a "Send Message" CTA that opens WhatsApp chat directly. No landing page needed. Available in feed, stories, reels, and WhatsApp Status (new 2025).

### Supported Objectives

| Objective | Best For |
|---|---|
| Engagement (recommended) | Maximize conversation volume, lead gen |
| Leads | Replace lead forms with conversation |
| Sales/Conversions | Purchase-intent (requires CAPI to close loop) |
| Traffic | Multi-channel campaigns via wa.me link |

### Setup Flow

1. Create campaign → select Engagement objective
2. Ad Set → conversion location: **WhatsApp**
3. Link Facebook Page + select WhatsApp Business number
4. Configure welcome message (auto-fill or pre-filled) + quick reply buttons (up to 4)
5. Build creative: image/video + headline + primary text

### 72-Hour Free Window

When user contacts via CTWA ad, ALL messages (including marketing templates) are free for 72 hours from first response. This is the key economic advantage over cold broadcast.

### Attribution: ctwa_clid

When a user messages via CTWA ad, the WhatsApp webhook includes `referral.ctwa_clid` — this is the attribution key. Store it mapped to phone number (Redis, 90-day TTL).

To attribute conversions back to the ad:

```typescript
// CAPI payload for WhatsApp conversion
{
  event_name: "Purchase",
  action_source: "business_messaging",
  messaging_channel: "whatsapp",
  user_data: {
    whatsapp_business_account_id: WABA_ID,
    ctwa_clid: storedCtwaClid,
    ph: [hashedPhone]
  },
  custom_data: { value: 129.99, currency: "USD" }
}
```

Without CAPI + `ctwa_clid`, WhatsApp conversions are a black hole — Meta only sees "conversation started", never revenue.

### CTWA vs Landing Page

| Dimension | Landing Page | WhatsApp Direct |
|---|---|---|
| CVR | Baseline | 2-3x higher |
| CAC | Baseline | 30%+ lower |
| Qualification | Form fields pre-qualify | Requires chatbot/human |
| Response time | Async | Real-time expected (<5 min) |

### Cost Per Conversation by Country

Example calculations (Meta ad → WhatsApp chat initiated):

| Country | CPM | Est. CPC | 60% chat rate | Cost/conversation |
|---|---|---|---|---|
| India | $2.60 | $0.20 | $0.33 | + $0 (72hr free) |
| Pakistan | $2.20 | $0.19 | $0.32 | + $0 (72hr free) |
| Bangladesh | $2.00 | $0.16 | $0.27 | + $0 (72hr free) |
| Philippines | $3.50 | $0.28 | $0.47 | + $0 (72hr free) |
| Thailand | $3.90 | $0.40 | $0.67 | + $0 (72hr free) |
| Indonesia | $2.80 | $0.18 | $0.30 | + $0 (72hr free) |
| Malaysia | $4.80 | $0.55 | $0.92 | + $0 (72hr free) |
| Brazil | $4.20 | $0.35 | $0.58 | + $0 (72hr free) |

Follow-up marketing templates (after 72hr) add per-message costs (see `whatsapp` skill for rates).

### WhatsApp Marketing Messages in Ads Manager

→ Moved to `api-and-campaigns.md`.

### Remarketing via WhatsApp Contacts

→ Moved to `audiences.md`.

---

