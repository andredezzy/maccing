---
name: stock-search
description: Use when user wants to search for, find, or download free stock photos or images from Unsplash, Pexels, or Pixabay.
metadata:
  internal: true
---

# Stock Image Search Skill

This skill handles searching and downloading free stock photos using Pictura MCP tools.

## Triggers

- Search/find stock photos, stock images, free photos
- Download free images/photos
- Find photos of [subject]
- Need a photo for [purpose]

## Available Tools

### pictura_stock_search
Search free stock photos from Unsplash, Pexels, or Pixabay.

### pictura_stock_download
Download a specific stock photo by provider and ID.

## Search Flow

### Step 1: Search

Call `pictura_stock_search` with the user's query:

```
pictura_stock_search({
  query: "mountain landscape sunset",
  provider: "unsplash",
  perPage: 10,
  orientation: "landscape"
})
```

### Step 2: Present Results

Present the numbered results to the user with descriptions, photographers, and dimensions. Let the user choose which photo to download.

### Step 3: Download

Call `pictura_stock_download` with the chosen photo's provider and ID:

```
pictura_stock_download({
  provider: "unsplash",
  photoId: "abc123",
  size: "large",
  query: "mountain landscape sunset"
})
```

### Step 4: Show Image and Attribution

After download:
1. Use the Read tool to display the downloaded image
2. Always show the attribution information from the tool response
3. If the provider requires attribution (Unsplash), remind the user

## CRITICAL: Attribution Requirements

**Unsplash**: Attribution is legally required. Always include photographer name and link when presenting Unsplash images.

**Pexels**: Attribution is appreciated but not required.

**Pixabay**: Attribution is appreciated but not required.

Always save ATTRIBUTION.md alongside downloaded images. The download tool handles this automatically.

## Provider Comparison

| Provider | Attribution | Quality | Free Tier |
|----------|------------|---------|-----------|
| Unsplash | Required | High | Unlimited searches, 50 req/hour |
| Pexels | Optional | High | 200 req/hour |
| Pixabay | Optional | Good | 100 req/min (5000/day) |

## Example Flow

```
User: Find me a photo of a coffee shop

Claude: [calls pictura_stock_search with query "coffee shop"]

Claude: I found 10 photos of coffee shops. Here are the top results:
1. Cozy coffee shop interior by John Smith (4000x2667)
2. ...

Which one would you like to download?

User: Number 1

Claude: [calls pictura_stock_download with provider and photoId]
Claude: [uses Read tool to display the image]
Claude: Downloaded! Photo by John Smith on Unsplash (attribution required).
```

## Multi-Provider Search

When the user wants variety, use `provider: "all"` to search across all configured providers simultaneously. Results will be interleaved by provider.

## Size Options

| Size | Typical Resolution | Use Case |
|------|-------------------|----------|
| small | 400px | Thumbnails, previews |
| medium | 1080px | Web content, social media |
| large | Full resolution | Print, high-quality use |
| original | Maximum available | Archives, large prints |
