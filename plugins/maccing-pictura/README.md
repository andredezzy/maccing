# maccing-pictura

Provider-agnostic multi-ratio image generation plugin for Claude Code.

## Features

- Generate images in multiple aspect ratios with consistency
- Reference image support for visual consistency
- Automatic prompt enhancement via Claude
- Two-turn premium upscaling (Gemini 4K + Topaz Labs)
- Full editing suite: refine, inpaint, outpaint, restyle
- Unified API with provider fallback chains

## Installation

```bash
claude plugin install maccing-pictura@maccing
```

## Quick Start

```bash
# Generate images (will prompt for API key on first use)
/pictura:generate "a majestic mountain landscape" --ratios 16:9,1:1

# View recent generations
/pictura:gallery --since 24h
```

On first use, Pictura will automatically guide you through configuration by asking for your preferred provider and API key.

## Commands

### Generate Images

```bash
/pictura:generate "prompt" --ratios 16:9,1:1,9:16
```

**Flags:**
- `--ratios`: Aspect ratios to generate (default: 16:9,1:1,9:16)
- `--provider`: Image provider (gpt-image-1, gemini, replicate)
- `--enhance`: Enable Claude prompt enhancement
- `--ref`: Path to reference image for visual consistency
- `--consistency`: Consistency strategy (generate, reference, multiturn)

**Consistency Strategies:**
- `generate`: Use first generated image as reference for subsequent ratios
- `reference`: Use provided `--ref` image as reference for all generations
- `multiturn`: Claude describes each image before generation for consistency

### Edit Images

```bash
/pictura:edit --batch abc123 --op refine "make the sky more dramatic"
```

**Operations:**
- `refine`: Enhance details and quality
- `inpaint`: Fill masked regions with new content
- `outpaint`: Extend image beyond original boundaries
- `restyle`: Apply new artistic style

**Flags:**
- `--batch`: Batch ID to edit (required)
- `--op`: Edit operation (refine, inpaint, outpaint, restyle)
- `--mask`: Path to mask image (for inpaint)
- `--style`: Path to style reference image (for restyle)
- `--provider`: Override provider (openai, gemini, replicate)

### Upscale Images

```bash
/pictura:upscale --batch abc123 --scale 4
```

**Flags:**
- `--batch`: Batch ID to upscale (required)
- `--scale`: Scale factor (2, 4, 8)
- `--model`: Topaz model for upscaling
- `--provider`: Override provider (topaz, replicate)
- `--skip-topaz`: Use Gemini 4K regeneration only, skip Topaz enhancement

### Browse Gallery

```bash
/pictura:gallery
```

**Flags:**
- `--filter`: Filter by tag or prompt keyword
- `--since`: Show generations from time period (e.g., 24h, 7d, 1w)

### List Generations

```bash
/pictura:list
```

Shows recent generation batches with IDs for use with edit/upscale commands.

## Configuration

Pictura supports dual-scope configuration with the following precedence:

| Priority | Scope | Path | Purpose |
|----------|-------|------|---------|
| 1 | Environment | `PICTURA_*_API_KEY` | Override API keys via environment |
| 2 | Project | `.claude/plugins/maccing/pictura/config.json` | Project-specific overrides |
| 3 | User | `~/.claude/plugins/maccing/pictura/config.json` | Shared API keys across projects |

**Note:** Generated images always output to `.claude/plugins/maccing/pictura/output/` in the project directory, regardless of config scope.

### First-Time Setup

Configuration happens automatically on first use. When you run any pictura command without configuration, Claude will:

1. Ask which provider you want to use (Gemini recommended, free tier available)
2. Ask for your API key
3. Save configuration to user scope (shared across projects)

**Get API keys:**
- Gemini: https://aistudio.google.com/apikey
- OpenAI: https://platform.openai.com/api-keys

### Config Structure

```json
{
  "providers": {
    "generation": {
      "default": "gemini",
      "gemini": { "apiKey": "your-key", "defaultModel": "pro" },
      "openai": { "apiKey": "your-key" }
    },
    "upscale": {
      "default": "topaz",
      "topaz": { "apiKey": "your-key" }
    }
  },
  "defaultRatio": "16:9",
  "defaultQuality": "pro",
  "imageSize": "2K",
  "outputDir": ".claude/plugins/maccing/pictura/output"
}
```

## Providers

### Generation Providers
- **gpt-image-1**: OpenAI DALL-E (default)
- **gemini**: Google Gemini Imagen
- **replicate**: Replicate models (Flux, SDXL)

### Upscale Providers
- **topaz**: Topaz Labs AI upscaling (requires API key)
- **replicate**: Replicate upscale models

## Architecture

The plugin uses a provider-agnostic architecture with separate registries for generation and upscale providers. Each operation (generate, edit, upscale) supports provider fallback chains for reliability.

See [design document](../../docs/plans/2026-01-17-pictura-design.md) for full details.

## Troubleshooting

**Expected version:** 1.1.2

If commands are not available, ensure:
1. Plugin is installed: `claude plugin list`
2. MCP server is running: check Claude Code logs
3. API keys are configured in config.json
