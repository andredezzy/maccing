import {
  type ModelSelector,
  type ModelWithFallbacks,
  type GenerateImageParams,
  type ImageProviderFunction,
  type ImageResult,
  type SupportedRatio,
  type ImageSize,
} from './provider-spec/factory.js';

// ============================================================================
// Types
// ============================================================================

export interface GenerateImageOptions {
  model: ModelWithFallbacks;
  prompt: string;
  ratio: SupportedRatio;
  size?: ImageSize;
  reference?: Buffer;
  negativePrompt?: string;
  config: Record<string, unknown>;
}

export interface GenerateImagesOptions extends Omit<GenerateImageOptions, 'ratio'> {
  ratios: SupportedRatio[];
}

// ============================================================================
// Provider Registry
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providerRegistry = new Map<string, ImageProviderFunction<any>>();

/**
 * Register a provider implementation for use with generateImage.
 * The provider is indexed by its name property.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerProvider(provider: ImageProviderFunction<any>): void {
  providerRegistry.set(provider.name, provider);
}

/**
 * Clear all registered providers.
 * Useful for testing to reset state between tests.
 */
export function clearProviderRegistry(): void {
  providerRegistry.clear();
}

/**
 * Get a registered provider by name.
 * Returns undefined if not found.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getProvider(name: string): ImageProviderFunction<any> | undefined {
  return providerRegistry.get(name);
}

// ============================================================================
// Generate Functions
// ============================================================================

/**
 * Generate a single image using the specified model or fallback chain.
 *
 * When provided an array of models, it attempts each one in order until
 * one succeeds. This enables graceful degradation when providers are
 * unavailable or rate-limited.
 *
 * @param options - Generation options including model, prompt, and settings
 * @returns The generated image result
 * @throws Error if all providers in the chain fail
 */
export async function generateImage(
  options: GenerateImageOptions
): Promise<ImageResult> {
  const {
    model,
    prompt,
    ratio,
    size = '2K',
    reference,
    negativePrompt,
    config,
  } = options;

  const models = Array.isArray(model) ? model : [model];
  const errors: Error[] = [];

  for (const modelSelector of models) {
    try {
      const provider = providerRegistry.get(modelSelector.provider);

      if (!provider) {
        throw new Error(`Provider not registered: ${modelSelector.provider}`);
      }

      const params: GenerateImageParams = {
        prompt,
        ratio,
        size,
        reference,
        negativePrompt,
      };

      const result = await provider.generateImage(
        modelSelector.modelId,
        params,
        config
      );

      return result;
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      continue;
    }
  }

  throw new Error(
    `All providers failed: ${errors.map((e) => e.message).join(', ')}`
  );
}

/**
 * Generate images for multiple aspect ratios with visual consistency.
 *
 * This function generates images sequentially, using the first generated
 * image as a reference for subsequent generations. This helps maintain
 * visual consistency across different aspect ratios.
 *
 * If a reference image is provided by the user, that reference is used
 * for all generations instead of the auto-reference behavior.
 *
 * @param options - Generation options including ratios array
 * @returns Array of image results, one per ratio
 */
export async function generateImages(
  options: GenerateImagesOptions
): Promise<ImageResult[]> {
  const { ratios, reference, ...baseOptions } = options;
  const results: ImageResult[] = [];
  let referenceImage: Buffer | undefined = reference;

  for (const ratio of ratios) {
    const result = await generateImage({
      ...baseOptions,
      ratio,
      reference: referenceImage,
    });

    results.push(result);

    // Use first generated image as reference for consistency,
    // but only if no user reference was provided
    if (!reference && results.length === 1) {
      referenceImage = result.data;
    }
  }

  return results;
}
