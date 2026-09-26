/**
 * Request Deduplication Middleware for Express
 * Prevents duplicate requests from being processed by tracking idempotency keys
 * 
 * Installation:
 * app.use(idempotencyMiddleware);
 * 
 * The middleware:
 * 1. Extracts X-Idempotency-Key header from request
 * 2. Checks if request is already in-flight
 * 3. If duplicate, returns cached response or 409 Conflict
 * 4. If new request, processes normally and caches response
 */

import type { Request, Response, NextFunction } from 'express';

interface CachedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
  timeout?: NodeJS.Timeout;
}

/**
 * Map of in-flight requests indexed by idempotency key
 * Format: "${userId}:${idempotencyKey}"
 */
const inFlightRequests = new Map<string, CachedResponse>();

/**
 * Timeout for caching response (default 30 minutes)
 * Prevents memory leaks by auto-cleaning old entries
 */
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Generate a request key from user ID and idempotency key
 */
function generateRequestKey(userId: string, idempotencyKey: string): string {
  return `${userId}:${idempotencyKey}`;
}

/**
 * Check if request is already in-flight
 */
function isRequestInFlight(requestKey: string): boolean {
  const cached = inFlightRequests.get(requestKey);
  if (!cached) return false;
  
  // Check if cache has expired
  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL_MS) {
    inFlightRequests.delete(requestKey);
    return false;
  }
  
  return true;
}

/**
 * Mark a request as in-flight
 */
function markRequestInFlight(requestKey: string): void {
  // Clear any existing timeout for this key
  const existing = inFlightRequests.get(requestKey);
  if (existing?.timeout) {
    clearTimeout(existing.timeout);
  }

  // Set timeout to auto-cleanup
  const timeout = setTimeout(() => {
    inFlightRequests.delete(requestKey);
  }, CACHE_TTL_MS);

  inFlightRequests.set(requestKey, {
    statusCode: 0,
    headers: {},
    body: undefined,
    timestamp: Date.now(),
    timeout,
  });
}

/**
 * Cache response for later duplicate requests
 */
function cacheResponse(
  requestKey: string,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {}
): void {
  const cached = inFlightRequests.get(requestKey);
  if (cached) {
    cached.statusCode = statusCode;
    cached.body = body;
    cached.headers = headers;
  }
}

/**
 * Get cached response for duplicate request
 */
function getCachedResponse(requestKey: string): CachedResponse | undefined {
  return inFlightRequests.get(requestKey);
}

/**
 * Complete request and cleanup
 */
function completeRequest(requestKey: string): void {
  const cached = inFlightRequests.get(requestKey);
  if (cached?.timeout) {
    clearTimeout(cached.timeout);
  }
  inFlightRequests.delete(requestKey);
}

/**
 * Express middleware for request deduplication
 * 
 * Usage:
 * app.use(idempotencyMiddleware);
 * 
 * Or apply to specific routes:
 * app.post('/api/create-order', idempotencyMiddleware, handleCreateOrder);
 */
export function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only apply to POST, PUT, PATCH, DELETE requests
  // GET requests should not be deduplicated (they're idempotent by nature)
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.get('X-Idempotency-Key');
  
  // If no idempotency key provided, skip deduplication
  if (!idempotencyKey) {
    return next();
  }

  // Extract user ID from request context
  // Assumes middleware runs after authentication middleware that sets req.user
  const userId = (req as any).user?.uid || 'anonymous';
  const requestKey = generateRequestKey(userId, idempotencyKey);

  // Check if request is already in-flight
  if (isRequestInFlight(requestKey)) {
    const cached = getCachedResponse(requestKey);
    if (cached && cached.statusCode > 0) {
      // Response is ready, return cached response
      res.status(cached.statusCode);
      Object.entries(cached.headers).forEach(([key, value]) => {
        if (!['content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
          res.set(key, value);
        }
      });
      res.json({
        message: 'Duplicate request detected. Returning cached response.',
        isDuplicate: true,
        data: cached.body,
      });
    } else {
      // Request is still being processed
      res.status(409).json({
        message: 'A similar request is already being processed. Please wait.',
        isDuplicate: true,
      });
    }
  }

  // Mark request as in-flight
  markRequestInFlight(requestKey);

  // Intercept res.json() to cache the response
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const statusCode = res.statusCode || 200;
    const headers: Record<string, string> = {};
    
    // Extract headers that should be cached
    res.getHeaders && Object.entries(res.getHeaders()).forEach(([key, value]) => {
      if (typeof value === 'string' && !['content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    });

    // Cache successful responses (2xx and 4xx status codes)
    if (statusCode >= 200 && statusCode < 500) {
      cacheResponse(requestKey, statusCode, body, headers);
      // Don't cleanup yet - keep cached for potential duplicates
    } else {
      // For 5xx errors, cleanup to allow retry
      completeRequest(requestKey);
    }

    return originalJson(body);
  };

  // Store request key in request for later cleanup if needed
  (req as any).idempotencyKey = idempotencyKey;
  (req as any).requestKey = requestKey;

  next();
}

/**
 * Get statistics about in-flight requests
 * Useful for debugging and monitoring
 */
export function getIdempotencyStats() {
  return {
    totalInFlight: inFlightRequests.size,
    requests: Array.from(inFlightRequests.entries()).map(([key, cached]) => ({
      key,
      cached: cached.statusCode > 0,
      age: Date.now() - cached.timestamp,
      statusCode: cached.statusCode || 'processing',
    })),
  };
}

/**
 * Clear all in-flight requests (for testing)
 */
export function clearAllInFlightRequests(): void {
  inFlightRequests.forEach((cached) => {
    if (cached.timeout) {
      clearTimeout(cached.timeout);
    }
  });
  inFlightRequests.clear();
}
