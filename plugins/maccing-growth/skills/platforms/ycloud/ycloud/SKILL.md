---
name: ycloud
description: >
  YCloud — a multi-channel communications provider (CPaaS: WhatsApp, SMS, Voice, Email), not a Meta-only BSP.
  This skill covers its WhatsApp Business operations: console navigation, account creation/onboarding, Embedded Signup,
  campaigns/inbox/journeys, auto-unsubscribe chatbot, the public-API-vs-dashboard-backend distinction, BSP
  migration, and read-only CDP automation. Use when operating YCloud for WhatsApp dispatch: embedded
  signup, campaign sends, campaign analytics, inbox, auto-unsubscribe chatbot, opt-out attribution, dashboard
  automation. Triggers on: 'ycloud', 'CPaaS', 'BSP', 'bulk campaign',
  'whatsapp dashboard', 'embedded signup', 'auto-unsubscribe', 'opt-out chatbot', 'campaign analytics',
  'dispatch automation', 'ycloud free plan', 'zero markup', 'ycloud account creation', 'ycloud onboarding', 'ycloud signup code'.
---

> **Related:** `whatsapp` (Cloud API + dispatch + BSP pricing/billing), `ycloud-api` (the v2 REST API reference), `meta` (BM/isolation — the CDP automation MUST run inside the disposable BM's AdsPower profile).

## Overview

YCloud is a multi-channel communications provider (CPaaS — WhatsApp, SMS, Voice, Email). This skill focuses on its WhatsApp Business Solution Provider (BSP) role, which wraps Meta's WhatsApp Business API. The Free plan has:

- **$0/month** subscription, unlimited API access
- **0% per-message markup** — wallet is debited at Meta's base rate (~$0.0625/msg for Brazil marketing)
- Shared inbox, 1 user, 2 channels included
- Embedded Signup: no Meta developer account needed; only Facebook login + BM Admin access

This makes YCloud the best-value Brazil dispatch option at any volume: you pay only Meta's rate. The
Growth ($39/mo), Pro ($89/mo), and Enterprise ($399/mo) plans add users, channels, and AI credits at
the same 0% markup.

For BSP comparison, plan details, and pricing model see `whatsapp` → `reference/pricing-and-billing.md`.

Risk: free-tier accounts in financial niches have been false-positive-suspended. Resolution via support
ticket typically takes <24h. One BSP account per disposable BM is required (recommended practice) to
prevent a single suspension from taking down all active BMs.

**Account onboarding ≠ Embedded Signup.** Creating the YCloud *account* (a 5-step wizard) is separate
from connecting a *WABA* (Embedded Signup). The account-signup verification **code is delivered via a
WhatsApp message** (not email/SMS) — a non-obvious blocker on disposable-BM setups, since it can reuse
neither another BM's WhatsApp nor the fresh WABA chip. Full per-BM onboarding flow + the burner-WhatsApp
workaround + account email/domain + profiling-field guidance + the $0.50 signup credit:
`reference/account-and-waba-setup.md` → **Account Creation / Onboarding (per BM)**.

## Console Map

| Area | Path | What it does |
|---|---|---|
| Campaigns (bulk send) | Campaigns → WhatsApp Campaigns | Upload `.xlsx` list, pick template, send to many |
| Campaign analytics | Campaign row → Analytics/Logs tab | Real-time per-recipient funnel; campaign ID is in URL |
| Inbox | Inbox | Per-conversation inbound + manual agent replies |
| Auto-unsubscribe chatbot | AI Agent → Create Agent (Rule-based) | Keyword-triggered Unsubscribe node; must assign to number |
| Templates | WhatsApp → Templates | Create / list / check approval status |
| Phone numbers | WhatsApp → Phone Numbers | Quality rating, messaging tier, profile |
| Wallet | Billing → Wallet | Balance top-up, transaction view |
| Webhooks | Developer → Webhooks | Subscribe to `whatsapp.message.updated` |
| API key | Developer → API Keys | The `X-API-Key` for the public REST API |

## Public API vs Dashboard Backend

YCloud exposes two separate APIs:

**Public REST API** (`api.ycloud.com/v2`, `X-API-Key` header):
- Per-message delivery status, cost, template approval, phone quality, wallet balance
- Real-time for `sendDirectly` API sends; campaign (bulk UI) messages lag by **hours**
- No campaign/activity concept — no `bulkMessages` endpoint (returns 404)

**Dashboard backend** (`www.ycloud.com/api/...`, SESSION cookie):
- Per-campaign `unsubscribeNums`, per-button click counts, per-recipient search within a campaign
- Undocumented, SESSION-cookie only (rejects the public API key)
- MUST be reached from inside the disposable BM's AdsPower profile (see reference/api-automation.md)

Campaign-send LAG is critical: after a campaign completes and the wallet is charged, the messages may
not appear in `/v2/whatsapp/messages` for hours (sometimes next-day). Use the campaign's
Analytics/Logs tab or `whatsapp.message.updated` webhooks for real-time monitoring.

For the read-only automation discipline (CDP connect, the MCP read recipe, undetectability), see `reference/api-automation.md`.

## Routing Table

| Intent | Reference | Use for |
|---|---|---|
| Account signup wizard, WhatsApp-code gotcha + workaround, account email/domain, profiling fields, $0.50 credit | reference/account-and-waba-setup.md | Creating a new YCloud account per BM |
| Embedded Signup steps, WABA connection, opt-out chatbot setup | reference/account-and-waba-setup.md | Connecting a WABA + building keyword opt-out flows |
| Campaign send file format, `.xlsx` spec, Test-send button | reference/account-and-waba-setup.md | Preparing and uploading campaign lists |
| BSP comparison table, pricing model, YCloud plans | whatsapp → reference/pricing-and-billing.md | Choosing or justifying BSP selection |
| evaluate.py, Dashboard Backend API, SESSION cookie auth | reference/api-automation.md | Pulling per-campaign analytics programmatically |
| Reconciliation: unanswered inbox replies, per-campaign stats | reference/api-automation.md | Every YCloud reconcile: pull unanswered inbound + raise as #1 action |
| Template scoring, what's automatable capability table | reference/api-automation.md | Understanding automation boundaries |
| AdsPower MCP read recipe, automation loop code | reference/api-automation.md | Automating dashboard backend reads |
| Read/commit split, rung assignment for YCloud tasks | reference/api-automation.md | Architecture of read-only automation |
| Isolation rule (AdsPower profile, proxy, BSP-per-BM) | reference/api-automation.md | Safe automation without ban risk |
