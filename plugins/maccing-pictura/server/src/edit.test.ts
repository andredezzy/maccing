import { describe, it, expect, beforeEach } from 'vitest';
import { editImage, type EditOperation } from './edit';
import { registerProvider, clearProviderRegistry, getProvider } from './generate';
import type { ImageProviderFunction, EditImageParams, ImageResult } from './provider-spec/factory';

describe('editImage', () => {
  beforeEach(() => {
    clearProviderRegistry();
  });

  it('should throw if provider not registered', async () => {
    await expect(editImage({
      model: { provider: 'nonexistent', modelId: 'test', capabilities: {} as any },
      image: Buffer.from('test'),
      prompt: 'add clouds',
      operation: 'refine',
      config: {},
    })).rejects.toThrow('Provider not registered');
  });

  it('should throw if provider does not support edit', async () => {
    const baseFn = (modelId: 'test') => ({
      provider: 'mock',
      modelId,
      capabilities: {
        maxResolution: '2K' as const,
        supportedRatios: ['16:9'] as const,
        supportsReference: true,
        supportsEdit: false,
        supportsInpaint: false,
        supportsOutpaint: false,
      },
    });

    const mockProvider = baseFn as ImageProviderFunction<'test'>;
    Object.defineProperty(mockProvider, 'name', { value: 'mock', writable: false });
    mockProvider.spec = {} as any;
    mockProvider.generateImage = async (): Promise<ImageResult> => {
      throw new Error('Should not call generateImage');
    };
    // No editImage method

    registerProvider(mockProvider);

    await expect(editImage({
      model: mockProvider('test'),
      image: Buffer.from('test'),
      prompt: 'add clouds',
      operation: 'refine',
      config: {},
    })).rejects.toThrow('does not support edit');
  });

  it('should call provider editImage with correct params', async () => {
    let editCalled = false;
    let editParams: EditImageParams | null = null;

    const baseFn = (modelId: 'test') => ({
      provider: 'mock',
      modelId,
      capabilities: {
        maxResolution: '2K' as const,
        supportedRatios: ['16:9'] as const,
        supportsReference: true,
        supportsEdit: true,
        supportsInpaint: true,
        supportsOutpaint: true,
      },
    });

    const mockProvider = baseFn as ImageProviderFunction<'test'>;
    Object.defineProperty(mockProvider, 'name', { value: 'mock', writable: false });
    mockProvider.spec = {} as any;
    mockProvider.generateImage = async (): Promise<ImageResult> => {
      throw new Error('Should not call generateImage');
    };
    mockProvider.editImage = async (modelId: string, params: EditImageParams): Promise<ImageResult> => {
      editCalled = true;
      editParams = params;
      return {
        data: Buffer.from('edited'),
        ratio: '16:9',
        width: 1920,
        height: 1080,
        provider: 'mock',
        model: modelId,
      };
    };

    registerProvider(mockProvider);

    const result = await editImage({
      model: mockProvider('test'),
      image: Buffer.from('original'),
      prompt: 'add clouds',
      operation: 'refine',
      config: {},
    });

    expect(editCalled).toBe(true);
    expect(editParams?.prompt).toBe('add clouds');
    expect(result.provider).toBe('mock');
  });
});
