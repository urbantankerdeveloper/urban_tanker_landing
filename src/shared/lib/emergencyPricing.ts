/**
 * Emergency Pricing Module
 * Handles price calculations for emergency/immediate delivery bookings
 * Configuration loaded from database with 5-minute cache
 */

import { API_BASE_URL } from './apiConfig.js';

// Cache for emergency config (5-minute TTL)
let configCache: any = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000;

// Default fallback configuration if database is unavailable
const FALLBACK_CONFIG = {
  enabled: true,
  surgePricePercentage: 50,
  applicableServices: ['Water tanker'],
  maxDeliveryTime: 30,
  minBaseAmount: 500,
} as const;

/**
 * Fetch emergency config from database or use cache
 */
async function getEmergencyConfigFromDb() {
  const now = Date.now();
  
  // Use cache if fresh
  if (configCache && now - configCacheTime < CONFIG_CACHE_TTL) {
    return configCache;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/config/emergency-pricing`);
    if (response.ok) {
      configCache = await response.json();
      configCacheTime = now;
      return configCache;
    }
  } catch (error) {
    console.warn('Failed to fetch emergency config from API:', error);
  }

  // Fallback to hardcoded defaults
  return FALLBACK_CONFIG;
}

/**
 * Get the current emergency config
 */
export async function getEmergencyConfig() {
  return getEmergencyConfigFromDb();
}

/**
 * Calculate emergency surcharge based on base amount
 * @param baseAmount - The base booking amount
 * @returns Surge amount to add to base price
 */
export async function calculateEmergencySurge(baseAmount: number): Promise<number> {
  const config = await getEmergencyConfigFromDb();
  
  if (baseAmount < config.minBaseAmount) {
    return 0;
  }
  return Math.round((baseAmount * config.surgePricePercentage) / 100);
}

/**
 * Calculate total amount with emergency surcharge
 * @param baseAmount - Base booking amount
 * @param discount - Optional discount amount (will be subtracted before surge)
 * @param isEmergency - Whether emergency delivery is enabled
 * @returns Object with breakdown of amounts
 */
export async function calculateEmergencyTotal(
  baseAmount: number,
  discount: number = 0,
  isEmergency: boolean = false
): Promise<{
  baseAmount: number;
  discount: number;
  subtotal: number;
  surgePricePercentage: number;
  surge: number;
  totalAmount: number;
  isEmergency: boolean;
}> {
  const config = await getEmergencyConfigFromDb();
  const afterDiscount = Math.max(0, baseAmount - discount);
  const surge = isEmergency ? await calculateEmergencySurge(afterDiscount) : 0;
  const totalAmount = afterDiscount + surge;

  return {
    baseAmount,
    discount,
    subtotal: afterDiscount,
    surgePricePercentage: isEmergency ? config.surgePricePercentage : 0,
    surge,
    totalAmount,
    isEmergency,
  };
}

/**
 * Check if emergency booking is available for given service and time
 * @param service - Service type
 * @param isAllowedTime - Whether current time allows emergency delivery
 * @returns Boolean indicating if emergency is available
 */
export async function isEmergencyAvailable(
  service: string,
  isAllowedTime: boolean = true
): Promise<boolean> {
  const config = await getEmergencyConfigFromDb();
  return (
    config.enabled &&
    isAllowedTime &&
    config.applicableServices.includes(service)
  );
}

/**
 * Format emergency pricing info for display
 * @param baseAmount - Base amount
 * @param discount - Discount amount
 * @param isEmergency - Is emergency enabled
 * @returns Formatted string for UI display
 */
export async function formatEmergencyPricing(
  baseAmount: number,
  discount: number = 0,
  isEmergency: boolean = false
): Promise<string> {
  const calc = await calculateEmergencyTotal(baseAmount, discount, isEmergency);
  
  if (!isEmergency) {
    return `₹${calc.totalAmount}`;
  }

  return `₹${calc.subtotal} + ₹${calc.surge} (${calc.surgePricePercentage}% surge) = ₹${calc.totalAmount}`;
}

/**
 * Get emergency delivery message for user
 * @returns User-friendly message about emergency delivery
 */
export async function getEmergencyDeliveryMessage(): Promise<string> {
  const config = await getEmergencyConfigFromDb();
  return `Emergency delivery ensures immediate supply within ${config.maxDeliveryTime} minutes. A ${config.surgePricePercentage}% surcharge applies to the booking amount.`;
}
