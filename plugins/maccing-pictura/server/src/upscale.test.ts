import { describe, it, expect, beforeEach } from 'vitest';
import { upscaleImage, registerUpscaleProvider, clearUpscaleProviderRegistry } from './upscale';
import type { UpscaleProviderFunction, UpscaleImageParams, ImageResult } from './provider-spec/factory';

describe('upscaleImage', () => {
  beforeEach(() => {
    clearUpscaleProviderRegistry();
  });

  it('should throw if upscale provider not registered', async () => {
    await expect(upscaleImage({
      image: Buffer.from('test'),
      scale: 2,
      provider: 'nonexistent',
      config: { apiKey: 'test' },
    })).rejects.toThrow('Upscale provider not registered');
  });

  it('should call provider upscale with correct params', async () => {
    let upscaleCalled = false;
    let upscaleParams: UpscaleImageParams | null = null;

    const mockProvider: UpscaleProviderFunction = {
      name: 'mock',
      models: ['standard'],
      maxScale: 4,
      spec: {} as any,
      upscale: async (params: UpscaleImageParams): Promise<ImageResult> => {
        upscaleCalled = true;
        upscaleParams = params;
        return {
          data: Buffer.from('upscaled'),
          ratio: '16:9',
          width: 3840,
          height: 2160,
          provider: 'mock',
          model: 'standard',
        };
      },
    };

    registerUpscaleProvider(mockProvider);

    const result = await upscaleImage({
      image: Buffer.from('original'),
      scale: 2,
      model: 'standard',
      provider: 'mock',
      config: { apiKey: 'test' },
    });

    expect(upscaleCalled).toBe(true);
    expect(upscaleParams?.scale).toBe(2);
    expect(upscaleParams?.model).toBe('standard');
    expect(result.provider).toBe('mock');
  });
});
