## Contents

1. [Format Overview](#format-overview)
2. [Creative Specifications (2026)](#creative-specifications-2026)
   - [Image Ads](#image-ads)
   - [Video Ads](#video-ads)
   - [Carousel Ads](#carousel-ads)
   - [Text Limits](#text-limits)
3. [Advantage+ Creative](#advantage-creative)
4. [UGC (User-Generated Content) Ads](#ugc-user-generated-content-ads)
5. [Catalog / Product Feed Ads (Advantage+ Catalog)](#catalog--product-feed-ads-advantage-catalog)

---

## 4. Ad Formats & Creative

### Format Overview

| Format | Placements | Best For |
|--------|-----------|----------|
| Single Image | Feed, Stories, Reels, Marketplace, Right Column | Product showcase, offers |
| Single Video | Feed, Stories, Reels, Audience Network | Demo, testimonials, UGC |
| Carousel | Feed, Stories | Product catalog, multi-feature, storytelling |
| Collection | Feed, Instant Experience | E-commerce browsing |
| Stories | Stories only | Full-screen immersive |
| Reels | Reels only | Discovery, entertainment-first |
| Catalog/Dynamic | Feed, Reels, Stories | Retargeting, dynamic product ads |
| Lead Form | Feed, Stories | Direct lead capture |

### Creative Specifications (2026)

#### Image Ads

| Placement | Recommended Size | Aspect Ratio | Max File Size | Formats |
|-----------|-----------------|--------------|---------------|---------|
| Feed (FB+IG) | 1080×1350 px | 4:5 (vertical) | 30 MB | JPG, PNG |
| Feed (square) | 1080×1080 px | 1:1 | 30 MB | JPG, PNG |
| Stories | 1080×1920 px | 9:16 | 30 MB | JPG, PNG |
| Reels | 1080×1920 px | 9:16 | 30 MB | JPG, PNG |
| Right Column (desktop only) | 1080×1080 px | 1:1 | 30 MB | JPG, PNG |
| Marketplace | 1080×1080 px | 1:1 | 30 MB | JPG, PNG |
| Messenger | 1200×628 px | 1.91:1 | 30 MB | JPG, PNG |

**Source file recommendation:** Export at 1440×1440 px or higher for retina sharpness.

#### Video Ads

| Placement | Recommended Size | Duration | Max File | Codec |
|-----------|-----------------|----------|----------|-------|
| Feed (FB+IG) | 1080×1350 (4:5) or 1080×1080 (1:1) | 15-60s optimal | 4 GB | H.264 + AAC |
| Feed vertical | 1080×1920 (9:16) | 15-60s optimal | 4 GB | H.264 + AAC |
| Stories | 1080×1920 (9:16) | Up to 15s per card | 4 GB | H.264 + AAC |
| Facebook Reels | 1080×1920 (9:16) | No maximum limit | 4 GB | H.264 + AAC |
| Instagram Reels | 1080×1920 (9:16) | Up to 15 min | 4 GB | H.264 + AAC |

**Export settings:** MP4 or MOV, H.264 video, AAC audio at 128 kbps+, up to 30 fps, 5,000-10,000 kbps bitrate for 1080p. Audio required (even music-only).

**Safe zones:**
- Stories/Reels: Keep critical content away from top 250px and bottom 250-340px (UI elements)
- Reels: Keep bottom 35% clear for UI overlay
- Reels: Keep sides 6% clear

#### Carousel Ads

- 2-10 cards per carousel
- Each card: 1080×1080 px (1:1), max 30 MB/image, 4 GB/video
- All cards must share the same aspect ratio
- Can mix images and videos
- Unique landing URL per card
- Text: 40-char headline, 20-char description, 125-char primary text (applies to whole carousel)

**Update as of Jan 2026:** Instagram Explore feed removed — ads previously running there now serve in Reels.

#### Text Limits

| Element | Limit |
|---------|-------|
| Primary text | 125 characters visible (truncated after) |
| Headline | 40 characters |
| Description | 25-30 characters |
| Messenger headline | 20 characters only |
| Carousel headline per card | 40 characters |
| Carousel description per card | 20 characters |

**Text overlay:** Officially no 20% rule, but ads with heavy image text still experience reduced delivery and higher costs.

### Advantage+ Creative

Meta's AI system that automatically tests creative variations:

- Supports: up to 10 images/videos, 5 headlines, 5 primary texts, 5 descriptions, 5 CTA buttons
- Automatically varies: backgrounds, formats, text placements, music, responsive layouts
- Uses ML on audience data, user activity, interest signals, behavioral data
- Acts as a live feedback loop, refreshing assets based on real-time performance

**DCO (Dynamic Creative Optimization) process:**
1. Upload creative assets (images, videos, copy variants)
2. Meta tests combinations across audience segments
3. Algorithm identifies winning combos per audience segment
4. Winning combos get more delivery; losers get less
5. Creative is refreshed to prevent fatigue

**Performance results:** Studies show 33% install lift on ad networks, 65% on socials from creative optimization. One fintech case: 40% ROAS increase, 82% CPP decrease.

**Enable DCO in API:**
```json
POST /act_{AD_ACCOUNT_ID}/adcreatives
{
  "name": "DCO Creative",
  "asset_feed_spec": {
    "images": [{"hash": "abc..."}, {"hash": "def..."}],
    "titles": [{"text": "Headline 1"}, {"text": "Headline 2"}],
    "bodies": [{"text": "Primary text 1"}, {"text": "Primary text 2"}],
    "call_to_action_types": ["SHOP_NOW", "LEARN_MORE"],
    "link_urls": [{"website_url": "https://example.com"}]
  }
}
```

### UGC (User-Generated Content) Ads

**Why UGC outperforms polished production:**
- 92% of consumers trust UGC over traditional ads
- 4x higher CTR vs traditional ads
- 50% lower CPC
- 31% more memorable
- Authentic content outperforms studio ads "9 out of 10 accounts"

**High-performing UGC types:**
- Selfie-style customer testimonials (vertical, raw)
- Tradesperson/expert at work explaining product
- How-to routines showing product in real-life context
- Unboxings and first impressions
- Before/after transformations (real, not staged)

**Hook formula for UGC video (first 3 seconds):**
- Pattern interrupt (unexpected visual or sound)
- Specific claim ("How I cut my CPL from $82 to $19 in 14 days")
- Direct question to target audience
- Before/after cut directly to result

**Whitelisting / Creator Licensing:**
Run ads through the creator's profile. The ad shows as from the influencer, not the brand. Access via Meta's Partnership Ads (formerly Branded Content ads).

**Legal requirement:** Always get written permission before repurposing customer-created content.

### Catalog / Product Feed Ads (Advantage+ Catalog)

**Feed format:** CSV, TSV, RSS XML, or ATOM XML

**Required fields:**

| Field | Format | Notes |
|-------|--------|-------|
| `id` | String | Unique product SKU |
| `title` | String | Product name |
| `description` | String | Detailed description |
| `availability` | Enum | `in stock`, `out of stock`, `preorder`, `available for order`, `discontinued` |
| `condition` | Enum | `new`, `refurbished`, `used` |
| `price` | `XX.XX CUR` | e.g., `29.99 USD` |
| `link` | URL | Product page |
| `image_link` | URL | Main image |
| `brand` | String | Manufacturer/brand |

**Highly recommended fields:** `sale_price`, `google_product_category`, `product_type`, `additional_image_link` (up to 20), `custom_label_0-4`

**Custom labels strategy:**
- `custom_label_0`: Margin tier (high/medium/low)
- `custom_label_1`: Seasonal (holiday/summer/evergreen)
- `custom_label_2`: Performance (bestseller/new/slow-mover)
- `custom_label_3`: Inventory level (overstock/limited/normal)
- `custom_label_4`: Price tier

**Setup path:** Commerce Manager → Add Catalog → Ecommerce → choose feed delivery method → map columns → validate via Diagnostics → 24-48h approval

**Dynamic Media (September 2025 change):** 100% enforcement of Dynamic Media started October 20, 2025. All new Advantage+ Catalog ads must include Dynamic Media functionality.

---
