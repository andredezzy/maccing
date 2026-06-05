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
GET https://graph.facebook.com/v23.0/{MEDIA_ID}
Authorization: Bearer {ACCESS_TOKEN}
```

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

The URL returned expires quickly (~5 minutes). Download immediately.

### Download Media

```bash
curl -OJ \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=..."
```

### Media Caching

- Uploaded media IDs persist for **30 days** on Meta's servers
- **Best practice:** Use media IDs (upload once, reuse) rather than URLs for frequently sent assets (logos, product images, standard docs)
- When sending the same media to thousands of users, upload once and store the ID

---

