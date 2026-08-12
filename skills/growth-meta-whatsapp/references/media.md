## 9. Media Handling

### Supported Formats & Limits

| Type | Formats | Max Size | Notes |
|---|---|---|---|
| Image | JPEG, PNG | 5 MB | WebP only for stickers |
| Video | MP4, 3GP | 16 MB | H.264 video + AAC audio required |
| Audio | AAC, MP4, MPEG, AMR, OGG | 16 MB | OGG with OPUS codec |
| Document | PDF, DOC(X), XLS(X), PPT(X), TXT | 100 MB | |
| Sticker | WebP | 100 KB (static), 500 KB (animated) | 512x512px, transparent bg |

Upload limit to media API: **64 MB** (but post-processing enforces type-specific limits above).

### Upload Media

```
POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/media
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: multipart/form-data
```

```bash
curl -X POST "https://graph.facebook.com/v23.0/PHONE_NUMBER_ID/media" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -F "file=@./image.jpg;type=image/jpeg" \
  -F "type=image/jpeg" \
  -F "messaging_product=whatsapp"
```

Response:
```json
{ "id": "1234567890123456" }
```

**TypeScript upload example:**
```typescript
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';

async function uploadMedia(filePath: string, mimeType: string, phoneNumberId: string): Promise<string> {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), { contentType: mimeType });
  form.append('type', mimeType);
  form.append('messaging_product', 'whatsapp');

  const response = await axios.post(
    `https://graph.facebook.com/v23.0/${phoneNumberId}/media`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`
      }
    }
  );

  return response.data.id;
}
```

### Retrieve Media URL

```
GET https://graph.facebook.com/v23.0/{MEDIA_ID}?phone_number_id={PHONE_NUMBER_ID}
Authorization: Bearer {ACCESS_TOKEN}
```

`phone_number_id` is optional; when supplied the request only succeeds if the media was uploaded on that business phone number.

Response:
```json
{
  "url": "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=...",
  "mime_type": "image/jpeg",
  "sha256": "hash",
  "file_size": 102400,
  "id": "MEDIA_ID",
  "messaging_product": "whatsapp"
}
```

The URL returned expires after **5 minutes**. Download immediately; after that, re-query the ID for a fresh URL.

### Download Media

```bash
curl -OJ \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=..."
```

The access token is mandatory — omit it and the download fails. A failed download returns `404 Not Found`; retry by fetching a new media URL, then by renewing the token.

### Delete Media

```bash
curl -X DELETE "https://graph.facebook.com/v23.0/{MEDIA_ID}?phone_number_id={PHONE_NUMBER_ID}" \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

```json
{ "success": true }
```

`phone_number_id` is optional and scopes the delete the same way it scopes the GET. Delete assets you uploaded for a one-off campaign rather than waiting out the 30-day retention — a stale ID that is still reachable is still sendable.

### Media ID Lifetimes

Two different clocks, and confusing them is how inbound-media handlers break after a week:

| Media ID origin | Lifetime |
|---|---|
| Returned by `POST /{PHONE_NUMBER_ID}/media` (you uploaded it) | **30 days**, unless you `DELETE` it earlier |
| Arriving in an incoming-message webhook (the user sent it) | **7 days** |
| The `url` from `GET /{MEDIA_ID}` (either origin) | **5 minutes** |

- **Never store a webhook media ID as your record of the file.** Resolve it to a URL and download the bytes to your own storage on receipt; at day 8 the ID is gone and re-resolving it fails.
- **Best practice for outbound:** use media IDs (upload once, reuse) rather than `link` URLs for frequently sent assets (logos, product images, standard docs). Re-upload on a schedule shorter than 30 days.
- When sending the same media to thousands of users, upload once and store the ID.

---

