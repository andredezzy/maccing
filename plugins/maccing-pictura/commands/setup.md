---
description: Configure pictura API keys and preferences interactively
---

# Pictura Setup

Guide the user through configuring pictura for first-time use.

## What This Command Does

You (Claude) will:
1. Check if config already exists using `pictura_validate`
2. Ask the user which providers they want to configure
3. Collect API keys for each selected provider
4. Set default preferences (ratio, quality, etc.)
5. Write the config file to `.claude/plugins/maccing/pictura/config.json`
6. Validate the configuration works

## Arguments

$ARGUMENTS is optional:
- `--provider gemini|openai|topaz`: Configure only a specific provider
- `--reconfigure`: Overwrite existing config

## Interactive Setup Flow

### Step 1: Check Existing Config

First, check if config exists by running `pictura_validate --quick`.

- If exists and no `--reconfigure` flag: Ask if user wants to update or skip
- If not exists: Proceed with full setup

### Step 2: Provider Selection

Ask the user:

"Which image providers would you like to configure?

**Generation Providers:**
1. **Gemini** (Recommended): Free tier available, supports all 10 aspect ratios
   - Get API key at: https://aistudio.google.com/apikey

2. **OpenAI**: GPT Image 1.5, limited to 3 sizes
   - Get API key at: https://platform.openai.com/api-keys

**Upscale Providers (optional):**
3. **Topaz Labs**: Premium AI upscaling up to 8x
   - Get API key at: https://www.topazlabs.com/api

Which would you like to set up? (e.g., '1' or '1,3' for multiple)"

### Step 3: Collect API Keys

For each selected provider, ask for the API key:

"Please enter your Gemini API key:
(Get one at https://aistudio.google.com/apikey)"

**Important:** Never echo back or log the API key. Just confirm receipt:
"Gemini API key received"

### Step 4: Set Defaults

Ask for preferences:

"What should be your default aspect ratio?
1. 16:9 (Recommended, widescreen)
2. 1:1 (Square, social media)
3. 9:16 (Vertical, stories)
4. Other (specify)"

"What quality level for generation?
1. Pro (Recommended, higher quality)
2. Draft (Faster, lower cost)"

### Step 5: Write Config

Write the configuration file to `.claude/plugins/maccing/pictura/config.json` with the following structure:

```json
{
  "providers": {
    "generation": {
      "default": "gemini",
      "gemini": { "apiKey": "<user-provided-key>", "defaultModel": "pro" },
      "openai": { "apiKey": "<user-provided-key>" }
    },
    "upscale": {
      "default": "topaz",
      "topaz": { "apiKey": "<user-provided-key>", "defaultModel": "standard-max" }
    }
  },
  "defaultRatio": "16:9",
  "defaultQuality": "pro",
  "imageSize": "2K",
  "defaultConsistency": "generate",
  "retryAttempts": 3,
  "outputDir": ".claude/plugins/maccing/pictura/output"
}
```

After writing, set file permissions to 600 for security:
```bash
chmod 600 .claude/plugins/maccing/pictura/config.json
```

### Step 6: Validate

Run `pictura_validate` to confirm setup worked.

Display result:
"Configuration saved to .claude/plugins/maccing/pictura/config.json
Gemini API key validated
Ready to generate images!

Try: /pictura:generate \"a sunset over mountains\" --social"

## Error Handling

If API key validation fails:
"Gemini API key appears invalid. Please check:
1. Key is copied correctly (no extra spaces)
2. Key is active at https://aistudio.google.com/apikey
3. Billing is enabled if required

Would you like to try again?"

## Config File Location

The config is stored at: `.claude/plugins/maccing/pictura/config.json`

This location is:
- Within the project directory (portable)
- Not tracked by git (add to .gitignore)
- Secured with 600 permissions

## Examples

```
/pictura:setup
/pictura:setup --provider gemini
/pictura:setup --reconfigure
```
