# YCloud v2 REST API Reference

YCloud is a BSP (Business Solution Provider) that wraps Meta's WhatsApp Business API and exposes a unified REST interface at `https://api.ycloud.com/v2`. This document merges live-probe ground truth (confirmed June 2026 against a live YCloud account) with the YCloud documentation catalog. Behaviors tagged [verified live 2026-06] were confirmed empirically; every identifier shown (`WABA_ID`, `PHONE_NUMBER_ID`, +15551234567, display name "My Brand") is a placeholder standing in for a real value.

---

## Overview and Auth

Base URL: `https://api.ycloud.com/v2`

Authentication: every request must include the header `X-API-Key: <your-api-key>`. No OAuth, no Bearer token, no per-resource scoping, one key grants full read and write access to all resources.

```bash
curl -s -H "X-API-Key: $KEY" https://api.ycloud.com/v2/balance
```

All responses are JSON. List endpoints return a standard envelope:

```json
{
  "offset": 0,
  "limit": 20,
  "length": 3,
  "items": [ ... ]
}
```

`total` is only included when the request includes `includeTotal=true`. `length` is the count of items in the current page.

Pagination is offset-based: `page` (1–100) and `limit` (1–100) translate to `offset = (page - 1) * limit`. The maximum reachable offset is `(page_max - 1) * limit_max = (100 - 1) * 100 = 9,900` — i.e. up to ~10,000 records. Accounts with more than ~10,000 messages cannot page beyond that boundary using the current API. [verified live 2026-06]

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

## Messages

### Endpoint Table

| Path | Method | Purpose |
|---|---|---|
| /v2/whatsapp/messages | POST | Enqueue an outbound message (async) |
| /v2/whatsapp/messages/sendDirectly | POST | Send synchronously (blocks until Meta confirms) |
| /v2/whatsapp/messages | GET | List outbound messages with pagination |
| /v2/whatsapp/messages/{id} | GET | Retrieve a single message by YCloud ID or wamid |
| /v2/whatsapp/inboundMessages/{id}/markAsRead | POST | Mark an inbound message as read |

### Send a Message (POST /v2/whatsapp/messages)

Enqueues a message for async delivery. Returns immediately with a YCloud message ID. Actual delivery happens asynchronously; status updates arrive via webhook (`whatsapp.message.updated`). [from docs]

Key request body fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| from | string | Yes | Sender E.164 phone number |
| to | string | Yes | Recipient E.164 phone number |
| type | enum | Yes | template, text, image, audio, video, document, sticker, location, interactive, contacts, reaction |
| template | object | When type=template | name, language, components with parameters |
| filterUnsubscribed | bool | No | Skip send if recipient is in unsubscriber list |
| filterBlocked | bool | No | Skip send if recipient is blocked |
| externalId | string | No | Your own correlation ID |
| context | object | No | Reply-to: `{messageId}` |

`filterUnsubscribed` and `filterBlocked` are NOT available on `sendDirectly`. [from docs]

```bash
# Send a template message (async enqueue, SAFETY: do NOT run against live account)
curl -s -X POST https://api.ycloud.com/v2/whatsapp/messages \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+15551234567",
    "to": "+5511999999999",
    "type": "template",
    "template": {
      "name": "welcome_template",
      "language": { "code": "pt_BR" },
      "components": []
    },
    "filterUnsubscribed": true
  }'
```

Response shape:

```json
{
  "id": "63c...objectid",
  "wamid": "wamid.HBg...",
  "status": "sent",
  "from": "+15551234567",
  "to": "+5511999999999",
  "wabaId": "WABA_ID",
  "type": "template",
  "createTime": "2026-06-01T10:00:00Z",
  "updateTime": "2026-06-01T10:00:01Z",
  "totalPrice": 0.0625,
  "pricingCategory": "marketing_lite",
  "pricingModel": "PMP",
  "currency": "USD",
  "regionCode": "BR",
  "bizType": "normal"
}
```

### List Messages (GET /v2/whatsapp/messages)

[verified live 2026-06] Pagination is offset-based (`page` + `limit`). Default sort: newest-first by `createTime`.

Critical live behavior deviation from docs: `filter.status`, `filter.from`, and `filter.type` query params are silently IGNORED by the server. Passing `filter.status=sent` returns all messages regardless. Only `filter.wabaId` and `filter.to` are applied server-side. Client-side post-filtering is required for all other dimensions. [verified live 2026-06]

Query parameters:

| Param | Effect | Notes |
|---|---|---|
| page | Page number 1–100 | [verified live 2026-06] |
| limit | Items per page 1–100 | [verified live 2026-06] |
| includeTotal | bool: include `total` in response | [from docs] |
| filter.wabaId | Filter by WABA ID | Works server-side [verified live 2026-06] |
| filter.to | Filter by recipient phone (E.164) | Works server-side [verified live 2026-06] |
| filter.status | Filter by status | Silently ignored [verified live 2026-06] |
| filter.from | Filter by sender phone | Silently ignored [verified live 2026-06] |
| filter.type | Filter by message type | Silently ignored [verified live 2026-06] |

```bash
# List last 10 messages
curl -s "https://api.ycloud.com/v2/whatsapp/messages?page=1&limit=10&includeTotal=true" \
  -H "X-API-Key: $KEY"
```

Each item in `items` contains: [verified live 2026-06]

```json
{
  "id": "63c...objectid",
  "wamid": "wamid.HBg...",
  "status": "read",
  "from": "+15551234567",
  "to": "+5511999999999",
  "wabaId": "WABA_ID",
  "type": "template",
  "template": {
    "name": "invite_template",
    "language": "pt_BR",
    "components": [ ... ]
  },
  "createTime": "2026-06-01T10:00:00Z",
  "updateTime": "2026-06-01T10:00:05Z",
  "sendTime": "2026-06-01T10:00:01Z",
  "deliverTime": "2026-06-01T10:00:03Z",
  "readTime": "2026-06-01T10:00:05Z",
  "totalPrice": 0.0625,
  "pricingCategory": "marketing_lite",
  "pricingModel": "PMP",
  "currency": "USD",
  "regionCode": "BR",
  "bizType": "normal"
}
```

`status` values: `sent` (on WA servers, not yet on device), `delivered` (on device), `read` (opened), `failed`. [verified live 2026-06]

`pricingCategory` values seen in live data: `marketing_lite` (outbound template messages at $0.0625/msg), `service` (reactions and inbound-triggered messages). [verified live 2026-06]

### Retrieve Single Message (GET /v2/whatsapp/messages/{id})

Path parameter `id` can be YCloud's internal ObjectId-style ID or Meta's `wamid`. Both work. [verified live 2026-06] Returns full field set including all timestamps.

```bash
curl -s "https://api.ycloud.com/v2/whatsapp/messages/63cabc123def456" \
  -H "X-API-Key: $KEY"
```

Returns 404 when the ID does not exist.

### Inbound Messages

[UNAVAILABLE] There is no list endpoint for inbound messages. GET /v2/whatsapp/inboundMessages returns 404. [verified live 2026-06] Inbound messages are delivered exclusively via webhooks (`whatsapp.inbound_message.received` event).

The only inbound-message API action available is marking a message as read:

```bash
# Mark inbound message as read (also marks earlier messages in thread as read)
curl -s -X POST "https://api.ycloud.com/v2/whatsapp/inboundMessages/wamid.HBg.../markAsRead" \
  -H "X-API-Key: $KEY"
```

Path param `id` accepts either YCloud's internal ID or the `wamid` from Meta. [from docs]

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

---

## Templates

### Endpoint Table

| Path | Method | Purpose |
|---|---|---|
| /v2/whatsapp/templates | GET | List all templates |
| /v2/whatsapp/templates/{wabaId}/{name}/{language} | GET | Retrieve a single template |
| /v2/whatsapp/templates | POST | Create a new template |
| /v2/whatsapp/templates/{wabaId}/{name}/{language} | PATCH | Edit an existing template (full component replacement) |
| /v2/whatsapp/templates/{wabaId}/{name}/{language} | DELETE | Permanently delete a template |

### List Templates (GET /v2/whatsapp/templates)

[verified live 2026-06] Returns all templates with status, category, quality rating, components, and timestamps.

Query parameters:

| Param | Notes |
|---|---|
| filter.wabaId | Required when account manages >100 WABAs |
| filter.name | Exact name match |
| filter.language | e.g. `pt_BR` |
| filter.status | Comma-separated: PENDING, REJECTED, APPROVED, PAUSED, DISABLED, ARCHIVED, IN_APPEAL, DELETED |
| page, limit, includeTotal | Standard pagination |

```bash
curl -s "https://api.ycloud.com/v2/whatsapp/templates?filter.wabaId=WABA_ID" \
  -H "X-API-Key: $KEY"
```

Each template item: [verified live 2026-06]

```json
{
  "officialTemplateId": "TEMPLATE_ID",
  "wabaId": "WABA_ID",
  "name": "welcome_template",
  "language": "pt_BR",
  "category": "MARKETING",
  "status": "APPROVED",
  "qualityRating": "UNKNOWN",
  "messageSendTtlSeconds": -1,
  "components": [
    {
      "type": "BODY",
      "text": "...",
      "example": { "body_text": [ ["..."] ] }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "QUICK_REPLY", "text": "Parar mensagens" }
      ]
    }
  ],
  "statusUpdateEvent": "APPROVED",
  "createTime": "2026-05-20T00:00:00Z",
  "updateTime": "2026-05-21T00:00:00Z"
}
```

`qualityRating` field values: `UNKNOWN` (new templates or insufficient send volume), `GREEN`, `YELLOW`, `RED`. This is a Meta-assigned score, not a YCloud metric. New templates return `UNKNOWN` until Meta has enough send volume to score them. [verified live 2026-06]

The `QUICK_REPLY` button text "Parar mensagens" is the opt-out trigger. When a recipient taps it, YCloud automatically adds them to the unsubscribers list. [from docs]

### Retrieve Single Template (GET /v2/whatsapp/templates/{wabaId}/{name}/{language})

All three path parameters are required. Returns the same field set as the list endpoint but as a flat object (not wrapped in an `items` array). [from docs]

```bash
curl -s "https://api.ycloud.com/v2/whatsapp/templates/WABA_ID/welcome_template/pt_BR" \
  -H "X-API-Key: $KEY"
```

### Create Template (POST /v2/whatsapp/templates)

New templates enter `PENDING` status awaiting Meta review. [from docs]

Required fields: `wabaId`, `name` (max 512 chars, lowercase letters/numbers/underscores only), `language`, `category` (AUTHENTICATION, MARKETING, or UTILITY), `components` (array).

Optional fields: `subCategory` (ORDER_STATUS for UTILITY only), `messageSendTtlSeconds` (30–2592000, or -1 for 30-day default), `ctaUrlLinkTrackingOptedOut` (bool).

### Edit Template (PATCH /v2/whatsapp/templates/{wabaId}/{name}/{language})

PATCH replaces the `components` array entirely. Partial updates are not supported: include ALL components (BODY, FOOTER, BUTTONS) in every edit call even when only one is changing. [from docs] Templates in ARCHIVED status cannot be edited. Re-review may be triggered for APPROVED templates. [from docs]

### Delete Template (DELETE /v2/whatsapp/templates/{wabaId}/{name}/{language})

Permanent and irreversible. Returns 404 if the template does not exist. [from docs]

---

## Phone Numbers and WABA

### Endpoint Table

| Path | Method | Purpose |
|---|---|---|
| /v2/whatsapp/phoneNumbers | GET | List all phone numbers |
| /v2/whatsapp/phoneNumbers/{wabaId}/{phoneNumber} | GET | Retrieve a single phone number |
| /v2/whatsapp/phoneNumbers/{wabaId}/{phoneNumber}/register | POST | Register a number for messaging |
| /v2/whatsapp/phoneNumbers/{wabaId}/{phoneNumber}/displayName | PATCH | Request display name change |
| /v2/whatsapp/phoneNumbers/{wabaId}/{phoneNumber}/profile | PATCH | Update WhatsApp Business Profile |
| /v2/whatsapp/businessAccounts | GET | List WABAs |
| /v2/whatsapp/businessAccounts/{id} | GET | Retrieve a single WABA |

### Phone Number: Known Limitation

GET /v2/whatsapp/phoneNumbers/{id} using the numeric phone number ID (`PHONE_NUMBER_ID`) returns 404. [verified live 2026-06] Use the list endpoint and filter client-side by `id`, or use the two-segment path format `/{wabaId}/{phoneNumber}` which works correctly. [from docs]

### List Phone Numbers (GET /v2/whatsapp/phoneNumbers)

[verified live 2026-06]

```bash
curl -s "https://api.ycloud.com/v2/whatsapp/phoneNumbers?filter.wabaId=WABA_ID" \
  -H "X-API-Key: $KEY"
```

Each item: [verified live 2026-06]

```json
{
  "id": "PHONE_NUMBER_ID",
  "phoneNumber": "+15551234567",
  "displayPhoneNumber": "+55 11 98765-4321",
  "wabaId": "WABA_ID",
  "verifiedName": "My Brand",
  "qualityRating": "GREEN",
  "messagingLimit": "TIER_2K",
  "whatsappBusinessManagerMessagingLimit": "TIER_2K",
  "isOfficialBusinessAccount": false,
  "codeVerificationStatus": "VERIFIED",
  "status": "CONNECTED",
  "nameStatus": "APPROVED",
  "newNameStatus": null,
  "isOnBizApp": false
}
```

Key field reference:

| Field | Values | Meaning |
|---|---|---|
| qualityRating | GREEN, YELLOW, RED | Meta's per-number quality score based on opt-outs, blocks, and reports |
| messagingLimit | TIER_1K (legacy, pre-Oct-2025), TIER_2K, TIER_10K, TIER_100K, TIER_UNLIMITED | Business-initiated conversations per rolling 24h window. New accounts start at TIER_2K. |
| status | CONNECTED, DISCONNECTED, PENDING | API connection health |
| nameStatus | APPROVED, PENDING, REJECTED | Display name approval by Meta |
| isOfficialBusinessAccount | bool | Whether Meta has granted the green badge |
| codeVerificationStatus | VERIFIED, UNVERIFIED | Phone verification state |

Both `messagingLimit` and `whatsappBusinessManagerMessagingLimit` fields are present and typically the same value (e.g. TIER_2K). [verified live 2026-06] Tier upgrades automatically as send volume and quality rating remain healthy. Webhook `whatsapp.phone_number.quality_updated` fires on tier or quality changes. [from docs]

No per-number throughput statistics, rate-per-second, or current-window conversation count fields exist on this object. To check whether the tier limit is being approached, count recent messages in GET /v2/whatsapp/messages client-side.

### Retrieve Single Phone Number (GET /v2/whatsapp/phoneNumbers/{wabaId}/{phoneNumber})

Phone number must be URL-encoded E.164, e.g. `%2B15551234567`. Returns the same field set as the list endpoint as a flat object. [from docs]

```bash
curl -s "https://api.ycloud.com/v2/whatsapp/phoneNumbers/WABA_ID/%2B15551234567" \
  -H "X-API-Key: $KEY"
```

### Update Profile (PATCH /v2/whatsapp/phoneNumbers/{wabaId}/{phoneNumber}/profile)

Updates the WhatsApp Business Profile visible to users during conversations. [from docs]

| Field | Constraints |
|---|---|
| about | 1–139 characters |
| address | max 256 characters |
| description | max 512 characters |
| email | max 128 characters |
| profilePictureUrl | must be a previously uploaded URL on Meta's servers |
| vertical | enum: RETAIL, RESTAURANT, HOTEL, and 15 other options |
| websites | array, max 2 entries, each starting with http/https, max 255 chars each |

### WABA (GET /v2/whatsapp/businessAccounts)

[verified live 2026-06] Returns account-level metadata including business verification, payment, and messaging limit tier.

```bash
curl -s "https://api.ycloud.com/v2/whatsapp/businessAccounts/WABA_ID" \
  -H "X-API-Key: $KEY"
```

Single WABA response (flat object, not wrapped in `items`): [verified live 2026-06]

```json
{
  "id": "WABA_ID",
  "name": "My Brand",
  "currency": "USD",
  "messageTemplateNamespace": "...",
  "accountReviewStatus": "APPROVED",
  "businessId": "...",
  "businessStatus": "...",
  "businessName": "...",
  "businessVerificationStatus": "verified",
  "whatsappBusinessManagerMessagingLimit": "TIER_2K",
  "ownershipType": "CLIENT_OWNED",
  "primaryFundingId": "...",
  "timezoneId": "1",
  "paymentMethodAttached": true,
  "isOnBizApp": false,
  "removed": false
}
```

Notes on specific fields: [verified live 2026-06]

- `currency`: billing currency set at WABA creation time (e.g. USD, BRL, EUR). This is separate from the YCloud wallet currency (always USD).
- `timezoneId`: a numeric string corresponding to Meta's internal timezone list, not an IANA timezone name (e.g. `"1"` maps to a specific UTC offset). A lookup table is required to convert to human-readable timezone names.
- `accountReviewStatus`: APPROVED means Meta has reviewed and approved the WABA.
- `businessVerificationStatus`: `verified` means the underlying Facebook Business Manager has completed business verification.
- `paymentMethodAttached`: true means a payment method is on file with Meta.

---

## Wallet and Billing

### Endpoint Table

| Path | Method | Purpose |
|---|---|---|
| /v2/balance | GET | Retrieve current account credit balance |

All other wallet paths return 404. `/v2/wallets`, `/v2/wallet`, and `/v2/me` do not exist. [verified live 2026-06]

### Check Balance (GET /v2/balance)

[verified live 2026-06]

```bash
curl -s "https://api.ycloud.com/v2/balance" \
  -H "X-API-Key: $KEY"
```

Response:

```json
{
  "amount": 25.00,
  "currency": "USD"
}
```

The balance is always denominated in USD regardless of the WABA billing currency (which is set per WABA). This is the YCloud prepaid credit account, separate from any Meta billing. [verified live 2026-06]

At roughly $0.0625 per marketing message, a low prepaid balance can interrupt a send mid-campaign. Always check the balance before launching a bulk campaign. [verified live 2026-06]

No billing history, transaction log, or low-balance webhook threshold exists in the API. [verified live 2026-06]

---

## Webhooks

### Endpoint Table

| Path | Method | Purpose |
|---|---|---|
| /v2/webhookEndpoints | GET | List registered webhook endpoints |
| /v2/webhookEndpoints/{id} | GET | Retrieve a single webhook endpoint |
| /v2/webhookEndpoints | POST | Register a new webhook URL |
| /v2/webhookEndpoints/{id} | PATCH | Update webhook URL or subscribed events |
| /v2/webhookEndpoints/{id} | DELETE | Remove a webhook endpoint |
| /v2/webhookEndpoints/{id}/rotateSecret | POST | Rotate the webhook signing secret |

Note: GET /v2/whatsapp/webhookEndpoints (with whatsapp prefix) returns 404. The correct path is `/v2/webhookEndpoints` without the whatsapp prefix. [verified live 2026-06]

### List Webhooks (GET /v2/webhookEndpoints)

[verified live 2026-06] Returns an empty `items` array when no webhooks are registered.

```bash
curl -s "https://api.ycloud.com/v2/webhookEndpoints" \
  -H "X-API-Key: $KEY"
```

Each webhook item: [from docs]

```json
{
  "id": "wh_...",
  "url": "https://your-server.com/webhooks/ycloud",
  "status": "active",
  "events": [
    "whatsapp.message.updated",
    "whatsapp.inbound_message.received",
    "whatsapp.template.updated"
  ],
  "createTime": "2026-01-01T00:00:00Z"
}
```

### Key Webhook Event Types

| Event | Trigger |
|---|---|
| whatsapp.message.updated | Outbound message status changes: sent, delivered, read, failed |
| whatsapp.inbound_message.received | Any inbound message from a user (the only way to receive inbound messages) |
| whatsapp.template.updated | Template approval, rejection, or quality score change |
| whatsapp.phone_number.quality_updated | Phone number quality rating or messaging tier change |
| contact.unsubscribe.created | A user opts out (via STOP keyword or QUICK_REPLY opt-out button) |

Webhooks are the only mechanism for: receiving inbound messages, learning about opt-outs in real time, and tracking delivery status without polling. [from docs]

---

## Contacts

### Endpoint Table

| Path | Method | Purpose |
|---|---|---|
| /v2/contact/contacts | GET | List contacts (auto-created from inbound messages) |
| /v2/contact/contacts/{id} | GET | Retrieve a single contact |

Note: the path prefix is `/v2/contact/contacts` (contact singular in the prefix, contacts plural in the resource name). `/v2/contacts` returns 404. [verified live 2026-06]

### List Contacts (GET /v2/contact/contacts)

[verified live 2026-06] Contacts are auto-created when users send inbound WhatsApp messages to your number. 

```bash
curl -s "https://api.ycloud.com/v2/contact/contacts?page=1&limit=20" \
  -H "X-API-Key: $KEY"
```

Query filters: `filter.tags`, `filter.countryCode`, `filter.phoneNumber` (E.164), `filter.email`. [from docs]

Each contact item: [verified live 2026-06]

```json
{
  "id": "1234567890123456789",
  "nickname": "User Name",
  "phoneNumber": "+5511999999999",
  "countryCode": "BR",
  "countryName": "Brazil",
  "sourceType": "WHATSAPP",
  "lastSeen": "2026-06-03T12:00:00Z",
  "createTime": "2026-06-01T09:00:00Z",
  "lastMessageToPhoneNumber": "+15551234567"
}
```

`lastMessageToPhoneNumber` is the YCloud sender number that last reached this contact. Custom contact attributes may be unavailable (GET /v2/contact/attributes returns 404). [verified live 2026-06]

---

## Unsubscribers (Opt-Outs)

### Endpoint Table

| Path | Method | Purpose |
|---|---|---|
| /v2/unsubscribers | GET | List all opted-out contacts |
| /v2/unsubscribers/{customer}/{channel} | GET | Check if a specific phone is opted out |
| /v2/unsubscribers | POST | Manually add a phone to the opt-out list |
| /v2/unsubscribers/{customer}/{channel} | DELETE | Remove a phone from the opt-out list |

Note: `/v2/whatsapp/unsubscribers`, `/v2/whatsapp/optOuts`, and `/v2/whatsapp/unsubscribe` all return 404. The correct path is `/v2/unsubscribers`. [verified live 2026-06]

### List Unsubscribers (GET /v2/unsubscribers)

[verified live 2026-06] Returns an empty `items` array when there are no opt-outs.

```bash
curl -s "https://api.ycloud.com/v2/unsubscribers?filter.channel=whatsapp" \
  -H "X-API-Key: $KEY"
```

Response includes both offset-based pagination fields and a `cursor` object (even when empty). This is the only endpoint in the API that includes cursor pagination. [verified live 2026-06]

```json
{
  "offset": 0,
  "limit": 20,
  "length": 0,
  "items": [],
  "cursor": {}
}
```

Each unsubscriber item: [from docs, no live items to confirm]

```json
{
  "customer": "+5511999999999",
  "channel": "whatsapp",
  "regionCode": "BR",
  "createTime": "2026-06-01T10:00:00Z"
}
```

No `source` field linking the opt-out to a specific template. To attribute an opt-out to a template, correlate the `createTime` + `customer` phone number against your own send log. [verified live 2026-06]

### Check Opt-Out Status (GET /v2/unsubscribers/{customer}/{channel})

`customer` must be URL-encoded E.164. `channel` must be `whatsapp`. Returns 404 with body `{"message": "Unsubscriber not found."}` when the number is not opted out. [verified live 2026-06] Safe to use as a pre-send check.

```bash
curl -s "https://api.ycloud.com/v2/unsubscribers/%2B5511999999999/whatsapp" \
  -H "X-API-Key: $KEY"
```

Opt-outs are auto-created when: a user replies with opt-out keywords (e.g. STOP), or taps a `QUICK_REPLY` button with the "Parar mensagens" text (YCloud intercepts this response and registers the opt-out). [from docs]

---

## Media

### Endpoint Table

| Path | Method | Purpose |
|---|---|---|
| /v2/whatsapp/media/{phoneNumber}/upload | POST | Upload a media file for use in outbound messages |

### Upload Media (POST /v2/whatsapp/media/{phoneNumber}/upload)

Uploads images, documents, videos, or audio to Meta's servers. Files are encrypted and persist for 30 days. [from docs]

```bash
# Upload an image (SAFETY: do NOT run against live account without intent to send)
curl -s -X POST "https://api.ycloud.com/v2/whatsapp/media/%2B15551234567/upload" \
  -H "X-API-Key: $KEY" \
  -F "file=@/path/to/image.jpg"
```

Response:

```json
{ "id": "media-id-string" }
```

Only the first file is processed when multiple files are uploaded. Media IDs returned here can be referenced in outbound messages by their ID. Media IDs cannot be used for interactive message headers, which require direct public URLs instead. [from docs]

---

## Feature-Gated and Unavailable Endpoints

These endpoints are documented but may be unavailable / feature-gated:

| Path | Status | Reason |
|---|---|---|
| /v2/whatsapp/flows | 403 FORBIDDEN | WhatsApp Flows feature not enabled for this WABA [verified live 2026-06] |
| /v2/whatsapp/groups | 404 NOT_FOUND | WhatsApp Groups feature not enabled [verified live 2026-06] |
| /v2/sms | 403 ACCOUNT_LIMITED | SMS feature not enabled; contact YCloud support to activate [verified live 2026-06] |
| /v2/whatsapp/inboundMessages | 404 NOT_FOUND | No inbound message list endpoint exists in v2 [verified live 2026-06] |
| /v2/whatsapp/analytics | 404 NOT_FOUND | No aggregate analytics endpoint [verified live 2026-06] |
| /v2/whatsapp/conversationAnalytics | 404 NOT_FOUND | [UNAVAILABLE] [verified live 2026-06] |
| /v2/whatsapp/templatePerformanceMetrics | 404 NOT_FOUND | [UNAVAILABLE] [verified live 2026-06] |
| /v2/contact/attributes | 404 NOT_FOUND | Contact custom attributes not active (feature-gated) [verified live 2026-06] |
| /v2/wallets | 404 NOT_FOUND | Use /v2/balance instead [verified live 2026-06] |
| /v2/me | 404 NOT_FOUND | No account profile endpoint [verified live 2026-06] |

---

## Known API Behavior Deviations

These are cases where live behavior diverges from documentation or expected REST conventions. [verified live 2026-06 unless noted]

| Behavior | Details |
|---|---|
| Message filters silently ignored | `filter.status`, `filter.from`, `filter.type` on GET /v2/whatsapp/messages are accepted without error but do not filter results. Only `filter.wabaId` and `filter.to` work server-side. Client-side post-filtering is required for all other dimensions. |
| Phone number ID path returns 404 | GET /v2/whatsapp/phoneNumbers/PHONE_NUMBER_ID (numeric ID) returns 404. Use the list endpoint or the two-segment path /{wabaId}/{phoneNumber}. |
| Template PATCH is full replacement | PATCH on a template replaces the entire `components` array. Include all components in every request even when only one is changing. |
| WABA timezone is numeric, not IANA | The `timezoneId` field is a number string (e.g. "1") from Meta's internal list. Requires a lookup table. |
| Balance currency vs. WABA billing currency differ | GET /v2/balance always returns USD. WABA billing may be in a different currency, set per account. |
| Pagination capped at offset ~9,900 | `page` max is 100, `limit` max is 100. Max reachable offset: `(100-1) * 100 = 9,900` (~10,000 records). Accounts with >~10,000 messages cannot access older records via this API. |
| Unsubscribers endpoint has cursor AND offset | GET /v2/unsubscribers is the only list endpoint that includes a `cursor` object alongside standard offset pagination. |
| Single WABA endpoint returns flat object | GET /v2/whatsapp/businessAccounts/{id} returns a flat JSON object, not an `{items: [...]}` envelope. |

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
dashboard from a different IP than the account normally uses is a risk-control trigger, and this BSP
account was already false-positive-suspended once). Instead drive the SAME AdsPower profile that
operates the disposable BM, where YCloud is already logged in on the correct proxy, and call the
endpoints from inside that page (same origin, the cookie and proxy are applied automatically, nothing
to extract or store):

```python
import json, urllib.request
from playwright.sync_api import sync_playwright

ADS = "http://local.adspower.net:50325"
ws = json.load(urllib.request.urlopen(
    f"{ADS}/api/v1/browser/start?user_id=<PROFILE_ID>&headless=0"))["data"]["ws"]["puppeteer"]
with sync_playwright() as p:
    page = p.chromium.connect_over_cdp(ws).contexts[0].pages[0]
    if "ycloud.com" not in page.url:
        page.goto("https://www.ycloud.com/", wait_until="domcontentloaded")
    data = page.evaluate("""async () => {
        const r = await fetch('/api/whatsapp/batch/search', {method:'POST', credentials:'include',
            headers:{'Content-Type':'application/json'}, body: JSON.stringify({pageNo:1, pageSize:50})});
        return await r.json();
    }""")
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
