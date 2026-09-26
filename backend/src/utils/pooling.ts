// Backend connection pooling and rate limiting
// Manages resource usage and prevents abuse

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator: (req: any) => string; // Generate key from request
}

export class RateLimiter {
  private requests = new Map<string, number[]>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed
   */
  isAllowed(req: any): boolean {
    const key = this.config.keyGenerator(req);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get or create request list for this key
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const timestamps = this.requests.get(key)!;

    // Remove old requests outside window
    while (timestamps.length > 0 && timestamps[0] < windowStart) {
      timestamps.shift();
    }

    // Check if under limit
    if (timestamps.length < this.config.maxRequests) {
      timestamps.push(now);
      return true;
    }

    return false;
  }

  /**
   * Get remaining requests for key
   */
  getRemaining(key: string): number {
    const timestamps = this.requests.get(key) || [];
    return Math.max(0, this.config.maxRequests - timestamps.length);
  }

  /**
   * Reset limit for key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      // Remove old requests
      while (timestamps.length > 0 && timestamps[0] < windowStart) {
        timestamps.shift();
      }

      // Remove empty entries
      if (timestamps.length === 0) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Get stats
   */
  getStats(): { total: number; keys: number } {
    return {
      total: Array.from(this.requests.values()).reduce((sum, ts) => sum + ts.length, 0),
      keys: this.requests.size
    };
  }
}

/**
 * Memory pool for managing connection limits
 */
export class ConnectionPool {
  private connections: Set<string> = new Set();
  private maxConnections: number;
  private waitQueue: Array<() => void> = [];

  constructor(maxConnections: number = 100) {
    this.maxConnections = maxConnections;
  }

  /**
   * Acquire connection
   */
  async acquire(connectionId: string): Promise<void> {
    if (this.connections.size < this.maxConnections) {
      this.connections.add(connectionId);
      return;
    }

    // Wait for connection to be available
    return new Promise(resolve => {
      this.waitQueue.push(() => {
        this.connections.add(connectionId);
        resolve();
      });
    });
  }

  /**
   * Release connection
   */
  release(connectionId: string): void {
    this.connections.delete(connectionId);

    // Process waiting requests
    const next = this.waitQueue.shift();
    if (next) {
      next();
    }
  }

  /**
   * Get pool stats
   */
  getStats(): { active: number; waiting: number; available: number } {
    return {
      active: this.connections.size,
      waiting: this.waitQueue.length,
      available: this.maxConnections - this.connections.size
    };
  }
}

/**
 * Circuit breaker pattern for handling failures gracefully
 */
export class CircuitBreaker<T> {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureThreshold: number;
  private resetTimeout: number;
  private successThreshold: number;
  private successCount = 0;

  constructor(
    private handler: () => Promise<T>,
    options: {
      failureThreshold?: number;
      resetTimeout?: number;
      successThreshold?: number;
    } = {}
  ) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.successThreshold = options.successThreshold || 2;
  }

  /**
   * Execute handler with circuit breaker protection
   */
  async execute(): Promise<T> {
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < this.resetTimeout) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'half-open';
      this.successCount = 0;
    }

    try {
      const result = await this.handler();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'closed';
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  /**
   * Get circuit breaker state
   */
  getState(): string {
    return this.state;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.failureCount = 0;
    this.state = 'closed';
    this.successCount = 0;
  }
}
