import {
  createImageProvider,
  getDimensionsForRatio,
  SUPPORTED_RATIOS,
  type ImageProviderSpec,
  type GenerateImageParams,
  type EditImageParams,
  type ImageResult,
} from '../provider-spec/factory';

export const GEMINI_MODELS = ['flash', 'pro'] as const;
export type GeminiModel = typeof GEMINI_MODELS[number];

const MODEL_IDS: Record<GeminiModel, string> = {
  flash: 'gemini-2.5-flash-image',
  pro: 'gemini-3-pro-image-preview',
};

const geminiSpec: ImageProviderSpec = {
  name: 'gemini',
  models: {
    flash: {
      id: MODEL_IDS.flash,
      capabilities: {
        maxResolution: '1K',
        supportedRatios: [...SUPPORTED_RATIOS],
        supportsReference: true,
        supportsEdit: true,
        supportsInpaint: true,
        supportsOutpaint: true,
      },
    },
    pro: {
      id: MODEL_IDS.pro,
      capabilities: {
        maxResolution: '4K',
        supportedRatios: [...SUPPORTED_RATIOS],
        supportsReference: true,
        supportsEdit: true,
        supportsInpaint: true,
        supportsOutpaint: true,
      },
    },
  },

  async generateImage(
    modelId: string,
    params: GenerateImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult> {
    const apiKey = config.apiKey as string;
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    const fullModelId = MODEL_IDS[modelId as GeminiModel];
    const dimensions = getDimensionsForRatio(params.ratio, params.size);

    // TODO: Implement actual Gemini API call
    // Stub for development
    const stubData = Buffer.from(`gemini-${modelId}-${params.ratio}-${Date.now()}`);

    return {
      data: stubData,
      ratio: params.ratio,
      width: dimensions.width,
      height: dimensions.height,
      provider: 'gemini',
      model: fullModelId,
    };
  },

  async editImage(
    modelId: string,
    params: EditImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult> {
    const apiKey = config.apiKey as string;
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    // TODO: Implement actual Gemini edit API
    const stubData = Buffer.from(`gemini-edit-${modelId}-${Date.now()}`);

    return {
      data: stubData,
      ratio: '16:9',
      width: 2048,
      height: 1152,
      provider: 'gemini',
      model: MODEL_IDS[modelId as GeminiModel],
    };
  },
};

export const gemini = createImageProvider<GeminiModel>(geminiSpec);
