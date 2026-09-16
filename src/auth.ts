// Database-backed Authentication System
// Uses backend API for user management

import { GoogleAuthProvider, signInWithCustomToken, signInWithPopup, signOut, type User } from 'firebase/auth';
import { firebaseAuth, firebaseEnabled } from './firebase';
import { contentClientId } from './cloudStore';

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
const AUTH_FUNCTION_URL = import.meta.env.VITE_AUTH_FUNCTION_URL || 'https://us-central1-urban-tanker-landing.cloudfunctions.net/signInWithDatabaseCredentials';

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

async function createFirebaseUser(firebaseUser: User): Promise<LocalUser> {
  const token = await firebaseUser.getIdToken();
  const tokenResult = await firebaseUser.getIdTokenResult();
  const user = createUserObject({
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Urban Tanker user',
    phoneNumber: firebaseUser.phoneNumber,
    role: (tokenResult.claims.role as LocalUser['role'] | undefined) || 'customer'
  }, token);
  currentUser = user;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifyAuthStateChange(user);
  return user;
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
  if (!firebaseEnabled || !firebaseAuth) {
    throw new Error('Firebase is not configured for Google Sign-In. Check your local Firebase environment settings.');
  }

  const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
  return createFirebaseUser(result.user);
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
  if (!firebaseAuth) throw new Error('Firebase is not configured.');
  let response: Response;
  try {
    response = await fetch(AUTH_FUNCTION_URL, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ action, clientId: contentClientId, email, password, displayName, role }) });
  } catch {
    throw new Error('The database authentication service is unavailable. Deploy the Firebase auth function before signing in.');
  }
  const payload = await response.json() as {customToken?: string; user?: {uid: string; email: string; displayName: string; phoneNumber: string | null; role: LocalUser['role']}; message?: string};
  if (!response.ok || !payload.customToken || !payload.user) throw new Error(payload.message || 'Database authentication failed.');
  const result = await signInWithCustomToken(firebaseAuth, payload.customToken);
  return createFirebaseUser(result.user);
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

export async function signOutFirebaseUser(): Promise<void> {
  if (firebaseAuth) await signOut(firebaseAuth);
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
