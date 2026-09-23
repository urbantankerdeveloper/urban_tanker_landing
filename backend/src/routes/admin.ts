import type { Express } from 'express';

export function registerAdminRoutes(app: Express, deps: any) {
  const {
    ordersCollection,
    vendorsCollection,
    usersCollection,
    vehiclesCollection,
    driversCollection,
    contentCollection,
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
      const service = typeof req.body.service === 'string' ? req.body.service.trim() : '';
      const discount = Number(req.body.discount);
      const firstBooking = req.body.firstBooking === true;
      if (!/^[A-Z0-9_-]{3,30}$/.test(code) || !label || !Number.isFinite(discount) || discount <= 0) return res.status(400).json({ message: 'Enter a valid code, label, and discount.' });
      const content = await contentCollection.findOne({ client_id: req.user.clientId }, { projection: { _id: 1 } });
      if (!content) return res.status(404).json({ message: 'Content configuration was not found.' });
      const duplicate = await contentCollection.findOne({ client_id: req.user.clientId, coupons: { $elemMatch: { code } } }, { projection: { _id: 1 } });
      if (duplicate) return res.status(409).json({ message: 'A coupon with that code already exists.' });
      const coupon = { code, label, discount, service: service || undefined, firstBooking, active: true };
      const couponUpdate: Record<string, any> = { $push: { coupons: coupon }, $set: { updated_at: new Date() } };
      await contentCollection.updateOne({ client_id: req.user.clientId }, couponUpdate);
      contentCache.delete(req.user.clientId);
      res.status(201).json({ coupon });
    } catch (error) {
      console.error('Coupon creation error:', error);
      res.status(500).json({ message: 'Unable to create coupon.' });
    }
  });

  app.patch('/api/admin/coupons/:code/status', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      const code = String(req.params.code || '').trim().toUpperCase();
      const active = req.body.active === true;
      const result = await contentCollection.updateOne({ client_id: req.user.clientId, 'coupons.code': code }, { $set: { 'coupons.$.active': active, updated_at: new Date() } });
      if (!result.matchedCount) return res.status(404).json({ message: 'Coupon was not found.' });
      contentCache.delete(req.user.clientId);
      res.json({ code, active });
    } catch (error) {
      console.error('Coupon status update error:', error);
      res.status(500).json({ message: 'Unable to update coupon status.' });
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
      const user = { _id: uid, uid, email, password_hash: await hashPassword(password), display_name: displayName, phone_number: phoneNumber || null, role, email_verified: false, phone_verified: false, status: role === 'vendor' ? 'inactive' : 'active', available: role === 'vendor' ? false : undefined, created_at: now, updated_at: now, last_login: null, client_id: clientId };
      await usersCollection.insertOne(user);
      if (role === 'vendor') await vendorsCollection.insertOne({ uid, client_id: clientId, name: displayName, email, phone: phoneNumber || null, driver: '', zone: '', vehicle: '', capacity: '', status: 'inactive', available: false, rating: '', updated_at: now });
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
      if (!active) {
        const activeOrder = await ordersCollection.findOne({ client_id: req.user.clientId, assigned_vendor_uid: req.params.vendorUid, status: { $in: ['Accepted', 'Vendor accepted', 'En route', 'Arrived'] } }, { projection: { _id: 0, id: 1 } });
        if (activeOrder) return res.status(409).json({ message: `Vendor cannot be set inactive while order ${activeOrder.id} is active.` });
      }
      const vendorResult = await vendorsCollection.updateOne(filter, { $set: { status, available: active, updated_at: new Date() } });
      if (!vendorResult.matchedCount) return res.status(404).json({ message: 'Vendor was not found.' });
      await usersCollection.updateOne({ ...filter, role: 'vendor' }, { $set: { status, available: active, updated_at: new Date() } });
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
      usersCollection.find({ client_id: req.user.clientId, role: 'vendor' }, { projection: { _id: 0, uid: 1, name: 1 } }).sort({ updated_at: -1 }).toArray(),
    ]);
    const vendorMap = new Map(vendors.map((vendor: any) => [vendor.uid, vendor.name]));
    res.json({ vehicles: vehicles.map((vehicle: any) => ({ id: vehicle.id, registration_number: vehicle.registration_number, vehicle_type: vehicle.vehicle_type, capacity: vehicle.capacity, active: vehicle.active, vendor_uid: vehicle.vendor_uid, vendor_name: vendorMap.get(vehicle.vendor_uid) || 'Unknown vendor', image_url: vehicle.image_url })) });
  });

  app.get('/api/admin/drivers', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const [drivers, vendors] = await Promise.all([
      driversCollection.find({ client_id: req.user.clientId }, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray(),
      usersCollection.find({ client_id: req.user.clientId, role: 'vendor' }, { projection: { _id: 0, uid: 1, name: 1 } }).sort({ updated_at: -1 }).toArray(),
    ]);
    const vendorMap = new Map(vendors.map((vendor: any) => [vendor.uid, vendor.name]));
    res.json({ drivers: drivers.map((driver: any) => ({ id: driver.id, name: driver.name, phone: driver.phone, active: driver.active, vendor_uid: driver.vendor_uid, vendor_name: vendorMap.get(driver.vendor_uid) || 'Unknown vendor', address: driver.address, address_proof: driver.address_proof })) });
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
      const vehicle = { id: deps.randomUUID(), client_id: req.user.clientId, vendor_uid: req.params.vendorUid, registration_number: registrationNumber, vehicle_type: vehicleType, capacity, image_url: imageUrl, ...(registrationExpiry ? { registration_expiry: registrationExpiry } : {}), ...(insuranceExpiry ? { insurance_expiry: insuranceExpiry } : {}), ...(permitExpiry ? { permit_expiry: permitExpiry } : {}), active: false, updated_at: new Date() };
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
      const driver = { id: deps.randomUUID(), client_id: req.user.clientId, vendor_uid: req.params.vendorUid, name, phone, address, address_proof: addressProof, active: false, updated_at: new Date() };
      await driversCollection.insertOne(driver);
      res.status(201).json({ driver });
    } catch (error) {
      console.error('Admin driver creation error:', error);
      res.status(500).json({ message: 'Unable to create driver.' });
    }
  });
}
