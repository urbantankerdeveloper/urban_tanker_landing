// Custom Hooks for Performance Optimization
// Includes debouncing, memoization, and worker management

import { useCallback, useEffect, useRef, useState, useMemo, DependencyList } from 'react';

/**
 * useDebounce - Delays function execution until user stops interacting
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * useWorker - Manages Web Worker lifecycle and communication
 * @param workerPath - Path to worker file
 * @returns Object with runWorker function
 */
export function useWorker(workerPath: string) {
  const workerRef = useRef<Worker | null>(null);
  
  const runWorker = useCallback((message: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      try {
        if (!workerRef.current) {
          workerRef.current = new Worker(workerPath, { type: 'module' });
        }
        
        const handler = (event: MessageEvent) => {
          if (event.data.type === 'success') {
            resolve(event.data.data);
          } else {
            reject(new Error(event.data.error));
          }
          
          // Remove listener after single message
          workerRef.current?.removeEventListener('message', handler);
        };
        
        workerRef.current.addEventListener('message', handler);
        workerRef.current.postMessage(message);
      } catch (error) {
        reject(error);
      }
    });
  }, [workerPath]);
  
  useEffect(() => {
    return () => {
      // Clean up worker on unmount
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);
  
  return { runWorker };
}

/**
 * useSearch - Performs search operations on large datasets using worker
 * @param data - Array of items to search
 * @param query - Search query string
 * @param fields - Fields to search in
 * @returns Search results
 */
export function useSearch<T>(data: T[], query: string, fields: string[]): T[] {
  const [results, setResults] = useState<T[]>(data);
  const [isSearching, setIsSearching] = useState(false);
  const { runWorker } = useWorker(
    new URL('../workers/searchWorker.ts', import.meta.url).href
  );
  const debouncedQuery = useDebounce(query, 200);
  
  useEffect(() => {
    if (debouncedQuery.trim()) {
      setIsSearching(true);
      runWorker({
        type: 'search',
        data,
        query: debouncedQuery,
        fields
      })
        .then(setResults)
        .catch(error => console.error('Search error:', error))
        .finally(() => setIsSearching(false));
    } else {
      setResults(data);
    }
  }, [debouncedQuery, data, fields, runWorker]);
  
  return results;
}

/**
 * useMemoizedCallback - Memoizes callback with dependency checking
 * @param callback - Function to memoize
 * @param deps - Dependency array
 * @returns Memoized callback
 */
export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: DependencyList
): T {
  return useCallback(callback, deps) as T;
}

/**
 * useMemoizedValue - Memoizes expensive computations
 * @param factory - Function that computes value
 * @param deps - Dependency array
 * @returns Memoized value
 */
export function useMemoizedValue<T>(
  factory: () => T,
  deps: DependencyList
): T {
  return useMemo(factory, deps);
}

/**
 * useChartData - Generates chart data using worker for large datasets
 * @param orders - Array of orders
 * @param days - Number of days (7, 30, or 90)
 * @returns Chart data points
 */
export function useChartData(orders: any[], days: 7 | 30 | 90 = 7) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { runWorker } = useWorker(
    new URL('../workers/chartDataWorker.ts', import.meta.url).href
  );
  
  useEffect(() => {
    if (orders.length === 0) {
      setChartData([]);
      return;
    }
    
    setIsLoading(true);
    runWorker({
      type: 'generateChartData',
      orders,
      days
    })
      .then(setChartData)
      .catch(error => console.error('Chart data error:', error))
      .finally(() => setIsLoading(false));
  }, [orders, days, runWorker]);
  
  return { chartData, isLoading };
}

/**
 * useLocalStorage - Persists state to localStorage with encryption option
 * @param key - Storage key
 * @param initialValue - Initial value
 * @param useEncryption - Whether to encrypt stored data
 * @returns [value, setValue]
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  useEncryption: boolean = false
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (!item) return initialValue;
      
      const parsed = JSON.parse(item) as T;
      return parsed;
    } catch (error) {
      console.error(`Error reading from localStorage[${key}]:`, error);
      return initialValue;
    }
  });
  
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error writing to localStorage[${key}]:`, error);
    }
  }, [key, storedValue]);
  
  return [storedValue, setValue];
}

/**
 * useThrottle - Throttles function execution to a maximum frequency
 * @param value - Value to throttle
 * @param delay - Minimum delay between updates in milliseconds
 * @returns Throttled value
 */
export function useThrottle<T>(value: T, delay: number = 300): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRun = useRef(Date.now());
  
  useEffect(() => {
    const now = Date.now();
    if (now >= lastRun.current + delay) {
      lastRun.current = now;
      setThrottledValue(value);
    }
  }, [value, delay]);
  
  return throttledValue;
}

/**
 * usePrevious - Tracks previous value
 * @param value - Current value
 * @returns Previous value
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}
