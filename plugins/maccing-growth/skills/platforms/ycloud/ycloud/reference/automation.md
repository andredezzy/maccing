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
- Response: `data` is an **array, one entry per inbox**; each has `total` (conversation count) and `conversation[]`. Each conversation has `previewMessage` (the last message), `assigneeId`, `contactId`, `lastActivityAt` (epoch ms), `contactLastSeenAt`.
- **Unanswered / "unreplied" = `previewMessage.messageDirection === 0`** (0 = inbound/customer was the last to speak; 1 = outbound/us). Phone = `previewMessage.from`; text = `previewMessage.content.text.body` (or `[<contentType>]` for media/button).
- **24h window:** open iff the last inbound time (`contactLastSeenAt` / `lastActivityAt`) is `< 24h` ago → can reply free-form $0; older → only a template re-opens it.
- **Names are NOT in this payload** (`previewMessage.contactName` is usually null) → resolve via the **public API** `GET /v2/whatsapp.../contact/contacts` (`X-API-Key`): each contact has `nickname` (the WhatsApp pushName) + `phoneNumber`; build a phone→nickname map and join. (`repliedNums` from step 2 is just the cross-check that replies exist.)
- **Triage before surfacing:** exclude opt-outs from "needs a reply" — `Parar`/`Stop`/`Sair`/`Cancelar` text and opt-out `[button]` clicks are **suppress, never reply**; business auto-replies ("X agradece seu contato") are low/no priority. Surface the genuine inbound questions, window-open ones first.

**How to surface it (every time):**
- Report the unanswered conversations **at the top** of the reconciliation output: who replied, the last inbound message, and how long it has been waiting (flag any approaching the 24h window edge).
- Frame it as the operator's **next action**: these need a human reply now (Rung 3 — the agent never sends broadcasts; single inbox/service-window replies are operator-driven or the operator's explicit call). Drafting suggested replies is fine; **sending is the operator's**.
- If the Inbox is empty / nothing unanswered, say so explicitly — don't silently omit it.
