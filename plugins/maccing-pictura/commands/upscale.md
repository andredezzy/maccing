---
description: Upscale images to higher resolutions
---

# Pictura Upscale

Use the `pictura_upscale` MCP tool to enhance image resolution.

## Flags

- `--batch`: Batch ID to upscale (required)
- `--scale`: Scale factor (2, 4, 8)
- `--model`: Topaz model to use for upscaling
- `--provider`: Override provider (topaz, replicate)
- `--skip-topaz`: Use Gemini 4K regeneration only, skip Topaz enhancement

## Examples

```
/pictura:upscale --batch abc123 --scale 2
/pictura:upscale --batch abc123 --scale 4 --provider topaz
/pictura:upscale --batch abc123 --scale 8 --model standard
/pictura:upscale --batch abc123 --skip-topaz
```
