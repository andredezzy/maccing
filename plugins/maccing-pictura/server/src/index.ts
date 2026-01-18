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
import { editImage, type EditOperation } from './edit.js';
import { SUPPORTED_RATIOS, type SupportedRatio, type ImageSize } from './provider-spec/factory.js';
import { generateSlug, generateTimestamp } from './utils/slug.js';
import { gemini } from './providers/gemini.js';
import { openai } from './providers/openai.js';
import { topaz } from './providers/topaz.js';
import { runValidation, formatReport } from './validation/index.js';
import { upscaleImage, registerUpscaleProvider } from './upscale.js';

// ============================================================================
// Provider Registration
// ============================================================================

registerProvider(gemini);
registerProvider(openai);
registerUpscaleProvider(topaz);

// ============================================================================
// Configuration
// ============================================================================

const configPath = process.env.PICTURA_CONFIG || '.claude/plugins/maccing/pictura/config.json';
const configManager = new ConfigManager(configPath);

// Config file pattern to add to .gitignore (contains API keys)
const GITIGNORE_PATTERN = '.claude/plugins/maccing/pictura/config.json';

/**
 * Ensures the pictura config file is in .gitignore to prevent
 * accidental commits of API keys.
 *
 * @returns true if .gitignore was updated, false if pattern already exists
 */
async function ensureGitignore(): Promise<{ updated: boolean; created: boolean }> {
  const gitignorePath = '.gitignore';

  try {
    // Try to read existing .gitignore
    let content: string;
    let fileExists = true;

    try {
      content = await fs.readFile(gitignorePath, 'utf-8');
    } catch {
      // .gitignore doesn't exist
      content = '';
      fileExists = false;
    }

    // Check if pattern is already present
    const lines = content.split('\n');
    const hasPattern = lines.some(line => {
      const trimmed = line.trim();
      return trimmed === GITIGNORE_PATTERN ||
             trimmed === `/${GITIGNORE_PATTERN}`;
    });

    if (hasPattern) {
      return { updated: false, created: false };
    }

    // Add pattern to .gitignore
    const newContent = content.endsWith('\n') || content === ''
      ? `${content}# Pictura plugin config (contains API keys)\n${GITIGNORE_PATTERN}\n`
      : `${content}\n\n# Pictura plugin config (contains API keys)\n${GITIGNORE_PATTERN}\n`;

    await fs.writeFile(gitignorePath, newContent, 'utf-8');
    return { updated: true, created: !fileExists };
  } catch (error) {
    // Non-fatal: log but don't fail setup if gitignore update fails
    console.error('Warning: Could not update .gitignore:', error);
    return { updated: false, created: false };
  }
}

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
  ref: z.string().optional().describe('Path to reference image for visual consistency'),
  consistency: z.enum(['generate', 'reference', 'multiturn']).optional()
    .describe('Consistency strategy: generate (use first image), reference (use provided ref), multiturn (Claude describes each)'),
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
      ref,
      consistency,
    } = params;

    // Check if config exists (first-run detection)
    const configExists = await configManager.exists();
    if (!configExists) {
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              '★ Welcome to Pictura! ────────────────────────────────────',
              '',
              'Pictura needs to be configured before generating images.',
              '',
              'Quick Setup:',
              '  Run: /pictura:setup',
              '',
              'This will guide you through:',
              '  1. Selecting image providers (Gemini, OpenAI)',
              '  2. Entering your API keys',
              '  3. Setting default preferences',
              '',
              'Get a free Gemini API key at:',
              '  https://aistudio.google.com/apikey',
              '',
              '─────────────────────────────────────────────────────────────',
            ].join('\n'),
          },
        ],
        isError: false, // Not an error, just needs setup
      };
    }

    // Load config
    let config: PicturaConfig;
    try {
      config = await configManager.load();
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

    // Check if any generation provider is configured with API keys
    const hasGemini = config.providers?.generation?.gemini?.apiKey;
    const hasOpenai = config.providers?.generation?.openai?.apiKey;

    if (!hasGemini && !hasOpenai) {
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              '⚠ No generation provider configured',
              '',
              'Your config file exists but has no API keys for image generation.',
              '',
              'To add a provider:',
              '  Run: /pictura:setup --provider gemini',
              '',
              'Or manually edit: ' + configPath,
              '',
            ].join('\n'),
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

    // Load reference image if provided
    let referenceImage: Buffer | undefined;
    if (ref) {
      // Validate path to prevent traversal attacks
      const normalizedPath = path.normalize(ref);
      const resolvedPath = path.resolve(ref);
      const cwd = process.cwd();

      // Reject explicit path traversal sequences
      if (normalizedPath.includes('..')) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Invalid reference path: path traversal not allowed',
          }],
          isError: true,
        };
      }

      // Ensure resolved path is within the current working directory
      if (!resolvedPath.startsWith(cwd + path.sep) && resolvedPath !== cwd) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Invalid reference path: must be within project directory',
          }],
          isError: true,
        };
      }

      try {
        referenceImage = await fs.readFile(resolvedPath);
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

    try {
      // Generate images for all ratios
      const results = await generateImages({
        model,
        prompt: finalPrompt,
        ratios,
        size: (size || config.imageSize) as ImageSize,
        config: providerConfig,
        reference: referenceImage,
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
              ref ? `Reference image: ${ref}` : '',
              consistency ? `Consistency mode: ${consistency}` : '',
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
// Tool: pictura_edit
// ============================================================================

server.tool(
  'pictura_edit',
  'Edit an existing image batch (refine, inpaint, outpaint, or style transfer)',
  EditParamsSchema.shape,
  async (params) => {
    const { slug, prompt, mask, extend, stylePath } = params;

    // Check if config exists
    const configExists = await configManager.exists();
    if (!configExists) {
      return {
        content: [{
          type: 'text' as const,
          text: [
            '★ Pictura not configured ────────────────────────────────────',
            '',
            'Run /pictura:setup to configure Pictura before editing images.',
            '',
            '─────────────────────────────────────────────────────────────',
          ].join('\n'),
        }],
        isError: true,
      };
    }

    // Load config
    let config: PicturaConfig;
    try {
      config = await configManager.load();
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }

    // Find batch by slug
    const outputManager = new OutputManager(config.outputDir);
    const batch = await outputManager.loadBatch(slug);

    if (!batch) {
      return {
        content: [{
          type: 'text' as const,
          text: `Batch not found: ${slug}\n\nUse pictura_list to see available batches.`,
        }],
        isError: true,
      };
    }

    // Load style reference if provided
    let styleRef: Buffer | undefined;
    if (stylePath) {
      const normalizedPath = path.normalize(stylePath);
      const resolvedPath = path.resolve(stylePath);
      const cwd = process.cwd();

      // Reject explicit path traversal sequences
      if (normalizedPath.includes('..')) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Invalid style path: path traversal not allowed',
          }],
          isError: true,
        };
      }

      // Ensure resolved path is within the current working directory
      if (!resolvedPath.startsWith(cwd + path.sep) && resolvedPath !== cwd) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Invalid style path: must be within project directory',
          }],
          isError: true,
        };
      }

      try {
        styleRef = await fs.readFile(resolvedPath);
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Failed to read style image: ${stylePath}\nError: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }

    // Determine operation type
    let operation: EditOperation = 'refine';
    if (mask) {
      operation = 'inpaint';
    } else if (extend) {
      operation = 'outpaint';
    } else if (stylePath) {
      operation = 'restyle';
    }

    // Get provider and model
    const providerName = config.providers.generation.default;
    const providerConfig = configManager.getProviderConfig('generation', providerName);
    const model = providerName === 'gemini' ? gemini('pro') : openai('gpt-image-1.5');

    // Generate new slug and timestamp for edited batch
    const newSlug = `${slug}-edited`;
    const timestamp = generateTimestamp();

    // Process each image in the batch
    const editedImages: { ratio: string; path: string; width: number; height: number }[] = [];
    const errors: string[] = [];

    for (const img of batch.images) {
      try {
        // Read the source image
        const imageBuffer = await fs.readFile(img.path);

        // Edit the image
        const result = await editImage({
          model,
          image: imageBuffer,
          prompt,
          operation,
          ratio: img.ratio,
          mask,
          direction: extend,
          styleRef,
          config: providerConfig,
        });

        // Save the edited image
        const savedPath = await outputManager.saveImage(result, newSlug, timestamp);
        editedImages.push({
          ratio: img.ratio,
          path: savedPath,
          width: result.width,
          height: result.height,
        });
      } catch (error) {
        errors.push(`${img.ratio}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Build response
    if (editedImages.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: [
            'Edit failed for all images:',
            '',
            ...errors.map((e) => `  - ${e}`),
          ].join('\n'),
        }],
        isError: true,
      };
    }

    const summary = [
      `★ Edited ${editedImages.length} image(s) ════════════════════════════`,
      '',
      `Source batch: ${slug}`,
      `New batch: ${newSlug}`,
      `Timestamp: ${timestamp}`,
      `Operation: ${operation}`,
      `Provider: ${providerName}`,
      '',
      'Edited images:',
      ...editedImages.map((img) => `  - ${img.ratio}: ${img.path} (${img.width}x${img.height})`),
    ];

    if (errors.length > 0) {
      summary.push('', 'Warnings (some images failed):', ...errors.map((e) => `  - ${e}`));
    }

    summary.push('', '════════════════════════════════════════════════════════════');

    return {
      content: [{
        type: 'text' as const,
        text: summary.join('\n'),
      }],
    };
  }
);

// ============================================================================
// Tool: pictura_upscale
// ============================================================================

server.tool(
  'pictura_upscale',
  'Upscale images using Topaz or alternative upscaler',
  UpscaleParamsSchema.shape,
  async (params) => {
    const { slug, topazModel = 'standard-max', upscaler = 'topaz', skipTopaz } = params;

    // Check if config exists
    const configExists = await configManager.exists();
    if (!configExists) {
      return {
        content: [{
          type: 'text' as const,
          text: [
            '★ Pictura not configured ────────────────────────────────────',
            '',
            'Run /pictura:setup to configure Pictura before upscaling images.',
            '',
            '─────────────────────────────────────────────────────────────',
          ].join('\n'),
        }],
        isError: true,
      };
    }

    // Load config
    let config: PicturaConfig;
    try {
      config = await configManager.load();
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }

    // Check if Topaz is configured (unless skipTopaz)
    const providerName = skipTopaz ? 'replicate' : upscaler;
    if (!skipTopaz && providerName === 'topaz') {
      const topazConfig = config.providers?.upscale?.topaz;
      if (!topazConfig?.apiKey) {
        return {
          content: [{
            type: 'text' as const,
            text: [
              '⚠ Topaz not configured',
              '',
              'To use Topaz upscaling, add your API key:',
              '  Run: /pictura:setup with Topaz credentials',
              '',
              'Or use --skipTopaz to skip upscaling.',
            ].join('\n'),
          }],
          isError: true,
        };
      }
    }

    // Find batch by slug
    const outputManager = new OutputManager(config.outputDir);
    const batch = await outputManager.loadBatch(slug);

    if (!batch) {
      return {
        content: [{
          type: 'text' as const,
          text: `Batch not found: ${slug}\n\nUse pictura_list to see available batches.`,
        }],
        isError: true,
      };
    }

    // If skipTopaz, return the existing images (no upscaling performed)
    if (skipTopaz) {
      return {
        content: [{
          type: 'text' as const,
          text: [
            '★ Upscale skipped ════════════════════════════════════════════',
            '',
            `Source batch: ${slug}`,
            'Mode: skipTopaz (no upscaling performed)',
            '',
            'Original images:',
            ...batch.images.map((img) => `  - ${img.ratio}: ${img.path}`),
            '',
            '════════════════════════════════════════════════════════════════',
          ].join('\n'),
        }],
      };
    }

    // Get upscale provider config
    const providerConfig = configManager.getProviderConfig('upscale', providerName);

    // Generate new slug and timestamp for upscaled batch
    const scale = 4; // Default scale for Topaz
    const newSlug = `${slug}-${scale}x`;
    const timestamp = generateTimestamp();

    // Process each image in the batch
    const upscaledImages: { ratio: string; path: string; width: number; height: number }[] = [];
    const errors: string[] = [];

    for (const img of batch.images) {
      try {
        // Read the source image
        const imageBuffer = await fs.readFile(img.path);

        // Upscale the image
        const result = await upscaleImage({
          image: imageBuffer,
          scale,
          model: topazModel,
          provider: providerName,
          config: providerConfig,
        });

        // Save the upscaled image
        const savedPath = await outputManager.saveImage(result, newSlug, timestamp);
        upscaledImages.push({
          ratio: img.ratio,
          path: savedPath,
          width: result.width,
          height: result.height,
        });
      } catch (error) {
        errors.push(`${img.ratio}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Build response
    if (upscaledImages.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: [
            'Upscale failed for all images:',
            '',
            ...errors.map((e) => `  - ${e}`),
          ].join('\n'),
        }],
        isError: true,
      };
    }

    const summary = [
      `★ Upscaled ${upscaledImages.length} image(s) ════════════════════════`,
      '',
      `Source batch: ${slug}`,
      `New batch: ${newSlug}`,
      `Timestamp: ${timestamp}`,
      `Provider: ${providerName}`,
      `Model: ${topazModel}`,
      `Scale: ${scale}x`,
      '',
      'Upscaled images:',
      ...upscaledImages.map((img) => `  - ${img.ratio}: ${img.path} (${img.width}x${img.height})`),
    ];

    if (errors.length > 0) {
      summary.push('', 'Warnings (some images failed):', ...errors.map((e) => `  - ${e}`));
    }

    summary.push('', '════════════════════════════════════════════════════════════════');

    return {
      content: [{
        type: 'text' as const,
        text: summary.join('\n'),
      }],
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

      // Clear the config cache so subsequent tool calls read the updated config
      configManager.clearCache();

      // Ensure config directory is in .gitignore to protect API keys
      const gitignoreResult = await ensureGitignore();

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

      // Build gitignore status message
      let gitignoreStatus: string;
      if (gitignoreResult.created) {
        gitignoreStatus = '✓ Created .gitignore with config exclusion';
      } else if (gitignoreResult.updated) {
        gitignoreStatus = '✓ Updated .gitignore to exclude config';
      } else {
        gitignoreStatus = '✓ Config already excluded in .gitignore';
      }

      const summary = [
        '✓ Configuration saved successfully',
        '',
        `Location: ${configPath}`,
        `Permissions: 600 (user-only)`,
        gitignoreStatus,
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
