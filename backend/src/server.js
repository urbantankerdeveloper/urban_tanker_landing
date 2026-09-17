import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import { closeConnection, contentCollection, ordersCollection, vendorsCollection, usersCollection } from './database/connection.js';
import { authenticateToken } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const contentCache = new Map();
const contentCacheTtlMs = Number(process.env.CONTENT_CACHE_TTL_MS || 60000);
const vendorDispatchRadiusKm = Number(process.env.VENDOR_DISPATCH_RADIUS_KM || 25);

function distanceKm(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
  const radians = value => value * Math.PI / 180;
  const deltaLatitude = radians(secondLatitude - firstLatitude);
  const deltaLongitude = radians(secondLongitude - firstLongitude);
  const value = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(firstLatitude)) * Math.cos(radians(secondLatitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

app.get('/api/vendor/dashboard', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
    const vendor = await vendorsCollection.findOne({ uid: req.user.uid, client_id: req.user.clientId }, { projection: { _id: 0 } });
    const orders = await ordersCollection.find({ client_id: req.user.clientId, status: { $nin: ['Rejected', 'Vendor rejected'] }, $or: [{ assigned_vendor_uid: req.user.uid }, { status: { $in: ['Created', 'Pending acceptance', 'Vendor assigned'] }, assigned_vendor_uid: { $exists: false } }] }, { projection: { _id: 0, deliveryOtpHash: 0 } }).sort({ created: -1 }).limit(25).toArray();
    const visibleOrders = orders.filter(order => order.assigned_vendor_uid === req.user.uid || (vendor?.status === 'active' && (typeof vendor?.latitude !== 'number' || typeof vendor?.longitude !== 'number' || typeof order.deliveryLatitude !== 'number' || typeof order.deliveryLongitude !== 'number' || distanceKm(vendor.latitude, vendor.longitude, order.deliveryLatitude, order.deliveryLongitude) <= vendorDispatchRadiusKm)));
    res.json({ vendor, orders: visibleOrders });
  } catch (error) {
    console.error('Vendor dashboard error:', error);
    res.status(500).json({ message: 'Unable to load vendor data.' });
  }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const order = req.body && typeof req.body === 'object' ? { ...req.body } : {};
    if (!order.id || !order.service || !order.status) return res.status(400).json({ message: 'Order details are incomplete.' });
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
    const update = { $set: order, $setOnInsert: setOnInsert };
    if (existing && existing.status !== order.status) update.$push = { statusHistory: { status: order.status, timestamp: new Date(), actorUid: req.user.uid, actorRole: req.user.role } };
    await ordersCollection.updateOne({ id: order.id, client_id: req.user.clientId, owner_uid: req.user.uid }, update, { upsert: true });
    res.status(200).json({ id: order.id });
  } catch (error) {
    console.error('Order persistence error:', error);
    res.status(500).json({ message: 'Unable to save the order.' });
  }
});

app.patch('/api/vendor/availability', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
    const status = req.body.status === 'active' || req.body.available === true ? 'active' : 'inactive';
    const available = status === 'active';
    await vendorsCollection.updateOne({ uid: req.user.uid, client_id: req.user.clientId }, { $set: { available, status, updated_at: new Date() } }, { upsert: true });
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
    const update = {};
    const action = req.body.action;
    if (action === 'accept') {
      update.status = 'Accepted';
      update.vendorDecision = 'accepted';
      update.vendorAcceptedAt = new Date();
      update.assigned_vendor_uid = req.user.uid;
      update.vendor = req.user.displayName || 'Assigned vendor';
      update.vendorEmail = req.user.email;
      update.vendorPhone = req.user.phoneNumber || null;
    } else if (action === 'reject') {
      update.status = 'Rejected';
      update.vendorDecision = 'rejected';
      update.vendorRejectedAt = new Date();
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
    if (typeof req.body.vendorLatitude === 'number' || typeof req.body.vendorLongitude === 'number') update.lastLocationUpdatedAt = new Date();
    if (!Object.keys(update).length) return res.status(400).json({ message: 'No valid order update was provided.' });
    const orderFilter = action === 'accept'
      ? { id: req.params.orderId, client_id: req.user.clientId, $or: [{ assigned_vendor_uid: req.user.uid }, { status: { $in: ['Created', 'Pending acceptance', 'Vendor assigned'] }, assigned_vendor_uid: { $exists: false } }] }
      : { id: req.params.orderId, client_id: req.user.clientId, assigned_vendor_uid: req.user.uid };
    const existing = await ordersCollection.findOne(orderFilter, { projection: { status: 1 } });
    if (!existing) return res.status(404).json({ message: 'Vendor order was not found.' });
    const updateDocument = { $set: update };
    if (update.status && existing.status !== update.status) updateDocument.$push = { statusHistory: { status: update.status, timestamp: new Date(), actorUid: req.user.uid, actorRole: req.user.role } };
    const result = await ordersCollection.updateOne(orderFilter, updateDocument);
    if (!result.matchedCount) return res.status(404).json({ message: 'Vendor order was not found.' });
    res.json({ id: req.params.orderId, ...update });
  } catch (error) {
    console.error('Vendor order update error:', error);
    res.status(500).json({ message: 'Unable to update vendor order.' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Urban Tanker Backend running on http://0.0.0.0:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing server...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Closing server...');
  await closeConnection();
  process.exit(0);
});

export default app;
