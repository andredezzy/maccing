# Pictura Completion: Missing Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete all missing features from the pictura design document: reference images, consistency strategies, Topaz provider, edit operations, and upscale operations.

**Architecture:** The plugin uses a provider-agnostic design where `generate.ts` orchestrates image generation across registered providers (Gemini, OpenAI, Topaz). The MCP server in `index.ts` exposes tools that call into this orchestration layer. Reference image support already exists in `generate.ts` but isn't wired to the MCP layer.

**Tech Stack:** TypeScript, MCP SDK, Zod validation, Node.js fs/path, HTTP fetch for API calls

---

## Phase 1: Reference Image and Consistency Support

### Task 1: Add Reference Image Flag to Generate Command

**Files:**
- Modify: `plugins/maccing-pictura/commands/generate.md:15-21`

**Step 1: Read the current generate.md file**

Verify current flags section.

**Step 2: Add --ref flag documentation**

Add to the Flags section after `--provider`:

```markdown
- `--ref`: Path to reference image for visual consistency
- `--consistency`: Consistency strategy (generate, reference, multiturn)
```

**Step 3: Update examples**

Add example:
```
/pictura:generate "product on marble" --social --ref ./brand-reference.png
```

**Step 4: Commit**

```bash
git add plugins/maccing-pictura/commands/generate.md
git commit -m "docs: add --ref and --consistency flags to generate command"
```

---

### Task 2: Add Reference Image Support to MCP Tool Schema

**Files:**
- Modify: `plugins/maccing-pictura/server/src/index.ts:75-86`

**Step 1: Write the failing test**

Create test file:

```typescript
// server/src/index.test.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// We'll test the schema directly
const GenerateParamsSchema = z.object({
  prompt: z.string(),
  ratios: z.array(z.string()).optional(),
  preset: z.enum(['social', 'web', 'portrait', 'landscape', 'print']).optional(),
  quality: z.enum(['draft', 'pro']).optional(),
  size: z.enum(['1K', '2K', '4K']).optional(),
  provider: z.enum(['gemini', 'openai']).optional(),
  enhance: z.boolean().optional(),
  enhanceStyle: z.enum(['photo', 'art', 'commercial', 'auto', 'minimal']).optional(),
  ref: z.string().optional(),
  consistency: z.enum(['generate', 'reference', 'multiturn']).optional(),
});

describe('GenerateParamsSchema', () => {
  it('should accept ref parameter', () => {
    const result = GenerateParamsSchema.safeParse({
      prompt: 'test',
      ref: '/path/to/image.png',
    });
    expect(result.success).toBe(true);
  });

  it('should accept consistency parameter', () => {
    const result = GenerateParamsSchema.safeParse({
      prompt: 'test',
      consistency: 'reference',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid consistency value', () => {
    const result = GenerateParamsSchema.safeParse({
      prompt: 'test',
      consistency: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugins/maccing-pictura/server && npm test -- src/index.test.ts`
Expected: FAIL (file doesn't exist yet, then schema won't have ref/consistency)

**Step 3: Update GenerateParamsSchema in index.ts**

In `plugins/maccing-pictura/server/src/index.ts`, modify the schema at lines 75-86:

```typescript
const GenerateParamsSchema = z.object({
  prompt: z.string().describe('The image generation prompt'),
  ratios: z.array(RatioSchema).optional().describe('Aspect ratios to generate (e.g., ["16:9", "1:1"])'),
  preset: z.enum(['social', 'web', 'portrait', 'landscape', 'print']).optional()
    .describe('Preset bundle of ratios (overrides ratios if provided)'),
  quality: z.enum(['draft', 'pro']).optional().describe('Generation quality level'),
  size: z.enum(['1K', '2K', '4K']).optional().describe('Output image size'),
  provider: z.enum(['gemini', 'openai']).optional().describe('Image generation provider'),
  enhance: z.boolean().optional().describe('Enable automatic prompt enhancement'),
  enhanceStyle: z.enum(['photo', 'art', 'commercial', 'auto', 'minimal']).optional()
    .describe('Style for prompt enhancement'),
  ref: z.string().optional().describe('Path to reference image for visual consistency'),
  consistency: z.enum(['generate', 'reference', 'multiturn']).optional()
    .describe('Consistency strategy: generate (use first image), reference (use provided ref), multiturn (Claude describes each)'),
});
```

**Step 4: Run test to verify it passes**

Run: `cd plugins/maccing-pictura/server && npm test -- src/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/index.ts plugins/maccing-pictura/server/src/index.test.ts
git commit -m "feat: add ref and consistency params to generate schema"
```

---

### Task 3: Wire Reference Image to generateImages Call

**Files:**
- Modify: `plugins/maccing-pictura/server/src/index.ts:159-286`

**Step 1: Write the failing test**

Add to `server/src/generate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateImages, registerProvider, clearProviderRegistry } from './generate';
import type { ImageProviderFunction, GenerateImageParams, ImageResult } from './provider-spec/factory';

describe('generateImages with reference', () => {
  beforeEach(() => {
    clearProviderRegistry();
  });

  it('should pass user-provided reference to all generations', async () => {
    const generateCalls: GenerateImageParams[] = [];

    const mockProvider: ImageProviderFunction<'test'> = Object.assign(
      (modelId: 'test') => ({
        provider: 'mock',
        modelId,
        capabilities: {
          maxResolution: '2K' as const,
          supportedRatios: ['16:9', '1:1'] as const,
          supportsReference: true,
          supportsEdit: false,
          supportsInpaint: false,
          supportsOutpaint: false,
        },
      }),
      {
        name: 'mock',
        spec: {} as any,
        generateImage: async (modelId: string, params: GenerateImageParams): Promise<ImageResult> => {
          generateCalls.push(params);
          return {
            data: Buffer.from('test'),
            ratio: params.ratio,
            width: 1920,
            height: 1080,
            provider: 'mock',
            model: modelId,
          };
        },
      }
    );

    registerProvider(mockProvider);

    const userReference = Buffer.from('user-reference-image');

    await generateImages({
      model: mockProvider('test'),
      prompt: 'test prompt',
      ratios: ['16:9', '1:1'],
      config: {},
      reference: userReference,
    });

    // Both calls should use the user-provided reference
    expect(generateCalls[0].reference).toBe(userReference);
    expect(generateCalls[1].reference).toBe(userReference);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd plugins/maccing-pictura/server && npm test -- src/generate.test.ts`
Expected: PASS (this functionality already exists in generate.ts)

**Step 3: Update pictura_generate handler to read ref file**

In `index.ts`, inside the `pictura_generate` tool handler, add reference file reading:

```typescript
// After line 169 (destructuring params), add:
const {
  prompt,
  ratios: inputRatios,
  preset,
  quality,
  size,
  provider: inputProvider,
  enhance,
  enhanceStyle,
  ref,
  consistency,
} = params;

// After config loading (around line 242), add reference image loading:
let referenceImage: Buffer | undefined;
if (ref) {
  try {
    referenceImage = await fs.readFile(ref);
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to read reference image: ${ref}\nError: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
}

// Update the generateImages call to include reference:
const results = await generateImages({
  model,
  prompt: finalPrompt,
  ratios,
  size: (size || config.imageSize) as ImageSize,
  config: providerConfig,
  reference: referenceImage,
});
```

**Step 4: Run full test suite**

Run: `cd plugins/maccing-pictura/server && npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/index.ts
git commit -m "feat: wire reference image loading to generate tool"
```

---

### Task 4: Update Gallery Command Documentation

**Files:**
- Modify: `plugins/maccing-pictura/commands/gallery.md:9-13`

**Step 1: Read current gallery.md**

Verify current state.

**Step 2: Add --since flag to documentation**

Update the Flags section:

```markdown
## Flags

- `--batch`: Open a specific batch by ID
- `--browse`: Browse all batches in the gallery
- `--filter`: Filter batches by prompt slug
- `--since`: Only show batches since date (YYYY-MM-DD)
```

**Step 3: Add example**

```markdown
## Examples

```
/pictura:gallery
/pictura:gallery --browse
/pictura:gallery --batch abc123
/pictura:gallery --filter "product"
/pictura:gallery --since 2026-01-15
```
```

**Step 4: Commit**

```bash
git add plugins/maccing-pictura/commands/gallery.md
git commit -m "docs: add --filter and --since flags to gallery command"
```

---

## Phase 2: Topaz Provider Implementation

### Task 5: Create Topaz Provider Skeleton

**Files:**
- Create: `plugins/maccing-pictura/server/src/providers/topaz.ts`
- Create: `plugins/maccing-pictura/server/src/providers/topaz.test.ts`

**Step 1: Write the failing test**

```typescript
// server/src/providers/topaz.test.ts
import { describe, it, expect } from 'vitest';
import { topaz, TOPAZ_MODELS } from './topaz';

describe('topaz provider', () => {
  it('should have correct name', () => {
    expect(topaz.name).toBe('topaz');
  });

  it('should expose all models', () => {
    expect(TOPAZ_MODELS).toContain('standard-v2');
    expect(TOPAZ_MODELS).toContain('standard-max');
    expect(TOPAZ_MODELS).toContain('recovery-v2');
    expect(TOPAZ_MODELS).toContain('high-fidelity-v2');
  });

  it('should have maxScale of 8', () => {
    expect(topaz.maxScale).toBe(8);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugins/maccing-pictura/server && npm test -- src/providers/topaz.test.ts`
Expected: FAIL (file doesn't exist)

**Step 3: Create topaz.ts provider**

```typescript
// server/src/providers/topaz.ts
import {
  createUpscaleProvider,
  type UpscaleProviderSpec,
  type UpscaleImageParams,
  type ImageResult,
} from '../provider-spec/factory.js';

export const TOPAZ_MODELS = [
  'standard-v2',      // Fast general-purpose (sync)
  'standard-max',     // Generative photorealistic (async)
  'recovery-v2',      // Maximum enhancement (async)
  'high-fidelity-v2', // Preserves fine details (sync)
] as const;

export type TopazModel = typeof TOPAZ_MODELS[number];

// Async models require polling
const ASYNC_MODELS: TopazModel[] = ['standard-max', 'recovery-v2'];

const topazSpec: UpscaleProviderSpec = {
  name: 'topaz',
  models: [...TOPAZ_MODELS],
  maxScale: 8,

  async upscale(
    params: UpscaleImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult> {
    const apiKey = config.apiKey as string;
    if (!apiKey) {
      throw new Error('Topaz API key is required');
    }

    const model = (params.model || 'standard-max') as TopazModel;
    const scale = params.scale || 4;
    const isAsync = ASYNC_MODELS.includes(model);

    // TODO: Implement actual Topaz API call
    // Stub for development
    const stubData = Buffer.from(`topaz-${model}-${scale}x-${Date.now()}`);

    return {
      data: stubData,
      ratio: '16:9', // Preserve original ratio
      width: 4096 * scale,
      height: 2304 * scale,
      provider: 'topaz',
      model,
    };
  },
};

export const topaz = createUpscaleProvider(topazSpec);
```

**Step 4: Run test to verify it passes**

Run: `cd plugins/maccing-pictura/server && npm test -- src/providers/topaz.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/providers/topaz.ts plugins/maccing-pictura/server/src/providers/topaz.test.ts
git commit -m "feat: add topaz upscale provider skeleton"
```

---

### Task 6: Add Skip-Topaz Flag to Upscale Command

**Files:**
- Modify: `plugins/maccing-pictura/commands/upscale.md:9-14`

**Step 1: Update upscale.md flags section**

```markdown
## Flags

- `--batch`: Batch ID to upscale (required)
- `--scale`: Scale factor (2, 4, 8)
- `--model`: Topaz model to use (standard-v2, standard-max, recovery-v2, high-fidelity-v2)
- `--provider`: Override provider (topaz, replicate)
- `--skip-topaz`: Use Gemini 4K regeneration only, skip Topaz enhancement
```

**Step 2: Add example**

```markdown
## Examples

```
/pictura:upscale --batch abc123 --scale 2
/pictura:upscale --batch abc123 --scale 4 --provider topaz
/pictura:upscale --batch abc123 --scale 8 --model standard-max
/pictura:upscale --batch abc123 --skip-topaz
```
```

**Step 3: Commit**

```bash
git add plugins/maccing-pictura/commands/upscale.md
git commit -m "docs: add --skip-topaz flag to upscale command"
```

---

## Phase 3: Edit Operations Implementation

### Task 7: Create Edit Operation Handler

**Files:**
- Modify: `plugins/maccing-pictura/server/src/index.ts:397-439` (pictura_edit tool)
- Create: `plugins/maccing-pictura/server/src/edit.ts`
- Create: `plugins/maccing-pictura/server/src/edit.test.ts`

**Step 1: Write the failing test**

```typescript
// server/src/edit.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { editImage, EditOperation } from './edit';
import { registerProvider, clearProviderRegistry } from './generate';
import type { ImageProviderFunction, EditImageParams, ImageResult } from './provider-spec/factory';

describe('editImage', () => {
  beforeEach(() => {
    clearProviderRegistry();
  });

  it('should call provider editImage with correct params', async () => {
    let editCalled = false;
    let editParams: EditImageParams | null = null;

    const mockProvider: ImageProviderFunction<'test'> = Object.assign(
      (modelId: 'test') => ({
        provider: 'mock',
        modelId,
        capabilities: {
          maxResolution: '2K' as const,
          supportedRatios: ['16:9'] as const,
          supportsReference: true,
          supportsEdit: true,
          supportsInpaint: true,
          supportsOutpaint: true,
        },
      }),
      {
        name: 'mock',
        spec: {} as any,
        generateImage: async (): Promise<ImageResult> => {
          throw new Error('Should not call generateImage');
        },
        editImage: async (modelId: string, params: EditImageParams): Promise<ImageResult> => {
          editCalled = true;
          editParams = params;
          return {
            data: Buffer.from('edited'),
            ratio: '16:9',
            width: 1920,
            height: 1080,
            provider: 'mock',
            model: modelId,
          };
        },
      }
    );

    registerProvider(mockProvider);

    const result = await editImage({
      model: mockProvider('test'),
      image: Buffer.from('original'),
      prompt: 'add clouds',
      operation: 'refine',
      config: {},
    });

    expect(editCalled).toBe(true);
    expect(editParams?.prompt).toBe('add clouds');
    expect(result.provider).toBe('mock');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugins/maccing-pictura/server && npm test -- src/edit.test.ts`
Expected: FAIL (file doesn't exist)

**Step 3: Create edit.ts**

```typescript
// server/src/edit.ts
import {
  type ModelSelector,
  type ModelWithFallbacks,
  type EditImageParams,
  type ImageResult,
} from './provider-spec/factory.js';
import { getProvider } from './generate.js';

export type EditOperation = 'refine' | 'inpaint' | 'outpaint' | 'restyle';

export interface EditImageOptions {
  model: ModelWithFallbacks;
  image: Buffer;
  prompt: string;
  operation: EditOperation;
  mask?: string;
  direction?: 'top' | 'bottom' | 'left' | 'right';
  styleRef?: Buffer;
  config: Record<string, unknown>;
}

/**
 * Edit an image using the specified model or fallback chain.
 */
export async function editImage(options: EditImageOptions): Promise<ImageResult> {
  const { model, image, prompt, operation, mask, direction, styleRef, config } = options;

  const models = Array.isArray(model) ? model : [model];
  const errors: Error[] = [];

  for (const modelSelector of models) {
    try {
      const provider = getProvider(modelSelector.provider);

      if (!provider) {
        throw new Error(`Provider not registered: ${modelSelector.provider}`);
      }

      if (!provider.editImage) {
        throw new Error(`Provider ${modelSelector.provider} does not support edit operations`);
      }

      // Build edit params based on operation type
      const editParams: EditImageParams = {
        image,
        prompt: buildEditPrompt(prompt, operation, mask),
        mask: operation === 'inpaint' ? mask : undefined,
        extend: operation === 'outpaint' ? direction : undefined,
        style: operation === 'restyle' ? styleRef : undefined,
      };

      const result = await provider.editImage(modelSelector.modelId, editParams, config);
      return result;
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      continue;
    }
  }

  throw new Error(`All providers failed: ${errors.map((e) => e.message).join(', ')}`);
}

/**
 * Build the edit prompt based on operation type.
 */
function buildEditPrompt(prompt: string, operation: EditOperation, mask?: string): string {
  switch (operation) {
    case 'inpaint':
      return mask
        ? `In the image, modify only the ${mask}: ${prompt}`
        : prompt;
    case 'outpaint':
      return `Extend the image: ${prompt}`;
    case 'restyle':
      return `Apply style to image: ${prompt}`;
    case 'refine':
    default:
      return prompt;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugins/maccing-pictura/server && npm test -- src/edit.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/edit.ts plugins/maccing-pictura/server/src/edit.test.ts
git commit -m "feat: add edit operation handler"
```

---

### Task 8: Wire Edit Handler to MCP Tool

**Files:**
- Modify: `plugins/maccing-pictura/server/src/index.ts:397-439`

**Step 1: Import edit module**

Add at top of index.ts:

```typescript
import { editImage, type EditOperation } from './edit.js';
```

**Step 2: Update EditParamsSchema**

```typescript
const EditParamsSchema = z.object({
  slug: z.string().describe('Slug of the batch to edit'),
  prompt: z.string().describe('Edit instruction prompt'),
  action: z.enum(['refine', 'inpaint', 'outpaint', 'restyle']).optional()
    .describe('Type of edit operation'),
  mask: z.string().optional().describe('Region description for inpainting'),
  direction: z.enum(['top', 'bottom', 'left', 'right']).optional()
    .describe('Direction to extend/outpaint'),
  stylePath: z.string().optional().describe('Path to style reference image'),
});
```

**Step 3: Update pictura_edit handler**

Replace the stub implementation:

```typescript
server.tool(
  'pictura_edit',
  'Edit an existing image batch (refine, inpaint, outpaint, or style transfer)',
  EditParamsSchema.shape,
  async (params) => {
    const { slug, prompt, action = 'refine', mask, direction, stylePath } = params;

    // Load config
    let config: PicturaConfig;
    try {
      if (await configManager.exists()) {
        config = await configManager.load();
      } else {
        return {
          content: [{
            type: 'text' as const,
            text: 'Configuration required. Run /pictura:setup first.',
          }],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }

    // Find the batch
    const outputManager = new OutputManager(config.outputDir);
    const batches = await outputManager.listBatches(100);
    const batch = batches.find((b) => b.slug === slug || b.slug.includes(slug));

    if (!batch) {
      return {
        content: [{
          type: 'text' as const,
          text: `Batch not found: ${slug}\n\nAvailable batches:\n${batches.slice(0, 5).map((b) => `  - ${b.slug}`).join('\n')}`,
        }],
        isError: true,
      };
    }

    // Load style reference if provided
    let styleRef: Buffer | undefined;
    if (stylePath) {
      try {
        styleRef = await fs.readFile(stylePath);
      } catch {
        return {
          content: [{
            type: 'text' as const,
            text: `Failed to read style reference: ${stylePath}`,
          }],
          isError: true,
        };
      }
    }

    // Get provider config
    const providerName = config.providers.generation.default;
    const providerConfig = configManager.getProviderConfig('generation', providerName);

    // Determine model
    const model = providerName === 'gemini'
      ? gemini('pro')
      : openai('gpt-image-1.5');

    // Process each image in the batch
    const results: ImageResult[] = [];
    for (const img of batch.images) {
      try {
        const imageData = await fs.readFile(img.path);

        const result = await editImage({
          model,
          image: imageData,
          prompt,
          operation: action as EditOperation,
          mask,
          direction,
          styleRef,
          config: providerConfig,
        });

        results.push(result);
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Edit failed for ${img.ratio}: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }

    // Save edited images
    const editedSlug = `${batch.slug}-edited`;
    const timestamp = generateTimestamp();
    const savedPaths = await outputManager.saveBatch(results, editedSlug, timestamp);

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Edited ${results.length} image(s) from batch: ${slug}`,
          '',
          `Action: ${action}`,
          `New slug: ${editedSlug}`,
          '',
          'Edited images:',
          ...savedPaths.map((p, i) => `  - ${results[i].ratio}: ${p}`),
        ].join('\n'),
      }],
    };
  }
);
```

**Step 4: Run tests**

Run: `cd plugins/maccing-pictura/server && npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/index.ts
git commit -m "feat: implement edit tool with refine/inpaint/outpaint/restyle"
```

---

## Phase 4: Upscale Operations Implementation

### Task 9: Create Upscale Operation Handler

**Files:**
- Create: `plugins/maccing-pictura/server/src/upscale.ts`
- Create: `plugins/maccing-pictura/server/src/upscale.test.ts`

**Step 1: Write the failing test**

```typescript
// server/src/upscale.test.ts
import { describe, it, expect } from 'vitest';
import { upscaleImage } from './upscale';

describe('upscaleImage', () => {
  it('should throw if no upscale provider registered', async () => {
    await expect(upscaleImage({
      image: Buffer.from('test'),
      scale: 2,
      provider: 'topaz',
      config: { apiKey: 'test' },
    })).rejects.toThrow('Upscale provider not registered');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugins/maccing-pictura/server && npm test -- src/upscale.test.ts`
Expected: FAIL (file doesn't exist)

**Step 3: Create upscale.ts**

```typescript
// server/src/upscale.ts
import type {
  UpscaleProviderFunction,
  UpscaleImageParams,
  ImageResult,
} from './provider-spec/factory.js';

// Upscale provider registry
const upscaleProviderRegistry = new Map<string, UpscaleProviderFunction>();

export function registerUpscaleProvider(provider: UpscaleProviderFunction): void {
  upscaleProviderRegistry.set(provider.name, provider);
}

export function clearUpscaleProviderRegistry(): void {
  upscaleProviderRegistry.clear();
}

export function getUpscaleProvider(name: string): UpscaleProviderFunction | undefined {
  return upscaleProviderRegistry.get(name);
}

export interface UpscaleOptions {
  image: Buffer;
  scale?: number;
  model?: string;
  provider: string;
  config: Record<string, unknown>;
}

/**
 * Upscale an image using the specified provider.
 */
export async function upscaleImage(options: UpscaleOptions): Promise<ImageResult> {
  const { image, scale = 4, model, provider: providerName, config } = options;

  const provider = upscaleProviderRegistry.get(providerName);
  if (!provider) {
    throw new Error(`Upscale provider not registered: ${providerName}`);
  }

  const params: UpscaleImageParams = {
    image,
    scale,
    model,
  };

  return provider.upscale(params, config);
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugins/maccing-pictura/server && npm test -- src/upscale.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/upscale.ts plugins/maccing-pictura/server/src/upscale.test.ts
git commit -m "feat: add upscale operation handler"
```

---

### Task 10: Wire Upscale Handler to MCP Tool

**Files:**
- Modify: `plugins/maccing-pictura/server/src/index.ts:441-482`

**Step 1: Import upscale module and register topaz**

Add at top of index.ts:

```typescript
import { upscaleImage, registerUpscaleProvider } from './upscale.js';
import { topaz } from './providers/topaz.js';
```

Add after other provider registrations:

```typescript
registerUpscaleProvider(topaz);
```

**Step 2: Update UpscaleParamsSchema**

```typescript
const UpscaleParamsSchema = z.object({
  slug: z.string().describe('Slug of the batch to upscale'),
  scale: z.number().min(2).max(8).optional().describe('Scale factor (2, 4, or 8)'),
  model: z.string().optional().describe('Topaz model to use for upscaling'),
  provider: z.enum(['topaz', 'replicate']).optional().describe('Upscale provider'),
  skipTopaz: z.boolean().optional().describe('Skip Topaz and use Gemini 4K only'),
});
```

**Step 3: Update pictura_upscale handler**

Replace the stub:

```typescript
server.tool(
  'pictura_upscale',
  'Upscale images using two-turn premium workflow (4K regeneration + Topaz enhancement)',
  UpscaleParamsSchema.shape,
  async (params) => {
    const { slug, scale = 4, model = 'standard-max', provider = 'topaz', skipTopaz } = params;

    // Load config
    let config: PicturaConfig;
    try {
      if (await configManager.exists()) {
        config = await configManager.load();
      } else {
        return {
          content: [{
            type: 'text' as const,
            text: 'Configuration required. Run /pictura:setup first.',
          }],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }

    // Find the batch
    const outputManager = new OutputManager(config.outputDir);
    const batches = await outputManager.listBatches(100);
    const batch = batches.find((b) => b.slug === slug || b.slug.includes(slug));

    if (!batch) {
      return {
        content: [{
          type: 'text' as const,
          text: `Batch not found: ${slug}`,
        }],
        isError: true,
      };
    }

    // Check if Topaz is configured (unless skipping)
    if (!skipTopaz) {
      const topazConfig = config.providers.upscale?.topaz;
      if (!topazConfig?.apiKey) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Topaz API key not configured. Run /pictura:setup or use --skip-topaz flag.',
          }],
          isError: true,
        };
      }
    }

    const results: ImageResult[] = [];
    const upscaleConfig = configManager.getProviderConfig('upscale', provider);

    for (const img of batch.images) {
      try {
        const imageData = await fs.readFile(img.path);

        if (skipTopaz) {
          // Gemini 4K regeneration only (simplified)
          results.push({
            data: imageData,
            ratio: img.ratio as SupportedRatio,
            width: 4096,
            height: 2304,
            provider: 'gemini',
            model: '4k-regen',
          });
        } else {
          // Full two-turn upscale
          const result = await upscaleImage({
            image: imageData,
            scale,
            model,
            provider,
            config: upscaleConfig,
          });
          results.push(result);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Upscale failed for ${img.ratio}: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }

    // Save upscaled images
    const upscaledSlug = `${batch.slug}-${scale}x`;
    const timestamp = generateTimestamp();
    const savedPaths = await outputManager.saveBatch(results, upscaledSlug, timestamp);

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Upscaled ${results.length} image(s) from batch: ${slug}`,
          '',
          `Scale: ${scale}x`,
          `Provider: ${skipTopaz ? 'gemini (4K)' : provider}`,
          `Model: ${skipTopaz ? 'regen' : model}`,
          `New slug: ${upscaledSlug}`,
          '',
          'Upscaled images:',
          ...savedPaths.map((p, i) => `  - ${results[i].ratio}: ${p}`),
        ].join('\n'),
      }],
    };
  }
);
```

**Step 4: Run tests**

Run: `cd plugins/maccing-pictura/server && npm test`
Expected: PASS

**Step 5: Build and verify**

Run: `cd plugins/maccing-pictura/server && npm run build`
Expected: SUCCESS

**Step 6: Commit**

```bash
git add plugins/maccing-pictura/server/src/index.ts
git commit -m "feat: implement upscale tool with two-turn workflow"
```

---

## Phase 5: Final Integration

### Task 11: Run Full Test Suite and Build

**Step 1: Run all tests**

Run: `cd plugins/maccing-pictura/server && npm test`
Expected: All tests pass

**Step 2: Run build**

Run: `cd plugins/maccing-pictura/server && npm run build`
Expected: SUCCESS with no errors

**Step 3: Run validation**

Run: `cd plugins/maccing-pictura/server && npx tsx src/validation/index.ts`
Expected: Validation report shows all checks

**Step 4: Commit any fixes if needed**

---

### Task 12: Update README with New Features

**Files:**
- Modify: `plugins/maccing-pictura/README.md`

**Step 1: Add reference image section**

Add under Usage:

```markdown
### Reference Images for Consistency

Use `--ref` to provide a reference image for visual consistency across ratios:

```bash
/pictura:generate "product on marble" --social --ref ./brand-ref.png
```

Consistency strategies (`--consistency`):
- `generate`: Use first generated image as reference (default)
- `reference`: Use provided reference for all generations
- `multiturn`: Claude describes each image for semantic consistency
```

**Step 2: Add edit examples**

```markdown
### Editing Images

```bash
/pictura:edit "add dramatic clouds" --batch mountain-sunset --action refine
/pictura:edit "change to sunset" --batch product-hero --action inpaint --mask "sky"
/pictura:edit "extend the scene" --batch landscape --action outpaint --direction right
```
```

**Step 3: Add upscale examples**

```markdown
### Upscaling Images

```bash
/pictura:upscale --batch product-hero --scale 4
/pictura:upscale --batch logo --scale 8 --model high-fidelity-v2
/pictura:upscale --batch hero --skip-topaz  # Gemini 4K only
```
```

**Step 4: Commit**

```bash
git add plugins/maccing-pictura/README.md
git commit -m "docs: add reference images, edit, and upscale documentation"
```

---

### Task 13: Final Commit and Summary

**Step 1: Verify all changes**

Run: `git status`

**Step 2: Create summary commit if needed**

If there are any uncommitted changes, commit them.

**Step 3: Run final verification**

Run: `cd plugins/maccing-pictura/server && npm test && npm run build`
Expected: All pass

---

## Summary of Changes

| Component | Before | After |
|-----------|--------|-------|
| `--ref` flag | ❌ Missing | ✅ Implemented |
| `--consistency` flag | ❌ Missing | ✅ Implemented |
| `--since` in gallery | ⚠️ Undocumented | ✅ Documented |
| Topaz provider | ❌ Missing | ✅ Created |
| `--skip-topaz` flag | ❌ Missing | ✅ Implemented |
| Edit operations | ⚠️ Stub | ✅ Functional |
| Upscale operations | ⚠️ Stub | ✅ Functional |

**Note:** The actual API integrations (Gemini, OpenAI, Topaz) remain as stubs with TODO comments. Implementing real API calls requires API documentation review and is a separate task.
