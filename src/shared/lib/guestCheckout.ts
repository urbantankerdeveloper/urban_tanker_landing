/**
 * Guest Checkout Service
 * Handles guest order creation, tracking, and conversion to registered user
 * Configuration loaded from database with 5-minute cache
 */

import type { GuestProfile, GuestOrder } from './types';
import { API_BASE_URL } from './apiConfig';

// Cache for guest order config (5-minute TTL)
let configCache: any = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000;

// Fallback default configuration
const FALLBACK_CONFIG = {
  expiryMinutes: 30,
  otpLength: 6,
  maxOtpAttempts: 3,
};

/**
 * Fetch guest order config from database or use cache
 */
async function getGuestOrderConfig() {
  const now = Date.now();
  
  // Use cache if fresh
  if (configCache && now - configCacheTime < CONFIG_CACHE_TTL) {
    return configCache;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/config/guest_order_config`);
    if (response.ok) {
      configCache = await response.json();
      configCacheTime = now;
      return configCache;
    }
  } catch (error) {
    console.warn('Failed to fetch guest order config from API:', error);
  }

  // Fallback to hardcoded defaults
  return FALLBACK_CONFIG;
}

/**
 * Validate guest profile data
 */
export function validateGuestProfile(profile: Partial<GuestProfile>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!profile.name || profile.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  }

  if (!profile.email || !/^\S+@\S+\.\S+$/.test(profile.email)) {
    errors.push('Enter a valid email address');
  }

  if (!profile.phone) {
    errors.push('Phone number is required');
  } else {
    const normalized = profile.phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(normalized)) {
      errors.push('Enter a valid 10-digit Indian mobile number');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a guest order
 */
export async function createGuestOrder(
  guestProfile: GuestProfile,
  orderData: any
): Promise<{ orderId: string; guestOtp: string }> {
  const token = sessionStorage.getItem('guestToken') || '';
  const config = await getGuestOrderConfig();

  const response = await fetch(`${API_BASE_URL}/api/guest-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({
      guestProfile,
      ...orderData,
      expiresAt: new Date(
        Date.now() + config.expiryMinutes * 60 * 1000
      ).toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create guest order');
  }

  const data = await response.json();
  return {
    orderId: data.orderId,
    guestOtp: data.guestOtp,
  };
}

/**
 * Send OTP to guest email
 */
export async function sendGuestOrderOtp(
  orderId: string,
  email: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/guest-orders/${orderId}/send-otp`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to send OTP');
  }
}

/**
 * Verify OTP and track guest order
 */
export async function verifyGuestOrderOtp(
  orderId: string,
  otp: string
): Promise<GuestOrder> {
  const response = await fetch(
    `${API_BASE_URL}/api/guest-orders/${orderId}/verify-otp`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp }),
    }
  );

  if (!response.ok) {
    throw new Error('Invalid OTP');
  }

  const data = await response.json();
  return data.order;
}

/**
 * Convert guest order to registered user
 */
export async function convertGuestToUser(
  orderId: string,
  email: string,
  password: string,
  name: string,
  phone: string
): Promise<{ userId: string; token: string }> {
  const response = await fetch(
    `${API_BASE_URL}/api/guest-orders/${orderId}/convert-to-user`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name,
        phone,
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to convert to user account');
  }

  const data = await response.json();
  return {
    userId: data.userId,
    token: data.token,
  };
}

/**
 * Check if guest order is still valid (not expired)
 */
export function isGuestOrderValid(expiresAt: string): boolean {
  return new Date(expiresAt) > new Date();
}

/**
 * Get remaining time for guest order (in minutes)
 */
export function getGuestOrderRemainingTime(expiresAt: string): number {
  const remaining = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(remaining / (1000 * 60));
}

/**
 * Create guest token for browser storage
 */
export function createGuestToken(orderId: string, email: string): string {
  return btoa(`${orderId}:${email}:${Date.now()}`);
}

/**
 * Decode guest token
 */
export function decodeGuestToken(
  token: string
): { orderId: string; email: string } | null {
  try {
    const decoded = atob(token);
    const [orderId, email] = decoded.split(':');
    return { orderId, email };
  } catch {
    return null;
  }
}

/**
 * Store guest session in local storage
 */
export function saveGuestSession(orderId: string, profile: GuestProfile): void {
  const session = {
    orderId,
    profile,
    createdAt: new Date().toISOString(),
  };
  sessionStorage.setItem('guestSession', JSON.stringify(session));
}

/**
 * Get guest session from local storage
 */
export function getGuestSession(): { orderId: string; profile: GuestProfile } | null {
  const session = sessionStorage.getItem('guestSession');
  return session ? JSON.parse(session) : null;
}

/**
 * Clear guest session
 */
export function clearGuestSession(): void {
  sessionStorage.removeItem('guestSession');
  sessionStorage.removeItem('guestToken');
}

/**
 * Track guest order without login
 */
export async function trackGuestOrder(
  orderId: string,
  email: string,
  otp: string
): Promise<GuestOrder> {
  return verifyGuestOrderOtp(orderId, otp);
}

/**
 * Export guest order config for use in components
 */
export async function getGuestOrderConfigForDisplay() {
  return getGuestOrderConfig();
}
