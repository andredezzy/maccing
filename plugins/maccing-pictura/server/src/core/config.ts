import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { RatioSchema } from '../provider-spec/factory';

// ============================================================================
// Provider Config Schemas
// ============================================================================

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

// ============================================================================
// Main Config Schema
// ============================================================================

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

// ============================================================================
// Preset Bundles
// ============================================================================

export const PRESET_BUNDLES = {
  social: ['1:1', '9:16', '16:9'] as const,
  web: ['16:9', '4:3', '1:1'] as const,
  portrait: ['2:3', '3:4', '4:5', '9:16'] as const,
  landscape: ['3:2', '4:3', '16:9', '21:9'] as const,
  print: ['2:3', '3:4', '4:5'] as const,
} as const;

export type PresetBundle = keyof typeof PRESET_BUNDLES;

// ============================================================================
// Config Manager
// ============================================================================

export class ConfigManager {
  private configPath: string;
  private cachedConfig: PicturaConfig | null = null;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  /**
   * Check if config file exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load config from file, applying defaults via schema validation.
   * Returns cached config if already loaded.
   */
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

  /**
   * Save config to file with secure permissions (0o600).
   * Creates parent directories if needed.
   */
  async save(config: Partial<PicturaConfig>): Promise<void> {
    const validated = ConfigSchema.parse(config);
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(validated, null, 2));
    await fs.chmod(this.configPath, 0o600);
    this.cachedConfig = validated;
  }

  /**
   * Clear the cached config, forcing a reload on next load() call
   */
  clearCache(): void {
    this.cachedConfig = null;
  }

  /**
   * Get provider-specific config, with environment variable overrides.
   * Must call load() first.
   */
  getProviderConfig(type: 'generation' | 'upscale', name: string): Record<string, unknown> {
    if (!this.cachedConfig) {
      throw new Error('Config not loaded');
    }

    const providerConfig = this.cachedConfig.providers[type][
      name as keyof typeof this.cachedConfig.providers.generation
    ];
    const config = (providerConfig as Record<string, unknown>) || {};

    // Environment variables take precedence over config file
    const envKey = this.getEnvKeyForProvider(name);
    if (envKey && process.env[envKey]) {
      return { ...config, apiKey: process.env[envKey] };
    }

    return config;
  }

  /**
   * Map provider name to environment variable key
   */
  private getEnvKeyForProvider(name: string): string | null {
    const envMap: Record<string, string> = {
      gemini: 'PICTURA_GEMINI_API_KEY',
      openai: 'PICTURA_OPENAI_API_KEY',
      topaz: 'PICTURA_TOPAZ_API_KEY',
      replicate: 'PICTURA_REPLICATE_API_KEY',
    };
    return envMap[name] || null;
  }

  /**
   * Verify config file has secure permissions.
   * Logs a warning if permissions are too open.
   */
  async verifyPermissions(): Promise<void> {
    try {
      const stats = await fs.stat(this.configPath);
      const mode = stats.mode & 0o777;
      if (mode !== 0o600) {
        console.warn(
          `Warning: Config file has insecure permissions (${mode.toString(8)}). Expected 600.`
        );
      }
    } catch {
      // File doesn't exist yet, permissions will be set on save
    }
  }
}
