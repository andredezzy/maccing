> ⚠️ **Everything below sends. A bulk campaign/broadcast send is ALWAYS operator-executed — never loop these calls over a recipient list.** Full rule: [SKILL.md → Send Doctrine](../SKILL.md#send-doctrine--read-this-before-the-routing-table).

## Contents

- [Recommended Library: @great-detail/whatsapp](#recommended-library-great-detailwhatsapp)
- [Basic Setup](#basic-setup)
- [Send Text Message](#send-text-message)
- [Send Template Message](#send-template-message)
- [Upload and Send Media](#upload-and-send-media)
- [Webhook Handler (Express)](#webhook-handler-express)
- [Raw axios/fetch approach (no SDK)](#raw-axiosfetch-approach-no-sdk)
- [Environment Variables](#environment-variables)
- [Integration Patterns: E-Commerce Order Lifecycle](#e-commerce-order-lifecycle)
- [Integration Patterns: Lead Nurturing via CTWA](#lead-nurturing-via-ctwa)
- [Integration Patterns: Customer Support](#customer-support)
- [Integration Patterns: CRM Integration Pattern](#crm-integration-pattern)

## 10. Node.js / TypeScript Integration

### Recommended Library: @great-detail/whatsapp

The official Meta Node.js SDK (`WhatsApp/WhatsApp-Nodejs-SDK`) was **archived in June 2023**. Use the active community fork instead:

```bash
npm install @great-detail/whatsapp
# or
bun add @great-detail/whatsapp
```

Compatible with Node.js v22+, Deno v2.4+, Bun v1.2+. Built for Cloud API v23 — the client hard-defaults `graphVersion` to `v23.0` (verified in `@great-detail/whatsapp@9.1.0`), so every SDK call below hits `https://graph.facebook.com/v23.0/…` unless you override it:

```typescript
const sdk = new Client({ graphVersion: 'v25.0', request: { /* ... */ } });
```

**Why these docs stay on v23.0.** The latest Graph API version is v26.0 (released July 29, 2026); v23.0 runs until **October 8, 2027**. We keep the raw-HTTP examples pinned to v23.0 so they agree with the SDK's own default — a doc-wide bump would silently disagree with every SDK snippet in this skill and buy nothing, since the one version-gated payload change that matters (statuses webhooks omit the `conversation` object from v24.0+) is called out explicitly in `webhooks.md` rather than implied by a URL. Revisit before mid-2027.

### Basic Setup

```typescript
import Client from '@great-detail/whatsapp';

const sdk = new Client({
  request: {
    headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}` }
  }
});
```

### Send Text Message

```typescript
const message = await sdk.message.createMessage({
  phoneNumberID: process.env.WA_PHONE_NUMBER_ID!,
  to: '5511999999999',
  type: 'text',
  text: { body: 'Hello from TypeScript!' }
});

console.log('Message ID:', message.messages[0].id);
```

### Send Template Message

```typescript
const message = await sdk.message.createMessage({
  phoneNumberID: process.env.WA_PHONE_NUMBER_ID!,
  to: '5511999999999',
  type: 'template',
  template: {
    name: 'order_shipped_v2',
    language: { code: 'pt_BR' },
    components: [{
      type: 'body',
      parameters: [
        { type: 'text', text: 'João' },
        { type: 'text', text: 'ORD-4521' },
        { type: 'text', text: '5 de maio' },
        { type: 'text', text: 'https://track.example.com/abc' }
      ]
    }]
  }
});
```

### Upload and Send Media

```typescript
import fs from 'fs';

// Upload
const fileBuffer = fs.readFileSync('./invoice.pdf');
const upload = await sdk.media.upload({
  phoneNumberID: process.env.WA_PHONE_NUMBER_ID!,
  mimeType: 'application/pdf',
  file: fileBuffer
});

// Send using media ID
await sdk.message.createMessage({
  phoneNumberID: process.env.WA_PHONE_NUMBER_ID!,
  to: '5511999999999',
  type: 'document',
  document: {
    id: upload.id,
    filename: 'invoice.pdf',
    caption: 'Your invoice is attached'
  }
});
```

### Webhook Handler (Express)

```typescript
import express from 'express';
import Client from '@great-detail/whatsapp';

const app = express();
const sdk = new Client({
  request: { headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}` } }
});

// Webhook verification (GET).
// `register()` returns a Promise. Without `await`, `reg` is a pending Promise,
// `reg.verifyToken` is `undefined`, the comparison is always true, and every
// legitimate verification request is rejected — the endpoint never passes
// Meta's handshake. (In TypeScript it also will not compile.)
app.get('/webhook', async (req, res) => {
  const reg = await sdk.webhook.register({
    method: req.method,
    query: req.query as Record<string, string>,
    body: req.body,
    headers: req.headers as Record<string, string>
  });

  if (reg.verifyToken !== process.env.WEBHOOK_VERIFY_TOKEN) {
    reg.reject();              // returns void — you set the status code
    return res.sendStatus(403);
  }
  return res.end(reg.accept()); // accept() returns the hub.challenge string
});

// Webhook event handling (POST).
// `eventNotification()` and `verifySignature()` are both async. An unawaited
// `verifySignature()` rejects in the background while the handler goes on to
// accept a forged payload — await it and fail closed.
app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const event = await sdk.webhook.eventNotification({
    method: req.method,
    query: req.query as Record<string, string>,
    body: req.body.toString(),
    headers: req.headers as Record<string, string>
  });

  try {
    await event.verifySignature(process.env.APP_SECRET!);
  } catch {
    return res.sendStatus(401);
  }

  // Return 200 immediately (accept() returns void)
  event.accept();
  res.sendStatus(200);

  // Process async
  processEvent(event.eventNotification).catch(console.error);
});

async function processEvent(notification: unknown) {
  // Handle incoming messages, status updates, etc.
}
```

### Raw axios/fetch approach (no SDK)

```typescript
const BASE_URL = `https://graph.facebook.com/v23.0/${process.env.WA_PHONE_NUMBER_ID}`;

async function sendMessage(payload: object): Promise<{ id: string }> {
  const response = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new WhatsAppError(error.error.code, error.error.message);
  }

  const data = await response.json();
  return data.messages[0];
}
```

### Environment Variables

```bash
WA_PHONE_NUMBER_ID=          # Phone number ID (not the phone number itself)
WA_BUSINESS_ACCOUNT_ID=      # WhatsApp Business Account ID
WA_ACCESS_TOKEN=             # System user permanent token
APP_SECRET=                  # App secret for webhook signature verification
WEBHOOK_VERIFY_TOKEN=        # Your custom token for webhook verification
```

---


---

## 17. Integration Patterns

### E-Commerce: Order Lifecycle

```
Order Placed
  → [Utility Template] Order confirmation with order number
  → [Utility Template] Shipping notification with tracking link
  → [Utility Template] Delivery confirmation
  → [Service] Handle any customer replies (free in CSW)
  → [Marketing Template] Post-delivery review request (after 3 days)
```

### Lead Nurturing via CTWA

```
User clicks CTWA ad
  → 72-hour free window opens
  → [Marketing Template] Welcome + catalog link
  → [Interactive Buttons] Quick responses (pricing, demo, help)
  → [Flow] Qualification form
  → Human handoff or automated follow-up
```

### Customer Support

```
User sends message
  → 24-hour CSW opens (free window)
  → Bot handles FAQ, order lookup, returns
  → [Interactive Lists] Department routing
  → Human agent for complex issues
  → [Utility Template] Follow-up summary (if within CSW, free)
```

### CRM Integration Pattern

There is no `identity` object on a message. The BSUID lives in two flat properties of the webhook `value` block: `contacts[].user_id` and `messages[].from_user_id`. The phone number (`contacts[].wa_id`, `messages[].from`) is the field that can go missing — it is omitted once a user adopts a username and you have not interacted with them recently — so key the CRM on the BSUID and treat the phone as an attribute.

```typescript
// On incoming message webhook — operate on entry[].changes[].value,
// not on a bare message: contacts[] is a sibling of messages[], not a child.
async function handleIncomingMessage(value: WaMessageValue) {
  const contact = value.contacts?.[0];
  const message = value.messages![0];

  // BSUID is always present; the phone number can be omitted.
  const bsuid = message.from_user_id ?? contact?.user_id;

  // Upsert contact in CRM, keyed on BSUID
  await crm.upsertContact({
    bsuid,
    phone: message.from ?? contact?.wa_id,   // may be undefined
    username: contact?.profile?.username,    // only if the user adopted one
    name: contact?.profile?.name
  });

  // Record interaction
  await crm.addInteraction({
    contactBsuid: bsuid,
    channel: 'whatsapp',
    direction: 'inbound',
    content: message.text?.body,
    timestamp: new Date(parseInt(message.timestamp) * 1000)
  });

  // Trigger automation
  await automationEngine.trigger('whatsapp_message_received', {
    contact: bsuid,
    message
  });
}
```

In **status** webhooks the same identifier appears as `statuses[].recipient_user_id` (always set) alongside `recipient_id` (the phone, which can be omitted). If you have parent BSUIDs enabled, `from_parent_user_id` / `parent_user_id` / `recipient_parent_user_id` carry the portfolio-spanning variant.

---

