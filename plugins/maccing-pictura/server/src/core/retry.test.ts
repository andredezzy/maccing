import { describe, it, expect, vi } from 'vitest';
import { withRetry, RetryError, isRetryableError } from './retry';

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, jitterMs: 0 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw RetryError after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fail'));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, jitterMs: 0 })
    ).rejects.toThrow(RetryError);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('isRetryableError', () => {
  it('should return true for rate limit errors', () => {
    expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true);
    expect(isRetryableError(new Error('429 too many requests'))).toBe(true);
  });

  it('should return false for content policy errors', () => {
    expect(isRetryableError(new Error('content policy violation'))).toBe(false);
  });
});
