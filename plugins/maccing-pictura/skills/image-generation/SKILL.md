---
name: image-generation
description: Use when user wants to generate, create, or make images in multiple formats or aspect ratios. Also triggers for editing, upscaling, or managing generated images.
metadata:
  internal: true
---

# Image Generation Skill

This skill handles image generation using Pictura MCP tools with the unified provider API.

## Triggers

- Generate/create/make images, pictures, visuals
- Multiple aspect ratios, formats, sizes
- Edit/modify existing images
- Upscale/enhance image quality
- List/browse generated images

## Available Tools

### pictura_generate
Generate images with provider fallback support.

### pictura_list
List recent generations.

### pictura_gallery
Open HTML gallery in browser. **Only call when user explicitly requests it.**

## CRITICAL: Post-Generation Behavior

After `pictura_generate` completes:

1. **Report the exact absolute file paths** from the tool output
2. **Use the Read tool** to display the generated images to the user
3. **NEVER automatically call pictura_gallery** unless the user explicitly asks for it
4. **NEVER automatically call pictura_list** unless the user explicitly asks for it

The gallery is for browsing and should only open when the user uses `/pictura:gallery` or explicitly asks to "open the gallery" or "browse images".

## CRITICAL: Using Reference Images for Changes

**Always use the last generated image as a reference when the user requests changes, modifications, or variations.**

When the user asks for changes (e.g., "make it more organic", "less circle", "different colors", "add more X"):

1. **Identify the last generated image path** from the previous generation output
2. **Use `consistency: "reference"` and `ref: "<last-image-path>"`** in the new generation call
3. This ensures visual consistency while applying the requested changes

**Example flow:**
```
User: "Generate a blue sky with doodles"
→ pictura_generate(prompt: "...", ratios: ["16:9"])
→ Output: /path/to/output/2026-01-26-153835/blue-sky/16x9.png

User: "The doodles are too circular, make them more organic"
→ pictura_generate(
    prompt: "... doodles scattered organically, NOT in a circle ...",
    ratios: ["16:9"],
    consistency: "reference",
    ref: "/path/to/output/2026-01-26-153835/blue-sky/16x9.png"  ← ALWAYS use the last image
  )
```

**When NOT to use reference:**
- User explicitly asks for "something completely different"
- User says "start fresh" or "new concept"
- User provides a different reference image themselves

## Example Usage

**User:** "Generate social media images of a coffee shop"
**Action:** Call pictura_generate with preset: "social", then Read the generated image paths to display them

**User:** "Make the lighting warmer" (after previous generation)
**Action:** Call pictura_generate with the same ratios, updated prompt, and `consistency: "reference"` with `ref` set to the previous image path

**User:** "The colors are too muted, make them more vibrant"
**Action:** Call pictura_generate with updated prompt and `ref` pointing to the last generated image

**User:** "Open the gallery"
**Action:** Call pictura_gallery

**User:** "Show me my recent images"
**Action:** Call pictura_list
