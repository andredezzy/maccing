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

| Type | Provider | Model IDs | Limitations |
|------|----------|-----------|-------------|
| Generation | Gemini | `gemini-2.5-flash-image` (draft), `gemini-3-pro-image-preview` (pro) | All 10 ratios, 4K max on Pro |
| Generation | OpenAI | `gpt-image-1.5` (recommended), `gpt-image-1` | **Only 3 sizes:** 1024x1024, 1536x1024, 1024x1536 |
| Upscale | Topaz Labs | `standard-v2`, `standard-max`, `recovery-v2`, `high-fidelity-v2` | Generative models are **async only** |
| Upscale | Replicate | TBD (v1.1) | Deferred to future release |

> **CRITICAL: OpenAI DALL-E 3 Deprecation**
> DALL-E 2 and DALL-E 3 are deprecated and will be removed on **May 12, 2026**. Use GPT Image models instead (`gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini`).

**OpenAI Size Limitation Handling:**

OpenAI GPT Image models only support 3 fixed sizes, not aspect ratios:
- 1024x1024 (1:1 square)
- 1536x1024 (~3:2 landscape)
- 1024x1536 (~2:3 portrait)

When OpenAI is selected and user requests unsupported ratio:
1. Warn user that OpenAI has limited size options
2. Fall back to Gemini if configured
3. Or map to nearest supported size (e.g., 16:9 → 1536x1024, 9:16 → 1024x1536)

---

## Rate Limiting and Quotas

### Gemini API Limits

Rate limits apply **per Google Cloud Project**, not per API key. Creating multiple keys won't multiply limits.

| Tier | Images Per Minute (IPM) | Cost |
|------|-------------------------|------|
| Free | 2 IPM | $0 |
| Tier 1 | 10 IPM | Pay-as-you-go |
| Tier 2 | 20 IPM | $250+ cumulative spend + 30 days |
| Tier 3+ | 100+ IPM | Enterprise agreement |

**Pricing:** Gemini 2.5 Flash Image: $0.039 per image (1290 output tokens at $30/1M tokens)

### Topaz API Limits

- Request size limit: **500MB** (HTTP 413 if exceeded)
- Rate limits are dynamic based on server load
- Generative models (standard-max, recovery-v2, high-fidelity-v2) are **async only**

### Cost Optimization Strategies

1. **Batch API:** Gemini offers 50% cost reduction for non-time-sensitive workloads
2. **Context Caching:** Can reduce costs by up to 75% on cached prompt portions
3. **Draft Mode:** Use `gemini-2.5-flash-image` for rapid prototyping, Pro for final assets
4. **Request Caching:** Prevent duplicate generations by caching results locally

---

## Reference Image Handling

### Gemini 3 Pro Multi-Image Support

Gemini 3 Pro Image Preview supports up to **14 reference images**:
- Up to **6 images of objects** for high-fidelity inclusion
- Up to **5 images of humans** for character consistency across generations

### Character Consistency Workflow

1. Upload reference images of the character (up to 5)
2. Model "memorizes" facial features and clothing
3. Subsequent generations maintain consistency
4. If features drift after many edits, restart with detailed description

### Best Practices

- For brand consistency: provide logo/style reference images
- For character series: maintain same reference set across all generations
- Include both front and side views for better character understanding

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
│   ├── gallery.md
│   └── setup.md
├── server/                          # MCP Server (TypeScript)
│   ├── src/
│   │   ├── index.ts                 # MCP server entry
│   │   ├── generate.ts              # Unified generate with fallback chains
│   │   ├── provider-spec/
│   │   │   └── factory.ts           # Provider factory + all types
│   │   ├── providers/
│   │   │   ├── gemini.ts
│   │   │   ├── openai.ts
│   │   │   └── topaz.ts
│   │   ├── core/
│   │   │   ├── config.ts
│   │   │   ├── output.ts
│   │   │   ├── prompt-enhancer.ts
│   │   │   └── retry.ts
│   │   └── utils/
│   │       └── slug.ts
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

MCP servers run in the background and cannot prompt interactively. The setup flow is:

1. User runs `/pictura:generate "test prompt"`
2. MCP tool returns error with setup instructions:
   ```
   Configuration required. Create config file at:
   .claude/plugins/maccing/pictura/config.json

   Required fields:
   - providers.generation.gemini.apiKey: Your Gemini API key

   Optional fields:
   - providers.upscale.topaz.apiKey: For premium upscaling
   ```
3. User creates config file manually or via `/pictura:setup` command
4. `/pictura:setup` command guides Claude to:
   - Ask user for API keys
   - Generate config JSON
   - Write to config file using Write tool
5. Subsequent runs use the config

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

**Mask Handling:**

The `--mask` flag accepts natural language region descriptions. How it works:
1. Gemini API supports text-based masking natively via prompt engineering
2. The edit prompt is structured as: `"In the image, modify only the {mask region}: {edit instruction}"`
3. For providers without native text masking, a separate segmentation model generates the mask

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

### /pictura:setup

Configure API keys and preferences interactively.

**How it works:**
1. Command triggers a skill that guides Claude through setup
2. Claude asks user for each required API key
3. Claude generates the config JSON structure
4. Claude writes config to `.claude/plugins/maccing/pictura/config.json`

**Examples:**
```bash
/pictura:setup                    # Full interactive setup
/pictura:setup --provider gemini  # Configure only Gemini
```

---

## Consistency Strategies

### 1. Generate-then-reference (default)

- Generates first ratio (16:9)
- Uses that image as reference for remaining ratios
- Best balance of consistency and simplicity

**Implementation:**
```typescript
const referenceImage = await generateImage({ prompt, ratio: '16:9' });
for (const ratio of remainingRatios) {
  await generateImage({ prompt, ratio, reference: referenceImage.data });
}
```

### 2. User-provided reference

- User supplies reference image upfront
- All ratios generated using that reference
- Best for matching existing brand assets

**Implementation:**
```typescript
const reference = await fs.readFile(userRefPath);
for (const ratio of ratios) {
  await generateImage({ prompt, ratio, reference });
}
```

### 3. Multi-turn conversation

- Single API session maintained with conversation history
- Each ratio generated sequentially with Claude describing the previous result
- Best for complex scenes requiring reasoning

**Implementation Note:**
Gemini image generation doesn't maintain true conversation state. This strategy works by:
1. Generating first image
2. Claude describes the generated image in detail
3. Subsequent generations include both the original prompt AND Claude's description
4. This creates semantic consistency without actual multi-turn API support

**Limitation:** More expensive (requires Claude analysis between generations)

---

## Automatic Prompt Enhancement

### Core Principle

**"Describe the scene, don't just list keywords."** Gemini excels with narrative, descriptive paragraphs rather than disconnected terms.

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

### Prompt Structure Template

Effective prompts follow this structure:

```
"A [style adjective] [shot type] of [subject], [action/pose],
set in [environment]. The scene is illuminated by [lighting],
creating a [mood] atmosphere. [Technical specifications]."
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

### Photography/Cinematic Language

Use specific terminology for better control:
- **Shot types:** wide-angle, macro, close-up, aerial, Dutch angle
- **Lenses:** 85mm portrait lens, 35mm wide angle, 200mm telephoto
- **Angles:** low-angle, high-angle, eye-level, bird's eye view
- **Depth:** shallow depth of field, bokeh, tilt-shift

### Negative Prompts

Use semantic negative prompts (describe what you want positively):

| Instead of | Use |
|------------|-----|
| "no cars" | "empty street with no traffic" |
| "without people" | "deserted landscape" |
| "no text" | "clean background" |

### Style Detection

| User Input | Style Detected | Enhanced Output |
|------------|----------------|-----------------|
| "cat on roof" | photorealistic | "A fluffy orange tabby cat perched on weathered terracotta roof tiles, golden hour lighting, shallow depth of field, 85mm lens, warm amber tones" |
| "happy robot" | illustration | "A cheerful humanoid robot with rounded features and glowing blue eyes, clean vector style, bold outlines, cel-shaded, vibrant pastel color palette, white background" |
| "luxury watch" | commercial | "High-end chronograph watch on polished marble surface, studio lighting with soft diffusion, elevated 45-degree angle, ultra-realistic product photography, reflective metal details" |

### Iterative Refinement

Don't expect perfection on first attempt:
1. Generate initial image
2. Make incremental adjustments with follow-up prompts
3. If character features drift, restart with detailed description
4. Use "hyper-specific" descriptions for consistency

---

## Two-Turn Premium Upscale

### Pipeline

**Turn 1: Generation API (Native 4K)**
- Regenerates image at maximum native resolution (4096x4096)
- Preserves original composition and style
- Uses reference image consistency

**Turn 2: Topaz Labs API (8x Enhancement)**
- Sends 4K output to Topaz Labs Enhance API
- Model options (exact API names):
  - `standard-max` (Generative): Photorealistic detail, best for photos (default)
  - `recovery-v2` (Generative): Maximum enhancement for lower quality inputs
  - `high-fidelity-v2` (Standard): Preserves fine details for professional use
  - `standard-v2` (Standard): Fast general-purpose upscaling
- Face recovery, sharpening, denoising applied automatically
- **Note:** Generative models are async and may take several minutes

### Topaz Async Job Handling

Generative models (`standard-max`, `recovery-v2`, `high-fidelity-v2`, `redefine`, `wonder`) return a job ID instead of immediate results:

```typescript
// 1. Submit enhancement request
const response = await fetch('https://api.topazlabs.com/v1/enhance', {
  method: 'POST',
  headers: { 'X-API-Key': apiKey },
  body: JSON.stringify({ image: base64, model: 'standard-max', scale: 4 }),
});

const { jobId } = await response.json();

// 2. Poll for completion with exponential backoff
let result = null;
let attempts = 0;
const maxAttempts = 30; // ~5 minutes max

while (!result && attempts < maxAttempts) {
  await sleep(Math.min(2000 * Math.pow(1.5, attempts), 30000));
  const status = await fetch(`https://api.topazlabs.com/v1/jobs/${jobId}`);
  const { state, output } = await status.json();

  if (state === 'completed') result = output;
  if (state === 'failed') throw new Error('Topaz enhancement failed');
  attempts++;
}
```

**Standard models** (`standard-v2`, `low-resolution-v2`, `high-fidelity-v2`, `cgi`) are synchronous and return results immediately

**Topaz API Endpoint:**
```
POST https://api.topazlabs.com/v1/enhance
Headers: X-API-Key: {apiKey}
Body: { image: base64, model: "standard-max", scale: 4 }
```

**Result:** Up to 32K effective resolution (4K x 8x) with best-in-class quality.

---

## Error Handling

### Exponential Backoff with Jitter

Proper retry strategy to prevent thundering herd:

```typescript
// Delay calculation with jitter
const delay = Math.min(
  baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * jitterMs,
  maxDelayMs
);
```

**Parameters:**
- Base delay: 2000ms
- Max delay: 30000ms
- Jitter: 0-3000ms (random)
- Max attempts: 3 (configurable)

### Retry-After Header Handling

Always check and respect the `Retry-After` header when present:

```typescript
const retryAfter = response.headers.get('Retry-After');
if (retryAfter) {
  await sleep(parseInt(retryAfter, 10) * 1000);
}
```

### Error Types and Actions

| Error | Action | Retryable |
|-------|--------|-----------|
| Rate limit (429) | Check Retry-After, then exponential backoff | Yes |
| Quota exceeded | Stop, prompt for tier upgrade | No |
| Content policy | Skip, report, suggest prompt edit | No |
| Network timeout (ECONNRESET, ENOTFOUND) | Retry with backoff | Yes |
| Server error (500, 502, 503, 504) | Retry with backoff | Yes |
| Invalid API key (401, 403) | Stop batch, prompt for config update | No |
| Request too large (413) | Reduce image size, retry | No |
| Topaz async timeout | Poll status endpoint, retry | Yes |

### Differentiating Error Types

```typescript
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Non-retryable errors: stop immediately
  const nonRetryable = ['content policy', 'invalid api key', 'unauthorized', 'quota'];
  if (nonRetryable.some(p => message.includes(p))) return false;

  // Retryable errors: exponential backoff
  const retryable = ['rate limit', '429', 'timeout', 'econnreset', '500', '502', '503', '504'];
  return retryable.some(p => message.includes(p));
}
```

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

## Technical Considerations

### SynthID Watermarks

All Gemini-generated images include an invisible **SynthID watermark** for authentication and provenance tracking. This is embedded by Google and cannot be disabled.

### Aspect Ratio Preservation

During editing operations:
- Gemini generally preserves the input image's aspect ratio
- If multiple images with different ratios are provided, the model adopts the **last image's** ratio
- Include explicit instruction: "Do not change the input aspect ratio" when ratio must be preserved

### Gemini 3 Pro Advanced Features

- **Thinking Mode:** Model uses internal reasoning to refine composition before final output
- **Google Search Grounding:** Real-time data integration for factual imagery
- **Text Rendering:** Capable of generating legible, stylized text for infographics

### Response Metadata

Gemini responses include `groundingMetadata` when using search grounding:
- Search suggestions
- Top 3 web sources used
- Thought signatures (encrypted reasoning traces)

---

## Security

### Gitignore

Only the config file (containing API keys) should be gitignored:

```gitignore
.claude/plugins/maccing/pictura/config.json
```

Output images can be committed and shared.

### API Key Protection

- Config file permissions set to user-only (600) on creation
- Verify permissions on load: warn if permissions are too open
- API keys never logged or exposed in output
- Keys never included in error messages

### Environment Variable Alternative

For CI/CD or containerized deployments, support environment variables:

```bash
PICTURA_GEMINI_API_KEY=...
PICTURA_OPENAI_API_KEY=...
PICTURA_TOPAZ_API_KEY=...
```

Environment variables take precedence over config file.

---

## AI-Guided Validation

### Overview

The plugin includes a comprehensive validation system that Claude Code executes to verify installation, configuration, and production readiness. No manual intervention required unless issues are found.

### Validation Phases

**Phase 1: Pre-flight Checks**
- Config file exists and is valid JSON
- Permissions are secure (600)
- Output directory is writable

**Phase 2: Provider Health Checks**
- Test each configured API key
- Verify quota/rate limit status
- Check available models

**Phase 3: Smoke Tests**
- Generate a simple test image
- Verify prompt enhancement
- Test retry logic with simulated failures

### Running Validation

```bash
# Via command
/pictura:validate

# Via MCP tool
pictura_validate

# Via CLI
cd plugins/maccing-pictura/server && npx tsx src/validation/index.ts
```

### Production Readiness Criteria

The plugin is **PRODUCTION READY** when:
- All automated checks pass (0 failures)
- At least 3 checks pass
- At least one generation provider connected
- Output directory writable

### Validation Output

**Success output:**

★ maccing-pictura: Validation Report ────────────────────────

Date:       2026-01-17 14:30
Config:     .claude/plugins/maccing/pictura/config.json

◎ Phase 1: Pre-flight Checks ────────────────────────────────

✓ Config File Exists (2ms)
✓ Config Permissions (1ms)
✓ Output Directory (3ms)

◎ Phase 2: Provider Health ──────────────────────────────────

✓ Gemini API Connection (145ms)
○ OpenAI API Connection (skipped)
○ Topaz API Connection (skipped)

◎ Phase 3: Smoke Tests ──────────────────────────────────────

✓ Prompt Enhancement (12ms)
✓ Retry Logic (45ms)
✓ Image Generation (2340ms)

────────────────────────────────────────────────────────────────

Summary:
- Passed:   7
- Failed:   0
- Warnings: 0
- Skipped:  2

✓ maccing-pictura: PRODUCTION READY ────────────────────────

**Failure output:**

★ maccing-pictura: Validation Report ────────────────────────

...

✖ FAIL: Config Permissions
Config has insecure permissions (644)
→ chmod 600 .claude/plugins/maccing/pictura/config.json

▲ WARN: Gemini API Connection
Rate limited, generation likely works but at quota
→ Wait 60 seconds and retry, or upgrade API tier

────────────────────────────────────────────────────────────────

Summary:
- Passed:   5
- Failed:   1
- Warnings: 1
- Skipped:  2

⚠ maccing-pictura: NOT PRODUCTION READY ────────────────────

Blockers:
1. Config Permissions: Config has insecure permissions (644)

Next Steps:
1. chmod 600 .claude/plugins/maccing/pictura/config.json
2. Re-run /pictura:validate

### Interactive Troubleshooting

If validation fails, Claude will:
1. Identify the specific failure
2. Explain the root cause
3. Provide exact remediation command
4. Re-run the check to confirm fix

---

## References

- [Gemini Image Generation Docs](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini 2.5 Flash Prompting Guide](https://developers.googleblog.com/en/how-to-prompt-gemini-2-5-flash-image-generation-for-the-best-results/)
- [Topaz Labs Enhance API](https://www.topazlabs.com/enhance-api)
- [Topaz Available Models](https://developer.topazlabs.com/image-api/available-models)
- [Claude Code Plugins Docs](https://code.claude.com/docs/en/plugins)
- [Claude Code MCP Integration](https://code.claude.com/docs/en/mcp)
- [PromptEnhancer Research](https://arxiv.org/abs/2403.17804)
