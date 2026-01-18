import type {
  UpscaleProviderFunction,
  UpscaleImageParams,
  ImageResult,
} from './provider-spec/factory.js';

// Upscale provider registry
const upscaleProviderRegistry = new Map<string, UpscaleProviderFunction>();

export function registerUpscaleProvider(provider: UpscaleProviderFunction): void {
  upscaleProviderRegistry.set(provider.name, provider);
}

export function clearUpscaleProviderRegistry(): void {
  upscaleProviderRegistry.clear();
}

export function getUpscaleProvider(name: string): UpscaleProviderFunction | undefined {
  return upscaleProviderRegistry.get(name);
}

export interface UpscaleOptions {
  image: Buffer;
  scale?: number;
  model?: string;
  provider: string;
  config: Record<string, unknown>;
}

/**
 * Upscale an image using the specified provider.
 */
export async function upscaleImage(options: UpscaleOptions): Promise<ImageResult> {
  const { image, scale = 4, model, provider: providerName, config } = options;

  const provider = upscaleProviderRegistry.get(providerName);
  if (!provider) {
    throw new Error(`Upscale provider not registered: ${providerName}`);
  }

  const params: UpscaleImageParams = {
    image,
    scale,
    model,
  };

  return provider.upscale(params, config);
}
