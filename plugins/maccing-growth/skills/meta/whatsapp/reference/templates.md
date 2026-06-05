## Contents

- [Template Categories](#template-categories)
- [Template Components](#template-components)
- [Creating a Template (API)](#creating-a-template-api)
- [Sending a Template Message](#sending-a-template-message)
- [Template with Image Header](#template-with-image-header)
- [Template with Currency / Date-Time Parameters](#template-with-currency--date-time-parameters)
- [Authentication Template](#authentication-template)
- [Template Approval Process](#template-approval-process)
- [Template Limits & Quality](#template-limits--quality)
- [Template Pacing vs. Template Pausing](#template-pacing-vs-template-pausing)
- [Template Strategy for Marketing Broadcast](#template-strategy-for-marketing-broadcast)

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

---
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

