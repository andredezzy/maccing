import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// We'll test the schema directly
const GenerateParamsSchema = z.object({
  prompt: z.string(),
  ratios: z.array(z.string()).optional(),
  preset: z.enum(['social', 'web', 'portrait', 'landscape', 'print']).optional(),
  quality: z.enum(['draft', 'pro']).optional(),
  size: z.enum(['1K', '2K', '4K']).optional(),
  provider: z.enum(['gemini', 'openai']).optional(),
  enhance: z.boolean().optional(),
  enhanceStyle: z.enum(['photo', 'art', 'commercial', 'auto', 'minimal']).optional(),
  ref: z.string().optional(),
  consistency: z.enum(['generate', 'reference', 'multiturn']).optional(),
});

describe('GenerateParamsSchema', () => {
  it('should accept ref parameter', () => {
    const result = GenerateParamsSchema.safeParse({
      prompt: 'test',
      ref: '/path/to/image.png',
    });
    expect(result.success).toBe(true);
  });

  it('should accept consistency parameter', () => {
    const result = GenerateParamsSchema.safeParse({
      prompt: 'test',
      consistency: 'reference',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid consistency value', () => {
    const result = GenerateParamsSchema.safeParse({
      prompt: 'test',
      consistency: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});
