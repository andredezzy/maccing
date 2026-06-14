> **Global doctrine first.** This file is the YCloud-specific extension of the platform-agnostic automation doctrine. Read `../../../../growth/reference/automation.md` in full before this file. The universal rules (Decision Tree, AdsPower/antidetect tooling, undetectability discipline, keep-open / no rapid cycling, Two-Axis Hybrid Split, the proven MCP read recipe, and the Fallback Ladder) all live there and are not repeated here.

---

## Contents

1. [YCloud Surface Map (Rung Assignment)](#ycloud-surface-map-rung-assignment)
2. [Dashboard Backend API (session-cookie surface)](#dashboard-backend-api-session-cookie-surface)
3. [Reconciliation Loop (campaign metrics + unanswered inbox)](#reconciliation-loop-campaign-metrics--unanswered-inbox)
4. [ALWAYS surface unanswered inbox replies (top priority on every reconciliation)](#always-surface-unanswered-inbox-replies-top-priority-on-every-reconciliation)

---

## YCloud Surface Map (Rung Assignment)

| Task | Rung | Surface |
|---|---|---|
| Phone quality rating, messaging tier, wallet balance, template approval | **Rung 1** | Public REST API (`api.ycloud.com/v2`, `X-API-Key`) |
| Per-campaign opt-out counts, per-button click funnels, per-recipient search within a campaign | **Rung 2** | Dashboard backend (`www.ycloud.com/api/...`, SESSION cookie) via in-page `fetch()` inside the AdsPower profile |
| **Unanswered inbound conversations (the Inbox)** | **Rung 2** | Dashboard backend **`POST /api/inbox/conversation/search`** (read "All" = no assignee filter; unreplied = `previewMessage.messageDirection===0`). No public inbound-list endpoint (`/v2/whatsapp/inboundMessages` 404, inbound is webhook-only) |
| Sending messages, publishing campaigns, submitting forms | **Rung 3** | Operator only — no agent execution |

The dashboard backend is **read-only** from the agent's perspective. The agent reads and reports; the operator (or a separate API-direct call) acts.

---

## Dashboard Backend API (session-cookie surface)

A separate, undocumented API from the public `api.ycloud.com/v2` surface. It lives at `https://www.ycloud.com/api/...`, powers the dashboard UI, and exposes per-campaign analytics that the public API does NOT provide (the public API has no campaign/activity concept).

### Auth: SESSION cookie, NOT the API key

These endpoints reject the public `X-API-Key` (also Bearer and no-auth) with `{"code":10001,"msg":"login please."}`. They authenticate with the dashboard `SESSION` cookie (httpOnly, plus `remember-me`), which only exists inside a logged-in browser session.

**Access method:** Follow the global MCP read recipe (global §6), using `https://www.ycloud.com/` as the `<dashboard-url>`. The profile's SESSION cookie is applied automatically — nothing to extract or store. NEVER replay the cookie from a host-IP `curl`; hitting the dashboard from a different IP than the account normally uses is a risk-control trigger.

The `SESSION` cookie expires; re-login inside the AdsPower profile when it does. These endpoints are undocumented and can change without notice.

### Endpoints (all under `https://www.ycloud.com/api`)

**1. Campaign list: `POST /whatsapp/batch/search`**

Body: `{pageNo, pageSize}` (optional `to`/`status`).

Returns `data.records[]`, one per campaign. The record `id` IS the `activityId`. Key fields [verified live 2026-06]: `id`, `name`, `templateName`, `language`, `wabaId`, `fromPhone`, `status`, `sendType`, `createTime`, `sendTime`, `endTime`, `updateTime`, `totalPhoneNums`, `validPhoneNums`, `invalidPhoneNums`, `duplicatePhoneNums`, `blockedNums`, `destinationNums`, **`unsubscribeNums`** (per-campaign opt-out count), `paramJson`, `fileKey`, `tenantId`.

**Example `evaluate-script` payload:**
```javascript
(async () => {
  const r = await fetch('/api/whatsapp/batch/search', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageNo: 1, pageSize: 50 })
  });
  return await r.json();
})()
```

**2. Per-campaign analytics: `GET /whatsapp/batch/activity/analytics?activityId=<id>`**

Returns `data`: `totalNums`, `sentNums`, `deliveredNums`, `readNums`, `failedNums`, `repliedNums`, `flowReplyNums`, **`buttons: [{key, count}]`** (per-button clicks — the opt-out button count appears here), and **`failedDetail: [{code, message, count}]`** (failure breakdown by error code). [verified live 2026-06]

**Example `evaluate-script` payload:**
```javascript
(async () => {
  const r = await fetch('/api/whatsapp/batch/activity/analytics?activityId=<id>', {
    credentials: 'include'
  });
  return await r.json();
})()
```

**3. Per-campaign message search: `POST /whatsapp/message/search`**

Body: `{activityId, to, status, pageNo, pageSize}`. Returns `data.records[]`, one per recipient: `id`, `wabaId`, `from`, `to`, `status` (sent/delivered/read/failed), `templateName`, `language`, `message`, `createTime`, `sendTime`, `deliverTime`, `readTime`, `errorCode`, `errorMessage`, `toRegionCode`, `contactName`. The `to`/`status` filters ARE applied server-side here (unlike the public `/v2/whatsapp/messages`). [verified live 2026-06]

### Opt-out button parsing

A quick-reply opt-out button appears in `buttons[].count` on the per-campaign analytics endpoint, keyed by the exact button label (e.g., `{"key": "Stop messages", "count": 5}`). This is the only programmatic way to get per-button opt-out counts; `unsubscribeNums` on the campaign list gives the aggregate per-campaign figure.

---

## Reconciliation Loop (campaign metrics + unanswered inbox)

This makes the decisive metric — per-template opt-out — fully automatable on the correct proxy:

1. `batch/search` to list campaigns, each with `templateName`, `unsubscribeNums`, and counts.
2. `batch/activity/analytics` per campaign for the exact funnel plus `buttons[]` opt-out. Note `repliedNums` — a non-zero value means inbound replies exist that may be sitting unanswered in the Inbox (step 4).
3. Group by `templateName`, sum sent / delivered / read / failed / opt-out per template, compute opt-out% = opt-outs / sent, and prefer the lower-opt-out template (audience friction is the primary quality-rating driver). For example, a template at ~5% opt-out beats one at ~20% even when their delivery and read rates are near-tied.
4. **MANDATORY — pull unanswered Inbox conversations and surface them FIRST (see next section).** A reconciliation is not complete until the unanswered inbound replies have been listed and raised to the operator as the top-priority action. Never report campaign funnel numbers without also reporting what is waiting in the Inbox.

Execute each step as an in-page `fetch()` via `evaluate-script`, following the global MCP read recipe (global §6).

---

## ALWAYS surface unanswered inbox replies (top priority on every reconciliation)

**Rule:** every time you reconcile YCloud data (post-send, daily check, or any dashboard read), you MUST also read the **Inbox** for **unanswered inbound conversations** and bring them to the operator **as the #1 priority action — above the funnel report.** Reconciliation is "pull the numbers AND surface who is waiting for a reply," never just the numbers.

**Why unanswered inbound outranks everything else:**
- An inbound reply opens (and each new inbound resets) the **free 24h customer-service window** — replying inside it is **$0** (service messages, no template), the **highest-converting warm path**, and it **closes in 24h** → after that only paid templates reach them. Unanswered = a free, time-boxed window being wasted.
- The reply itself is a **positive quality signal.** Phone-number quality is driven by blocks/spam-reports; a real two-way conversation pushes the opposite way. Answering inbound both converts AND helps protect/recover the number's quality rating — so it is never "later," it is first.
- A person who reached out and got silence is the most likely to block/report — the exact signal that craters quality.

**How to read it (Rung 2, dashboard backend — read-only) — VERIFIED endpoint:**
- Follow the global MCP read recipe (global §6); the read is a same-origin `fetch()` from any logged-in `www.ycloud.com` tab — it does NOT need the Inbox SPA to render (a freshly-opened tab is fine; do not DOM-scrape it).
- **`POST /api/inbox/conversation/search`** body `{pageNo, pageSize}` [verified live 2026-06]. **Read from "All" by passing NO assignee filter** — the dashboard UI defaults to "Assigned to me" which typically shows **0** because conversations sit with the auto-unsubscribe **BOT / unassigned** (the assignment gap: assignment only fires at conversation creation, see console-and-operations). The "All" source = the unfiltered query.
- Response: `data` is an **array, one entry per inbox**; each has `total` (conversation count) and `conversation[]`. Each conversation has `previewMessage` (the last message), **`replied`** (bool — `false` = needs a reply, the most reliable unreplied flag), `unreadCount`, **`contact`** (sub-object: `nickName` = WhatsApp pushName, `phoneNumber`, `countryCode`), `assigneeId`, `contactId`, `lastActivityAt` (epoch ms), `contactLastSeenAt`. [verified live 2026-06]
- **Unanswered / "unreplied" = `replied === false`** (most reliable), equivalently `previewMessage.messageDirection === 0` (0 = inbound/customer spoke last; 1 = outbound/us). Phone = `contact.phoneNumber` or `previewMessage.from`; text = `previewMessage.content.text.body` (or `[<contentType>]` for media/button).
- **24h window:** open iff the last inbound time (`contactLastSeenAt` / `lastActivityAt`) is `< 24h` ago → can reply free-form $0; older → only a template re-opens it.
- **Names ARE in this payload** at `conversation.contact.nickName` (+ `.phoneNumber`) [verified live 2026-06] — no join needed. (`previewMessage.contactName` IS usually null; use `contact.nickName`.) Fallback only if `contact` is absent: the public API `GET /v2/.../contact/contacts` (`X-API-Key`), join phone→`nickname`. (`repliedNums` from step 2 is just the cross-check that replies exist.)
- **Full thread (all inbound) + media:** `GET /api/inbox/conversation/messages?conversationId=<id>&pageSize=50&before=<cursor>` returns the conversation's messages (`messageDirection===0` = inbound); paginate older via `before`. Download inbound media (image/sticker/video/document the customer sent) with `GET /api/inbox/attachment/download/<attachmentId>`. [verified live 2026-06]
- ⚠️ **Pagination gotcha:** `conversation/search` `pageNo` does NOT reliably page — `pageNo:2+` returned empty even with 186 total conversations. Pass one large **`pageSize`** (e.g. 300) to pull the whole set in a single call. [verified live 2026-06]
- **Triage before surfacing:** exclude opt-outs from "needs a reply" — `Parar`/`Stop`/`Sair`/`Cancelar` text and opt-out `[button]` clicks are **suppress, never reply**; business auto-replies ("X agradece seu contato") are low/no priority. ⚠️ Button `[button]` "Parar mensagens" clicks are frequently **NOT** auto-suppressed (the bot only catches assigned conversations) → reconcile them into `/v2/unsubscribers` manually (see the `ycloud-api` skill → Create Unsubscriber). Surface the genuine inbound questions, window-open ones first.

**How to surface it (every time):**
- Report the unanswered conversations **at the top** of the reconciliation output: who replied, the last inbound message, and how long it has been waiting (flag any approaching the 24h window edge).
- Frame it as the operator's **next action**: these need a human reply now (Rung 3 — the agent never sends broadcasts; single inbox/service-window replies are operator-driven or the operator's explicit call). Drafting suggested replies is fine; **sending is the operator's**.
- If the Inbox is empty / nothing unanswered, say so explicitly — don't silently omit it.

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

### Computing Template Analytics (No Dedicated Endpoint)

Since no per-template analytics endpoint exists, the only method is client-side aggregation over the full message log. [verified live 2026-06]

Algorithm:
1. Fetch all pages: `GET /v2/whatsapp/messages?page=1&limit=100&includeTotal=true`, then repeat for subsequent pages until `length < limit`.
2. Group items by `template.name`.
3. Count: `attempted` = total records per template; `failed` = status `failed`; `delivered` = status `delivered` + `read`; `read` = status `read`.
4. Compute rates: `delivered_pct = delivered / attempted`, `read_pct = read / attempted`.

Illustrative example (fictional values):

| Template | Attempted | Failed | Delivered+Read | Read | Deliver% | Read% |
|---|---|---|---|---|---|---|
| welcome_template | 200 | 20 (10.0%) | 180 | 120 | 90.0% | 60.0% |
| invite_template | 200 | 16 (8.0%) | 184 | 128 | 92.0% | 64.0% |

When the sample size is below the ~200 threshold needed for a 95% CI on a 5pp difference, treat any gap as directional only. Score formula: `score = delivered_pct * 0.4 + read_pct * 0.4 - optout_pct * 0.2`. In this example `invite_template` leads on delivery rate.
