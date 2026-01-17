import { describe, it, expect, vi } from 'vitest';
import {
  createImageProvider,
  createUpscaleProvider,
  SUPPORTED_RATIOS,
  getDimensionsForRatio,
  type ImageProviderSpec,
  type UpscaleProviderSpec,
  type ImageResult,
  type GenerateImageParams,
  type EditImageParams,
  type UpscaleImageParams,
} from './factory';

describe('createImageProvider', () => {
  it('should create a provider with model selector function', () => {
    const mockSpec: ImageProviderSpec = {
      name: 'test-provider',
      models: {
        'model-a': {
          id: 'model-a-full-id',
          capabilities: {
            maxResolution: '4K',
            supportedRatios: ['16:9', '1:1'],
            supportsReference: true,
            supportsEdit: true,
            supportsInpaint: false,
            supportsOutpaint: false,
          },
        },
      },
      generateImage: vi.fn(),
    };

    const provider = createImageProvider(mockSpec);

    expect(provider.name).toBe('test-provider');
    expect(typeof provider).toBe('function');

    const model = provider('model-a');
    expect(model.provider).toBe('test-provider');
    expect(model.modelId).toBe('model-a');
    expect(model.capabilities.maxResolution).toBe('4K');
  });

  it('should throw for unknown model', () => {
    const mockSpec: ImageProviderSpec = {
      name: 'test-provider',
      models: {},
      generateImage: vi.fn(),
    };

    const provider = createImageProvider(mockSpec);

    expect(() => provider('unknown-model')).toThrow('Unknown model');
  });

  it('should delegate generateImage to spec.generateImage with correct arguments', async () => {
    const mockResult: ImageResult = {
      data: Buffer.from('test-image'),
      ratio: '16:9',
      width: 2048,
      height: 1152,
      provider: 'test-provider',
      model: 'model-a',
    };

    const mockGenerateImage = vi.fn().mockResolvedValue(mockResult);

    const mockSpec: ImageProviderSpec = {
      name: 'test-provider',
      models: {
        'model-a': {
          id: 'model-a-full-id',
          capabilities: {
            maxResolution: '4K',
            supportedRatios: ['16:9', '1:1'],
            supportsReference: true,
            supportsEdit: true,
            supportsInpaint: false,
            supportsOutpaint: false,
          },
        },
      },
      generateImage: mockGenerateImage,
    };

    const provider = createImageProvider(mockSpec);

    const params: GenerateImageParams = {
      prompt: 'A beautiful sunset',
      ratio: '16:9',
      size: '2K',
    };
    const config = { apiKey: 'test-key' };

    const result = await provider.generateImage('model-a', params, config);

    expect(mockGenerateImage).toHaveBeenCalledOnce();
    expect(mockGenerateImage).toHaveBeenCalledWith('model-a', params, config);
    expect(result).toBe(mockResult);
  });

  it('should attach editImage when spec provides it', async () => {
    const mockEditResult: ImageResult = {
      data: Buffer.from('edited-image'),
      ratio: '1:1',
      width: 2048,
      height: 2048,
      provider: 'test-provider',
      model: 'model-a',
    };

    const mockEditImage = vi.fn().mockResolvedValue(mockEditResult);

    const mockSpec: ImageProviderSpec = {
      name: 'test-provider',
      models: {
        'model-a': {
          id: 'model-a-full-id',
          capabilities: {
            maxResolution: '4K',
            supportedRatios: ['16:9', '1:1'],
            supportsReference: true,
            supportsEdit: true,
            supportsInpaint: false,
            supportsOutpaint: false,
          },
        },
      },
      generateImage: vi.fn(),
      editImage: mockEditImage,
    };

    const provider = createImageProvider(mockSpec);

    expect(provider.editImage).toBeDefined();

    const params: EditImageParams = {
      image: Buffer.from('original-image'),
      prompt: 'Make it blue',
    };
    const config = { apiKey: 'test-key' };

    const result = await provider.editImage!('model-a', params, config);

    expect(mockEditImage).toHaveBeenCalledOnce();
    expect(mockEditImage).toHaveBeenCalledWith('model-a', params, config);
    expect(result).toBe(mockEditResult);
  });

  it('should not attach editImage when spec does not provide it', () => {
    const mockSpec: ImageProviderSpec = {
      name: 'test-provider',
      models: {
        'model-a': {
          id: 'model-a-full-id',
          capabilities: {
            maxResolution: '4K',
            supportedRatios: ['16:9', '1:1'],
            supportsReference: true,
            supportsEdit: false,
            supportsInpaint: false,
            supportsOutpaint: false,
          },
        },
      },
      generateImage: vi.fn(),
    };

    const provider = createImageProvider(mockSpec);

    expect(provider.editImage).toBeUndefined();
  });
});

describe('getDimensionsForRatio', () => {
  it('should calculate dimensions for ratio and size', () => {
    const dims2K = getDimensionsForRatio('16:9', '2K');
    expect(dims2K.width).toBe(2048);
    expect(dims2K.height).toBe(1152);

    const dims4K = getDimensionsForRatio('16:9', '4K');
    expect(dims4K.width).toBe(4096);
    expect(dims4K.height).toBe(2304);
  });
});

describe('SUPPORTED_RATIOS', () => {
  it('should have all supported ratios', () => {
    expect(SUPPORTED_RATIOS).toContain('16:9');
    expect(SUPPORTED_RATIOS).toContain('1:1');
    expect(SUPPORTED_RATIOS).toContain('9:16');
    expect(SUPPORTED_RATIOS.length).toBe(10);
  });
});

describe('createUpscaleProvider', () => {
  it('should create an upscale provider with correct properties', () => {
    const mockSpec: UpscaleProviderSpec = {
      name: 'test-upscaler',
      models: ['model-x', 'model-y'],
      maxScale: 4,
      upscale: vi.fn(),
    };

    const provider = createUpscaleProvider(mockSpec);

    expect(provider.name).toBe('test-upscaler');
    expect(provider.models).toEqual(['model-x', 'model-y']);
    expect(provider.maxScale).toBe(4);
    expect(provider.spec).toBe(mockSpec);
  });

  it('should delegate upscale to spec.upscale with correct arguments', async () => {
    const mockResult: ImageResult = {
      data: Buffer.from('upscaled-image'),
      ratio: '16:9',
      width: 4096,
      height: 2304,
      provider: 'test-upscaler',
      model: 'model-x',
    };

    const mockUpscale = vi.fn().mockResolvedValue(mockResult);

    const mockSpec: UpscaleProviderSpec = {
      name: 'test-upscaler',
      models: ['model-x', 'model-y'],
      maxScale: 4,
      upscale: mockUpscale,
    };

    const provider = createUpscaleProvider(mockSpec);

    const params: UpscaleImageParams = {
      image: Buffer.from('original-image'),
      scale: 2,
      model: 'model-x',
    };
    const config = { apiKey: 'upscale-key' };

    const result = await provider.upscale(params, config);

    expect(mockUpscale).toHaveBeenCalledOnce();
    expect(mockUpscale).toHaveBeenCalledWith(params, config);
    expect(result).toBe(mockResult);
  });
});
