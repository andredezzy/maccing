# maccing-pictura: Multi-Ratio Image Generation Plugin

**Date:** 2026-01-17
**Status:** Design Complete
**Author:** Andre Dezzy

---

## Overview

**maccing-pictura** is a Claude Code plugin for generating consistent images across multiple aspect ratios using a provider-agnostic architecture. It supports automatic prompt enhancement, full editing capabilities, and two-turn premium upscaling.

### Core Value Proposition

- Generate one image concept in multiple formats with a single command
- Maintain visual consistency across all ratios via reference images or multi-turn context
- Automatic prompt enhancement using 24-point taxonomy
- Full editing suite: refine, inpaint, outpaint, restyle, upscale
- Quality-first defaults with draft mode for fast iteration

### Supported Aspect Ratios

1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9

---

## Architecture

### MCP-Based Execution Model

Claude Code plugins don't execute code directly. Instead:
- **Commands/Skills**: Markdown instructions that guide Claude
- **MCP Servers**: Actual code execution via Model Context Protocol
- **Hooks**: Shell command execution on events

```
+-----------------------------------------------------------+
|                     Claude Code                            |
|  +-------------------+    +-----------------------------+ |
|  | /pictura:*        |    | Skills (natural language)   | |
|  | (Markdown)        |--->| Guide Claude to use tools   | |
|  +---------+---------+    +-------------+---------------+ |
|            |                            |                  |
|            v                            v                  |
|  +-----------------------------------------------------------+
|  |              MCP Tool Invocation                          |
|  +-----------------------------+-----------------------------+
+--------------------------------|------------------------------+
                                 |
                                 v
+---------------------------------------------------------------+
|              pictura-mcp-server (TypeScript)                   |
|                                                                |
|  Tools exposed:                                                |
|  - pictura_generate(prompt, ratios, options)                   |
|  - pictura_edit(slug, options)                                 |
|  - pictura_upscale(slug, options)                              |
|  - pictura_list(filter)                                        |
|  - pictura_gallery(filter)                                     |
|                                                                |
|  +-------------+  +-------------+  +-------------+             |
|  |   Gemini    |  |   OpenAI    |  |   Topaz     |             |
|  |  Provider   |  |  Provider   |  |  Provider   |             |
|  +-------------+  +-------------+  +-------------+             |
+---------------------------------------------------------------+
```

### Provider-Agnostic Design

The plugin defines interfaces for generation and upscaling, with swappable provider implementations:

```typescript
interface GenerationProvider {
  name: string;
  initialize(config: Record<string, unknown>): Promise<void>;
  generate(prompt: string, ratio: string, options: GenOptions): Promise<Image>;
  edit(image: Image, options: EditOptions): Promise<Image>;
  getCapabilities(): ProviderCapabilities;
}

interface UpscaleProvider {
  name: string;
  initialize(config: Record<string, unknown>): Promise<void>;
  upscale(image: Image, options: UpscaleOptions): Promise<Image>;
  getCapabilities(): { maxScale: number; models: string[] };
}
```

**Bundled Providers (v1.0):**

| Type | Provider | Notes |
|------|----------|-------|
| Generation | Gemini | Nano Banana + Pro |
| Generation | OpenAI | DALL-E 3 |
| Upscale | Topaz Labs | Standard + Generative models |
| Upscale | Replicate | Various open models |

---

## File Structure

### Plugin Directory

```
plugins/maccing-pictura/
├── .claude-plugin/
│   └── plugin.json
├── .mcp.json                        # MCP server config
├── skills/
│   └── image-generation/
│       └── SKILL.md
├── commands/
│   ├── generate.md
│   ├── edit.md
│   ├── upscale.md
│   ├── list.md
│   └── gallery.md
├── server/                          # MCP Server (TypeScript)
│   ├── src/
│   │   ├── index.ts                 # MCP server entry
│   │   ├── tools/
│   │   │   ├── generate.ts
│   │   │   ├── edit.ts
│   │   │   ├── upscale.ts
│   │   │   ├── list.ts
│   │   │   └── gallery.ts
│   │   ├── providers/
│   │   │   ├── generation/
│   │   │   │   ├── base.ts
│   │   │   │   ├── gemini.ts
│   │   │   │   └── openai.ts
│   │   │   └── upscale/
│   │   │       ├── base.ts
│   │   │       ├── topaz.ts
│   │   │       └── replicate.ts
│   │   ├── core/
│   │   │   ├── orchestrator.ts
│   │   │   ├── prompt-enhancer.ts
│   │   │   ├── consistency.ts
│   │   │   ├── config.ts
│   │   │   ├── retry.ts
│   │   │   └── output.ts
│   │   ├── gallery/
│   │   │   ├── generator.ts
│   │   │   └── template.html
│   │   ├── types/
│   │   │   ├── provider.ts
│   │   │   ├── image.ts
│   │   │   └── config.ts
│   │   └── utils/
│   │       ├── slug.ts
│   │       ├── ratio.ts
│   │       └── logger.ts
│   ├── dist/
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

### Project Output Directory

```
project-repo/
├── .claude/
│   └── plugins/
│       └── maccing/
│           └── pictura/
│               ├── config.json      # GITIGNORED (API keys)
│               └── output/
│                   └── {timestamp}/
│                       └── {prompt-slug}/
│                           └── {ratio}.png
├── .gitignore                       # Contains: .claude/plugins/maccing/pictura/config.json
└── ...
```

---

## Configuration

### Config File Location

Project-local: `.claude/plugins/maccing/pictura/config.json`

### Config Schema

```json
{
  "providers": {
    "generation": {
      "default": "gemini",
      "gemini": {
        "apiKey": "...",
        "defaultModel": "pro"
      },
      "openai": {
        "apiKey": "..."
      }
    },
    "upscale": {
      "default": "topaz",
      "topaz": {
        "apiKey": "...",
        "defaultModel": "standard-max"
      },
      "replicate": {
        "apiKey": "..."
      }
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

### MCP Server Config (.mcp.json)

```json
{
  "pictura": {
    "command": "node",
    "args": ["${CLAUDE_PLUGIN_ROOT}/server/dist/index.js"],
    "env": {
      "PICTURA_CONFIG": ".claude/plugins/maccing/pictura/config.json"
    }
  }
}
```

### First-Run Setup

1. User runs `/pictura:generate "test prompt"`
2. Plugin detects missing config
3. Prompts: "Gemini API key not found. Enter your key:"
4. Prompts: "Topaz API key (optional, for premium upscale):"
5. Creates config file with defaults
6. Proceeds with generation

---

## Commands

### /pictura:generate

Generate images in multiple aspect ratios.

**Flags:**
- `--ratios 1:1,16:9,9:16`: Explicit ratio list
- `--social` / `--web` / `--portrait` / `--landscape` / `--print`: Preset bundles
- `--draft`: Use Flash model for speed (default: Pro)
- `--size 1K|2K|4K`: Output resolution (default: 2K)
- `--ref path/to/image.png`: Reference image for consistency
- `--consistency generate|reference|multiturn`: Consistency strategy
- `--provider gemini|openai`: Override generation provider
- `--enhance` (default) / `--no-enhance`: Prompt enhancement
- `--enhance-style auto|photo|art|commercial|minimal`: Enhancement style

**Preset Bundles:**

| Flag | Ratios | Use case |
|------|--------|----------|
| `--social` | 1:1, 9:16, 16:9 | Instagram, Stories, YouTube |
| `--web` | 16:9, 4:3, 1:1 | Hero images, thumbnails |
| `--portrait` | 2:3, 3:4, 4:5, 9:16 | Vertical formats |
| `--landscape` | 3:2, 4:3, 16:9, 21:9 | Horizontal formats |
| `--print` | 2:3, 3:4, 4:5 | Standard print ratios |

**Examples:**
```bash
/pictura:generate "mountain sunset" --social
/pictura:generate "product shot" --ratios 1:1,16:9 --ref ./brand-ref.png
/pictura:generate "abstract background" --web --draft
```

### /pictura:edit

Edit existing image batch by prompt slug.

**Flags:**
- `--prompt "edit instruction"`: What to change
- `--mask "region description"`: Target specific area (inpaint)
- `--extend top|bottom|left|right`: Outpaint direction
- `--style path/to/style.png`: Style transfer reference

**Examples:**
```bash
/pictura:edit "mountain-sunset" --prompt "add dramatic clouds"
/pictura:edit "product-shot" --mask "background" --prompt "gradient blue"
/pictura:edit "hero-image" --extend top --prompt "add more sky"
/pictura:edit "mascot" --style ./watercolor-ref.png
```

### /pictura:upscale

Two-turn premium upscale: Generation API (4K) then Topaz Labs (8x enhancement).

**Flags:**
- `--topaz-model standard-max|recovery|hifi`: Topaz model selection
- `--upscaler topaz|replicate`: Override upscale provider
- `--skip-topaz`: Gemini 4K only (skip second turn)

**Examples:**
```bash
/pictura:upscale "logo-concept"
/pictura:upscale "product-shot" --topaz-model hifi
/pictura:upscale "hero-image" --skip-topaz
```

### /pictura:list

Show recent generations with paths.

**Flags:**
- `--limit 5`: Show only N most recent (default: 10)
- `--filter "sunset"`: Filter by prompt slug

### /pictura:gallery

Open visual browser in default browser.

**Flags:**
- `--filter "product"`: Show only matching slugs
- `--since 2026-01-15`: Filter by date

---

## Consistency Strategies

### 1. Generate-then-reference (default)

- Generates first ratio (16:9)
- Uses that image as reference for remaining ratios
- Best balance of consistency and simplicity

### 2. User-provided reference

- User supplies reference image upfront
- All ratios generated using that reference
- Best for matching existing brand assets

### 3. Multi-turn conversation

- Single chat session maintained
- Each ratio generated sequentially with full context
- Best for complex scenes requiring reasoning

---

## Automatic Prompt Enhancement

### Enhancement Pipeline

```
User prompt --> Prompt Enhancer --> Enhanced prompt --> Image Generation API
     |              |                  |
"cat on roof"   Analyzes &      "A fluffy orange tabby cat perched
                enhances         on weathered terracotta roof tiles,
                                 golden hour lighting casting long
                                 shadows, shallow depth of field,
                                 85mm portrait lens, warm amber tones"
```

### Enhancement Taxonomy (24-point framework)

| Category | Elements Added |
|----------|----------------|
| **Subject** | Specific details, materials, textures, colors |
| **Composition** | Shot type, angle, framing, focal point |
| **Lighting** | Type, direction, quality, color temperature |
| **Environment** | Setting, atmosphere, weather, time of day |
| **Style** | Art movement, technique, medium, artist reference |
| **Technical** | Lens, aperture, resolution, aspect ratio |

### Style Detection

| User Input | Style Detected | Enhanced Output |
|------------|----------------|-----------------|
| "cat on roof" | photorealistic | "A fluffy orange tabby cat perched on weathered terracotta roof tiles, golden hour lighting, shallow depth of field, 85mm lens, warm amber tones" |
| "happy robot" | illustration | "A cheerful humanoid robot with rounded features and glowing blue eyes, clean vector style, bold outlines, cel-shaded, vibrant pastel color palette, white background" |
| "luxury watch" | commercial | "High-end chronograph watch on polished marble surface, studio lighting with soft diffusion, elevated 45-degree angle, ultra-realistic product photography, reflective metal details" |

---

## Two-Turn Premium Upscale

### Pipeline

**Turn 1: Generation API (Native 4K)**
- Regenerates image at maximum native resolution (4096x4096)
- Preserves original composition and style
- Uses reference image consistency

**Turn 2: Topaz Labs API (8x Enhancement)**
- Sends 4K output to Topaz Labs Enhance API
- Model options:
  - `Standard MAX`: Photorealistic detail, best for photos (default)
  - `Recovery V2`: Maximum enhancement for lower quality inputs
  - `High Fidelity V2`: Preserves fine details for professional use
- Face recovery, sharpening, denoising applied automatically

**Result:** Up to 32K effective resolution (4K x 8x) with best-in-class quality.

---

## Error Handling

### Best Effort + Retry Strategy

- Exponential backoff: 2s, 4s, 8s
- Max attempts configurable (default: 3)
- Continues to next ratio after max retries exhausted

### Error Types and Actions

| Error | Action |
|-------|--------|
| Rate limit (429) | Retry with backoff |
| Content policy | Skip, report, suggest prompt edit |
| Network timeout | Retry with backoff |
| Invalid API key | Stop batch, prompt for config update |
| Topaz rate limit | Retry with backoff |
| Topaz timeout | Retry with backoff |
| Topaz invalid key | Stop upscale, prompt for config update |

---

## Skill Definition

```markdown
---
name: image-generation
description: Use when user wants to generate, create, or make images,
  pictures, visuals, graphics, or assets in multiple formats, sizes,
  or aspect ratios. Also triggers for editing, upscaling, or managing
  generated images.
---
```

### Natural Language Triggers

- "Generate an image of a mountain sunset for social media"
- "Create product photos in web formats"
- "Make me a hero image of a cat"
- "Edit the mountain-sunset images to add clouds"
- "Upscale the product-hero batch"
- "Show me my recent image generations"
- "Open the image gallery"

---

## Security

### Gitignore

Only the config file (containing API keys) should be gitignored:

```gitignore
.claude/plugins/maccing/pictura/config.json
```

Output images can be committed and shared.

### API Key Protection

- Config file permissions set to user-only (600)
- API keys never logged or exposed in output

---

## References

- [Gemini Image Generation Docs](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini 2.5 Flash Prompting Guide](https://developers.googleblog.com/en/how-to-prompt-gemini-2-5-flash-image-generation-for-the-best-results/)
- [Topaz Labs Enhance API](https://www.topazlabs.com/enhance-api)
- [Topaz Available Models](https://developer.topazlabs.com/image-api/available-models)
- [Claude Code Plugins Docs](https://code.claude.com/docs/en/plugins)
- [Claude Code MCP Integration](https://code.claude.com/docs/en/mcp)
- [PromptEnhancer Research](https://arxiv.org/abs/2403.17804)
