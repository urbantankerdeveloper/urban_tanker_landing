/**
 * Subscription Service
 * Handles subscription plans, billing, and management
 */

import type { SubscriptionPlan, CustomerSubscription } from './types';
import { API_BASE_URL } from './apiConfig';
import { getAuthToken } from '../../features/auth/auth';

// Default subscription plans
export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-silver',
    name: 'Silver',
    description: 'Perfect for occasional use',
    billingCycle: 'monthly',
    price: 3000,
    deliveriesIncluded: 2,
    discountPercentage: 10,
    features: [
      '2 deliveries per month',
      '10% discount on each delivery',
      'Priority support',
      'Order history',
    ],
    active: true,
  },
  {
    id: 'plan-gold',
    name: 'Gold',
    description: 'Most popular plan',
    billingCycle: 'monthly',
    price: 6500,
    deliveriesIncluded: 5,
    discountPercentage: 15,
    features: [
      '5 deliveries per month',
      '15% discount on each delivery',
      'Priority support',
      'Free emergency delivery (1x)',
      'Order history & reports',
    ],
    active: true,
  },
  {
    id: 'plan-platinum',
    name: 'Platinum',
    description: 'Unlimited power',
    billingCycle: 'monthly',
    price: 10000,
    deliveriesIncluded: 999, // Unlimited
    discountPercentage: 25,
    features: [
      'Unlimited deliveries',
      '25% discount on every delivery',
      '24/7 dedicated support',
      'Free emergency delivery (unlimited)',
      'Advanced analytics & reports',
      'Priority scheduling',
    ],
    active: true,
  },
];

/**
 * Get all available subscription plans
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/plans`);

    if (!response.ok) {
      return DEFAULT_SUBSCRIPTION_PLANS;
    }

    const data = await response.json();
    return data.plans || DEFAULT_SUBSCRIPTION_PLANS;
  } catch {
    return DEFAULT_SUBSCRIPTION_PLANS;
  }
}

/**
 * Get a specific subscription plan
 */
export function getSubscriptionPlan(planId: string): SubscriptionPlan | undefined {
  return DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === planId);
}

/**
 * Create a new subscription
 */
export async function createSubscription(
  planId: string,
  paymentMethodId?: string
): Promise<{ subscriptionId: string; orderId?: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}/api/subscriptions/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      planId,
      paymentMethodId,
      autoRenew: true,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create subscription');
  }

  return await response.json();
}

/**
 * Get customer's active subscription
 */
export async function getActiveSubscription(): Promise<CustomerSubscription | null> {
  const token = getAuthToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/active`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Get all subscriptions for customer
 */
export async function getCustomerSubscriptions(): Promise<CustomerSubscription[]> {
  const token = getAuthToken();
  if (!token) {
    return [];
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.subscriptions || [];
  } catch {
    return [];
  }
}

/**
 * Upgrade subscription to a new plan
 */
export async function upgradeSubscription(
  subscriptionId: string,
  newPlanId: string
): Promise<{ success: boolean; newSubscriptionId: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/subscriptions/${subscriptionId}/upgrade`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ newPlanId }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to upgrade subscription');
  }

  return await response.json();
}

/**
 * Downgrade subscription to a new plan
 */
export async function downgradeSubscription(
  subscriptionId: string,
  newPlanId: string
): Promise<{ success: boolean }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/subscriptions/${subscriptionId}/downgrade`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ newPlanId }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to downgrade subscription');
  }

  return await response.json();
}

/**
 * Pause a subscription
 */
export async function pauseSubscription(
  subscriptionId: string
): Promise<{ success: boolean }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/subscriptions/${subscriptionId}/pause`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ pausedUntil: new Date().toISOString() }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to pause subscription');
  }

  return await response.json();
}

/**
 * Resume a paused subscription
 */
export async function resumeSubscription(
  subscriptionId: string
): Promise<{ success: boolean }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/subscriptions/${subscriptionId}/resume`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to resume subscription');
  }

  return await response.json();
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  reason?: string
): Promise<{ success: boolean; refundAmount?: number }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/subscriptions/${subscriptionId}/cancel`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to cancel subscription');
  }

  return await response.json();
}

/**
 * Get subscription billing history
 */
export async function getSubscriptionBillingHistory(
  subscriptionId: string,
  limit: number = 12
): Promise<
  Array<{
    date: string;
    amount: number;
    status: 'paid' | 'pending' | 'failed';
  }>
> {
  const token = getAuthToken();
  if (!token) {
    return [];
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/subscriptions/${subscriptionId}/billing-history?limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.billingHistory || [];
  } catch {
    return [];
  }
}

/**
 * Check if subscription includes delivery (has remaining deliveries or unlimited)
 */
export function canUseSubscriptionDelivery(
  subscription: CustomerSubscription
): boolean {
  return subscription.status === 'active' && subscription.remainingDeliveries > 0;
}

/**
 * Get discount percentage from subscription
 */
export function getSubscriptionDiscount(
  subscription: CustomerSubscription | null
): number {
  if (!subscription || subscription.status !== 'active') {
    return 0;
  }

  const plan = getSubscriptionPlan(subscription.planId);
  return plan?.discountPercentage || 0;
}

/**
 * Calculate subscription benefit for booking
 */
export function calculateSubscriptionBenefit(
  baseAmount: number,
  subscription: CustomerSubscription | null
): {
  discount: number;
  discountPercentage: number;
  totalAmount: number;
  remainingDeliveries: number;
  usesSubscription: boolean;
} {
  if (!subscription || !canUseSubscriptionDelivery(subscription)) {
    return {
      discount: 0,
      discountPercentage: 0,
      totalAmount: baseAmount,
      remainingDeliveries: 0,
      usesSubscription: false,
    };
  }

  const discountPercentage = getSubscriptionDiscount(subscription);
  const discount = Math.round((baseAmount * discountPercentage) / 100);
  const totalAmount = baseAmount - discount;

  return {
    discount,
    discountPercentage,
    totalAmount,
    remainingDeliveries: subscription.remainingDeliveries - 1,
    usesSubscription: true,
  };
}

/**
 * Format subscription for display
 */
export function formatSubscriptionInfo(
  subscription: CustomerSubscription
): string {
  const plan = getSubscriptionPlan(subscription.planId);
  if (!plan) return '';

  return `${plan.name} • ${subscription.remainingDeliveries} deliveries remaining • Renews on ${new Date(subscription.renewalDate).toLocaleDateString()}`;
}

/**
 * Check if upgrade is beneficial
 */
export function shouldUpgrade(
  currentSubscription: CustomerSubscription,
  newPlanId: string,
  monthlyBookings: number
): boolean {
  const currentPlan = getSubscriptionPlan(currentSubscription.planId);
  const newPlan = getSubscriptionPlan(newPlanId);

  if (!currentPlan || !newPlan) return false;

  // Simple heuristic: upgrade if new plan provides better value
  const currentCostPerDelivery = currentPlan.price / Math.max(1, currentPlan.deliveriesIncluded);
  const newCostPerDelivery = newPlan.price / Math.max(1, newPlan.deliveriesIncluded);

  return newCostPerDelivery < currentCostPerDelivery && monthlyBookings > currentPlan.deliveriesIncluded;
}
