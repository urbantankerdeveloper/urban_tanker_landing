import { useCallback, useEffect, useRef } from 'react';
import { create } from 'zustand';
import { getAuthToken } from '../../features/auth/auth';
import { API_BASE_URL } from '../lib/apiConfig';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RequestBody = BodyInit | Record<string, unknown> | null | undefined;

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  body?: RequestBody;
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | null | undefined>;
  /**
   * Idempotency key for request deduplication on backend
   * When provided, the backend will track this request and skip duplicates
   */
  idempotencyKey?: string;
}

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

interface RequestState<T = unknown> {
  data?: T;
  error?: ApiError;
  loading: boolean;
}

interface ApiStore {
  requests: Record<string, RequestState>;
  setRequest: <T>(key: string, state: Partial<RequestState<T>>) => void;
  clearRequest: (key: string) => void;
}

export const useApiStore = create<ApiStore>(set => ({
  requests: {},
  setRequest: (key, state) => set(current => ({
    requests: { ...current.requests, [key]: { ...current.requests[key], ...state } }
  })),
  clearRequest: key => set(current => {
    const requests = { ...current.requests };
    delete requests[key];
    return { requests };
  })
}));

function buildUrl(path: string, query?: ApiRequestOptions['query']): string {
  const url = new URL(path, API_BASE_URL.startsWith('/') ? window.location.origin : API_BASE_URL);
  if (API_BASE_URL.startsWith('/')) url.pathname = `${API_BASE_URL}${path}`.replace('//', '/');
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function serializeBody(body: RequestBody): BodyInit | undefined {
  if (body === null || body === undefined) return undefined;
  if (body instanceof FormData || body instanceof Blob || typeof body === 'string' || body instanceof URLSearchParams) return body;
  return JSON.stringify(body);
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

async function request<T>(path: string, options: ApiRequestOptions = {}, signal?: AbortSignal): Promise<T> {
  const body = serializeBody(options.body);
  const headers = new Headers(options.headers);
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  if (body && !(body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  // Add idempotency key header if provided
  if (options.idempotencyKey && !headers.has('X-Idempotency-Key')) {
    headers.set('X-Idempotency-Key', options.idempotencyKey);
  }
  const response = await fetch(buildUrl(path, options.query), { ...options, method: options.method || 'GET', body, headers, signal });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const details = payload && typeof payload === 'object' ? payload : undefined;
    const message = details && 'message' in details && typeof details.message === 'string' ? details.message : response.statusText || 'Request failed';
    throw { status: response.status, message, details } satisfies ApiError;
  }
  return payload as T;
}

export interface UseApiResult<T> extends RequestState<T> {
  get: <R = T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => Promise<R>;
  post: <R = T>(path: string, body?: RequestBody, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => Promise<R>;
  put: <R = T>(path: string, body?: RequestBody, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => Promise<R>;
  patch: <R = T>(path: string, body?: RequestBody, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => Promise<R>;
  del: <R = T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => Promise<R>;
  reset: () => void;
}

export function useApi<T = unknown>(key: string): UseApiResult<T> {
  const state = useApiStore(store => store.requests[key] as RequestState<T> | undefined) || { loading: false };
  const setRequest = useApiStore(store => store.setRequest);
  const clearRequest = useApiStore(store => store.clearRequest);
  const controllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async <R = T>(path: string, options: ApiRequestOptions = {}): Promise<R> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRequest(key, { loading: true, error: undefined });
    try {
      const data = await request<R>(path, options, controller.signal);
      setRequest(key, { data, loading: false });
      return data;
    } catch (cause) {
      const error: ApiError = cause && typeof cause === 'object' && 'status' in cause ? cause as ApiError : { status: 0, message: cause instanceof Error ? cause.message : 'Network request failed' };
      if (error.message !== 'The user aborted a request.') setRequest(key, { error, loading: false });
      throw error;
    }
  }, [key, setRequest]);

  const get = useCallback(<R = T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => execute<R>(path, { ...options, method: 'GET' }), [execute]);
  const post = useCallback(<R = T>(path: string, body?: RequestBody, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => execute<R>(path, { ...options, method: 'POST', body }), [execute]);
  const put = useCallback(<R = T>(path: string, body?: RequestBody, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => execute<R>(path, { ...options, method: 'PUT', body }), [execute]);
  const patch = useCallback(<R = T>(path: string, body?: RequestBody, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => execute<R>(path, { ...options, method: 'PATCH', body }), [execute]);
  const del = useCallback(<R = T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => execute<R>(path, { ...options, method: 'DELETE' }), [execute]);

  useEffect(() => () => controllerRef.current?.abort(), []);
  return { ...state, get, post, put, patch, del, reset: () => clearRequest(key) };
}
