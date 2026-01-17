---
description: Edit existing images with refinement, inpainting, outpainting, or restyling
---

# Pictura Edit

Use the `pictura_edit` MCP tool to modify generated images.

## Arguments

$ARGUMENTS is the edit instruction describing the desired changes.

## Flags

- `--batch`: Batch ID to edit (required)
- `--action`: Action type (refine, inpaint, outpaint, restyle)
- `--mask`: Mask image path for inpaint operations
- `--direction`: Direction for outpaint (left, right, top, bottom, all)

## Examples

```
/pictura:edit "make the sky more dramatic" --batch abc123 --action refine
/pictura:edit "remove background" --batch abc123 --action inpaint --mask ./mask.png
/pictura:edit "extend the scene" --batch abc123 --action outpaint --direction right
/pictura:edit "convert to watercolor style" --batch abc123 --action restyle
```
