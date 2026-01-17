import { describe, it, expect } from 'vitest';
import { PromptEnhancer, detectStyle, STYLE_PROFILES } from './prompt-enhancer';

describe('detectStyle', () => {
  it('should detect photo style', () => {
    expect(detectStyle('photo of a cat')).toBe('photo');
    expect(detectStyle('realistic portrait')).toBe('photo');
  });

  it('should detect art style', () => {
    expect(detectStyle('cartoon character')).toBe('art');
    expect(detectStyle('anime illustration')).toBe('art');
  });

  it('should detect commercial style', () => {
    expect(detectStyle('product shot')).toBe('commercial');
  });

  it('should default to auto', () => {
    expect(detectStyle('cat on roof')).toBe('auto');
  });
});

describe('PromptEnhancer', () => {
  it('should enhance with style modifiers', () => {
    const enhancer = new PromptEnhancer();
    const enhanced = enhancer.enhance('cat on roof', { style: 'photo' });
    expect(enhanced.length).toBeGreaterThan('cat on roof'.length);
  });

  it('should return original for minimal style', () => {
    const enhancer = new PromptEnhancer();
    const enhanced = enhancer.enhance('cat on roof', { style: 'minimal' });
    expect(enhanced).toBe('cat on roof');
  });

  it('should auto-detect style when style is auto', () => {
    const enhancer = new PromptEnhancer();
    const enhanced = enhancer.enhance('anime character', { style: 'auto' });
    // Should detect art style and enhance accordingly
    expect(enhanced.length).toBeGreaterThan('anime character'.length);
  });

  it('should apply photo style modifiers', () => {
    const enhancer = new PromptEnhancer();
    const enhanced = enhancer.enhance('portrait of a woman', { style: 'photo' });
    expect(enhanced).toContain('portrait of a woman');
    // Should include photo-specific modifiers
    expect(enhanced.toLowerCase()).toMatch(/realistic|lens|lighting/);
  });

  it('should apply art style modifiers', () => {
    const enhancer = new PromptEnhancer();
    const enhanced = enhancer.enhance('fantasy scene', { style: 'art' });
    expect(enhanced).toContain('fantasy scene');
    // Should include art-specific modifiers
    expect(enhanced.toLowerCase()).toMatch(/vibrant|colors|stylized/);
  });

  it('should apply commercial style modifiers', () => {
    const enhancer = new PromptEnhancer();
    const enhanced = enhancer.enhance('coffee mug', { style: 'commercial' });
    expect(enhanced).toContain('coffee mug');
    // Should include commercial-specific modifiers
    expect(enhanced.toLowerCase()).toMatch(/studio|product|professional/);
  });

  it('should use generic enhancement for auto when style not detected', () => {
    const enhancer = new PromptEnhancer();
    const enhanced = enhancer.enhance('cat on roof', { style: 'auto' });
    // Should still enhance even if no specific style detected
    expect(enhanced.length).toBeGreaterThan('cat on roof'.length);
  });
});

describe('STYLE_PROFILES', () => {
  it('should have modifiers for photo style', () => {
    expect(STYLE_PROFILES.photo.modifiers).toBeDefined();
    expect(STYLE_PROFILES.photo.modifiers.length).toBeGreaterThan(0);
  });

  it('should have modifiers for art style', () => {
    expect(STYLE_PROFILES.art.modifiers).toBeDefined();
    expect(STYLE_PROFILES.art.modifiers.length).toBeGreaterThan(0);
  });

  it('should have modifiers for commercial style', () => {
    expect(STYLE_PROFILES.commercial.modifiers).toBeDefined();
    expect(STYLE_PROFILES.commercial.modifiers.length).toBeGreaterThan(0);
  });

  it('should have technical settings for each style', () => {
    expect(STYLE_PROFILES.photo.technical).toBeDefined();
    expect(STYLE_PROFILES.art.technical).toBeDefined();
    expect(STYLE_PROFILES.commercial.technical).toBeDefined();
  });

  it('should have lighting settings for each style', () => {
    expect(STYLE_PROFILES.photo.lighting).toBeDefined();
    expect(STYLE_PROFILES.art.lighting).toBeDefined();
    expect(STYLE_PROFILES.commercial.lighting).toBeDefined();
  });
});
