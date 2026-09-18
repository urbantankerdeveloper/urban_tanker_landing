const LOCAL_API_URL = 'http://localhost:5000';
const DEPLOYED_API_URL = 'https://urban-tanker-landing.web.app';

export const API_BASE_URL = import.meta.env.DEV
  ? LOCAL_API_URL
  : (import.meta.env.VITE_API_BASE_URL || DEPLOYED_API_URL);
