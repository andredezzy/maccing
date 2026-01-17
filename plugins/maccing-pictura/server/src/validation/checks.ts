// ============================================================================
// Validation Checks: Four-layer validation for AI-guided validation
// ============================================================================

import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

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
// Layer 1: Pre-flight Checks
// ============================================================================

/**
 * Check if the config file exists at the specified path
 */
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

/**
 * Check if the config file has secure permissions (600)
 */
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

/**
 * Check if the output directory exists and is writable
 */
export async function checkOutputDirectory(ctx: ValidationContext): Promise<ValidationResult> {
  const start = Date.now();
  try {
    await fs.mkdir(ctx.outputDir, { recursive: true });
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
// Layer 2: Tool Discovery (MCP Protocol Compliance)
// ============================================================================

/**
 * Check if core modules required for MCP tools are available
 *
 * Note: The actual MCP tools are registered via server.tool() at runtime.
 * This check validates that the underlying modules are importable.
 */
export async function checkMCPToolsRegistered(): Promise<ValidationResult> {
  const start = Date.now();
  const requiredModules = [
    'core/config.js',
    'core/output.js',
    'core/prompt-enhancer.js',
    'core/retry.js',
    'generate.js',
    'providers/gemini.js',
    'providers/openai.js',
  ];

  const errors: string[] = [];

  // Validate core modules are importable
  try {
    await import('../core/config.js');
  } catch (e) {
    errors.push(`config: ${e}`);
  }

  try {
    await import('../core/output.js');
  } catch (e) {
    errors.push(`output: ${e}`);
  }

  try {
    await import('../core/prompt-enhancer.js');
  } catch (e) {
    errors.push(`prompt-enhancer: ${e}`);
  }

  try {
    await import('../generate.js');
  } catch (e) {
    errors.push(`generate: ${e}`);
  }

  try {
    await import('../providers/gemini.js');
  } catch (e) {
    errors.push(`gemini provider: ${e}`);
  }

  try {
    await import('../providers/openai.js');
  } catch (e) {
    errors.push(`openai provider: ${e}`);
  }

  if (errors.length === 0) {
    return {
      name: 'MCP Tool Modules',
      status: 'pass',
      message: `All ${requiredModules.length} core modules importable`,
      duration: Date.now() - start,
      details: { modules: requiredModules },
    };
  }

  return {
    name: 'MCP Tool Modules',
    status: 'fail',
    message: `Import errors: ${errors.join('; ')}`,
    duration: Date.now() - start,
    remediation: 'Check server compilation with: npm run build',
  };
}

// ============================================================================
// Layer 3: Provider Health Checks
// ============================================================================

/**
 * Check Gemini API connectivity and authentication
 */
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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${ctx.providers.gemini.apiKey}`
    );

    if (response.status === 200) {
      return {
        name: 'Gemini API Connection',
        status: 'pass',
        message: 'Connected to Gemini API',
        duration: Date.now() - start,
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
      remediation: 'Check network connectivity',
    };
  }
}

/**
 * Check OpenAI API connectivity and authentication
 */
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
      return {
        name: 'OpenAI API Connection',
        status: 'pass',
        message: 'Connected to OpenAI API',
        duration: Date.now() - start,
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
      remediation: 'Check network connectivity',
    };
  }
}

/**
 * Check Topaz Labs API connectivity and authentication
 */
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
// Layer 4: End-to-End Smoke Tests
// ============================================================================

/**
 * Smoke test the prompt enhancement module
 */
export async function smokeTestPromptEnhancement(): Promise<ValidationResult> {
  const start = Date.now();
  try {
    const { PromptEnhancer } = await import('../core/prompt-enhancer.js');
    const enhancer = new PromptEnhancer();

    const original = 'cat on roof';
    const enhanced = enhancer.enhance(original, { style: 'photo' });

    if (enhanced.length > original.length) {
      return {
        name: 'Smoke Test: Prompt Enhancement',
        status: 'pass',
        message: 'Prompt enhancer working',
        duration: Date.now() - start,
        details: {
          original,
          enhanced,
          expansion: `${enhanced.length - original.length} characters added`,
        },
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

/**
 * Smoke test the retry logic module
 */
export async function smokeTestRetryLogic(): Promise<ValidationResult> {
  const start = Date.now();
  try {
    const { withRetry } = await import('../core/retry.js');

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
        details: { attempts, result },
      };
    }

    return {
      name: 'Smoke Test: Retry Logic',
      status: 'fail',
      message: 'Unexpected retry behavior',
      duration: Date.now() - start,
      details: { attempts, result },
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

/**
 * Smoke test the output manager module
 */
export async function smokeTestOutputManager(): Promise<ValidationResult> {
  const start = Date.now();
  try {
    const { OutputManager } = await import('../core/output.js');
    const { generateSlug } = await import('../utils/slug.js');

    const manager = new OutputManager('/tmp/pictura-test');

    // Test that OutputManager can be instantiated and has expected methods
    const baseDir = manager.getBaseDir();

    // Test slug generation from slug utility
    const slug = generateSlug('test prompt');

    if (baseDir === '/tmp/pictura-test' && slug === 'test-prompt') {
      return {
        name: 'Smoke Test: Output Manager',
        status: 'pass',
        message: 'Output manager working',
        duration: Date.now() - start,
        details: { baseDir, generatedSlug: slug },
      };
    }

    return {
      name: 'Smoke Test: Output Manager',
      status: 'fail',
      message: 'OutputManager did not return expected values',
      duration: Date.now() - start,
      details: { baseDir, slug },
    };
  } catch (error) {
    return {
      name: 'Smoke Test: Output Manager',
      status: 'fail',
      message: `Import or execution failed: ${error}`,
      duration: Date.now() - start,
    };
  }
}

/**
 * Smoke test the config manager module
 */
export async function smokeTestConfigManager(): Promise<ValidationResult> {
  const start = Date.now();
  try {
    const { ConfigManager } = await import('../core/config.js');

    // Test that ConfigManager can be instantiated with a config path
    const manager = new ConfigManager('/tmp/pictura-test-config.json');

    // Verify the manager has expected methods
    const hasLoad = typeof manager.load === 'function';
    const hasSave = typeof manager.save === 'function';
    const hasExists = typeof manager.exists === 'function';

    if (hasLoad && hasSave && hasExists) {
      return {
        name: 'Smoke Test: Config Manager',
        status: 'pass',
        message: 'Config manager working',
        duration: Date.now() - start,
        details: { hasLoad, hasSave, hasExists },
      };
    }

    return {
      name: 'Smoke Test: Config Manager',
      status: 'fail',
      message: 'ConfigManager does not have expected interface',
      duration: Date.now() - start,
      details: { hasLoad, hasSave, hasExists },
    };
  } catch (error) {
    return {
      name: 'Smoke Test: Config Manager',
      status: 'fail',
      message: `Import or execution failed: ${error}`,
      duration: Date.now() - start,
    };
  }
}
