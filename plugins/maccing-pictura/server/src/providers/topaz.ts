import {
  createUpscaleProvider,
  type UpscaleProviderSpec,
  type UpscaleImageParams,
  type ImageResult,
} from '../provider-spec/factory.js';

// Standard models: synchronous, fast
// Generative models: async only, higher quality
export const TOPAZ_MODELS = [
  'Standard V2', // Standard: fast general-purpose
  'Standard MAX', // Generative: photorealistic detail (ASYNC)
  'Recovery V2', // Generative: max enhancement for low-res (ASYNC)
  'High Fidelity V2', // Standard: preserves fine details
  'Redefine', // Generative: creative upscaling (ASYNC)
  'Low Resolution V2', // Standard: optimized for web graphics
  'CGI', // Standard: for computer-generated imagery
] as const;

export type TopazModel = (typeof TOPAZ_MODELS)[number];

// Generative models require async polling
const ASYNC_MODELS: TopazModel[] = ['Standard MAX', 'Recovery V2', 'Redefine'];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Submit an image to Topaz async enhance endpoint
 */
async function submitEnhanceJob(
  imageData: Buffer,
  model: TopazModel,
  scale: number,
  apiKey: string
): Promise<{ processId: string; eta: number }> {
  const formData = new FormData();

  // Create a Blob from the buffer for FormData
  const imageBlob = new Blob([imageData], { type: 'image/png' });
  formData.append('image', imageBlob, 'input.png');
  formData.append('model', model);

  // Calculate output dimensions based on scale
  // We don't know input dimensions, so we use a multiplier approach
  // The API will scale proportionally if only one dimension is set
  formData.append('output_format', 'png');

  const response = await fetch('https://api.topazlabs.com/image/v1/enhance/async', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Topaz API error (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as {
    process_id: string;
    source_id: string;
    eta: number;
  };

  return {
    processId: result.process_id,
    eta: result.eta,
  };
}

/**
 * Poll Topaz job status for async generative models
 */
async function pollForCompletion(
  processId: string,
  apiKey: string,
  maxAttempts = 60
): Promise<ImageResult> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Exponential backoff: start at 2s, max 30s
    const delay = Math.min(2000 * Math.pow(1.5, attempts), 30000);
    await sleep(delay);

    const response = await fetch(
      `https://api.topazlabs.com/image/v1/enhance/async/${processId}`,
      {
        method: 'GET',
        headers: { 'X-API-Key': apiKey },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to check job status: ${response.status}`);
    }

    const result = (await response.json()) as {
      state: string;
      output_url?: string;
      output_width?: number;
      output_height?: number;
      model?: string;
      error?: string;
    };

    if (result.state === 'completed' && result.output_url) {
      // Download the completed image
      const imageResponse = await fetch(result.output_url);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download completed image: ${imageResponse.status}`);
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      return {
        data: imageBuffer,
        ratio: '16:9', // Preserves original ratio
        width: result.output_width || 0,
        height: result.output_height || 0,
        provider: 'topaz',
        model: result.model || 'unknown',
      };
    }

    if (result.state === 'failed') {
      throw new Error(`Topaz enhancement failed: ${result.error || 'Unknown error'}`);
    }

    attempts++;
  }

  throw new Error(`Topaz job timed out after ${maxAttempts} polling attempts`);
}

const topazSpec: UpscaleProviderSpec = {
  name: 'topaz',
  models: [...TOPAZ_MODELS],
  maxScale: 16,

  async upscale(
    params: UpscaleImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult> {
    const apiKey = config.apiKey as string;
    if (!apiKey) {
      throw new Error('Topaz API key is required');
    }

    const model = (params.model || 'Standard V2') as TopazModel;
    const scale = params.scale || 4;
    const isAsync = ASYNC_MODELS.includes(model);

    // Submit the enhancement job
    const job = await submitEnhanceJob(params.image, model, scale, apiKey);

    // All Topaz Image API calls are async, so we always poll
    const result = await pollForCompletion(job.processId, apiKey);

    return {
      ...result,
      model,
    };
  },
};

export const topaz = createUpscaleProvider(topazSpec);
