import { describe, it, expect } from 'vitest';
import { generateSlug, generateTimestamp, ratioToFilename, filenameToRatio } from './slug';

describe('generateSlug', () => {
  it('should convert prompt to lowercase kebab-case', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('should remove special characters', () => {
    expect(generateSlug('Cat & Dog!')).toBe('cat-dog');
  });

  it('should truncate long prompts', () => {
    const longPrompt = 'a'.repeat(100);
    expect(generateSlug(longPrompt).length).toBeLessThanOrEqual(50);
  });

  it('should handle empty string', () => {
    expect(generateSlug('')).toBe('untitled');
  });

  it('should handle whitespace-only string', () => {
    expect(generateSlug('   ')).toBe('untitled');
  });

  it('should collapse multiple spaces into single hyphen', () => {
    expect(generateSlug('hello    world')).toBe('hello-world');
  });

  it('should handle leading and trailing hyphens', () => {
    expect(generateSlug('--hello world--')).toBe('hello-world');
  });

  it('should respect custom maxLength', () => {
    const prompt = 'this is a longer prompt for testing';
    expect(generateSlug(prompt, 10).length).toBeLessThanOrEqual(10);
  });

  it('should not end with a hyphen after truncation', () => {
    const prompt = 'this is a longer prompt';
    const slug = generateSlug(prompt, 7);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('should handle numbers in prompt', () => {
    expect(generateSlug('Test 123 Prompt')).toBe('test-123-prompt');
  });
});

describe('generateTimestamp', () => {
  it('should return YYYY-MM-DD-HHmmss format', () => {
    const timestamp = generateTimestamp();
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}$/);
  });

  it('should return a valid date-based timestamp', () => {
    const timestamp = generateTimestamp();
    const parts = timestamp.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    expect(year).toBeGreaterThanOrEqual(2024);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
  });
});

describe('ratioToFilename', () => {
  it('should convert ratio to filename format', () => {
    expect(ratioToFilename('16:9')).toBe('16x9');
    expect(ratioToFilename('1:1')).toBe('1x1');
  });

  it('should handle all supported ratios', () => {
    expect(ratioToFilename('2:3')).toBe('2x3');
    expect(ratioToFilename('3:2')).toBe('3x2');
    expect(ratioToFilename('3:4')).toBe('3x4');
    expect(ratioToFilename('4:3')).toBe('4x3');
    expect(ratioToFilename('4:5')).toBe('4x5');
    expect(ratioToFilename('5:4')).toBe('5x4');
    expect(ratioToFilename('9:16')).toBe('9x16');
    expect(ratioToFilename('21:9')).toBe('21x9');
  });
});

describe('filenameToRatio', () => {
  it('should convert filename format to ratio', () => {
    expect(filenameToRatio('16x9')).toBe('16:9');
    expect(filenameToRatio('1x1')).toBe('1:1');
  });

  it('should handle filename with .png extension', () => {
    expect(filenameToRatio('16x9.png')).toBe('16:9');
    expect(filenameToRatio('9x16.png')).toBe('9:16');
  });

  it('should handle all supported ratios', () => {
    expect(filenameToRatio('2x3')).toBe('2:3');
    expect(filenameToRatio('3x2')).toBe('3:2');
    expect(filenameToRatio('3x4')).toBe('3:4');
    expect(filenameToRatio('4x3')).toBe('4:3');
    expect(filenameToRatio('4x5')).toBe('4:5');
    expect(filenameToRatio('5x4')).toBe('5:4');
    expect(filenameToRatio('21x9')).toBe('21:9');
  });
});
