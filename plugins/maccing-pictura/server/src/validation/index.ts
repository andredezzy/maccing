// ============================================================================
// Validation Runner: Orchestrates four-layer validation and generates reports
// ============================================================================

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ValidationResult, ValidationContext } from './checks.js';
import {
  checkConfigExists,
  checkConfigPermissions,
  checkOutputDirectory,
  checkMCPToolsRegistered,
  checkGeminiConnection,
  checkOpenAIConnection,
  checkTopazConnection,
  smokeTestPromptEnhancement,
  smokeTestRetryLogic,
  smokeTestOutputManager,
  smokeTestConfigManager,
} from './checks.js';

// ============================================================================
// Types
// ============================================================================

export interface ValidationReport {
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
    duration: number;
  };
  results: {
    preflight: ValidationResult[];
    toolDiscovery: ValidationResult[];
    providerHealth: ValidationResult[];
    smokeTests: ValidationResult[];
  };
  productionReady: boolean;
  blockers: string[];
  recommendations: string[];
}

export interface ValidationOptions {
  skipProviders?: boolean;
  skipSmokeTests?: boolean;
}

// ============================================================================
// Validation Runner
// ============================================================================

/**
 * Run the complete four-layer validation suite
 *
 * @param configPath Path to the pictura config file
 * @param options Optional validation options
 * @returns Validation report with all results
 */
export async function runValidation(
  configPath: string,
  options: ValidationOptions = {}
): Promise<ValidationReport> {
  const startTime = Date.now();

  // Build validation context
  const ctx = await buildValidationContext(configPath);

  // Layer 1: Pre-flight Checks
  const preflightResults = await runPreflightChecks(ctx);

  // Layer 2: Tool Discovery
  const toolDiscoveryResults = await runToolDiscovery();

  // Layer 3: Provider Health (optional)
  const providerHealthResults = options.skipProviders ? [] : await runProviderHealthChecks(ctx);

  // Layer 4: Smoke Tests (optional)
  const smokeTestResults = options.skipSmokeTests ? [] : await runSmokeTests();

  // Build report
  const allResults = [
    ...preflightResults,
    ...toolDiscoveryResults,
    ...providerHealthResults,
    ...smokeTestResults,
  ];

  const summary = calculateSummary(allResults, Date.now() - startTime);
  const blockers = extractBlockers(allResults);
  const recommendations = extractRecommendations(allResults);

  return {
    timestamp: new Date().toISOString(),
    summary,
    results: {
      preflight: preflightResults,
      toolDiscovery: toolDiscoveryResults,
      providerHealth: providerHealthResults,
      smokeTests: smokeTestResults,
    },
    productionReady: blockers.length === 0,
    blockers,
    recommendations,
  };
}

// ============================================================================
// Context Builder
// ============================================================================

async function buildValidationContext(configPath: string): Promise<ValidationContext> {
  const ctx: ValidationContext = {
    configPath,
    outputDir: path.join(process.cwd(), 'pictura-output'),
    providers: {},
  };

  // Try to load config to get provider keys
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    if (config.providers?.gemini?.apiKey) {
      ctx.providers.gemini = { apiKey: config.providers.gemini.apiKey };
    }
    if (config.providers?.openai?.apiKey) {
      ctx.providers.openai = { apiKey: config.providers.openai.apiKey };
    }
    if (config.providers?.topaz?.apiKey) {
      ctx.providers.topaz = { apiKey: config.providers.topaz.apiKey };
    }
    if (config.output?.directory) {
      ctx.outputDir = config.output.directory;
    }
  } catch {
    // Config doesn't exist or is invalid, use defaults
  }

  return ctx;
}

// ============================================================================
// Layer Runners
// ============================================================================

async function runPreflightChecks(ctx: ValidationContext): Promise<ValidationResult[]> {
  return Promise.all([
    checkConfigExists(ctx),
    checkConfigPermissions(ctx),
    checkOutputDirectory(ctx),
  ]);
}

async function runToolDiscovery(): Promise<ValidationResult[]> {
  return Promise.all([checkMCPToolsRegistered()]);
}

async function runProviderHealthChecks(ctx: ValidationContext): Promise<ValidationResult[]> {
  return Promise.all([
    checkGeminiConnection(ctx),
    checkOpenAIConnection(ctx),
    checkTopazConnection(ctx),
  ]);
}

async function runSmokeTests(): Promise<ValidationResult[]> {
  return Promise.all([
    smokeTestPromptEnhancement(),
    smokeTestRetryLogic(),
    smokeTestOutputManager(),
    smokeTestConfigManager(),
  ]);
}

// ============================================================================
// Report Helpers
// ============================================================================

function calculateSummary(
  results: ValidationResult[],
  duration: number
): ValidationReport['summary'] {
  return {
    total: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status === 'fail').length,
    warnings: results.filter((r) => r.status === 'warn').length,
    skipped: results.filter((r) => r.status === 'skip').length,
    duration,
  };
}

function extractBlockers(results: ValidationResult[]): string[] {
  return results.filter((r) => r.status === 'fail').map((r) => `${r.name}: ${r.message}`);
}

function extractRecommendations(results: ValidationResult[]): string[] {
  const recommendations: string[] = [];

  for (const result of results) {
    if (result.remediation && (result.status === 'fail' || result.status === 'warn')) {
      recommendations.push(`${result.name}: ${result.remediation}`);
    }
  }

  return recommendations;
}

// ============================================================================
// Report Formatter
// ============================================================================

/**
 * Format a validation report as a styled string for CLI output
 *
 * Uses maccing output patterns:
 * - ★ for headers
 * - ◎ for sections
 * - ✓ for pass
 * - ✖ for fail
 * - ▲ for warn
 * - ○ for skip
 */
export function formatReport(report: ValidationReport): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push('`★ pictura-validation ══════════════════════════════════`');
  lines.push('');

  // Timestamp and summary
  const timestamp = new Date(report.timestamp).toLocaleString();
  lines.push(`Timestamp: ${timestamp}`);
  lines.push(`Duration:  ${report.summary.duration}ms`);
  lines.push('');

  // Summary stats
  lines.push('`◎ Summary ─────────────────────────────────────────────`');
  lines.push('');
  lines.push(`Total:    ${report.summary.total}`);
  lines.push(`Passed:   ${report.summary.passed} ✓`);
  lines.push(`Failed:   ${report.summary.failed} ✖`);
  lines.push(`Warnings: ${report.summary.warnings} ▲`);
  lines.push(`Skipped:  ${report.summary.skipped} ○`);
  lines.push('');

  // Production ready status
  if (report.productionReady) {
    lines.push('Status: ✓ PRODUCTION READY');
  } else {
    lines.push('Status: ✖ NOT PRODUCTION READY');
  }
  lines.push('');

  // Layer 1: Pre-flight
  lines.push('`◎ Layer 1: Pre-flight Checks ──────────────────────────`');
  lines.push('');
  for (const result of report.results.preflight) {
    lines.push(formatResultLine(result));
  }
  lines.push('');

  // Layer 2: Tool Discovery
  lines.push('`◎ Layer 2: Tool Discovery ─────────────────────────────`');
  lines.push('');
  for (const result of report.results.toolDiscovery) {
    lines.push(formatResultLine(result));
  }
  lines.push('');

  // Layer 3: Provider Health
  if (report.results.providerHealth.length > 0) {
    lines.push('`◎ Layer 3: Provider Health ────────────────────────────`');
    lines.push('');
    for (const result of report.results.providerHealth) {
      lines.push(formatResultLine(result));
    }
    lines.push('');
  }

  // Layer 4: Smoke Tests
  if (report.results.smokeTests.length > 0) {
    lines.push('`◎ Layer 4: Smoke Tests ────────────────────────────────`');
    lines.push('');
    for (const result of report.results.smokeTests) {
      lines.push(formatResultLine(result));
    }
    lines.push('');
  }

  // Blockers
  if (report.blockers.length > 0) {
    lines.push('`◎ Blockers ────────────────────────────────────────────`');
    lines.push('');
    for (const blocker of report.blockers) {
      lines.push(`✖ ${blocker}`);
    }
    lines.push('');
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('`◎ Recommendations ─────────────────────────────────────`');
    lines.push('');
    for (const rec of report.recommendations) {
      lines.push(`▲ ${rec}`);
    }
    lines.push('');
  }

  // Footer
  lines.push('`════════════════════════════════════════════════════════`');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format a single validation result line
 */
function formatResultLine(result: ValidationResult): string {
  const icon = getStatusIcon(result.status);
  const duration = result.duration ? ` (${result.duration}ms)` : '';
  return `${icon} ${result.name}: ${result.message}${duration}`;
}

/**
 * Get the status icon for a validation result
 */
function getStatusIcon(status: ValidationResult['status']): string {
  switch (status) {
    case 'pass':
      return '✓';
    case 'fail':
      return '✖';
    case 'warn':
      return '▲';
    case 'skip':
      return '○';
  }
}

// ============================================================================
// Exports
// ============================================================================

export type { ValidationResult, ValidationContext } from './checks.js';
export {
  checkConfigExists,
  checkConfigPermissions,
  checkOutputDirectory,
  checkMCPToolsRegistered,
  checkGeminiConnection,
  checkOpenAIConnection,
  checkTopazConnection,
  smokeTestPromptEnhancement,
  smokeTestRetryLogic,
  smokeTestOutputManager,
  smokeTestConfigManager,
} from './checks.js';

// ============================================================================
// CLI Entry Point
// ============================================================================

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const configPath = process.argv[2] || '.claude/plugins/maccing/pictura/config.json';
  runValidation(configPath)
    .then((report) => {
      console.log(formatReport(report));
      process.exit(report.productionReady ? 0 : 1);
    })
    .catch((error) => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}
