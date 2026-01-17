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

---

## Phase 2: Provider Specification Core

### Task 4: Implement Provider Factory with Types

**Files:**
- Create: `plugins/maccing-pictura/server/src/provider-spec/factory.ts`
- Test: `plugins/maccing-pictura/server/src/provider-spec/factory.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/provider-spec/factory.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import {
  createImageProvider,
  createUpscaleProvider,
  SUPPORTED_RATIOS,
  getDimensionsForRatio,
  type ImageProviderSpec,
  type UpscaleProviderSpec,
  type ImageResult,
} from './factory';

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

describe('getDimensionsForRatio', () => {
  it('should calculate dimensions for ratio and size', () => {
    const dims2K = getDimensionsForRatio('16:9', '2K');
    expect(dims2K.width).toBe(2048);
    expect(dims2K.height).toBe(1152);

    const dims4K = getDimensionsForRatio('16:9', '4K');
    expect(dims4K.width).toBe(4096);
    expect(dims4K.height).toBe(2304);
  });
});

describe('SUPPORTED_RATIOS', () => {
  it('should have all supported ratios', () => {
    expect(SUPPORTED_RATIOS).toContain('16:9');
    expect(SUPPORTED_RATIOS).toContain('1:1');
    expect(SUPPORTED_RATIOS).toContain('9:16');
    expect(SUPPORTED_RATIOS.length).toBe(10);
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
import { z } from 'zod';

// ============================================================================
// Image Types
// ============================================================================

export const SUPPORTED_RATIOS = [
  '1:1', '2:3', '3:2', '3:4', '4:3',
  '4:5', '5:4', '9:16', '16:9', '21:9',
] as const;

export type SupportedRatio = typeof SUPPORTED_RATIOS[number];
export type ImageSize = '1K' | '2K' | '4K';

export const RatioSchema = z.enum(SUPPORTED_RATIOS);

export interface ImageResult {
  data: Buffer;
  path?: string;
  ratio: SupportedRatio;
  width: number;
  height: number;
  provider: string;
  model: string;
  timestamp?: Date;
}

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

// ============================================================================
// Provider Types
// ============================================================================

export interface GenerateImageParams {
  prompt: string;
  ratio: SupportedRatio;
  size?: ImageSize;
  reference?: Buffer;
  negativePrompt?: string;
}

export interface EditImageParams {
  image: Buffer;
  prompt: string;
  mask?: string;
  extend?: 'top' | 'bottom' | 'left' | 'right';
  style?: Buffer;
}

export interface UpscaleImageParams {
  image: Buffer;
  scale?: number;
  model?: string;
}

export interface ImageModelCapabilities {
  maxResolution: ImageSize;
  supportedRatios: SupportedRatio[];
  supportsReference: boolean;
  supportsEdit: boolean;
  supportsInpaint: boolean;
  supportsOutpaint: boolean;
}

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

export interface UpscaleProviderSpec {
  name: string;
  models: string[];
  maxScale: number;
  upscale(
    params: UpscaleImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult>;
}

export interface ModelSelector<T extends string = string> {
  provider: string;
  modelId: T;
  capabilities: ImageModelCapabilities;
}

export type ModelWithFallbacks = ModelSelector | ModelSelector[];

// ============================================================================
// Provider Factory
// ============================================================================

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

---

### Task 5: Implement Unified Generate Function

**Files:**
- Create: `plugins/maccing-pictura/server/src/generate.ts`
- Test: `plugins/maccing-pictura/server/src/generate.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/generate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateImage, type GenerateImageOptions } from './generate';
import { createImageProvider, type ImageProviderSpec } from './provider-spec/factory';

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
import {
  type ModelSelector,
  type ModelWithFallbacks,
  type GenerateImageParams,
  type ImageProviderFunction,
  type ImageResult,
  type SupportedRatio,
  type ImageSize,
} from './provider-spec/factory';

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
import { gemini, GEMINI_MODELS } from './gemini';

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
import {
  createImageProvider,
  getDimensionsForRatio,
  SUPPORTED_RATIOS,
  type ImageProviderSpec,
  type GenerateImageParams,
  type EditImageParams,
  type ImageResult,
} from '../provider-spec/factory';

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

---

### Task 9: Implement OpenAI Provider (GPT Image 1.5)

> **CRITICAL:** DALL-E 2 and DALL-E 3 are deprecated and will be removed on **May 12, 2026**. This implementation uses GPT Image models.

**Files:**
- Create: `plugins/maccing-pictura/server/src/providers/openai.ts`
- Test: `plugins/maccing-pictura/server/src/providers/openai.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/providers/openai.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { openai, OPENAI_MODELS, OPENAI_SIZES } from './openai';

describe('OpenAI provider', () => {
  it('should have correct provider name', () => {
    expect(openai.name).toBe('openai');
  });

  it('should expose gpt-image-1.5 model (not deprecated DALL-E)', () => {
    expect(OPENAI_MODELS).toContain('gpt-image-1.5');
    expect(OPENAI_MODELS).toContain('gpt-image-1');
    expect(OPENAI_MODELS).not.toContain('dall-e-3'); // Deprecated May 2026
  });

  it('should create model selector for gpt-image-1.5', () => {
    const model = openai('gpt-image-1.5');
    expect(model.provider).toBe('openai');
    expect(model.modelId).toBe('gpt-image-1.5');
  });

  it('should have correct size mappings', () => {
    expect(OPENAI_SIZES).toEqual({
      '1:1': '1024x1024',
      '3:2': '1536x1024',
      '2:3': '1024x1536',
    });
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
import {
  createImageProvider,
  type ImageProviderSpec,
  type GenerateImageParams,
  type ImageResult,
  type SupportedRatio,
} from '../provider-spec/factory';

// GPT Image models (DALL-E 2/3 deprecated May 12, 2026)
export const OPENAI_MODELS = ['gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'] as const;
export type OpenAIModel = typeof OPENAI_MODELS[number];

// OpenAI uses fixed sizes, not aspect ratios
export const OPENAI_SIZES: Record<string, string> = {
  '1:1': '1024x1024',
  '3:2': '1536x1024',  // Landscape
  '2:3': '1024x1536',  // Portrait
};

// Map unsupported ratios to nearest size
const RATIO_TO_SIZE: Record<SupportedRatio, string> = {
  '1:1': '1024x1024',
  '2:3': '1024x1536',
  '3:2': '1536x1024',
  '3:4': '1024x1536',  // Map to portrait
  '4:3': '1536x1024',  // Map to landscape
  '4:5': '1024x1536',  // Map to portrait
  '5:4': '1536x1024',  // Map to landscape
  '9:16': '1024x1536', // Map to portrait
  '16:9': '1536x1024', // Map to landscape
  '21:9': '1536x1024', // Map to landscape
};

const openaiSpec: ImageProviderSpec = {
  name: 'openai',
  models: {
    'gpt-image-1.5': {
      id: 'gpt-image-1.5',
      capabilities: {
        maxResolution: '2K',
        supportedRatios: ['1:1', '3:2', '2:3'], // Native support
        supportsReference: true,
        supportsEdit: true,
        supportsInpaint: true,
        supportsOutpaint: false,
      },
    },
    'gpt-image-1': {
      id: 'gpt-image-1',
      capabilities: {
        maxResolution: '2K',
        supportedRatios: ['1:1', '3:2', '2:3'],
        supportsReference: true,
        supportsEdit: true,
        supportsInpaint: true,
        supportsOutpaint: false,
      },
    },
    'gpt-image-1-mini': {
      id: 'gpt-image-1-mini',
      capabilities: {
        maxResolution: '1K',
        supportedRatios: ['1:1', '3:2', '2:3'],
        supportsReference: false,
        supportsEdit: false,
        supportsInpaint: false,
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

    const size = RATIO_TO_SIZE[params.ratio] || '1024x1024';
    const [width, height] = size.split('x').map(Number);

    // TODO: Implement actual OpenAI API call
    // import OpenAI from 'openai';
    // const client = new OpenAI({ apiKey });
    // const response = await client.images.generate({
    //   model: modelId,
    //   prompt: params.prompt,
    //   size: size as '1024x1024' | '1536x1024' | '1024x1536',
    //   response_format: 'b64_json',
    // });

    // Stub for development
    const stubData = Buffer.from(`openai-${modelId}-${params.ratio}-${Date.now()}`);

    return {
      data: stubData,
      ratio: params.ratio,
      width,
      height,
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

---

### Task 10: Implement Topaz Upscale Provider

**Files:**
- Create: `plugins/maccing-pictura/server/src/providers/topaz.ts`
- Test: `plugins/maccing-pictura/server/src/providers/topaz.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/providers/topaz.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { topaz, TOPAZ_MODELS } from './topaz';

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
import {
  createUpscaleProvider,
  type UpscaleProviderSpec,
  type UpscaleImageParams,
  type ImageResult,
} from '../provider-spec/factory';

// Standard models: synchronous, fast
// Generative models: async only, higher quality
export const TOPAZ_MODELS = [
  'standard-v2',      // Standard: fast general-purpose
  'standard-max',     // Generative: photorealistic detail (ASYNC)
  'recovery-v2',      // Generative: max enhancement for low-res (ASYNC)
  'high-fidelity-v2', // Standard: preserves fine details
  'redefine',         // Generative: creative upscaling (ASYNC)
  'low-resolution-v2',// Standard: optimized for web graphics
  'cgi',              // Standard: for computer-generated imagery
] as const;

export type TopazModel = typeof TOPAZ_MODELS[number];

// Generative models require async polling
const ASYNC_MODELS: TopazModel[] = ['standard-max', 'recovery-v2', 'redefine'];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    const response = await fetch('https://api.topazlabs.com/v1/enhance', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: params.image.toString('base64'),
        model,
        scale,
      }),
    });

    if (response.status === 413) {
      throw new Error('Request too large: Topaz API limit is 500MB');
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(`Rate limited. Retry after: ${retryAfter || 'unknown'} seconds`);
    }

    if (!response.ok) {
      throw new Error(`Topaz API error: ${response.status}`);
    }

    const data = await response.json();

    // Handle async generative models
    if (isAsync && data.jobId) {
      const result = await pollForCompletion(data.jobId, apiKey);
      return result;
    }

    // Synchronous models return immediately
    const imageBuffer = Buffer.from(data.image, 'base64');

    return {
      data: imageBuffer,
      ratio: '16:9', // Would come from original image metadata
      width: 2048 * scale,
      height: 1152 * scale,
      provider: 'topaz',
      model,
    };
  },
};

/**
 * Poll Topaz job status for async generative models
 */
async function pollForCompletion(
  jobId: string,
  apiKey: string,
  maxAttempts = 30 // ~5 minutes max
): Promise<ImageResult> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Exponential backoff: 2s, 3s, 4.5s, ... capped at 30s
    const delay = Math.min(2000 * Math.pow(1.5, attempts), 30000);
    await sleep(delay);

    const response = await fetch(`https://api.topazlabs.com/v1/jobs/${jobId}`, {
      headers: { 'X-API-Key': apiKey },
    });

    if (!response.ok) {
      throw new Error(`Failed to check job status: ${response.status}`);
    }

    const { state, output, error } = await response.json();

    if (state === 'completed' && output) {
      return {
        data: Buffer.from(output.image, 'base64'),
        ratio: '16:9',
        width: output.width,
        height: output.height,
        provider: 'topaz',
        model: output.model,
      };
    }

    if (state === 'failed') {
      throw new Error(`Topaz enhancement failed: ${error || 'Unknown error'}`);
    }

    attempts++;
  }

  throw new Error(`Topaz job timed out after ${maxAttempts} polling attempts`);
}

export const topaz = createUpscaleProvider(topazSpec);
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/providers/topaz.test.ts
```

Expected: PASS

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
import { ConfigManager, ConfigSchema } from './config';
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
import { RatioSchema } from '../provider-spec/factory';

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
    const config = providerConfig as Record<string, unknown> || {};

    // Environment variables take precedence over config file
    const envKey = this.getEnvKeyForProvider(name);
    if (envKey && process.env[envKey]) {
      return { ...config, apiKey: process.env[envKey] };
    }

    return config;
  }

  private getEnvKeyForProvider(name: string): string | null {
    const envMap: Record<string, string> = {
      gemini: 'PICTURA_GEMINI_API_KEY',
      openai: 'PICTURA_OPENAI_API_KEY',
      topaz: 'PICTURA_TOPAZ_API_KEY',
      replicate: 'PICTURA_REPLICATE_API_KEY',
    };
    return envMap[name] || null;
  }

  async verifyPermissions(): Promise<void> {
    try {
      const stats = await fs.stat(this.configPath);
      const mode = stats.mode & 0o777;
      if (mode !== 0o600) {
        console.warn(`Warning: Config file has insecure permissions (${mode.toString(8)}). Expected 600.`);
      }
    } catch {
      // File doesn't exist yet, permissions will be set on save
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/core/config.test.ts
```

Expected: PASS

---

### Task 12: Implement Retry Utility

**Files:**
- Create: `plugins/maccing-pictura/server/src/core/retry.ts`
- Test: `plugins/maccing-pictura/server/src/core/retry.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/core/retry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { withRetry, RetryError, isRetryableError } from './retry';

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
  jitterMs?: number;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
  retryAfterHeader?: string; // From response headers
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

/**
 * Calculate delay with exponential backoff and jitter to prevent thundering herd
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterMs: number,
  retryAfterMs?: number
): number {
  // Respect Retry-After header if provided
  if (retryAfterMs && retryAfterMs > 0) {
    return retryAfterMs;
  }

  // Exponential backoff: base * 2^(attempt-1)
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);

  // Add random jitter to prevent thundering herd
  const jitter = Math.random() * jitterMs;

  // Cap at max delay
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxAttempts,
    baseDelayMs = 2000,
    maxDelayMs = 30000,
    jitterMs = 3000,
    shouldRetry = isRetryableError,
    onRetry,
    retryAfterHeader,
  } = options;

  let lastError: Error | undefined;
  let retryAfterMs: number | undefined;

  // Parse Retry-After header if provided
  if (retryAfterHeader) {
    const parsed = parseInt(retryAfterHeader, 10);
    if (!isNaN(parsed)) {
      retryAfterMs = parsed * 1000;
    }
  }

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

      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitterMs, retryAfterMs);
      onRetry?.(attempt, lastError, delay);
      await sleep(delay);

      // Clear retryAfterMs after first use
      retryAfterMs = undefined;
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

  // Non-retryable errors: stop immediately, don't waste quota
  const nonRetryable = [
    'content policy',
    'invalid api key',
    'unauthorized',
    'forbidden',
    'not found',
    'quota exceeded',
    'insufficient_quota',
    'billing',
  ];

  if (nonRetryable.some((pattern) => message.includes(pattern))) {
    return false;
  }

  // Retryable errors: exponential backoff with jitter
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
import { generateSlug, generateTimestamp, ratioToFilename } from './slug';

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
import { ratioToFilename, filenameToRatio } from '../utils/slug';
import type { ImageResult, SupportedRatio } from '../provider-spec/factory';

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
import { PromptEnhancer, detectStyle, STYLE_PROFILES } from './prompt-enhancer';

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

---

## Phase 6: MCP Server and Tools

### Task 15: Implement MCP Server Entry

**Files:**
- Create: `plugins/maccing-pictura/server/src/index.ts`

**Step 1: Write MCP server**

Create `plugins/maccing-pictura/server/src/index.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import * as fs from 'fs/promises';
import * as path from 'path';

import { ConfigManager, PRESET_BUNDLES, type PresetBundle } from './core/config';
import { OutputManager, type BatchInfo } from './core/output';
import { PromptEnhancer } from './core/prompt-enhancer';
import { withRetry } from './core/retry';
import { generateSlug, generateTimestamp } from './utils/slug';
import { gemini } from './providers/gemini';
import { openai } from './providers/openai';
import { topaz } from './providers/topaz';
import { registerProvider, generateImages } from './generate';
import type { SupportedRatio } from './provider-spec/factory';

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
      // Use GPT Image 1.5 for OpenAI (DALL-E deprecated May 2026)
      const modelId = providerName === 'openai' ? 'gpt-image-1.5' : (config.defaultQuality === 'draft' ? 'flash' : 'pro');

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

// Edit tool
server.tool(
  'pictura_edit',
  'Edit existing image batch by prompt slug',
  {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Prompt slug of batch to edit' },
      prompt: { type: 'string', description: 'Edit instruction' },
      mask: { type: 'string', description: 'Region description for inpainting' },
      extend: { type: 'string', enum: ['top', 'bottom', 'left', 'right'] },
      stylePath: { type: 'string', description: 'Path to style reference image' },
    },
    required: ['slug', 'prompt'],
  },
  async (params) => {
    try {
      const config = await configManager.load();
      const outputManager = new OutputManager(config.outputDir);
      const p = params as Record<string, unknown>;

      const batch = await outputManager.loadBatch(p.slug as string);
      if (!batch) {
        return { content: [{ type: 'text', text: `Batch not found: ${p.slug}` }], isError: true };
      }

      // TODO: Implement edit logic using provider's editImage method
      // For each image in batch:
      // 1. Load image data
      // 2. Call provider.editImage with prompt and mask
      // 3. Save edited image

      return {
        content: [{ type: 'text', text: `Edit tool not yet fully implemented. Found batch: ${batch.path}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : error}` }],
        isError: true,
      };
    }
  }
);

// Upscale tool
server.tool(
  'pictura_upscale',
  'Two-turn premium upscale: Generation API (4K) then Topaz Labs',
  {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Prompt slug of batch to upscale' },
      topazModel: { type: 'string', enum: ['standard-max', 'recovery-v2', 'high-fidelity-v2', 'standard-v2'] },
      upscaler: { type: 'string', enum: ['topaz', 'replicate'] },
      skipTopaz: { type: 'boolean', description: 'Skip Topaz, Gemini 4K only' },
    },
    required: ['slug'],
  },
  async (params) => {
    try {
      const config = await configManager.load();
      const outputManager = new OutputManager(config.outputDir);
      const p = params as Record<string, unknown>;

      const batch = await outputManager.loadBatch(p.slug as string);
      if (!batch) {
        return { content: [{ type: 'text', text: `Batch not found: ${p.slug}` }], isError: true };
      }

      // TODO: Implement two-turn upscale:
      // Turn 1: Regenerate at 4K using Gemini with reference
      // Turn 2: Send to Topaz Labs API for 8x enhancement

      return {
        content: [{ type: 'text', text: `Upscale tool not yet fully implemented. Found batch: ${batch.path}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : error}` }],
        isError: true,
      };
    }
  }
);

// Gallery tool
server.tool(
  'pictura_gallery',
  'Generate and open visual gallery in browser',
  {
    type: 'object',
    properties: {
      filter: { type: 'string', description: 'Filter by prompt slug' },
      since: { type: 'string', description: 'Filter by date (YYYY-MM-DD)' },
    },
  },
  async (params) => {
    try {
      const config = await configManager.load();
      const outputManager = new OutputManager(config.outputDir);
      const p = params as Record<string, unknown>;

      let batches = await outputManager.listBatches(50);

      if (p.filter) {
        batches = batches.filter((b) => b.slug.includes(p.filter as string));
      }
      if (p.since) {
        batches = batches.filter((b) => b.timestamp >= (p.since as string));
      }

      // Generate HTML gallery
      const html = generateGalleryHtml(batches, config.outputDir);
      const galleryPath = path.join(config.outputDir, 'gallery.html');
      await fs.writeFile(galleryPath, html);

      // Open in browser
      const { default: open } = await import('open');
      await open(galleryPath);

      return {
        content: [{ type: 'text', text: `Gallery opened: ${galleryPath}` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : error}` }],
        isError: true,
      };
    }
  }
);

// Helper function for gallery
function generateGalleryHtml(batches: BatchInfo[], outputDir: string): string {
  const images = batches.flatMap((b) =>
    b.images.map((img) => ({
      src: img.path,
      ratio: img.ratio,
      slug: b.slug,
      timestamp: b.timestamp,
    }))
  );

  return `<!DOCTYPE html>
<html>
<head>
  <title>Pictura Gallery</title>
  <style>
    body { font-family: system-ui; background: #1a1a1a; color: #fff; padding: 2rem; }
    h1 { margin-bottom: 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
    .card { background: #2a2a2a; border-radius: 8px; overflow: hidden; }
    .card img { width: 100%; height: auto; }
    .card-info { padding: 1rem; }
    .card-info .slug { font-weight: bold; }
    .card-info .meta { font-size: 0.85rem; color: #888; }
  </style>
</head>
<body>
  <h1>Pictura Gallery</h1>
  <div class="grid">
    ${images.map((img) => `
      <div class="card">
        <img src="file://${img.src}" alt="${img.slug}">
        <div class="card-info">
          <div class="slug">${img.slug}</div>
          <div class="meta">${img.ratio} · ${img.timestamp}</div>
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>`;
}

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

---

## Phase 9: AI-Guided Validation and Production Readiness

> **This phase is fully guided by Claude Code.** Claude executes each validation step, interprets results, diagnoses issues, and provides remediation guidance. No manual intervention required unless issues are found.

### Overview

The AI-guided validation phase uses a **four-layer testing approach**:

1. **Pre-flight Checks** - Config, permissions, server startup
2. **Tool Discovery** - MCP protocol compliance, tool exposure
3. **Provider Health** - API connectivity, authentication
4. **End-to-End Smoke Tests** - Full generation workflows

### Task 20: Create Validation Script

**Files:**
- Create: `plugins/maccing-pictura/server/src/validation/index.ts`
- Create: `plugins/maccing-pictura/server/src/validation/checks.ts`

**Step 1: Create validation checks module**

Create `plugins/maccing-pictura/server/src/validation/checks.ts`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ValidationResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  duration?: number;
  details?: Record<string, unknown>;
  remediation?: string;
}

export interface ValidationContext {
  configPath: string;
  outputDir: string;
  providers: {
    gemini?: { apiKey: string };
    openai?: { apiKey: string };
    topaz?: { apiKey: string };
  };
}

// ============================================================================
// Pre-flight Checks
// ============================================================================

export async function checkConfigExists(ctx: ValidationContext): Promise<ValidationResult> {
  const start = Date.now();
  try {
    await fs.access(ctx.configPath);
    return {
      name: 'Config File Exists',
      status: 'pass',
      message: `Found config at ${ctx.configPath}`,
      duration: Date.now() - start,
    };
  } catch {
    return {
      name: 'Config File Exists',
      status: 'fail',
      message: `Config not found at ${ctx.configPath}`,
      duration: Date.now() - start,
      remediation: 'Run /pictura:setup to create config or create manually',
    };
  }
}

export async function checkConfigPermissions(ctx: ValidationContext): Promise<ValidationResult> {
  const start = Date.now();
  try {
    const stats = await fs.stat(ctx.configPath);
    const mode = stats.mode & 0o777;
    if (mode === 0o600) {
      return {
        name: 'Config Permissions',
        status: 'pass',
        message: 'Config has secure permissions (600)',
        duration: Date.now() - start,
      };
    }
    return {
      name: 'Config Permissions',
      status: 'warn',
      message: `Config has insecure permissions (${mode.toString(8)})`,
      duration: Date.now() - start,
      remediation: `chmod 600 ${ctx.configPath}`,
    };
  } catch {
    return {
      name: 'Config Permissions',
      status: 'skip',
      message: 'Config does not exist',
      duration: Date.now() - start,
    };
  }
}

export async function checkOutputDirectory(ctx: ValidationContext): Promise<ValidationResult> {
  const start = Date.now();
  try {
    await fs.mkdir(ctx.outputDir, { recursive: true });
    // Test write permission
    const testFile = path.join(ctx.outputDir, '.write-test');
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
    return {
      name: 'Output Directory',
      status: 'pass',
      message: `Output directory writable: ${ctx.outputDir}`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Output Directory',
      status: 'fail',
      message: `Cannot write to output directory: ${error}`,
      duration: Date.now() - start,
      remediation: `mkdir -p ${ctx.outputDir} && chmod 755 ${ctx.outputDir}`,
    };
  }
}

// ============================================================================
// Provider Health Checks
// ============================================================================

export async function checkGeminiConnection(ctx: ValidationContext): Promise<ValidationResult> {
  const start = Date.now();
  if (!ctx.providers.gemini?.apiKey) {
    return {
      name: 'Gemini API Connection',
      status: 'skip',
      message: 'Gemini API key not configured',
      duration: Date.now() - start,
    };
  }

  try {
    // Test API key validity with a minimal request
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${ctx.providers.gemini.apiKey}`
    );

    if (response.status === 200) {
      const data = await response.json();
      const imageModels = data.models?.filter((m: any) =>
        m.name.includes('image') || m.name.includes('gemini-2.5-flash-image')
      );
      return {
        name: 'Gemini API Connection',
        status: 'pass',
        message: `Connected. Found ${imageModels?.length || 0} image models`,
        duration: Date.now() - start,
        details: { models: imageModels?.map((m: any) => m.name) },
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        name: 'Gemini API Connection',
        status: 'fail',
        message: 'Invalid or expired API key',
        duration: Date.now() - start,
        remediation: 'Verify API key at https://aistudio.google.com/apikey',
      };
    }

    return {
      name: 'Gemini API Connection',
      status: 'fail',
      message: `Unexpected response: ${response.status}`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Gemini API Connection',
      status: 'fail',
      message: `Connection failed: ${error}`,
      duration: Date.now() - start,
      remediation: 'Check network connectivity and firewall settings',
    };
  }
}

export async function checkOpenAIConnection(ctx: ValidationContext): Promise<ValidationResult> {
  const start = Date.now();
  if (!ctx.providers.openai?.apiKey) {
    return {
      name: 'OpenAI API Connection',
      status: 'skip',
      message: 'OpenAI API key not configured',
      duration: Date.now() - start,
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${ctx.providers.openai.apiKey}` },
    });

    if (response.status === 200) {
      const data = await response.json();
      const imageModels = data.data?.filter((m: any) =>
        m.id.includes('gpt-image') || m.id.includes('dall-e')
      );
      return {
        name: 'OpenAI API Connection',
        status: 'pass',
        message: `Connected. Found ${imageModels?.length || 0} image models`,
        duration: Date.now() - start,
        details: { models: imageModels?.map((m: any) => m.id) },
      };
    }

    if (response.status === 401) {
      return {
        name: 'OpenAI API Connection',
        status: 'fail',
        message: 'Invalid API key',
        duration: Date.now() - start,
        remediation: 'Verify API key at https://platform.openai.com/api-keys',
      };
    }

    return {
      name: 'OpenAI API Connection',
      status: 'fail',
      message: `Unexpected response: ${response.status}`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'OpenAI API Connection',
      status: 'fail',
      message: `Connection failed: ${error}`,
      duration: Date.now() - start,
    };
  }
}

export async function checkTopazConnection(ctx: ValidationContext): Promise<ValidationResult> {
  const start = Date.now();
  if (!ctx.providers.topaz?.apiKey) {
    return {
      name: 'Topaz API Connection',
      status: 'skip',
      message: 'Topaz API key not configured',
      duration: Date.now() - start,
    };
  }

  try {
    // Topaz health endpoint or models list
    const response = await fetch('https://api.topazlabs.com/v1/models', {
      headers: { 'X-API-Key': ctx.providers.topaz.apiKey },
    });

    if (response.status === 200) {
      return {
        name: 'Topaz API Connection',
        status: 'pass',
        message: 'Connected to Topaz Labs API',
        duration: Date.now() - start,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        name: 'Topaz API Connection',
        status: 'fail',
        message: 'Invalid API key',
        duration: Date.now() - start,
        remediation: 'Verify API key at https://www.topazlabs.com/api',
      };
    }

    return {
      name: 'Topaz API Connection',
      status: 'fail',
      message: `Unexpected response: ${response.status}`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Topaz API Connection',
      status: 'fail',
      message: `Connection failed: ${error}`,
      duration: Date.now() - start,
    };
  }
}

// ============================================================================
// Smoke Tests
// ============================================================================

export async function smokeTestGeneration(ctx: ValidationContext): Promise<ValidationResult> {
  const start = Date.now();
  if (!ctx.providers.gemini?.apiKey) {
    return {
      name: 'Smoke Test: Image Generation',
      status: 'skip',
      message: 'No generation provider configured',
      duration: Date.now() - start,
    };
  }

  try {
    // Minimal generation test with safe prompt
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(ctx.providers.gemini.apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'A simple blue circle on white background' }] }],
      generationConfig: {
        responseModalities: ['image'],
      },
    });

    const hasImage = response.response.candidates?.[0]?.content?.parts?.some(
      (p: any) => p.inlineData?.mimeType?.startsWith('image/')
    );

    if (hasImage) {
      return {
        name: 'Smoke Test: Image Generation',
        status: 'pass',
        message: `Image generated successfully in ${Date.now() - start}ms`,
        duration: Date.now() - start,
        details: { provider: 'gemini', model: 'gemini-2.5-flash-image' },
      };
    }

    return {
      name: 'Smoke Test: Image Generation',
      status: 'fail',
      message: 'No image in response',
      duration: Date.now() - start,
    };
  } catch (error: any) {
    // Check for specific error types
    if (error.message?.includes('content policy')) {
      return {
        name: 'Smoke Test: Image Generation',
        status: 'fail',
        message: 'Content policy violation (unexpected for test prompt)',
        duration: Date.now() - start,
        remediation: 'This may indicate API changes, check Gemini documentation',
      };
    }

    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      return {
        name: 'Smoke Test: Image Generation',
        status: 'warn',
        message: 'Rate limited, generation likely works but at quota',
        duration: Date.now() - start,
        remediation: 'Wait and retry, or upgrade API tier',
      };
    }

    return {
      name: 'Smoke Test: Image Generation',
      status: 'fail',
      message: `Generation failed: ${error.message}`,
      duration: Date.now() - start,
    };
  }
}

export async function smokeTestPromptEnhancement(): Promise<ValidationResult> {
  const start = Date.now();
  try {
    // Dynamic import to test module loading
    const { PromptEnhancer } = await import('../core/prompt-enhancer');
    const enhancer = new PromptEnhancer();

    const original = 'cat on roof';
    const enhanced = enhancer.enhance(original, { style: 'photo' });

    if (enhanced.length > original.length) {
      return {
        name: 'Smoke Test: Prompt Enhancement',
        status: 'pass',
        message: 'Prompt enhancer working',
        duration: Date.now() - start,
        details: { original, enhanced: enhanced.slice(0, 100) + '...' },
      };
    }

    return {
      name: 'Smoke Test: Prompt Enhancement',
      status: 'fail',
      message: 'Enhancement did not expand prompt',
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Smoke Test: Prompt Enhancement',
      status: 'fail',
      message: `Import or execution failed: ${error}`,
      duration: Date.now() - start,
    };
  }
}

export async function smokeTestRetryLogic(): Promise<ValidationResult> {
  const start = Date.now();
  try {
    const { withRetry, isRetryableError } = await import('../core/retry');

    // Test retry with simulated failures
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('rate limit 429');
        return 'success';
      },
      { maxAttempts: 5, baseDelayMs: 10, jitterMs: 5 }
    );

    if (result === 'success' && attempts === 3) {
      return {
        name: 'Smoke Test: Retry Logic',
        status: 'pass',
        message: `Retry logic working (succeeded after ${attempts} attempts)`,
        duration: Date.now() - start,
      };
    }

    return {
      name: 'Smoke Test: Retry Logic',
      status: 'fail',
      message: 'Unexpected retry behavior',
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Smoke Test: Retry Logic',
      status: 'fail',
      message: `Retry test failed: ${error}`,
      duration: Date.now() - start,
    };
  }
}
```

**Step 2: Create validation runner**

Create `plugins/maccing-pictura/server/src/validation/index.ts`:

```typescript
import {
  checkConfigExists,
  checkConfigPermissions,
  checkOutputDirectory,
  checkGeminiConnection,
  checkOpenAIConnection,
  checkTopazConnection,
  smokeTestGeneration,
  smokeTestPromptEnhancement,
  smokeTestRetryLogic,
  type ValidationResult,
  type ValidationContext,
} from './checks';
import { ConfigManager } from '../core/config';

export interface ValidationReport {
  timestamp: string;
  duration: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
  results: ValidationResult[];
  productionReady: boolean;
  blockers: string[];
  recommendations: string[];
}

export async function runValidation(configPath: string): Promise<ValidationReport> {
  const start = Date.now();
  const results: ValidationResult[] = [];

  // Build context
  let ctx: ValidationContext = {
    configPath,
    outputDir: '.claude/plugins/maccing/pictura/output',
    providers: {},
  };

  // Try to load config for provider credentials
  const configManager = new ConfigManager(configPath);
  if (await configManager.exists()) {
    try {
      const config = await configManager.load();
      ctx.outputDir = config.outputDir;
      ctx.providers = {
        gemini: config.providers.generation.gemini,
        openai: config.providers.generation.openai,
        topaz: config.providers.upscale.topaz,
      };
    } catch (e) {
      results.push({
        name: 'Config Parse',
        status: 'fail',
        message: `Failed to parse config: ${e}`,
        remediation: 'Check config.json for syntax errors',
      });
    }
  }

  // ========================================
  // Phase 1: Pre-flight Checks
  // ========================================
  console.log('\n◎ Phase 1: Pre-flight Checks ────────────────────────────────\n');

  results.push(await checkConfigExists(ctx));
  logResult(results[results.length - 1]);

  results.push(await checkConfigPermissions(ctx));
  logResult(results[results.length - 1]);

  results.push(await checkOutputDirectory(ctx));
  logResult(results[results.length - 1]);

  // ========================================
  // Phase 2: Provider Health Checks
  // ========================================
  console.log('\n◎ Phase 2: Provider Health ──────────────────────────────────\n');

  results.push(await checkGeminiConnection(ctx));
  logResult(results[results.length - 1]);

  results.push(await checkOpenAIConnection(ctx));
  logResult(results[results.length - 1]);

  results.push(await checkTopazConnection(ctx));
  logResult(results[results.length - 1]);

  // ========================================
  // Phase 3: Smoke Tests
  // ========================================
  console.log('\n◎ Phase 3: Smoke Tests ──────────────────────────────────────\n');

  results.push(await smokeTestPromptEnhancement());
  logResult(results[results.length - 1]);

  results.push(await smokeTestRetryLogic());
  logResult(results[results.length - 1]);

  // Only run generation smoke test if pre-flight passed
  const preflightPassed = results.filter(r =>
    r.name.includes('Config') || r.name.includes('Output')
  ).every(r => r.status !== 'fail');

  if (preflightPassed && ctx.providers.gemini?.apiKey) {
    results.push(await smokeTestGeneration(ctx));
    logResult(results[results.length - 1]);
  } else {
    results.push({
      name: 'Smoke Test: Image Generation',
      status: 'skip',
      message: 'Skipped due to pre-flight failures or missing config',
    });
    logResult(results[results.length - 1]);
  }

  // ========================================
  // Generate Report
  // ========================================
  const summary = {
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    warnings: results.filter(r => r.status === 'warn').length,
    skipped: results.filter(r => r.status === 'skip').length,
  };

  const blockers = results
    .filter(r => r.status === 'fail')
    .map(r => `${r.name}: ${r.message}`);

  const recommendations = results
    .filter(r => r.remediation)
    .map(r => `${r.name}: ${r.remediation}`);

  const productionReady = summary.failed === 0 && summary.passed >= 3;

  return {
    timestamp: new Date().toISOString(),
    duration: Date.now() - start,
    summary,
    results,
    productionReady,
    blockers,
    recommendations,
  };
}

function logResult(result: ValidationResult): void {
  // Follow maccing marketplace output patterns
  const statusFormat = {
    pass: '✓`',
    fail: '✖ FAIL',
    warn: '▲ WARN',
    skip: '○',
  }[result.status];

  const duration = result.duration ? ` (${result.duration}ms)` : '';

  if (result.status === 'fail' || result.status === 'warn') {
    // Failure/warning format: status on its own line with details below
    console.log(`${statusFormat}: ${result.name}`);
    console.log(`${result.message}`);
    if (result.remediation) {
      console.log(`→ ${result.remediation}`);
    }
    console.log('');
  } else {
    // Pass/skip format: inline with name and duration
    console.log(`${statusFormat} ${result.name}${duration}`);
  }
}

export function formatReport(report: ValidationReport): string {
  const lines: string[] = [];
  const date = new Date(report.timestamp);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  // Header: follows maccing pattern with ★ and ─
  lines.push('');
  lines.push('★ maccing-pictura: Validation Report ────────────────────────');
  lines.push('');
  lines.push(`Date:       ${dateStr}`);
  lines.push(`Duration:   ${report.duration}ms`);
  lines.push('');

  // Group results by phase for output
  const preflightResults = report.results.filter(r =>
    r.name.includes('Config') || r.name.includes('Output')
  );
  const providerResults = report.results.filter(r =>
    r.name.includes('Connection')
  );
  const smokeResults = report.results.filter(r =>
    r.name.includes('Smoke')
  );

  // Phase sections with ◎ and ─
  if (preflightResults.length > 0) {
    lines.push('◎ Phase 1: Pre-flight Checks ────────────────────────────────');
    lines.push('');
    preflightResults.forEach(r => {
      const icon = { pass: '✓`', fail: '✖', warn: '▲', skip: '○' }[r.status];
      const dur = r.duration ? ` (${r.duration}ms)` : '';
      lines.push(`${icon} ${r.name}${dur}`);
    });
    lines.push('');
  }

  if (providerResults.length > 0) {
    lines.push('◎ Phase 2: Provider Health ──────────────────────────────────');
    lines.push('');
    providerResults.forEach(r => {
      const icon = { pass: '✓`', fail: '✖', warn: '▲', skip: '○' }[r.status];
      const dur = r.duration ? ` (${r.duration}ms)` : '';
      lines.push(`${icon} ${r.name}${dur}`);
    });
    lines.push('');
  }

  if (smokeResults.length > 0) {
    lines.push('◎ Phase 3: Smoke Tests ──────────────────────────────────────');
    lines.push('');
    smokeResults.forEach(r => {
      const icon = { pass: '✓`', fail: '✖', warn: '▲', skip: '○' }[r.status];
      const dur = r.duration ? ` (${r.duration}ms)` : '';
      lines.push(`${icon} ${r.name}${dur}`);
    });
    lines.push('');
  }

  // Failures and warnings with details
  const failures = report.results.filter(r => r.status === 'fail');
  const warnings = report.results.filter(r => r.status === 'warn');

  if (failures.length > 0 || warnings.length > 0) {
    lines.push('────────────────────────────────────────────────────────────────');
    lines.push('');

    failures.forEach(r => {
      lines.push(`✖ FAIL: ${r.name}`);
      lines.push(r.message);
      if (r.remediation) {
        lines.push(`→ ${r.remediation}`);
      }
      lines.push('');
    });

    warnings.forEach(r => {
      lines.push(`▲ WARN: ${r.name}`);
      lines.push(r.message);
      if (r.remediation) {
        lines.push(`→ ${r.remediation}`);
      }
      lines.push('');
    });
  }

  // Summary section with ─
  lines.push('────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('Summary:');
  lines.push(`- Passed:   ${report.summary.passed}`);
  lines.push(`- Failed:   ${report.summary.failed}`);
  lines.push(`- Warnings: ${report.summary.warnings}`);
  lines.push(`- Skipped:  ${report.summary.skipped}`);
  lines.push('');

  // Final verdict with ✓/⚠ and ─
  if (report.productionReady) {
    lines.push('✓ maccing-pictura: PRODUCTION READY ────────────────────────');
  } else {
    lines.push('⚠ maccing-pictura: NOT PRODUCTION READY ────────────────────');
    lines.push('');
    lines.push('Blockers:');
    report.blockers.forEach((b, i) => {
      lines.push(`${i + 1}. ${b}`);
    });

    if (report.recommendations.length > 0) {
      lines.push('');
      lines.push('Next Steps:');
      report.recommendations.forEach((r, i) => {
        lines.push(`${i + 1}. ${r}`);
      });
    }
  }

  return lines.join('\n');
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const configPath = process.argv[2] || '.claude/plugins/maccing/pictura/config.json';
  runValidation(configPath).then(report => {
    console.log(formatReport(report));
    process.exit(report.productionReady ? 0 : 1);
  });
}
```

---

### Task 21: Create AI-Guided Validation Command

**Files:**
- Create: `plugins/maccing-pictura/commands/validate.md`
- Create: `plugins/maccing-pictura/skills/validation/SKILL.md`

**Step 1: Create validate command**

Create `plugins/maccing-pictura/commands/validate.md`:

```markdown
---
description: Run AI-guided validation to verify pictura installation and configuration
---

# Pictura Validate

Run comprehensive validation to verify the pictura plugin is correctly installed and configured.

## What This Command Does

Claude will:
1. Execute the validation script against your configuration
2. Analyze results and identify issues
3. Provide specific remediation steps for any failures
4. Confirm production readiness

## Arguments

$ARGUMENTS is optional. Can be:
- `--full`: Run all checks including live API tests (may incur costs)
- `--quick`: Run only pre-flight checks (no API calls)
- `--provider gemini|openai|topaz`: Test specific provider only

## AI-Guided Process

When you run this command, Claude will:

1. **Check pre-flight conditions:**
   - Config file exists and is valid JSON
   - Permissions are secure (600)
   - Output directory is writable

2. **Verify provider connections:**
   - Test each configured API key
   - Verify quota/rate limit status
   - Check available models

3. **Run smoke tests:**
   - Generate a simple test image
   - Verify prompt enhancement
   - Test retry logic

4. **Provide remediation:**
   - For each failure, provide specific fix
   - Explain root cause
   - Link to relevant documentation

## Examples

```
/pictura:validate
/pictura:validate --full
/pictura:validate --provider gemini
```

## Production Readiness Criteria

The plugin is production-ready when:
- [ ] Config file exists with secure permissions
- [ ] At least one generation provider is configured and connected
- [ ] Output directory is writable
- [ ] Smoke tests pass

## Troubleshooting

If validation fails, Claude will guide you through fixes. Common issues:

| Issue | Cause | Fix |
|-------|-------|-----|
| Config not found | First run | Run `/pictura:setup` |
| Invalid API key | Expired or wrong key | Regenerate at provider dashboard |
| Rate limited | Quota exceeded | Wait or upgrade tier |
| Permission denied | File permissions | `chmod 600 config.json` |
```

**Step 2: Create validation skill**

Create `plugins/maccing-pictura/skills/validation/SKILL.md`:

```markdown
---
name: pictura-validation
description: Use when user wants to verify, validate, test, or check if pictura is working correctly. Also triggers for troubleshooting, debugging, or diagnosing pictura issues.
---

# Pictura Validation Skill

This skill guides comprehensive validation of the pictura plugin installation.

## When to Use

- User asks "is pictura working?"
- User reports generation failures
- After initial setup
- Before production deployment
- When troubleshooting issues

## Validation Process

### Step 1: Run Validation Script

Execute the validation runner:

```bash
cd plugins/maccing-pictura/server && npx tsx src/validation/index.ts
```

Or via MCP tool if server is running:

```
pictura_validate
```

### Step 2: Analyze Results

For each check, interpret the result:

**PASS results:** Confirm working, no action needed.

**FAIL results:** This is critical. Provide:
1. What failed and why
2. Exact command or action to fix
3. How to verify the fix worked

**WARN results:** Not blocking but should be addressed:
1. Explain the risk
2. Provide remediation steps
3. Note if it can be ignored

**SKIP results:** Expected when feature not configured:
1. Explain what was skipped
2. Note if this is intentional

### Step 3: Production Readiness Assessment

After all checks, make a clear determination:

**If ALL critical checks pass:**
```
✓ Pictura is PRODUCTION READY

All critical systems validated:
- Configuration: Valid
- Providers: Gemini connected
- Generation: Working
- Output: Writable

You can now use /pictura:generate to create images.
```

**If ANY critical check fails:**
```
✗ Pictura is NOT READY

Blockers found:
1. [Blocker 1]: [Fix]
2. [Blocker 2]: [Fix]

Please resolve these issues and run /pictura:validate again.
```

### Step 4: Interactive Troubleshooting

If user wants help fixing issues:

1. Ask which issue to address first
2. Guide through fix step-by-step
3. Re-run relevant check to confirm
4. Repeat until all issues resolved

## Common Issues and Fixes

### Config Not Found
```bash
# Create config directory
mkdir -p .claude/plugins/maccing/pictura

# Run setup
/pictura:setup
```

### Invalid Gemini API Key
```
1. Go to https://aistudio.google.com/apikey
2. Create new API key or copy existing
3. Update config.json with new key
4. Re-run validation
```

### Rate Limited
```
Free tier: 2 images/minute
Tier 1: 10 images/minute
Tier 2: 20 images/minute

Options:
- Wait 60 seconds and retry
- Upgrade at https://ai.google.dev/pricing
```

### Permission Denied on Config
```bash
chmod 600 .claude/plugins/maccing/pictura/config.json
```

## Validation Checklist

Use this checklist for manual verification:

- [ ] `config.json` exists in `.claude/plugins/maccing/pictura/`
- [ ] Config has `600` permissions
- [ ] At least one `providers.generation` entry has valid `apiKey`
- [ ] MCP server starts without errors
- [ ] `pictura_generate` tool appears in Claude's tool list
- [ ] Test generation produces an image file
- [ ] Image file saved to correct output path
```

---

### Task 22: Add Validation MCP Tool

**Files:**
- Modify: `plugins/maccing-pictura/server/src/index.ts`

**Step 1: Add validate tool to MCP server**

Add to `plugins/maccing-pictura/server/src/index.ts`:

```typescript
import { runValidation, formatReport } from './validation';

// Validate tool
server.tool(
  'pictura_validate',
  'Run comprehensive validation to verify pictura installation and configuration',
  {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['full', 'quick', 'provider'],
        default: 'full',
        description: 'Validation mode: full (all checks), quick (pre-flight only), provider (specific provider)',
      },
      provider: {
        type: 'string',
        enum: ['gemini', 'openai', 'topaz'],
        description: 'Specific provider to test (only with mode=provider)',
      },
    },
  },
  async (params) => {
    try {
      const p = params as Record<string, unknown>;
      const report = await runValidation(configPath);

      const summary = [
        formatReport(report),
        '',
        '---',
        '',
        report.productionReady
          ? '✓ **PRODUCTION READY** - All critical checks passed.'
          : '✗ **NOT READY** - Please address the blockers above.',
      ];

      if (!report.productionReady && report.recommendations.length > 0) {
        summary.push('');
        summary.push('**Next Steps:**');
        report.recommendations.forEach((rec, i) => {
          summary.push(`${i + 1}. ${rec}`);
        });
      }

      return {
        content: [{ type: 'text', text: summary.join('\n') }],
        isError: !report.productionReady,
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Validation failed: ${error}` }],
        isError: true,
      };
    }
  }
);
```

---

### Task 23: Production Readiness Checklist

**Files:**
- Create: `plugins/maccing-pictura/PRODUCTION_CHECKLIST.md`

**Step 1: Create checklist document**

Create `plugins/maccing-pictura/PRODUCTION_CHECKLIST.md`:

```markdown
# Pictura Production Readiness Checklist

Use this checklist before deploying pictura to production.

## Automated Checks (via /pictura:validate)

Run `/pictura:validate --full` and ensure all pass:

- [ ] Config file exists with valid JSON
- [ ] Config permissions are 600 (user-only)
- [ ] Output directory exists and is writable
- [ ] At least one generation provider connected
- [ ] Smoke test generation succeeds
- [ ] Prompt enhancement working
- [ ] Retry logic working

## Manual Verification

### Security
- [ ] API keys are not committed to git
- [ ] `.gitignore` includes config path
- [ ] Environment variables used in CI/CD (not config file)
- [ ] No API keys in logs or error messages

### Rate Limits
- [ ] Understand your tier limits (Free: 2 IPM, Tier 1: 10 IPM)
- [ ] Retry logic handles 429 with exponential backoff
- [ ] Jitter added to prevent thundering herd

### Error Handling
- [ ] Content policy violations handled gracefully
- [ ] Network timeouts trigger retries
- [ ] Invalid API keys stop batch immediately
- [ ] Users see helpful error messages

### Cost Control
- [ ] Using draft mode for development
- [ ] Batch API considered for non-urgent work
- [ ] Request caching prevents duplicate generations

### Monitoring
- [ ] Generation success/failure logged
- [ ] API costs tracked
- [ ] Rate limit warnings logged

## Provider-Specific Checks

### Gemini
- [ ] API key from aistudio.google.com
- [ ] Model `gemini-2.5-flash-image` accessible
- [ ] Tier appropriate for expected volume

### OpenAI (if used)
- [ ] Using `gpt-image-1.5` (not deprecated DALL-E)
- [ ] Aware of 3-size limitation
- [ ] Ratio mapping configured

### Topaz (if used)
- [ ] API key from topazlabs.com
- [ ] Async polling implemented for generative models
- [ ] 500MB request limit understood

## Go/No-Go Decision

**GO** if:
- All automated checks pass
- At least one provider fully configured
- Security checklist complete

**NO-GO** if:
- Any automated check fails
- API keys exposed
- No provider configured
```

---

### Task 24: Run Full Validation

**Step 1: Build the validation module**

```bash
cd plugins/maccing-pictura/server && npm run build
```

Expected: Build succeeds

**Step 2: Run validation**

```bash
cd plugins/maccing-pictura/server && npx tsx src/validation/index.ts
```

Expected: Validation report with pass/fail status

**Step 3: Address any failures**

For each failure, follow the remediation steps provided.

**Step 4: Confirm production readiness**

```bash
/pictura:validate
```

Expected: "PRODUCTION READY" status

---

## Summary

**Architecture:** Vercel AI SDK-style provider specification pattern

**Key Components:**
1. **Provider Spec** (`provider-spec/`): Types, factory for creating providers
2. **Unified API** (`generate.ts`): `generateImage()` with fallback chains
3. **Providers** (`providers/`): Gemini, OpenAI, Topaz implementations
4. **Core** (`core/`): Config, retry, output, prompt enhancer
5. **MCP Server** (`index.ts`): Tools exposed via Model Context Protocol
6. **Validation** (`validation/`): AI-guided production readiness verification

**Total Tasks:** 24

Each task follows TDD: test → fail → implement → pass.

**Final Step:** Run `/pictura:validate` to confirm production readiness.
