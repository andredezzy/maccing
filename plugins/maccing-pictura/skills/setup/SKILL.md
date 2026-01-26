---
name: pictura-setup
description: Use when pictura returns PICTURA_SETUP_REQUIRED or PICTURA_API_KEY_REQUIRED. Guides inline configuration during first use.
---

# Pictura Inline Setup Skill

This skill handles inline configuration when pictura tools detect missing configuration.

## Triggers

- `PICTURA_SETUP_REQUIRED` returned from pictura_generate, pictura_edit, or pictura_upscale
- `PICTURA_API_KEY_REQUIRED` returned when config exists but API keys are missing
- User asks to configure or reconfigure pictura

## Inline Setup Flow

When a pictura tool returns a setup required message, guide the user through configuration inline.

### Step 1: Provider Selection

Ask the user which provider they want to use:

"I need to configure Pictura before generating images. Which provider would you like to use?

| Provider | Pros | API Key |
|----------|------|---------|
| **Gemini** (Recommended) | Free tier available, supports all 10 aspect ratios | [Get key](https://aistudio.google.com/apikey) |
| **OpenAI** | Fast, reliable, limited to 3 sizes | [Get key](https://platform.openai.com/api-keys) |

Which provider would you like to use?"

### Step 2: Collect API Key

After provider selection, ask for the API key:

"Please paste your [Provider] API key.

Get one at: [provider URL]

(The key will be stored securely with 600 permissions)"

**Important:** Never echo back or display the API key in responses.

### Step 3: Save Configuration

Call `pictura_config` with the collected information:

```
pictura_config({
  providers: {
    generation: {
      default: "gemini",
      gemini: { apiKey: "user-provided-key" }
    }
  },
  scope: "user"
})
```

**Scope selection:**
- Default to `user` scope (shared across projects, recommended for API keys)
- Use `project` scope only if user explicitly requests project-specific config

### Step 4: Retry Original Request

After successful configuration, automatically retry the original pictura tool call that triggered setup.

## Example Flow

```
User: Generate an image of a sunset

Claude: [calls pictura_generate]

Tool returns: PICTURA_SETUP_REQUIRED

Claude: I need to configure Pictura first. Which provider would you like to use?
- Gemini (recommended, free tier)
- OpenAI

User: Gemini

Claude: Please paste your Gemini API key.
Get one at: https://aistudio.google.com/apikey

User: [pastes API key]

Claude: [calls pictura_config with the key]

Claude: Configuration saved. Now generating your image...

Claude: [calls pictura_generate again with original prompt]
```

## Reconfiguration

If user wants to reconfigure or add additional providers:

1. Ask what they want to change (provider, API key, defaults)
2. Collect the new information
3. Call `pictura_config` with the updates

For project-specific overrides:
```
pictura_config({
  defaults: { quality: "draft", ratio: "1:1" },
  scope: "project"
})
```

## Configuration Scopes

| Scope | Path | Purpose |
|-------|------|---------|
| user | `~/.claude/plugins/maccing/pictura/config.json` | API keys, shared across projects |
| project | `.claude/plugins/maccing/pictura/config.json` | Project-specific overrides |

Precedence: Environment variables > Project scope > User scope > Defaults

**Note:** Generated images always output to `.claude/plugins/maccing/pictura/output/` in the project directory, regardless of config scope. This ensures images are project-local assets.
