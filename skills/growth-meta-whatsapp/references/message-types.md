> ⚠️ **Everything below sends. A bulk campaign/broadcast send is ALWAYS operator-executed — never loop these calls over a recipient list.** Full rule: [SKILL.md → Send Doctrine](../SKILL.md#send-doctrine--read-this-before-the-routing-table).

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
- [Interactive: Media Carousel](#interactive-media-carousel)
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
- Body text: **required**, max 1,024 chars. URLs are auto-hyperlinked
- Footer text: optional, max **60** chars
- Header: optional, `text` / `image` / `video` / `document`
- Button ID: max 256 chars; Button label: max 20 chars, and labels must be unique across the buttons

Exceeding any of these caps is a 400, not a truncation.

Availability: reply buttons are a **service message**, so they send only while the 24-hour customer service window is open; outside it only approved templates go through. Meta's reply-buttons reference page does not state this — it is stated on the Service messages page, which lists interactive reply buttons among the types you "can send during an open customer service window". Note the window is also opened (and reset) by a user *call*, not just a message. Template quick-reply buttons are a different mechanism and are not gated this way.

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

- Max **10 sections**, and max 10 rows total across all sections
- Header: optional, `text` type only, max 60 chars
- Body: required, max 4,096 chars
- Footer: optional, max 60 chars
- Button label (`action.button`): required, single button, max 20 chars
- Section title: max 24 chars
- Row ID: max 200 chars; Row title: max 24 chars; Row description: optional, max 72 chars

Same window rule as reply buttons: list messages are service messages, so the 24-hour customer service window must be open.

### Interactive: Media Carousel

A horizontally scrollable set of media cards. Each card carries its own header, body, and button(s).

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "15551234567",
  "type": "interactive",
  "interactive": {
    "type": "carousel",
    "body": { "text": "Here are three of our latest arrivals, each under $25:" },
    "action": {
      "cards": [
        {
          "card_index": 0,
          "type": "cta_url",
          "header": { "type": "image", "image": { "link": "https://example.com/blue-echeveria.jpeg" } },
          "body": { "text": "*Blue Echeveria*\n\nPowdery blue rosette succulent." },
          "action": {
            "name": "cta_url",
            "parameters": { "display_text": "Buy now", "url": "https://shop.example.com/blue-echeveria" }
          }
        },
        {
          "card_index": 1,
          "type": "cta_url",
          "header": { "type": "image", "image": { "link": "https://example.com/zebra-haworthia.jpeg" } },
          "body": { "text": "*Zebra Haworthia*\n\nWhite stripes on deep green leaves." },
          "action": {
            "name": "cta_url",
            "parameters": { "display_text": "Buy now", "url": "https://shop.example.com/zebra-haworthia" }
          }
        }
      ]
    }
  }
}
```

- **2 to 10 cards.** `card_index` is zero-based and orders the cards left to right
- Main `body.text` is **required**, max 1,024 chars. A main header, footer, or interactive component is **not supported** — the cards carry those
- Every card **must** have an `image` or `video` header; no other header type is allowed
- Card `body.text` is optional, max **160** chars and up to 2 line breaks
- Each card carries **either** one `cta_url` button **or** one-or-more `quick_reply` buttons. The button type *and* count must be identical across every card — 2 quick replies on one card means exactly 2 on all of them
- Quick-reply button ID: max 256 chars; any button label: max 20 chars

Swap a card's `action` for quick replies like this (the surrounding card object is unchanged):
```json
{
  "card_index": 0,
  "type": "cta_url",
  "header": { "type": "image", "image": { "link": "https://example.com/blue-echeveria.jpeg" } },
  "body": { "text": "*Blue Echeveria*" },
  "action": {
    "buttons": [
      { "type": "quick_reply", "quick_reply": { "id": "learn-blue-echeveria", "title": "Learn more" } },
      { "type": "quick_reply", "quick_reply": { "id": "fav-blue-echeveria", "title": "Add to favorites" } }
    ]
  }
}
```

Service message, so 24-hour-window only. The outside-the-window equivalent is a different mechanism: the **media card carousel template**, which is marketing-category only, fixes the card count at creation time, and is not covered in `templates.md` — see Meta's [Media card carousel templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/media-card-carousel-templates).

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

