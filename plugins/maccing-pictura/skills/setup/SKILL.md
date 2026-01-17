---
name: pictura-setup
description: Use when user wants to configure, set up, or initialize pictura. Also triggers when user mentions API keys for image generation, or when first-time setup is needed.
---

# Pictura Setup Skill

This skill guides users through configuring the pictura plugin for first-time use.

## Triggers

- "Set up pictura"
- "Configure image generation"
- "Add my Gemini API key"
- "How do I use pictura?"
- "pictura is not configured"
- Config missing errors from other tools

## Setup Process

### Step 1: Check Current State

Use `pictura_validate` with mode "quick" to check if configuration exists:

```
pictura_validate({ mode: "quick" })
```

**If config exists:**
- Show current configuration status
- Ask if user wants to reconfigure

**If config missing:**
- Proceed with setup flow

### Step 2: Guide Provider Selection

Present provider options clearly:

**Generation Providers (choose at least one):**

| Provider | Pros | Cons | API Key URL |
|----------|------|------|-------------|
| Gemini | Free tier, all 10 ratios, best quality | Rate limits on free tier | https://aistudio.google.com/apikey |
| OpenAI | Fast, reliable | Only 3 sizes, paid only | https://platform.openai.com/api-keys |

**Upscale Providers (optional):**

| Provider | Pros | Cons | API Key URL |
|----------|------|------|-------------|
| Topaz Labs | Best quality, up to 8x | Paid only, async for some models | https://www.topazlabs.com/api |

### Step 3: Collect Configuration

For each selected provider:
1. Ask for API key
2. Confirm receipt (never echo the key)
3. Ask for provider-specific defaults

For general settings:
1. Default aspect ratio (recommend 16:9)
2. Default quality (recommend pro)
3. Image size (recommend 2K)

### Step 4: Write Configuration

Use the `pictura_setup` MCP tool to write configuration:

```
pictura_setup({
  providers: {
    generation: {
      default: "gemini",
      gemini: { apiKey: "..." }
    },
    upscale: {
      default: "topaz",
      topaz: { apiKey: "..." }
    }
  },
  defaults: {
    ratio: "16:9",
    quality: "pro",
    size: "2K"
  }
})
```

### Step 5: Validate and Confirm

Run full validation:

```
pictura_validate({ mode: "full" })
```

Show success message with next steps:

```
Pictura configured successfully!

Your setup:
- Generation: Gemini (pro mode)
- Upscale: Topaz Labs
- Default ratio: 16:9

Try it out:
/pictura:generate "a cozy coffee shop" --social
```

## Error Recovery

**Invalid API key:**
1. Explain the error clearly
2. Provide link to get new key
3. Offer to retry

**Network issues:**
1. Suggest checking internet connection
2. Offer to save config anyway (will validate later)

**Permission denied:**
1. Explain the issue
2. Provide fix command: `mkdir -p .claude/plugins/maccing/pictura`
