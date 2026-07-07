## Contents

- [Sending Messages: Core Endpoint](#sending-messages-core-endpoint)
- [Text Message](#text-message)
- [Image Message](#image-message)
- [Video Message](#video-message)
- [Document Message](#document-message)
- [Audio Message](#audio-message)
- [Sticker Message](#sticker-message)
- [Location Message](#location-message)
- [Contacts Message](#contacts-message)
- [Reaction Message](#reaction-message)
- [Interactive: Reply Buttons](#interactive-reply-buttons)
- [Interactive: List Message](#interactive-list-message)
- [Interactive: Flow Message](#interactive-flow-message)
- [Typing Indicator](#typing-indicator)
- [Read Receipt](#read-receipt)

## 3. Message Types

### Sending Messages: Core Endpoint

```
POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/messages
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
```

All requests share this base structure:
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "15551234567",
  "type": "<message_type>",
  "<message_type>": { ... }
}
```

**Response format:**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "15551234567", "wa_id": "15551234567" }],
  "messages": [{ "id": "wamid.abc123", "message_status": "accepted" }]
}
```

`message_status` values: `accepted`, `held_for_quality_assessment`, `paused`

> The API response only confirms the message was accepted. Actual delivery is tracked via webhooks.

### Text Message

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "15551234567",
  "type": "text",
  "text": {
    "preview_url": true,
    "body": "Hello! Your order #1234 has shipped."
  }
}
```

- Max body length: 4,096 characters
- `preview_url: true` enables link preview
- Supports bold (`*text*`), italic (`_text_`), strikethrough (`~text~`), code (`` `text` ``)

### Image Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "image",
  "image": {
    "link": "https://example.com/image.jpg",
    "caption": "Optional caption text"
  }
}
```

Or using a media ID (preferred for performance):
```json
{
  "image": {
    "id": "1234567890",
    "caption": "Optional caption"
  }
}
```

### Video Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "video",
  "video": {
    "id": "MEDIA_ID",
    "caption": "Check out this product demo"
  }
}
```

### Document Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "document",
  "document": {
    "id": "MEDIA_ID",
    "filename": "invoice_2026_001.pdf",
    "caption": "Your invoice"
  }
}
```

### Audio Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "audio",
  "audio": {
    "id": "MEDIA_ID"
  }
}
```

### Sticker Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "sticker",
  "sticker": {
    "id": "MEDIA_ID"
  }
}
```

- Stickers must be WebP format, 512x512px, transparent background, max 100KB (static) or 500KB (animated)

### Location Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "location",
  "location": {
    "longitude": -122.425332,
    "latitude": 37.758056,
    "name": "Our Store - Mission District",
    "address": "123 Valencia St, San Francisco, CA"
  }
}
```

### Contacts Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "contacts",
  "contacts": [{
    "name": { "formatted_name": "John Doe", "first_name": "John", "last_name": "Doe" },
    "phones": [{ "phone": "+1 555-123-4567", "type": "WORK", "wa_id": "15551234567" }],
    "emails": [{ "email": "john@example.com", "type": "WORK" }]
  }]
}
```

### Reaction Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "reaction",
  "reaction": {
    "message_id": "wamid.originalMessageId",
    "emoji": "👍"
  }
}
```

### Interactive: Reply Buttons

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "header": {
      "type": "text",
      "text": "Order Status"
    },
    "body": {
      "text": "Your order #1234 is ready. What would you like to do?"
    },
    "footer": {
      "text": "Reply within 24 hours"
    },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "confirm_pickup", "title": "Pick Up Now" } },
        { "type": "reply", "reply": { "id": "schedule_later", "title": "Schedule Later" } },
        { "type": "reply", "reply": { "id": "cancel_order", "title": "Cancel Order" } }
      ]
    }
  }
}
```

- Max 3 buttons
- Button ID: max 256 chars; Title: max 20 chars
- Only available inside 24-hour customer service window (not a template)

### Interactive: List Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "interactive",
  "interactive": {
    "type": "list",
    "header": { "type": "text", "text": "Choose Department" },
    "body": { "text": "How can we help you today?" },
    "footer": { "text": "We reply within 2 hours" },
    "action": {
      "button": "View Options",
      "sections": [
        {
          "title": "Sales",
          "rows": [
            { "id": "new_order", "title": "Place New Order", "description": "Start a new purchase" },
            { "id": "track_order", "title": "Track Order", "description": "Check delivery status" }
          ]
        },
        {
          "title": "Support",
          "rows": [
            { "id": "technical", "title": "Technical Help", "description": "Device or app issues" },
            { "id": "billing", "title": "Billing Query", "description": "Invoice and payment" }
          ]
        }
      ]
    }
  }
}
```

- Max 10 rows total across all sections
- Row ID: max 200 chars; Title: max 24 chars; Description: max 72 chars
- Only available inside 24-hour customer service window

### Interactive: Flow Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "interactive",
  "interactive": {
    "type": "flow",
    "header": { "type": "text", "text": "Book Appointment" },
    "body": { "text": "Select a time slot that works for you" },
    "footer": { "text": "Powered by Our Booking System" },
    "action": {
      "name": "flow",
      "parameters": {
        "flow_message_version": "3",
        "flow_token": "UNIQUE_FLOW_TOKEN",
        "flow_id": "FLOW_ID",
        "flow_cta": "Open Booking",
        "flow_action": "navigate",
        "flow_action_payload": {
          "screen": "APPOINTMENT_SCREEN",
          "data": { "customer_name": "João Silva" }
        }
      }
    }
  }
}
```

### Typing Indicator

Standalone `typing_indicator` message type. Shows "typing…" for up to 25 seconds or until you send the reply; only works inside an active conversation (the recipient must have messaged you). `POST /<PHONE_NUMBER_ID>/messages`:

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "15551234567",
  "type": "typing_indicator",
  "typing_indicator": { "type": "text" }
}
```

Via a BSP, use its wrapper — e.g. YCloud exposes `POST /v2/whatsapp/inboundMessages/{id}/typingIndicator` (the inbound `wamid` in the path, no body).

### Read Receipt

```json
{
  "messaging_product": "whatsapp",
  "status": "read",
  "message_id": "wamid.messageId"
}
```

---

