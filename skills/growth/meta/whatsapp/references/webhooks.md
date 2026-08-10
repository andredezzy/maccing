## Contents

- [Webhook Events](#webhook-events)
- [Incoming Text Message Payload](#incoming-text-message-payload)
- [Incoming Media Message Payload](#incoming-media-message-payload)
- [Interactive Button Reply Payload](#interactive-button-reply-payload)
- [Interactive List Reply Payload](#interactive-list-reply-payload)
- [Status Update Payload](#status-update-payload)
- [BSUID: Business-Scoped User IDs](#bsuid-business-scoped-user-ids)
- [Signature Verification (Node.js)](#signature-verification-nodejs)
- [Webhook Production Best Practices](#webhook-production-best-practices)

## 8. Webhooks & Incoming Messages

### Webhook Events

You receive two types of webhook notifications:

1. **Incoming messages:** Customer sent you a message
2. **Status updates:** Your sent message changed status (sent → delivered → read → failed)

### Incoming Text Message Payload

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15551234567",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": { "name": "João Silva" },
          "wa_id": "5511999999999"
        }],
        "messages": [{
          "id": "wamid.abc123",
          "from": "5511999999999",
          "timestamp": "1704067200",
          "type": "text",
          "text": { "body": "Where is my order?" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### Incoming Media Message Payload

```json
{
  "messages": [{
    "id": "wamid.xyz789",
    "from": "5511999999999",
    "type": "image",
    "image": {
      "id": "MEDIA_ID_123456",
      "mime_type": "image/jpeg",
      "sha256": "HASH_VALUE",
      "caption": "Here is the receipt"
    }
  }]
}
```

> Media payloads contain only a media ID, not the file. Call the media API to get a download URL, which expires after 5 minutes. The **ID itself expires after 7 days** — media IDs arriving in webhooks live half as long as the 30 days you get on media you uploaded. Download the bytes to your own storage on receipt; do not treat the webhook's media ID as durable. See `media.md` → **Media ID Lifetimes**.

### Interactive Button Reply Payload

```json
{
  "messages": [{
    "type": "interactive",
    "interactive": {
      "type": "button_reply",
      "button_reply": {
        "id": "confirm_pickup",
        "title": "Pick Up Now"
      }
    }
  }]
}
```

### Interactive List Reply Payload

```json
{
  "messages": [{
    "type": "interactive",
    "interactive": {
      "type": "list_reply",
      "list_reply": {
        "id": "track_order",
        "title": "Track Order",
        "description": "Check delivery status"
      }
    }
  }]
}
```

### Status Update Payload

```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "statuses": [{
          "id": "wamid.abc123",
          "status": "delivered",
          "timestamp": "1704067300",
          "recipient_id": "5511999999999",
          "recipient_user_id": "BR.13491208655302741918",
          "conversation": {
            "id": "CONVERSATION_ID",
            "origin": { "type": "utility" }
          },

          "pricing": {
            "billable": true,
            "pricing_model": "PMP",
            "type": "regular",
            "category": "utility"
          }
        }]
      }
    }]
  }]
}
```

Status progression: `sent` → `delivered` → `read` (or `failed`). `played` is a sixth value, fired the first time a voice message is played. A message can skip `delivered` when it is delivered and read in the same instant — do not treat a missing `delivered` as a failure.

**Deciding billability — read `pricing.type`, not `billable`.**

| `pricing.type` | Meaning |
|---|---|
| `regular` | Billable. `pricing.category` gives the rate applied. |
| `free_customer_service` | Free: a utility template or a non-template message sent inside an open customer service window. |
| `free_entry_point` | Free: sent inside an open free-entry-point window. |

`pricing.billable` is deprecated and will be removed in a future versioned release; Meta's instruction is to use `pricing.type` together with `pricing.category`. `pricing.category` values: `authentication`, `authentication-international`, `marketing`, `marketing_lite`, `referral_conversion`, `service`, `utility`. `pricing_model` is `PMP` (per-message pricing) for everything after July 1, 2025; `CBP` only appears on webhooks sent before that date.

The `pricing` object is included with the `sent` status **and** with exactly one of `delivered` / `read` — never both — so it reaches you twice per message. Same for `conversation`. A ledger that sums every status webhook carrying `pricing` double-counts; dedupe on `statuses[].id`. (`conversation.expiration_timestamp`, when the object is present at all, only appears on the `sent` status.)

**The `conversation` object is gone from v24.0.** From v24.0 onward it is omitted entirely unless the webhook describes a message sent inside an open free-entry-point window (where its `id` is unique per window). On v23.0 and lower it is present with an `id` that is unique per message. Anything reading `conversation.id` or `conversation.origin.type` to classify traffic silently stops working on the version bump — classify from `pricing.category` instead, which is always there when the message is billed.

### BSUID: Business-Scoped User IDs

To support optional WhatsApp usernames, Meta began including a **Business-Scoped User ID (BSUID)** in webhooks in **early April 2026**. A BSUID is unique per (business portfolio, user) pair, formatted as an ISO 3166 alpha-2 country code, a period, then up to 128 alphanumeric characters — e.g. `BR.13491208655302741918`. It regenerates if the user changes phone number, which fires a system messages webhook.

**The BSUID is not nested under an `identity` object — there is no such object.** It arrives in flat, purpose-named properties:

| Webhook | Phone number (can be omitted) | BSUID (always present) |
|---|---|---|
| Incoming messages | `contacts[].wa_id`, `messages[].from` | `contacts[].user_id`, `messages[].from_user_id` |
| Status messages | `contacts[].wa_id`, `statuses[].recipient_id` | `contacts[].user_id`, `statuses[].recipient_user_id` |

If your portfolio is enrolled for parent BSUIDs, the same values appear again as `parent_user_id` / `from_parent_user_id` / `recipient_parent_user_id`, formatted with `ENT` in the middle (`US.ENT.11815799212886844830`).

**The field that disappears is the phone number, not the reverse.** Once a user adopts a username, `wa_id` / `from` / `recipient_id` are omitted unless one of these holds: you messaged or called that phone number in the last 30 days *from that same business phone number*; they messaged or called you in that window; or they are in your contact book. For `failed` status webhooks the `contacts` block is omitted altogether, and `recipient_user_id` is omitted if you had sent to a phone number.

**Action required:** key your CRM on the BSUID and carry the phone number as an optional attribute. A handler that reads `from` and assumes a phone number will start receiving `undefined`. Sending *to* a BSUID is a separate capability that Meta scheduled for July 2026.

### Signature Verification (Node.js)

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  rawBody: string,
  signature: string | undefined,
  appSecret: string
): boolean {
  if (!signature) return false;

  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
  } catch {
    return false;
  }
}

// Usage in Express (MUST use raw body — before json() middleware):
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-hub-signature-256'] as string;
  const rawBody = req.body.toString();

  if (!verifyWebhookSignature(rawBody, sig, process.env.APP_SECRET!)) {
    return res.sendStatus(401);
  }

  // Return 200 IMMEDIATELY, process async
  res.status(200).send('OK');

  const payload = JSON.parse(rawBody);
  processWebhookAsync(payload).catch(console.error);
});
```

**mTLS CA rotation — only if you enabled mTLS.** Mutual TLS is an opt-in setting on your WhatsApp Business Account webhook subscription, and most integrations never turn it on. If you did not enable it, nothing here affects your delivery; the HMAC check above is your authentication. If you *did*: Meta's client certificate is now signed by a Meta-owned CA, replacing the DigiCert-signed certificate that expired **April 15, 2026**. Install `meta-outbound-api-ca-2025-12.pem` in your server or load-balancer trust store and verify the client certificate's common name is `client.webhooks.fbclientcerts.com`. Meta publishes the PEM and Nginx/AWS ALB recipes at [mTLS for webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started#mtls-for-webhooks). The alternative to mTLS is IP allowlisting, which Meta discourages because its ranges change.

### Webhook Production Best Practices

1. **Return HTTP 200 immediately** — process async. Meta's timeout is 5-10 seconds; slow responses cause retries and duplicate events.
2. **Idempotency is mandatory** — Meta delivers at-least-once. Store processed message IDs with 24h TTL and deduplicate.
3. **Queue-first architecture:** `receive webhook → enqueue → 200 OK → process from queue`
4. **Iterate all arrays** — `entry`, `changes`, `messages`, `statuses` are all arrays; never assume single elements.
5. **Meta retries** for up to 7 days with exponential backoff. A 30-minute outage will deliver all missed webhooks when you come back.
6. **Download media quickly** — the download URL expires in ~5 minutes, and an inbound media ID expires after 7 days.
7. **Never use `JSON.parse(req.body)`** for signature verification — use raw buffer before parsing.

```typescript
// Queue-first architecture (BullMQ example)
import { Queue } from 'bullmq';

const whatsappQueue = new Queue('whatsapp-webhooks');

app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  if (!verifyWebhookSignature(req.body.toString(), req.headers['x-hub-signature-256'] as string, process.env.APP_SECRET!)) {
    return res.sendStatus(401);
  }

  await whatsappQueue.add('process', JSON.parse(req.body.toString()), {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  });

  res.status(200).send('OK');
});
```

---

