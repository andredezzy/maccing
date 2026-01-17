import { describe, it, expect } from 'vitest';
import { openai, OPENAI_MODELS, OPENAI_SIZES } from './openai';

describe('OpenAI provider', () => {
  it('should have correct provider name', () => {
    expect(openai.name).toBe('openai');
  });

  it('should expose gpt-image models (not deprecated DALL-E)', () => {
    expect(OPENAI_MODELS).toContain('gpt-image-1.5');
    expect(OPENAI_MODELS).toContain('gpt-image-1');
    expect(OPENAI_MODELS).toContain('gpt-image-1-mini');
    // DALL-E 2/3 deprecated May 12, 2026
    expect(OPENAI_MODELS).not.toContain('dall-e-3');
    expect(OPENAI_MODELS).not.toContain('dall-e-2');
  });

  it('should create model selector for gpt-image-1.5', () => {
    const model = openai('gpt-image-1.5');
    expect(model.provider).toBe('openai');
    expect(model.modelId).toBe('gpt-image-1.5');
    expect(model.capabilities.maxResolution).toBe('2K');
    expect(model.capabilities.supportsReference).toBe(true);
    expect(model.capabilities.supportsOutpaint).toBe(false);
  });

  it('should create model selector for gpt-image-1', () => {
    const model = openai('gpt-image-1');
    expect(model.provider).toBe('openai');
    expect(model.modelId).toBe('gpt-image-1');
    expect(model.capabilities.maxResolution).toBe('2K');
  });

  it('should create model selector for gpt-image-1-mini', () => {
    const model = openai('gpt-image-1-mini');
    expect(model.provider).toBe('openai');
    expect(model.modelId).toBe('gpt-image-1-mini');
    expect(model.capabilities.maxResolution).toBe('1K');
    expect(model.capabilities.supportsReference).toBe(false);
    expect(model.capabilities.supportsEdit).toBe(false);
  });

  it('should have correct size mappings', () => {
    expect(OPENAI_SIZES).toEqual({
      '1:1': '1024x1024',
      '3:2': '1536x1024',
      '2:3': '1024x1536',
    });
  });

  it('should throw for unknown model', () => {
    expect(() => (openai as any)('unknown')).toThrow('Unknown model');
  });
});
