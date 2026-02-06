---
description: Download a stock photo from search results
---

# Stock Photo Download

Download a specific stock photo by provider and ID.

## Arguments

$ARGUMENTS

The first argument is the photo ID from search results.

## Supported Flags

- `--provider`, Stock photo provider: unsplash, pexels, or pixabay (required)
- `--size`, Download size: small, medium, large, or original (default: large)

## Examples

```
/pictura:stock-download abc123 --provider unsplash
/pictura:stock-download 12345 --provider pexels --size original
/pictura:stock-download 67890 --provider pixabay --size medium
```

## Behavior

1. Call `pictura_stock_download` with the provider, photo ID, and size
2. Display the downloaded image using the Read tool
3. Show attribution information
4. Remind user about attribution requirements (especially for Unsplash)
