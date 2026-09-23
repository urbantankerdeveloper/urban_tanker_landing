import type { Express } from 'express';

export function registerCustomerRoutes(app: Express, deps: any) {
  const { ordersCollection, orderHistoryCollection, notificationsCollection, usersCollection, io, randomInt, createHash, recordOrderHistory, recordNotification, removeDeliveryOtpFields, dispatchOrderNotification } = deps;

  app.post('/api/orders', deps.authenticateToken, async (req: any, res: any) => {
    try {
      const order = req.body && typeof req.body === 'object' ? { ...req.body } : {};
      if (!order.id || !order.service || !order.status) return res.status(400).json({ message: 'Order details are incomplete.' });
      delete order.statusHistory;
      for (const key of Object.keys(order)) if (order[key] === null || order[key] === undefined) delete order[key];
      if (!order.created) order.created = new Date();
      const deliveryOtp = typeof order.deliveryOtp === 'string' ? order.deliveryOtp : '';
      delete order.deliveryOtp;
      if (deliveryOtp) order.deliveryOtpHash = createHash('sha256').update(deliveryOtp).digest('hex');
      order.client_id = req.user.clientId;
      order.owner_uid = req.user.uid;
      order.updated_at = new Date();
      const existing = await ordersCollection.findOne({ id: order.id, client_id: req.user.clientId, owner_uid: req.user.uid }, { projection: { status: 1 } });
      const requestedStatus = order.status;
      if (!existing && requestedStatus === 'Created') order.status = 'Pending acceptance';
      const createdAt = new Date();
      const statusHistory = requestedStatus === 'Created' ? [{ status: 'Created', timestamp: createdAt, actorUid: req.user.uid, actorRole: req.user.role }, { status: 'Pending acceptance', timestamp: createdAt, actorUid: req.user.uid, actorRole: req.user.role }] : [{ status: order.status, timestamp: createdAt, actorUid: req.user.uid, actorRole: req.user.role }];
      const setOnInsert = { statusHistory };
      const update: Record<string, any> = { $set: order, $setOnInsert: setOnInsert };
      if (existing && existing.status !== order.status) update.$push = { statusHistory: { status: order.status, timestamp: new Date(), actorUid: req.user.uid, actorRole: req.user.role } };
      await ordersCollection.updateOne({ id: order.id, client_id: req.user.clientId, owner_uid: req.user.uid }, update, { upsert: true });
      if (!existing) {
        await Promise.all(statusHistory.map((event: any) => recordOrderHistory(order, { status: event.status, actorUid: req.user.uid, actorRole: req.user.role })));
        await Promise.all([
          recordNotification({ clientId: req.user.clientId, recipientRole: 'customer', recipientUid: req.user.uid, orderId: order.id, type: 'booking-created', title: 'Booking created', detail: `${order.service} is waiting for vendor assignment.` }),
          recordNotification({ clientId: req.user.clientId, recipientRole: 'vendor', orderId: order.id, type: 'order-awaiting-action', title: 'New delivery request', detail: `${order.service} · ${order.id}` }),
          recordNotification({ clientId: req.user.clientId, recipientRole: 'admin', orderId: order.id, type: 'order-awaiting-action', title: 'Order awaiting vendor', detail: `${order.id} · ${order.customer || 'Customer'}` }),
        ]);
        await dispatchOrderNotification(order, order.rejectedVendorUids || []);
      } else if (existing.status !== order.status) {
        await recordOrderHistory(order, { status: order.status, actorUid: req.user.uid, actorRole: req.user.role });
      }
      res.status(200).json({ id: order.id });
    } catch (error) {
      console.error('Order persistence error:', error);
      res.status(500).json({ message: 'Unable to save the order.' });
    }
  });

  app.get('/api/orders', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
      const orders = await ordersCollection.find({ client_id: req.user.clientId, owner_uid: req.user.uid }, { projection: { _id: 0, deliveryOtpHash: 0, customerDeliveryOtp: 0 } }).sort({ created: -1 }).limit(100).toArray();
      res.set('Cache-Control', 'no-store');
      res.json({ orders });
    } catch (error) {
      console.error('Customer orders lookup error:', error);
      res.status(500).json({ message: 'Unable to load customer orders.' });
    }
  });

  app.patch('/api/orders/:orderId/cancel', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
      const reason = String(req.body.reason || 'Cancelled by customer.').trim().slice(0, 500);
      const filter = { id: req.params.orderId, client_id: req.user.clientId, owner_uid: req.user.uid, status: { $in: ['Created', 'Pending acceptance', 'Vendor assigned'] } };
      const order = await ordersCollection.findOne(filter, { projection: { _id: 0, service: 1 } });
      if (!order) return res.status(400).json({ message: 'Only pending orders can be cancelled.' });
      const now = new Date();
      const cancellationUpdate: Record<string, any> = { $set: { status: 'Cancelled', cancellationReason: reason, cancelledAt: now, updated_at: now }, $push: { statusHistory: { status: 'Cancelled', timestamp: now, actorUid: req.user.uid, actorRole: req.user.role } } };
      const result = await ordersCollection.updateOne(filter, cancellationUpdate);
      if (!result.matchedCount) return res.status(404).json({ message: 'Order was not found.' });
      await recordOrderHistory({ id: req.params.orderId, client_id: req.user.clientId }, { status: 'Cancelled', actorUid: req.user.uid, actorRole: req.user.role });
      await recordNotification({ clientId: req.user.clientId, recipientRole: 'admin', orderId: req.params.orderId, type: 'cancelled', title: 'Order cancelled', detail: `${req.params.orderId} · Customer cancelled the booking.` });
      io.to(`vendor:${req.user.clientId}`).emit('order:cancelled', { orderId: req.params.orderId });
      res.json({ id: req.params.orderId, status: 'Cancelled' });
    } catch (error) {
      console.error('Customer order cancellation error:', error);
      res.status(500).json({ message: 'Unable to cancel the order.' });
    }
  });

  app.patch('/api/orders/:orderId/reschedule', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
      const scheduledDate = String(req.body.scheduledDate || '').trim();
      const scheduledSlot = String(req.body.scheduledSlot || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) || !scheduledSlot) return res.status(400).json({ message: 'A valid date and delivery slot are required.' });
      const filter = { id: req.params.orderId, client_id: req.user.clientId, owner_uid: req.user.uid, status: { $in: ['Created', 'Pending acceptance', 'Vendor assigned'] } };
      const rescheduleUpdate: Record<string, any> = { $set: { scheduledDate, scheduledSlot, updated_at: new Date() }, $push: { statusHistory: { status: 'Pending acceptance', timestamp: new Date(), actorUid: req.user.uid, actorRole: req.user.role } } };
      const result = await ordersCollection.updateOne(filter, rescheduleUpdate);
      if (!result.matchedCount) return res.status(400).json({ message: 'Only pending orders can be rescheduled.' });
      await recordOrderHistory({ id: req.params.orderId, client_id: req.user.clientId }, { status: 'Pending acceptance', actorUid: req.user.uid, actorRole: req.user.role });
      await recordNotification({ clientId: req.user.clientId, recipientRole: 'admin', orderId: req.params.orderId, type: 'rescheduled', title: 'Order rescheduled', detail: `${req.params.orderId} · ${scheduledDate} · ${scheduledSlot}` });
      res.json({ id: req.params.orderId, scheduledDate, scheduledSlot });
    } catch (error) {
      console.error('Customer order reschedule error:', error);
      res.status(500).json({ message: 'Unable to reschedule the order.' });
    }
  });

  app.patch('/api/orders/:orderId/rating', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
      const rating = Number(req.body.rating);
      const feedback = String(req.body.feedback || '').trim().slice(0, 1000);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: 'A rating from 1 to 5 is required.' });
      const filter = { id: req.params.orderId, client_id: req.user.clientId, owner_uid: req.user.uid, status: 'Delivered' };
      const result = await ordersCollection.updateOne(filter, { $set: { customerRating: rating, customerFeedback: feedback, updated_at: new Date() } });
      if (!result.matchedCount) return res.status(400).json({ message: 'Only delivered orders can be rated.' });
      await recordNotification({ clientId: req.user.clientId, recipientRole: 'admin', orderId: req.params.orderId, type: 'rating-received', title: 'Customer feedback received', detail: `${req.params.orderId} · ${rating}/5` });
      res.json({ id: req.params.orderId, rating, feedback });
    } catch (error) {
      console.error('Customer rating error:', error);
      res.status(500).json({ message: 'Unable to save customer feedback.' });
    }
  });
}
