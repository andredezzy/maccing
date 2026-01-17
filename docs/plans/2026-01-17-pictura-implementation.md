# maccing-pictura Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a provider-agnostic multi-ratio image generation plugin with MCP server, automatic prompt enhancement, and two-turn premium upscaling.

**Architecture:** TypeScript MCP server exposing 5 tools (generate, edit, upscale, list, gallery) with pluggable provider system for generation (Gemini, OpenAI) and upscaling (Topaz, Replicate). Markdown commands/skills guide Claude to use the MCP tools.

**Tech Stack:** TypeScript, Node.js, @modelcontextprotocol/sdk, Zod, vitest

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

## Phase 2: Core Types and Interfaces

### Task 4: Define Image Types

**Files:**
- Create: `plugins/maccing-pictura/server/src/types/image.ts`
- Test: `plugins/maccing-pictura/server/src/types/image.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/types/image.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ImageSchema, type Image } from './image.js';

describe('Image types', () => {
  it('should validate a valid image object', () => {
    const image: Image = {
      data: Buffer.from('test'),
      ratio: '16:9',
      width: 2048,
      height: 1152,
      provider: 'gemini',
    };

    const result = ImageSchema.safeParse(image);
    expect(result.success).toBe(true);
  });

  it('should reject invalid ratio format', () => {
    const image = {
      data: Buffer.from('test'),
      ratio: 'invalid',
      width: 2048,
      height: 1152,
      provider: 'gemini',
    };

    const result = ImageSchema.safeParse(image);
    expect(result.success).toBe(false);
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

export const ImageSchema = z.object({
  data: z.instanceof(Buffer),
  path: z.string().optional(),
  ratio: RatioSchema,
  width: z.number().positive(),
  height: z.number().positive(),
  provider: z.string(),
  timestamp: z.date().optional(),
});

export type Image = z.infer<typeof ImageSchema>;

export const RATIO_DIMENSIONS: Record<SupportedRatio, { width: number; height: number }> = {
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

export function getDimensionsForRatio(
  ratio: SupportedRatio,
  size: '1K' | '2K' | '4K' = '2K'
): { width: number; height: number } {
  const base = RATIO_DIMENSIONS[ratio];
  const multiplier = size === '1K' ? 0.5 : size === '4K' ? 2 : 1;
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

### Task 5: Define Provider Interfaces

**Files:**
- Create: `plugins/maccing-pictura/server/src/types/provider.ts`
- Test: `plugins/maccing-pictura/server/src/types/provider.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/types/provider.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  GenOptionsSchema,
  EditOptionsSchema,
  UpscaleOptionsSchema,
  type GenerationProvider,
  type UpscaleProvider,
} from './provider.js';

describe('Provider types', () => {
  it('should validate GenOptions with defaults', () => {
    const options = {
      quality: 'pro' as const,
      size: '2K' as const,
      consistency: 'generate' as const,
    };

    const result = GenOptionsSchema.safeParse(options);
    expect(result.success).toBe(true);
  });

  it('should validate EditOptions with mask', () => {
    const options = {
      prompt: 'add clouds',
      mask: 'sky region',
    };

    const result = EditOptionsSchema.safeParse(options);
    expect(result.success).toBe(true);
  });

  it('should validate UpscaleOptions', () => {
    const options = {
      model: 'standard-max',
      scale: 4,
    };

    const result = UpscaleOptionsSchema.safeParse(options);
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/types/provider.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/types/provider.ts`:

```typescript
import { z } from 'zod';
import type { Image, SupportedRatio } from './image.js';

export const GenOptionsSchema = z.object({
  quality: z.enum(['draft', 'pro']).default('pro'),
  size: z.enum(['1K', '2K', '4K']).default('2K'),
  reference: z.custom<Image>().optional(),
  consistency: z.enum(['generate', 'reference', 'multiturn']).default('generate'),
  enhance: z.boolean().default(true),
  enhanceStyle: z.enum(['auto', 'photo', 'art', 'commercial', 'minimal']).default('auto'),
});

export type GenOptions = z.infer<typeof GenOptionsSchema>;

export const EditOptionsSchema = z.object({
  prompt: z.string(),
  mask: z.string().optional(),
  extend: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  style: z.custom<Image>().optional(),
});

export type EditOptions = z.infer<typeof EditOptionsSchema>;

export const UpscaleOptionsSchema = z.object({
  model: z.string().optional(),
  scale: z.number().min(1).max(8).optional(),
});

export type UpscaleOptions = z.infer<typeof UpscaleOptionsSchema>;

export interface ProviderCapabilities {
  name: string;
  supportedRatios: SupportedRatio[];
  maxResolution: '1K' | '2K' | '4K';
  features: {
    reference: boolean;
    multiturn: boolean;
    inpaint: boolean;
    outpaint: boolean;
    styleTransfer: boolean;
  };
}

export interface GenerationProvider {
  name: string;
  initialize(config: Record<string, unknown>): Promise<void>;
  generate(prompt: string, ratio: SupportedRatio, options: GenOptions): Promise<Image>;
  edit(image: Image, options: EditOptions): Promise<Image>;
  getCapabilities(): ProviderCapabilities;
}

export interface UpscaleCapabilities {
  name: string;
  maxScale: number;
  models: string[];
}

export interface UpscaleProvider {
  name: string;
  initialize(config: Record<string, unknown>): Promise<void>;
  upscale(image: Image, options: UpscaleOptions): Promise<Image>;
  getCapabilities(): UpscaleCapabilities;
}
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/types/provider.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/types/
git commit -m "feat(pictura): add provider interfaces and option schemas"
```

---

### Task 6: Define Config Types

**Files:**
- Create: `plugins/maccing-pictura/server/src/types/config.ts`
- Test: `plugins/maccing-pictura/server/src/types/config.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/types/config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ConfigSchema, type PicturaConfig } from './config.js';

describe('Config types', () => {
  it('should validate a complete config', () => {
    const config: PicturaConfig = {
      providers: {
        generation: {
          default: 'gemini',
          gemini: { apiKey: 'test-key', defaultModel: 'pro' },
        },
        upscale: {
          default: 'topaz',
          topaz: { apiKey: 'test-key', defaultModel: 'standard-max' },
        },
      },
      defaultRatio: '16:9',
      defaultQuality: 'pro',
      imageSize: '2K',
      defaultConsistency: 'generate',
      retryAttempts: 3,
      outputDir: '.claude/plugins/maccing/pictura/output',
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('should apply defaults for missing optional fields', () => {
    const config = {
      providers: {
        generation: {
          default: 'gemini',
          gemini: { apiKey: 'test-key' },
        },
        upscale: {
          default: 'topaz',
          topaz: { apiKey: 'test-key' },
        },
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaultRatio).toBe('16:9');
      expect(result.data.retryAttempts).toBe(3);
    }
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/types/config.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/types/config.ts`:

```typescript
import { z } from 'zod';
import { RatioSchema } from './image.js';

const GeminiConfigSchema = z.object({
  apiKey: z.string(),
  defaultModel: z.enum(['draft', 'pro']).default('pro'),
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

const GenerationProvidersSchema = z.object({
  default: z.enum(['gemini', 'openai']).default('gemini'),
  gemini: GeminiConfigSchema.optional(),
  openai: OpenAIConfigSchema.optional(),
});

const UpscaleProvidersSchema = z.object({
  default: z.enum(['topaz', 'replicate']).default('topaz'),
  topaz: TopazConfigSchema.optional(),
  replicate: ReplicateConfigSchema.optional(),
});

export const ConfigSchema = z.object({
  providers: z.object({
    generation: GenerationProvidersSchema,
    upscale: UpscaleProvidersSchema,
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
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/types/config.test.ts
```

Expected: PASS

**Step 5: Create types index**

Create `plugins/maccing-pictura/server/src/types/index.ts`:

```typescript
export * from './image.js';
export * from './provider.js';
export * from './config.js';
```

**Step 6: Commit**

```bash
git add plugins/maccing-pictura/server/src/types/
git commit -m "feat(pictura): add config types and preset bundles"
```

---

## Phase 3: Core Utilities

### Task 7: Implement Config Manager

**Files:**
- Create: `plugins/maccing-pictura/server/src/core/config.ts`
- Test: `plugins/maccing-pictura/server/src/core/config.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/core/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from './config.js';
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
  });

  it('should return false for exists() when config missing', async () => {
    const manager = new ConfigManager(configPath);
    expect(await manager.exists()).toBe(false);
  });

  it('should save config to file', async () => {
    const manager = new ConfigManager(configPath);
    const config = {
      providers: {
        generation: { default: 'gemini' as const, gemini: { apiKey: 'new-key' } },
        upscale: { default: 'topaz' as const, topaz: { apiKey: 'new-key' } },
      },
    };

    await manager.save(config);

    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.providers.generation.gemini.apiKey).toBe('new-key');
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
import { ConfigSchema, type PicturaConfig } from '../types/index.js';

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
git commit -m "feat(pictura): add config manager with file persistence"
```

---

### Task 8: Implement Retry Utility

**Files:**
- Create: `plugins/maccing-pictura/server/src/core/retry.ts`
- Test: `plugins/maccing-pictura/server/src/core/retry.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/core/retry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { withRetry, RetryError } from './retry.js';

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

  it('should not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('content policy violation'));

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 10,
        shouldRetry: (err) => !err.message.includes('content policy'),
      })
    ).rejects.toThrow('content policy violation');
    expect(fn).toHaveBeenCalledTimes(1);
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
    shouldRetry = () => true,
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
  const retryablePatterns = [
    'rate limit',
    '429',
    'timeout',
    'econnreset',
    'enotfound',
    'network',
  ];
  return retryablePatterns.some((pattern) => message.includes(pattern));
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

### Task 9: Implement Slug Generator

**Files:**
- Create: `plugins/maccing-pictura/server/src/utils/slug.ts`
- Test: `plugins/maccing-pictura/server/src/utils/slug.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/utils/slug.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateSlug, generateTimestamp } from './slug.js';

describe('generateSlug', () => {
  it('should convert prompt to lowercase kebab-case', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('should remove special characters', () => {
    expect(generateSlug('Cat & Dog!')).toBe('cat-dog');
  });

  it('should collapse multiple spaces/dashes', () => {
    expect(generateSlug('hello   world')).toBe('hello-world');
    expect(generateSlug('hello---world')).toBe('hello-world');
  });

  it('should truncate long prompts', () => {
    const longPrompt = 'a'.repeat(100);
    const slug = generateSlug(longPrompt);
    expect(slug.length).toBeLessThanOrEqual(50);
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

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/utils/
git commit -m "feat(pictura): add slug and timestamp utilities"
```

---

### Task 10: Implement Output Manager

**Files:**
- Create: `plugins/maccing-pictura/server/src/core/output.ts`
- Test: `plugins/maccing-pictura/server/src/core/output.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/core/output.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OutputManager } from './output.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { Image } from '../types/index.js';

describe('OutputManager', () => {
  let tempDir: string;
  let outputManager: OutputManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pictura-output-'));
    outputManager = new OutputManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should save image with correct path structure', async () => {
    const image: Image = {
      data: Buffer.from('fake-image-data'),
      ratio: '16:9',
      width: 2048,
      height: 1152,
      provider: 'gemini',
    };

    const savedPath = await outputManager.saveImage(image, 'test-prompt', '2026-01-17-120000');

    expect(savedPath).toContain('2026-01-17-120000');
    expect(savedPath).toContain('test-prompt');
    expect(savedPath).toContain('16x9.png');

    const exists = await fs.access(savedPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('should list batches in output directory', async () => {
    const image: Image = {
      data: Buffer.from('fake-image-data'),
      ratio: '1:1',
      width: 2048,
      height: 2048,
      provider: 'gemini',
    };

    await outputManager.saveImage(image, 'batch-one', '2026-01-17-100000');
    await outputManager.saveImage(image, 'batch-two', '2026-01-17-110000');

    const batches = await outputManager.listBatches();
    expect(batches.length).toBe(2);
  });

  it('should load batch by slug', async () => {
    const image: Image = {
      data: Buffer.from('fake-image-data'),
      ratio: '16:9',
      width: 2048,
      height: 1152,
      provider: 'gemini',
    };

    await outputManager.saveImage(image, 'my-batch', '2026-01-17-120000');

    const batch = await outputManager.loadBatch('my-batch');
    expect(batch).not.toBeNull();
    expect(batch!.slug).toBe('my-batch');
    expect(batch!.images.length).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/core/output.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/core/output.ts`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Image, SupportedRatio } from '../types/index.js';
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

  async saveImage(image: Image, slug: string, timestamp: string): Promise<string> {
    const dir = path.join(this.baseDir, timestamp, slug);
    await fs.mkdir(dir, { recursive: true });

    const filename = `${ratioToFilename(image.ratio)}.png`;
    const filePath = path.join(dir, filename);

    await fs.writeFile(filePath, image.data);

    return filePath;
  }

  async saveBatch(
    images: Image[],
    slug: string,
    timestamp: string
  ): Promise<string[]> {
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

          batches.push({
            timestamp,
            slug,
            path: slugPath,
            images,
          });

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

  async loadBatchImages(batch: BatchInfo): Promise<Image[]> {
    const images: Image[] = [];
    for (const img of batch.images) {
      const data = await fs.readFile(img.path);
      images.push({
        data,
        path: img.path,
        ratio: img.ratio,
        width: 0,
        height: 0,
        provider: 'unknown',
      });
    }
    return images;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/core/output.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/core/
git commit -m "feat(pictura): add output manager for image persistence"
```

---

## Phase 4: Prompt Enhancement

### Task 11: Implement Prompt Enhancer

**Files:**
- Create: `plugins/maccing-pictura/server/src/core/prompt-enhancer.ts`
- Test: `plugins/maccing-pictura/server/src/core/prompt-enhancer.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/core/prompt-enhancer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PromptEnhancer, detectStyle, STYLE_PROFILES } from './prompt-enhancer.js';

describe('detectStyle', () => {
  it('should detect photorealistic style', () => {
    expect(detectStyle('photo of a cat')).toBe('photo');
    expect(detectStyle('realistic portrait')).toBe('photo');
    expect(detectStyle('photograph of sunset')).toBe('photo');
  });

  it('should detect illustration style', () => {
    expect(detectStyle('cartoon character')).toBe('art');
    expect(detectStyle('anime girl')).toBe('art');
    expect(detectStyle('vector logo')).toBe('art');
  });

  it('should detect commercial style', () => {
    expect(detectStyle('product shot of watch')).toBe('commercial');
    expect(detectStyle('advertisement for shoes')).toBe('commercial');
  });

  it('should default to auto for ambiguous prompts', () => {
    expect(detectStyle('cat on roof')).toBe('auto');
  });
});

describe('STYLE_PROFILES', () => {
  it('should have required profiles', () => {
    expect(STYLE_PROFILES.photo).toBeDefined();
    expect(STYLE_PROFILES.art).toBeDefined();
    expect(STYLE_PROFILES.commercial).toBeDefined();
    expect(STYLE_PROFILES.minimal).toBeDefined();
  });

  it('should have modifiers for each profile', () => {
    expect(STYLE_PROFILES.photo.modifiers.length).toBeGreaterThan(0);
    expect(STYLE_PROFILES.art.modifiers.length).toBeGreaterThan(0);
  });
});

describe('PromptEnhancer', () => {
  it('should enhance prompt with style modifiers', () => {
    const enhancer = new PromptEnhancer();
    const enhanced = enhancer.enhance('cat on roof', { style: 'photo' });

    expect(enhanced).toContain('cat');
    expect(enhanced.length).toBeGreaterThan('cat on roof'.length);
  });

  it('should preserve original prompt when style is minimal', () => {
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
  category: string;
  modifiers: string[];
  technicalTerms: string[];
  composition: string[];
  lighting: string[];
}

export const STYLE_PROFILES: Record<Exclude<StyleType, 'auto' | 'minimal'>, StyleProfile> = {
  photo: {
    category: 'photorealistic',
    modifiers: ['ultra-realistic', 'high-resolution', 'detailed', 'sharp focus'],
    technicalTerms: ['85mm lens', 'shallow depth of field', 'natural lighting', 'bokeh'],
    composition: ['rule of thirds', 'leading lines', 'centered subject'],
    lighting: ['golden hour', 'soft diffused light', 'natural ambient light', 'dramatic shadows'],
  },
  art: {
    category: 'illustration',
    modifiers: ['clean lines', 'vibrant colors', 'stylized', 'expressive'],
    technicalTerms: ['vector art', 'cel-shading', 'bold outlines', 'flat colors'],
    composition: ['dynamic pose', 'asymmetrical balance', 'negative space'],
    lighting: ['rim lighting', 'ambient occlusion', 'soft gradients'],
  },
  commercial: {
    category: 'commercial',
    modifiers: ['professional', 'polished', 'high-end', 'premium quality'],
    technicalTerms: ['studio lighting', 'product photography', '45-degree angle', 'reflective surface'],
    composition: ['centered product', 'clean background', 'hero shot'],
    lighting: ['soft diffusion', 'three-point lighting', 'gradient backdrop'],
  },
};

const STYLE_KEYWORDS: Record<Exclude<StyleType, 'auto' | 'minimal'>, string[]> = {
  photo: ['photo', 'photograph', 'realistic', 'portrait', 'landscape', 'nature', 'street'],
  art: ['cartoon', 'anime', 'illustration', 'drawing', 'sketch', 'vector', 'logo', 'icon', 'stylized'],
  commercial: ['product', 'advertisement', 'ad', 'marketing', 'brand', 'packaging', 'mockup'],
};

export function detectStyle(prompt: string): StyleType {
  const lowerPrompt = prompt.toLowerCase();

  for (const [style, keywords] of Object.entries(STYLE_KEYWORDS)) {
    if (keywords.some((kw) => lowerPrompt.includes(kw))) {
      return style as StyleType;
    }
  }

  return 'auto';
}

export interface EnhanceOptions {
  style: StyleType;
  targetRatios?: string[];
}

export class PromptEnhancer {
  enhance(prompt: string, options: EnhanceOptions): string {
    const { style } = options;

    if (style === 'minimal') {
      return prompt;
    }

    const detectedStyle = style === 'auto' ? detectStyle(prompt) : style;

    if (detectedStyle === 'auto') {
      return this.enhanceGeneric(prompt);
    }

    const profile = STYLE_PROFILES[detectedStyle];
    return this.applyProfile(prompt, profile);
  }

  private enhanceGeneric(prompt: string): string {
    const enhancements = [
      'highly detailed',
      'professional quality',
      'well-composed',
    ];

    const randomEnhancement = enhancements[Math.floor(Math.random() * enhancements.length)];
    return `${prompt}, ${randomEnhancement}`;
  }

  private applyProfile(prompt: string, profile: StyleProfile): string {
    const modifier = profile.modifiers[Math.floor(Math.random() * profile.modifiers.length)];
    const technical = profile.technicalTerms[Math.floor(Math.random() * profile.technicalTerms.length)];
    const lighting = profile.lighting[Math.floor(Math.random() * profile.lighting.length)];

    return `${prompt}, ${modifier}, ${technical}, ${lighting}`;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/core/prompt-enhancer.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/core/
git commit -m "feat(pictura): add prompt enhancer with style detection"
```

---

## Phase 5: Provider Implementations

### Task 12: Implement Gemini Provider (Stub)

**Files:**
- Create: `plugins/maccing-pictura/server/src/providers/generation/gemini.ts`
- Test: `plugins/maccing-pictura/server/src/providers/generation/gemini.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/providers/generation/gemini.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiProvider } from './gemini.js';

describe('GeminiProvider', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    provider = new GeminiProvider();
  });

  it('should have correct name', () => {
    expect(provider.name).toBe('gemini');
  });

  it('should return capabilities', () => {
    const caps = provider.getCapabilities();
    expect(caps.name).toBe('gemini');
    expect(caps.supportedRatios).toContain('16:9');
    expect(caps.maxResolution).toBe('4K');
    expect(caps.features.reference).toBe(true);
  });

  it('should throw error when not initialized', async () => {
    await expect(
      provider.generate('test', '16:9', { quality: 'pro', size: '2K', consistency: 'generate', enhance: false, enhanceStyle: 'auto' })
    ).rejects.toThrow('not initialized');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/providers/generation/gemini.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/providers/generation/gemini.ts`:

```typescript
import type {
  GenerationProvider,
  ProviderCapabilities,
  GenOptions,
  EditOptions,
} from '../../types/provider.js';
import type { Image, SupportedRatio } from '../../types/image.js';
import { SUPPORTED_RATIOS, getDimensionsForRatio } from '../../types/image.js';

interface GeminiConfig {
  apiKey: string;
  defaultModel?: 'draft' | 'pro';
}

export class GeminiProvider implements GenerationProvider {
  name = 'gemini';
  private config: GeminiConfig | null = null;
  private client: unknown = null;

  async initialize(config: Record<string, unknown>): Promise<void> {
    this.config = config as GeminiConfig;

    if (!this.config.apiKey) {
      throw new Error('Gemini API key is required');
    }

    // TODO: Initialize actual Gemini client
    // const { GoogleGenerativeAI } = await import('@google/generative-ai');
    // this.client = new GoogleGenerativeAI(this.config.apiKey);
    this.client = { initialized: true };
  }

  async generate(
    prompt: string,
    ratio: SupportedRatio,
    options: GenOptions
  ): Promise<Image> {
    if (!this.client || !this.config) {
      throw new Error('GeminiProvider not initialized');
    }

    const dimensions = getDimensionsForRatio(ratio, options.size);
    const model = options.quality === 'draft' ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';

    // TODO: Implement actual Gemini API call
    // const response = await this.client.generateImage({
    //   prompt,
    //   aspectRatio: ratio,
    //   imageSize: options.size,
    //   model,
    // });

    // Stub response for testing
    const stubData = Buffer.from(`stub-image-${ratio}-${Date.now()}`);

    return {
      data: stubData,
      ratio,
      width: dimensions.width,
      height: dimensions.height,
      provider: this.name,
    };
  }

  async edit(image: Image, options: EditOptions): Promise<Image> {
    if (!this.client || !this.config) {
      throw new Error('GeminiProvider not initialized');
    }

    // TODO: Implement actual Gemini edit API call
    const stubData = Buffer.from(`stub-edited-${image.ratio}-${Date.now()}`);

    return {
      ...image,
      data: stubData,
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      name: this.name,
      supportedRatios: [...SUPPORTED_RATIOS],
      maxResolution: '4K',
      features: {
        reference: true,
        multiturn: true,
        inpaint: true,
        outpaint: true,
        styleTransfer: true,
      },
    };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/providers/generation/gemini.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/providers/
git commit -m "feat(pictura): add Gemini provider stub"
```

---

### Task 13: Implement Topaz Provider (Stub)

**Files:**
- Create: `plugins/maccing-pictura/server/src/providers/upscale/topaz.ts`
- Test: `plugins/maccing-pictura/server/src/providers/upscale/topaz.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/providers/upscale/topaz.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { TopazProvider } from './topaz.js';

describe('TopazProvider', () => {
  let provider: TopazProvider;

  beforeEach(() => {
    provider = new TopazProvider();
  });

  it('should have correct name', () => {
    expect(provider.name).toBe('topaz');
  });

  it('should return capabilities', () => {
    const caps = provider.getCapabilities();
    expect(caps.name).toBe('topaz');
    expect(caps.maxScale).toBe(8);
    expect(caps.models).toContain('standard-max');
  });

  it('should throw error when not initialized', async () => {
    await expect(
      provider.upscale(
        { data: Buffer.from('test'), ratio: '16:9', width: 100, height: 100, provider: 'test' },
        {}
      )
    ).rejects.toThrow('not initialized');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/providers/upscale/topaz.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/providers/upscale/topaz.ts`:

```typescript
import type {
  UpscaleProvider,
  UpscaleCapabilities,
  UpscaleOptions,
} from '../../types/provider.js';
import type { Image } from '../../types/image.js';

interface TopazConfig {
  apiKey: string;
  defaultModel?: string;
}

const TOPAZ_MODELS = [
  'standard-v2',
  'standard-max',
  'recovery-v2',
  'high-fidelity-v2',
  'redefine',
] as const;

export class TopazProvider implements UpscaleProvider {
  name = 'topaz';
  private config: TopazConfig | null = null;

  async initialize(config: Record<string, unknown>): Promise<void> {
    this.config = config as TopazConfig;

    if (!this.config.apiKey) {
      throw new Error('Topaz API key is required');
    }
  }

  async upscale(image: Image, options: UpscaleOptions): Promise<Image> {
    if (!this.config) {
      throw new Error('TopazProvider not initialized');
    }

    const model = options.model || this.config.defaultModel || 'standard-max';
    const scale = options.scale || 4;

    // TODO: Implement actual Topaz API call
    // const response = await fetch('https://api.topazlabs.com/v1/enhance', {
    //   method: 'POST',
    //   headers: {
    //     'X-API-Key': this.config.apiKey,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     image: image.data.toString('base64'),
    //     model,
    //     scale,
    //   }),
    // });

    // Stub response for testing
    const stubData = Buffer.from(`stub-upscaled-${scale}x-${Date.now()}`);

    return {
      ...image,
      data: stubData,
      width: image.width * scale,
      height: image.height * scale,
      provider: `${image.provider}+topaz`,
    };
  }

  getCapabilities(): UpscaleCapabilities {
    return {
      name: this.name,
      maxScale: 8,
      models: [...TOPAZ_MODELS],
    };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/providers/upscale/topaz.test.ts
```

Expected: PASS

**Step 5: Create provider index files**

Create `plugins/maccing-pictura/server/src/providers/generation/index.ts`:

```typescript
export { GeminiProvider } from './gemini.js';
```

Create `plugins/maccing-pictura/server/src/providers/upscale/index.ts`:

```typescript
export { TopazProvider } from './topaz.js';
```

Create `plugins/maccing-pictura/server/src/providers/index.ts`:

```typescript
export * from './generation/index.js';
export * from './upscale/index.js';
```

**Step 6: Commit**

```bash
git add plugins/maccing-pictura/server/src/providers/
git commit -m "feat(pictura): add Topaz upscale provider stub"
```

---

## Phase 6: MCP Server and Tools

### Task 14: Implement MCP Server Entry Point

**Files:**
- Create: `plugins/maccing-pictura/server/src/index.ts`

**Step 1: Write the MCP server entry**

Create `plugins/maccing-pictura/server/src/index.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'pictura',
  version: '1.0.0',
});

// Tools will be registered here in subsequent tasks

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Pictura MCP server started');
}

main().catch((error) => {
  console.error('Failed to start Pictura MCP server:', error);
  process.exit(1);
});

export { server };
```

**Step 2: Build and verify**

```bash
cd plugins/maccing-pictura/server && npm run build
```

Expected: Compilation succeeds, `dist/index.js` created

**Step 3: Commit**

```bash
git add plugins/maccing-pictura/server/src/index.ts
git commit -m "feat(pictura): add MCP server entry point"
```

---

### Task 15: Implement Generate Tool

**Files:**
- Create: `plugins/maccing-pictura/server/src/tools/generate.ts`
- Test: `plugins/maccing-pictura/server/src/tools/generate.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/tools/generate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateToolSchema, parseGenerateParams } from './generate.js';

describe('generateToolSchema', () => {
  it('should have required fields', () => {
    expect(generateToolSchema.description).toBeDefined();
    expect(generateToolSchema.inputSchema).toBeDefined();
  });
});

describe('parseGenerateParams', () => {
  it('should parse basic params', () => {
    const params = parseGenerateParams({
      prompt: 'cat on roof',
    });

    expect(params.prompt).toBe('cat on roof');
    expect(params.ratios).toEqual(['16:9']);
    expect(params.quality).toBe('pro');
  });

  it('should expand preset bundle', () => {
    const params = parseGenerateParams({
      prompt: 'cat on roof',
      preset: 'social',
    });

    expect(params.ratios).toEqual(['1:1', '9:16', '16:9']);
  });

  it('should merge explicit ratios with preset', () => {
    const params = parseGenerateParams({
      prompt: 'cat on roof',
      preset: 'social',
      ratios: ['21:9'],
    });

    expect(params.ratios).toContain('21:9');
    expect(params.ratios).toContain('1:1');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/tools/generate.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/tools/generate.ts`:

```typescript
import { z } from 'zod';
import { PRESET_BUNDLES, type PresetBundle } from '../types/config.js';
import { RatioSchema, type SupportedRatio } from '../types/image.js';

export const generateInputSchema = z.object({
  prompt: z.string().describe('Image generation prompt'),
  ratios: z.array(z.string()).optional().describe('Aspect ratios to generate'),
  preset: z.enum(['social', 'web', 'portrait', 'landscape', 'print']).optional().describe('Preset bundle'),
  quality: z.enum(['draft', 'pro']).default('pro').describe('Quality level'),
  size: z.enum(['1K', '2K', '4K']).default('2K').describe('Output resolution'),
  provider: z.string().optional().describe('Generation provider override'),
  reference: z.string().optional().describe('Path to reference image'),
  consistency: z.enum(['generate', 'reference', 'multiturn']).default('generate').describe('Consistency strategy'),
  enhance: z.boolean().default(true).describe('Enable prompt enhancement'),
  enhanceStyle: z.enum(['auto', 'photo', 'art', 'commercial', 'minimal']).default('auto').describe('Enhancement style'),
});

export type GenerateInput = z.infer<typeof generateInputSchema>;

export interface ParsedGenerateParams {
  prompt: string;
  ratios: SupportedRatio[];
  quality: 'draft' | 'pro';
  size: '1K' | '2K' | '4K';
  provider?: string;
  reference?: string;
  consistency: 'generate' | 'reference' | 'multiturn';
  enhance: boolean;
  enhanceStyle: 'auto' | 'photo' | 'art' | 'commercial' | 'minimal';
}

export function parseGenerateParams(input: unknown): ParsedGenerateParams {
  const parsed = generateInputSchema.parse(input);

  let ratios: SupportedRatio[] = [];

  if (parsed.preset) {
    const presetRatios = PRESET_BUNDLES[parsed.preset as PresetBundle];
    ratios = [...presetRatios] as SupportedRatio[];
  }

  if (parsed.ratios && parsed.ratios.length > 0) {
    const validRatios = parsed.ratios
      .map((r) => RatioSchema.safeParse(r))
      .filter((r) => r.success)
      .map((r) => r.data as SupportedRatio);

    ratios = [...new Set([...ratios, ...validRatios])];
  }

  if (ratios.length === 0) {
    ratios = ['16:9'];
  }

  return {
    prompt: parsed.prompt,
    ratios,
    quality: parsed.quality,
    size: parsed.size,
    provider: parsed.provider,
    reference: parsed.reference,
    consistency: parsed.consistency,
    enhance: parsed.enhance,
    enhanceStyle: parsed.enhanceStyle,
  };
}

export const generateToolSchema = {
  name: 'pictura_generate',
  description: 'Generate images in multiple aspect ratios with consistency',
  inputSchema: {
    type: 'object' as const,
    properties: {
      prompt: { type: 'string', description: 'Image generation prompt' },
      ratios: { type: 'array', items: { type: 'string' }, description: 'Aspect ratios' },
      preset: { type: 'string', enum: ['social', 'web', 'portrait', 'landscape', 'print'] },
      quality: { type: 'string', enum: ['draft', 'pro'], default: 'pro' },
      size: { type: 'string', enum: ['1K', '2K', '4K'], default: '2K' },
      provider: { type: 'string', description: 'Provider override' },
      reference: { type: 'string', description: 'Reference image path' },
      consistency: { type: 'string', enum: ['generate', 'reference', 'multiturn'], default: 'generate' },
      enhance: { type: 'boolean', default: true },
      enhanceStyle: { type: 'string', enum: ['auto', 'photo', 'art', 'commercial', 'minimal'], default: 'auto' },
    },
    required: ['prompt'],
  },
};
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/tools/generate.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/tools/
git commit -m "feat(pictura): add generate tool schema and parser"
```

---

### Task 16: Implement List Tool

**Files:**
- Create: `plugins/maccing-pictura/server/src/tools/list.ts`
- Test: `plugins/maccing-pictura/server/src/tools/list.test.ts`

**Step 1: Write the test**

Create `plugins/maccing-pictura/server/src/tools/list.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { listToolSchema, formatBatchList } from './list.js';
import type { BatchInfo } from '../core/output.js';

describe('listToolSchema', () => {
  it('should have correct name', () => {
    expect(listToolSchema.name).toBe('pictura_list');
  });
});

describe('formatBatchList', () => {
  it('should format empty list', () => {
    const result = formatBatchList([]);
    expect(result).toContain('No generations found');
  });

  it('should format batches correctly', () => {
    const batches: BatchInfo[] = [
      {
        timestamp: '2026-01-17-120000',
        slug: 'cat-on-roof',
        path: '/output/2026-01-17-120000/cat-on-roof',
        images: [
          { ratio: '16:9', path: '/output/2026-01-17-120000/cat-on-roof/16x9.png' },
          { ratio: '1:1', path: '/output/2026-01-17-120000/cat-on-roof/1x1.png' },
        ],
      },
    ];

    const result = formatBatchList(batches);
    expect(result).toContain('cat-on-roof');
    expect(result).toContain('16:9');
    expect(result).toContain('1:1');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd plugins/maccing-pictura/server && npm test -- src/tools/list.test.ts
```

Expected: FAIL

**Step 3: Write the implementation**

Create `plugins/maccing-pictura/server/src/tools/list.ts`:

```typescript
import { z } from 'zod';
import type { BatchInfo } from '../core/output.js';

export const listInputSchema = z.object({
  limit: z.number().min(1).max(100).default(10).describe('Maximum batches to show'),
  filter: z.string().optional().describe('Filter by prompt slug'),
});

export type ListInput = z.infer<typeof listInputSchema>;

export function formatBatchList(batches: BatchInfo[]): string {
  if (batches.length === 0) {
    return 'No generations found.\n\nUse /pictura:generate to create images.';
  }

  const lines: string[] = ['Recent generations:\n'];

  for (const batch of batches) {
    lines.push(`${batch.timestamp}/${batch.slug}/`);
    for (const img of batch.images) {
      lines.push(`  ├── ${img.ratio}`);
    }
    lines.push('');
  }

  lines.push('Use /pictura:edit "<slug>" to modify a batch.');

  return lines.join('\n');
}

export const listToolSchema = {
  name: 'pictura_list',
  description: 'List recent image generations',
  inputSchema: {
    type: 'object' as const,
    properties: {
      limit: { type: 'number', description: 'Maximum batches to show', default: 10 },
      filter: { type: 'string', description: 'Filter by prompt slug' },
    },
    required: [],
  },
};
```

**Step 4: Run test to verify it passes**

```bash
cd plugins/maccing-pictura/server && npm test -- src/tools/list.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/server/src/tools/
git commit -m "feat(pictura): add list tool for browsing generations"
```

---

### Task 17: Create Tools Index and Wire to MCP Server

**Files:**
- Create: `plugins/maccing-pictura/server/src/tools/index.ts`
- Modify: `plugins/maccing-pictura/server/src/index.ts`

**Step 1: Create tools index**

Create `plugins/maccing-pictura/server/src/tools/index.ts`:

```typescript
export { generateToolSchema, parseGenerateParams, type ParsedGenerateParams } from './generate.js';
export { listToolSchema, formatBatchList, type ListInput } from './list.js';
```

**Step 2: Update MCP server to register tools**

Replace `plugins/maccing-pictura/server/src/index.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { generateToolSchema, parseGenerateParams } from './tools/index.js';
import { listToolSchema, formatBatchList } from './tools/index.js';
import { ConfigManager } from './core/config.js';
import { OutputManager } from './core/output.js';
import { PromptEnhancer } from './core/prompt-enhancer.js';
import { GeminiProvider } from './providers/index.js';
import { generateSlug, generateTimestamp } from './utils/slug.js';

const configPath = process.env.PICTURA_CONFIG || '.claude/plugins/maccing/pictura/config.json';
const configManager = new ConfigManager(configPath);

const server = new McpServer({
  name: 'pictura',
  version: '1.0.0',
});

server.tool(
  generateToolSchema.name,
  generateToolSchema.description,
  generateToolSchema.inputSchema,
  async (params) => {
    try {
      const parsed = parseGenerateParams(params);
      const config = await configManager.load();
      const outputManager = new OutputManager(config.outputDir);
      const enhancer = new PromptEnhancer();

      let prompt = parsed.prompt;
      if (parsed.enhance) {
        prompt = enhancer.enhance(parsed.prompt, { style: parsed.enhanceStyle });
      }

      const provider = new GeminiProvider();
      const providerConfig = config.providers.generation.gemini;
      if (!providerConfig) {
        throw new Error('Gemini provider not configured');
      }
      await provider.initialize(providerConfig);

      const images = [];
      const timestamp = generateTimestamp();
      const slug = generateSlug(parsed.prompt);

      for (const ratio of parsed.ratios) {
        const image = await provider.generate(prompt, ratio, {
          quality: parsed.quality,
          size: parsed.size,
          consistency: parsed.consistency,
          enhance: false,
          enhanceStyle: 'minimal',
        });
        images.push(image);
      }

      const paths = await outputManager.saveBatch(images, slug, timestamp);

      const resultLines = [
        parsed.enhance ? `Enhanced prompt:\n"${prompt}"\n` : '',
        `Generated ${images.length} images:`,
        `${config.outputDir}/${timestamp}/${slug}/`,
        ...parsed.ratios.map((r, i) => `  ├── ${r.replace(':', 'x')}.png`),
      ].filter(Boolean);

      return {
        content: [{ type: 'text', text: resultLines.join('\n') }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  listToolSchema.name,
  listToolSchema.description,
  listToolSchema.inputSchema,
  async (params) => {
    try {
      const config = await configManager.load();
      const outputManager = new OutputManager(config.outputDir);

      const limit = (params as { limit?: number }).limit || 10;
      const filter = (params as { filter?: string }).filter;

      let batches = await outputManager.listBatches(limit);

      if (filter) {
        batches = batches.filter((b) => b.slug.includes(filter));
      }

      return {
        content: [{ type: 'text', text: formatBatchList(batches) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
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
  console.error('Failed to start Pictura MCP server:', error);
  process.exit(1);
});

export { server };
```

**Step 3: Build and verify**

```bash
cd plugins/maccing-pictura/server && npm run build
```

Expected: Compilation succeeds

**Step 4: Commit**

```bash
git add plugins/maccing-pictura/server/src/
git commit -m "feat(pictura): wire tools to MCP server"
```

---

## Phase 7: Commands and Skills

### Task 18: Create Generate Command

**Files:**
- Create: `plugins/maccing-pictura/commands/generate.md`

**Step 1: Write the command**

Create `plugins/maccing-pictura/commands/generate.md`:

```markdown
---
description: Generate consistent images across multiple aspect ratios
---

# Pictura Generate

Use the `pictura_generate` MCP tool to create images in multiple aspect ratios with automatic prompt enhancement and consistency.

## Arguments

$ARGUMENTS is the prompt for image generation.

## Flags

- `--ratios`: Comma-separated ratios (e.g., "1:1,16:9,9:16")
- `--social`: Preset bundle for social media (1:1, 9:16, 16:9)
- `--web`: Preset bundle for web (16:9, 4:3, 1:1)
- `--portrait`: Preset bundle for portrait (2:3, 3:4, 4:5, 9:16)
- `--landscape`: Preset bundle for landscape (3:2, 4:3, 16:9, 21:9)
- `--print`: Preset bundle for print (2:3, 3:4, 4:5)
- `--draft`: Use fast model instead of pro quality
- `--size`: Output resolution (1K, 2K, 4K), default 2K
- `--provider`: Override generation provider (gemini, openai)
- `--ref`: Path to reference image for consistency
- `--no-enhance`: Disable automatic prompt enhancement
- `--enhance-style`: Enhancement style (auto, photo, art, commercial, minimal)

## Examples

```
/pictura:generate "mountain sunset" --social
/pictura:generate "product shot" --ratios 1:1,16:9 --ref ./brand-ref.png
/pictura:generate "abstract background" --web --draft
/pictura:generate "realistic portrait" --enhance-style photo
```

## Behavior

1. Parse the prompt and flags
2. Expand preset bundles to ratio list
3. Enhance prompt based on detected or specified style
4. Generate first image
5. Use first image as reference for subsequent ratios (consistency)
6. Save all images to output directory
7. Report paths and enhanced prompt
```

**Step 2: Commit**

```bash
git add plugins/maccing-pictura/commands/
git commit -m "feat(pictura): add generate command"
```

---

### Task 19: Create Remaining Commands

**Files:**
- Create: `plugins/maccing-pictura/commands/edit.md`
- Create: `plugins/maccing-pictura/commands/upscale.md`
- Create: `plugins/maccing-pictura/commands/list.md`
- Create: `plugins/maccing-pictura/commands/gallery.md`

**Step 1: Create edit command**

Create `plugins/maccing-pictura/commands/edit.md`:

```markdown
---
description: Edit existing image batch by prompt slug
---

# Pictura Edit

Use the `pictura_edit` MCP tool to modify all images in a batch.

## Arguments

$1 is the prompt slug (e.g., "mountain-sunset")

## Flags

- `--prompt`: Edit instruction describing the change
- `--mask`: Region description for targeted inpainting
- `--extend`: Outpaint direction (top, bottom, left, right)
- `--style`: Path to style reference image

## Examples

```
/pictura:edit "mountain-sunset" --prompt "add dramatic clouds"
/pictura:edit "product-shot" --mask "background" --prompt "gradient blue"
/pictura:edit "hero-image" --extend top --prompt "add more sky"
/pictura:edit "mascot" --style ./watercolor-ref.png
```

## Behavior

1. Load batch by slug
2. Apply edit to all ratios in batch
3. Save edited images with new timestamp
4. Maintain consistency across all ratios
```

**Step 2: Create upscale command**

Create `plugins/maccing-pictura/commands/upscale.md`:

```markdown
---
description: Two-turn premium upscale using Gemini and Topaz Labs
---

# Pictura Upscale

Use the `pictura_upscale` MCP tool for maximum quality enhancement.

## Arguments

$1 is the prompt slug (e.g., "logo-concept")

## Flags

- `--topaz-model`: Topaz model (standard-max, recovery, hifi)
- `--upscaler`: Override upscale provider (topaz, replicate)
- `--skip-topaz`: Only do Gemini 4K regeneration

## Pipeline

1. **Turn 1 (Gemini)**: Regenerate at native 4K resolution
2. **Turn 2 (Topaz)**: Enhance with AI upscaling (up to 8x)

Result: Up to 32K effective resolution

## Examples

```
/pictura:upscale "logo-concept"
/pictura:upscale "product-shot" --topaz-model hifi
/pictura:upscale "hero-image" --skip-topaz
```
```

**Step 3: Create list command**

Create `plugins/maccing-pictura/commands/list.md`:

```markdown
---
description: Show recent image generations
---

# Pictura List

Use the `pictura_list` MCP tool to browse generated images.

## Flags

- `--limit`: Maximum batches to show (default: 10)
- `--filter`: Filter by prompt slug substring

## Examples

```
/pictura:list
/pictura:list --limit 5
/pictura:list --filter "product"
```
```

**Step 4: Create gallery command**

Create `plugins/maccing-pictura/commands/gallery.md`:

```markdown
---
description: Open visual image browser in web browser
---

# Pictura Gallery

Use the `pictura_gallery` MCP tool to open an HTML gallery.

## Flags

- `--filter`: Show only matching prompt slugs
- `--since`: Filter by date (YYYY-MM-DD)

## Examples

```
/pictura:gallery
/pictura:gallery --filter "product"
/pictura:gallery --since 2026-01-15
```

## Behavior

1. Generate HTML gallery with thumbnails
2. Open in default web browser
3. Click images to view full size
```

**Step 5: Commit**

```bash
git add plugins/maccing-pictura/commands/
git commit -m "feat(pictura): add edit, upscale, list, gallery commands"
```

---

### Task 20: Create Image Generation Skill

**Files:**
- Create: `plugins/maccing-pictura/skills/image-generation/SKILL.md`

**Step 1: Create skills directory**

```bash
mkdir -p plugins/maccing-pictura/skills/image-generation
```

**Step 2: Write the skill**

Create `plugins/maccing-pictura/skills/image-generation/SKILL.md`:

```markdown
---
name: image-generation
description: Use when user wants to generate, create, or make images, pictures, visuals, graphics, or assets in multiple formats, sizes, or aspect ratios. Also triggers for editing, upscaling, or managing generated images.
---

# Image Generation Skill

This skill handles image generation, editing, and management using the Pictura MCP tools.

## Triggers

Activate when user mentions:
- Generate/create/make images, pictures, visuals, graphics, assets
- Multiple aspect ratios, formats, sizes
- Social media images, web assets, marketing materials
- Edit/modify/change existing images
- Upscale/enhance/improve image quality
- List/show/browse generated images
- Open gallery/viewer

## Available Tools

### pictura_generate

Generate images in multiple aspect ratios.

Parameters:
- `prompt` (required): Image description
- `ratios`: Array of ratios like ["16:9", "1:1"]
- `preset`: Bundle name (social, web, portrait, landscape, print)
- `quality`: "draft" or "pro" (default: pro)
- `size`: "1K", "2K", or "4K" (default: 2K)
- `enhance`: Boolean for prompt enhancement (default: true)
- `enhanceStyle`: auto, photo, art, commercial, minimal

### pictura_edit

Edit all images in a batch.

Parameters:
- `slug` (required): Prompt slug identifying the batch
- `prompt` (required): Edit instruction
- `mask`: Region description for inpainting
- `extend`: Direction for outpainting (top, bottom, left, right)
- `style`: Path to style reference image

### pictura_upscale

Two-turn premium upscale.

Parameters:
- `slug` (required): Prompt slug identifying the batch
- `topazModel`: Model name (standard-max, recovery, hifi)
- `skipTopaz`: Boolean to skip Topaz step

### pictura_list

List recent generations.

Parameters:
- `limit`: Max batches (default: 10)
- `filter`: Slug substring filter

### pictura_gallery

Open visual browser.

Parameters:
- `filter`: Slug substring filter
- `since`: Date filter (YYYY-MM-DD)

## Example Interactions

**User:** "Generate social media images of a coffee shop"
**Action:** Call pictura_generate with preset: "social"

**User:** "Make the coffee shop images warmer"
**Action:** Call pictura_edit with prompt: "warmer color temperature, golden lighting"

**User:** "Upscale the coffee shop images to maximum quality"
**Action:** Call pictura_upscale

**User:** "Show me my recent image generations"
**Action:** Call pictura_list

**User:** "Open the image gallery"
**Action:** Call pictura_gallery
```

**Step 3: Commit**

```bash
git add plugins/maccing-pictura/skills/
git commit -m "feat(pictura): add image generation skill"
```

---

## Phase 8: Final Integration

### Task 21: Update Marketplace Manifest

**Files:**
- Modify: `.claude-plugin/marketplace.json`

**Step 1: Read current marketplace.json**

```bash
cat .claude-plugin/marketplace.json
```

**Step 2: Add pictura plugin entry**

Add to the plugins array in `.claude-plugin/marketplace.json`:

```json
{
  "name": "maccing-pictura",
  "source": "./plugins/maccing-pictura",
  "description": "Provider-agnostic multi-ratio image generation with automatic prompt enhancement and premium upscaling",
  "version": "1.0.0",
  "author": { "name": "Andre Dezzy" },
  "keywords": ["image-generation", "gemini", "openai", "topaz", "aspect-ratio", "consistency"],
  "license": "MIT"
}
```

**Step 3: Commit**

```bash
git add .claude-plugin/marketplace.json
git commit -m "feat(marketplace): add maccing-pictura plugin"
```

---

### Task 22: Run All Tests

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
git commit -m "chore(pictura): finalize v1.0.0 implementation"
```

---

## Summary

This implementation plan covers:

1. **Phase 1**: Project scaffolding (plugin manifest, MCP config, package.json)
2. **Phase 2**: Core types (Image, Provider, Config schemas)
3. **Phase 3**: Utilities (Config manager, Retry, Slug, Output manager)
4. **Phase 4**: Prompt enhancement (Style detection, enhancement profiles)
5. **Phase 5**: Provider stubs (Gemini, Topaz)
6. **Phase 6**: MCP server and tools (generate, list)
7. **Phase 7**: Commands and skills (Markdown files)
8. **Phase 8**: Integration (marketplace, final testing)

**Total tasks:** 22
**Estimated commits:** 22+

Each task follows TDD: write test, verify fail, implement, verify pass, commit.
