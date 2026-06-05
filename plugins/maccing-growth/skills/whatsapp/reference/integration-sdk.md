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

Compatible with Node.js v22+, Deno v2.4+, Bun v1.2+. Built for Cloud API v23.

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

// Webhook verification
app.get('/webhook', (req, res) => {
  const reg = sdk.webhook.register({
    method: req.method,
    query: req.query as Record<string, string>,
    body: req.body,
    headers: req.headers as Record<string, string>
  });

  if (reg.verifyToken !== process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.end(reg.reject());
  }
  return res.end(reg.accept());
});

// Webhook event handling
app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const event = sdk.webhook.eventNotification({
    method: req.method,
    query: req.query as Record<string, string>,
    body: req.body.toString(),
    headers: req.headers as Record<string, string>
  });

  event.verifySignature(process.env.APP_SECRET!);

  // Return 200 immediately
  res.end(event.accept());

  // Process async
  processEvent(event).catch(console.error);
});

async function processEvent(event: unknown) {
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

```typescript
// On incoming message webhook
async function handleIncomingMessage(message: WaMessage) {
  // Upsert contact in CRM
  await crm.upsertContact({
    phone: message.from,
    bsuid: message.identity?.user_id, // Store BSUID alongside phone
    name: message.contacts?.[0]?.profile?.name
  });

  // Record interaction
  await crm.addInteraction({
    contactPhone: message.from,
    channel: 'whatsapp',
    direction: 'inbound',
    content: message.text?.body,
    timestamp: new Date(parseInt(message.timestamp) * 1000)
  });

  // Trigger automation
  await automationEngine.trigger('whatsapp_message_received', {
    contact: message.from,
    message: message
  });
}
```

---

