## Contents

- [Webhook Events](#webhook-events)
- [Incoming Text Message Payload](#incoming-text-message-payload)
- [Incoming Media Message Payload](#incoming-media-message-payload)
- [Interactive Button Reply Payload](#interactive-button-reply-payload)
- [Interactive List Reply Payload](#interactive-list-reply-payload)
- [Status Update Payload](#status-update-payload)
- [BSUID: Critical Change (June 2026)](#bsuid-critical-change-june-2026)
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

> Media payloads contain only a `media_id`, not the actual file. You must call the media API to get the download URL, which expires in ~5 minutes.

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
          "conversation": {
            "id": "CONVERSATION_ID",
            "origin": { "type": "utility" }
          },
          "pricing": {
            "billable": true,
            "pricing_model": "PMP",
            "category": "utility"
          }
        }]
      }
    }]
  }]
}
```

Status progression: `sent` → `delivered` → `read` (or `failed`)

### BSUID: Critical Change (June 2026)

Starting June 2026, the `from` field in webhooks may contain a **Business-Scoped User ID (BSUID)** instead of a phone number when users have opted into usernames. BSUID format: `CC.alphanumeric` (e.g., `BR.1A2B3C4D5E6F7G8H9I0J`).

**Action required:** Store both phone number AND BSUID in your CRM. Update all webhook handlers to accept both formats in the `from`/`wa_id` fields.

As of March 31, 2026, a new `identity.user_id` field is included in all message webhooks — this is the BSUID.

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

**Critical March 2026 change:** Meta switched the Certificate Authority for mTLS webhooks on March 31, 2026. Update your trust store with `meta-outbound-api-ca-2025-12.pem` to maintain delivery.

### Webhook Production Best Practices

1. **Return HTTP 200 immediately** — process async. Meta's timeout is 5-10 seconds; slow responses cause retries and duplicate events.
2. **Idempotency is mandatory** — Meta delivers at-least-once. Store processed message IDs with 24h TTL and deduplicate.
3. **Queue-first architecture:** `receive webhook → enqueue → 200 OK → process from queue`
4. **Iterate all arrays** — `entry`, `changes`, `messages`, `statuses` are all arrays; never assume single elements.
5. **Meta retries** for up to 7 days with exponential backoff. A 30-minute outage will deliver all missed webhooks when you come back.
6. **Download media quickly** — media download URLs expire in approximately 5 minutes.
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

