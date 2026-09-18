const LOCAL_API_URL = 'http://localhost:5000';

export const API_BASE_URL = import.meta.env.DEV
	? LOCAL_API_URL
	: window.location.origin;
