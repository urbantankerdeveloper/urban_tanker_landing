import express from 'express';
import { createServer } from 'node:http';
import cors from 'cors';
import compression from 'compression';
import { createHash, createHmac, randomInt, randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import platformRoutes from './routes/platform.js';
import { closeConnection, contentCollection, driversCollection, notificationsCollection, orderHistoryCollection, ordersCollection, sessionsCollection, vendorsCollection, usersCollection, vehiclesCollection } from './database/connection.js';
import { authenticateToken } from './middleware/auth.js';
import Razorpay from 'razorpay';
import { hashPassword, hashToken } from './utils/auth.js';
import { Server as SocketServer } from 'socket.io';
import { verifyToken } from './utils/auth.js';
import { captureError, flushMonitoring, initializeMonitoring } from './utils/monitoring.js';

dotenv.config();
initializeMonitoring();

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, { cors: { origin: true, credentials: true } });
const PORT = Number(process.env.PORT || 8080);
const contentCache = new Map();
const contentCacheTtlMs = Number(process.env.CONTENT_CACHE_TTL_MS || 60000);
const vendorDispatchRadiusKm = Number(process.env.VENDOR_DISPATCH_RADIUS_KM || 25);
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID as string,
  key_secret: process.env.RAZORPAY_KEY_SECRET as string,
});

io.use(async (socket, next) => {
  try {
    const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
    const user = token ? verifyToken(token) as Record<string, any> | null : null;
    if (!user?.uid || !['vendor', 'customer', 'admin'].includes(user.role)) return next(new Error('Authenticated access is required.'));
    const clientId = user.clientId || socket.handshake.auth?.clientId || 'urban-tanker';
    const session = await sessionsCollection.findOne({ token_hash: hashToken(token), client_id: clientId, uid: user.uid, role: user.role, expires_at: { $gt: new Date() } });
    if (!session) return next(new Error('Session expired.'));
    socket.data.user = { ...user, clientId };
    next();
  } catch (error) {
    next(error as Error);
  }
});

io.on('connection', socket => {
  if (socket.data.user.role === 'vendor') {
    socket.join(`vendor:${socket.data.user.clientId}`);
    socket.join(`vendor:${socket.data.user.clientId}:${socket.data.user.uid}`);
  }
  if (socket.data.user.role === 'customer') socket.join(`customer:${socket.data.user.uid}`);
  if (socket.data.user.role === 'admin') socket.join(`admin:${socket.data.user.clientId}`);
});

async function notifyCustomerOfAcceptance(order: Record<string, any>, vehicle: Record<string, any>): Promise<void> {
  const message = `Urban Tanker update: your order ${order.id} was accepted by ${order.vendor || 'your vendor'}. Vehicle: ${vehicle.registration_number} (${vehicle.vehicle_type}). Delivery OTP: ${order.customerDeliveryOtp}. Share this OTP only after delivery.`;
  const emailKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.MAIL_FROM;
  if (emailKey && emailFrom && order.customerEmail) {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${emailKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: emailFrom, to: [order.customerEmail], subject: `Order ${order.id} accepted`, html: `<p>${message}</p><p>Vehicle: <strong>${vehicle.registration_number}</strong> · ${vehicle.vehicle_type}</p>` }) });
  }
  const smsSid = process.env.TWILIO_ACCOUNT_SID;
  const smsToken = process.env.TWILIO_AUTH_TOKEN;
  const smsFrom = process.env.TWILIO_FROM_NUMBER;
  if (smsSid && smsToken && smsFrom && order.customerPhone) {
    const auth = Buffer.from(`${smsSid}:${smsToken}`).toString('base64');
    const body = new URLSearchParams({ To: order.customerPhone, From: smsFrom, Body: message });
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${smsSid}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  }
}

function removeDeliveryOtpFields<T extends Record<string, any>>(order: T): Omit<T, 'customerDeliveryOtp' | 'deliveryOtpHash'> {
  const { customerDeliveryOtp, deliveryOtpHash, ...safeOrder } = order;
  return safeOrder;
}

async function recordOrderHistory(order: Record<string, any>, event: { status: string; actorUid?: string; actorRole?: string; vendorUid?: string; rejectionReason?: string }): Promise<void> {
  await orderHistoryCollection.insertOne({
    order_id: order.id,
    client_id: order.client_id,
    status: event.status,
    timestamp: new Date(),
    ...(event.actorUid ? { actor_uid: event.actorUid } : {}),
    ...(event.actorRole ? { actor_role: event.actorRole } : {}),
    ...(event.vendorUid ? { vendor_uid: event.vendorUid } : {}),
    ...(event.rejectionReason ? { rejection_reason: event.rejectionReason } : {}),
  });
}

async function recordNotification(input: { clientId: string; recipientRole: 'customer' | 'vendor' | 'admin'; recipientUid?: string; orderId?: string; type: string; title: string; detail: string }): Promise<void> {
  await notificationsCollection.insertOne({
    id: randomUUID(),
    client_id: input.clientId,
    recipient_role: input.recipientRole,
    ...(input.recipientUid ? { recipient_uid: input.recipientUid } : {}),
    ...(input.orderId ? { order_id: input.orderId } : {}),
    type: input.type,
    title: input.title,
    detail: input.detail,
    created_at: new Date(),
  });
}

function distanceKm(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
  const radians = value => value * Math.PI / 180;
  const deltaLatitude = radians(secondLatitude - firstLatitude);
  const deltaLongitude = radians(secondLongitude - firstLongitude);
  const value = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(firstLatitude)) * Math.cos(radians(secondLatitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

async function dispatchOrderNotification(order: Record<string, any>, excludedVendorUids: string[] = []): Promise<string[]> {
  const [vendors, vehicles] = await Promise.all([
    vendorsCollection.find({ client_id: order.client_id, $or: [{ status: 'active' }, { available: true }] }, { projection: { _id: 0, uid: 1, latitude: 1, longitude: 1 } }).toArray(),
    vehiclesCollection.find({ client_id: order.client_id, active: true, driver_active: true }, { projection: { _id: 0, vendor_uid: 1 } }).toArray(),
  ]);
  const vehicleVendorUids = new Set(vehicles.map(vehicle => vehicle.vendor_uid));
  const eligibleVendorUids = vendors.filter(vendor => {
    if (!vendor.uid || excludedVendorUids.includes(vendor.uid) || !vehicleVendorUids.has(vendor.uid)) return false;
    if (typeof order.deliveryLatitude !== 'number' || typeof order.deliveryLongitude !== 'number' || typeof vendor.latitude !== 'number' || typeof vendor.longitude !== 'number') return true;
    return distanceKm(vendor.latitude, vendor.longitude, order.deliveryLatitude, order.deliveryLongitude) <= vendorDispatchRadiusKm;
  }).map(vendor => vendor.uid);
  const payload = { ...removeDeliveryOtpFields(order), excludedVendorUids };
  for (const vendorUid of eligibleVendorUids) io.to(`vendor:${order.client_id}:${vendorUid}`).emit('order:created', payload);
  return eligibleVendorUids;
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(cors({
  origin: (requestOrigin, callback) => {
    const defaults = [
      'http://localhost:5173',
      'https://urban-tanker-landing.web.app',
      'https://urban-tanker-landing.firebaseapp.com',
      'https://urban-tanker-backend.onrender.com'
    ];
    const allowedOrigins = Array.from(new Set([
      ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : []),
      ...defaults
    ].filter(Boolean)));

    if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Id']
}));

app.use(compression());
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// Request logging middleware
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') console.log(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const recipientFilter = req.user.role === 'vendor'
      ? { $or: [{ recipient_role: 'vendor', recipient_uid: req.user.uid }, { recipient_role: 'vendor', recipient_uid: { $exists: false } }] }
      : { recipient_role: req.user.role, ...(req.user.role === 'customer' ? { recipient_uid: req.user.uid } : {}) };
    const filter = { client_id: req.user.clientId, ...recipientFilter };
    const notifications = await notificationsCollection.find(filter, { projection: { _id: 0, id: 1, order_id: 1, title: 1, detail: 1, type: 1, created_at: 1, read_at: 1 } }).sort({ created_at: -1 }).limit(25).toArray();
    const unreadCount = await notificationsCollection.countDocuments({ ...filter, read_at: { $exists: false } });
    res.set('Cache-Control', 'no-store');
    res.json({ unreadCount, notifications: notifications.map(notification => ({ id: notification.id, orderId: notification.order_id, title: notification.title, detail: notification.detail, status: notification.type, timestamp: notification.created_at, read: Boolean(notification.read_at) })) });
  } catch (error) {
    console.error('Notifications lookup error:', error);
    res.status(500).json({ message: 'Unable to load notifications.' });
  }
});

app.patch('/api/notifications/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const recipientFilter = req.user.role === 'vendor'
      ? { $or: [{ recipient_role: 'vendor', recipient_uid: req.user.uid }, { recipient_role: 'vendor', recipient_uid: { $exists: false } }] }
      : { recipient_role: req.user.role, ...(req.user.role === 'customer' ? { recipient_uid: req.user.uid } : {}) };
    const result = await notificationsCollection.updateOne({ id: req.params.notificationId, client_id: req.user.clientId, ...recipientFilter }, { $set: { read_at: new Date() } });
    if (!result.matchedCount) return res.status(404).json({ message: 'Notification was not found.' });
    res.status(204).send();
  } catch (error) {
    console.error('Notification read update error:', error);
    res.status(500).json({ message: 'Unable to update notification.' });
  }
});

app.get('/api/content/:clientId', async (req, res) => {
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
    contentCache.set(clientId, { value, expiresAt: Date.now() + contentCacheTtlMs });
    res.set('Cache-Control', 'public, max-age=60');
    res.json(value);
  } catch (error) {
    console.error('Content lookup error:', error);
    res.status(500).json({ message: 'Unable to load content configuration.' });
  }
});

app.post('/api/admin/coupons', authenticateToken, async (req, res) => {
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

app.patch('/api/admin/coupons/:code/status', authenticateToken, async (req, res) => {
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

app.get('/api/vendor/dashboard', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
    const vendor = await vendorsCollection.findOne({ uid: req.user.uid, client_id: req.user.clientId }, { projection: { _id: 0 } });
    const orders = await ordersCollection.find({ client_id: req.user.clientId, $or: [{ assigned_vendor_uid: req.user.uid }, { rejectedVendorUids: req.user.uid }, { status: { $in: ['Created', 'Pending acceptance', 'Vendor assigned'] }, assigned_vendor_uid: { $exists: false } }] }, { projection: { _id: 0, deliveryOtpHash: 0, customerDeliveryOtp: 0 } }).sort({ created: -1 }).limit(100).toArray();
    const visibleOrders = orders.filter(order => order.assigned_vendor_uid === req.user.uid || order.rejectedVendorUids?.includes(req.user.uid) || (vendor?.status === 'active' && (typeof vendor?.latitude !== 'number' || typeof vendor?.longitude !== 'number' || typeof order.deliveryLatitude !== 'number' || typeof order.deliveryLongitude !== 'number' || distanceKm(vendor.latitude, vendor.longitude, order.deliveryLatitude, order.deliveryLongitude) <= vendorDispatchRadiusKm)));
    const vehicles = await vehiclesCollection.find({ client_id: req.user.clientId, vendor_uid: req.user.uid }, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray();
    res.set('Cache-Control', 'no-store');
    res.json({ vendor, vehicles, orders: visibleOrders });
  } catch (error) {
    console.error('Vendor dashboard error:', error);
    res.status(500).json({ message: 'Unable to load vendor data.' });
  }
});

app.get('/api/vendor/vehicles', authenticateToken, async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
  const vehicles = await vehiclesCollection.find({ client_id: req.user.clientId, vendor_uid: req.user.uid }, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray();
  res.json({ vehicles });
});

app.post('/api/vendor/vehicles', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
    const registrationNumber = String(req.body.registrationNumber || '').trim().toUpperCase();
    const vehicleType = String(req.body.vehicleType || '').trim();
    const capacity = String(req.body.capacity || '').trim();
    if (!registrationNumber || !vehicleType) return res.status(400).json({ message: 'Registration number and vehicle type are required.' });
    const imageUrl = typeof req.body.imageUrl === 'string' && req.body.imageUrl.length <= 2_000_000 ? req.body.imageUrl : '';
    const now = new Date();
    const parseExpiry = (value: unknown) => {
      if (!value) return undefined;
      const date = new Date(String(value));
      return Number.isNaN(date.valueOf()) ? undefined : date;
    };
    const registrationExpiry = parseExpiry(req.body.registrationExpiry);
    const insuranceExpiry = parseExpiry(req.body.insuranceExpiry);
    const permitExpiry = parseExpiry(req.body.permitExpiry);
    const vehicle = {
      id: randomUUID(),
      client_id: req.user.clientId,
      vendor_uid: req.user.uid,
      registration_number: registrationNumber,
      vehicle_type: vehicleType,
      capacity,
      image_url: imageUrl,
      ...(registrationExpiry ? { registration_expiry: registrationExpiry } : {}),
      ...(insuranceExpiry ? { insurance_expiry: insuranceExpiry } : {}),
      ...(permitExpiry ? { permit_expiry: permitExpiry } : {}),
      active: false,
      updated_at: now,
    };
    await vehiclesCollection.insertOne(vehicle);
    res.status(201).json({ vehicle });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return res.status(409).json({ message: 'That vehicle registration is already registered.' });
    console.error('Vendor vehicle creation error:', error);
    res.status(500).json({ message: 'Unable to create vehicle.' });
  }
});

app.get('/api/vendor/drivers', authenticateToken, async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
  const drivers = await driversCollection.find({ client_id: req.user.clientId, vendor_uid: req.user.uid }, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray();
  res.json({ drivers });
});

app.post('/api/vendor/drivers', authenticateToken, async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const address = String(req.body.address || '').trim();
  const addressProof = typeof req.body.addressProof === 'string' && req.body.addressProof.length <= 3_000_000 ? req.body.addressProof : '';
  if (!name || !address) return res.status(400).json({ message: 'Driver name and address are required.' });
  const driver = { id: randomUUID(), client_id: req.user.clientId, vendor_uid: req.user.uid, name, phone, address, address_proof: addressProof, active: false, updated_at: new Date() };
  await driversCollection.insertOne(driver);
  res.status(201).json({ driver });
});

app.patch('/api/vendor/drivers/:driverId/status', authenticateToken, async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
  const active = req.body.active === true;
  const result = await driversCollection.updateOne({ id: req.params.driverId, client_id: req.user.clientId, vendor_uid: req.user.uid }, { $set: { active, updated_at: new Date() } });
  if (!result.matchedCount) return res.status(404).json({ message: 'Driver was not found.' });
  res.json({ id: req.params.driverId, active });
});

app.delete('/api/vendor/drivers/:driverId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
  const filter = { id: req.params.driverId, client_id: req.user.clientId, vendor_uid: req.user.uid };
  const result = await driversCollection.deleteOne(filter);
  if (!result.deletedCount) return res.status(404).json({ message: 'Driver was not found.' });
  await vehiclesCollection.updateMany({ client_id: req.user.clientId, vendor_uid: req.user.uid, driver_id: req.params.driverId }, { $unset: { driver_id: '', driver_name: '', driver_phone: '', driver_active: '' }, $set: { updated_at: new Date() } });
  res.status(204).send();
});

app.patch('/api/vendor/vehicles/:vehicleId', authenticateToken, async (req, res) => {
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

app.delete('/api/vendor/vehicles/:vehicleId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
  const vehicle = await vehiclesCollection.findOne({ id: req.params.vehicleId, client_id: req.user.clientId, vendor_uid: req.user.uid }, { projection: { driver_id: 1 } });
  const result = await vehiclesCollection.deleteOne({ id: req.params.vehicleId, client_id: req.user.clientId, vendor_uid: req.user.uid });
  if (!result.deletedCount) return res.status(404).json({ message: 'Vehicle was not found.' });
  if (vehicle?.driver_id) await driversCollection.deleteOne({ id: vehicle.driver_id, client_id: req.user.clientId, vendor_uid: req.user.uid });
  res.status(204).send();
});

app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const clientId = req.user.clientId;
    const [orders, vendors, customerDocuments] = await Promise.all([
      ordersCollection.find({ client_id: clientId }, { projection: { _id: 0, deliveryOtpHash: 0, customerDeliveryOtp: 0 } }).sort({ created: -1 }).limit(500).toArray(),
      vendorsCollection.find({ client_id: clientId }, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray(),
      usersCollection.find({ client_id: clientId, role: 'customer' }, { projection: { _id: 0, uid: 1, email: 1, display_name: 1, phone_number: 1, status: 1, created_at: 1, updated_at: 1 } }).sort({ created_at: -1 }).limit(500).toArray(),
    ]);
    const revenue = orders.filter(order => order.status === 'Delivered').reduce((total, order) => total + Number(order.amount || 0), 0);
    const delivered = orders.filter(order => order.status === 'Delivered').length;
    const activeDeliveries = orders.filter(order => !['Delivered', 'Rejected', 'Vendor rejected'].includes(order.status)).length;
    const activeVendors = vendors.filter(vendor => vendor.status === 'active' || vendor.available === true).length;
    const chart = Array.from({ length: 7 }, (_, offset) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (6 - offset));
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const dayOrders = orders.filter(order => {
        const created = new Date(order.created);
        return !Number.isNaN(created.valueOf()) && created >= day && created < nextDay;
      });
      return { label: day.toLocaleDateString('en-IN', { weekday: 'short' }), water: dayOrders.filter(order => order.service === 'Water tanker').length, sewage: dayOrders.filter(order => order.service === 'Sewage pickup').length };
    });
    const customers = customerDocuments.map(customer => ({ uid: customer.uid, email: customer.email, name: customer.display_name, phone: customer.phone_number, status: customer.status || 'active', createdAt: customer.created_at, updatedAt: customer.updated_at }));
    res.json({ orders, vendors, customers, revenue, delivered, activeDeliveries, activeVendors, chart });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Unable to load admin dashboard data.' });
  }
});

app.post('/api/admin/orders/:orderId/notify-vendors', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const order = await ordersCollection.findOne({
      id: req.params.orderId,
      client_id: req.user.clientId,
      status: { $in: ['Created', 'Pending acceptance', 'Rejected', 'Vendor assigned'] },
      assigned_vendor_uid: { $exists: false },
    }, { projection: { _id: 0, deliveryOtpHash: 0, customerDeliveryOtp: 0 } });
    if (!order) return res.status(404).json({ message: 'Only unassigned orders awaiting or retrying vendor acceptance can be sent to vendors.' });
      const eligibleVendorUids = await dispatchOrderNotification(order, order.rejectedVendorUids || []);
    res.json({ orderId: order.id, notified: true, eligibleVendorUids });
  } catch (error) {
    console.error('Vendor notification retry error:', error);
    res.status(500).json({ message: 'Unable to notify vendors about this order.' });
  }
});

app.get('/api/admin/orders', authenticateToken, async (req, res) => {
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

app.get('/api/admin/orders/:orderId/history', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const order = await ordersCollection.findOne({ id: req.params.orderId, client_id: req.user.clientId }, { projection: { _id: 0, id: 1 } });
    if (!order) return res.status(404).json({ message: 'Order was not found.' });
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const historyFilter: Record<string, any> = { client_id: req.user.clientId, order_id: req.params.orderId };
    if (typeof req.query.before === 'string' && !Number.isNaN(new Date(req.query.before).valueOf())) historyFilter.timestamp = { $lt: new Date(req.query.before) };
    const history = await orderHistoryCollection.find(historyFilter, { projection: { _id: 0 } }).sort({ timestamp: -1 }).limit(limit + 1).toArray();
    const hasMore = history.length > limit;
    const page = (hasMore ? history.slice(0, limit) : history).reverse();
    const nextCursor = hasMore && history.length ? history[history.length - 1].timestamp : null;
    res.json({ orderId: req.params.orderId, history: page, nextCursor, hasMore });
  } catch (error) {
    console.error('Order history lookup error:', error);
    res.status(500).json({ message: 'Unable to load order history.' });
  }
});

app.patch('/api/admin/orders/:orderId/assign', authenticateToken, async (req, res) => {
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
    await recordOrderHistory({ id: req.params.orderId, client_id: req.user.clientId }, { status: 'Vendor assigned', actorUid: req.user.uid, actorRole: req.user.role, vendorUid });
    await recordNotification({ clientId: req.user.clientId, recipientRole: 'vendor', recipientUid: vendorUid, orderId: req.params.orderId, type: 'vendor-assigned', title: 'Order assigned', detail: `${req.params.orderId} was assigned by dispatch.` });
    io.to(`vendor:${req.user.clientId}:${vendorUid}`).emit('order:created', { id: req.params.orderId, status: 'Vendor assigned', assignedVendorUid: vendorUid });
    res.json({ orderId: req.params.orderId, vendorUid, status: 'Vendor assigned' });
  } catch (error) {
    console.error('Manual vendor assignment error:', error);
    res.status(500).json({ message: 'Unable to assign the vendor.' });
  }
});

app.post('/api/admin/users', authenticateToken, async (req, res) => {
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
    const uid = randomUUID();
    const user = { _id: uid, uid, email, password_hash: await hashPassword(password), display_name: displayName, phone_number: phoneNumber || null, role, email_verified: false, phone_verified: false, status: role === 'vendor' ? 'inactive' : 'active', available: role === 'vendor' ? false : undefined, created_at: now, updated_at: now, last_login: null, client_id: clientId };
    await usersCollection.insertOne(user);
    if (role === 'vendor') await vendorsCollection.insertOne({ uid, client_id: clientId, name: displayName, email, phone: phoneNumber || null, driver: '', zone: '', vehicle: '', capacity: '', status: 'inactive', available: false, rating: '', updated_at: now });
    res.status(201).json({ uid, role, name: displayName, email, phone: phoneNumber, status: user.status, available: user.available === true });
  } catch (error) {
    console.error('Admin user creation error:', error);
    res.status(500).json({ message: 'Unable to create account.' });
  }
});

app.delete('/api/admin/users/:uid', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    if (req.params.uid === req.user.uid) return res.status(400).json({ message: 'You cannot delete your own admin account.' });
    const filter = { uid: req.params.uid, client_id: req.user.clientId };
    const user = await usersCollection.findOne(filter, { projection: { role: 1 } });
    if (!user || !['customer', 'vendor'].includes(user.role)) return res.status(404).json({ message: 'Account was not found.' });
    await Promise.all([usersCollection.deleteOne(filter), sessionsCollection.deleteMany(filter), user.role === 'vendor' ? vendorsCollection.deleteOne(filter) : Promise.resolve(), user.role === 'vendor' ? vehiclesCollection.deleteMany({ ...filter, vendor_uid: req.params.uid }) : Promise.resolve()]);
    res.status(204).send();
  } catch (error) {
    console.error('Admin user deletion error:', error);
    res.status(500).json({ message: 'Unable to delete account.' });
  }
});

app.patch('/api/admin/vendors/:vendorUid/status', authenticateToken, async (req, res) => {
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

app.get('/api/admin/vendors/:vendorUid/vehicles', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
  const vendor = await usersCollection.findOne({ uid: req.params.vendorUid, client_id: req.user.clientId, role: 'vendor' }, { projection: { uid: 1 } });
  if (!vendor) return res.status(404).json({ message: 'Vendor was not found.' });
  const vehicles = await vehiclesCollection.find({ client_id: req.user.clientId, vendor_uid: req.params.vendorUid }, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray();
  res.json({ vehicles });
});

app.get('/api/admin/vendors/:vendorUid/drivers', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
  const vendor = await usersCollection.findOne({ uid: req.params.vendorUid, client_id: req.user.clientId, role: 'vendor' }, { projection: { uid: 1 } });
  if (!vendor) return res.status(404).json({ message: 'Vendor was not found.' });
  const drivers = await driversCollection.find({ client_id: req.user.clientId, vendor_uid: req.params.vendorUid }, { projection: { _id: 0 } }).sort({ updated_at: -1 }).toArray();
  res.json({ drivers });
});

app.post('/api/admin/vendors/:vendorUid/vehicles', authenticateToken, async (req, res) => {
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
    const vehicle = { id: randomUUID(), client_id: req.user.clientId, vendor_uid: req.params.vendorUid, registration_number: registrationNumber, vehicle_type: vehicleType, capacity, image_url: imageUrl, ...(registrationExpiry ? { registration_expiry: registrationExpiry } : {}), ...(insuranceExpiry ? { insurance_expiry: insuranceExpiry } : {}), ...(permitExpiry ? { permit_expiry: permitExpiry } : {}), active: false, updated_at: new Date() };
    await vehiclesCollection.insertOne(vehicle);
    res.status(201).json({ vehicle });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return res.status(409).json({ message: 'That vehicle registration is already registered.' });
    console.error('Admin vehicle creation error:', error);
    res.status(500).json({ message: 'Unable to create vehicle.' });
  }
});

app.post('/api/admin/vendors/:vendorUid/drivers', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const vendor = await usersCollection.findOne({ uid: req.params.vendorUid, client_id: req.user.clientId, role: 'vendor' }, { projection: { uid: 1 } });
    if (!vendor) return res.status(404).json({ message: 'Vendor was not found.' });
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const address = String(req.body.address || '').trim();
    const addressProof = typeof req.body.addressProof === 'string' && req.body.addressProof.length <= 3_000_000 ? req.body.addressProof : '';
    if (!name || !address) return res.status(400).json({ message: 'Driver name and address are required.' });
    const driver = { id: randomUUID(), client_id: req.user.clientId, vendor_uid: req.params.vendorUid, name, phone, address, address_proof: addressProof, active: false, updated_at: new Date() };
    await driversCollection.insertOne(driver);
    res.status(201).json({ driver });
  } catch (error) {
    console.error('Admin driver creation error:', error);
    res.status(500).json({ message: 'Unable to create driver.' });
  }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
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
    const statusHistory = requestedStatus === 'Created'
      ? [{ status: 'Created', timestamp: createdAt, actorUid: req.user.uid, actorRole: req.user.role }, { status: 'Pending acceptance', timestamp: createdAt, actorUid: req.user.uid, actorRole: req.user.role }]
      : [{ status: order.status, timestamp: createdAt, actorUid: req.user.uid, actorRole: req.user.role }];
    const setOnInsert = { statusHistory };
    const update: Record<string, any> = { $set: order, $setOnInsert: setOnInsert };
    if (existing && existing.status !== order.status) update.$push = { statusHistory: { status: order.status, timestamp: new Date(), actorUid: req.user.uid, actorRole: req.user.role } };
    await ordersCollection.updateOne({ id: order.id, client_id: req.user.clientId, owner_uid: req.user.uid }, update, { upsert: true });
    if (!existing) {
      await Promise.all(statusHistory.map(event => recordOrderHistory(order, { status: event.status, actorUid: req.user.uid, actorRole: req.user.role })));
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

app.get('/api/orders', authenticateToken, async (req, res) => {
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

app.patch('/api/orders/:orderId/cancel', authenticateToken, async (req, res) => {
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

app.patch('/api/orders/:orderId/reschedule', authenticateToken, async (req, res) => {
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

app.patch('/api/orders/:orderId/rating', authenticateToken, async (req, res) => {
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

app.post('/api/admin/orders/:orderId/refund', authenticateToken, async (req, res) => {
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

app.patch('/api/vendor/availability', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
    const status = req.body.status === 'active' || req.body.available === true ? 'active' : 'inactive';
    const available = status === 'active';
    if (!available) {
      const activeOrder = await ordersCollection.findOne({ client_id: req.user.clientId, assigned_vendor_uid: req.user.uid, status: { $in: ['Accepted', 'Vendor accepted', 'En route', 'Arrived'] } }, { projection: { _id: 0, id: 1 } });
      if (activeOrder) return res.status(409).json({ message: `You cannot go offline while order ${activeOrder.id} is active.` });
    }
    await vendorsCollection.updateOne(
      { uid: req.user.uid, client_id: req.user.clientId },
      {
        $set: { available, status, updated_at: new Date() },
        $setOnInsert: { uid: req.user.uid, client_id: req.user.clientId, name: req.user.displayName || 'Vendor', email: req.user.email || '', phone: req.user.phoneNumber || null, driver: req.user.displayName || 'Vendor', zone: '', vehicle: '', capacity: '', rating: '' },
      },
      { upsert: true },
    );
    await usersCollection.updateOne(
      { uid: req.user.uid, client_id: req.user.clientId, role: 'vendor' },
      { $set: { status, available, updated_at: new Date() } },
    );
    res.json({ available, status });
  } catch (error) {
    console.error('Vendor availability error:', error);
    res.status(500).json({ message: 'Unable to update vendor availability.' });
  }
});

app.patch('/api/vendor/location', authenticateToken, async (req, res) => {
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

app.patch('/api/vendor/orders/:orderId', authenticateToken, async (req, res) => {
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
      await vehiclesCollection.updateOne(
        { id: selectedVehicle.id, client_id: req.user.clientId, vendor_uid: req.user.uid, active: true },
        { $set: { driver_id: selectedDriver.id, driver_name: selectedDriver.name, driver_phone: selectedDriver.phone, driver_active: selectedDriver.active, updated_at: new Date() } },
      );
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
    const orderFilter = action === 'accept'
      ? { id: req.params.orderId, client_id: req.user.clientId, $or: [{ assigned_vendor_uid: req.user.uid }, { status: { $in: ['Created', 'Pending acceptance', 'Vendor assigned'] }, assigned_vendor_uid: { $exists: false } }] }
      : {
          id: req.params.orderId,
          client_id: req.user.clientId,
          $or: [
            { assigned_vendor_uid: req.user.uid },
            { status: { $in: ['Created', 'Pending acceptance', 'Vendor assigned'] }, assigned_vendor_uid: { $exists: false } },
          ],
        };
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
    await recordOrderHistory({ id: req.params.orderId, client_id: req.user.clientId }, { status: update.status || existing.status, actorUid: req.user.uid, actorRole: req.user.role, ...(action === 'reject' ? { vendorUid: req.user.uid, rejectionReason: update.vendorRejectionReason } : {}) });
    const notificationTitle = update.status === 'Delivered' ? 'Order delivered' : action === 'reject' ? 'Order rejected' : action === 'accept' ? 'Order accepted' : `Order ${String(update.status || existing.status).toLowerCase()}`;
    await Promise.all([
      recordNotification({ clientId: req.user.clientId, recipientRole: 'admin', orderId: req.params.orderId, type: String(update.status || existing.status).toLowerCase().replace(/\s+/g, '-'), title: notificationTitle, detail: `${req.params.orderId} · ${req.user.displayName || 'Vendor'}` }),
      ...(existing.owner_uid ? [recordNotification({ clientId: req.user.clientId, recipientRole: 'customer', recipientUid: existing.owner_uid, orderId: req.params.orderId, type: String(update.status || existing.status).toLowerCase().replace(/\s+/g, '-'), title: notificationTitle, detail: `${req.params.orderId} · ${req.user.displayName || 'Vendor'}` })] : []),
    ]);
    if (action === 'accept') {
      const customer = existing.customerEmail || existing.customerPhone ? existing : await usersCollection.findOne(
        { uid: existing.owner_uid, client_id: req.user.clientId, role: 'customer' },
        { projection: { _id: 0, email: 1, phoneNumber: 1 } },
      );
      const acceptedOrder = {
        ...existing,
        ...update,
        customerEmail: existing.customerEmail || customer?.email,
        customerPhone: existing.customerPhone || customer?.phoneNumber,
      };
      if (selectedVehicle) void notifyCustomerOfAcceptance(acceptedOrder, selectedVehicle).catch(error => console.error('Acceptance notification error:', error));
      io.to(`vendor:${req.user.clientId}`).emit('order:accepted', { orderId: req.params.orderId, vendorUid: req.user.uid, vendorName: req.user.displayName || 'Another vendor' });
      if (existing.owner_uid) io.to(`customer:${existing.owner_uid}`).emit('order:accepted', { orderId: req.params.orderId, vendorUid: req.user.uid, vendorName: req.user.displayName || 'Your vendor' });
    } else if (action === 'reject') {
      io.to(`vendor:${req.user.clientId}`).emit('order:rejected', { orderId: req.params.orderId, vendorUid: req.user.uid });
    }
    if (update.status === 'Delivered') io.to(`admin:${req.user.clientId}`).emit('order:delivered', { orderId: req.params.orderId, vendorName: req.user.displayName || 'Vendor' });
    res.json(removeDeliveryOtpFields({ id: req.params.orderId, ...update }));
  } catch (error) {
    console.error('Vendor order update error:', error);
    res.status(500).json({ message: 'Unable to update vendor order.' });
  }
});

// Create Razorpay order
app.post('/createRazorpayOrder', authenticateToken, async (req, res) => {
  try {
    const amount = Number(req.body.amount);

    const receipt =
      typeof req.body.receipt === 'string'
        ? req.body.receipt
        : `urban-tanker-${Date.now()}`;

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({
        message: 'A valid payment amount is required.',
      });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt,
    });

    return res.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);

    return res.status(500).json({
      message: 'Unable to create Razorpay order.',
    });
  }
});

// Verify Razorpay payment
app.post('/verifyRazorpayPayment', authenticateToken, async (req, res) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body;

    if (
      typeof razorpayOrderId !== 'string' ||
      typeof razorpayPaymentId !== 'string' ||
      typeof razorpaySignature !== 'string'
    ) {
      return res.status(400).json({
        message: 'Razorpay payment details are incomplete.',
      });
    }

    const expectedSignature = createHmac(
      'sha256',
      process.env.RAZORPAY_KEY_SECRET as string,
    )
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const verified = expectedSignature === razorpaySignature;

    if (!verified) {
      return res.status(400).json({
        verified: false,
        message: 'Razorpay payment verification failed.',
      });
    }

    return res.json({
      verified: true,
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
    });
  } catch (error) {
    console.error('Razorpay payment verification error:', error);

    return res.status(500).json({
      message: 'Unable to verify Razorpay payment.',
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', platformRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  captureError(err, { method: req.method, path: req.path });
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Urban Tanker Backend running on http://0.0.0.0:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing server...');
  await flushMonitoring();
  await closeConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Closing server...');
  await flushMonitoring();
  await closeConnection();
  process.exit(0);
});

export default app;
