---
description: Generate consistent images across multiple aspect ratios
---

# Pictura Generate

Use the `pictura_generate` MCP tool to create images.

## Arguments

$ARGUMENTS is the prompt for image generation.

## Flags

- `--ratios`: Comma-separated ratios (1:1,16:9,9:16)
- `--social` / `--web` / `--portrait` / `--landscape` / `--print`: Preset bundles
- `--draft`: Use fast model
- `--size`: Output resolution (1K, 2K, 4K)
- `--provider`: Override provider (gemini, openai)
- `--ref`: Path to reference image for visual consistency
- `--consistency`: Consistency strategy (generate, reference, multiturn)
- `--no-enhance`: Disable prompt enhancement
- `--enhance-style`: Style (auto, photo, art, commercial, minimal)

## Examples

```
/pictura:generate "mountain sunset" --social
/pictura:generate "product shot" --ratios 1:1,16:9
/pictura:generate "product on marble" --social --ref ./brand-reference.png
```
