/**
 * React Hook for Request Deduplication
 * Provides easy integration with React components for preventing duplicate submissions
 */

import { useCallback, useState } from 'react';
import {
  generateRequestFingerprint,
  isRequestInFlight,
  markRequestInFlight,
  completeRequest,
  getIdempotencyKey,
} from '../lib/requestDedup';

interface UseRequestDedupOptions {
  /**
   * Type of operation for fingerprint generation
   * e.g., 'create_order', 'save_address', 'create_subscription'
   */
  operationType: string;
  /**
   * Optional resource ID to make fingerprints more unique
   * e.g., address ID, order ID
   */
  resourceId?: string;
  /**
   * Timeout in milliseconds for auto-cleanup
   * Default: 30000 (30 seconds)
   */
  timeoutMs?: number;
  /**
   * Callback when submission is blocked due to in-flight duplicate
   */
  onDuplicateAttempt?: () => void;
}

interface UseRequestDedupResult {
  /**
   * Whether a request is currently in-flight (button should be disabled)
   */
  isLoading: boolean;
  /**
   * Call before starting an async operation
   * Returns the idempotency key to send to backend
   */
  startRequest: () => string | null;
  /**
   * Call when operation completes successfully or with error
   */
  completeOperation: () => void;
  /**
   * Idempotency key for current request (if any)
   */
  idempotencyKey: string | null;
}

/**
 * React hook for preventing duplicate requests
 * Usage:
 * ```tsx
 * const { isLoading, startRequest, completeOperation } = useRequestDedup({
 *   operationType: 'create_order',
 * });
 *
 * const handleSubmit = async (e) => {
 *   e.preventDefault();
 *   const key = startRequest(); // Returns null if already in-flight
 *   if (!key) return;
 *
 *   try {
 *     await apiCall(formData);
 *   } finally {
 *     completeOperation();
 *   }
 * };
 *
 * return <Button disabled={isLoading} onClick={handleSubmit}>Submit</Button>;
 * ```
 */
export function useRequestDedup(
  options: UseRequestDedupOptions
): UseRequestDedupResult {
  const [isLoading, setIsLoading] = useState(false);
  const [currentFingerprint, setCurrentFingerprint] = useState<string | null>(null);

  const startRequest = useCallback((): string | null => {
    const { fingerprint, idempotencyKey } = generateRequestFingerprint(
      options.operationType,
      options.resourceId
    );

    // Check if a request is already in-flight
    if (isRequestInFlight(fingerprint)) {
      options.onDuplicateAttempt?.();
      return null;
    }

    // Mark request as in-flight
    markRequestInFlight(fingerprint, options.timeoutMs);
    setIsLoading(true);
    setCurrentFingerprint(fingerprint);

    return idempotencyKey;
  }, [options]);

  const completeOperation = useCallback((): void => {
    if (currentFingerprint) {
      completeRequest(currentFingerprint);
      setCurrentFingerprint(null);
    }
    setIsLoading(false);
  }, [currentFingerprint]);

  return {
    isLoading,
    startRequest,
    completeOperation,
    idempotencyKey: currentFingerprint
      ? getIdempotencyKey(currentFingerprint)
      : null,
  };
}

/**
 * Alternative hook for form submission with automatic state management
 * Usage:
 * ```tsx
 * const { isSubmitting, handleSubmit } = useFormSubmit({
 *   operationType: 'save_address',
 *   onSubmit: async (data) => {
 *     await apiCall(data);
 *   }
 * });
 *
 * return (
 *   <form onSubmit={handleSubmit}>
 *     <input name="address" required />
 *     <button disabled={isSubmitting}>Save</button>
 *   </form>
 * );
 * ```
 */
interface UseFormSubmitOptions extends Omit<UseRequestDedupOptions, 'resourceId'> {
  onSubmit: (idempotencyKey: string) => Promise<void>;
  resourceId?: string;
}

interface UseFormSubmitResult {
  isSubmitting: boolean;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useFormSubmit(
  options: UseFormSubmitOptions
): UseFormSubmitResult {
  const dedup = useRequestDedup({
    operationType: options.operationType,
    resourceId: options.resourceId,
    timeoutMs: options.timeoutMs,
  });

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();

      const idempotencyKey = dedup.startRequest();
      if (!idempotencyKey) {
        // Duplicate request already in progress
        return;
      }

      try {
        await options.onSubmit(idempotencyKey);
      } finally {
        dedup.completeOperation();
      }
    },
    [dedup, options]
  );

  return {
    isSubmitting: dedup.isLoading,
    handleSubmit,
  };
}
