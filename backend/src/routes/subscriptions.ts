/**
 * Subscriptions API Routes
 * Handles subscription management, billing, and plan operations
 * Database-backed implementation (MongoDB)
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../database/connection.js';

const router = express.Router();

// Cache for subscription plans (5-minute TTL)
let plansCache: any[] = [];
let plansCacheTime = 0;
const PLANS_CACHE_TTL = 5 * 60 * 1000;

/**
 * Get user from auth token
 */
function getAuthUser(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const userId = Buffer.from(token, 'base64').toString().split(':')[0];
    return userId;
  } catch {
    return null;
  }
}

/**
 * Fetch subscription plans from database or cache
 */
async function getSubscriptionPlans() {
  const now = Date.now();
  
  // Use cache if fresh
  if (plansCache.length > 0 && now - plansCacheTime < PLANS_CACHE_TTL) {
    return plansCache;
  }

  try {
    const db = await getDatabase();
    const configDoc = await db.collection('configs').findOne({
      configType: 'subscription_plans',
    });

    if (configDoc?.data?.plans) {
      plansCache = configDoc.data.plans;
      plansCacheTime = now;
      return plansCache;
    }
  } catch (error) {
    console.error('Error fetching plans from DB:', error);
  }

  // Fallback to hardcoded defaults if DB fails
  return [
    {
      id: 'plan-silver',
      name: 'Silver',
      description: 'Perfect for occasional use',
      billingCycle: 'monthly',
      price: 3000,
      deliveriesIncluded: 2,
      discountPercentage: 10,
      features: ['2 deliveries/month', '10% discount', 'Priority support'],
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
      features: ['5 deliveries/month', '15% discount', 'Free emergency (1x)'],
      active: true,
    },
    {
      id: 'plan-platinum',
      name: 'Platinum',
      description: 'Unlimited power',
      billingCycle: 'monthly',
      price: 10000,
      deliveriesIncluded: 999,
      discountPercentage: 25,
      features: ['Unlimited', '25% discount', 'Free emergency (unlimited)'],
      active: true,
    },
  ];
}

/**
 * GET /api/subscriptions/plans
 * Get all available subscription plans
 */
router.get('/subscriptions/plans', async (req: Request, res: Response) => {
  try {
    const plans = await getSubscriptionPlans();
    res.json({ plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

/**
 * GET /api/subscriptions/plans/:planId
 * Get specific subscription plan
 */
router.get('/subscriptions/plans/:planId', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const plans = await getSubscriptionPlans();
    const plan = plans.find((p) => p.id === planId);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json(plan);
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

/**
 * POST /api/subscriptions/subscribe
 * Create a new subscription
 */
router.post('/subscriptions/subscribe', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { planId, autoRenew, paymentMethodId } = req.body;

    const plans = await getSubscriptionPlans();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const db = await getDatabase();
    const collection = db.collection('subscriptions_v2');

    const subscriptionId = randomUUID();
    const now = new Date();
    const renewalDate = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate()
    );

    const subscription: any = {
      id: subscriptionId,
      customerId: userId,
      planId,
      planName: plan.name,
      status: 'active',
      startDate: now,
      renewalDate,
      remainingDeliveries: plan.deliveriesIncluded,
      autoRenew: autoRenew ?? true,
      subscriptionPrice: plan.price,
      nextBillingDate: renewalDate,
      createdAt: now,
      updatedAt: now,
    };

    // Cancel any existing active subscription
    await collection.updateMany(
      { customerId: userId, status: 'active' },
      { $set: { status: 'cancelled', updatedAt: now } }
    );

    // Insert new subscription
    await collection.insertOne(subscription);

    console.log(
      `✅ Subscription ${subscriptionId} created for user ${userId} on plan ${planId}`
    );

    res.json({
      subscriptionId,
      subscription,
      message: 'Subscription created successfully',
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

/**
 * GET /api/subscriptions/active
 * Get customer's active subscription
 */
router.get('/subscriptions/active', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDatabase();
    const collection = db.collection('subscriptions_v2');

    const activeSubscription = await collection.findOne({
      customerId: userId,
      status: 'active',
    });

    if (!activeSubscription) {
      return res.status(404).json({ error: 'No active subscription' });
    }

    res.json(activeSubscription);
  } catch (error) {
    console.error('Error fetching active subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * GET /api/subscriptions
 * Get all subscriptions for user
 */
router.get('/subscriptions', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDatabase();
    const collection = db.collection('subscriptions_v2');

    const userSubscriptions = await collection
      .find({ customerId: userId })
      .toArray();

    res.json({ subscriptions: userSubscriptions });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

/**
 * PUT /api/subscriptions/:id/upgrade
 * Upgrade subscription to new plan
 */
router.put('/subscriptions/:id/upgrade', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { newPlanId } = req.body;

    const plans = await getSubscriptionPlans();
    const newPlan = plans.find((p) => p.id === newPlanId);
    if (!newPlan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const db = await getDatabase();
    const collection = db.collection('subscriptions_v2');

    const now = new Date();
    const result = await collection.findOneAndUpdate(
      { id, customerId: userId },
      {
        $set: {
          planId: newPlanId,
          planName: newPlan.name,
          subscriptionPrice: newPlan.price,
          remainingDeliveries: newPlan.deliveriesIncluded,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({
      success: true,
      newSubscriptionId: id,
      subscription: result.value,
      message: 'Subscription upgraded successfully',
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({ error: 'Failed to upgrade subscription' });
  }
});

/**
 * PUT /api/subscriptions/:id/pause
 * Pause subscription
 */
router.put('/subscriptions/:id/pause', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const db = await getDatabase();
    const collection = db.collection('subscriptions_v2');

    const result = await collection.findOneAndUpdate(
      { id, customerId: userId },
      { $set: { status: 'paused', updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({ success: true, message: 'Subscription paused', subscription: result.value });
  } catch (error) {
    console.error('Error pausing subscription:', error);
    res.status(500).json({ error: 'Failed to pause subscription' });
  }
});

/**
 * PUT /api/subscriptions/:id/cancel
 * Cancel subscription
 */
router.put('/subscriptions/:id/cancel', async (req: Request, res: Response) => {
  try {
    const userId = getAuthUser(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const db = await getDatabase();
    const collection = db.collection('subscriptions_v2');

    const now = new Date();
    const result = await collection.findOneAndUpdate(
      { id, customerId: userId },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: now,
          cancellationReason: reason,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    console.log(`✅ Subscription ${id} cancelled. Reason: ${reason}`);

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      subscription: result.value,
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;
