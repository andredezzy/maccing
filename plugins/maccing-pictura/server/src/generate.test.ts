import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateImage, generateImages, registerProvider, clearProviderRegistry, type GenerateImageOptions } from './generate';
import { createImageProvider, type ImageProviderSpec } from './provider-spec/factory';

describe('generateImage', () => {
  const mockGenerateImage = vi.fn();

  const mockSpec: ImageProviderSpec = {
    name: 'mock-provider',
    models: {
      'mock-model': {
        id: 'mock-model-full',
        capabilities: {
          maxResolution: '4K',
          supportedRatios: ['16:9', '1:1', '9:16'],
          supportsReference: true,
          supportsEdit: true,
          supportsInpaint: false,
          supportsOutpaint: false,
        },
      },
    },
    generateImage: mockGenerateImage,
  };

  const mockProvider = createImageProvider(mockSpec);

  beforeEach(() => {
    vi.clearAllMocks();
    clearProviderRegistry();
    registerProvider(mockProvider);
    mockGenerateImage.mockResolvedValue({
      data: Buffer.from('mock-image'),
      ratio: '16:9',
      width: 2048,
      height: 1152,
      provider: 'mock-provider',
      model: 'mock-model',
    });
  });

  afterEach(() => {
    clearProviderRegistry();
  });

  it('should generate image with single model', async () => {
    const result = await generateImage({
      model: mockProvider('mock-model'),
      prompt: 'test prompt',
      ratio: '16:9',
      config: { apiKey: 'test' },
    });

    expect(result.provider).toBe('mock-provider');
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
  });

  it('should pass correct parameters to provider', async () => {
    await generateImage({
      model: mockProvider('mock-model'),
      prompt: 'a beautiful sunset',
      ratio: '16:9',
      size: '4K',
      negativePrompt: 'blurry',
      config: { apiKey: 'test-key' },
    });

    expect(mockGenerateImage).toHaveBeenCalledWith(
      'mock-model',
      {
        prompt: 'a beautiful sunset',
        ratio: '16:9',
        size: '4K',
        reference: undefined,
        negativePrompt: 'blurry',
      },
      { apiKey: 'test-key' }
    );
  });

  it('should try fallback on failure', async () => {
    mockGenerateImage
      .mockRejectedValueOnce(new Error('First provider failed'))
      .mockResolvedValueOnce({
        data: Buffer.from('fallback-image'),
        ratio: '16:9',
        width: 2048,
        height: 1152,
        provider: 'mock-provider',
        model: 'mock-model',
      });

    const result = await generateImage({
      model: [mockProvider('mock-model'), mockProvider('mock-model')],
      prompt: 'test prompt',
      ratio: '16:9',
      config: { apiKey: 'test' },
    });

    expect(result.data.toString()).toBe('fallback-image');
    expect(mockGenerateImage).toHaveBeenCalledTimes(2);
  });

  it('should throw when all fallbacks fail', async () => {
    mockGenerateImage.mockRejectedValue(new Error('All failed'));

    await expect(
      generateImage({
        model: [mockProvider('mock-model'), mockProvider('mock-model')],
        prompt: 'test prompt',
        ratio: '16:9',
        config: { apiKey: 'test' },
      })
    ).rejects.toThrow('All providers failed');
  });

  it('should throw when provider is not registered', async () => {
    clearProviderRegistry();

    await expect(
      generateImage({
        model: mockProvider('mock-model'),
        prompt: 'test prompt',
        ratio: '16:9',
        config: { apiKey: 'test' },
      })
    ).rejects.toThrow('Provider not registered: mock-provider');
  });

  it('should use 2K size by default', async () => {
    await generateImage({
      model: mockProvider('mock-model'),
      prompt: 'test prompt',
      ratio: '16:9',
      config: { apiKey: 'test' },
    });

    expect(mockGenerateImage).toHaveBeenCalledWith(
      'mock-model',
      expect.objectContaining({ size: '2K' }),
      expect.any(Object)
    );
  });
});

describe('generateImages', () => {
  const mockGenerateImage = vi.fn();

  const mockSpec: ImageProviderSpec = {
    name: 'mock-provider',
    models: {
      'mock-model': {
        id: 'mock-model-full',
        capabilities: {
          maxResolution: '4K',
          supportedRatios: ['16:9', '1:1', '9:16'],
          supportsReference: true,
          supportsEdit: true,
          supportsInpaint: false,
          supportsOutpaint: false,
        },
      },
    },
    generateImage: mockGenerateImage,
  };

  const mockProvider = createImageProvider(mockSpec);

  beforeEach(() => {
    vi.clearAllMocks();
    clearProviderRegistry();
    registerProvider(mockProvider);
    mockGenerateImage.mockImplementation(async (modelId, params) => ({
      data: Buffer.from(`image-${params.ratio}`),
      ratio: params.ratio,
      width: 2048,
      height: 1152,
      provider: 'mock-provider',
      model: modelId,
    }));
  });

  afterEach(() => {
    clearProviderRegistry();
  });

  it('should generate images for multiple ratios', async () => {
    const results = await generateImages({
      model: mockProvider('mock-model'),
      prompt: 'test prompt',
      ratios: ['16:9', '1:1', '9:16'],
      config: { apiKey: 'test' },
    });

    expect(results).toHaveLength(3);
    expect(results[0].ratio).toBe('16:9');
    expect(results[1].ratio).toBe('1:1');
    expect(results[2].ratio).toBe('9:16');
  });

  it('should use first generated image as reference for consistency', async () => {
    const firstImageData = Buffer.from('first-image');
    mockGenerateImage
      .mockResolvedValueOnce({
        data: firstImageData,
        ratio: '16:9',
        width: 2048,
        height: 1152,
        provider: 'mock-provider',
        model: 'mock-model',
      })
      .mockResolvedValueOnce({
        data: Buffer.from('second-image'),
        ratio: '1:1',
        width: 2048,
        height: 2048,
        provider: 'mock-provider',
        model: 'mock-model',
      });

    await generateImages({
      model: mockProvider('mock-model'),
      prompt: 'test prompt',
      ratios: ['16:9', '1:1'],
      config: { apiKey: 'test' },
    });

    // First call should have no reference
    expect(mockGenerateImage).toHaveBeenNthCalledWith(
      1,
      'mock-model',
      expect.objectContaining({ reference: undefined }),
      expect.any(Object)
    );

    // Second call should use the first image as reference
    expect(mockGenerateImage).toHaveBeenNthCalledWith(
      2,
      'mock-model',
      expect.objectContaining({ reference: firstImageData }),
      expect.any(Object)
    );
  });

  it('should preserve user-provided reference', async () => {
    const userReference = Buffer.from('user-reference');

    await generateImages({
      model: mockProvider('mock-model'),
      prompt: 'test prompt',
      ratios: ['16:9', '1:1'],
      reference: userReference,
      config: { apiKey: 'test' },
    });

    // Both calls should use user-provided reference
    expect(mockGenerateImage).toHaveBeenNthCalledWith(
      1,
      'mock-model',
      expect.objectContaining({ reference: userReference }),
      expect.any(Object)
    );

    expect(mockGenerateImage).toHaveBeenNthCalledWith(
      2,
      'mock-model',
      expect.objectContaining({ reference: userReference }),
      expect.any(Object)
    );
  });
});
