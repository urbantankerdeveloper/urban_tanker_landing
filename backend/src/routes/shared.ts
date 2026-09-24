import type { Express } from 'express';
import Razorpay from 'razorpay';

export function registerSharedRoutes(app: Express, deps: any) {
  const { notificationsCollection, contentCollection, contentCache, ordersCollection, invoicesCollection, subscriptionsCollection, supportRequestsCollection, usersCollection, razorpay, authenticateToken, recordNotification, captureError } = deps;

  app.post('/api/support/requests', authenticateToken, async (req: any, res: any) => {
    try {
      if (!['customer', 'vendor'].includes(req.user.role)) return res.status(403).json({ message: 'Customer or vendor access is required.' });
      const message = String(req.body.message || '').trim();
      if (!message) return res.status(400).json({ message: 'A support message is required.' });
      const request = { id: deps.randomUUID(), client_id: req.user.clientId, requester_uid: req.user.uid, requester_role: req.user.role, requester_name: req.user.displayName || req.user.email || 'User', subject: String(req.body.subject || 'Support request').trim().slice(0, 160), ...(req.body.orderId ? { order_id: String(req.body.orderId).trim() } : {}), message: message.slice(0, 5000), status: 'open', created_at: new Date(), updated_at: new Date() };
      await supportRequestsCollection.insertOne(request);
      await recordNotification({ clientId: req.user.clientId, recipientRole: 'admin', orderId: request.order_id, type: 'support-request', title: 'New support request', detail: `${request.requester_name} · ${request.subject}` });
      res.status(201).json({ request });
    } catch (error) {
      console.error('Support request creation error:', error);
      res.status(500).json({ message: 'Unable to create support request.' });
    }
  });

  app.get('/api/support/requests', authenticateToken, async (req: any, res: any) => {
    if (!['admin', 'customer', 'vendor'].includes(req.user.role)) return res.status(403).json({ message: 'Access is required.' });
    const filter = req.user.role === 'admin' ? { client_id: req.user.clientId } : { client_id: req.user.clientId, requester_uid: req.user.uid };
    const requests = await supportRequestsCollection.find(filter, { projection: { _id: 0 } }).sort({ updated_at: -1 }).limit(100).toArray();
    res.json({ requests });
  });

  app.patch('/api/support/requests/:requestId', authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const status = ['open', 'in-progress', 'resolved'].includes(req.body.status) ? req.body.status : 'in-progress';
    const resolution = String(req.body.resolution || '').trim().slice(0, 5000);
    const result = await supportRequestsCollection.updateOne({ id: req.params.requestId, client_id: req.user.clientId }, { $set: { status, ...(resolution ? { resolution } : {}), updated_at: new Date() } });
    if (!result.matchedCount) return res.status(404).json({ message: 'Support request was not found.' });
    res.json({ id: req.params.requestId, status, resolution });
  });

  app.get('/api/notifications', authenticateToken, async (req: any, res: any) => {
    try {
      const recipientFilter = req.user.role === 'vendor' ? { $or: [{ recipient_role: 'vendor', recipient_uid: req.user.uid }, { recipient_role: 'vendor', recipient_uid: { $exists: false } }] } : { recipient_role: req.user.role, ...(req.user.role === 'customer' ? { recipient_uid: req.user.uid } : {}) };
      const filter = { client_id: req.user.clientId, ...recipientFilter };
      const notifications = await notificationsCollection.find(filter, { projection: { _id: 0, id: 1, order_id: 1, title: 1, detail: 1, type: 1, created_at: 1, read_at: 1 } }).sort({ created_at: -1 }).limit(25).toArray();
      const unreadCount = await notificationsCollection.countDocuments({ ...filter, read_at: { $exists: false } });
      res.set('Cache-Control', 'no-store');
      res.json({ unreadCount, notifications: notifications.map((notification: any) => ({ id: notification.id, orderId: notification.order_id, title: notification.title, detail: notification.detail, status: notification.type, timestamp: notification.created_at, read: Boolean(notification.read_at) })) });
    } catch (error) {
      console.error('Notifications lookup error:', error);
      res.status(500).json({ message: 'Unable to load notifications.' });
    }
  });

  app.patch('/api/notifications/:notificationId/read', authenticateToken, async (req: any, res: any) => {
    try {
      const recipientFilter = req.user.role === 'vendor' ? { $or: [{ recipient_role: 'vendor', recipient_uid: req.user.uid }, { recipient_role: 'vendor', recipient_uid: { $exists: false } }] } : { recipient_role: req.user.role, ...(req.user.role === 'customer' ? { recipient_uid: req.user.uid } : {}) };
      const result = await notificationsCollection.updateOne({ id: req.params.notificationId, client_id: req.user.clientId, ...recipientFilter }, { $set: { read_at: new Date() } });
      if (!result.matchedCount) return res.status(404).json({ message: 'Notification was not found.' });
      res.status(204).send();
    } catch (error) {
      console.error('Notification read update error:', error);
      res.status(500).json({ message: 'Unable to update notification.' });
    }
  });

  app.get('/api/content/:clientId', async (req: any, res: any) => {
    try {
      const clientId = req.params.clientId;
      const cached = contentCache.get(clientId);
      if (cached && cached.expiresAt > Date.now()) {
        res.set('Cache-Control', 'public, max-age=60');
        return res.json(cached.value);
      }
      const document = await contentCollection.findOne({ client_id: clientId }, { projection: { _id: 0, config: 1, coupons: 1 } });
      if (!document) return res.status(404).json({ message: 'Content configuration was not found.' });
      const value = { ...document.config, coupons: document.coupons || [] };
      contentCache.set(clientId, { value, expiresAt: Date.now() + deps.contentCacheTtlMs });
      res.set('Cache-Control', 'public, max-age=60');
      res.json(value);
    } catch (error) {
      console.error('Content lookup error:', error);
      res.status(500).json({ message: 'Unable to load content configuration.' });
    }
  });

  app.post('/createRazorpayOrder', authenticateToken, async (req: any, res: any) => {
    try {
      const amount = Number(req.body.amount);
      const receipt = typeof req.body.receipt === 'string' ? req.body.receipt : `urban-tanker-${Date.now()}`;
      if (!Number.isInteger(amount) || amount <= 0) return res.status(400).json({ message: 'A valid payment amount is required.' });
      const razorpayOrder = await razorpay.orders.create({ amount, currency: 'INR', receipt });
      return res.json({ orderId: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency, keyId: process.env.RAZORPAY_KEY_ID });
    } catch (error) {
      console.error('Razorpay order creation error:', error);
      return res.status(500).json({ message: 'Unable to create Razorpay order.' });
    }
  });

  app.post('/verifyRazorpayPayment', authenticateToken, async (req: any, res: any) => {
    try {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
      if (typeof razorpayOrderId !== 'string' || typeof razorpayPaymentId !== 'string' || typeof razorpaySignature !== 'string') return res.status(400).json({ message: 'Razorpay payment details are incomplete.' });
      const expectedSignature = deps.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
      const verified = expectedSignature === razorpaySignature;
      if (!verified) return res.status(400).json({ verified: false, message: 'Razorpay payment verification failed.' });
      return res.json({ verified: true, paymentId: razorpayPaymentId, orderId: razorpayOrderId });
    } catch (error) {
      console.error('Razorpay payment verification error:', error);
      return res.status(500).json({ message: 'Unable to verify Razorpay payment.' });
    }
  });

  app.post('/api/admin/orders/:orderId/refund', authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const order = await ordersCollection.findOne({ id: req.params.orderId, client_id: req.user.clientId }, { projection: { _id: 0, paymentId: 1, amount: 1, payment: 1, owner_uid: 1 } });
      if (!order) return res.status(404).json({ message: 'Order was not found.' });
      if (order.payment !== 'Paid' || !order.paymentId) return res.status(400).json({ message: 'This order does not have a refundable Razorpay payment.' });
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: 'Refunds are not configured on the backend.' });
      const refundAmount = Math.round(Number(req.body.amount || order.amount) * 100);
      if (!Number.isInteger(refundAmount) || refundAmount <= 0 || refundAmount > Math.round(Number(order.amount) * 100)) return res.status(400).json({ message: 'A valid refund amount is required.' });
      const refund = await razorpay.payments.refund(order.paymentId, { amount: refundAmount });
      await ordersCollection.updateOne({ id: req.params.orderId, client_id: req.user.clientId }, { $set: { payment: 'Refunded', refundId: refund.id, refundedAt: new Date(), refundAmount: refundAmount / 100, updated_at: new Date() } });
      if (order.owner_uid) await recordNotification({ clientId: req.user.clientId, recipientRole: 'customer', recipientUid: order.owner_uid, orderId: req.params.orderId, type: 'refunded', title: 'Payment refunded', detail: `${req.params.orderId} · Refund initiated.` });
      res.json({ orderId: req.params.orderId, refundId: refund.id, status: 'Refunded' });
    } catch (error) {
      console.error('Payment refund error:', error);
      res.status(500).json({ message: 'Unable to process the refund.' });
    }
  });

  app.get('/api/customer/subscriptions', authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
    const subscriptions = await subscriptionsCollection.find({ client_id: req.user.clientId, owner_uid: req.user.uid }).sort({ created_at: -1 }).toArray();
    res.json({ subscriptions });
  });

  app.post('/api/customer/subscriptions', authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
    const frequency = ['weekly', 'biweekly', 'monthly'].includes(req.body.frequency) ? req.body.frequency : '';
    const subscription = { id: deps.randomUUID(), client_id: req.user.clientId, owner_uid: req.user.uid, service: String(req.body.service || '').trim(), capacity: String(req.body.capacity || '').trim(), frequency, status: 'active', next_delivery: String(req.body.nextDelivery || '').trim(), created_at: new Date() };
    if (!subscription.service || !subscription.capacity || !subscription.frequency || !subscription.next_delivery) return res.status(400).json({ message: 'Service, capacity, frequency, and next delivery are required.' });
    await subscriptionsCollection.insertOne(subscription);
    res.status(201).json({ subscription });
  });

  app.patch('/api/customer/subscriptions/:id', authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
    const status = ['active', 'paused', 'cancelled'].includes(req.body.status) ? req.body.status : '';
    if (!status) return res.status(400).json({ message: 'A valid subscription status is required.' });
    const result = await subscriptionsCollection.updateOne({ id: req.params.id, client_id: req.user.clientId, owner_uid: req.user.uid }, { $set: { status } });
    if (!result.matchedCount) return res.status(404).json({ message: 'Subscription was not found.' });
    res.json({ id: req.params.id, status });
  });

  app.get('/api/orders/:orderId/invoice', authenticateToken, async (req: any, res: any) => {
    const orderFilter = req.user.role === 'admin' ? { id: req.params.orderId, client_id: req.user.clientId } : { id: req.params.orderId, client_id: req.user.clientId, owner_uid: req.user.uid };
    const order = await ordersCollection.findOne(orderFilter, { projection: { _id: 0, id: 1, owner_uid: 1, amount: 1, payment: 1, status: 1, service: 1, capacity: 1, created: 1 } });
    if (!order) return res.status(404).json({ message: 'Order was not found.' });
    const invoice = await invoicesCollection.findOneAndUpdate({ client_id: req.user.clientId, order_id: order.id }, { $setOnInsert: { id: `INV-${order.id}`, client_id: req.user.clientId, order_id: order.id, owner_uid: order.owner_uid, amount: order.amount, status: order.payment === 'Refunded' ? 'refunded' : 'issued', created_at: new Date() } }, { upsert: true, returnDocument: 'after' });
    res.json({ invoice: invoice.value, order });
  });

  app.get('/api/customer/invoices', authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
    const invoices = await invoicesCollection.find({ client_id: req.user.clientId, owner_uid: req.user.uid }).sort({ created_at: -1 }).limit(100).toArray();
    res.json({ invoices });
  });
}
