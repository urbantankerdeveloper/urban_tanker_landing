/**
 * Wallet API Routes
 * Handles wallet balance, transactions, and payment operations
 * Database-backed implementation (MongoDB)
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../database/connection.js';

const router = express.Router();

// Cache for wallet config (5-minute TTL)
let walletConfigCache: any = null;
let walletConfigCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000;

/**
 * Middleware to get user from auth token
 */
function getAuthUser(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    // In production, verify JWT token properly
    const userId = Buffer.from(token, 'base64').toString().split(':')[0];
    return userId;
  } catch {
    return null;
  }
}

/**
 * Get wallet configuration from database or cache
 */
async function getWalletConfig() {
  const now = Date.now();
  
  if (walletConfigCache && now - walletConfigCacheTime < CONFIG_CACHE_TTL) {
    return walletConfigCache;
  }

  try {
    const db = await getDatabase();
    const configDoc = await db.collection('configs').findOne({
      configType: 'wallet_config',
    });

    if (configDoc?.data) {
      walletConfigCache = configDoc.data;
      walletConfigCacheTime = now;
      return walletConfigCache;
    }
  } catch (error) {
    console.error('Error fetching wallet config from DB:', error);
  }

  // Fallback defaults
  return {
    minimumAdd: 100,
    maximumAdd: 50000,
    minimumBalance: 0,
    maximumBalance: 100000,
  };
}

/**
 * Get or create wallet for user in database
 */
async function getOrCreateWallet(userId: string) {
  const db = await getDatabase();
  const collection = db.collection('wallets');

  let wallet = await collection.findOne({ uid: userId });

  if (!wallet) {
    wallet = {
      uid: userId,
      balance: 0,
      currency: 'INR',
      transactions: [],
      totalCredit: 0,
      totalDebit: 0,
      lastUpdated: new Date(),
      createdAt: new Date(),
    } as any;
    await collection.insertOne(wallet);
  }

  return wallet;
}

/**
 * GET /api/wallet/balance
 * Get wallet balance for current user
 */
router.get('/wallet/balance', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const wallet = await getOrCreateWallet(userId);
    res.json({ balance: wallet.balance });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

/**
 * GET /api/wallet
 * Get full wallet data
 */
router.get('/wallet', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const wallet = await getOrCreateWallet(userId);
    res.json(wallet);
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

/**
 * POST /api/wallet/add-funds
 * Add funds to wallet
 */
router.post('/wallet/add-funds', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount, paymentMethodId } = req.body;
    const config = await getWalletConfig();

    if (!amount || amount < config.minimumAdd || amount > config.maximumAdd) {
      return res.status(400).json({
        error: `Amount must be between ${config.minimumAdd} and ${config.maximumAdd}`,
      });
    }

    const db = await getDatabase();
    const collection = db.collection('wallets');
    const transactionId = randomUUID();
    const now = new Date();

    // Get current balance to include in transaction
    const wallet = await getOrCreateWallet(userId);
    const newBalance = wallet.balance + amount;

    // Update wallet with transaction
    const result = await collection.findOneAndUpdate(
      { uid: userId },
      {
        $inc: { balance: amount, totalCredit: amount },
        $push: {
          transactions: {
            id: transactionId,
            type: 'credit',
            amount,
            description: 'Added funds to wallet',
            timestamp: now,
            balance: newBalance,
          },
        },
        $set: { lastUpdated: now },
      } as any,
      { returnDocument: 'after' }
    );

    console.log(
      `✅ Added ₹${amount} to wallet for user ${userId} via ${paymentMethodId}`
    );

    res.json({
      transactionId,
      newBalance: result.value?.balance || 0,
      message: 'Funds added successfully',
    });
  } catch (error) {
    console.error('Error adding funds:', error);
    res.status(500).json({ error: 'Failed to add funds' });
  }
});

/**
 * POST /api/wallet/use-credit
 * Use wallet balance for payment
 */
router.post('/wallet/use-credit', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount, orderId } = req.body;
    const db = await getDatabase();
    const collection = db.collection('wallets');

    const wallet = await getOrCreateWallet(userId);

    if (wallet.balance < amount) {
      return res.status(400).json({
        error: 'Insufficient balance',
        availableBalance: wallet.balance,
      });
    }

    const transactionId = randomUUID();
    const now = new Date();
    const newBalance = wallet.balance - amount;

    // Update wallet with transaction
    const result = await collection.findOneAndUpdate(
      { uid: userId },
      {
        $inc: { balance: -amount, totalDebit: amount },
        $push: {
          transactions: {
            id: transactionId,
            type: 'debit',
            amount,
            description: `Payment for order ${orderId}`,
            timestamp: now,
            orderId,
            balance: newBalance,
          },
        },
        $set: { lastUpdated: now },
      } as any,
      { returnDocument: 'after' }
    );

    console.log(`✅ Used ₹${amount} from wallet for user ${userId} (Order: ${orderId})`);

    res.json({
      success: true,
      transactionId,
      remainingBalance: result.value?.balance || 0,
      message: 'Payment processed from wallet',
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

/**
 * POST /api/wallet/refund
 * Process refund to wallet
 */
router.post('/wallet/refund', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { orderId, amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid refund amount' });
    }

    const db = await getDatabase();
    const collection = db.collection('wallets');

    const wallet = await getOrCreateWallet(userId);
    const transactionId = randomUUID();
    const now = new Date();
    const newBalance = wallet.balance + amount;

    // Update wallet with refund transaction
    const result = await collection.findOneAndUpdate(
      { uid: userId },
      {
        $inc: { balance: amount, totalCredit: amount },
        $push: {
          transactions: {
            id: transactionId,
            type: 'refund',
            amount,
            description: `Refund for order ${orderId} - ${reason}`,
            timestamp: now,
            orderId,
            balance: newBalance,
          },
        },
        $set: { lastUpdated: now },
      } as any,
      { returnDocument: 'after' }
    );

    console.log(`✅ Refund of ₹${amount} processed for user ${userId} (Order: ${orderId})`);

    res.json({
      transactionId,
      newBalance: result.value?.balance || 0,
      message: 'Refund processed successfully',
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

/**
 * GET /api/wallet/transactions
 * Get wallet transaction history
 */
router.get('/wallet/transactions', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const wallet = await getOrCreateWallet(userId);
    const transactions = wallet.transactions
      .slice()
      .reverse()
      .slice(offset, offset + limit);

    res.json({
      transactions,
      total: wallet.transactions?.length || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export default router;
