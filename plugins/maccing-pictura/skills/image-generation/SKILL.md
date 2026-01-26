---
name: image-generation
description: Use when user wants to generate, create, or make images in multiple formats or aspect ratios. Also triggers for editing, upscaling, or managing generated images.
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

## Example Usage

**User:** "Generate social media images of a coffee shop"
**Action:** Call pictura_generate with preset: "social", then Read the generated image paths to display them

**User:** "Open the gallery"
**Action:** Call pictura_gallery

**User:** "Show me my recent images"
**Action:** Call pictura_list
