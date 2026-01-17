export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
  retryAfterHeader?: string; // From response headers
}

export class RetryError extends Error {
  public readonly attempts: number;
  public readonly lastError: Error;

  constructor(message: string, attempts: number, lastError: Error) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculate delay with exponential backoff and jitter to prevent thundering herd
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterMs: number,
  retryAfterMs?: number
): number {
  // If server specified retry-after, use it (capped at maxDelayMs)
  if (retryAfterMs !== undefined) {
    return Math.min(retryAfterMs, maxDelayMs);
  }

  // Exponential backoff: base * 2^(attempt-1)
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);

  // Add random jitter to prevent thundering herd
  const jitter = Math.random() * jitterMs;

  // Cap at max delay
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxAttempts,
    baseDelayMs = 2000,
    maxDelayMs = 30000,
    jitterMs = 3000,
    shouldRetry = isRetryableError,
    onRetry,
    retryAfterHeader,
  } = options;

  let lastError: Error | undefined;

  // Parse retry-after header if provided
  let retryAfterMs: number | undefined;
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) {
      retryAfterMs = seconds * 1000;
    }
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        if (attempt === maxAttempts) {
          throw new RetryError(
            `Failed after ${maxAttempts} attempts: ${lastError.message}`,
            attempt,
            lastError
          );
        }
        throw lastError;
      }

      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitterMs, retryAfterMs);
      onRetry?.(attempt, lastError, delay);
      await sleep(delay);

      // Clear retryAfterMs after first use
      retryAfterMs = undefined;
    }
  }

  throw new RetryError(
    `Failed after ${maxAttempts} attempts`,
    maxAttempts,
    lastError!
  );
}

export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Non-retryable errors: stop immediately, don't waste quota
  const nonRetryablePatterns = [
    'content policy',
    'safety filter',
    'blocked',
    'forbidden',
    'invalid api key',
    'authentication',
    'unauthorized',
    'not found',
    'invalid request',
    'bad request',
  ];

  for (const pattern of nonRetryablePatterns) {
    if (message.includes(pattern)) {
      return false;
    }
  }

  // Retryable errors: worth trying again
  const retryablePatterns = [
    'rate limit',
    '429',
    'too many requests',
    'timeout',
    'timed out',
    'network',
    'connection',
    'econnreset',
    'econnrefused',
    'socket',
    'temporarily unavailable',
    '503',
    '502',
    '500',
    'internal server error',
    'service unavailable',
    'gateway',
  ];

  for (const pattern of retryablePatterns) {
    if (message.includes(pattern)) {
      return true;
    }
  }

  // Default: retry unknown errors (network issues often have unclear messages)
  return true;
}
