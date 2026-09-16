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

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

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
  // Note: Google Sign-In would require additional setup with backend
  // For now, throw error and prompt user to use email/password
  throw new Error('Google Sign-In requires additional backend configuration. Please use email and password.');
}

export async function signInWithPassword(email: string, password: string): Promise<LocalUser> {
  const response = await makeAuthRequest('/login', { email, password });
  
  const user = createUserObject(response.user, response.idToken);
  currentUser = user;
  
  // Store token and user info
  localStorage.setItem(TOKEN_KEY, response.idToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  
  notifyAuthStateChange(user);
  return user;
}

export async function registerWithPassword(
  email: string,
  password: string,
  displayName?: string
): Promise<LocalUser> {
  const response = await makeAuthRequest('/register', {
    email,
    password,
    displayName: displayName || email.split('@')[0],
    role: 'customer', // New registrations default to customer role
  });
  
  const user = createUserObject(response.user, response.idToken);
  currentUser = user;
  
  // Store token and user info
  localStorage.setItem(TOKEN_KEY, response.idToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  
  notifyAuthStateChange(user);
  return user;
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
