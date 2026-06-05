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

