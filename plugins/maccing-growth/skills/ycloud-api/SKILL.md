---
name: ycloud-api
description: >
  YCloud v2 REST API reference for WhatsApp messaging via the BSP layer. Covers
  every callable endpoint: sending and listing messages (async and sendDirectly),
  template CRUD, phone number and WABA metadata, wallet balance, webhook
  management, contacts, unsubscribers/opt-outs, and media upload. Includes
  live-verified behavior deviations, pagination gotchas, and filter limitations.
  Use when calling the YCloud v2 REST API for WhatsApp — sending/listing
  messages, templates, phone numbers/WABA, wallet/balance, webhooks, contacts,
  unsubscribers, media, pagination gotchas. Triggers: 'ycloud api', 'X-API-Key',
  '/v2/whatsapp/messages', 'ycloud webhook', 'ycloud pagination', 'ycloud
  balance', 'sendDirectly', 'unsubscribers endpoint'.
---

YCloud exposes a unified REST API at `https://api.ycloud.com/v2` for WhatsApp
Business messaging. This skill covers the full public v2 endpoint surface with
live-verified (June 2026) behavior notes.

> **Related:** `ycloud` (BSP platform + dashboard-backend automation), `whatsapp` (Cloud API concepts).

## Base URL and Auth

```
Base URL : https://api.ycloud.com/v2
Auth     : X-API-Key: <your-api-key>   (header, every request)
```

No OAuth, no Bearer token. One key grants full read/write access to all resources.

## Critical Gotchas (read before calling)

| Gotcha | Detail |
|---|---|
| Paginate with `page`, not `offset` | `?offset=N` is silently ignored — always returns the newest page. Use `page=1..100`. |
| `limit` cap is 100 | Max 100 items per page. Max reachable offset: `(100-1)*100 = 9,900` (~10k records total). |
| Message filters mostly broken | `filter.status`, `filter.from`, `filter.type` on GET /v2/whatsapp/messages are silently ignored. Only `filter.wabaId` and `filter.to` work server-side. Post-filter client-side for everything else. |
| Campaign→messages lag | Bulk campaign sends via the dashboard are not instantly reflected in GET /v2/whatsapp/messages; allow propagation time. |
| No bulkMessages API | There is no bulk-send endpoint in the public v2 API. Campaign sends are dashboard-only. |
| `filterUnsubscribed` not on `sendDirectly` | Available on POST /v2/whatsapp/messages only, not on the sendDirectly variant. |
| Template PATCH is full replacement | Every PATCH must include ALL components even when changing only one. |
| Phone number ID path broken | GET /v2/whatsapp/phoneNumbers/{PHONE_NUMBER_ID} returns 404. Use `/{wabaId}/{phoneNumber}` instead. |
| Unsubscribers has cursor + offset | The only endpoint returning both pagination styles simultaneously. |
| Balance is always USD | GET /v2/balance returns USD regardless of WABA billing currency. |

## Endpoint Quick-Table

| Area | Key Endpoints |
|---|---|
| Messages | POST /v2/whatsapp/messages, POST /v2/whatsapp/messages/sendDirectly, GET /v2/whatsapp/messages, GET /v2/whatsapp/messages/{id} |
| Templates | GET/POST /v2/whatsapp/templates, GET/PATCH/DELETE /v2/whatsapp/templates/{wabaId}/{name}/{lang} |
| Phone Numbers | GET /v2/whatsapp/phoneNumbers, GET /v2/whatsapp/phoneNumbers/{wabaId}/{phone} |
| WABA | GET /v2/whatsapp/businessAccounts, GET /v2/whatsapp/businessAccounts/{id} |
| Wallet | GET /v2/balance (only wallet endpoint; /v2/wallets and /v2/me return 404) |
| Webhooks | GET/POST /v2/webhookEndpoints, GET/PATCH/DELETE /v2/webhookEndpoints/{id} |
| Contacts | GET /v2/contact/contacts, GET /v2/contact/contacts/{id} |
| Unsubscribers | GET/POST /v2/unsubscribers, GET/DELETE /v2/unsubscribers/{customer}/{channel} |
| Media | POST /v2/whatsapp/media/{phoneNumber}/upload |

## Routing Table

| Intent | Reference | Use for |
|---|---|---|
| Full endpoint details, curl examples, response shapes, field tables | reference/v2-rest-reference.md | All v2 API endpoint usage |
| Pagination algorithm, filter gotchas, behavior deviations | reference/v2-rest-reference.md#known-api-behavior-deviations | Debugging unexpected API responses |
| Template send/deliver/read analytics (computed) | reference/v2-rest-reference.md#computing-template-analytics-no-dedicated-endpoint | Building template performance reports |
| Webhook event types and registration | reference/v2-rest-reference.md#webhooks | Setting up delivery status tracking |
| Opt-out list and pre-send check | reference/v2-rest-reference.md#unsubscribers-opt-outs | Suppression logic before sends |
| Feature-gated / unavailable endpoints | reference/v2-rest-reference.md#feature-gated-and-unavailable-endpoints | Confirming what 403/404s mean |
