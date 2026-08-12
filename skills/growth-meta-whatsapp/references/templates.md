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
| **Utility** | Order updates, shipping, account alerts | Charged outside CSW; free inside CSW **until 1 October 2026**, charged from that date | Volume discounts apply |
| **Authentication** | OTPs, login codes, 2FA | Charged; lowest domestic rate | **Charged even inside CSW** (unlike Utility, which is free inside CSW only until 1 Oct 2026); auth-international rates apply cross-border in some markets |

> **Service messages** (non-template free-form replies within a CSW) are NOT a template category — they are any message type (text, image, interactive, etc.) sent to a user who has an open CSW, and they do not require template approval. They can only be sent within an open window. Free since November 1, 2024, but **charged per message from 1 October 2026**, at the same per-market rate as utility and authentication templates and with no volume tier ([Pricing for non-template messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages)). See `pricing-and-billing.md`.

**Critical:** Marketing templates to US phone numbers are **not delivered** as of April 1, 2025. Meta describes this as a **temporary pause** (not a permanent policy) — the stated intent is to assess when the US market is ready. As of mid-2026, no end date has been announced and the pause remains fully in effect. Error returned: `131049`. Do not plan on US marketing sends until Meta formally lifts it.

### Template Components

```
Header (optional): text (max 60 chars, 1 variable) | image | video | document | location
Body (required): up to 1024 chars, variables as {{1}}, {{2}}, ...
Footer (optional): static text, max 60 chars
Buttons (optional): up to 10 buttons total, with per-type and grouping limits
  - URL button: opens a link (supports dynamic URLs with variable); max 2 per template
  - Phone call button: dials a number; max 1 per template
  - Quick reply button: sends a predefined text; max 10 per template
  - Copy code button (authentication only); max 1 per template
  - One-tap autofill button (authentication only; **Android-only** — iOS users see a copy code button fallback automatically)
  - Button label text: max 25 chars each
  (4+ buttons, or a quick reply mixed with another type, cannot be viewed on WhatsApp desktop
   clients; beyond 3 buttons WhatsApp collapses the rest behind "See all options")
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
| Time | Meta: **up to 24 hours** for an approval decision ([Template review → Approval process](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-review)). *Unverified:* the "complex content up to 48 hours" figure — Meta publishes no 48-hour tier. |
| Status | `PENDING` → `APPROVED` / `REJECTED`; post-approval quality states: `ACTIVE` (High/Medium/Low quality) → `PAUSED` → `DISABLED`; after appeal: `APPEAL_REQUESTED` |
| Appeal | Edit and resubmit — Approved templates allow 1 edit per 24-hour window and 10 per 30-day window; rejected and paused templates have unlimited edits ([Template management → Edit template limitations](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management#edit-templates)). Or file an appeal in WhatsApp Manager → the template → edit → **Add Sample** → Submit; appeals must include a sample. Meta: **the appeal is decided within 24 hours** ([Template review → Appeals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-review)). *Unverified:* the "24–72h" range and the "template name cannot be reused for 30 days after rejection" rule — neither appears in Meta's documentation, which only requires that names be unique per WABA per language. |
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

- Max **250** templates per WABA when the parent business portfolio is **unverified**; max **6,000** when the portfolio is verified **and** at least one of its WABAs has a business phone number with an approved display name ([Template fundamentals → Template limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview#template-limits))
- *Unverified:* that paused and rejected templates do not count toward that limit. Meta's limit text carves out no exceptions — do not plan around it.
- Templates are paused automatically when quality drops (blocks, spam reports, low read rates). **Two different mechanisms pause a template and they do not recover the same way** — see "Template Pacing vs. Template Pausing" below:
  - **Quality-ladder pause** — the template's quality rating hits `RED` (*Active – Low quality*). 1st instance: 3-hour hold. 2nd: 6-hour hold. 3rd: `DISABLED`. These **auto-resume**; the template returns to Active on its own and its quality rating is recomputed from recent feedback ([Template pausing](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing)).
  - **Pacing pause** — negative early feedback during template pacing. This one **does not auto-resume**. Meta: "templates paused during Template Pacing must be manually unpaused (API or WhatsApp Manager) before they can be used again."
- **Unpause path for a pacing pause:** `POST /{whatsapp_message_template_id}/unpause`, or WhatsApp Manager → the template → the **manually unpause it** link ([Template pausing → Unpausing](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing)).
- A paused template cannot be sent: the API rejects the attempt, you are not charged for it, and it does not count against your messaging limit.
- `DISABLED` templates can be **edited and resubmitted** (returns to In Review, can be restored to Active — you do NOT need to create a brand-new template)
- Template quality is reported as `GREEN` / `YELLOW` / `RED` / `UNKNOWN`, derived from usage, customer feedback and engagement ([Template quality rating](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-quality)). *Unverified:* the "rolling 7-day feedback window" — Meta names the signals but publishes no window length.
- Edit limits apply only to **Approved** templates: up to 1 edit per 24-hour window, up to 10 edits per 30-day window. **Rejected and paused templates have unlimited edits.** Only `APPROVED`, `REJECTED` and `PAUSED` templates can be edited at all, and the category of an approved template cannot be changed ([Template management → Edit template limitations](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management#edit-templates)).
- After editing any Approved template (including 0-send ones), it returns to 'In Review' and **cannot be sent** until re-approved (Meta: up to 24h). Do not edit a template actively scheduled for an imminent broadcast.
- You can retrieve template status via: `GET /{WABA_ID}/message_templates`

### Template Pacing vs. Template Pausing

Meta uses two overlapping quality-control mechanisms. **The difference that matters operationally is how each one ends.**

**Template Pacing** (proactive, at campaign start) — [Template pacing](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pacing):
- Applies to marketing and utility templates: newly created templates, templates that were just unpaused, and templates without a `GREEN` quality rating. Utility templates are paced only once you have already had a utility template paused, and then only for the following 7 days.
- Messages send normally up to an unspecified threshold; past it, the send response carries `message_status: held_for_quality_assessment` and the remaining messages are held pending early customer feedback.
- Positive early feedback → held messages are released and sent normally.
- Negative early feedback → **the template's `status` is set to `PAUSED`**, a `message_template_status_update` fires with event `paused`, and every held message is dropped with a `messages` webhook carrying `"status":"failed"` and `"code":"132015"`. A 132015 pacing drop **is** a PAUSED template, not a separate silent state — and it is the pause that must be unpaused by hand.
- Meta publishes no fixed hold duration. Its stated guardrail is that even paced messages from the highest-throughput campaigns are delivered within an hour (99th percentile), and that if the guardrail is hit before feedback lands, the held messages are released normally.
- *Unverified:* the "30-minute hold" and the "portfolio-level pacing for accounts sending <500k templates/year" figures. Neither appears in Meta's pacing documentation.

**Template Pausing** (reactive, accumulating quality failures) — [Template pausing](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing):
- Triggered when a template's quality rating reaches `RED` (*Active – Low quality*).
- 1st instance: 3-hour pause. 2nd: 6-hour pause. 3rd: `DISABLED`. These **auto-resume** when the timer expires.

**Key distinction — recovery, not just timing.** A quality-ladder pause clears itself; a pacing pause never does. If a campaign stalls with 132015 errors, read the template's `status`: if it is `PAUSED`, call `POST /{whatsapp_message_template_id}/unpause` or click **manually unpause it** in WhatsApp Manager. Waiting for a 3-hour timer will not help, because no timer is running.

---

---
### Template Strategy for Marketing Broadcast

**Categories (post-April 2025: auto-reclassification):**
- Marketing: broadcasts, welcome, community updates, content announcements. **$0.0625/msg** to Brazil recipients (Meta list rate, verified 2026-08-10 — see `pricing-and-billing.md`)
- Utility: transactional only (order confirm, event reminder for registered user). **$0.0068/msg** to Brazil recipients outside CSW; **free** inside a 24h CSW **until 1 October 2026**, charged at the same $0.0068 from that date
- Authentication: OTPs only. **$0.0068/msg** to Brazil recipients (charged even inside CSW — unlike utility today)
- Service: non-template replies within the 24h customer window. **Free**, unlimited and uncapped since Nov 1 2024 — **until 1 October 2026**, after which each one is charged at the market's utility/authentication rate with no volume tier
- Since April 2025 Meta auto-corrects miscategorised templates, but **the two directions have different consequences** ([Template categorization → automatic category updates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization#automatic-category-updates)):
  - **Utility that should be Marketing:** no rejection. After 1 day's notice the category flips to `MARKETING`, status stays `APPROVED`, and you simply pay the higher rate. You have 60 days to request a review. If your WABA has already been warned for categorisation misuse, the flip is instant with no notice.
  - **Marketing or Utility that should be Authentication:** the template is **set to `REJECTED` on the first day of the following month** and can no longer send. **You cannot request a category review for this case** — Meta's guidance is to build a replacement from the Template Library *before* the rejection lands.
  - Repeat misclassification escalates: written warning → utility volume rate-limiting on the WABA (minimum 7 days) → every approved utility template on the WABA recategorised to marketing with utility creation disabled (7 days, 30 for repeat violations) → the same across every WABA in the business portfolio (30 days).
  - Never try to sneak marketing into utility.

**Template structure:**
- Variable format: positional `{{1}}`, `{{2}}` — sequential, no gaps. Named parameters (`{{first_name}}`, lowercase + underscores) are also supported via `parameter_format: "named"` at creation; positional is the default if you omit it ([Template fundamentals → Parameter formats](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview#parameter-formats)). Pick one per template.
- Template CANNOT start or end with a variable
- Min 3 words of static text per variable
- Always provide sample values at submission
- Body: max **1,024 characters**. Meta documents the same 1,024-character body limit for marketing and utility templates ([Template components → Body](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components), [Utility templates → BODY_TEXT](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/utility-templates/utility-templates)); authentication bodies are not free-form at all and come from the [Template Library](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-library). *Unverified:* the "512-char cap on Utility and Authentication, enforced since October 1 2025, error 2388040" — it contradicts Meta's current utility-template reference, which still states 1,024. Meta does say "the body component will have different character limits depending on the format and tag of the template" without publishing the variants, so treat 512 as an unconfirmed field observation, not a documented rule. **Target under 300 chars** for marketing (scroll = -35% read rate).
- **"Read more" / "Leia mais" truncation is a CONVERSION issue only, not a policy risk.** Templates exceeding ~160 chars trigger the fold in WhatsApp UI. This does NOT affect approval, quality rating, or ban probability. Shorten only if A/B data shows truncation hurts CTR for your audience.
- Header text: max 60 chars, 1 variable allowed, no emojis
- Footer: max 60 chars, no variables, no emojis
- Button label text: max **25 chars** each for URL, quick-reply and phone-number buttons ([Template components → Buttons](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components)). The 20-character limit belongs to the *copy-code button's code string*, not to button labels.
- Template names: **lowercase + underscores only** (no spaces, hyphens, capitals)

**Image header strategy:**
- Image headers increase engagement (visual stopping power + brand legitimacy)
- Use **dynamic variable** in header — swap image per send without resubmitting template
- Specs: **800x418 px (1.91:1)**, JPG/PNG, under 200 KB
- Style: clean branded graphic (logo + community name), dark/brand-color background
- Do NOT use: charts implying performance or outcomes, income/result claims, text-heavy overlays, generic stock photos
- Load time: irrelevant in Brazil (WhatsApp CDN precompresses)
- Approval: image does not meaningfully increase rejection risk vs text-only. Meta states an approval decision takes **up to 24 hours** regardless of category ([Template review](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-review)); the folklore that marketing is slower, or takes 24–48h, is field observation and is *unverified*.

**Copywriting best practices (WhatsApp Brazil):**
- Structure: **Hook → Value → CTA** (compressed AIDA, not PAS)
- Length: under 300 characters body. 3-4 short lines max. No padding, no "esperamos que esteja bem"
- Tone: informal, direct, conversational (como amigo mandando mensagem). NEVER "prezado cliente"
- Emojis: 2-4 max, functional not decorative. Use 📈 📊 🎯 💡 for educational or progress-tracking content. Avoid 🔥🔥🔥
- Urgency: social proof > pressure words. "Mais de [N] membros já participam" > "NÃO PERCA"
- Voice: second person ("você"), brand as guide, user as protagonist
- CTA button: verb + specific outcome ("Entrar no grupo" > "Saiba mais")
- **Shorten by cutting filler words, never by removing letters or using weird spacing.** Character-level obfuscation (e.g., "gr@tis", "o-f-e-r-t-a", dots between letters) is read by Meta classifiers as filter-evasion and increases rejection probability. Cut entire sentences or phrases instead.

**Forbidden words/phrases (Portuguese):** documented template-review rejection triggers, not style preferences.
- Hard reject: grátis, imperdível, compre agora, ganhe dinheiro, renda extra, duplique seus ganhos, invista agora, lucro garantido, retorno garantido, clique aqui agora, oferta por tempo limitado, não perca, PIX grátis, bônus
- Safe alternatives (same intent, no trigger): conteúdo exclusivo, aula, encontro ao vivo, desafio, missão da semana, comunidade, grupo, membros, novidade, acesse, confira, saiba mais, disponível para você, sua jornada, conteúdo liberado, ao vivo hoje

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
4. Every new template is subject to template pacing: sends run normally up to a threshold Meta deliberately leaves unspecified, then hold for early feedback, and bad signals set the template to `PAUSED` (which then needs a manual unpause). *Unverified:* the "~1k recipients" test-batch figure — Meta publishes no number.

**Approval process:**
- Automated systems first, with manual review for borderline cases; Meta commits to a decision within 24 hours
- *Unverified:* "New WABA + Marketing + restricted-category content = 48-72h." Meta publishes only the up-to-24-hour figure; longer waits are field observation.
- Status "Active-Quality pending" = APPROVED, can send now; quality rating computed after sends
- Rejection gives brief reason code (INVALID_FORMAT, TAG_CONTENT_MISMATCH, ABUSIVE_CONTENT, PROMOTIONAL)
- Rejected templates can be edited and resubmitted (the name may be kept — names only need to be unique per WABA per language)
- Max 250 templates per WABA under an unverified business portfolio, 6,000 under a verified portfolio with an approved display name
- No strict submission limit, but repeated rejections flag your account
- *Unverified field heuristic, not Meta policy:* "stuck in review >48h = yellow flag, >72h = red flag (delete + resubmit with a minor change forces a fresh ticket)". Meta's published figure is a decision within 24 hours.
- **Editing a template with 0 sends carries zero quality risk** — there is no quality score to lose before the first send. Edit limits apply **only to Approved templates**: 1 edit per 24-hour window, 10 edits per 30-day window (rolling, not calendar month). Rejected and paused templates have **unlimited edits** ([Template management → Edit template limitations](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management#edit-templates)). After editing any Approved template (even 0-send), it returns to 'In Review' and **cannot be sent** until re-approved (up to 24h) — do not edit a template actively scheduled for an imminent broadcast. Edits do not affect the WABA-level quality rating.
- **HTTPS URL requirement (effective January 1, 2026):** Any template containing a URL — in body text or CTA buttons — must use a valid, verifiable HTTPS URL. Blocked: HTTP URLs, bit.ly/tinyurl shorteners, bare domains without https://, unreachable or login-gated pages. Templates are rejected at creation with a descriptive error. This makes the domain-redirect strategy even more critical: your redirect domain (e.g., yourdomain.com/grupo) must be a live, publicly accessible HTTPS endpoint.

