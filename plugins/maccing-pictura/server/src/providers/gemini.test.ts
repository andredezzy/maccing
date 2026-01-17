import { describe, it, expect } from 'vitest';
import { gemini, GEMINI_MODELS } from './gemini';

describe('Gemini provider', () => {
  it('should have correct provider name', () => {
    expect(gemini.name).toBe('gemini');
  });

  it('should expose flash and pro models', () => {
    expect(GEMINI_MODELS).toContain('flash');
    expect(GEMINI_MODELS).toContain('pro');
  });

  it('should create model selector for flash', () => {
    const model = gemini('flash');
    expect(model.provider).toBe('gemini');
    expect(model.modelId).toBe('flash');
    expect(model.capabilities.maxResolution).toBe('1K');
  });

  it('should create model selector for pro', () => {
    const model = gemini('pro');
    expect(model.provider).toBe('gemini');
    expect(model.modelId).toBe('pro');
    expect(model.capabilities.maxResolution).toBe('4K');
  });

  it('should throw for unknown model', () => {
    expect(() => (gemini as any)('unknown')).toThrow('Unknown model');
  });
});
