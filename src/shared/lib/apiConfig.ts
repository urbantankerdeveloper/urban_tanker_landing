const LOCAL_API_URL = 'http://localhost:5000';
const DEFAULT_PROD_API_URL = 'https://urban-tanker-backend.onrender.com';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? LOCAL_API_URL : DEFAULT_PROD_API_URL);
