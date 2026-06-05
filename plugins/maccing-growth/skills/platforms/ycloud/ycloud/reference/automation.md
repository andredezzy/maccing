> **Global doctrine first.** This file is the YCloud-specific extension of the platform-agnostic automation doctrine. Read `../../../../growth/reference/automation.md` in full before this file. The universal rules (Decision Tree, AdsPower/antidetect tooling, undetectability discipline, keep-open / no rapid cycling, Two-Axis Hybrid Split, the proven MCP read recipe, and the Fallback Ladder) all live there and are not repeated here.

---

## Contents

1. [YCloud Surface Map (Rung Assignment)](#ycloud-surface-map-rung-assignment)
2. [Dashboard Backend API (session-cookie surface)](#dashboard-backend-api-session-cookie-surface)
3. [Automation Loop (closes the template A/B decision)](#automation-loop-closes-the-template-ab-decision)

---

## YCloud Surface Map (Rung Assignment)

| Task | Rung | Surface |
|---|---|---|
| Phone quality rating, messaging tier, wallet balance, template approval | **Rung 1** | Public REST API (`api.ycloud.com/v2`, `X-API-Key`) |
| Per-campaign opt-out counts, per-button click funnels, per-recipient search within a campaign | **Rung 2** | Dashboard backend (`www.ycloud.com/api/...`, SESSION cookie) via in-page `fetch()` inside the AdsPower profile |
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

## Automation Loop (closes the template A/B decision)

This makes the decisive metric — per-template opt-out — fully automatable on the correct proxy:

1. `batch/search` to list campaigns, each with `templateName`, `unsubscribeNums`, and counts.
2. `batch/activity/analytics` per campaign for the exact funnel plus `buttons[]` opt-out.
3. Group by `templateName`, sum sent / delivered / read / failed / opt-out per template, compute opt-out% = opt-outs / sent, and prefer the lower-opt-out template (audience friction is the primary quality-rating driver). For example, a template at ~5% opt-out beats one at ~20% even when their delivery and read rates are near-tied.

Execute each step as an in-page `fetch()` via `evaluate-script`, following the global MCP read recipe (global §6).
