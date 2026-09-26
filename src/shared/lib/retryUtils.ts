// API Retry Utility - Implements exponential backoff retry logic
// Used for critical operations like order creation and address saving

export interface RetryOptions {
  maxAttempts?: number;           // Default: 3
  delayMs?: number;               // Default: 1000ms
  backoffMultiplier?: number;     // Default: 2 (exponential backoff)
  timeoutMs?: number;             // Default: 30000ms per attempt
  retryableStatuses?: number[];   // Default: [408, 429, 500, 502, 503, 504]
}

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  timeoutMs: 30000,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
};

/**
 * Executes a function with automatic retry on failure
 * Uses exponential backoff to space out retry attempts
 * 
 * @param fn Function to execute (typically an API call)
 * @param options Retry configuration options
 * @returns Promise with the result of the function
 * 
 * @example
 * const result = await withRetry(
 *   () => createOrder(orderData),
 *   { maxAttempts: 3, delayMs: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRetryable = isRetryableError(error, config.retryableStatuses);
      const isLastAttempt = attempt === config.maxAttempts;

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = config.delayMs * Math.pow(config.backoffMultiplier, attempt - 1);
      
      // Log retry attempt
      console.warn(
        `[Retry ${attempt}/${config.maxAttempts}] Retrying in ${delay}ms...`,
        {
          error: lastError.message,
          nextAttemptIn: delay
        }
      );

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Max retry attempts exceeded');
}

/**
 * Determines if an error is worth retrying
 * Returns true for network errors and server errors
 * Returns false for client errors and successful responses
 */
function isRetryableError(error: unknown, retryableStatuses: number[]): boolean {
  // Network error (no response)
  if (!(error instanceof Error)) {
    return true;
  }

  // Check if error has status code
  if ('status' in error && typeof (error as any).status === 'number') {
    const status = (error as any).status;
    return retryableStatuses.includes(status);
  }

  // Retry on network-related errors
  const message = error.message.toLowerCase();
  const networkErrors = [
    'network',
    'timeout',
    'econnrefused',
    'econnreset',
    'etimedout',
    'failed to fetch',
    'fetch failed'
  ];

  return networkErrors.some(err => message.includes(err));
}

/**
 * Creates a retry-wrapped version of an async function
 * Useful for creating reusable API functions with built-in retry logic
 * 
 * @example
 * const createOrderWithRetry = createRetryable(
 *   (data) => api.post('/orders', data),
 *   { maxAttempts: 3 }
 * );
 * const order = await createOrderWithRetry(orderData);
 */
export function createRetryable<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: RetryOptions = {}
): (...args: T) => Promise<R> {
  return (...args: T) => withRetry(() => fn(...args), options);
}

/**
 * Retry options preset for critical operations (orders, payments)
 * More aggressive: 4 attempts, shorter delays
 */
export const CRITICAL_OPERATION_RETRY: RetryOptions = {
  maxAttempts: 4,
  delayMs: 500,
  backoffMultiplier: 2,
  timeoutMs: 30000,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
};

/**
 * Retry options preset for non-critical operations (addresses, preferences)
 * More lenient: 2 attempts, longer delays
 */
export const STANDARD_OPERATION_RETRY: RetryOptions = {
  maxAttempts: 2,
  delayMs: 800,
  backoffMultiplier: 2,
  timeoutMs: 20000,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
};

/**
 * Retry options preset for read operations (GET requests)
 * Most aggressive: 5 attempts, safe to retry multiple times
 */
export const READ_OPERATION_RETRY: RetryOptions = {
  maxAttempts: 5,
  delayMs: 300,
  backoffMultiplier: 1.5,
  timeoutMs: 15000,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
};
