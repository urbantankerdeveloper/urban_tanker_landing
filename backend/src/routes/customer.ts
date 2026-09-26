import type { Express } from 'express';

export function registerCustomerRoutes(app: Express, deps: any) {
  const { ordersCollection, orderHistoryCollection, notificationsCollection, usersCollection, savedAddressesCollection, io, randomInt, createHash, recordOrderHistory, recordNotification, removeDeliveryOtpFields, dispatchOrderNotification } = deps;

  app.post('/api/orders', deps.authenticateToken, async (req: any, res: any) => {
    let order: Record<string, any> = {};
    try {
      order = req.body && typeof req.body === 'object' ? { ...req.body } : {};
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      console.error('Order persistence error:', { message: errorMessage, stack: errorStack, order: { id: order.id, service: order.service, status: order.status } });
      res.status(500).json({ message: 'Unable to save the order.', error: errorMessage });
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

  // Saved Addresses Endpoints
  app.post('/api/customer/addresses', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
      const { label, address, city, pincode, latitude, longitude } = req.body;
      if (!label || !address || !city || !pincode) return res.status(400).json({ message: 'Address label, address, city, and pincode are required.' });
      const savedAddress = {
        id: deps.randomUUID(),
        client_id: req.user.clientId,
        owner_uid: req.user.uid,
        label: String(label).trim().slice(0, 100),
        address: String(address).trim().slice(0, 500),
        city: String(city).trim().slice(0, 100),
        pincode: String(pincode).trim().slice(0, 10),
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await savedAddressesCollection.insertOne(savedAddress);
      res.status(201).json({ id: savedAddress.id, label: savedAddress.label });
    } catch (error) {
      console.error('Save address error:', error);
      res.status(500).json({ message: 'Unable to save address.' });
    }
  });

  app.get('/api/customer/addresses', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
      const addresses = await savedAddressesCollection.find({ client_id: req.user.clientId, owner_uid: req.user.uid }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
      res.set('Cache-Control', 'no-store');
      res.json({ addresses });
    } catch (error) {
      console.error('Load addresses error:', error);
      res.status(500).json({ message: 'Unable to load addresses.' });
    }
  });

  app.put('/api/customer/addresses/:addressId', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
      const { label, address, city, pincode, latitude, longitude, isActive } = req.body;
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (label !== undefined) updateData.label = String(label).trim().slice(0, 100);
      if (address !== undefined) updateData.address = String(address).trim().slice(0, 500);
      if (city !== undefined) updateData.city = String(city).trim().slice(0, 100);
      if (pincode !== undefined) updateData.pincode = String(pincode).trim().slice(0, 10);
      if (latitude !== undefined) updateData.latitude = typeof latitude === 'number' ? latitude : null;
      if (longitude !== undefined) updateData.longitude = typeof longitude === 'number' ? longitude : null;
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
      const result = await savedAddressesCollection.updateOne({ id: req.params.addressId, client_id: req.user.clientId, owner_uid: req.user.uid }, { $set: updateData });
      if (!result.matchedCount) return res.status(404).json({ message: 'Address not found.' });
      res.json({ id: req.params.addressId, ...updateData });
    } catch (error) {
      console.error('Update address error:', error);
      res.status(500).json({ message: 'Unable to update address.' });
    }
  });

  app.delete('/api/customer/addresses/:addressId', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
      const result = await savedAddressesCollection.deleteOne({ id: req.params.addressId, client_id: req.user.clientId, owner_uid: req.user.uid });
      if (!result.deletedCount) return res.status(404).json({ message: 'Address not found.' });
      res.json({ id: req.params.addressId, deleted: true });
    } catch (error) {
      console.error('Delete address error:', error);
      res.status(500).json({ message: 'Unable to delete address.' });
    }
  });
}
