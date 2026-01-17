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

## Example Usage

**User:** "Generate social media images of a coffee shop"
**Action:** Call pictura_generate with preset: "social"
