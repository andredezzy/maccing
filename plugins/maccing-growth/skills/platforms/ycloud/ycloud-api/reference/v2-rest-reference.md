## Contents

- [Overview and Auth](#overview-and-auth)
- [Messages](#messages)
  - [Endpoint Table](#endpoint-table)
  - [Send a Message (POST /v2/whatsapp/messages)](#send-a-message-post-v2whatsappmessages)
  - [List Messages (GET /v2/whatsapp/messages)](#list-messages-get-v2whatsappmessages)
  - [Retrieve Single Message (GET /v2/whatsapp/messages/{id})](#retrieve-single-message-get-v2whatsappmessagesid)
  - [Inbound Messages](#inbound-messages)
  - [Computing Template Analytics (No Dedicated Endpoint)](#computing-template-analytics-no-dedicated-endpoint)
- [Templates](#templates)
  - [Endpoint Table](#endpoint-table-1)
  - [List Templates (GET /v2/whatsapp/templates)](#list-templates-get-v2whatsapptemplates)
  - [Retrieve Single Template (GET /v2/whatsapp/templates/{wabaId}/{name}/{language})](#retrieve-single-template-get-v2whatsapptemplateswabaidnamelanguage)
  - [Create Template (POST /v2/whatsapp/templates)](#create-template-post-v2whatsapptemplates)
  - [Edit Template (PATCH /v2/whatsapp/templates/{wabaId}/{name}/{language})](#edit-template-patch-v2whatsapptemplateswabaidnamelanguage)
  - [Delete Template (DELETE /v2/whatsapp/templates/{wabaId}/{name}/{language})](#delete-template-delete-v2whatsapptemplateswabaidnamelanguage)
- [Phone Numbers and WABA](#phone-numbers-and-waba)
  - [Endpoint Table](#endpoint-table-2)
  - [Phone Number: Known Limitation](#phone-number-known-limitation)
  - [List Phone Numbers (GET /v2/whatsapp/phoneNumbers)](#list-phone-numbers-get-v2whatsappphonenumbers)
  - [Retrieve Single Phone Number (GET /v2/whatsapp/phoneNumbers/{wabaId}/{phoneNumber})](#retrieve-single-phone-number-get-v2whatsappphonenumberswabaidphonenumber)
  - [Update Profile (PATCH /v2/whatsapp/phoneNumbers/{wabaId}/{phoneNumber}/profile)](#update-profile-patch-v2whatsappphonenumberswabaidphonenumberprofile)
  - [WABA (GET /v2/whatsapp/businessAccounts)](#waba-get-v2whatsappbusinessaccounts)
- [Wallet and Billing](#wallet-and-billing)
  - [Endpoint Table](#endpoint-table-3)
  - [Check Balance (GET /v2/balance)](#check-balance-get-v2balance)
- [Webhooks](#webhooks)
  - [Endpoint Table](#endpoint-table-4)
  - [List Webhooks (GET /v2/webhookEndpoints)](#list-webhooks-get-v2webhookendpoints)
  - [Key Webhook Event Types](#key-webhook-event-types)
- [Contacts](#contacts)
  - [Endpoint Table](#endpoint-table-5)
  - [List Contacts (GET /v2/contact/contacts)](#list-contacts-get-v2contactcontacts)
- [Unsubscribers (Opt-Outs)](#unsubscribers-opt-outs)
  - [Endpoint Table](#endpoint-table-6)
  - [List Unsubscribers (GET /v2/unsubscribers)](#list-unsubscribers-get-v2unsubscribers)
  - [Check Opt-Out Status (GET /v2/unsubscribers/{customer}/{channel})](#check-opt-out-status-get-v2unsubscriberscustomerchannel)
- [Media](#media)
  - [Endpoint Table](#endpoint-table-7)
  - [Upload Media (POST /v2/whatsapp/media/{phoneNumber}/upload)](#upload-media-post-v2whatsappmediaphonenumberupload)
- [Feature-Gated and Unavailable Endpoints](#feature-gated-and-unavailable-endpoints)
- [Known API Behavior Deviations](#known-api-behavior-deviations)

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

> ⚠️ **Operator-only for broadcasts.** This endpoint is fine for single transactional/inbox replies, but the
> agent MUST NOT loop it (or `sendDirectly`) over a recipient list to fire a marketing campaign — the
> campaign/broadcast send is ALWAYS operator-executed in the dashboard UI, never automated. See `ycloud-api`
> SKILL doctrine note + `whatsapp` skill → `sending-and-scale.md` §6.

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

[verified live 2026-06] Paginate via `page` (NOT `offset` — `?offset=N` is silently ignored; every offset returns the same newest page). `limit` max 100. Default sort: newest-first by `createTime`.

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

Moved to `../../ycloud/reference/api-automation.md` — see "Computing Template Analytics (No Dedicated Endpoint)" appended near the reconciliation-loop content.

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

Both `messagingLimit` and `whatsappBusinessManagerMessagingLimit` fields are present and typically return the same tier value (e.g. TIER_2K); they can diverge if the number limit differs from the portfolio limit. [verified live 2026-06] Tier upgrades automatically as send volume and quality rating remain healthy. Webhook `whatsapp.phone_number.quality_updated` fires on tier or quality changes. [from docs]

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

`lastMessageToPhoneNumber` is the YCloud sender number that last reached this contact. Custom contact attributes may be unavailable (GET /v2/contact/attributes returns 404 when the feature is not active). [verified live 2026-06]

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
