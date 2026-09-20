// Database-backed Authentication System
// Uses backend API for user management

export interface LocalUser {
  uid: string;
  displayName: string | null;
  email: string;
  phoneNumber: string | null;
  role: 'customer' | 'vendor' | 'admin';
  idToken: string;
  createdAt?: string;
  getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }>;
}

interface AuthResponse {
  message: string;
  user: {
    uid: string;
    email: string;
    displayName: string;
    phoneNumber: string | null;
    role: 'customer' | 'vendor' | 'admin';
  };
  idToken: string;
}

let currentUser: LocalUser | null = null;
const authStateCallbacks: ((user: LocalUser | null) => void)[] = [];

const contentClientId = import.meta.env.VITE_CONTENT_CLIENT_ID || 'urban-tanker';
const API_URL = import.meta.env.DEV ? 'http://localhost:5000' : (import.meta.env.VITE_API_BASE_URL || 'https://urban-tanker-backend.onrender.com');
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const RESET_FUNCTION_URL = import.meta.env.VITE_RESET_FUNCTION_URL || 'https://us-central1-urban-tanker-landing.cloudfunctions.net/resetDatabasePassword';

function createUserObject(data: AuthResponse['user'], token: string): LocalUser {
  return {
    uid: data.uid,
    displayName: data.displayName,
    email: data.email,
    phoneNumber: data.phoneNumber,
    role: data.role,
    idToken: token,
    getIdTokenResult: async () => ({
      claims: { role: data.role }
    })
  };
}

async function makeAuthRequest(endpoint: string, body: Record<string, unknown>) {
  try {
    const response = await fetch(`${API_URL}/api/auth${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.errors?.[0]?.msg || 'Authentication failed');
    }

    return data as AuthResponse;
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function signInWithGoogle(): Promise<LocalUser> {
  throw new Error('Google sign-in is unavailable. Use your MongoDB email and password.');
}

export async function signInWithPassword(email: string, password: string, role: LocalUser['role']): Promise<LocalUser> {
  return databaseCredentialAuth('login', email, password, undefined, role);
}

export async function registerWithPassword(
  email: string,
  password: string,
  displayName?: string,
  role: LocalUser['role'] = 'customer'
): Promise<LocalUser> {
  return databaseCredentialAuth('register', email, password, displayName, role);
}

async function databaseCredentialAuth(action: 'login' | 'register', email: string, password: string, displayName?: string, role: LocalUser['role'] = 'customer'): Promise<LocalUser> {
  const payload = await makeAuthRequest(action === 'register' ? '/register' : '/login', { clientId: contentClientId, email, password, displayName, role });
  return createUserObject(payload.user, payload.idToken);
}

export async function requestPasswordReset(email: string): Promise<string> {
  const response = await fetch(RESET_FUNCTION_URL, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'request', clientId: contentClientId, email}) });
  const payload = await response.json() as {message?: string};
  if (!response.ok) throw new Error(payload.message || 'Unable to request a password reset.');
  return payload.message || 'If the account exists, a reset link has been sent.';
}

export async function completePasswordReset(email: string, token: string, password: string): Promise<string> {
  const response = await fetch(RESET_FUNCTION_URL, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'complete', clientId: contentClientId, email, token, password}) });
  const payload = await response.json() as {message?: string};
  if (!response.ok) throw new Error(payload.message || 'Unable to reset the password.');
  return payload.message || 'Password reset successfully.';
}

export async function signOutUser(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  
  if (token) {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with local cleanup even if API call fails
    }
  }
  
  currentUser = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyAuthStateChange(null);
}

export function onAuthStateChanged(callback: (user: LocalUser | null) => void): () => void {
  // Call immediately with current state
  callback(currentUser);
  
  // Register for future changes
  authStateCallbacks.push(callback);
  
  // Return unsubscribe function
  return () => {
    const index = authStateCallbacks.indexOf(callback);
    if (index > -1) authStateCallbacks.splice(index, 1);
  };
}

function notifyAuthStateChange(user: LocalUser | null) {
  authStateCallbacks.forEach(cb => cb(user));
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser(): LocalUser | null {
  return currentUser;
}

// Check for existing session on initialization
export function initializeAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  const userJson = localStorage.getItem(USER_KEY);
  
  if (token && userJson) {
    try {
      const userData = JSON.parse(userJson) as LocalUser;
      currentUser = {
        ...userData,
        idToken: token,
        getIdTokenResult: async () => ({
          claims: { role: userData.role }
        })
      };
      notifyAuthStateChange(currentUser);
    } catch (error) {
      console.error('Failed to restore session:', error);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }
}

// Initialize on module load
initializeAuth();
