// Backend caching layer for frequently accessed data
// Implements TTL-based caching with automatic invalidation

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  key: string;
}

export class CacheManager {
  private cache = new Map<string, { data: any; expiresAt: number }>();
  private timers = new Map<string, NodeJS.Timeout>();

  set(key: string, data: any, ttlMs: number): void {
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
    }

    // Set cache with expiry
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs
    });

    // Auto-remove expired cache
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, ttlMs);

    this.timers.set(key, timer);
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.timers.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
      this.timers.delete(key);
    }
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.invalidate(key);
      }
    }
  }

  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const cacheManager = new CacheManager();
