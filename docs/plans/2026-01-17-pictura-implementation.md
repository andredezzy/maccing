# maccing-pictura Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a provider-agnostic multi-ratio image generation plugin with MCP server, automatic prompt enhancement, and two-turn premium upscaling.

**Architecture:** TypeScript MCP server using Vercel AI SDK-style provider specification pattern. Unified API with pluggable providers for generation (Gemini, OpenAI) and upscaling (Topaz, Replicate). Supports fallback chains and type-safe model selection.

**Tech Stack:** TypeScript, Node.js, @modelcontextprotocol/sdk, Zod, vitest

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Unified API Layer                         │
│  generateImage({ model: gemini('pro'), prompt, options })   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                  Provider Specification                      │
│  createImageProvider({ name, models, generateImage })       │
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────┴───────┐ ┌───────┴───────┐ ┌───────┴───────┐
│    Gemini     │ │    OpenAI     │ │    Topaz      │
│   Provider    │ │   Provider    │ │   Provider    │
└───────────────┘ └───────────────┘ └───────────────┘
```

---

## Phase 1: Project Scaffolding

### Task 1: Create Plugin Directory Structure

**Files:**
- Create: `plugins/maccing-pictura/.claude-plugin/plugin.json`
- Create: `plugins/maccing-pictura/.mcp.json`
- Create: `plugins/maccing-pictura/README.md`

**Step 1: Create plugin manifest**

```bash
mkdir -p plugins/maccing-pictura/.claude-plugin
```

Create `plugins/maccing-pictura/.claude-plugin/plugin.json`:

```json
{
  "name": "maccing-pictura",
  "version": "1.0.0",
  "description": "Provider-agnostic multi-ratio image generation with automatic prompt enhancement and premium upscaling",
  "author": {
    "name": "Andre Dezzy",
    "email": "andredezzy@users.noreply.github.com",
    "url": "https://github.com/andredezzy"
  },
  "homepage": "https://github.com/andredezzy/maccing",
  "repository": "https://github.com/andredezzy/maccing",
  "license": "MIT",
  "keywords": ["image-generation", "gemini", "openai", "topaz", "aspect-ratio", "consistency"],
  "skills": "./skills/",
  "commands": ["./commands/"]
}
```

**Step 2: Create MCP server config**

Create `plugins/maccing-pictura/.mcp.json`:

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

**Step 3: Create placeholder README**

Create `plugins/maccing-pictura/README.md`:

```markdown
# maccing-pictura

Provider-agnostic multi-ratio image generation plugin for Claude Code.

## Features

- Generate images in multiple aspect ratios with consistency
- Automatic prompt enhancement
- Two-turn premium upscaling (Gemini + Topaz Labs)
- Full editing suite: refine, inpaint, outpaint, restyle
- Unified API with provider fallback chains

## Installation

\`\`\`bash
claude plugin install maccing-pictura@maccing
\`\`\`

## Commands

- \`/pictura:generate\`: Create images
- \`/pictura:edit\`: Modify existing batch
- \`/pictura:upscale\`: Premium two-turn upscale
- \`/pictura:list\`: Show recent generations
- \`/pictura:gallery\`: Visual browser

## Configuration

Config file: \`.claude/plugins/maccing/pictura/config.json\`

See [design document](../../docs/plans/2026-01-17-pictura-design.md) for full details.
```

**Step 4: Commit**

```bash
git add plugins/maccing-pictura/
git commit -m "feat(pictura): scaffold plugin directory structure"
```

---

### Task 2: Initialize MCP Server Package

**Files:**
- Create: `plugins/maccing-pictura/server/package.json`
- Create: `plugins/maccing-pictura/server/tsconfig.json`
- Create: `plugins/maccing-pictura/server/.gitignore`

**Step 1: Create server directory**

```bash
mkdir -p plugins/maccing-pictura/server/src
```

**Step 2: Create package.json**

Create `plugins/maccing-pictura/server/package.json`:

```json
{
  "name": "pictura-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for maccing-pictura image generation plugin",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0",
    "@google/generative-ai": "^0.21.0",
    "openai": "^4.70.0",
    "open": "^10.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Step 3: Create tsconfig.json**

Create `plugins/maccing-pictura/server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 4: Create .gitignore**

Create `plugins/maccing-pictura/server/.gitignore`:

```
node_modules/
dist/
coverage/
*.log
.env
```

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/
git commit -m "feat(pictura): initialize MCP server package"
```

---

### Task 3: Install Dependencies

**Step 1: Install npm packages**

```bash
cd plugins/maccing-pictura/server && npm install
```

Expected: `added X packages` message

**Step 2: Verify TypeScript compiles**

```bash
cd plugins/maccing-pictura/server && npx tsc --version
```

Expected: `Version 5.x.x`

**Step 3: Commit lockfile**

```bash
git add plugins/maccing-pictura/server/package-lock.json
git commit -m "chore(pictura): add package-lock.json"
```

---

## Phase 2: Provider Specification Core

### Task 4: Define Core Types

**Files:**
- Create: `plugins/maccing-pictura/server/src/types/image.ts`
- Test: `plugins/maccing-pictura/server/src/types/image.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/types/image.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  ImageResultSchema,
  SUPPORTED_RATIOS,
  getDimensionsForRatio,
  type ImageResult
} from './image.js';

describe('Image types', () => {
  it('should validate a valid image result', () => {
    const image: ImageResult = {
      data: Buffer.from('test'),
      ratio: '16:9',
      width: 2048,
      height: 1152,
      provider: 'gemini',
      model: 'gemini-3-pro-image',
    };

    const result = ImageResultSchema.safeParse(image);
    expect(result.success).toBe(true);
  });

  it('should have all supported ratios', () => {
    expect(SUPPORTED_RATIOS).toContain('16:9');
    expect(SUPPORTED_RATIOS).toContain('1:1');
    expect(SUPPORTED_RATIOS).toContain('9:16');
    expect(SUPPORTED_RATIOS.length).toBe(10);
  });

  it('should calculate dimensions for ratio and size', () => {
    const dims2K = getDimensionsForRatio('16:9', '2K');
    expect(dims2K.width).toBe(2048);
    expect(dims2K.height).toBe(1152);

    const dims4K = getDimensionsForRatio('16:9', '4K');
    expect(dims4K.width).toBe(4096);
    expect(dims4K.height).toBe(2304);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/types/image.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/types/image.ts`:

```typescript
import { z } from 'zod';

export const SUPPORTED_RATIOS = [
  '1:1', '2:3', '3:2', '3:4', '4:3',
  '4:5', '5:4', '9:16', '16:9', '21:9',
] as const;

export type SupportedRatio = typeof SUPPORTED_RATIOS[number];

export const RatioSchema = z.enum(SUPPORTED_RATIOS);

export const ImageResultSchema = z.object({
  data: z.instanceof(Buffer),
  path: z.string().optional(),
  ratio: RatioSchema,
  width: z.number().positive(),
  height: z.number().positive(),
  provider: z.string(),
  model: z.string(),
  timestamp: z.date().optional(),
});

export type ImageResult = z.infer<typeof ImageResultSchema>;

export type ImageSize = '1K' | '2K' | '4K';

const BASE_DIMENSIONS: Record<SupportedRatio, { width: number; height: number }> = {
  '1:1': { width: 2048, height: 2048 },
  '2:3': { width: 1365, height: 2048 },
  '3:2': { width: 2048, height: 1365 },
  '3:4': { width: 1536, height: 2048 },
  '4:3': { width: 2048, height: 1536 },
  '4:5': { width: 1638, height: 2048 },
  '5:4': { width: 2048, height: 1638 },
  '9:16': { width: 1152, height: 2048 },
  '16:9': { width: 2048, height: 1152 },
  '21:9': { width: 2048, height: 878 },
};

const SIZE_MULTIPLIERS: Record<ImageSize, number> = {
  '1K': 0.5,
  '2K': 1,
  '4K': 2,
};

export function getDimensionsForRatio(
  ratio: SupportedRatio,
  size: ImageSize = '2K'
): { width: number; height: number } {
  const base = BASE_DIMENSIONS[ratio];
  const multiplier = SIZE_MULTIPLIERS[size];
  return {
    width: Math.round(base.width * multiplier),
    height: Math.round(base.height * multiplier),
  };
}
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/types/image.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/types/
git commit -m "feat(pictura): add image types and ratio definitions"
```

---

### Task 5: Define Provider Specification Interface

**Files:**
- Create: `plugins/maccing-pictura/server/src/provider-spec/types.ts`
- Test: `plugins/maccing-pictura/server/src/provider-spec/types.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/provider-spec/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  GenerateImageParamsSchema,
  ImageModelCapabilitiesSchema,
  type ImageModel,
  type ImageProviderSpec,
} from './types.js';

describe('Provider specification types', () => {
  it('should validate generate image params', () => {
    const params = {
      prompt: 'cat on roof',
      ratio: '16:9' as const,
      size: '2K' as const,
    };

    const result = GenerateImageParamsSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should validate capabilities', () => {
    const caps = {
      maxResolution: '4K' as const,
      supportedRatios: ['16:9', '1:1'] as const,
      supportsReference: true,
      supportsEdit: true,
      supportsInpaint: true,
      supportsOutpaint: false,
    };

    const result = ImageModelCapabilitiesSchema.safeParse(caps);
    expect(result.success).toBe(true);
  });

  it('should type-check ImageModel interface', () => {
    const model: ImageModel = {
      provider: 'gemini',
      modelId: 'gemini-3-pro-image',
      capabilities: {
        maxResolution: '4K',
        supportedRatios: ['16:9', '1:1'],
        supportsReference: true,
        supportsEdit: true,
        supportsInpaint: true,
        supportsOutpaint: true,
      },
    };

    expect(model.provider).toBe('gemini');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/provider-spec/types.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/provider-spec/types.ts`:

```typescript
import { z } from 'zod';
import type { ImageResult, SupportedRatio, ImageSize } from '../types/image.js';
import { RatioSchema } from '../types/image.js';

// Generation parameters
export const GenerateImageParamsSchema = z.object({
  prompt: z.string(),
  ratio: RatioSchema,
  size: z.enum(['1K', '2K', '4K']).default('2K'),
  reference: z.instanceof(Buffer).optional(),
  negativePrompt: z.string().optional(),
});

export type GenerateImageParams = z.infer<typeof GenerateImageParamsSchema>;

// Edit parameters
export const EditImageParamsSchema = z.object({
  image: z.instanceof(Buffer),
  prompt: z.string(),
  mask: z.string().optional(),
  extend: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  style: z.instanceof(Buffer).optional(),
});

export type EditImageParams = z.infer<typeof EditImageParamsSchema>;

// Upscale parameters
export const UpscaleImageParamsSchema = z.object({
  image: z.instanceof(Buffer),
  scale: z.number().min(1).max(8).default(4),
  model: z.string().optional(),
});

export type UpscaleImageParams = z.infer<typeof UpscaleImageParamsSchema>;

// Model capabilities
export const ImageModelCapabilitiesSchema = z.object({
  maxResolution: z.enum(['1K', '2K', '4K']),
  supportedRatios: z.array(RatioSchema),
  supportsReference: z.boolean(),
  supportsEdit: z.boolean(),
  supportsInpaint: z.boolean(),
  supportsOutpaint: z.boolean(),
});

export type ImageModelCapabilities = z.infer<typeof ImageModelCapabilitiesSchema>;

// Image model interface (what providers return)
export interface ImageModel {
  provider: string;
  modelId: string;
  capabilities: ImageModelCapabilities;
}

// Provider specification (what providers implement)
export interface ImageProviderSpec {
  name: string;
  models: Record<string, {
    id: string;
    capabilities: ImageModelCapabilities;
  }>;

  generateImage(
    modelId: string,
    params: GenerateImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult>;

  editImage?(
    modelId: string,
    params: EditImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult>;
}

// Upscale provider specification
export interface UpscaleProviderSpec {
  name: string;
  models: string[];
  maxScale: number;

  upscale(
    params: UpscaleImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult>;
}

// Model selector type (what users pass to generateImage)
export type ModelSelector<T extends string = string> = {
  provider: string;
  modelId: T;
  capabilities: ImageModelCapabilities;
};

// Fallback chain type
export type ModelWithFallbacks = ModelSelector | ModelSelector[];
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/provider-spec/types.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/provider-spec/
git commit -m "feat(pictura): add provider specification types (AI SDK pattern)"
```

---

### Task 6: Implement Provider Factory

**Files:**
- Create: `plugins/maccing-pictura/server/src/provider-spec/factory.ts`
- Test: `plugins/maccing-pictura/server/src/provider-spec/factory.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/provider-spec/factory.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createImageProvider, createUpscaleProvider } from './factory.js';
import type { ImageProviderSpec, UpscaleProviderSpec } from './types.js';

describe('createImageProvider', () => {
  it('should create a provider with model selector function', () => {
    const mockSpec: ImageProviderSpec = {
      name: 'test-provider',
      models: {
        'model-a': {
          id: 'model-a-full-id',
          capabilities: {
            maxResolution: '4K',
            supportedRatios: ['16:9', '1:1'],
            supportsReference: true,
            supportsEdit: true,
            supportsInpaint: false,
            supportsOutpaint: false,
          },
        },
      },
      generateImage: vi.fn(),
    };

    const provider = createImageProvider(mockSpec);

    expect(provider.name).toBe('test-provider');
    expect(typeof provider).toBe('function');

    const model = provider('model-a');
    expect(model.provider).toBe('test-provider');
    expect(model.modelId).toBe('model-a');
    expect(model.capabilities.maxResolution).toBe('4K');
  });

  it('should throw for unknown model', () => {
    const mockSpec: ImageProviderSpec = {
      name: 'test-provider',
      models: {},
      generateImage: vi.fn(),
    };

    const provider = createImageProvider(mockSpec);

    expect(() => provider('unknown-model')).toThrow('Unknown model');
  });
});

describe('createUpscaleProvider', () => {
  it('should create an upscale provider', () => {
    const mockSpec: UpscaleProviderSpec = {
      name: 'test-upscaler',
      models: ['model-x', 'model-y'],
      maxScale: 8,
      upscale: vi.fn(),
    };

    const provider = createUpscaleProvider(mockSpec);

    expect(provider.name).toBe('test-upscaler');
    expect(provider.models).toContain('model-x');
    expect(provider.maxScale).toBe(8);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/provider-spec/factory.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/provider-spec/factory.ts`:

```typescript
import type {
  ImageProviderSpec,
  UpscaleProviderSpec,
  ModelSelector,
  GenerateImageParams,
  EditImageParams,
  UpscaleImageParams,
} from './types.js';
import type { ImageResult } from '../types/image.js';

// Type for the provider function that selects models
export interface ImageProviderFunction<TModels extends string = string> {
  (modelId: TModels): ModelSelector<TModels>;
  name: string;
  spec: ImageProviderSpec;
  generateImage(
    modelId: TModels,
    params: GenerateImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult>;
  editImage?(
    modelId: TModels,
    params: EditImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult>;
}

export function createImageProvider<TModels extends string>(
  spec: ImageProviderSpec
): ImageProviderFunction<TModels> {
  const providerFn = ((modelId: TModels): ModelSelector<TModels> => {
    const modelDef = spec.models[modelId];
    if (!modelDef) {
      throw new Error(`Unknown model: ${modelId} for provider ${spec.name}`);
    }

    return {
      provider: spec.name,
      modelId,
      capabilities: modelDef.capabilities,
    };
  }) as ImageProviderFunction<TModels>;

  providerFn.name = spec.name;
  providerFn.spec = spec;

  providerFn.generateImage = (
    modelId: TModels,
    params: GenerateImageParams,
    config: Record<string, unknown>
  ) => spec.generateImage(modelId, params, config);

  if (spec.editImage) {
    providerFn.editImage = (
      modelId: TModels,
      params: EditImageParams,
      config: Record<string, unknown>
    ) => spec.editImage!(modelId, params, config);
  }

  return providerFn;
}

export interface UpscaleProviderFunction {
  name: string;
  models: string[];
  maxScale: number;
  spec: UpscaleProviderSpec;
  upscale(
    params: UpscaleImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult>;
}

export function createUpscaleProvider(
  spec: UpscaleProviderSpec
): UpscaleProviderFunction {
  return {
    name: spec.name,
    models: spec.models,
    maxScale: spec.maxScale,
    spec,
    upscale: (params, config) => spec.upscale(params, config),
  };
}
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/provider-spec/factory.test.ts
```

Expected: PASS

**Step 5: Create provider-spec index**

Create `plugins/maccing-pictura/server/src/provider-spec/index.ts`:

```typescript
export * from './types.js';
export * from './factory.js';
```

**Step 6: Commit**

```bash
git add plugins/maccing-pictura/server/src/provider-spec/
git commit -m "feat(pictura): add provider factory (AI SDK pattern)"
```

---

### Task 7: Implement Unified Generate Function

**Files:**
- Create: `plugins/maccing-pictura/server/src/generate.ts`
- Test: `plugins/maccing-pictura/server/src/generate.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/generate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateImage, type GenerateImageOptions } from './generate.js';
import { createImageProvider } from './provider-spec/index.js';
import type { ImageProviderSpec } from './provider-spec/index.js';

describe('generateImage', () => {
  const mockGenerateImage = vi.fn();

  const mockSpec: ImageProviderSpec = {
    name: 'mock-provider',
    models: {
      'mock-model': {
        id: 'mock-model-full',
        capabilities: {
          maxResolution: '4K',
          supportedRatios: ['16:9', '1:1', '9:16'],
          supportsReference: true,
          supportsEdit: true,
          supportsInpaint: false,
          supportsOutpaint: false,
        },
      },
    },
    generateImage: mockGenerateImage,
  };

  const mockProvider = createImageProvider(mockSpec);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateImage.mockResolvedValue({
      data: Buffer.from('mock-image'),
      ratio: '16:9',
      width: 2048,
      height: 1152,
      provider: 'mock-provider',
      model: 'mock-model',
    });
  });

  it('should generate image with single model', async () => {
    const result = await generateImage({
      model: mockProvider('mock-model'),
      prompt: 'test prompt',
      ratio: '16:9',
      config: { apiKey: 'test' },
    });

    expect(result.provider).toBe('mock-provider');
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
  });

  it('should try fallback on failure', async () => {
    mockGenerateImage
      .mockRejectedValueOnce(new Error('First provider failed'))
      .mockResolvedValueOnce({
        data: Buffer.from('fallback-image'),
        ratio: '16:9',
        width: 2048,
        height: 1152,
        provider: 'mock-provider',
        model: 'mock-model',
      });

    const result = await generateImage({
      model: [mockProvider('mock-model'), mockProvider('mock-model')],
      prompt: 'test prompt',
      ratio: '16:9',
      config: { apiKey: 'test' },
    });

    expect(result.data.toString()).toBe('fallback-image');
    expect(mockGenerateImage).toHaveBeenCalledTimes(2);
  });

  it('should throw when all fallbacks fail', async () => {
    mockGenerateImage.mockRejectedValue(new Error('All failed'));

    await expect(
      generateImage({
        model: [mockProvider('mock-model'), mockProvider('mock-model')],
        prompt: 'test prompt',
        ratio: '16:9',
        config: { apiKey: 'test' },
      })
    ).rejects.toThrow('All providers failed');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/generate.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/generate.ts`:

```typescript
import type {
  ModelSelector,
  ModelWithFallbacks,
  GenerateImageParams,
} from './provider-spec/types.js';
import type { ImageProviderFunction } from './provider-spec/factory.js';
import type { ImageResult, SupportedRatio, ImageSize } from './types/image.js';

export interface GenerateImageOptions {
  model: ModelWithFallbacks;
  prompt: string;
  ratio: SupportedRatio;
  size?: ImageSize;
  reference?: Buffer;
  negativePrompt?: string;
  config: Record<string, unknown>;
}

// Registry to lookup provider implementations by name
const providerRegistry = new Map<string, ImageProviderFunction>();

export function registerProvider(provider: ImageProviderFunction): void {
  providerRegistry.set(provider.name, provider);
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<ImageResult> {
  const { model, prompt, ratio, size = '2K', reference, negativePrompt, config } = options;

  const models = Array.isArray(model) ? model : [model];
  const errors: Error[] = [];

  for (const modelSelector of models) {
    try {
      const provider = providerRegistry.get(modelSelector.provider);

      if (!provider) {
        throw new Error(`Provider not registered: ${modelSelector.provider}`);
      }

      const params: GenerateImageParams = {
        prompt,
        ratio,
        size,
        reference,
        negativePrompt,
      };

      const result = await provider.generateImage(
        modelSelector.modelId,
        params,
        config
      );

      return result;
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      continue;
    }
  }

  throw new Error(
    `All providers failed: ${errors.map((e) => e.message).join(', ')}`
  );
}

export async function generateImages(
  options: Omit<GenerateImageOptions, 'ratio'> & { ratios: SupportedRatio[] }
): Promise<ImageResult[]> {
  const results: ImageResult[] = [];
  let referenceImage: Buffer | undefined = options.reference;

  for (const ratio of options.ratios) {
    const result = await generateImage({
      ...options,
      ratio,
      reference: referenceImage,
    });

    results.push(result);

    // Use first generated image as reference for consistency
    if (!referenceImage && results.length === 1) {
      referenceImage = result.data;
    }
  }

  return results;
}
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/generate.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/generate.ts plugins/maccing-pictura/server/src/generate.test.ts
git commit -m "feat(pictura): add unified generateImage with fallback chains"
```

---

## Phase 3: Provider Implementations

### Task 8: Implement Gemini Provider

**Files:**
- Create: `plugins/maccing-pictura/server/src/providers/gemini.ts`
- Test: `plugins/maccing-pictura/server/src/providers/gemini.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/providers/gemini.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { gemini, GEMINI_MODELS } from './gemini.js';

describe('Gemini provider', () => {
  it('should have correct provider name', () => {
    expect(gemini.name).toBe('gemini');
  });

  it('should expose flash and pro models', () => {
    expect(GEMINI_MODELS).toContain('flash');
    expect(GEMINI_MODELS).toContain('pro');
  });

  it('should create model selector for flash', () => {
    const model = gemini('flash');
    expect(model.provider).toBe('gemini');
    expect(model.modelId).toBe('flash');
    expect(model.capabilities.maxResolution).toBe('1K');
  });

  it('should create model selector for pro', () => {
    const model = gemini('pro');
    expect(model.provider).toBe('gemini');
    expect(model.modelId).toBe('pro');
    expect(model.capabilities.maxResolution).toBe('4K');
  });

  it('should throw for unknown model', () => {
    expect(() => (gemini as any)('unknown')).toThrow('Unknown model');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/providers/gemini.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/providers/gemini.ts`:

```typescript
import { createImageProvider } from '../provider-spec/index.js';
import type { ImageProviderSpec, GenerateImageParams, EditImageParams } from '../provider-spec/index.js';
import type { ImageResult } from '../types/image.js';
import { getDimensionsForRatio, SUPPORTED_RATIOS } from '../types/image.js';

export const GEMINI_MODELS = ['flash', 'pro'] as const;
export type GeminiModel = typeof GEMINI_MODELS[number];

const MODEL_IDS: Record<GeminiModel, string> = {
  flash: 'gemini-2.5-flash-image',
  pro: 'gemini-3-pro-image-preview',
};

const geminiSpec: ImageProviderSpec = {
  name: 'gemini',
  models: {
    flash: {
      id: MODEL_IDS.flash,
      capabilities: {
        maxResolution: '1K',
        supportedRatios: [...SUPPORTED_RATIOS],
        supportsReference: true,
        supportsEdit: true,
        supportsInpaint: true,
        supportsOutpaint: true,
      },
    },
    pro: {
      id: MODEL_IDS.pro,
      capabilities: {
        maxResolution: '4K',
        supportedRatios: [...SUPPORTED_RATIOS],
        supportsReference: true,
        supportsEdit: true,
        supportsInpaint: true,
        supportsOutpaint: true,
      },
    },
  },

  async generateImage(
    modelId: string,
    params: GenerateImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult> {
    const apiKey = config.apiKey as string;
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    const fullModelId = MODEL_IDS[modelId as GeminiModel];
    const dimensions = getDimensionsForRatio(params.ratio, params.size);

    // TODO: Implement actual Gemini API call
    // const { GoogleGenerativeAI } = await import('@google/generative-ai');
    // const genAI = new GoogleGenerativeAI(apiKey);
    // const model = genAI.getGenerativeModel({ model: fullModelId });
    // const response = await model.generateContent({
    //   contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
    //   generationConfig: {
    //     responseModalities: ['image'],
    //     imageConfig: { aspectRatio: params.ratio, imageSize: params.size },
    //   },
    // });

    // Stub for development
    const stubData = Buffer.from(`gemini-${modelId}-${params.ratio}-${Date.now()}`);

    return {
      data: stubData,
      ratio: params.ratio,
      width: dimensions.width,
      height: dimensions.height,
      provider: 'gemini',
      model: fullModelId,
    };
  },

  async editImage(
    modelId: string,
    params: EditImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult> {
    const apiKey = config.apiKey as string;
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    // TODO: Implement actual Gemini edit API
    const stubData = Buffer.from(`gemini-edit-${modelId}-${Date.now()}`);

    return {
      data: stubData,
      ratio: '16:9', // Would come from original image
      width: 2048,
      height: 1152,
      provider: 'gemini',
      model: MODEL_IDS[modelId as GeminiModel],
    };
  },
};

export const gemini = createImageProvider<GeminiModel>(geminiSpec);
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/providers/gemini.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/providers/
git commit -m "feat(pictura): add Gemini provider (AI SDK pattern)"
```

---

### Task 9: Implement OpenAI Provider

**Files:**
- Create: `plugins/maccing-pictura/server/src/providers/openai.ts`
- Test: `plugins/maccing-pictura/server/src/providers/openai.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/providers/openai.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { openai, OPENAI_MODELS } from './openai.js';

describe('OpenAI provider', () => {
  it('should have correct provider name', () => {
    expect(openai.name).toBe('openai');
  });

  it('should expose dall-e-3 model', () => {
    expect(OPENAI_MODELS).toContain('dall-e-3');
  });

  it('should create model selector for dall-e-3', () => {
    const model = openai('dall-e-3');
    expect(model.provider).toBe('openai');
    expect(model.modelId).toBe('dall-e-3');
    expect(model.capabilities.maxResolution).toBe('1K');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/providers/openai.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/providers/openai.ts`:

```typescript
import { createImageProvider } from '../provider-spec/index.js';
import type { ImageProviderSpec, GenerateImageParams } from '../provider-spec/index.js';
import type { ImageResult, SupportedRatio } from '../types/image.js';
import { getDimensionsForRatio } from '../types/image.js';

export const OPENAI_MODELS = ['dall-e-3', 'dall-e-2'] as const;
export type OpenAIModel = typeof OPENAI_MODELS[number];

// OpenAI has limited aspect ratio support
const OPENAI_RATIOS: SupportedRatio[] = ['1:1', '16:9', '9:16'];

const openaiSpec: ImageProviderSpec = {
  name: 'openai',
  models: {
    'dall-e-3': {
      id: 'dall-e-3',
      capabilities: {
        maxResolution: '1K',
        supportedRatios: OPENAI_RATIOS,
        supportsReference: false,
        supportsEdit: true,
        supportsInpaint: true,
        supportsOutpaint: false,
      },
    },
    'dall-e-2': {
      id: 'dall-e-2',
      capabilities: {
        maxResolution: '1K',
        supportedRatios: ['1:1'],
        supportsReference: false,
        supportsEdit: true,
        supportsInpaint: true,
        supportsOutpaint: false,
      },
    },
  },

  async generateImage(
    modelId: string,
    params: GenerateImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult> {
    const apiKey = config.apiKey as string;
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const dimensions = getDimensionsForRatio(params.ratio, '1K');

    // TODO: Implement actual OpenAI API call
    // import OpenAI from 'openai';
    // const client = new OpenAI({ apiKey });
    // const response = await client.images.generate({
    //   model: modelId,
    //   prompt: params.prompt,
    //   size: `${dimensions.width}x${dimensions.height}`,
    //   response_format: 'b64_json',
    // });

    // Stub for development
    const stubData = Buffer.from(`openai-${modelId}-${params.ratio}-${Date.now()}`);

    return {
      data: stubData,
      ratio: params.ratio,
      width: dimensions.width,
      height: dimensions.height,
      provider: 'openai',
      model: modelId,
    };
  },
};

export const openai = createImageProvider<OpenAIModel>(openaiSpec);
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/providers/openai.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/providers/
git commit -m "feat(pictura): add OpenAI provider (AI SDK pattern)"
```

---

### Task 10: Implement Topaz Upscale Provider

**Files:**
- Create: `plugins/maccing-pictura/server/src/providers/topaz.ts`
- Test: `plugins/maccing-pictura/server/src/providers/topaz.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/providers/topaz.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { topaz, TOPAZ_MODELS } from './topaz.js';

describe('Topaz provider', () => {
  it('should have correct provider name', () => {
    expect(topaz.name).toBe('topaz');
  });

  it('should expose expected models', () => {
    expect(TOPAZ_MODELS).toContain('standard-max');
    expect(TOPAZ_MODELS).toContain('recovery-v2');
    expect(TOPAZ_MODELS).toContain('high-fidelity-v2');
  });

  it('should have correct max scale', () => {
    expect(topaz.maxScale).toBe(8);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/providers/topaz.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/providers/topaz.ts`:

```typescript
import { createUpscaleProvider } from '../provider-spec/index.js';
import type { UpscaleProviderSpec, UpscaleImageParams } from '../provider-spec/index.js';
import type { ImageResult } from '../types/image.js';

export const TOPAZ_MODELS = [
  'standard-v2',
  'standard-max',
  'recovery-v2',
  'high-fidelity-v2',
  'redefine',
] as const;

export type TopazModel = typeof TOPAZ_MODELS[number];

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

    const model = params.model || 'standard-max';
    const scale = params.scale || 4;

    // TODO: Implement actual Topaz API call
    // const response = await fetch('https://api.topazlabs.com/v1/enhance', {
    //   method: 'POST',
    //   headers: {
    //     'X-API-Key': apiKey,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     image: params.image.toString('base64'),
    //     model,
    //     scale,
    //   }),
    // });

    // Stub for development
    const stubData = Buffer.from(`topaz-${model}-${scale}x-${Date.now()}`);

    return {
      data: stubData,
      ratio: '16:9', // Would come from original image metadata
      width: 2048 * scale,
      height: 1152 * scale,
      provider: 'topaz',
      model,
    };
  },
};

export const topaz = createUpscaleProvider(topazSpec);
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/providers/topaz.test.ts
```

Expected: PASS

**Step 5: Create providers index**

Create `plugins/maccing-pictura/server/src/providers/index.ts`:

```typescript
export { gemini, GEMINI_MODELS, type GeminiModel } from './gemini.js';
export { openai, OPENAI_MODELS, type OpenAIModel } from './openai.js';
export { topaz, TOPAZ_MODELS, type TopazModel } from './topaz.js';
```

**Step 6: Commit**

```bash
git add plugins/maccing-pictura/server/src/providers/
git commit -m "feat(pictura): add Topaz upscale provider"
```

---

## Phase 4: Core Utilities

### Task 11: Implement Config Manager

**Files:**
- Create: `plugins/maccing-pictura/server/src/core/config.ts`
- Test: `plugins/maccing-pictura/server/src/core/config.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/core/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager, ConfigSchema } from './config.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ConfigManager', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pictura-test-'));
    configPath = path.join(tempDir, 'config.json');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should load config from file', async () => {
    const config = {
      providers: {
        generation: { default: 'gemini', gemini: { apiKey: 'test-key' } },
        upscale: { default: 'topaz', topaz: { apiKey: 'test-key' } },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    const manager = new ConfigManager(configPath);
    const loaded = await manager.load();

    expect(loaded.providers.generation.default).toBe('gemini');
    expect(loaded.defaultRatio).toBe('16:9'); // default applied
  });

  it('should return false for exists() when config missing', async () => {
    const manager = new ConfigManager(configPath);
    expect(await manager.exists()).toBe(false);
  });

  it('should save config with secure permissions', async () => {
    const manager = new ConfigManager(configPath);
    await manager.save({
      providers: {
        generation: { default: 'gemini', gemini: { apiKey: 'secret' } },
        upscale: { default: 'topaz', topaz: { apiKey: 'secret' } },
      },
    });

    const stats = await fs.stat(configPath);
    expect(stats.mode & 0o777).toBe(0o600);
  });
});

describe('ConfigSchema', () => {
  it('should apply defaults', () => {
    const result = ConfigSchema.parse({
      providers: {
        generation: { default: 'gemini' },
        upscale: { default: 'topaz' },
      },
    });

    expect(result.defaultRatio).toBe('16:9');
    expect(result.defaultQuality).toBe('pro');
    expect(result.imageSize).toBe('2K');
    expect(result.retryAttempts).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/core/config.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/core/config.ts`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { RatioSchema } from '../types/image.js';

const GeminiConfigSchema = z.object({
  apiKey: z.string(),
  defaultModel: z.enum(['flash', 'pro']).default('pro'),
});

const OpenAIConfigSchema = z.object({
  apiKey: z.string(),
});

const TopazConfigSchema = z.object({
  apiKey: z.string(),
  defaultModel: z.string().default('standard-max'),
});

const ReplicateConfigSchema = z.object({
  apiKey: z.string(),
});

export const ConfigSchema = z.object({
  providers: z.object({
    generation: z.object({
      default: z.enum(['gemini', 'openai']).default('gemini'),
      gemini: GeminiConfigSchema.optional(),
      openai: OpenAIConfigSchema.optional(),
    }),
    upscale: z.object({
      default: z.enum(['topaz', 'replicate']).default('topaz'),
      topaz: TopazConfigSchema.optional(),
      replicate: ReplicateConfigSchema.optional(),
    }),
  }),
  defaultRatio: RatioSchema.default('16:9'),
  defaultQuality: z.enum(['draft', 'pro']).default('pro'),
  imageSize: z.enum(['1K', '2K', '4K']).default('2K'),
  defaultConsistency: z.enum(['generate', 'reference', 'multiturn']).default('generate'),
  retryAttempts: z.number().min(1).max(10).default(3),
  outputDir: z.string().default('.claude/plugins/maccing/pictura/output'),
});

export type PicturaConfig = z.infer<typeof ConfigSchema>;

export const PRESET_BUNDLES = {
  social: ['1:1', '9:16', '16:9'] as const,
  web: ['16:9', '4:3', '1:1'] as const,
  portrait: ['2:3', '3:4', '4:5', '9:16'] as const,
  landscape: ['3:2', '4:3', '16:9', '21:9'] as const,
  print: ['2:3', '3:4', '4:5'] as const,
} as const;

export type PresetBundle = keyof typeof PRESET_BUNDLES;

export class ConfigManager {
  private configPath: string;
  private cachedConfig: PicturaConfig | null = null;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  async load(): Promise<PicturaConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    const content = await fs.readFile(this.configPath, 'utf-8');
    const parsed = JSON.parse(content);
    const validated = ConfigSchema.parse(parsed);
    this.cachedConfig = validated;
    return validated;
  }

  async save(config: Partial<PicturaConfig>): Promise<void> {
    const validated = ConfigSchema.parse(config);
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(validated, null, 2));
    await fs.chmod(this.configPath, 0o600);
    this.cachedConfig = validated;
  }

  clearCache(): void {
    this.cachedConfig = null;
  }

  getProviderConfig(type: 'generation' | 'upscale', name: string): Record<string, unknown> {
    if (!this.cachedConfig) {
      throw new Error('Config not loaded');
    }
    const providerConfig = this.cachedConfig.providers[type][name as keyof typeof this.cachedConfig.providers.generation];
    return providerConfig as Record<string, unknown> || {};
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/core/config.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/core/
git commit -m "feat(pictura): add config manager with provider configs"
```

---

### Task 12: Implement Retry Utility

**Files:**
- Create: `plugins/maccing-pictura/server/src/core/retry.ts`
- Test: `plugins/maccing-pictura/server/src/core/retry.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/core/retry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { withRetry, RetryError, isRetryableError } from './retry.js';

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw RetryError after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fail'));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })
    ).rejects.toThrow(RetryError);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('isRetryableError', () => {
  it('should return true for rate limit errors', () => {
    expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true);
    expect(isRetryableError(new Error('429 too many requests'))).toBe(true);
  });

  it('should return false for content policy errors', () => {
    expect(isRetryableError(new Error('content policy violation'))).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/core/retry.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/core/retry.ts`:

```typescript
export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

export class RetryError extends Error {
  public readonly attempts: number;
  public readonly lastError: Error;

  constructor(message: string, attempts: number, lastError: Error) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxAttempts,
    baseDelayMs = 2000,
    maxDelayMs = 30000,
    shouldRetry = isRetryableError,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        if (attempt === maxAttempts) {
          throw new RetryError(
            `Failed after ${maxAttempts} attempts: ${lastError.message}`,
            attempt,
            lastError
          );
        }
        throw lastError;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      onRetry?.(attempt, lastError);
      await sleep(delay);
    }
  }

  throw new RetryError(
    `Failed after ${maxAttempts} attempts`,
    maxAttempts,
    lastError!
  );
}

export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Non-retryable errors
  const nonRetryable = [
    'content policy',
    'invalid api key',
    'unauthorized',
    'forbidden',
    'not found',
  ];

  if (nonRetryable.some((pattern) => message.includes(pattern))) {
    return false;
  }

  // Retryable errors
  const retryable = [
    'rate limit',
    '429',
    'timeout',
    'econnreset',
    'enotfound',
    'network',
    'server error',
    '500',
    '502',
    '503',
    '504',
  ];

  return retryable.some((pattern) => message.includes(pattern));
}
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/core/retry.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/core/
git commit -m "feat(pictura): add retry utility with exponential backoff"
```

---

### Task 13: Implement Slug and Output Utilities

**Files:**
- Create: `plugins/maccing-pictura/server/src/utils/slug.ts`
- Create: `plugins/maccing-pictura/server/src/core/output.ts`
- Test: `plugins/maccing-pictura/server/src/utils/slug.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/utils/slug.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateSlug, generateTimestamp, ratioToFilename } from './slug.js';

describe('generateSlug', () => {
  it('should convert prompt to lowercase kebab-case', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('should remove special characters', () => {
    expect(generateSlug('Cat & Dog!')).toBe('cat-dog');
  });

  it('should truncate long prompts', () => {
    const longPrompt = 'a'.repeat(100);
    expect(generateSlug(longPrompt).length).toBeLessThanOrEqual(50);
  });

  it('should handle empty string', () => {
    expect(generateSlug('')).toBe('untitled');
  });
});

describe('generateTimestamp', () => {
  it('should return YYYY-MM-DD-HHmmss format', () => {
    const timestamp = generateTimestamp();
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}$/);
  });
});

describe('ratioToFilename', () => {
  it('should convert ratio to filename format', () => {
    expect(ratioToFilename('16:9')).toBe('16x9');
    expect(ratioToFilename('1:1')).toBe('1x1');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/utils/slug.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/utils/slug.ts`:

```typescript
export function generateSlug(prompt: string, maxLength = 50): string {
  if (!prompt || prompt.trim().length === 0) {
    return 'untitled';
  }

  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength)
    .replace(/-$/, '');

  return slug || 'untitled';
}

export function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

export function ratioToFilename(ratio: string): string {
  return ratio.replace(':', 'x');
}

export function filenameToRatio(filename: string): string {
  return filename.replace('x', ':').replace('.png', '');
}
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/utils/slug.test.ts
```

Expected: PASS

**Step 5: Create output manager**

Create `plugins/maccing-pictura/server/src/core/output.ts`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ImageResult, SupportedRatio } from '../types/image.js';
import { ratioToFilename, filenameToRatio } from '../utils/slug.js';

export interface BatchInfo {
  timestamp: string;
  slug: string;
  path: string;
  images: Array<{ ratio: SupportedRatio; path: string }>;
}

export class OutputManager {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async saveImage(image: ImageResult, slug: string, timestamp: string): Promise<string> {
    const dir = path.join(this.baseDir, timestamp, slug);
    await fs.mkdir(dir, { recursive: true });

    const filename = `${ratioToFilename(image.ratio)}.png`;
    const filePath = path.join(dir, filename);

    await fs.writeFile(filePath, image.data);

    return filePath;
  }

  async saveBatch(images: ImageResult[], slug: string, timestamp: string): Promise<string[]> {
    const paths: string[] = [];
    for (const image of images) {
      const savedPath = await this.saveImage(image, slug, timestamp);
      paths.push(savedPath);
    }
    return paths;
  }

  async listBatches(limit = 10): Promise<BatchInfo[]> {
    const batches: BatchInfo[] = [];

    try {
      const timestamps = await fs.readdir(this.baseDir);
      const sortedTimestamps = timestamps.sort().reverse();

      for (const timestamp of sortedTimestamps) {
        const timestampPath = path.join(this.baseDir, timestamp);
        const stat = await fs.stat(timestampPath);
        if (!stat.isDirectory()) continue;

        const slugs = await fs.readdir(timestampPath);
        for (const slug of slugs) {
          const slugPath = path.join(timestampPath, slug);
          const slugStat = await fs.stat(slugPath);
          if (!slugStat.isDirectory()) continue;

          const files = await fs.readdir(slugPath);
          const images = files
            .filter((f) => f.endsWith('.png'))
            .map((f) => ({
              ratio: filenameToRatio(f) as SupportedRatio,
              path: path.join(slugPath, f),
            }));

          batches.push({ timestamp, slug, path: slugPath, images });

          if (batches.length >= limit) return batches;
        }
      }
    } catch {
      return [];
    }

    return batches;
  }

  async loadBatch(slug: string): Promise<BatchInfo | null> {
    const batches = await this.listBatches(100);
    return batches.find((b) => b.slug === slug) || null;
  }
}
```

**Step 6: Create utils and core indexes**

Create `plugins/maccing-pictura/server/src/utils/index.ts`:

```typescript
export * from './slug.js';
```

Create `plugins/maccing-pictura/server/src/core/index.ts`:

```typescript
export * from './config.js';
export * from './retry.js';
export * from './output.js';
```

**Step 7: Commit**

```bash
git add plugins/maccing-pictura/server/src/utils/ plugins/maccing-pictura/server/src/core/
git commit -m "feat(pictura): add slug, output utilities"
```

---

## Phase 5: Prompt Enhancement

### Task 14: Implement Prompt Enhancer

**Files:**
- Create: `plugins/maccing-pictura/server/src/core/prompt-enhancer.ts`
- Test: `plugins/maccing-pictura/server/src/core/prompt-enhancer.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/core/prompt-enhancer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PromptEnhancer, detectStyle, STYLE_PROFILES } from './prompt-enhancer.js';

describe('detectStyle', () => {
  it('should detect photo style', () => {
    expect(detectStyle('photo of a cat')).toBe('photo');
    expect(detectStyle('realistic portrait')).toBe('photo');
  });

  it('should detect art style', () => {
    expect(detectStyle('cartoon character')).toBe('art');
    expect(detectStyle('anime illustration')).toBe('art');
  });

  it('should detect commercial style', () => {
    expect(detectStyle('product shot')).toBe('commercial');
  });

  it('should default to auto', () => {
    expect(detectStyle('cat on roof')).toBe('auto');
  });
});

describe('PromptEnhancer', () => {
  it('should enhance with style modifiers', () => {
    const enhancer = new PromptEnhancer();
    const enhanced = enhancer.enhance('cat on roof', { style: 'photo' });
    expect(enhanced.length).toBeGreaterThan('cat on roof'.length);
  });

  it('should return original for minimal style', () => {
    const enhancer = new PromptEnhancer();
    const enhanced = enhancer.enhance('cat on roof', { style: 'minimal' });
    expect(enhanced).toBe('cat on roof');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/core/prompt-enhancer.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/core/prompt-enhancer.ts`:

```typescript
export type StyleType = 'auto' | 'photo' | 'art' | 'commercial' | 'minimal';

export interface StyleProfile {
  modifiers: string[];
  technical: string[];
  lighting: string[];
}

export const STYLE_PROFILES: Record<Exclude<StyleType, 'auto' | 'minimal'>, StyleProfile> = {
  photo: {
    modifiers: ['ultra-realistic', 'high-resolution', 'detailed', 'sharp focus'],
    technical: ['85mm lens', 'shallow depth of field', 'natural lighting', 'bokeh'],
    lighting: ['golden hour', 'soft diffused light', 'natural ambient light'],
  },
  art: {
    modifiers: ['clean lines', 'vibrant colors', 'stylized', 'expressive'],
    technical: ['vector art', 'cel-shading', 'bold outlines', 'flat colors'],
    lighting: ['rim lighting', 'ambient occlusion', 'soft gradients'],
  },
  commercial: {
    modifiers: ['professional', 'polished', 'high-end', 'premium quality'],
    technical: ['studio lighting', 'product photography', '45-degree angle'],
    lighting: ['soft diffusion', 'three-point lighting', 'gradient backdrop'],
  },
};

const STYLE_KEYWORDS: Record<Exclude<StyleType, 'auto' | 'minimal'>, string[]> = {
  photo: ['photo', 'photograph', 'realistic', 'portrait', 'landscape', 'nature'],
  art: ['cartoon', 'anime', 'illustration', 'drawing', 'sketch', 'vector', 'logo'],
  commercial: ['product', 'advertisement', 'ad', 'marketing', 'brand', 'mockup'],
};

export function detectStyle(prompt: string): StyleType {
  const lower = prompt.toLowerCase();
  for (const [style, keywords] of Object.entries(STYLE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return style as StyleType;
    }
  }
  return 'auto';
}

export interface EnhanceOptions {
  style: StyleType;
}

export class PromptEnhancer {
  enhance(prompt: string, options: EnhanceOptions): string {
    if (options.style === 'minimal') {
      return prompt;
    }

    const detected = options.style === 'auto' ? detectStyle(prompt) : options.style;

    if (detected === 'auto') {
      return `${prompt}, highly detailed, professional quality`;
    }

    const profile = STYLE_PROFILES[detected];
    const modifier = this.pickRandom(profile.modifiers);
    const technical = this.pickRandom(profile.technical);
    const lighting = this.pickRandom(profile.lighting);

    return `${prompt}, ${modifier}, ${technical}, ${lighting}`;
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/core/prompt-enhancer.test.ts
```

Expected: PASS

**Step 5: Update core index**

Add to `plugins/maccing-pictura/server/src/core/index.ts`:

```typescript
export * from './prompt-enhancer.js';
```

**Step 6: Commit**

```bash
git add plugins/maccing-pictura/server/src/core/
git commit -m "feat(pictura): add prompt enhancer with style detection"
```

---

## Phase 6: MCP Server and Tools

### Task 15: Implement MCP Server Entry

**Files:**
- Create: `plugins/maccing-pictura/server/src/index.ts`

**Step 1: Write MCP server**

Create `plugins/maccing-pictura/server/src/index.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { ConfigManager } from './core/index.js';
import { OutputManager } from './core/index.js';
import { PromptEnhancer } from './core/index.js';
import { withRetry } from './core/index.js';
import { generateSlug, generateTimestamp } from './utils/index.js';
import { gemini, openai, topaz } from './providers/index.js';
import { registerProvider, generateImages } from './generate.js';
import type { SupportedRatio } from './types/image.js';
import { PRESET_BUNDLES, type PresetBundle } from './core/config.js';

// Register providers
registerProvider(gemini);
registerProvider(openai);

const configPath = process.env.PICTURA_CONFIG || '.claude/plugins/maccing/pictura/config.json';
const configManager = new ConfigManager(configPath);

const server = new McpServer({
  name: 'pictura',
  version: '1.0.0',
});

// Generate tool
server.tool(
  'pictura_generate',
  'Generate images in multiple aspect ratios with consistency',
  {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Image generation prompt' },
      ratios: { type: 'array', items: { type: 'string' }, description: 'Aspect ratios' },
      preset: { type: 'string', enum: ['social', 'web', 'portrait', 'landscape', 'print'] },
      quality: { type: 'string', enum: ['draft', 'pro'], default: 'pro' },
      size: { type: 'string', enum: ['1K', '2K', '4K'], default: '2K' },
      provider: { type: 'string', description: 'Provider override (gemini, openai)' },
      enhance: { type: 'boolean', default: true },
      enhanceStyle: { type: 'string', enum: ['auto', 'photo', 'art', 'commercial', 'minimal'] },
    },
    required: ['prompt'],
  },
  async (params) => {
    try {
      const config = await configManager.load();
      const outputManager = new OutputManager(config.outputDir);
      const enhancer = new PromptEnhancer();

      // Parse ratios
      let ratios: SupportedRatio[] = [];
      const p = params as Record<string, unknown>;

      if (p.preset) {
        ratios = [...PRESET_BUNDLES[p.preset as PresetBundle]] as SupportedRatio[];
      }
      if (Array.isArray(p.ratios)) {
        ratios = [...new Set([...ratios, ...p.ratios])] as SupportedRatio[];
      }
      if (ratios.length === 0) {
        ratios = [config.defaultRatio];
      }

      // Enhance prompt
      let prompt = p.prompt as string;
      const enhance = p.enhance !== false;
      if (enhance) {
        const style = (p.enhanceStyle as string) || 'auto';
        prompt = enhancer.enhance(prompt, { style: style as any });
      }

      // Select provider
      const providerName = (p.provider as string) || config.providers.generation.default;
      const provider = providerName === 'openai' ? openai : gemini;
      const modelId = providerName === 'openai' ? 'dall-e-3' : (config.defaultQuality === 'draft' ? 'flash' : 'pro');

      // Generate images
      const providerConfig = configManager.getProviderConfig('generation', providerName);
      const images = await generateImages({
        model: provider(modelId as any),
        prompt,
        ratios,
        size: (p.size as any) || config.imageSize,
        config: providerConfig,
      });

      // Save
      const timestamp = generateTimestamp();
      const slug = generateSlug(p.prompt as string);
      await outputManager.saveBatch(images, slug, timestamp);

      const result = [
        enhance ? `Enhanced prompt:\n"${prompt}"\n` : '',
        `Generated ${images.length} images:`,
        `${config.outputDir}/${timestamp}/${slug}/`,
        ...ratios.map((r) => `  - ${r}`),
      ].filter(Boolean).join('\n');

      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : error}` }],
        isError: true,
      };
    }
  }
);

// List tool
server.tool(
  'pictura_list',
  'List recent image generations',
  {
    type: 'object',
    properties: {
      limit: { type: 'number', default: 10 },
      filter: { type: 'string' },
    },
  },
  async (params) => {
    try {
      const config = await configManager.load();
      const outputManager = new OutputManager(config.outputDir);
      const p = params as Record<string, unknown>;

      let batches = await outputManager.listBatches((p.limit as number) || 10);
      if (p.filter) {
        batches = batches.filter((b) => b.slug.includes(p.filter as string));
      }

      if (batches.length === 0) {
        return { content: [{ type: 'text', text: 'No generations found.' }] };
      }

      const lines = ['Recent generations:\n'];
      for (const batch of batches) {
        lines.push(`${batch.timestamp}/${batch.slug}/`);
        for (const img of batch.images) {
          lines.push(`  - ${img.ratio}`);
        }
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : error}` }],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Pictura MCP server started');
}

main().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
```

**Step 2: Build**

```bash
cd plugins/maccing-pictura/server && npm run build
```

Expected: Success

**Step 3: Commit**

```bash
git add plugins/maccing-pictura/server/src/index.ts
git commit -m "feat(pictura): add MCP server with generate and list tools"
```

---

## Phase 7: Commands and Skills

### Task 16: Create Commands

**Files:**
- Create: `plugins/maccing-pictura/commands/generate.md`
- Create: `plugins/maccing-pictura/commands/edit.md`
- Create: `plugins/maccing-pictura/commands/upscale.md`
- Create: `plugins/maccing-pictura/commands/list.md`
- Create: `plugins/maccing-pictura/commands/gallery.md`

**Step 1: Create commands directory**

```bash
mkdir -p plugins/maccing-pictura/commands
```

**Step 2: Create generate.md**

Create `plugins/maccing-pictura/commands/generate.md`:

```markdown
---
description: Generate consistent images across multiple aspect ratios
---

# Pictura Generate

Use the `pictura_generate` MCP tool to create images.

## Arguments

$ARGUMENTS is the prompt for image generation.

## Flags

- `--ratios`: Comma-separated ratios (1:1,16:9,9:16)
- `--social` / `--web` / `--portrait` / `--landscape` / `--print`: Preset bundles
- `--draft`: Use fast model
- `--size`: Output resolution (1K, 2K, 4K)
- `--provider`: Override provider (gemini, openai)
- `--no-enhance`: Disable prompt enhancement
- `--enhance-style`: Style (auto, photo, art, commercial, minimal)

## Examples

```
/pictura:generate "mountain sunset" --social
/pictura:generate "product shot" --ratios 1:1,16:9
```
```

**Step 3: Create list.md**

Create `plugins/maccing-pictura/commands/list.md`:

```markdown
---
description: Show recent image generations
---

# Pictura List

Use the `pictura_list` MCP tool to browse generated images.

## Flags

- `--limit`: Maximum batches (default: 10)
- `--filter`: Filter by prompt slug

## Examples

```
/pictura:list
/pictura:list --filter "product"
```
```

**Step 4: Create edit.md, upscale.md, gallery.md**

Create similar command files for edit, upscale, and gallery.

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/commands/
git commit -m "feat(pictura): add slash commands"
```

---

### Task 17: Create Skill

**Files:**
- Create: `plugins/maccing-pictura/skills/image-generation/SKILL.md`

**Step 1: Create skill directory**

```bash
mkdir -p plugins/maccing-pictura/skills/image-generation
```

**Step 2: Create SKILL.md**

Create `plugins/maccing-pictura/skills/image-generation/SKILL.md`:

```markdown
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
```

**Step 3: Commit**

```bash
git add plugins/maccing-pictura/skills/
git commit -m "feat(pictura): add image generation skill"
```

---

## Phase 8: Integration

### Task 18: Update Marketplace

**Files:**
- Modify: `.claude-plugin/marketplace.json`

**Step 1: Add plugin to marketplace**

Add to `.claude-plugin/marketplace.json`:

```json
{
  "name": "maccing-pictura",
  "source": "./plugins/maccing-pictura",
  "description": "Provider-agnostic multi-ratio image generation with AI SDK pattern",
  "version": "1.0.0",
  "author": { "name": "Andre Dezzy" },
  "keywords": ["image-generation", "gemini", "openai", "topaz", "aspect-ratio"],
  "license": "MIT"
}
```

**Step 2: Commit**

```bash
git add .claude-plugin/marketplace.json
git commit -m "feat(marketplace): add maccing-pictura"
```

---

### Task 19: Run All Tests

**Step 1: Run full test suite**

```bash
cd plugins/maccing-pictura/server && npm test
```

Expected: All tests pass

**Step 2: Build production**

```bash
cd plugins/maccing-pictura/server && npm run build
```

Expected: No errors

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore(pictura): finalize v1.0.0"
```

---

## Summary

**Architecture:** Vercel AI SDK-style provider specification pattern

**Key Components:**
1. **Provider Spec** (`provider-spec/`): Types, factory for creating providers
2. **Unified API** (`generate.ts`): `generateImage()` with fallback chains
3. **Providers** (`providers/`): Gemini, OpenAI, Topaz implementations
4. **Core** (`core/`): Config, retry, output, prompt enhancer
5. **MCP Server** (`index.ts`): Tools exposed via Model Context Protocol

**Total Tasks:** 19
**Estimated Commits:** 19+

Each task follows TDD: test → fail → implement → pass → commit.
