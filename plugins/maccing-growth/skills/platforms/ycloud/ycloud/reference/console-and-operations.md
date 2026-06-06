## Contents

1. [Account Creation / Onboarding (per BM)](#account-creation--onboarding-per-bm)
2. [What You Can and Cannot Automate](#what-you-can-and-cannot-automate)
3. [Dashboard Backend API (session-cookie, reached via the AdsPower profile over CDP)](#dashboard-backend-api)
4. [Auto-unsubscribe chatbot (keyword opt-out, dashboard UI only)](#auto-unsubscribe-chatbot)
5. [BSP Options (if not using Direct API)](#bsp-options)
6. [BSP / Platform Comparison](#bsp--platform-comparison)
7. [Pricing Model Notes](#pricing-model-notes)
8. [YCloud Campaign Send File Format and Campaign-API-Lag Gotchas](#ycloud-campaign-send-file-format-and-campaign-api-lag-gotchas)

---

## Account Creation / Onboarding (per BM)

Creating the YCloud **account** (login + company) is a SEPARATE step from WhatsApp **Embedded Signup** (connecting a WABA/number). One YCloud account **per disposable BM**, created **from that BM's own AdsPower profile** (its isolated proxy) — never a clean host browser, never shared across BMs (a shared account is a single point of failure; YCloud has false-positive-suspended financial-niche accounts).

**Prereqs before the form**
- **Account email — separate per BM; prefer a domain email.** Must differ from every other BM's YCloud account. Disposable temp inboxes (`*.justwork.email`, etc.) risk non-delivery or being rejected as disposable → register the BM's throwaway brand domain and use a forwarded **catch-all** address. Pick the forwarding method by where the domain's DNS actually lives (check the nameservers): **Namecheap BasicDNS → Namecheap free Email Forwarding** (keep BasicDNS); **Cloudflare nameservers → Cloudflare Email Routing** (free — enable it, Cloudflare auto-adds the MX/TXT, then route `*@brand.tld` → a real inbox). Either way the email MX coexists with the site's A/CNAME (web) — different record types, no conflict. Isolation-safe: the visible address is on the throwaway brand domain; the forwarding TARGET is invisible externally.
- **A burner WhatsApp number** to receive the signup code — see step 2.

**The signup wizard (5 steps, observed 2026-06)**
1. **Create your free account** — Work email, First/Last name, Password, hCaptcha, accept Terms → Continue.
2. **⚠️ The account-verification code is delivered as an in-app WhatsApp MESSAGE** (not email, not SMS). The receiving number must be a LIVE WhatsApp account you can read, and must be **neither** (a) any other BM's WhatsApp (reuse/linkage) **nor** (b) the fresh chip reserved for THIS BM's WABA — receiving any WhatsApp on a number permanently disqualifies it from WABA registration (a WABA number must never have been on WhatsApp). **Workaround (field-verified):** on a secondary handset, register a NEW disposable WhatsApp using a cheap **online SMS-activation** number (the OTP site catches WhatsApp's *registration* SMS), then read YCloud's signup code inside that disposable WhatsApp. Keeps both the other BMs' WhatsApp and the WABA chip pristine. (Online "receive-WhatsApp-OTP" rental sites alone do NOT solve it — they're built for WhatsApp *registration*, not for receiving the YCloud message; pairing one with a real handset is what works.)
3. **"Tell us about your company"** — soft profiling (tunes recommendations, no compliance weight), but keep it coherent with the brand story: Company name = the brand; Company website = the brand domain; Country; **Industry = Education** for a financial-education niche (**never Finance** — niche trigger + contradicts the WhatsApp profile category); Role; Company size (small).
4. **"How do you plan to use YCloud?"** — multi-select; for broadcast dispatch pick **Marketing Automation + Lead Generation**.
5. **Console** — a **$0.50 USD free creation credit** lands in the wallet (one-time, on signup). The "Start to create channel" CTA is the WhatsApp Embedded Signup — but do NOT click it yet (see the rest below).

> ⏸ **MANDATORY: after creating the account, leave it idle ~24h before using it — keep it AFK (cooldown).**
> Do NOT immediately start Embedded Signup, connect a WABA, add a payment method, or send anything on a
> brand-new account. YCloud's free-tier risk-control has **false-positive-suspended financial-niche accounts
> within hours of signup** (observed on multiple accounts) — and a fresh account that instantly wires up a
> WABA and launches a campaign looks exactly like the automated-abuse pattern the screen is built to catch.
> The 24h idle lets the account clear automated post-signup review before any assets are attached — same
> logic as the 24h BM rest after accepting a disposable BM. During the window do nothing on the account (no
> logins-and-clicking sprees, no WABA, no top-up beyond the auto $0.50 credit). If it suspends anyway (it can
> trip even while idle), file the support ticket immediately (Education / BM legal-identity framing, never the
> real business) and resume only once restored.

> **Company-name reuse across two YCloud accounts is a WEAK link, not a cascade trigger.** YCloud disables accounts on message quality / policy / purchased-origin, and its documented cascade is "all WABAs under a BM" (within one BM), not across separate accounts — it even recommends a backup BM+WABA. The real cross-account links are shared **IP / payment / device**, not the company name (an invisible soft CRM field). The customer-facing WhatsApp **display name** reuse is separately validated-safe (see `meta`). Free hedge: vary the invisible Step-3 company name; don't change the display name.

**After the 24h rest: WhatsApp Embedded Signup (connect the WABA/number).** Uses YCloud's developer app — no Meta developer account, only Facebook login + BM **Admin**, run from the BM's AdsPower profile. Requires a **fresh WABA number** (BR eSIM/SIM never on WhatsApp) to register during the flow.

---

## What You Can and Cannot Automate

| Evaluation need | Available via API | Method | Notes |
|---|---|---|---|
| Phone quality rating (GREEN/YELLOW/RED) | Yes | GET /v2/whatsapp/phoneNumbers, field `qualityRating` | [verified live 2026-06] returns GREEN / YELLOW / RED |
| Messaging tier / limit | Yes | GET /v2/whatsapp/phoneNumbers, fields `messagingLimit` + `whatsappBusinessManagerMessagingLimit` | [verified live 2026-06] returns the current tier (e.g. TIER_2K) |
| Wallet / credit balance | Yes | GET /v2/balance | [verified live 2026-06] always denominated in USD regardless of the WABA billing currency |
| Template approval status | Yes | GET /v2/whatsapp/templates, field `status` | [verified live 2026-06] returns APPROVED / PENDING / IN_APPEAL / REJECTED per template |
| Template quality score | Partially | GET /v2/whatsapp/templates, field `qualityRating` | [verified live 2026-06] returns UNKNOWN until sufficient send volume; GREEN/YELLOW/RED once scored by Meta |
| Per-template send / deliver / read counts | No dedicated endpoint | Self-computed: paginate GET /v2/whatsapp/messages, group by `template.name`, aggregate `status` | [verified live 2026-06] all filter params except `filter.to` and `filter.wabaId` are silently ignored server-side |
| Per-message delivery funnel | Yes | GET /v2/whatsapp/messages, fields `sendTime`, `deliverTime`, `readTime`, `status` | [verified live 2026-06] |
| Per-message cost | Yes | GET /v2/whatsapp/messages, fields `totalPrice`, `pricingCategory`, `currency` | [verified live 2026-06] `marketing_lite` at $0.0625/message |
| URL button click tracking | No | Not present in message objects | [verified live 2026-06] no `clicked` field exists |
| Opt-out list (queryable) | Yes | GET /v2/unsubscribers, field `customer` per record | [verified live 2026-06] 0 current records; no template-level attribution, requires correlating timestamp + phone against your own send log |
| Opt-out attribution to a template | Yes, via the DASHBOARD backend (not the public API) | `POST www.ycloud.com/api/whatsapp/batch/search` gives per-campaign `unsubscribeNums` + `templateName`; `GET /batch/activity/analytics` gives `buttons[].count` | [verified live 2026-06] session-cookie auth only, reached from inside the AdsPower profile (see "Dashboard Backend API" at the end) |
| Inbound messages (queryable list) | No | [UNAVAILABLE] | GET /v2/whatsapp/inboundMessages returns 404; inbound is webhook-only [verified live 2026-06] |
| Aggregate analytics (bulk stats) | No | [UNAVAILABLE] | No /analytics, /insights, /stats paths exist; all return 404 [verified live 2026-06] |
| WABA business verification status | Yes | GET /v2/whatsapp/businessAccounts/{id}, field `businessVerificationStatus` | [verified live 2026-06] value: `verified` |
| Contacts (CRM-style list) | Yes | GET /v2/contact/contacts | [from docs, verified live 2026-06] auto-created from inbound WhatsApp interactions |
| Billing history / transaction log | No | [UNAVAILABLE] | No billing history endpoint exists |
| Low-balance webhook | No | [UNAVAILABLE] | No threshold-alert or billing event in webhook catalog |
| WhatsApp Flows | No (feature-gated) | Returns 403 for accounts without the feature, even with correct wabaId | [verified live 2026-06] |
| WhatsApp Groups | No (feature-gated) | Returns 404 for accounts without the feature | [verified live 2026-06] |
| SMS / Voice / Email | No (not enabled) | Returns 403 ACCOUNT_LIMITED | [verified live 2026-06] |

---

## Dashboard Backend API (session-cookie, reached via the AdsPower profile over CDP)

A SEPARATE, undocumented API from the public `api.ycloud.com/v2` one. It lives at
`https://www.ycloud.com/api/...`, powers the dashboard UI, and exposes the per-campaign analytics,
the opt-out button counts, and per-campaign message search that the public API does NOT (the public
API has no campaign/activity concept). [verified live 2026-06]

### Auth: the SESSION cookie, NOT the API key

These endpoints reject the public `X-API-Key` (also Bearer and no-auth) with
`{"code":10001,"msg":"login please."}`. They authenticate with the dashboard `SESSION` cookie (httpOnly,
plus `remember-me`), which only exists inside a logged-in browser session.

### Access method (MANDATORY): run from inside the disposable BM's AdsPower profile

Per the browser-automation isolation rule, NEVER replay the cookie from a host-IP curl (hitting the
dashboard from a different IP than the account normally uses is a risk-control trigger, and BSP accounts have been
false-positive-suspended this way). Instead drive the SAME AdsPower profile that
operates the disposable BM, where YCloud is already logged in on the correct proxy.

**How to connect and execute the read:** Follow the global MCP read recipe (§6 of `../../../../growth/reference/automation.md`), using `https://www.ycloud.com/` as the `<dashboard-url>`. The profile's SESSION cookie is applied automatically — nothing to extract or store.

**YCloud-specific `evaluate-script` payload** for the campaign analytics endpoint:
```javascript
(async () => {
  const r = await fetch('/api/whatsapp/batch/activity/analytics?activityId=<id>', {
    credentials: 'include'
  });
  return await r.json();
})()
```

The `SESSION` cookie expires, so the AdsPower profile must stay logged in (re-login inside the profile
when it does). The endpoints are undocumented and can change without notice. Read-only evaluation only,
never send through these.

### Endpoints (all under `https://www.ycloud.com/api`)

**1. Campaign list: `POST /whatsapp/batch/search`**, body `{pageNo, pageSize}` (optional `to`/`status`).
Returns `data.records[]`, one per campaign. The record `id` IS the `activityId`. Fields [verified live
2026-06]: `id`, `name`, `templateName`, `language`, `wabaId`, `fromPhone`, `status`, `sendType`,
`createTime`, `sendTime`, `endTime`, `updateTime`, `cost`, `currency`, `totalPhoneNums`,
`validPhoneNums`, `invalidPhoneNums`, `duplicatePhoneNums`, `blockedNums`, `destinationNums`,
`destinationList`, **`unsubscribeNums`** (per-campaign opt-out count), `paramJson`, `fileKey`,
`validPhoneKey`, `tenantId`, `puid`, `suid`.

**2. Per-campaign analytics: `GET /whatsapp/batch/activity/analytics?activityId=<id>`.** Returns `data`:
`totalNums`, `sentNums`, `deliveredNums`, `readNums`, `failedNums`, `repliedNums`, `flowReplyNums`,
**`buttons: [{key, count}]`** (per-button clicks, e.g. `{"key":"Parar mensagens","count":2}` is the
opt-out count), and **`failedDetail: [{code, message, count}]`** (failure breakdown by error code, e.g.
131049 throttle and 130472 holdout). [verified live 2026-06]

**3. Per-campaign message search: `POST /whatsapp/message/search`**, body `{activityId, to, status,
pageNo, pageSize}`. Returns `data.records[]`, one per recipient: `id`, `wabaId`, `from`, `to`, `status`
(sent/delivered/read/failed), `templateName`, `language`, `message` (rendered body), `createTime`,
`sendTime`, `deliverTime`, `readTime`, `errorCode`, `errorMessage`, `toRegionCode`, `contactName`. The
`to`/`status` filters ARE applied here (unlike the public `/v2/whatsapp/messages`). [verified live 2026-06]

### Automation loop (closes the template A/B decision)

This makes the DECISIVE metric, per-template opt-out, fully automatable on the correct proxy:
1. `batch/search` to list campaigns, each with `templateName`, `unsubscribeNums`, and counts.
2. `batch/activity/analytics` per campaign for the exact funnel plus `buttons[]` opt-out.
3. Group by `templateName`, sum sent / delivered / read / failed / opt-out per template, compute
   opt-out% = opt-outs / sent, and prefer the lower-opt-out template (audience friction is the #1
   quality-rating driver). For example, a template at 6% opt-out beats one at 18% even when their
   delivery and read rates are near-tied.

---

## Auto-unsubscribe chatbot (keyword opt-out, dashboard UI only)

A custom opt-out quick-reply button on a broadcast template (e.g. a "stop messages" button) does NOT
auto-add the clicker to the unsubscribe list, and the click is invisible to the public API (it appears
only as a `buttons[].count` in the dashboard per-campaign analytics). To actually suppress opt-outs you
build a keyword-triggered RULE-BASED chatbot whose flow ends in an Unsubscribe component, AND assign
that chatbot to the number. This is dashboard-UI only, there is no public API for it.

Exact steps [verified live 2026-06]:
1. AI Agent (left menu), Create Agent, **Rule-based Agent** (the deterministic one; "AI Agent" and
   "Responsive AI Agent" are LLM-based). Name it, Create.
2. The agent opens on **Profile**. Leave defaults: Welcome Message off, and "What should the agent do
   when it doesn't understand the user's intent" = **Remain without responding** (so the bot stays
   silent on everything except the opt-out keywords).
3. **Flows** tab, **Create a flow** (or open the auto-created one), **Build** canvas, **Add a trigger**.
4. Choose **Keyword trigger**, set **Keywords matching rule = Exact matching** (safer than Contains,
   which false-triggers on phrases like "I do not want to stop"), then **+ Keyword** for the exact
   button label plus common typed variants, one keyword each. **Save** with the node panel's Save
   button, NOT the X (the X discards the config).
5. Connect the next node by **dragging** from the Trigger node's right-edge handle onto the new node.
   Clicking the handle only re-opens the node editor; you must DRAG to create the link.
6. In the **Tool box**, click **Unsubscribe** to add the node. In its panel turn **Auto-reply = On** and
   write the confirmation message, then **Save** (node panel).
7. Drag-connect Trigger to Unsubscribe so an arrow links them.
8. **Save the flow** (top-right), and in the "Save the flow" dialog flip **Set up flow status = Active**,
   then Save. There are TWO save levels: each node panel AND the flow.
9. **MANDATORY: assign the chatbot to the number.** WhatsApp accounts, the number's gear (Settings),
   **Inbox > Assignment**, **Priority 3 "Assign to" -> AI Agent ->** select your rule-based agent,
   **Save**. The active flow alone never fires without this: the agent's "Associated" count stays 0 and
   the chatbot receives nothing. [deep-research + live verified]

Gotchas:
- Flow Active is not enough; the assignment in step 9 is what routes the number's messages to the bot.
- Assignment fires only at conversation CREATION [verified live + docs]. A NEW conversation (a number
  that never messaged before) IS auto-assigned to the Priority-3 chatbot and the flow runs; a
  PRE-EXISTING conversation NEVER re-routes on later inbound messages (the inbox "Assigned to bot" stays
  empty for old conversations, and the per-conversation manual-assign menu lists only human agents, not
  the bot). So always test from a brand-new number, and for the EXISTING audience rely on a separate
  suppression (e.g. exclude prior recipients at send time) since their opt-out clicks will not auto-fire
  the bot. The 24h window does NOT block any of this: an inbound message reopens the window, and the
  Unsubscribe action needs no window.
- For a template quick-reply button specifically, "Click button trigger" is the alternative to the
  keyword trigger.

---

## BSP Options (if not using Direct API)

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
| **YCloud (Free plan)** | BSP | **$0/mo** | Unlimited API; service msgs $0 (empirically confirmed totalPrice:0 in production); utility-in-window $0; shared inbox included; 1 user, 2 channels | **0%** — explicit zero-markup policy; passes Meta rates from wallet; empirically confirmed at ~$0.05–$0.0625/msg for BR marketing | Best Brazil dispatch value: pay only Meta's rate. BRL billing H2 2026. Add-on users $10/user/mo, channels $5/channel/mo. ⚠️ Risk-control auto-flags possible on free tier for financial use cases (reported by financial-niche accounts, resolved via support ticket in <24h) — open a support ticket immediately if suspended, false-positive rate is high | ycloud.com/pricing — asOf 2026-06-03 (HIGH) |
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
- **Empirically confirmed in production (YCloud):** service messages = totalPrice:0; Brazil marketing draws from wallet at ~$0.05–$0.0625/msg — consistent with Meta's $0.0625 base at 0% markup.

**MM API vs Cloud API (360dialog / Gupshup):** Meta's Marketing Messages (MM) API route can eliminate BSP surcharges that apply only on the standard `/messages` Cloud API endpoint. If using 360dialog or Gupshup for high-volume Brazil marketing, prefer the MM API/MM Lite route.

**Meta per-message rate (Brazil 2026):** Marketing $0.0625/msg (per-message billing since July 2025, was per-conversation). Service (user-initiated, 24h window) free.

**Cost for low-volume test (23 + 500 msgs):**
- Direct Cloud API: $1.44 / $31.25 (zero markup, needs dev app)
- Gupshup: $1.46 / $31.75
- Twilio: $1.55 / $33.75

---

## YCloud Campaign Send File Format and Campaign-API-Lag Gotchas

**YCloud campaign send file format:** upload `.xlsx` (not `.csv` — CSV is rejected by the campaign UI). First column header must be exactly `phone` with numbers in +E164 format (e.g., +55XXXXXXXXXXX). Additional columns become template variables mapped in order. The UI "Test send" button is greyed out until at least one template variable field is populated with a sample value — fill all variable fields first, then the button activates.

**Broadcast-list storage hygiene (PII):** broadcast contact lists hold real recipient PII (phone + name). Store them in a dedicated per-number folder inside the project, e.g. `.../<profile>/<bm>/whatsapp/<number>/broadcasts/`, NEVER loose in `~/Downloads` or scattered across machines. **Gitignore the list data files** (`*.xlsx`, `*.csv`) so PII never enters git history, they are fully regenerable from the source DB. Keep one tracked `README.md` in the folder describing what each list is and the exclusion logic. Each day's pull EXCLUDES everyone already sent on prior days (matched by normalized E164), drops demo/invested/junk-name rows, and takes the freshest N un-messaged signups.

**Monitoring sends via the YCloud API (polling — verified live 2026-06):** the dashboard Analytics/Logs are the GUI view, but per-message status is pullable programmatically. ⚠️ The published YCloud SDKs (Java/Python/PHP) claim there is NO list endpoint (only `retrieve`/`send`/`sendDirectly`) — that is **WRONG**; the live REST API DOES expose a paginated list. Trust the live API over the SDK docs.
- **List:** `GET https://api.ycloud.com/v2/whatsapp/messages?limit=100` (header `X-API-Key: <key>`) → `{offset, limit, length, items:[...]}`. ⚠️ **PAGINATION (verified live 2026-06):** the `offset` param is **silently IGNORED** (offset=0 and offset=3 return identical rows) and there is **no cursor** — BUT the **1-indexed `page` param DOES paginate** (`?page=1&limit=100`, `?page=2&limit=100`, …). `limit` is **capped at 100** (`limit>100` errors). → Page with **`page`** (NOT `offset` — looping offsets returns the same newest page repeatedly and inflates counts ~Nx), **dedup by `id`**, and stop when a page returns no new ids. `?includeTotal=true` returns the account `total` so you can detect how many older messages remain. For full history beyond the API's page ceiling, use the campaign UI Analytics. No server-side time/status filter works (but `filter.to` and `filter.wabaId` DO apply server-side) → filter client-side by `createTime`/`type` for everything else.
- **Per-message fields:** `id`, `wamid`, `status`, `from`, `to`, `type` (text|template|…), `createTime`, `sendTime`, `deliverTime`, `readTime`, `totalPrice`, `pricingCategory` (`service`=free | `marketing` | `utility` | `authentication`); on failure `errorCode` + `whatsappApiError.{code,message}`.
- **Status enum:** `accepted → sent → delivered → read`, or `failed`. (`read` only if the recipient has read receipts on — "delivered" is the reliable floor.)
- **Single message:** `GET /v2/whatsapp/messages/{id}` (the YCloud `id`, NOT the `wamid`).
- **Aggregate a broadcast:** paginate all → group by `(createTime[:10], type, status)`. A UI campaign = the batch of `type:"template"` messages on its send date; split failures by `errorCode` (131026 undeliverable→remove vs 131049 throttle→retryable).
  ```bash
  curl -s "https://api.ycloud.com/v2/whatsapp/messages?limit=100&page=1" -H "X-API-Key: <key>" \
    | jq '[.items[]|{d:.createTime[0:10],type,status}]|group_by(.d+.type+.status)|map({k:(.[0].d+" "+.[0].type+" "+.[0].status),n:length})'
  ```
- ⚠️ **Campaign-send LAG (critical — the `/messages` list is NOT real-time for campaigns):** messages sent via the console **campaign (bulk UI) do NOT appear in `/v2/whatsapp/messages` for HOURS** (likely a periodic sync, not minutes). Verified live: a campaign can still be entirely ABSENT from the list hours after the console shows it **Completed and charged**, then appear the next day. There is also **NO campaign/bulk API**: `GET /v2/whatsapp/bulkMessages/{id}` → 404, and the `?bulkMessageId=` query param is silently IGNORED (returns the full unfiltered list). **So `/messages` polling is real-time ONLY for API-direct (`sendDirectly`) sends** (those appear instantly). For **real-time CAMPAIGN monitoring use the campaign's UI Analytics/Logs tab** (immediate per-recipient status + the campaign ID is in the URL `…/bulkMessages/detail/…/{id}`) **OR subscribe to `whatsapp.message.updated` webhooks**. Use `/messages` polling for campaigns only as a delayed/next-day reconciliation, not for the freshly-sent batch.
- **Push alternative (better at scale):** subscribe to the `whatsapp.message.updated` webhook (`POST /v2/webhookEndpoints` with `enabledEvents:["whatsapp.message.updated"]`); tag each send with `externalId="<campaignId>:<recipientId>"` so events self-identify, and verify the `YCloud-Signature` HMAC (`t={ts},s={hex}`, signed payload `{t}.{body}.`). There is NO campaign-stats API — webhooks or list-polling are the only programmatic options; aggregate campaign numbers otherwise live only in the UI.
- **Rate limits:** 200 rps / 10,000 rph on reads; the free plan has no extra read restriction.

**Why BSP over Direct API:** BSP uses THEIR developer app — you never need a Meta developer account. This bypasses the SMS verification blocker that affects purchased/antidetect profiles. The Embedded Signup flow only requires Facebook login + BM admin access.

**Direct Cloud API without your own dev account (workaround):** A SECOND Facebook account (contractor/employee with working phone) registers as developer → creates a "Business" Meta App → adds it to your BM → you (BM admin) create a System User → install the app → generate token with `whatsapp_business_messaging`. The token generation itself does NOT need dev SMS verification — only the app creation does, which the second account handles. Cheapest long-term (zero markup), keeps existing WABA, full script control.
