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
POST /{WABA_ID}/flows          # Create flow (accepts name, categories, endpoint_uri, flow_json, publish)
GET /{FLOW_ID}                 # Get flow details
POST /{FLOW_ID}                # Update flow METADATA (name, categories, endpoint_uri)
POST /{FLOW_ID}/assets         # Update Flow JSON (multipart form-data, not a JSON body)
POST /{FLOW_ID}/publish        # Publish draft flow
POST /{FLOW_ID}/deprecate      # Deprecate published flow
DELETE /{FLOW_ID}              # Delete draft flow only
```

**Create a Flow:**
```json
{
  "name": "Appointment Booking",
  "categories": ["APPOINTMENT_BOOKING"],
  "endpoint_uri": "https://api.example.com/flows/appointments"
}
```

**Update Flow JSON** — the JSON is an *asset*, uploaded as form-data. Posting `flow_json` to `/{FLOW_ID}` does not update it:
```bash
curl -X POST 'https://graph.facebook.com/v23.0/{FLOW_ID}/assets' \
  -H 'Authorization: Bearer {ACCESS_TOKEN}' \
  -F 'file=@./flow.json;type=application/json' \
  -F 'name="flow.json"' \
  -F 'asset_type="FLOW_JSON"'
```

**Publish a Flow:**
```
POST /{FLOW_ID}/publish
```

### Dynamic Flows (Backend Integration)

Point the Flow at your backend with **`endpoint_uri`**, set via the Flows API — **not** in the Flow JSON.

`data_channel_uri` is the old name for this field and is **deprecated (Graph API v19.0)**; Flow JSON stopped supporting it at Flow JSON version 3.0. The Flow JSON above is version 7.0, so `data_channel_uri` in it is silently ignored and your endpoint is never called. Only set `data_channel_uri` if you are maintaining a legacy Flow whose JSON version is below 3.0.

Set it at create time, or on an existing Flow:
```bash
curl -X POST 'https://graph.facebook.com/v23.0/{FLOW_ID}' \
  -H 'Authorization: Bearer {ACCESS_TOKEN}' \
  -H 'Content-Type: application/json' \
  -d '{ "endpoint_uri": "https://api.example.com/flows/appointments" }'
```

The Flow JSON itself only declares that it talks to an endpoint — `data_api_version` plus a `routing_model`:
```json
{
  "version": "7.0",
  "data_api_version": "3.0",
  "routing_model": { ... },
  "screens": [ ... ]
}
```

Read back which URL is live with `GET /{FLOW_ID}?fields=endpoint_uri`.

Meta sends POST requests to your `endpoint_uri` when screens require data, with the payload containing the screen ID and user inputs. Your server responds with the data to populate the next screen.

### Payment Flows

See `pricing-and-billing.md` → **WhatsApp Payments** for Pix, Boleto, and Payment Links details.

---

