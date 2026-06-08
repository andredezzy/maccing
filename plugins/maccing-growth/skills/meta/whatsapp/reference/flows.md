## Contents

- [What Are Flows](#what-are-flows)
- [Flow JSON Structure](#flow-json-structure)
- [Flow API Endpoints](#flow-api-endpoints)
- [Dynamic Flows (Backend Integration)](#dynamic-flows-backend-integration)
- [Payment Flows](#payment-flows)

## 7. WhatsApp Flows

### What Are Flows

WhatsApp Flows are native, app-like interactive experiences embedded directly in a WhatsApp conversation. Users complete multi-step forms, appointments, surveys, or purchases without leaving the chat. Results: 8x+ higher conversion vs. redirecting to a website (vendor-claimed, not independently verified).

**Available in:** WhatsApp Manager (no-code builder) or via API (JSON definition).

**Supported components:** TextInput, TextArea, Dropdown, DatePicker, RadioButtonsGroup, CheckboxGroup, TextHeading, TextBody, Image, EmbeddedLink, Footer with action buttons.

**Limitations:** Once published, a flow cannot be edited (only deprecated and re-created). Max 50 components per screen. Only layout type is `SingleColumnLayout`.

### Flow JSON Structure

```json
{
  "version": "7.0",
  "data_api_version": "3.0",
  "routing_model": {
    "WELCOME": ["SELECT_DATE", "SKIP"],
    "SELECT_DATE": ["CONFIRM"],
    "CONFIRM": []
  },
  "screens": [
    {
      "id": "WELCOME",
      "title": "Book Appointment",
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Schedule Your Visit"
          },
          {
            "type": "TextBody",
            "text": "Choose a service and preferred date"
          },
          {
            "type": "Dropdown",
            "name": "service",
            "label": "Service Type",
            "required": true,
            "data-source": [
              { "id": "haircut", "title": "Haircut" },
              { "id": "coloring", "title": "Coloring" }
            ]
          },
          {
            "type": "DatePicker",
            "name": "appointment_date",
            "label": "Preferred Date",
            "required": true
          },
          {
            "type": "Footer",
            "label": "Continue",
            "on-click-action": {
              "name": "navigate",
              "next": { "type": "screen", "name": "CONFIRM" },
              "payload": {
                "service": "${form.service}",
                "date": "${form.appointment_date}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "CONFIRM",
      "title": "Confirmation",
      "terminal": true,
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextBody",
            "text": "Appointment booked for ${data.date}"
          },
          {
            "type": "Footer",
            "label": "Done",
            "on-click-action": { "name": "complete" }
          }
        ]
      }
    }
  ]
}
```

### Flow API Endpoints

```
POST /{WABA_ID}/flows          # Create flow
GET /{FLOW_ID}                 # Get flow details
POST /{FLOW_ID}                # Update flow JSON
POST /{FLOW_ID}/publish        # Publish draft flow
POST /{FLOW_ID}/deprecate      # Deprecate published flow
DELETE /{FLOW_ID}              # Delete draft flow only
```

**Create a Flow:**
```json
{
  "name": "Appointment Booking",
  "categories": ["APPOINTMENT_BOOKING"]
}
```

**Update Flow JSON:**
```
POST /{FLOW_ID}
{
  "flow_json": "<escaped JSON string>",
  "name": "Appointment Booking"
}
```

**Publish a Flow:**
```
POST /{FLOW_ID}/publish
```

### Dynamic Flows (Backend Integration)

Set `data_channel_uri` in the flow for real-time backend communication:
```json
{
  "data_api_version": "3.0",
  "routing_model": { ... },
  "screens": [ ... ]
}
```

Meta sends POST requests to your `data_channel_uri` when screens require data, with the payload containing the screen ID and user inputs. Your server responds with the data to populate the next screen.

### Payment Flows

See `pricing-and-billing.md` → **WhatsApp Payments** for Pix, Boleto, and Payment Links details.

---

