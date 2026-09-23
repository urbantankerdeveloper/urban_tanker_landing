const LOCAL_API_URL = 'http://localhost:5000';
const DEFAULT_PROD_API_URL = 'https://urban-tanker-backend.onrender.com';
const configuredApiUrl = typeof import.meta.env.VITE_API_BASE_URL === 'string'
  ? import.meta.env.VITE_API_BASE_URL.trim().replace(/\/$/, '')
  : '';
const isLoopbackApiUrl = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredApiUrl);

export const API_BASE_URL =
  import.meta.env.DEV
    ? configuredApiUrl || LOCAL_API_URL
    : configuredApiUrl && !isLoopbackApiUrl
      ? configuredApiUrl
      : DEFAULT_PROD_API_URL;
