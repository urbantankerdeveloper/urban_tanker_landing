/**
 * Guest Orders API Routes
 * Handles guest checkout, order creation, tracking, and conversion to registered user
 * Database-backed implementation (MongoDB)
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../database/connection.js';

const router = express.Router();

// Cache for guest order config (5-minute TTL)
let guestConfigCache: any = null;
let guestConfigCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000;

/**
 * Get guest order configuration from database or cache
 */
async function getGuestOrderConfig() {
  const now = Date.now();
  
  if (guestConfigCache && now - guestConfigCacheTime < CONFIG_CACHE_TTL) {
    return guestConfigCache;
  }

  try {
    const db = await getDatabase();
    const configDoc = await db.collection('configs').findOne({
      configType: 'guest_order_config',
    });

    if (configDoc?.data) {
      guestConfigCache = configDoc.data;
      guestConfigCacheTime = now;
      return guestConfigCache;
    }
  } catch (error) {
    console.error('Error fetching guest config from DB:', error);
  }

  // Fallback defaults
  return {
    expiryMinutes: 30,
    otpLength: 6,
    maxOtpAttempts: 3,
    maxConversionTime: 1440,
  };
}

/**
 * POST /api/guest-orders
 * Create a new guest order
 */
router.post('/guest-orders', async (req: Request, res: Response) => {
  try {
    const { guestProfile, service, capacity, address, amount } = req.body;

    if (!guestProfile?.email || !guestProfile?.phone || !guestProfile?.name) {
      return res.status(400).json({ error: 'Invalid guest profile' });
    }

    const config = await getGuestOrderConfig();
    const db = await getDatabase();
    const collection = db.collection('guest_orders');

    const orderId = `GO-${randomUUID().substring(0, 8).toUpperCase()}`;
    const guestOtp = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.expiryMinutes * 60 * 1000);

    const guestOrder: any = {
      id: orderId,
      service,
      capacity,
      address,
      amount,
      customer: guestProfile.name,
      customerEmail: guestProfile.email,
      customerPhone: guestProfile.phone,
      status: 'Created',
      vendor: '',
      driver: '',
      eta: '',
      payment: 'pending',
      created: now,
      isGuestOrder: true,
      guestEmail: guestProfile.email,
      guestPhone: guestProfile.phone,
      guestOtp,
      guestOtpVerified: false,
      expiresAt,
      vendorDecision: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await collection.insertOne(guestOrder);

    console.log(`✅ Guest order ${orderId} created for ${guestProfile.email}`);
    console.log(`   OTP: ${guestOtp} (expires in ${config.expiryMinutes} minutes)`);

    res.json({
      orderId,
      guestOtp,
      expiresAt,
      message: 'Guest order created. Check your email for OTP.',
    });
  } catch (error) {
    console.error('Error creating guest order:', error);
    res.status(500).json({ error: 'Failed to create guest order' });
  }
});

/**
 * POST /api/guest-orders/:orderId/send-otp
 * Send OTP to guest email
 */
router.post('/guest-orders/:orderId/send-otp', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { email } = req.body;

    const db = await getDatabase();
    const collection = db.collection('guest_orders');
    const order = await collection.findOne({ id: orderId });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // In production, use email service to send OTP
    console.log(`📧 Sending OTP ${order.guestOtp} to ${email}`);

    res.json({ success: true, message: 'OTP sent to email' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

/**
 * POST /api/guest-orders/:orderId/verify-otp
 * Verify OTP and get order details
 */
router.post('/guest-orders/:orderId/verify-otp', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;

    const db = await getDatabase();
    const collection = db.collection('guest_orders');
    const order = await collection.findOne({ id: orderId });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.guestOtp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Check if order is expired
    if (new Date(order.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Order has expired' });
    }

    // Mark OTP as verified
    await collection.updateOne(
      { id: orderId },
      {
        $set: {
          guestOtpVerified: true,
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      success: true,
      order,
      message: 'OTP verified. You can now track your order.',
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

/**
 * POST /api/guest-orders/:orderId/convert-to-user
 * Convert guest order to registered user account
 */
router.post('/guest-orders/:orderId/convert-to-user', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { email, password, name, phone } = req.body;

    const db = await getDatabase();
    const collection = db.collection('guest_orders');
    const order = await collection.findOne({ id: orderId });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.guestOtpVerified) {
      return res.status(400).json({ error: 'OTP not verified' });
    }

    // In production, create Firebase user and handle account linking
    const userId = randomUUID();
    const token = Buffer.from(`${userId}:${email}`).toString('base64');

    // Update order to link to user
    await collection.updateOne(
      { id: orderId },
      {
        $set: {
          ownerUid: userId,
          updatedAt: new Date(),
        },
      }
    );

    console.log(`✅ Guest order ${orderId} converted to user ${userId}`);

    res.json({
      success: true,
      userId,
      token,
      message: 'Account created successfully',
    });
  } catch (error) {
    console.error('Error converting to user:', error);
    res.status(500).json({ error: 'Failed to convert to user account' });
  }
});

/**
 * GET /api/guest-orders/:orderId
 * Get guest order details
 */
router.get('/guest-orders/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const db = await getDatabase();
    const collection = db.collection('guest_orders');
    const order = await collection.findOne({ id: orderId });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order is expired
    if (new Date(order.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Order has expired' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching guest order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

/**
 * PUT /api/guest-orders/:orderId/payment
 * Update payment status for guest order
 */
router.put('/guest-orders/:orderId/payment', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { paymentId, paymentMethod, amount } = req.body;

    const db = await getDatabase();
    const collection = db.collection('guest_orders');

    const result = await collection.findOneAndUpdate(
      { id: orderId },
      {
        $set: {
          payment: paymentMethod,
          paymentId,
          status: 'Pending acceptance',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log(`✅ Payment recorded for guest order ${orderId}`);

    res.json({
      success: true,
      order: result.value,
      message: 'Payment recorded. Order sent to vendors.',
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

export default router;
