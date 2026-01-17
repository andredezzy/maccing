import { z } from 'zod';

// ============================================================================
// Image Types
// ============================================================================

export const SUPPORTED_RATIOS = [
  '1:1', '2:3', '3:2', '3:4', '4:3',
  '4:5', '5:4', '9:16', '16:9', '21:9',
] as const;

export type SupportedRatio = typeof SUPPORTED_RATIOS[number];
export type ImageSize = '1K' | '2K' | '4K';

export const RatioSchema = z.enum(SUPPORTED_RATIOS);

export interface ImageResult {
  data: Buffer;
  path?: string;
  ratio: SupportedRatio;
  width: number;
  height: number;
  provider: string;
  model: string;
  timestamp?: Date;
}

const BASE_DIMENSIONS: Record<SupportedRatio, { width: number; height: number }> = {
  '1:1': { width: 2048, height: 2048 },
  '2:3': { width: 1365, height: 2048 },
  '3:2': { width: 2048, height: 1365 },
  '3:4': { width: 1536, height: 2048 },
  '4:3': { width: 2048, height: 1536 },
  '4:5': { width: 1638, height: 2048 },
  '5:4': { width: 2048, height: 1638 },
  '9:16': { width: 1152, height: 2048 },
  '16:9': { width: 2048, height: 1152 },
  '21:9': { width: 2048, height: 878 },
};

const SIZE_MULTIPLIERS: Record<ImageSize, number> = {
  '1K': 0.5,
  '2K': 1,
  '4K': 2,
};

export function getDimensionsForRatio(
  ratio: SupportedRatio,
  size: ImageSize = '2K'
): { width: number; height: number } {
  const base = BASE_DIMENSIONS[ratio];
  const multiplier = SIZE_MULTIPLIERS[size];
  return {
    width: Math.round(base.width * multiplier),
    height: Math.round(base.height * multiplier),
  };
}

// ============================================================================
// Provider Types
// ============================================================================

export interface GenerateImageParams {
  prompt: string;
  ratio: SupportedRatio;
  size?: ImageSize;
  reference?: Buffer;
  negativePrompt?: string;
}

export interface EditImageParams {
  image: Buffer;
  prompt: string;
  mask?: string;
  extend?: 'top' | 'bottom' | 'left' | 'right';
  style?: Buffer;
}

export interface UpscaleImageParams {
  image: Buffer;
  scale?: number;
  model?: string;
}

export interface ImageModelCapabilities {
  maxResolution: ImageSize;
  supportedRatios: SupportedRatio[];
  supportsReference: boolean;
  supportsEdit: boolean;
  supportsInpaint: boolean;
  supportsOutpaint: boolean;
}

export interface ImageProviderSpec {
  name: string;
  models: Record<string, {
    id: string;
    capabilities: ImageModelCapabilities;
  }>;
  generateImage(
    modelId: string,
    params: GenerateImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult>;
  editImage?(
    modelId: string,
    params: EditImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult>;
}

export interface UpscaleProviderSpec {
  name: string;
  models: string[];
  maxScale: number;
  upscale(
    params: UpscaleImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult>;
}

export interface ModelSelector<T extends string = string> {
  provider: string;
  modelId: T;
  capabilities: ImageModelCapabilities;
}

export type ModelWithFallbacks = ModelSelector | ModelSelector[];

// ============================================================================
// Provider Factory
// ============================================================================

export interface ImageProviderFunction<TModels extends string = string> {
  (modelId: TModels): ModelSelector<TModels>;
  name: string;
  spec: ImageProviderSpec;
  generateImage(
    modelId: TModels,
    params: GenerateImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult>;
  editImage?(
    modelId: TModels,
    params: EditImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult>;
}

export function createImageProvider<TModels extends string>(
  spec: ImageProviderSpec
): ImageProviderFunction<TModels> {
  const providerFn = ((modelId: TModels): ModelSelector<TModels> => {
    const modelDef = spec.models[modelId];
    if (!modelDef) {
      throw new Error(`Unknown model: ${modelId} for provider ${spec.name}`);
    }
    return {
      provider: spec.name,
      modelId,
      capabilities: modelDef.capabilities,
    };
  }) as ImageProviderFunction<TModels>;

  // Use Object.defineProperty since function.name is read-only
  Object.defineProperty(providerFn, 'name', { value: spec.name, writable: false });
  providerFn.spec = spec;

  providerFn.generateImage = (
    modelId: TModels,
    params: GenerateImageParams,
    config: Record<string, unknown>
  ) => spec.generateImage(modelId, params, config);

  if (spec.editImage) {
    providerFn.editImage = (
      modelId: TModels,
      params: EditImageParams,
      config: Record<string, unknown>
    ) => spec.editImage!(modelId, params, config);
  }

  return providerFn;
}

export interface UpscaleProviderFunction {
  name: string;
  models: string[];
  maxScale: number;
  spec: UpscaleProviderSpec;
  upscale(
    params: UpscaleImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult>;
}

export function createUpscaleProvider(
  spec: UpscaleProviderSpec
): UpscaleProviderFunction {
  return {
    name: spec.name,
    models: spec.models,
    maxScale: spec.maxScale,
    spec,
    upscale: (params, config) => spec.upscale(params, config),
  };
}
