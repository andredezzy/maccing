import { describe, it, expect } from 'vitest';
import { topaz, TOPAZ_MODELS } from './topaz';

describe('Topaz provider', () => {
  it('should have correct provider name', () => {
    expect(topaz.name).toBe('topaz');
  });

  it('should expose expected models', () => {
    expect(TOPAZ_MODELS).toContain('standard-max');
    expect(TOPAZ_MODELS).toContain('recovery-v2');
    expect(TOPAZ_MODELS).toContain('high-fidelity-v2');
  });

  it('should have correct max scale', () => {
    expect(topaz.maxScale).toBe(8);
  });

  it('should expose all 7 models', () => {
    expect(TOPAZ_MODELS).toHaveLength(7);
    expect(TOPAZ_MODELS).toContain('standard-v2');
    expect(TOPAZ_MODELS).toContain('standard-max');
    expect(TOPAZ_MODELS).toContain('recovery-v2');
    expect(TOPAZ_MODELS).toContain('high-fidelity-v2');
    expect(TOPAZ_MODELS).toContain('redefine');
    expect(TOPAZ_MODELS).toContain('low-resolution-v2');
    expect(TOPAZ_MODELS).toContain('cgi');
  });

  it('should have models array matching TOPAZ_MODELS', () => {
    expect(topaz.models).toEqual([...TOPAZ_MODELS]);
  });

  it('should have upscale function', () => {
    expect(typeof topaz.upscale).toBe('function');
  });

  it('should throw error when API key is missing', async () => {
    const params = { image: Buffer.from('test') };
    await expect(topaz.upscale(params, {})).rejects.toThrow(
      'Topaz API key is required'
    );
  });

  it('should return image result with stub data', async () => {
    const params = { image: Buffer.from('test'), scale: 2 };
    const config = { apiKey: 'test-key' };

    const result = await topaz.upscale(params, config);

    expect(result.provider).toBe('topaz');
    expect(result.model).toBe('standard-max');
    expect(result.data).toBeInstanceOf(Buffer);
  });

  it('should use specified model', async () => {
    const params = { image: Buffer.from('test'), model: 'high-fidelity-v2' };
    const config = { apiKey: 'test-key' };

    const result = await topaz.upscale(params, config);

    expect(result.model).toBe('high-fidelity-v2');
  });
});
