import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { z } from 'zod';
import { RatioSchema } from '../provider-spec/factory.js';

// ============================================================================
// Scoped Configuration Types
// ============================================================================

export type ConfigScope = 'user' | 'project';

export interface ScopedConfig {
  config: PicturaConfig;
  sources: Record<string, ConfigScope | 'default' | 'env'>;
}

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

    const providers = this.cachedConfig.providers[type] as Record<string, unknown>;
    const providerConfig = providers[name];
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

  /**
   * Get the path to the config file
   */
  getConfigPath(): string {
    return this.configPath;
  }
}

// ============================================================================
// Scoped Config Manager
// ============================================================================

/**
 * ScopedConfigManager manages configuration across user and project scopes.
 *
 * Scope Locations:
 * - User scope: ~/.claude/plugins/maccing/pictura/config.json
 * - Project scope: .claude/plugins/maccing/pictura/config.json
 *
 * Precedence (highest to lowest):
 * 1. Environment variables (PICTURA_*_API_KEY)
 * 2. Project scope config
 * 3. User scope config
 * 4. Schema defaults
 */
export class ScopedConfigManager {
  private userConfigPath: string;
  private projectConfigPath: string;
  private userManager: ConfigManager;
  private projectManager: ConfigManager;
  private cachedMerged: ScopedConfig | null = null;

  constructor(projectRoot: string = process.cwd()) {
    this.userConfigPath = path.join(
      os.homedir(),
      '.claude/plugins/maccing/pictura/config.json'
    );
    this.projectConfigPath = path.join(
      projectRoot,
      '.claude/plugins/maccing/pictura/config.json'
    );
    this.userManager = new ConfigManager(this.userConfigPath);
    this.projectManager = new ConfigManager(this.projectConfigPath);
  }

  /**
   * Get the user scope config path
   */
  getUserConfigPath(): string {
    return this.userConfigPath;
  }

  /**
   * Get the project scope config path
   */
  getProjectConfigPath(): string {
    return this.projectConfigPath;
  }

  /**
   * Check if any config exists (user or project)
   */
  async existsAny(): Promise<boolean> {
    const [userExists, projectExists] = await Promise.all([
      this.userManager.exists(),
      this.projectManager.exists(),
    ]);
    return userExists || projectExists;
  }

  /**
   * Check if config exists for a specific scope
   */
  async existsInScope(scope: ConfigScope): Promise<boolean> {
    const manager = scope === 'user' ? this.userManager : this.projectManager;
    return manager.exists();
  }

  /**
   * Load and merge configs from all scopes with proper precedence.
   * Returns the merged config along with source tracking for each key.
   */
  async loadMerged(): Promise<ScopedConfig> {
    if (this.cachedMerged) {
      return this.cachedMerged;
    }

    const sources: Record<string, ConfigScope | 'default' | 'env'> = {};

    // Start with defaults
    const defaultConfig = this.getDefaults();
    Object.keys(defaultConfig).forEach((key) => {
      sources[key] = 'default';
    });

    let merged = { ...defaultConfig };

    // Layer user config if exists
    if (await this.userManager.exists()) {
      try {
        const userConfig = await this.userManager.load();
        merged = this.deepMerge(merged, userConfig, sources, 'user');
      } catch {
        // User config exists but is invalid, skip it
      }
    }

    // Layer project config if exists (higher precedence)
    if (await this.projectManager.exists()) {
      try {
        const projectConfig = await this.projectManager.load();
        merged = this.deepMerge(merged, projectConfig, sources, 'project');
      } catch {
        // Project config exists but is invalid, skip it
      }
    }

    // Apply environment variable overrides (highest precedence)
    this.applyEnvOverrides(merged, sources);

    // Validate the merged config
    const validated = ConfigSchema.parse(merged);

    // Force outputDir to always be project-local (never from user scope)
    // Generated images are project assets, not shared across projects
    validated.outputDir = '.claude/plugins/maccing/pictura/output';
    sources['outputDir'] = 'default';

    this.cachedMerged = { config: validated, sources };
    return this.cachedMerged;
  }

  /**
   * Save configuration to a specific scope
   */
  async saveToScope(scope: ConfigScope, config: Partial<PicturaConfig>): Promise<void> {
    const manager = scope === 'user' ? this.userManager : this.projectManager;
    await manager.save(config as PicturaConfig);
    this.clearCache();
  }

  /**
   * Get provider-specific config with environment variable overrides.
   * Must call loadMerged() first.
   */
  getProviderConfig(type: 'generation' | 'upscale', name: string): Record<string, unknown> {
    if (!this.cachedMerged) {
      throw new Error('Config not loaded. Call loadMerged() first.');
    }

    const providers = this.cachedMerged.config.providers[type] as Record<string, unknown>;
    const providerConfig = providers[name];
    const config = (providerConfig as Record<string, unknown>) || {};

    // Environment variables take precedence
    const envKey = this.getEnvKeyForProvider(name);
    if (envKey && process.env[envKey]) {
      return { ...config, apiKey: process.env[envKey] };
    }

    return config;
  }

  /**
   * Clear the cached merged config
   */
  clearCache(): void {
    this.cachedMerged = null;
    this.userManager.clearCache();
    this.projectManager.clearCache();
  }

  /**
   * Get default configuration
   */
  private getDefaults(): PicturaConfig {
    return {
      providers: {
        generation: { default: 'gemini' as const },
        upscale: { default: 'topaz' as const },
      },
      defaultRatio: '16:9' as const,
      defaultQuality: 'pro' as const,
      imageSize: '2K' as const,
      defaultConsistency: 'generate' as const,
      retryAttempts: 3,
      outputDir: '.claude/plugins/maccing/pictura/output',
    };
  }

  /**
   * Deep merge source config into target, tracking sources
   */
  private deepMerge(
    target: PicturaConfig,
    source: Partial<PicturaConfig>,
    sources: Record<string, ConfigScope | 'default' | 'env'>,
    scope: ConfigScope
  ): PicturaConfig {
    const result = { ...target };

    for (const key of Object.keys(source) as (keyof PicturaConfig)[]) {
      const sourceValue = source[key];
      if (sourceValue === undefined) continue;

      if (key === 'providers' && typeof sourceValue === 'object') {
        // Deep merge providers
        result.providers = this.mergeProviders(
          result.providers,
          sourceValue as typeof result.providers,
          sources,
          scope
        );
        sources['providers'] = scope;
      } else {
        (result as Record<string, unknown>)[key] = sourceValue;
        sources[key] = scope;
      }
    }

    return result;
  }

  /**
   * Merge provider configurations
   */
  private mergeProviders(
    target: PicturaConfig['providers'],
    source: Partial<PicturaConfig['providers']>,
    sources: Record<string, ConfigScope | 'default' | 'env'>,
    scope: ConfigScope
  ): PicturaConfig['providers'] {
    const result = { ...target };

    if (source.generation) {
      result.generation = { ...result.generation, ...source.generation };
      sources['providers.generation'] = scope;
    }

    if (source.upscale) {
      result.upscale = { ...result.upscale, ...source.upscale };
      sources['providers.upscale'] = scope;
    }

    return result;
  }

  /**
   * Apply environment variable overrides to config
   */
  private applyEnvOverrides(
    config: PicturaConfig,
    sources: Record<string, ConfigScope | 'default' | 'env'>
  ): void {
    const envMappings = [
      { env: 'PICTURA_GEMINI_API_KEY', path: ['providers', 'generation', 'gemini', 'apiKey'] },
      { env: 'PICTURA_OPENAI_API_KEY', path: ['providers', 'generation', 'openai', 'apiKey'] },
      { env: 'PICTURA_TOPAZ_API_KEY', path: ['providers', 'upscale', 'topaz', 'apiKey'] },
      { env: 'PICTURA_REPLICATE_API_KEY', path: ['providers', 'upscale', 'replicate', 'apiKey'] },
    ];

    for (const { env, path: keyPath } of envMappings) {
      const value = process.env[env];
      if (value) {
        this.setNestedValue(config, keyPath, value);
        sources[keyPath.join('.')] = 'env';
      }
    }
  }

  /**
   * Set a nested value in an object by path
   */
  private setNestedValue(obj: Record<string, unknown>, path: string[], value: unknown): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[path[path.length - 1]] = value;
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
}
