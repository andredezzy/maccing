import {
  createUpscaleProvider,
  type UpscaleProviderSpec,
  type UpscaleImageParams,
  type ImageResult,
} from '../provider-spec/factory.js';

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
    // For now, stub implementation
    const stubData = Buffer.from(`topaz-${model}-${scale}x-${Date.now()}`);

    return {
      data: stubData,
      ratio: '16:9',
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
  maxAttempts = 30
): Promise<ImageResult> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const delay = Math.min(2000 * Math.pow(1.5, attempts), 30000);
    await sleep(delay);

    const response = await fetch(`https://api.topazlabs.com/v1/jobs/${jobId}`, {
      headers: { 'X-API-Key': apiKey },
    });

    if (!response.ok) {
      throw new Error(`Failed to check job status: ${response.status}`);
    }

    const result = await response.json() as {
      state: string;
      output?: { image: string; width: number; height: number; model: string };
      error?: string;
    };

    if (result.state === 'completed' && result.output) {
      return {
        data: Buffer.from(result.output.image, 'base64'),
        ratio: '16:9',
        width: result.output.width,
        height: result.output.height,
        provider: 'topaz',
        model: result.output.model,
      };
    }

    if (result.state === 'failed') {
      throw new Error(`Topaz enhancement failed: ${result.error || 'Unknown error'}`);
    }

    attempts++;
  }

  throw new Error(`Topaz job timed out after ${maxAttempts} polling attempts`);
}

export const topaz = createUpscaleProvider(topazSpec);
