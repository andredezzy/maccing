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

**Retention of consent records (Brazil):** Article 8 §2 of the LGPD puts the burden of proof on the
controller — "cabe ao controlador o ônus da prova de que o consentimento foi obtido em conformidade
com o disposto nesta Lei" — so the records above are evidence you have to be able to produce.
**The LGPD sets no retention period for them.** Art. 16 requires elimination after processing ends
while allowing retention to comply with a legal or regulatory obligation; art. 37 requires a record
of processing operations without saying how long to keep it; art. 40 lets the ANPD set retention
times for records, and for this it has not. Five years, two years, any number: that is somebody's
risk judgement, not a statutory floor. Set one with your own counsel, write down the reasoning, and
apply it consistently — a documented, defensible policy is what art. 6 X (responsabilização e
prestação de contas) actually asks for. ([Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm))

**Does an email or SMS consent cover WhatsApp?** Treat it as not covering it, on two grounds of very
different strength. The platform ground is verifiable and decisive: Messaging Policy §1 requires
"opt-in permission from the recipient confirming that they wish to receive subsequent messages or
calls from you" — permission for WhatsApp, whatever another channel's list says. The statutory
ground is narrower than it is usually stated: the LGPD has no channel rule, but art. 8 §4 voids
generic authorisations and requires consent to refer to determined purposes, and art. 6 I forbids
later processing incompatible with the purposes the person was told about. A consent collected for
email marketing does not obviously survive that test when reused for WhatsApp outreach.
**Claims that "ANPD guidance requires separate WhatsApp-specific consent" are unverified** — no
published ANPD resolution or orientation guide says so. Re-consenting an email-only list before
WhatsApp outreach is the conservative reading and the one this skill recommends; it is not a rule
anyone has written down.

### Opt-Out Handling

Recognize and honor: STOP, UNSUBSCRIBE, CANCEL, OPT OUT, NO, PARAR, SAIR.

**Required actions upon opt-out:**
1. Immediately confirm opt-out via final message
2. Stop all promotional sends **immediately**, and do not budget a grace window, because no statute
   or regulation grants one. LGPD art. 18 §4 assumes the measure is adopted immediately and only
   permits a reply explaining why immediate action is impossible; art. 8 §5 makes revocation
   effective on the person's express manifestation, through a free and facilitated procedure.
   Art. 18 §5 defers the actual deadline to a regulation, and Resolução CD/ANPD nº 2/2022 art. 14 I
   still refers to that regulation as forthcoming ("nos termos de regulamentação específica"), so it
   does not yet exist. The 15-day figure in art. 19 II is for a complete access declaration, not for
   an opt-out. **Anyone quoting you 24 or 48 hours for a WhatsApp opt-out is quoting nothing.**
3. Record timestamp and source of opt-out
4. Add to suppression list
5. Honor it indefinitely, and keep the suppression entry for as long as you keep the contact. There
   is no floor and no expiry in either direction — WhatsApp policy states none and neither does the
   LGPD. An opt-out that lapses is a permission you never obtained: Messaging Policy §1 requires you
   to "respect all requests (either on or off WhatsApp) by a person to block, discontinue, or
   otherwise opt out of communications from you via WhatsApp", with no end date, and Business Terms
   §4 repeats the obligation. The "two years" that used to sit here was never a rule.

**Platform-level opt-out:** WhatsApp exposes an **Offers and announcements** setting through which a
user can stop or resume delivery of your marketing templates without sending a keyword. Subscribe to
the **`user_preferences`** webhook field to receive those signals. It fires on `stop` and `resume`
only — the *Interested* / *Not interested* feedback in the same setting does **not** trigger it —
and each entry carries `wa_id`, `category: "marketing_messages"` and a `value` of `stop` or
`resume`. Send anyway and the API accepts the request without delivering: the status webhook returns
`failed` with code **131050**.

**This toggle is the one opt-out the user can take back, and it is narrower than it looks.** Suppress
marketing to that `wa_id` on `stop`, and lift the suppression only when a `resume` arrives on the
same webhook — never on a timer, and never because a campaign wants the audience back. Two things
follow. First, the signal is category-scoped: `category` is `marketing_messages`, so utility and
authentication templates and 24h service-window replies are unaffected and should keep flowing.
Second, this is **not** the opt-out in step 5 above. A person who sends you STOP has withdrawn
permission to hear from you; nothing in Meta's UI reverses that, and only the person can, by opting
in again. Keep the two suppressions in separate fields — a platform `resume` must not clear a
keyword opt-out, which is the failure that quietly re-messages someone who told you to stop.
([user_preferences reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/user_preferences),
[marketing templates → user preferences](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates))

**`MARKETING_SUBSCRIPTION_UPDATE` is not a Meta webhook field.** It is Infobip's own event name, for
Infobip's Subscriptions API. Against Cloud API that string subscribes to nothing, and an integrator
who wires it receives no opt-out signals at all — a compliance failure and a deliverability one at
the same time. This file named it until it was corrected; do not let it back in.

### Anti-Spam Policies

- **Per-user marketing limits are adaptive, and two separate codes report them.** The ceiling Meta applies to each recipient moves with that person's recent marketing activity, so no fixed daily figure is worth planning against, and a marketing send can also fail because the recipient falls inside Meta's experiment holdout. Both reach you as an undelivered marketing template: **131049** for the per-user limit, **130472** for the holdout. This rule is owned by `sending-and-scale.md` → **Best Practices for High-Volume Sending**, item 5, which carries Meta's quoted definition of the ceiling and the regional carve-outs. Keep the detail there rather than restating it here.
- Do not send the same message repeatedly to the same user
- Messages must match the category they're submitted under
- Do not confuse, deceive, mislead, or surprise users

**Account protection:**
- Monitor spam report rate: >2% triggers quality degradation
- Monitor block rate: sudden spikes trigger manual review
- Maintain a deliverability ratio above 90%

### GDPR & Regional Compliance

**This table routes; it does not rule, and none of it is legal advice.** Each cell names the regime
that applies and the obligation area it lands in — not what that regime requires of your business,
which turns on your entity, your legal basis and your actual processing, and which only counsel in
that jurisdiction can settle. Where a figure or a deadline appears below it is quoted from the named
text and linked; where the text is silent, the cell says so rather than supplying a number.

| Region | Key Requirement |
|---|---|
| EU/EEA | Data Processing Agreement (DPA) with BSP; EU data residency option. Note that the consent standard for unsolicited electronic marketing comes from each member state's ePrivacy implementation, not from the GDPR alone, so "explicit GDPR consent" is not a single answer — confirm the local rule |
| Germany | BSP must have EU data residency and DPA |
| India | Comply with DPDPA (Digital Personal Data Protection Act) |
| Brazil | LGPD ([Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)). **What the statute says:** consent must be free, informed and unequivocal and refer to determined purposes, and generic authorisations are null (arts. 5 XII, 8 §4); the controller bears the burden of proving valid consent (art. 8 §2); consent is revocable at any time by a free and facilitated procedure (art. 8 §5); art. 7 lists ten legal bases besides consent, including execution of a contract to which the person is a party (art. 7 V) — which one fits a given message is a question for counsel, not a default; a simple fine reaches **2% of the private entity's revenue in Brazil in its last financial year, excluding taxes, capped at R$ 50,000,000 per infraction** (art. 52 II). **What the statute does not say:** any retention period for consent or opt-out records, and any deadline for processing an opt-out — art. 18 §5 leaves that deadline to a regulation the ANPD has not issued. **Enforcement predates 2025:** the ANPD's first private-sector sanction (DOU 06/07/2023, Telekall Infoservice) fined a company for offering a list of WhatsApp contacts with no legal basis for the processing (art. 7) — the cold-list case exactly |
| US | Meta's [per-user marketing limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/per-user-limits) page states that WhatsApp "does not currently deliver marketing template messages to WhatsApp users with United States phone numbers". Meta announces no end date and has never called it permanent; its own word is *currently*. Rollout was 1 April 2025 according to BSP notices at the time — Meta's current page carries a dangling "after this date" with the date itself edited out, so do not attribute that date to Meta. Utility and authentication templates and 24h service-window replies are unaffected. US telemarketing law (TCPA and successors) is a separate regime from WhatsApp opt-in and is not settled by it — take local advice |

**2026 AI restriction:** General-purpose AI chatbots are prohibited on WhatsApp. Only task-oriented automation with predictable, business-specific outcomes is allowed (support, booking, order processing).

### Content Restrictions

- No full payment card numbers in messages
- No government ID numbers in messages
- No passwords or security credentials
- No prohibited products (varies by country — check Meta's Prohibited Content policy)
- No misleading business identity

---

## Business profile compliance

**Check Messaging Policy §4 before provisioning anything.** If the business model sits in a
restricted vertical, no wording on the profile makes it eligible, and Meta says so explicitly:
the prohibitions apply "irrespective of the global or local licenses, registrations, or other
approvals your business may hold." A local authorisation is not a defence, and neither is a
profile that describes the business carefully. Establish eligibility first; everything below is
about a business that is already allowed to be there.

**The profile IS reviewed** — reactively, when the account is flagged for any reason at all
(spam reports, a volume spike, blocks), not proactively the way templates are. Meta's terms:
"WhatsApp may review, remove, or delete Company Content you share on your business profile." A
profile that contradicts the WABA category becomes evidence of deception during that review.

**Category, About and Description must tell one coherent story.** A category of "Education"
against a description promising managed returns is not two separate risks; it is one compounding
one, and the mismatch is what a reviewer sees first.

**Where the wording genuinely is the risk, the sector's own regulator decides that, not Meta.**
Which claims require a licence, and which verb turns a description into a regulated activity, is
jurisdiction-specific and changes. That mapping belongs with the project that operates under it,
beside its legal advice — not in a portable skill, which cannot keep it current and has no
standing to give it.

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
