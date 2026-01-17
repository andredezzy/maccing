#!/usr/bin/env node

/**
 * Pictura MCP Server: Image generation tooling for Claude Code
 *
 * This server exposes tools for generating, listing, editing, upscaling,
 * and viewing images through the Model Context Protocol.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import open from 'open';

import { ConfigManager, PRESET_BUNDLES, type PresetBundle, type PicturaConfig } from './core/config.js';
import { OutputManager, type BatchInfo } from './core/output.js';
import { PromptEnhancer, type StyleType } from './core/prompt-enhancer.js';
import { generateImages, registerProvider } from './generate.js';
import { SUPPORTED_RATIOS, type SupportedRatio, type ImageSize } from './provider-spec/factory.js';
import { generateSlug, generateTimestamp } from './utils/slug.js';
import { gemini } from './providers/gemini.js';
import { openai } from './providers/openai.js';
import { runValidation, formatReport } from './validation/index.js';

// ============================================================================
// Provider Registration
// ============================================================================

registerProvider(gemini);
registerProvider(openai);

// ============================================================================
// Configuration
// ============================================================================

const configPath = process.env.PICTURA_CONFIG || '.claude/plugins/maccing/pictura/config.json';
const configManager = new ConfigManager(configPath);

// ============================================================================
// Default Configuration
// ============================================================================

function getDefaultConfig(): PicturaConfig {
  return {
    providers: {
      generation: { default: 'gemini' as const },
      upscale: { default: 'topaz' as const },
    },
    defaultRatio: '16:9' as SupportedRatio,
    defaultQuality: 'pro' as const,
    imageSize: '2K' as ImageSize,
    defaultConsistency: 'generate' as const,
    retryAttempts: 3,
    outputDir: '.claude/plugins/maccing/pictura/output',
  };
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new McpServer({
  name: 'pictura',
  version: '1.0.0',
});

// ============================================================================
// Zod Schemas for Tool Parameters
// ============================================================================

const RatioSchema = z.enum(SUPPORTED_RATIOS);

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
});

const ListParamsSchema = z.object({
  limit: z.number().min(1).max(100).optional().describe('Maximum number of batches to return'),
  filter: z.string().optional().describe('Filter batches by slug substring'),
});

const EditParamsSchema = z.object({
  slug: z.string().describe('Slug of the batch to edit'),
  prompt: z.string().describe('Edit instruction prompt'),
  mask: z.string().optional().describe('Path to mask image for inpainting'),
  extend: z.enum(['top', 'bottom', 'left', 'right']).optional()
    .describe('Direction to extend/outpaint'),
  stylePath: z.string().optional().describe('Path to style reference image'),
});

const UpscaleParamsSchema = z.object({
  slug: z.string().describe('Slug of the batch to upscale'),
  topazModel: z.string().optional().describe('Topaz model to use for upscaling'),
  upscaler: z.enum(['topaz', 'replicate']).optional().describe('Upscale provider'),
  skipTopaz: z.boolean().optional().describe('Skip Topaz and use alternative upscaler'),
});

const GalleryParamsSchema = z.object({
  filter: z.string().optional().describe('Filter batches by slug substring'),
  since: z.string().optional().describe('Only show batches since this timestamp (YYYY-MM-DD)'),
});

const ValidateParamsSchema = z.object({
  mode: z.enum(['full', 'quick', 'provider']).optional().default('full')
    .describe('Validation mode: full (all checks), quick (pre-flight only), provider (specific provider)'),
  provider: z.enum(['gemini', 'openai', 'topaz']).optional()
    .describe('Specific provider to test (only with mode=provider)'),
});

const SetupParamsSchema = z.object({
  providers: z.object({
    generation: z.object({
      default: z.enum(['gemini', 'openai']).default('gemini'),
      gemini: z.object({
        apiKey: z.string(),
        defaultModel: z.enum(['flash', 'pro']).optional().default('pro'),
      }).optional(),
      openai: z.object({
        apiKey: z.string(),
      }).optional(),
    }),
    upscale: z.object({
      default: z.enum(['topaz', 'replicate']).default('topaz'),
      topaz: z.object({
        apiKey: z.string(),
        defaultModel: z.string().optional().default('standard-max'),
      }).optional(),
      replicate: z.object({
        apiKey: z.string(),
      }).optional(),
    }).optional(),
  }),
  defaults: z.object({
    ratio: z.string().optional().default('16:9'),
    quality: z.enum(['draft', 'pro']).optional().default('pro'),
    size: z.enum(['1K', '2K', '4K']).optional().default('2K'),
  }).optional(),
});

// ============================================================================
// Tool: pictura_generate
// ============================================================================

server.tool(
  'pictura_generate',
  'Generate images in multiple aspect ratios from a single prompt',
  GenerateParamsSchema.shape,
  async (params) => {
    const {
      prompt,
      ratios: inputRatios,
      preset,
      quality,
      size,
      provider: inputProvider,
      enhance,
      enhanceStyle,
    } = params;

    // Load config with defaults
    let config: PicturaConfig;
    try {
      if (await configManager.exists()) {
        config = await configManager.load();
      } else {
        config = getDefaultConfig();
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }

    // Determine ratios to generate
    let ratios: SupportedRatio[];
    if (preset) {
      ratios = [...PRESET_BUNDLES[preset as PresetBundle]] as SupportedRatio[];
    } else if (inputRatios && inputRatios.length > 0) {
      ratios = inputRatios as SupportedRatio[];
    } else {
      ratios = [config.defaultRatio];
    }

    // Determine provider
    const providerName = inputProvider || config.providers.generation.default;
    const providerConfig = configManager.getProviderConfig('generation', providerName);

    // Enhance prompt if requested
    let finalPrompt = prompt;
    if (enhance) {
      const enhancer = new PromptEnhancer();
      const style: StyleType = enhanceStyle || 'auto';
      finalPrompt = enhancer.enhance(prompt, { style });
    }

    // Generate slug and timestamp
    const slug = generateSlug(prompt);
    const timestamp = generateTimestamp();

    // Get model selector based on provider and quality
    const model = providerName === 'gemini'
      ? gemini(quality === 'draft' ? 'flash' : 'pro')
      : openai(quality === 'draft' ? 'gpt-image-1-mini' : 'gpt-image-1.5');

    const modelId = model.modelId;

    try {
      // Generate images for all ratios
      const results = await generateImages({
        model,
        prompt: finalPrompt,
        ratios,
        size: (size || config.imageSize) as ImageSize,
        config: providerConfig,
      });

      // Save images using OutputManager
      const outputManager = new OutputManager(config.outputDir);
      const savedPaths = await outputManager.saveBatch(results, slug, timestamp);

      // Build response
      const summary = results.map((result, i) => ({
        ratio: result.ratio,
        width: result.width,
        height: result.height,
        path: savedPaths[i],
      }));

      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `Generated ${results.length} image(s) for prompt: "${prompt}"`,
              '',
              `Slug: ${slug}`,
              `Timestamp: ${timestamp}`,
              `Provider: ${providerName}`,
              `Model: ${modelId}`,
              enhance ? `Enhanced prompt: "${finalPrompt}"` : '',
              '',
              'Images:',
              ...summary.map((s) => `  - ${s.ratio}: ${s.path} (${s.width}x${s.height})`),
            ].filter(Boolean).join('\n'),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Generation failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============================================================================
// Tool: pictura_list
// ============================================================================

server.tool(
  'pictura_list',
  'List recent image generation batches',
  ListParamsSchema.shape,
  async (params) => {
    const { limit = 10, filter } = params;

    let config: PicturaConfig;
    try {
      if (await configManager.exists()) {
        config = await configManager.load();
      } else {
        config = getDefaultConfig();
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }

    const outputManager = new OutputManager(config.outputDir);
    let batches = await outputManager.listBatches(limit);

    // Apply filter if provided
    if (filter) {
      batches = batches.filter((b) => b.slug.includes(filter.toLowerCase()));
    }

    if (batches.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No image batches found.',
          },
        ],
      };
    }

    const batchList = batches.map((b) => {
      const imageList = b.images.map((img) => `    - ${img.ratio}`).join('\n');
      return `${b.timestamp} | ${b.slug}\n${imageList}`;
    }).join('\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Found ${batches.length} batch(es):\n\n${batchList}`,
        },
      ],
    };
  }
);

// ============================================================================
// Tool: pictura_edit (Stub)
// ============================================================================

server.tool(
  'pictura_edit',
  'Edit an existing image batch (inpaint, outpaint, or style transfer)',
  EditParamsSchema.shape,
  async (params) => {
    const { slug, prompt, mask, extend, stylePath } = params;

    // TODO: Implement actual edit functionality
    // This would:
    // 1. Load the batch by slug
    // 2. Apply inpainting if mask is provided
    // 3. Apply outpainting if extend direction is provided
    // 4. Apply style transfer if stylePath is provided
    // 5. Save the edited images as a new batch

    return {
      content: [
        {
          type: 'text' as const,
          text: [
            'Edit functionality is not yet implemented.',
            '',
            'Requested edit:',
            `  Slug: ${slug}`,
            `  Prompt: ${prompt}`,
            mask ? `  Mask: ${mask}` : null,
            extend ? `  Extend: ${extend}` : null,
            stylePath ? `  Style: ${stylePath}` : null,
            '',
            'TODO: Implement edit operations including:',
            '  - Inpainting with mask',
            '  - Outpainting/extending images',
            '  - Style transfer from reference',
          ].filter(Boolean).join('\n'),
        },
      ],
    };
  }
);

// ============================================================================
// Tool: pictura_upscale (Stub)
// ============================================================================

server.tool(
  'pictura_upscale',
  'Upscale images using Topaz or alternative upscaler',
  UpscaleParamsSchema.shape,
  async (params) => {
    const { slug, topazModel = 'standard-max', upscaler = 'topaz', skipTopaz } = params;

    // TODO: Implement actual upscale functionality
    // This would:
    // 1. Load the batch by slug
    // 2. For each image in the batch:
    //    - If Topaz: submit to Topaz API, poll for completion
    //    - If Replicate: submit to Replicate API
    // 3. Save upscaled images as a new batch with "_upscaled" suffix

    return {
      content: [
        {
          type: 'text' as const,
          text: [
            'Upscale functionality is not yet implemented.',
            '',
            'Requested upscale:',
            `  Slug: ${slug}`,
            `  Upscaler: ${skipTopaz ? 'replicate' : upscaler}`,
            `  Model: ${topazModel}`,
            '',
            'TODO: Implement two-turn premium upscale workflow:',
            '  1. Load batch images',
            '  2. Submit to upscale provider (Topaz or Replicate)',
            '  3. Poll for completion (generative models are async)',
            '  4. Save upscaled images',
          ].join('\n'),
        },
      ],
    };
  }
);

// ============================================================================
// Tool: pictura_gallery
// ============================================================================

server.tool(
  'pictura_gallery',
  'Generate an HTML gallery of recent generations and open in browser',
  GalleryParamsSchema.shape,
  async (params) => {
    const { filter, since } = params;

    let config: PicturaConfig;
    try {
      if (await configManager.exists()) {
        config = await configManager.load();
      } else {
        config = getDefaultConfig();
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }

    const outputManager = new OutputManager(config.outputDir);
    let batches = await outputManager.listBatches(100);

    // Apply filter if provided
    if (filter) {
      batches = batches.filter((b) => b.slug.includes(filter.toLowerCase()));
    }

    // Apply since filter if provided
    if (since) {
      const sinceDate = since.replace(/-/g, '');
      batches = batches.filter((b) => {
        const batchDate = b.timestamp.substring(0, 10).replace(/-/g, '');
        return batchDate >= sinceDate;
      });
    }

    if (batches.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No batches found matching criteria.',
          },
        ],
      };
    }

    // Generate HTML gallery
    const html = generateGalleryHtml(batches, config.outputDir);

    // Write to temp file
    const galleryPath = path.join(config.outputDir, 'gallery.html');
    await fs.mkdir(path.dirname(galleryPath), { recursive: true });
    await fs.writeFile(galleryPath, html);

    // Open in browser
    try {
      await open(galleryPath);
    } catch {
      // Browser open failed, but we still have the file
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Gallery generated with ${batches.length} batch(es): ${galleryPath}`,
        },
      ],
    };
  }
);

// ============================================================================
// Tool: pictura_validate
// ============================================================================

server.tool(
  'pictura_validate',
  'Run comprehensive validation to verify pictura installation and configuration',
  ValidateParamsSchema.shape,
  async (params) => {
    try {
      const { mode } = params;
      const modeValue = mode || 'full';

      const options = {
        skipProviders: modeValue === 'quick',
        skipSmokeTests: modeValue === 'quick',
      };

      const report = await runValidation(configPath, options);

      const summary = [
        formatReport(report),
        '',
        '---',
        '',
        report.productionReady
          ? '✓ **PRODUCTION READY**: All critical checks passed.'
          : '✗ **NOT READY**: Please address the blockers above.',
      ];

      if (!report.productionReady && report.recommendations.length > 0) {
        summary.push('');
        summary.push('**Next Steps:**');
        report.recommendations.forEach((rec, i) => {
          summary.push(`${i + 1}. ${rec}`);
        });
      }

      return {
        content: [{ type: 'text' as const, text: summary.join('\n') }],
        isError: !report.productionReady,
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Validation failed: ${error}` }],
        isError: true,
      };
    }
  }
);

// ============================================================================
// Tool: pictura_setup
// ============================================================================

server.tool(
  'pictura_setup',
  'Create or update pictura configuration with API keys and preferences',
  SetupParamsSchema.shape,
  async (params) => {
    try {
      const parsed = SetupParamsSchema.parse(params);

      // Build config object
      const config = {
        providers: parsed.providers,
        defaultRatio: parsed.defaults?.ratio || '16:9',
        defaultQuality: parsed.defaults?.quality || 'pro',
        imageSize: parsed.defaults?.size || '2K',
        retryAttempts: 3,
        outputDir: '.claude/plugins/maccing/pictura/output',
      };

      // Create directory if needed
      const configDir = path.dirname(configPath);
      await fs.mkdir(configDir, { recursive: true });

      // Write config file
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      // Set secure permissions (user-only read/write)
      await fs.chmod(configPath, 0o600);

      // Build summary of what was configured
      const configured: string[] = [];
      if (parsed.providers.generation?.gemini) {
        configured.push('Gemini (generation)');
      }
      if (parsed.providers.generation?.openai) {
        configured.push('OpenAI (generation)');
      }
      if (parsed.providers.upscale?.topaz) {
        configured.push('Topaz Labs (upscale)');
      }

      const summary = [
        '✓ Configuration saved successfully',
        '',
        `Location: ${configPath}`,
        `Permissions: 600 (user-only)`,
        '',
        'Configured providers:',
        ...configured.map(p => `  - ${p}`),
        '',
        'Defaults:',
        `  - Ratio: ${config.defaultRatio}`,
        `  - Quality: ${config.defaultQuality}`,
        `  - Size: ${config.imageSize}`,
        '',
        'Next: Run /pictura:validate to verify configuration',
      ];

      return {
        content: [{ type: 'text', text: summary.join('\n') }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: 'text',
          text: `✖ Setup failed: ${message}\n\nPlease check:\n- Directory permissions\n- Valid JSON structure for API keys`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================================================
// Gallery HTML Generation
// ============================================================================

function generateGalleryHtml(batches: BatchInfo[], baseDir: string): string {
  const absoluteBaseDir = path.resolve(baseDir);

  const batchesHtml = batches.map((batch) => {
    const imagesHtml = batch.images.map((img) => {
      const absolutePath = path.resolve(img.path);
      return `
        <div class="image-card">
          <img src="file://${absolutePath}" alt="${batch.slug} - ${img.ratio}" loading="lazy" />
          <div class="image-info">${img.ratio}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="batch">
        <div class="batch-header">
          <h2>${batch.slug}</h2>
          <span class="timestamp">${batch.timestamp}</span>
        </div>
        <div class="images-grid">
          ${imagesHtml}
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pictura Gallery</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #fff;
      padding: 2rem;
    }
    h1 {
      text-align: center;
      margin-bottom: 2rem;
      color: #fff;
    }
    .batch {
      background: #2a2a2a;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .batch-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #444;
    }
    .batch-header h2 {
      font-size: 1.25rem;
      color: #fff;
    }
    .timestamp {
      color: #888;
      font-size: 0.875rem;
      font-family: monospace;
    }
    .images-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1rem;
    }
    .image-card {
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      background: #333;
    }
    .image-card img {
      width: 100%;
      height: auto;
      display: block;
    }
    .image-info {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.7);
      padding: 0.5rem;
      text-align: center;
      font-size: 0.875rem;
      color: #ccc;
    }
    .empty-state {
      text-align: center;
      padding: 4rem;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>Pictura Gallery</h1>
  ${batchesHtml || '<div class="empty-state">No images found</div>'}
</body>
</html>`;
}

// ============================================================================
// Server Startup
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Pictura MCP server started');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
