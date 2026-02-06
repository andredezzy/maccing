---
description: Search free stock photographs only (not fonts, music, icons, or videos) from Unsplash, Pexels, or Pixabay
---

# Stock Photo Search

Search for free stock photos across configured providers.

## Arguments

$ARGUMENTS

The first argument is the search query.

## Supported Flags

- `--provider`, Stock photo provider: unsplash, pexels, pixabay, or all (default: config default)
- `--orientation`, Filter by orientation: landscape, portrait, or squarish
- `--color`, Filter by color (provider-specific values)
- `--page`, Page number for pagination (default: 1)
- `--per-page`, Number of results per page (default: 10, max: 30)

## Examples

```
/pictura:stock-search "mountain sunset"
/pictura:stock-search "coffee shop" --provider pexels --orientation landscape
/pictura:stock-search "abstract texture" --provider all --per-page 20
/pictura:stock-search "ocean waves" --color blue
```

## Behavior

1. Call `pictura_stock_search` with the query and flags
2. Present results as a numbered list with descriptions, photographers, and dimensions
3. Ask the user which photo to download
4. Use `pictura_stock_download` for the selected photo
