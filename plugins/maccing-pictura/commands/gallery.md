---
description: Open the image gallery to browse and manage generations
---

# Pictura Gallery

Use the `pictura_gallery` MCP tool to view and manage generated images.

## Flags

- `--batch`: Open a specific batch by ID
- `--browse`: Browse all batches in the gallery
- `--filter`: Filter batches by prompt slug
- `--since`: Only show batches since date (YYYY-MM-DD)

## Examples

```
/pictura:gallery
/pictura:gallery --browse
/pictura:gallery --batch abc123
/pictura:gallery --filter "product"
/pictura:gallery --since 2026-01-15
```
