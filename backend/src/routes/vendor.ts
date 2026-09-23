import type { Express } from 'express';

export function registerVendorRoutes(app: Express, deps: any) {
  const { vendorsCollection, vehiclesCollection, driversCollection, ordersCollection, notificationsCollection, usersCollection, io, randomInt, createHash } = deps;

  app.get('/api/vendor/dashboard', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
      const vendor = await vendorsCollection.findOne({ uid: req.user.uid, client_id: req.user.clientId }, { projection: { _id: 0 } });
      const orders = await ordersCollection.find({ client_id: req.user.clientId, $or: [{ assigned_vendor_uid: req.user.uid }, { rejectedVendorUids: req.user.uid }, { status: { $in: ['Created', 'Pending acceptance', 'Vendor assigned'] }, assigned_vendor_uid: { $exists: false } }] }, { projection: { _id: 0, deliveryOtpHash: 0, customerDeliveryOtp: 0 } }).sort({ created: -1 }).limit(100).toArray();
      const visibleOrders = orders.filter((order: any) => order.assigned_vendor_uid === req.user.uid || order.rejectedVendorUids?.includes(req.user.uid) || (vendor?.status === 'active' && (typeof vendor?.latitude !== 'number' || typeof vendor?.longitude !== 'number' || typeof order.deliveryLatitude !== 'number' || typeof order.deliveryLongitude !== 'number' || deps.distanceKm(vendor.latitude, vendor.longitude, order.deliveryLatitude, order.deliveryLongitude) <= deps.vendorDispatchRadiusKm)));
      const vehicles = await vehiclesCollection.find({ client_id: req.user.clientId, vendor_uid: req.user.uid }, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray();
      res.set('Cache-Control', 'no-store');
      res.json({ vendor, vehicles, orders: visibleOrders });
    } catch (error) {
      console.error('Vendor dashboard error:', error);
      res.status(500).json({ message: 'Unable to load vendor data.' });
    }
  });

  app.get('/api/vendor/vehicles', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
    const vehicles = await vehiclesCollection.find({ client_id: req.user.clientId, vendor_uid: req.user.uid }, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray();
    res.json({ vehicles });
  });

  app.post('/api/vendor/vehicles', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
      const registrationNumber = String(req.body.registrationNumber || '').trim().toUpperCase();
      const vehicleType = String(req.body.vehicleType || '').trim();
      const capacity = String(req.body.capacity || '').trim();
      if (!registrationNumber || !vehicleType) return res.status(400).json({ message: 'Registration number and vehicle type are required.' });
      const imageUrl = typeof req.body.imageUrl === 'string' && req.body.imageUrl.length <= 2_000_000 ? req.body.imageUrl : '';
      const parseExpiry = (value: unknown) => { if (!value) return undefined; const date = new Date(String(value)); return Number.isNaN(date.valueOf()) ? undefined : date; };
      const registrationExpiry = parseExpiry(req.body.registrationExpiry);
      const insuranceExpiry = parseExpiry(req.body.insuranceExpiry);
      const permitExpiry = parseExpiry(req.body.permitExpiry);
      const vehicle = { id: deps.randomUUID(), client_id: req.user.clientId, vendor_uid: req.user.uid, registration_number: registrationNumber, vehicle_type: vehicleType, capacity, image_url: imageUrl, ...(registrationExpiry ? { registration_expiry: registrationExpiry } : {}), ...(insuranceExpiry ? { insurance_expiry: insuranceExpiry } : {}), ...(permitExpiry ? { permit_expiry: permitExpiry } : {}), active: false, updated_at: new Date() };
      await vehiclesCollection.insertOne(vehicle);
      res.status(201).json({ vehicle });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return res.status(409).json({ message: 'That vehicle registration is already registered.' });
      console.error('Vendor vehicle creation error:', error);
      res.status(500).json({ message: 'Unable to create vehicle.' });
    }
  });

  app.get('/api/vendor/drivers', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
    const drivers = await driversCollection.find({ client_id: req.user.clientId, vendor_uid: req.user.uid }, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray();
    res.json({ drivers });
  });

  app.post('/api/vendor/drivers', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const address = String(req.body.address || '').trim();
    const addressProof = typeof req.body.addressProof === 'string' && req.body.addressProof.length <= 3_000_000 ? req.body.addressProof : '';
    if (!name || !address) return res.status(400).json({ message: 'Driver name and address are required.' });
    const driver = { id: deps.randomUUID(), client_id: req.user.clientId, vendor_uid: req.user.uid, name, phone, address, address_proof: addressProof, active: false, updated_at: new Date() };
    await driversCollection.insertOne(driver);
    res.status(201).json({ driver });
  });

  app.patch('/api/vendor/drivers/:driverId/status', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
    const active = req.body.active === true;
    const result = await driversCollection.updateOne({ id: req.params.driverId, client_id: req.user.clientId, vendor_uid: req.user.uid }, { $set: { active, updated_at: new Date() } });
    if (!result.matchedCount) return res.status(404).json({ message: 'Driver was not found.' });
    res.json({ id: req.params.driverId, active });
  });

  app.delete('/api/vendor/drivers/:driverId', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
    const filter = { id: req.params.driverId, client_id: req.user.clientId, vendor_uid: req.user.uid };
    const result = await driversCollection.deleteOne(filter);
    if (!result.deletedCount) return res.status(404).json({ message: 'Driver was not found.' });
    await vehiclesCollection.updateMany({ client_id: req.user.clientId, vendor_uid: req.user.uid, driver_id: req.params.driverId }, { $unset: { driver_id: '', driver_name: '', driver_phone: '', driver_active: '' }, $set: { updated_at: new Date() } });
    res.status(204).send();
  });

  app.patch('/api/vendor/vehicles/:vehicleId', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
    const active = Boolean(req.body.active);
    const update: Record<string, any> = { active, updated_at: new Date() };
    if (typeof req.body.driverActive === 'boolean') update.driver_active = req.body.driverActive;
    const vehicle = await vehiclesCollection.findOne({ id: req.params.vehicleId, client_id: req.user.clientId, vendor_uid: req.user.uid }, { projection: { driver_id: 1 } });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle was not found.' });
    if (typeof req.body.driverId === 'string') {
      const driver = await driversCollection.findOne({ id: req.body.driverId, client_id: req.user.clientId, vendor_uid: req.user.uid }, { projection: { id: 1, name: 1, phone: 1, active: 1 } });
      if (!driver) return res.status(404).json({ message: 'Driver was not found.' });
      update.driver_id = driver.id;
      update.driver_name = driver.name;
      update.driver_phone = driver.phone;
      update.driver_active = driver.active;
    }
    const result = await vehiclesCollection.updateOne({ id: req.params.vehicleId, client_id: req.user.clientId, vendor_uid: req.user.uid }, { $set: update });
    if (!result.matchedCount) return res.status(404).json({ message: 'Vehicle was not found.' });
    if (typeof req.body.driverActive === 'boolean') await driversCollection.updateOne({ id: vehicle.driver_id, client_id: req.user.clientId, vendor_uid: req.user.uid }, { $set: { active: req.body.driverActive, updated_at: new Date() } });
    res.json({ id: req.params.vehicleId, active });
  });

  app.delete('/api/vendor/vehicles/:vehicleId', deps.authenticateToken, async (req: any, res: any) => {
    if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
    const vehicle = await vehiclesCollection.findOne({ id: req.params.vehicleId, client_id: req.user.clientId, vendor_uid: req.user.uid }, { projection: { driver_id: 1 } });
    const result = await vehiclesCollection.deleteOne({ id: req.params.vehicleId, client_id: req.user.clientId, vendor_uid: req.user.uid });
    if (!result.deletedCount) return res.status(404).json({ message: 'Vehicle was not found.' });
    if (vehicle?.driver_id) await driversCollection.deleteOne({ id: vehicle.driver_id, client_id: req.user.clientId, vendor_uid: req.user.uid });
    res.status(204).send();
  });

  app.patch('/api/vendor/availability', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
      const account = await usersCollection.findOne({ uid: req.user.uid, client_id: req.user.clientId, role: 'vendor' }, { projection: { approval_status: 1, status: 1 } });
      if (account?.approval_status !== 'approved' && account?.status !== 'active') return res.status(403).json({ message: 'Your vendor account is awaiting administrator approval.' });
      const status = req.body.status === 'active' || req.body.available === true ? 'active' : 'inactive';
      const available = status === 'active';
      await vendorsCollection.updateOne({ uid: req.user.uid, client_id: req.user.clientId }, { $set: { available, status, updated_at: new Date() }, $setOnInsert: { uid: req.user.uid, client_id: req.user.clientId, name: req.user.displayName || 'Vendor', email: req.user.email || '', phone: req.user.phoneNumber || null, driver: req.user.displayName || 'Vendor', zone: '', vehicle: '', capacity: '', rating: '' } }, { upsert: true });
      await usersCollection.updateOne({ uid: req.user.uid, client_id: req.user.clientId, role: 'vendor' }, { $set: { status, available, updated_at: new Date() } });
      res.json({ available, status });
    } catch (error) {
      console.error('Vendor availability error:', error);
      res.status(500).json({ message: 'Unable to update vendor availability.' });
    }
  });

  app.patch('/api/vendor/location', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
      const latitude = Number(req.body.latitude);
      const longitude = Number(req.body.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return res.status(400).json({ message: 'A valid vendor location is required.' });
      await vendorsCollection.updateOne({ uid: req.user.uid, client_id: req.user.clientId }, { $set: { latitude, longitude, location_updated_at: new Date(), updated_at: new Date() } }, { upsert: true });
      res.json({ latitude, longitude });
    } catch (error) {
      console.error('Vendor location error:', error);
      res.status(500).json({ message: 'Unable to update vendor location.' });
    }
  });

  app.patch('/api/vendor/orders/:orderId', deps.authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
      const allowedStatuses = ['Created', 'Pending acceptance', 'Accepted', 'Rejected', 'Vendor assigned', 'Vendor accepted', 'Vendor rejected', 'En route', 'Arrived', 'Delivered'];
      const update: Record<string, any> = {};
      const action = req.body.action;
      let selectedVehicle: Record<string, any> | null = null;
      if (action === 'accept') {
        selectedVehicle = await vehiclesCollection.findOne({ id: req.body.vehicleId, client_id: req.user.clientId, vendor_uid: req.user.uid, active: true }, { projection: { _id: 0 } });
        if (!selectedVehicle) return res.status(400).json({ message: 'Select an active vehicle before accepting the order.' });
        const selectedDriver = await driversCollection.findOne({ id: req.body.driverId, client_id: req.user.clientId, vendor_uid: req.user.uid, active: true });
        if (!selectedDriver) return res.status(400).json({ message: 'Select an active driver before accepting the order.' });
        await vehiclesCollection.updateOne({ id: selectedVehicle.id, client_id: req.user.clientId, vendor_uid: req.user.uid, active: true }, { $set: { driver_id: selectedDriver.id, driver_name: selectedDriver.name, driver_phone: selectedDriver.phone, driver_active: selectedDriver.active, updated_at: new Date() } });
        update.status = 'Accepted';
        update.vendorDecision = 'accepted';
        update.vendorAcceptedAt = new Date();
        update.assigned_vendor_uid = req.user.uid;
        update.vendor = req.user.displayName || 'Assigned vendor';
        update.vendorEmail = req.user.email;
        update.vendorPhone = req.user.phoneNumber || null;
        update.vehicleId = selectedVehicle.id;
        update.vehicleRegistrationNumber = selectedVehicle.registration_number;
        update.vehicleType = selectedVehicle.vehicle_type;
        update.vehicleCapacity = selectedVehicle.capacity;
        update.driverId = selectedDriver.id;
        update.driver = selectedDriver.name;
        update.driverPhone = selectedDriver.phone;
        update.driverActive = selectedDriver.active;
        const customerDeliveryOtp = String(randomInt(100000, 1000000));
        update.customerDeliveryOtp = customerDeliveryOtp;
        update.deliveryOtpHash = createHash('sha256').update(customerDeliveryOtp).digest('hex');
      } else if (action === 'reject') {
        update.status = 'Rejected';
        update.vendorDecision = 'rejected';
        update.vendorRejectedAt = new Date();
        update.vendorRejectionReason = String(req.body.rejectionReason || 'Vendor declined the assignment.').trim().slice(0, 500);
      } else if (allowedStatuses.includes(req.body.status)) update.status = req.body.status;
      if (typeof req.body.eta === 'string') update.eta = req.body.eta;
      if (typeof req.body.vendorLatitude === 'number') update.vendorLatitude = req.body.vendorLatitude;
      if (typeof req.body.vendorLongitude === 'number') update.vendorLongitude = req.body.vendorLongitude;
      if (typeof req.body.deliveryOtp === 'string') {
        const order = await ordersCollection.findOne({ id: req.params.orderId, client_id: req.user.clientId, assigned_vendor_uid: req.user.uid }, { projection: { deliveryOtpHash: 1, status: 1 } });
        if (!order) return res.status(404).json({ message: 'Vendor order was not found.' });
        const submittedOtpHash = createHash('sha256').update(req.body.deliveryOtp).digest('hex');
        if (!order.deliveryOtpHash || submittedOtpHash !== order.deliveryOtpHash) return res.status(400).json({ message: 'The delivery OTP is invalid.' });
        update.status = 'Delivered';
        update.otpVerifiedAt = new Date();
      }
      if (typeof req.body.deliveryProof === 'string' && req.body.deliveryProof.length <= 2_000_000) update.deliveryProofUrl = req.body.deliveryProof;
      if (typeof req.body.vendorLatitude === 'number' || typeof req.body.vendorLongitude === 'number') update.lastLocationUpdatedAt = new Date();
      if (!Object.keys(update).length) return res.status(400).json({ message: 'No valid order update was provided.' });
      const orderFilter = action === 'accept' ? { id: req.params.orderId, client_id: req.user.clientId, $or: [{ assigned_vendor_uid: req.user.uid }, { status: { $in: ['Created', 'Pending acceptance', 'Vendor assigned'] }, assigned_vendor_uid: { $exists: false } }] } : { id: req.params.orderId, client_id: req.user.clientId, $or: [{ assigned_vendor_uid: req.user.uid }, { status: { $in: ['Created', 'Pending acceptance', 'Vendor assigned'] }, assigned_vendor_uid: { $exists: false } }] };
      const existing = await ordersCollection.findOne(orderFilter, { projection: { _id: 0, status: 1, owner_uid: 1, customerEmail: 1, customerPhone: 1 } });
      if (!existing) {
        const orderExists = await ordersCollection.findOne({ id: req.params.orderId, client_id: req.user.clientId }, { projection: { assigned_vendor_uid: 1, status: 1 } });
        if (action === 'accept' && orderExists?.assigned_vendor_uid && orderExists.assigned_vendor_uid !== req.user.uid) return res.status(409).json({ message: 'This order has already been accepted by another vendor.' });
        return res.status(404).json({ message: 'Vendor order was not found for this tenant or vendor.' });
      }
      const updateDocument: Record<string, any> = { $set: update };
      if (update.status && existing.status !== update.status) updateDocument.$push = { statusHistory: { status: update.status, timestamp: new Date(), actorUid: req.user.uid, actorRole: req.user.role, ...(action === 'reject' ? { vendorUid: req.user.uid, rejectionReason: update.vendorRejectionReason } : {}) } };
      if (action === 'reject') updateDocument.$addToSet = { rejectedVendorUids: req.user.uid };
      const result = await ordersCollection.updateOne(orderFilter, updateDocument);
      if (!result.matchedCount) return res.status(404).json({ message: 'Vendor order was not found.' });
      await deps.recordOrderHistory({ id: req.params.orderId, client_id: req.user.clientId }, { status: update.status || existing.status, actorUid: req.user.uid, actorRole: req.user.role, ...(action === 'reject' ? { vendorUid: req.user.uid, rejectionReason: update.vendorRejectionReason } : {}) });
      const notificationTitle = update.status === 'Delivered' ? 'Order delivered' : action === 'reject' ? 'Order rejected' : action === 'accept' ? 'Order accepted' : `Order ${String(update.status || existing.status).toLowerCase()}`;
      await Promise.all([
        deps.recordNotification({ clientId: req.user.clientId, recipientRole: 'admin', orderId: req.params.orderId, type: String(update.status || existing.status).toLowerCase().replace(/\s+/g, '-'), title: notificationTitle, detail: `${req.params.orderId} · ${req.user.displayName || 'Vendor'}` }),
        ...(existing.owner_uid ? [deps.recordNotification({ clientId: req.user.clientId, recipientRole: 'customer', recipientUid: existing.owner_uid, orderId: req.params.orderId, type: String(update.status || existing.status).toLowerCase().replace(/\s+/g, '-'), title: notificationTitle, detail: `${req.params.orderId} · ${req.user.displayName || 'Vendor'}` })] : []),
      ]);
      if (action === 'accept') {
        const customer = existing.customerEmail || existing.customerPhone ? existing : await usersCollection.findOne({ uid: existing.owner_uid, client_id: req.user.clientId, role: 'customer' }, { projection: { _id: 0, email: 1, phoneNumber: 1 } });
        const acceptedOrder = { ...existing, ...update, customerEmail: existing.customerEmail || customer?.email, customerPhone: existing.customerPhone || customer?.phoneNumber };
        if (selectedVehicle) void deps.notifyCustomerOfAcceptance(acceptedOrder, selectedVehicle).catch((error: any) => console.error('Acceptance notification error:', error));
        io.to(`vendor:${req.user.clientId}`).emit('order:accepted', { orderId: req.params.orderId, vendorUid: req.user.uid, vendorName: req.user.displayName || 'Another vendor' });
        if (existing.owner_uid) io.to(`customer:${existing.owner_uid}`).emit('order:accepted', { orderId: req.params.orderId, vendorUid: req.user.uid, vendorName: req.user.displayName || 'Your vendor' });
      } else if (action === 'reject') {
        io.to(`vendor:${req.user.clientId}`).emit('order:rejected', { orderId: req.params.orderId, vendorUid: req.user.uid });
      }
      if (update.status === 'Delivered') io.to(`admin:${req.user.clientId}`).emit('order:delivered', { orderId: req.params.orderId, vendorName: req.user.displayName || 'Vendor' });
      res.json(deps.removeDeliveryOtpFields({ id: req.params.orderId, ...update }));
    } catch (error) {
      console.error('Vendor order update error:', error);
      res.status(500).json({ message: 'Unable to update vendor order.' });
    }
  });
}
