---
name: ycloud
description: >
  YCloud — a multi-channel communications provider (CPaaS: WhatsApp, SMS, Voice, Email), not a Meta-only BSP.
  This skill covers its WhatsApp Business operations: console navigation, plans/pricing, Embedded Signup,
  campaigns/inbox/journeys, auto-unsubscribe chatbot, the public-API-vs-dashboard-backend distinction, BSP
  migration, and read-only CDP automation. Use when operating YCloud for WhatsApp dispatch: plans, embedded
  signup, campaign sends, campaign analytics, inbox, auto-unsubscribe chatbot, opt-out attribution, dashboard
  automation, or comparing YCloud to other providers. Triggers on: 'ycloud', 'CPaaS', 'BSP', 'bulk campaign',
  'whatsapp dashboard', 'embedded signup', 'auto-unsubscribe', 'opt-out chatbot', 'campaign analytics',
  'dispatch automation', 'provider comparison', 'ycloud free plan', 'zero markup'.
---

> **Related:** `whatsapp` (Cloud API + dispatch), `ycloud-api` (the v2 REST API reference), `meta` (BM/isolation — the CDP automation MUST run inside the disposable BM's AdsPower profile).

## Overview

YCloud is a multi-channel communications provider (CPaaS — WhatsApp, SMS, Voice, Email). This skill focuses on its WhatsApp Business Solution Provider (BSP) role, which wraps Meta's WhatsApp Business API. The Free plan has:

- **$0/month** subscription, unlimited API access
- **0% per-message markup** — wallet is debited at Meta's base rate (~$0.0625/msg for Brazil marketing)
- Shared inbox, 1 user, 2 channels included
- Embedded Signup: no Meta developer account needed; only Facebook login + BM Admin access

This makes YCloud the best-value Brazil dispatch option at any volume: you pay only Meta's rate. The
Growth ($39/mo), Pro ($89/mo), and Enterprise ($399/mo) plans add users, channels, and AI credits at
the same 0% markup.

Risk: free-tier accounts in financial niches have been false-positive-suspended. Resolution via support
ticket typically takes <24h. One BSP account per disposable BM is required (recommended practice) to
prevent a single suspension from taking down all active BMs.

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
- MUST be reached from inside the disposable BM's AdsPower profile (see automation-pattern.md)

Campaign-send LAG is critical: after a campaign completes and the wallet is charged, the messages may
not appear in `/v2/whatsapp/messages` for hours (sometimes next-day). Use the campaign's
Analytics/Logs tab or `whatsapp.message.updated` webhooks for real-time monitoring.

## Read-Only Automation Pattern

For evaluation/monitoring that the agent drives without human interaction:

1. **Monitor** — use the public REST API (`X-API-Key`) to poll quality rating, tier, wallet balance,
   and template approval status.
2. **Evaluate** — use the dashboard backend (`batch/search` + `batch/activity/analytics`) via
   `page.evaluate()` inside the AdsPower profile's browser page to retrieve per-campaign opt-out counts
   and button-click funnels.
3. **Report** — the agent reports findings; the operator or a separate API-direct send acts.

The agent NEVER sends through the dashboard backend (read-only). Sends go through `POST /v2/whatsapp/messages`
(API-direct, real-time) or the campaign UI (bulk, laggy). See automation-pattern.md for the full
AdsPower-CDP setup code.

## Routing Table

| Intent | Reference | Use for |
|---|---|---|
| Campaign send file format, `.xlsx` spec, Test-send button | reference/console-and-operations.md | Preparing and uploading campaign lists |
| Campaign-API lag, `/messages` pagination gotcha, webhook setup | reference/console-and-operations.md | Monitoring sends programmatically |
| What data is available via API vs dashboard only | reference/console-and-operations.md | Knowing which surface to query |
| BSP comparison table, pricing model, YCloud plans | reference/console-and-operations.md | Choosing or justifying BSP selection |
| Auto-unsubscribe chatbot setup, exact UI steps, gotchas | reference/console-and-operations.md | Building keyword opt-out flows |
| Dashboard backend endpoints, SESSION cookie auth | reference/console-and-operations.md | Pulling per-campaign analytics |
| AdsPower-CDP access pattern, automation loop code | reference/automation-pattern.md | Automating dashboard backend reads |
| Three-tool monitor/evaluate/dashboard split | reference/automation-pattern.md | Architecture of read-only automation |
| Isolation rule (AdsPower profile, proxy, BSP-per-BM) | reference/automation-pattern.md | Safe automation without ban risk |
