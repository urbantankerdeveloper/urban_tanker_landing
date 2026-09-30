/**
 * Wallet Service
 * Handles wallet balance, transactions, and payments
 */

import type { Wallet, WalletTransaction } from './types';
import { API_BASE_URL } from './apiConfig';
import { getAuthToken } from '../../features/auth/auth';

/**
 * Get wallet balance for current user
 */
export async function getWalletBalance(): Promise<number> {
  const token = getAuthToken();
  if (!token) {
    return 0;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/wallet/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch wallet balance');
    }

    const data = await response.json();
    return data.balance || 0;
  } catch {
    return 0;
  }
}

/**
 * Get full wallet data including transactions
 */
export async function getWallet(): Promise<Wallet | null> {
  const token = getAuthToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/wallet`, {
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
 * Add funds to wallet
 */
export async function addWalletFunds(
  amount: number,
  paymentMethodId?: string
): Promise<{ transactionId: string; orderId?: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}/api/wallet/add-funds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      amount,
      paymentMethodId,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to add funds');
  }

  return await response.json();
}

/**
 * Use wallet balance to pay for booking
 */
export async function useWalletForPayment(
  amount: number,
  orderId: string
): Promise<{ success: boolean; remainingBalance: number }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}/api/wallet/use-credit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      amount,
      orderId,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to process wallet payment');
  }

  return await response.json();
}

/**
 * Get wallet transaction history
 */
export async function getWalletTransactions(
  limit: number = 20,
  offset: number = 0
): Promise<WalletTransaction[]> {
  const token = getAuthToken();
  if (!token) {
    return [];
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/wallet/transactions?limit=${limit}&offset=${offset}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }

    const data = await response.json();
    return data.transactions || [];
  } catch {
    return [];
  }
}

/**
 * Request refund to wallet from order cancellation
 */
export async function requestRefundToWallet(
  orderId: string,
  amount: number,
  reason: string
): Promise<{ transactionId: string; newBalance: number }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}/api/wallet/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      orderId,
      amount,
      reason,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to process refund');
  }

  return await response.json();
}

/**
 * Check if wallet has sufficient balance for payment
 */
export async function canPayWithWallet(amount: number): Promise<boolean> {
  const balance = await getWalletBalance();
  return balance >= amount;
}

/**
 * Format wallet balance for display
 */
export function formatWalletBalance(balance: number): string {
  return `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Calculate wallet payment and remaining amount
 */
export function calculateWalletPayment(
  totalAmount: number,
  walletBalance: number,
  useFullWallet: boolean = false
): {
  fromWallet: number;
  remaining: number;
  walletUsed: boolean;
} {
  if (!useFullWallet && walletBalance < totalAmount) {
    // Only use wallet if requested or if sufficient balance
    return { fromWallet: 0, remaining: totalAmount, walletUsed: false };
  }

  if (walletBalance >= totalAmount) {
    // Full payment from wallet
    return { fromWallet: totalAmount, remaining: 0, walletUsed: true };
  }

  // Partial payment from wallet
  return {
    fromWallet: Math.min(walletBalance, totalAmount),
    remaining: totalAmount - walletBalance,
    walletUsed: true,
  };
}

/**
 * Get wallet payment options
 */
export function getWalletPaymentOptions(
  totalAmount: number,
  walletBalance: number
): Array<{
  label: string;
  fromWallet: number;
  remaining: number;
  disabled: boolean;
}> {
  return [
    {
      label: 'Pay from Wallet Only',
      fromWallet: Math.min(walletBalance, totalAmount),
      remaining: Math.max(0, totalAmount - walletBalance),
      disabled: walletBalance === 0,
    },
    {
      label: 'Pay from Wallet + Other Method',
      fromWallet: Math.min(walletBalance, totalAmount),
      remaining: Math.max(0, totalAmount - walletBalance),
      disabled: walletBalance === 0,
    },
    {
      label: 'Pay with Other Method Only',
      fromWallet: 0,
      remaining: totalAmount,
      disabled: false,
    },
  ];
}

/**
 * Check wallet minimum/maximum limits
 */
export function checkWalletLimits(
  amount: number,
  type: 'add' | 'deduct' = 'add'
): { valid: boolean; message?: string } {
  const WALLET_CONFIG = {
    minimumAdd: 100,
    maximumAdd: 50000,
    minimumBalance: 0,
    maximumBalance: 100000,
  };

  if (type === 'add') {
    if (amount < WALLET_CONFIG.minimumAdd) {
      return {
        valid: false,
        message: `Minimum amount to add is ₹${WALLET_CONFIG.minimumAdd}`,
      };
    }
    if (amount > WALLET_CONFIG.maximumAdd) {
      return {
        valid: false,
        message: `Maximum amount to add is ₹${WALLET_CONFIG.maximumAdd}`,
      };
    }
  }

  return { valid: true };
}
