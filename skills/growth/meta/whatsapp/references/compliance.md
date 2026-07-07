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

## Business Profile Compliance (Financial Niche)

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

**The "surface area" myth:** more profile info = more consistency signals, not more attack surface. The real risk in a disposable BM is messaging behavior (spam, opt-ins, volume), not profile text. Write clean copy, don't leave fields empty.

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

---

## Business Profile & Verification (WhatsApp)

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
- OBA badge application via BSP only (not self-service via WhatsApp Manager — unlike standard WABA setup which is self-service)
- Rejection: must wait 30 days before reapplying
- **Note:** As of mid-2024 (announced at Meta Conversations Conference, June 2024; rolled out through 2024-2025), the OBA badge is blue (not green), aligning with Facebook and Instagram verification symbols. Existing green badges converted automatically.
