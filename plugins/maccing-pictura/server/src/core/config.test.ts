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

  it('should return true for exists() when config present', async () => {
    const config = {
      providers: {
        generation: { default: 'gemini' },
        upscale: { default: 'topaz' },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    const manager = new ConfigManager(configPath);
    expect(await manager.exists()).toBe(true);
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

  it('should create parent directories when saving', async () => {
    const nestedPath = path.join(tempDir, 'nested', 'deep', 'config.json');
    const manager = new ConfigManager(nestedPath);
    await manager.save({
      providers: {
        generation: { default: 'gemini' },
        upscale: { default: 'topaz' },
      },
    });

    const content = await fs.readFile(nestedPath, 'utf-8');
    expect(JSON.parse(content).providers.generation.default).toBe('gemini');
  });

  it('should cache loaded config', async () => {
    const config = {
      providers: {
        generation: { default: 'gemini', gemini: { apiKey: 'original' } },
        upscale: { default: 'topaz' },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    const manager = new ConfigManager(configPath);
    const first = await manager.load();

    // Modify file after loading
    const modified = { ...config };
    modified.providers.generation.default = 'openai';
    await fs.writeFile(configPath, JSON.stringify(modified));

    // Should return cached value
    const second = await manager.load();
    expect(second.providers.generation.default).toBe('gemini');
  });

  it('should clear cache with clearCache()', async () => {
    const config = {
      providers: {
        generation: { default: 'gemini' },
        upscale: { default: 'topaz' },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    const manager = new ConfigManager(configPath);
    await manager.load();

    // Modify file and clear cache
    const modified = { ...config };
    modified.providers.generation.default = 'openai';
    await fs.writeFile(configPath, JSON.stringify(modified));
    manager.clearCache();

    const reloaded = await manager.load();
    expect(reloaded.providers.generation.default).toBe('openai');
  });

  it('should get provider config', async () => {
    const config = {
      providers: {
        generation: {
          default: 'gemini',
          gemini: { apiKey: 'test-api-key', defaultModel: 'pro' },
        },
        upscale: { default: 'topaz' },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    const manager = new ConfigManager(configPath);
    await manager.load();

    const geminiConfig = manager.getProviderConfig('generation', 'gemini');
    expect(geminiConfig.apiKey).toBe('test-api-key');
    expect(geminiConfig.defaultModel).toBe('pro');
  });

  it('should return empty object for missing provider config', async () => {
    const config = {
      providers: {
        generation: { default: 'gemini' },
        upscale: { default: 'topaz' },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    const manager = new ConfigManager(configPath);
    await manager.load();

    const openaiConfig = manager.getProviderConfig('generation', 'openai');
    expect(openaiConfig).toEqual({});
  });

  it('should throw error if getProviderConfig called before load', async () => {
    const manager = new ConfigManager(configPath);
    expect(() => manager.getProviderConfig('generation', 'gemini')).toThrow(
      'Config not loaded'
    );
  });

  it('should override config with environment variables', async () => {
    const originalEnv = process.env.PICTURA_GEMINI_API_KEY;
    process.env.PICTURA_GEMINI_API_KEY = 'env-api-key';

    try {
      const config = {
        providers: {
          generation: {
            default: 'gemini',
            gemini: { apiKey: 'file-api-key' },
          },
          upscale: { default: 'topaz' },
        },
      };
      await fs.writeFile(configPath, JSON.stringify(config));

      const manager = new ConfigManager(configPath);
      await manager.load();

      const geminiConfig = manager.getProviderConfig('generation', 'gemini');
      expect(geminiConfig.apiKey).toBe('env-api-key');
    } finally {
      if (originalEnv) {
        process.env.PICTURA_GEMINI_API_KEY = originalEnv;
      } else {
        delete process.env.PICTURA_GEMINI_API_KEY;
      }
    }
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

  it('should accept valid ratios', () => {
    const result = ConfigSchema.parse({
      providers: {
        generation: { default: 'gemini' },
        upscale: { default: 'topaz' },
      },
      defaultRatio: '9:16',
    });

    expect(result.defaultRatio).toBe('9:16');
  });

  it('should reject invalid ratios', () => {
    expect(() =>
      ConfigSchema.parse({
        providers: {
          generation: { default: 'gemini' },
          upscale: { default: 'topaz' },
        },
        defaultRatio: '5:3',
      })
    ).toThrow();
  });

  it('should validate provider defaults', () => {
    expect(() =>
      ConfigSchema.parse({
        providers: {
          generation: { default: 'invalid-provider' },
          upscale: { default: 'topaz' },
        },
      })
    ).toThrow();
  });

  it('should set default output directory', () => {
    const result = ConfigSchema.parse({
      providers: {
        generation: { default: 'gemini' },
        upscale: { default: 'topaz' },
      },
    });

    expect(result.outputDir).toBe('.claude/plugins/maccing/pictura/output');
  });

  it('should validate retry attempts range', () => {
    // Valid range
    expect(
      ConfigSchema.parse({
        providers: {
          generation: { default: 'gemini' },
          upscale: { default: 'topaz' },
        },
        retryAttempts: 5,
      }).retryAttempts
    ).toBe(5);

    // Below minimum
    expect(() =>
      ConfigSchema.parse({
        providers: {
          generation: { default: 'gemini' },
          upscale: { default: 'topaz' },
        },
        retryAttempts: 0,
      })
    ).toThrow();

    // Above maximum
    expect(() =>
      ConfigSchema.parse({
        providers: {
          generation: { default: 'gemini' },
          upscale: { default: 'topaz' },
        },
        retryAttempts: 11,
      })
    ).toThrow();
  });
});
