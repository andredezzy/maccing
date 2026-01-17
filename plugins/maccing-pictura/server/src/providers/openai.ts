import {
  createImageProvider,
  type ImageProviderSpec,
  type GenerateImageParams,
  type EditImageParams,
  type ImageResult,
  type SupportedRatio,
} from '../provider-spec/factory.js';

// GPT Image models (DALL-E 2/3 deprecated May 12, 2026)
export const OPENAI_MODELS = ['gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'] as const;
export type OpenAIModel = typeof OPENAI_MODELS[number];

// OpenAI uses fixed sizes, not flexible aspect ratios
export const OPENAI_SIZES: Record<string, string> = {
  '1:1': '1024x1024',
  '3:2': '1536x1024',  // Landscape
  '2:3': '1024x1536',  // Portrait
};

// Map unsupported ratios to nearest OpenAI size
const RATIO_TO_SIZE: Record<SupportedRatio, string> = {
  '1:1': '1024x1024',
  '2:3': '1024x1536',
  '3:2': '1536x1024',
  '3:4': '1024x1536',  // Map to portrait
  '4:3': '1536x1024',  // Map to landscape
  '4:5': '1024x1536',  // Map to portrait
  '5:4': '1536x1024',  // Map to landscape
  '9:16': '1024x1536', // Map to portrait
  '16:9': '1536x1024', // Map to landscape
  '21:9': '1536x1024', // Map to landscape
};

const openaiSpec: ImageProviderSpec = {
  name: 'openai',
  models: {
    'gpt-image-1.5': {
      id: 'gpt-image-1.5',
      capabilities: {
        maxResolution: '2K',
        supportedRatios: ['1:1', '3:2', '2:3'], // Native support only
        supportsReference: true,
        supportsEdit: true,
        supportsInpaint: true,
        supportsOutpaint: false,
      },
    },
    'gpt-image-1': {
      id: 'gpt-image-1',
      capabilities: {
        maxResolution: '2K',
        supportedRatios: ['1:1', '3:2', '2:3'],
        supportsReference: true,
        supportsEdit: true,
        supportsInpaint: true,
        supportsOutpaint: false,
      },
    },
    'gpt-image-1-mini': {
      id: 'gpt-image-1-mini',
      capabilities: {
        maxResolution: '1K',
        supportedRatios: ['1:1', '3:2', '2:3'],
        supportsReference: false,
        supportsEdit: false,
        supportsInpaint: false,
        supportsOutpaint: false,
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
      throw new Error('OpenAI API key is required');
    }

    const size = RATIO_TO_SIZE[params.ratio] || '1024x1024';
    const [width, height] = size.split('x').map(Number);

    // TODO: Implement actual OpenAI API call
    // Stub for development
    const stubData = Buffer.from(`openai-${modelId}-${params.ratio}-${Date.now()}`);

    return {
      data: stubData,
      ratio: params.ratio,
      width,
      height,
      provider: 'openai',
      model: modelId,
    };
  },

  async editImage(
    modelId: string,
    params: EditImageParams,
    config: Record<string, unknown>
  ): Promise<ImageResult> {
    const apiKey = config.apiKey as string;
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    // TODO: Implement actual OpenAI edit API
    const stubData = Buffer.from(`openai-edit-${modelId}-${Date.now()}`);

    return {
      data: stubData,
      ratio: '1:1',
      width: 1024,
      height: 1024,
      provider: 'openai',
      model: modelId,
    };
  },
};

export const openai = createImageProvider<OpenAIModel>(openaiSpec);
