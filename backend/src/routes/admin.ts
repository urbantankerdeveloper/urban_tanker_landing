import type { Express } from 'express';

async function sendApprovalStatusEmail(input: { email?: string; name?: string; resource: string; status: 'approved' | 'rejected'; detail: string }): Promise<void> {
  const emailKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.MAIL_FROM;
  if (!emailKey || !emailFrom || !input.email) return;
  const approved = input.status === 'approved';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${emailKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: emailFrom,
      to: [input.email],
      subject: `Urban Tanker ${input.resource} ${approved ? 'approved' : 'requires attention'}`,
      html: `<p>Hello ${input.name || 'there'},</p><p>Your ${input.resource} registration has been <strong>${approved ? 'approved' : 'rejected'}</strong>.</p><p>${input.detail}</p>${approved ? '<p>You can now use it in the Urban Tanker system.</p>' : '<p>Please contact the administrator for more information.</p>'}`,
    }),
  });
}

export function registerAdminRoutes(app: Express, deps: any) {
  const {
    ordersCollection,
    vendorsCollection,
    usersCollection,
    vehiclesCollection,
    driversCollection,
    contentCollection,
    couponsCollection,
    contentCache,
    io,
    notificationHelpers,
    dispatchOrderNotification,
    hashPassword,
  } = deps;

  app.post('/api/admin/coupons', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const code = String(req.body.code || '').trim().toUpperCase();
      const label = String(req.body.label || '').trim();
      const service = typeof req.body.service === 'string' ? req.body.service.trim() : null;
      const discount = Number(req.body.discount);
      const firstBooking = req.body.firstBooking === true;
      if (!/^[A-Z0-9_-]{3,30}$/.test(code) || !label || !Number.isFinite(discount) || discount <= 0) return res.status(400).json({ message: 'Enter a valid code, label, and discount.' });
      const duplicate = await couponsCollection.findOne({ client_id: req.user.clientId, code }, { projection: { _id: 1 } });
      if (duplicate) return res.status(409).json({ message: 'A coupon with that code already exists.' });
      const now = new Date();
      const coupon = { id: deps.randomUUID(), client_id: req.user.clientId, code, label, discount, service, firstBooking, active: true, created_at: now, updated_at: now };
      await couponsCollection.insertOne(coupon);
      res.status(201).json({ coupon });
    } catch (error) {
      const chainedError = new Error('Coupon creation error', { cause: error });
      console.error(chainedError);
      res.status(500).json({ message: 'Unable to create coupon.' });
    }
  });

  app.get('/api/admin/coupons', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const coupons = await couponsCollection.find({ client_id: req.user.clientId }, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray();
      res.json({ coupons });
    } catch (error) {
      const chainedError = new Error('Coupons list error', { cause: error });
      console.error(chainedError);
      res.status(500).json({ message: 'Unable to load coupons.' });
    }
  });

  app.patch('/api/admin/coupons/:couponId/status', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const active = req.body.active === true;
      const result = await couponsCollection.updateOne({ id: req.params.couponId, client_id: req.user.clientId }, { $set: { active, updated_at: new Date() } });
      if (!result.matchedCount) return res.status(404).json({ message: 'Coupon was not found.' });
      res.json({ id: req.params.couponId, active });
    } catch (error) {
      const chainedError = new Error('Coupon status update error', { cause: error });
      console.error(chainedError);
      res.status(500).json({ message: 'Unable to update coupon status.' });
    }
  });

  app.patch('/api/admin/coupons/:couponId', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const label = typeof req.body.label === 'string' ? req.body.label.trim() : undefined;
      const service = typeof req.body.service === 'string' ? req.body.service.trim() : undefined;
      const discount = typeof req.body.discount === 'number' ? req.body.discount : undefined;
      const firstBooking = typeof req.body.firstBooking === 'boolean' ? req.body.firstBooking : undefined;
      const update: Record<string, any> = { updated_at: new Date() };
      if (label) update.label = label;
      if (service !== undefined) update.service = service || null;
      if (discount && discount > 0) update.discount = discount;
      if (firstBooking !== undefined) update.firstBooking = firstBooking;
      const result = await couponsCollection.updateOne({ id: req.params.couponId, client_id: req.user.clientId }, { $set: update });
      if (!result.matchedCount) return res.status(404).json({ message: 'Coupon was not found.' });
      const updatedCoupon = await couponsCollection.findOne({ id: req.params.couponId, client_id: req.user.clientId }, { projection: { _id: 0 } });
      res.json({ coupon: updatedCoupon });
    } catch (error) {
      const chainedError = new Error('Coupon update error', { cause: error });
      console.error(chainedError);
      res.status(500).json({ message: 'Unable to update coupon.' });
    }
  });

  app.delete('/api/admin/coupons/:couponId', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const result = await couponsCollection.deleteOne({ id: req.params.couponId, client_id: req.user.clientId });
      if (!result.deletedCount) return res.status(404).json({ message: 'Coupon was not found.' });
      res.status(204).send();
    } catch (error) {
      const chainedError = new Error('Coupon deletion error', { cause: error });
      console.error(chainedError);
      res.status(500).json({ message: 'Unable to delete coupon.' });
    }
  });

  // ============ OFFERS MANAGEMENT ============

  app.get('/api/admin/offers', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const offers = await deps.offersCollection.find({ client_id: req.user.clientId }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
      res.json({ offers });
    } catch (error) {
      const chainedError = new Error('Offers list error', { cause: error });
      console.error(chainedError);
      res.status(500).json({ message: 'Unable to load offers.' });
    }
  });

  app.post('/api/admin/offers', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const service = String(req.body.service || '').trim();
      const title = String(req.body.title || '').trim();
      const description = String(req.body.description || '').trim();
      const discount = String(req.body.discount || '').trim();
      const minOrder = String(req.body.minOrder || '').trim();
      const validFrom = String(req.body.validFrom || '').trim();
      const validUntil = String(req.body.validUntil || '').trim();
      const icon = String(req.body.icon || 'Package').trim();
      const color = String(req.body.color || 'aqua').trim();
      
      if (!service || !title || !description || !discount) {
        return res.status(400).json({ message: 'Service, title, description, and discount are required.' });
      }
      
      const now = new Date();
      const offer = {
        id: deps.randomUUID(),
        client_id: req.user.clientId,
        service,
        title,
        description,
        discount,
        minOrder,
        validFrom,
        validUntil,
        icon,
        color,
        active: true,
        createdAt: now,
        updatedAt: now
      };
      
      await deps.offersCollection.insertOne(offer);
      res.status(201).json({ offer });
    } catch (error) {
      const chainedError = new Error('Offer creation error', { cause: error });
      console.error(chainedError);
      res.status(500).json({ message: 'Unable to create offer.' });
    }
  });

  app.patch('/api/admin/offers/:offerId', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      
      const update: Record<string, any> = { updatedAt: new Date() };
      if (typeof req.body.service === 'string') update.service = req.body.service.trim();
      if (typeof req.body.title === 'string') update.title = req.body.title.trim();
      if (typeof req.body.description === 'string') update.description = req.body.description.trim();
      if (typeof req.body.discount === 'string') update.discount = req.body.discount.trim();
      if (typeof req.body.minOrder === 'string') update.minOrder = req.body.minOrder.trim();
      if (typeof req.body.validFrom === 'string') update.validFrom = req.body.validFrom.trim();
      if (typeof req.body.validUntil === 'string') update.validUntil = req.body.validUntil.trim();
      if (typeof req.body.icon === 'string') update.icon = req.body.icon.trim();
      if (typeof req.body.color === 'string') update.color = req.body.color.trim();
      if (typeof req.body.active === 'boolean') update.active = req.body.active;
      
      const result = await deps.offersCollection.updateOne(
        { id: req.params.offerId, client_id: req.user.clientId },
        { $set: update }
      );
      
      if (!result.matchedCount) return res.status(404).json({ message: 'Offer was not found.' });
      
      const updatedOffer = await deps.offersCollection.findOne(
        { id: req.params.offerId, client_id: req.user.clientId },
        { projection: { _id: 0 } }
      );
      res.json({ offer: updatedOffer });
    } catch (error) {
      const chainedError = new Error('Offer update error', { cause: error });
      console.error(chainedError);
      res.status(500).json({ message: 'Unable to update offer.' });
    }
  });

  app.patch('/api/admin/offers/:offerId/status', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const active = req.body.active === true;
      const result = await deps.offersCollection.updateOne(
        { id: req.params.offerId, client_id: req.user.clientId },
        { $set: { active, updatedAt: new Date() } }
      );
      if (!result.matchedCount) return res.status(404).json({ message: 'Offer was not found.' });
      res.json({ id: req.params.offerId, active });
    } catch (error) {
      const chainedError = new Error('Offer status update error', { cause: error });
      console.error(chainedError);
      res.status(500).json({ message: 'Unable to update offer status.' });
    }
  });

  app.delete('/api/admin/offers/:offerId', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const result = await deps.offersCollection.deleteOne({
        id: req.params.offerId,
        client_id: req.user.clientId
      });
      if (!result.deletedCount) return res.status(404).json({ message: 'Offer was not found.' });
      res.status(204).send();
    } catch (error) {
      const chainedError = new Error('Offer deletion error', { cause: error });
      console.error(chainedError);
      res.status(500).json({ message: 'Unable to delete offer.' });
    }
  });

  app.get('/api/admin/dashboard', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const clientId = req.user.clientId;
      const [orders, vendors, customerDocuments] = await Promise.all([
        ordersCollection.find({ client_id: clientId }, { projection: { _id: 0, deliveryOtpHash: 0, customerDeliveryOtp: 0 } }).sort({ created: -1 }).limit(500).toArray(),
        vendorsCollection.find({ client_id: clientId }, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray(),
        usersCollection.find({ role: 'customer', $or: [{ client_id: clientId }, { client_id: { $exists: false } }] }, { projection: { _id: 0, uid: 1, email: 1, display_name: 1, phone_number: 1, status: 1, created_at: 1, updated_at: 1 } }).sort({ created_at: -1 }).toArray(),
      ]);
      const revenue = orders.filter((order: any) => order.status === 'Delivered').reduce((total: number, order: any) => total + Number(order.amount || 0), 0);
      const delivered = orders.filter((order: any) => order.status === 'Delivered').length;
      const activeDeliveries = orders.filter((order: any) => !['Delivered', 'Rejected', 'Vendor rejected'].includes(order.status)).length;
      const activeVendors = vendors.filter((vendor: any) => vendor.status === 'active' || vendor.available === true).length;
      const chart = Array.from({ length: 7 }, (_, offset) => {
        const day = new Date();
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - (6 - offset));
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);
        const dayOrders = orders.filter((order: any) => {
          const created = new Date(order.created);
          return !Number.isNaN(created.valueOf()) && created >= day && created < nextDay;
        });
        return { label: day.toLocaleDateString('en-IN', { weekday: 'short' }), water: dayOrders.filter((order: any) => order.service === 'Water tanker').length, sewage: dayOrders.filter((order: any) => order.service === 'Sewage pickup').length };
      });
      const customers = customerDocuments.map((customer: any) => ({ uid: customer.uid, email: customer.email, name: customer.display_name, phone: customer.phone_number, status: customer.status || 'active', createdAt: customer.created_at, updatedAt: customer.updated_at }));
      res.json({ orders, vendors, customers, revenue, delivered, activeDeliveries, activeVendors, chart });
    } catch (error) {
      console.error('Admin dashboard error:', error);
      res.status(500).json({ message: 'Unable to load admin dashboard data.' });
    }
  });

  app.post('/api/admin/orders/:orderId/notify-vendors', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const order = await ordersCollection.findOne({ id: req.params.orderId, client_id: req.user.clientId, status: { $in: ['Created', 'Pending acceptance', 'Rejected', 'Vendor assigned'] }, assigned_vendor_uid: { $exists: false } }, { projection: { _id: 0, deliveryOtpHash: 0, customerDeliveryOtp: 0 } });
      if (!order) return res.status(404).json({ message: 'Only unassigned orders awaiting or retrying vendor acceptance can be sent to vendors.' });
      const eligibleVendorUids = await dispatchOrderNotification(order, order.rejectedVendorUids || []);
      res.json({ orderId: order.id, notified: true, eligibleVendorUids });
    } catch (error) {
      console.error('Vendor notification retry error:', error);
      res.status(500).json({ message: 'Unable to notify vendors about this order.' });
    }
  });

  app.get('/api/admin/orders', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
      const filter: Record<string, any> = { client_id: req.user.clientId };
      if (typeof req.query.before === 'string' && !Number.isNaN(new Date(req.query.before).valueOf())) filter.updated_at = { $lt: new Date(req.query.before) };
      const orders = await ordersCollection.find(filter, { projection: { _id: 0, deliveryOtpHash: 0, customerDeliveryOtp: 0 } }).sort({ updated_at: -1, id: 1 }).limit(limit + 1).toArray();
      const hasMore = orders.length > limit;
      const page = hasMore ? orders.slice(0, limit) : orders;
      const nextCursor = hasMore && page.length ? page[page.length - 1].updated_at : null;
      res.set('Cache-Control', 'no-store');
      res.json({ orders: page, nextCursor, hasMore });
    } catch (error) {
      console.error('Admin order pagination error:', error);
      res.status(500).json({ message: 'Unable to load paginated orders.' });
    }
  });

  app.get('/api/admin/orders/:orderId/history', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const order = await ordersCollection.findOne({ id: req.params.orderId, client_id: req.user.clientId }, { projection: { _id: 0, id: 1 } });
      if (!order) return res.status(404).json({ message: 'Order was not found.' });
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const historyFilter: Record<string, any> = { client_id: req.user.clientId, order_id: req.params.orderId };
      if (typeof req.query.before === 'string' && !Number.isNaN(new Date(req.query.before).valueOf())) historyFilter.timestamp = { $lt: new Date(req.query.before) };
      const history = await deps.orderHistoryCollection.find(historyFilter, { projection: { _id: 0 } }).sort({ timestamp: -1 }).limit(limit + 1).toArray();
      const hasMore = history.length > limit;
      const page = (hasMore ? history.slice(0, limit) : history).reverse();
      const nextCursor = hasMore && history.length ? history[history.length - 1].timestamp : null;
      res.json({ orderId: req.params.orderId, history: page, nextCursor, hasMore });
    } catch (error) {
      console.error('Order history lookup error:', error);
      res.status(500).json({ message: 'Unable to load order history.' });
    }
  });

  app.patch('/api/admin/orders/:orderId/assign', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const vendorUid = String(req.body.vendorUid || '').trim();
      if (!vendorUid) return res.status(400).json({ message: 'A vendor is required.' });
      const vendor = await vendorsCollection.findOne({ uid: vendorUid, client_id: req.user.clientId }, { projection: { _id: 0, uid: 1, name: 1, email: 1, phone: 1 } });
      if (!vendor) return res.status(404).json({ message: 'Vendor was not found.' });
      const filter = { id: req.params.orderId, client_id: req.user.clientId, assigned_vendor_uid: { $exists: false }, status: { $in: ['Created', 'Pending acceptance', 'Rejected', 'Vendor assigned'] } };
      const now = new Date();
      const update: Record<string, any> = { $set: { assigned_vendor_uid: vendorUid, vendor: vendor.name, vendorEmail: vendor.email, vendorPhone: vendor.phone, status: 'Vendor assigned', updated_at: now }, $push: { statusHistory: { status: 'Vendor assigned', timestamp: now, actorUid: req.user.uid, actorRole: req.user.role } } };
      const result = await ordersCollection.updateOne(filter, update);
      if (!result.matchedCount) return res.status(409).json({ message: 'Order is no longer available for manual assignment.' });
      await notificationHelpers.recordOrderHistory({ id: req.params.orderId, client_id: req.user.clientId }, { status: 'Vendor assigned', actorUid: req.user.uid, actorRole: req.user.role, vendorUid });
      await notificationHelpers.recordNotification({ clientId: req.user.clientId, recipientRole: 'vendor', recipientUid: vendorUid, orderId: req.params.orderId, type: 'vendor-assigned', title: 'Order assigned', detail: `${req.params.orderId} was assigned by dispatch.` });
      io.to(`vendor:${req.user.clientId}:${vendorUid}`).emit('order:created', { id: req.params.orderId, status: 'Vendor assigned', assignedVendorUid: vendorUid });
      res.json({ orderId: req.params.orderId, vendorUid, status: 'Vendor assigned' });
    } catch (error) {
      console.error('Manual vendor assignment error:', error);
      res.status(500).json({ message: 'Unable to assign the vendor.' });
    }
  });

  app.post('/api/admin/users', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const role = req.body.role === 'vendor' ? 'vendor' : req.body.role === 'customer' ? 'customer' : '';
      const email = String(req.body.email || '').trim().toLowerCase();
      const displayName = String(req.body.displayName || '').trim();
      const password = String(req.body.password || '');
      const phoneNumber = String(req.body.phoneNumber || '').trim();
      if (!role || !email || !displayName || password.length < 8) return res.status(400).json({ message: 'Role, name, email, and a password of at least 8 characters are required.' });
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'A valid email address is required.' });
      if (phoneNumber && !/^[6-9]\d{9}$/.test(phoneNumber)) return res.status(400).json({ message: 'Invalid Indian phone number.' });
      const clientId = req.user.clientId;
      if (await usersCollection.findOne({ email, client_id: clientId })) return res.status(409).json({ message: 'Email already registered.' });
      const now = new Date();
      const uid = deps.randomUUID();
      const user = { _id: uid, uid, email, password_hash: await hashPassword(password), display_name: displayName, phone_number: phoneNumber || null, role, email_verified: false, phone_verified: false, status: role === 'vendor' ? 'inactive' : 'active', approval_status: role === 'vendor' ? 'pending' : 'approved', available: role === 'vendor' ? false : undefined, created_at: now, updated_at: now, last_login: null, client_id: clientId };
      await usersCollection.insertOne(user);
      if (role === 'vendor') await vendorsCollection.insertOne({ uid, client_id: clientId, name: displayName, email, phone: phoneNumber || null, driver: '', zone: '', vehicle: '', capacity: '', status: 'inactive', approval_status: 'pending', available: false, rating: '', updated_at: now });
      res.status(201).json({ uid, role, name: displayName, email, phone: phoneNumber, status: user.status, available: user.available === true });
    } catch (error) {
      console.error('Admin user creation error:', error);
      res.status(500).json({ message: 'Unable to create account.' });
    }
  });

  app.delete('/api/admin/users/:uid', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      if (req.params.uid === req.user.uid) return res.status(400).json({ message: 'You cannot delete your own admin account.' });
      const filter = { uid: req.params.uid, client_id: req.user.clientId };
      const user = await usersCollection.findOne(filter, { projection: { role: 1 } });
      if (!user || !['customer', 'vendor'].includes(user.role)) return res.status(404).json({ message: 'Account was not found.' });
      await Promise.all([usersCollection.deleteOne(filter), deps.sessionsCollection.deleteMany(filter), user.role === 'vendor' ? vendorsCollection.deleteOne(filter) : Promise.resolve(), user.role === 'vendor' ? vehiclesCollection.deleteMany({ ...filter, vendor_uid: req.params.uid }) : Promise.resolve()]);
      res.status(204).send();
    } catch (error) {
      console.error('Admin user deletion error:', error);
      res.status(500).json({ message: 'Unable to delete account.' });
    }
  });

  app.patch('/api/admin/vendors/:vendorUid/status', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const active = req.body.active === true;
      const status = active ? 'active' : 'inactive';
      const filter = { uid: req.params.vendorUid, client_id: req.user.clientId };
      const account = await usersCollection.findOne({ ...filter, role: 'vendor' }, { projection: { email: 1, display_name: 1, approval_status: 1 } });
      if (!active) {
        const activeOrder = await ordersCollection.findOne({ client_id: req.user.clientId, assigned_vendor_uid: req.params.vendorUid, status: { $in: ['Accepted', 'Vendor accepted', 'En route', 'Arrived'] } }, { projection: { _id: 0, id: 1 } });
        if (activeOrder) return res.status(409).json({ message: `Vendor cannot be set inactive while order ${activeOrder.id} is active.` });
      }
      const vendorResult = await vendorsCollection.updateOne(filter, { $set: { status, available: active, updated_at: new Date() } });
      if (!vendorResult.matchedCount) return res.status(404).json({ message: 'Vendor was not found.' });
      if (active) await vendorsCollection.updateOne(filter, { $set: { approval_status: 'approved' } });
      await usersCollection.updateOne({ ...filter, role: 'vendor' }, { $set: { status, available: active, ...(active ? { approval_status: 'approved' } : {}), updated_at: new Date() } });
      if (active && account?.approval_status !== 'approved') await sendApprovalStatusEmail({ email: account?.email, name: account?.display_name, resource: 'vendor account', status: 'approved', detail: 'Your vendor registration has been verified by the administrator.' }).catch(error => console.error('Vendor approval email error:', error));
      res.json({ uid: req.params.vendorUid, status, available: active });
    } catch (error) {
      console.error('Admin vendor status error:', error);
      res.status(500).json({ message: 'Unable to update vendor status.' });
    }
  });

  app.get('/api/admin/vehicles', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const [vehicles, vendors] = await Promise.all([
      vehiclesCollection.find({ client_id: req.user.clientId }, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray(),
      usersCollection.find({ client_id: req.user.clientId, role: 'vendor' }, { projection: { _id: 0, uid: 1, name: 1, display_name: 1 } }).sort({ updated_at: -1 }).toArray(),
    ]);
    const vendorMap = new Map(vendors.map((vendor: any) => [vendor.uid, vendor.name || vendor.display_name]));
    res.json({ vehicles: vehicles.map((vehicle: any) => ({ id: vehicle.id, registration_number: vehicle.registration_number, vehicle_type: vehicle.vehicle_type, capacity: vehicle.capacity, active: vehicle.active, approval_status: vehicle.approval_status || (vehicle.active ? 'approved' : 'pending'), vendor_uid: vehicle.vendor_uid, vendor_name: vendorMap.get(vehicle.vendor_uid) || 'Unknown vendor', image_url: vehicle.image_url })) });
  });

  app.get('/api/admin/drivers', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const driverFilter = req.query.approvedOnly === 'true' ? { client_id: req.user.clientId, $or: [{ approval_status: 'approved' }, { approval_status: { $exists: false }, active: true }] } : { client_id: req.user.clientId };
    const [drivers, vendors] = await Promise.all([
      driversCollection.find(driverFilter, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray(),
      usersCollection.find({ client_id: req.user.clientId, role: 'vendor' }, { projection: { _id: 0, uid: 1, name: 1, display_name: 1 } }).sort({ updated_at: -1 }).toArray(),
    ]);
    const vendorMap = new Map(vendors.map((vendor: any) => [vendor.uid, vendor.name || vendor.display_name]));
    res.json({ drivers: drivers.map((driver: any) => ({ id: driver.id, name: driver.name, phone: driver.phone, active: driver.active, approval_status: driver.approval_status || (driver.active ? 'approved' : 'pending'), vendor_uid: driver.vendor_uid, vendor_name: vendorMap.get(driver.vendor_uid) || 'Unknown vendor', address: driver.address, address_proof: driver.address_proof })) });
  });

  app.patch('/api/admin/vehicles/:vehicleId/approval', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const approved = req.body.approved === true;
    const vehicle = await vehiclesCollection.findOne({ id: req.params.vehicleId, client_id: req.user.clientId }, { projection: { vendor_uid: 1, registration_number: 1, vehicle_type: 1 } });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle was not found.' });
    const vendor = await usersCollection.findOne({ uid: vehicle.vendor_uid, client_id: req.user.clientId, role: 'vendor' }, { projection: { email: 1, display_name: 1 } });
    const result = await vehiclesCollection.updateOne({ id: req.params.vehicleId, client_id: req.user.clientId }, { $set: { approval_status: approved ? 'approved' : 'rejected', active: approved, updated_at: new Date() } });
    if (!result.matchedCount) return res.status(404).json({ message: 'Vehicle was not found.' });
    await sendApprovalStatusEmail({ email: vendor?.email, name: vendor?.display_name, resource: 'vehicle', status: approved ? 'approved' : 'rejected', detail: `${vehicle.registration_number} · ${vehicle.vehicle_type}` }).catch(error => console.error('Vehicle approval email error:', error));
    res.json({ id: req.params.vehicleId, approved, active: approved, approvalStatus: approved ? 'approved' : 'rejected' });
  });

  app.patch('/api/admin/vehicles/:vehicleId/status', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const active = req.body.active === true;
    const result = await vehiclesCollection.updateOne({ id: req.params.vehicleId, client_id: req.user.clientId }, { $set: { active, updated_at: new Date() } });
    if (!result.matchedCount) return res.status(404).json({ message: 'Vehicle was not found.' });
    res.json({ id: req.params.vehicleId, active });
  });

  app.patch('/api/admin/drivers/:driverId/approval', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const approved = req.body.approved === true;
    const driver = await driversCollection.findOne({ id: req.params.driverId, client_id: req.user.clientId }, { projection: { vendor_uid: 1, name: 1, phone: 1 } });
    if (!driver) return res.status(404).json({ message: 'Driver was not found.' });
    const vendor = await usersCollection.findOne({ uid: driver.vendor_uid, client_id: req.user.clientId, role: 'vendor' }, { projection: { email: 1, display_name: 1 } });
    const result = await driversCollection.updateOne({ id: req.params.driverId, client_id: req.user.clientId }, { $set: { approval_status: approved ? 'approved' : 'rejected', active: approved, updated_at: new Date() } });
    if (!result.matchedCount) return res.status(404).json({ message: 'Driver was not found.' });
    await sendApprovalStatusEmail({ email: vendor?.email, name: vendor?.display_name, resource: 'driver', status: approved ? 'approved' : 'rejected', detail: `${driver.name} · ${driver.phone || 'No phone number'}` }).catch(error => console.error('Driver approval email error:', error));
    res.json({ id: req.params.driverId, approved, active: approved, approvalStatus: approved ? 'approved' : 'rejected' });
  });

  app.patch('/api/admin/drivers/:driverId/status', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const active = req.body.active === true;
    const result = await driversCollection.updateOne({ id: req.params.driverId, client_id: req.user.clientId, approval_status: 'approved' }, { $set: { active, updated_at: new Date() } });
    if (!result.matchedCount) return res.status(404).json({ message: 'Approved driver was not found.' });
    res.json({ id: req.params.driverId, active });
  });

  app.get('/api/admin/vendors/:vendorUid/vehicles', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const vendor = await usersCollection.findOne({ uid: req.params.vendorUid, client_id: req.user.clientId, role: 'vendor' }, { projection: { uid: 1 } });
    if (!vendor) return res.status(404).json({ message: 'Vendor was not found.' });
    const vehicles = await vehiclesCollection.find({ client_id: req.user.clientId, vendor_uid: req.params.vendorUid }, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray();
    res.json({ vehicles });
  });

  app.get('/api/admin/vendors/:vendorUid/drivers', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const vendor = await usersCollection.findOne({ uid: req.params.vendorUid, client_id: req.user.clientId, role: 'vendor' }, { projection: { uid: 1 } });
    if (!vendor) return res.status(404).json({ message: 'Vendor was not found.' });
    const drivers = await driversCollection.find({ client_id: req.user.clientId, vendor_uid: req.params.vendorUid }, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray();
    res.json({ drivers });
  });

  app.post('/api/admin/vendors/:vendorUid/vehicles', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const vendor = await usersCollection.findOne({ uid: req.params.vendorUid, client_id: req.user.clientId, role: 'vendor' }, { projection: { uid: 1 } });
      if (!vendor) return res.status(404).json({ message: 'Vendor was not found.' });
      const registrationNumber = String(req.body.registrationNumber || '').trim().toUpperCase();
      const vehicleType = String(req.body.vehicleType || '').trim();
      const capacity = String(req.body.capacity || '').trim();
      if (!registrationNumber || !vehicleType) return res.status(400).json({ message: 'Registration number and vehicle type are required.' });
      const imageUrl = typeof req.body.imageUrl === 'string' && req.body.imageUrl.length <= 2_000_000 ? req.body.imageUrl : '';
      const parseExpiry = (value: unknown) => { if (!value) return undefined; const date = new Date(String(value)); return Number.isNaN(date.valueOf()) ? undefined : date; };
      const registrationExpiry = parseExpiry(req.body.registrationExpiry);
      const insuranceExpiry = parseExpiry(req.body.insuranceExpiry);
      const permitExpiry = parseExpiry(req.body.permitExpiry);
      const vehicle = { id: deps.randomUUID(), client_id: req.user.clientId, vendor_uid: req.params.vendorUid, registration_number: registrationNumber, vehicle_type: vehicleType, capacity, image_url: imageUrl, ...(registrationExpiry ? { registration_expiry: registrationExpiry } : {}), ...(insuranceExpiry ? { insurance_expiry: insuranceExpiry } : {}), ...(permitExpiry ? { permit_expiry: permitExpiry } : {}), active: false, approval_status: 'pending', updated_at: new Date() };
      await vehiclesCollection.insertOne(vehicle);
      res.status(201).json({ vehicle });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return res.status(409).json({ message: 'That vehicle registration is already registered.' });
      console.error('Admin vehicle creation error:', error);
      res.status(500).json({ message: 'Unable to create vehicle.' });
    }
  });

  app.post('/api/admin/vendors/:vendorUid/drivers', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const vendor = await usersCollection.findOne({ uid: req.params.vendorUid, client_id: req.user.clientId, role: 'vendor' }, { projection: { uid: 1 } });
      if (!vendor) return res.status(404).json({ message: 'Vendor was not found.' });
      const name = String(req.body.name || '').trim();
      const phone = String(req.body.phone || '').trim();
      const address = String(req.body.address || '').trim();
      const addressProof = typeof req.body.addressProof === 'string' && req.body.addressProof.length <= 3_000_000 ? req.body.addressProof : '';
      if (!name || !address) return res.status(400).json({ message: 'Driver name and address are required.' });
      const driver = { id: deps.randomUUID(), client_id: req.user.clientId, vendor_uid: req.params.vendorUid, name, phone, address, address_proof: addressProof, active: false, approval_status: 'pending', updated_at: new Date() };
      await driversCollection.insertOne(driver);
      res.status(201).json({ driver });
    } catch (error) {
      console.error('Admin driver creation error:', error);
      res.status(500).json({ message: 'Unable to create driver.' });
    }
  });
}
