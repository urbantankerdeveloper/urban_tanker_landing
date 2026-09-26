/**
 * Request Deduplication System
 * Prevents duplicate API requests from being sent to the backend.
 * Uses request fingerprints (idempotency keys) to identify duplicate requests.
 */

/**
 * Generate a UUID v4 compatible string
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for browsers without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface InFlightRequest {
  id: string;
  timestamp: number;
  timeoutHandle?: NodeJS.Timeout;
}

/**
 * Map of in-flight requests indexed by fingerprint
 * Fingerprint format: "${operationType}:${userId}:${resourceId}:${operationId}"
 */
const inFlightRequests = new Map<string, InFlightRequest>();

/**
 * Timeout for considering a request complete even if not explicitly resolved
 * Default: 30 seconds
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

/**
 * Generate a unique request fingerprint to identify duplicate operations
 * @param operationType - Type of operation (e.g., 'create_order', 'save_address')
 * @param resourceId - ID of the resource being modified (e.g., address ID, order ID)
 * @param operationId - Unique identifier for this specific operation (e.g., form submission ID)
 * @returns Fingerprint string and idempotency key
 */
export function generateRequestFingerprint(
  operationType: string,
  resourceId?: string,
  operationId: string = generateUUID()
): { fingerprint: string; idempotencyKey: string } {
  const fingerprint = [operationType, resourceId, operationId]
    .filter(Boolean)
    .join(':');
  return { fingerprint, idempotencyKey: operationId };
}

/**
 * Check if a request with the same fingerprint is already in-flight
 * @param fingerprint - Request fingerprint
 * @returns True if request is already in-flight, false otherwise
 */
export function isRequestInFlight(fingerprint: string): boolean {
  return inFlightRequests.has(fingerprint);
}

/**
 * Mark a request as in-flight
 * @param fingerprint - Request fingerprint
 * @param timeoutMs - Timeout after which the request is considered complete
 * @returns Request ID that should be passed to completeRequest()
 */
export function markRequestInFlight(
  fingerprint: string,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS
): string {
  // If already in-flight, return existing ID
  const existing = inFlightRequests.get(fingerprint);
  if (existing) {
    return existing.id;
  }

  const requestId = generateUUID();
  const inFlightRequest: InFlightRequest = {
    id: requestId,
    timestamp: Date.now(),
  };

  // Auto-cleanup after timeout
  inFlightRequest.timeoutHandle = setTimeout(() => {
    inFlightRequests.delete(fingerprint);
  }, timeoutMs);

  inFlightRequests.set(fingerprint, inFlightRequest);
  return requestId;
}

/**
 * Mark a request as complete
 * @param fingerprint - Request fingerprint
 */
export function completeRequest(fingerprint: string): void {
  const request = inFlightRequests.get(fingerprint);
  if (request?.timeoutHandle) {
    clearTimeout(request.timeoutHandle);
  }
  inFlightRequests.delete(fingerprint);
}

/**
 * Wrap an async operation with deduplication logic
 * Returns immediately if a duplicate request is already in-flight
 * @param fingerprint - Request fingerprint
 * @param operation - Async function to execute
 * @returns Promise that resolves when operation completes
 */
export async function withDeduplication<T>(
  fingerprint: string,
  operation: () => Promise<T>
): Promise<T> {
  if (isRequestInFlight(fingerprint)) {
    throw new Error(
      'A similar request is already in progress. Please wait for it to complete.'
    );
  }

  const requestId = markRequestInFlight(fingerprint);
  try {
    const result = await operation();
    return result;
  } finally {
    completeRequest(fingerprint);
  }
}

/**
 * Get the idempotency key for a request
 * This should be sent to the backend as a header: X-Idempotency-Key
 * @param fingerprint - Request fingerprint
 * @returns Idempotency key if request is in-flight, undefined otherwise
 */
export function getIdempotencyKey(fingerprint: string): string | undefined {
  const request = inFlightRequests.get(fingerprint);
  return request?.id;
}

/**
 * Clear all in-flight requests (for testing or logout)
 */
export function clearAllInFlightRequests(): void {
  inFlightRequests.forEach((request) => {
    if (request.timeoutHandle) {
      clearTimeout(request.timeoutHandle);
    }
  });
  inFlightRequests.clear();
}

/**
 * Get current in-flight requests count
 */
export function getInFlightRequestsCount(): number {
  return inFlightRequests.size;
}
