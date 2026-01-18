import { GoogleGenAI } from '@google/genai';
import {
  createImageProvider,
  getDimensionsForRatio,
  SUPPORTED_RATIOS,
  type ImageProviderSpec,
  type GenerateImageParams,
  type EditImageParams,
  type ImageResult,
  type SupportedRatio,
} from '../provider-spec/factory.js';

export const GEMINI_MODELS = ['flash', 'pro'] as const;
export type GeminiModel = (typeof GEMINI_MODELS)[number];

const MODEL_IDS: Record<GeminiModel, string> = {
  flash: 'gemini-2.5-flash-image', // Fast, efficient model for high-volume tasks
  pro: 'gemini-3-pro-image-preview', // Professional quality with advanced reasoning, supports up to 4K
};

// Gemini native image generation uses these aspect ratio values
const ASPECT_RATIO_MAP: Record<SupportedRatio, string> = {
  '1:1': '1:1',
  '2:3': '2:3',
  '3:2': '3:2',
  '3:4': '3:4',
  '4:3': '4:3',
  '4:5': '4:5',
  '5:4': '5:4',
  '9:16': '9:16',
  '16:9': '16:9',
  '21:9': '16:9', // Gemini doesn't support 21:9, fallback to 16:9
};

/**
 * Extract base64 image data from Gemini response parts
 */
function extractImageFromResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any
): { data: Buffer; mimeType: string } | null {
  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    return null;
  }

  const parts = candidates[0].content?.parts;
  if (!parts) {
    return null;
  }

  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        data: Buffer.from(part.inlineData.data, 'base64'),
        mimeType: part.inlineData.mimeType || 'image/png',
      };
    }
  }

  return null;
}

const geminiSpec: ImageProviderSpec = {
  name: 'gemini',
  models: {
    flash: {
      id: MODEL_IDS.flash,
      capabilities: {
        maxResolution: '1K', // gemini-2.5-flash-image generates up to 1024px
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
        maxResolution: '4K', // gemini-3-pro-image-preview supports 1K, 2K, 4K output
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
    const aspectRatio = ASPECT_RATIO_MAP[params.ratio];

    const ai = new GoogleGenAI({ apiKey });

    // Build the content parts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentParts: any[] = [{ text: params.prompt }];

    // Add reference image if provided
    if (params.reference) {
      contentParts.push({
        inlineData: {
          mimeType: 'image/png',
          data: params.reference.toString('base64'),
        },
      });
    }

    // Determine imageSize based on params.size (must be uppercase K)
    // gemini-2.5-flash-image only supports 1K, gemini-3-pro-image-preview supports 1K, 2K, 4K
    const imageSize = params.size || '2K';

    // Use imageConfig for the new Gemini SDK (replaces deprecated imageGenerationConfig)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const generateConfig: any = {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio,
        imageSize,
      },
    };

    const response = await ai.models.generateContent({
      model: fullModelId,
      contents: [{ parts: contentParts }],
      config: generateConfig,
    });

    const imageData = extractImageFromResponse(response);
    if (!imageData) {
      throw new Error('No image was generated in the response');
    }

    return {
      data: imageData.data,
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

    const fullModelId = MODEL_IDS[modelId as GeminiModel];

    const ai = new GoogleGenAI({ apiKey });

    // Use provided ratio or default to 16:9
    const ratio = params.ratio || '16:9';
    const size = params.size || '2K';
    const dimensions = getDimensionsForRatio(ratio, size);
    const aspectRatio = ASPECT_RATIO_MAP[ratio];

    // Build content with the source image and edit prompt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentParts: any[] = [];

    // Add the edit instruction
    contentParts.push({ text: params.prompt });

    // Add the source image to edit
    contentParts.push({
      inlineData: {
        mimeType: 'image/png',
        data: params.image.toString('base64'),
      },
    });

    // Add style reference if provided
    if (params.style) {
      contentParts.push({
        inlineData: {
          mimeType: 'image/png',
          data: Buffer.from(params.style).toString('base64'),
        },
      });
    }

    const response = await ai.models.generateContent({
      model: fullModelId,
      contents: [{ parts: contentParts }],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio,
          imageSize: size,
        },
      },
    });

    const imageData = extractImageFromResponse(response);
    if (!imageData) {
      throw new Error('No image was generated in the edit response');
    }

    return {
      data: imageData.data,
      ratio,
      width: dimensions.width,
      height: dimensions.height,
      provider: 'gemini',
      model: fullModelId,
    };
  },
};

export const gemini = createImageProvider<GeminiModel>(geminiSpec);
