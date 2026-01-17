import { describe, it, expect, vi } from 'vitest';
import {
  createImageProvider,
  createUpscaleProvider,
  SUPPORTED_RATIOS,
  getDimensionsForRatio,
  type ImageProviderSpec,
  type UpscaleProviderSpec,
  type ImageResult,
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
