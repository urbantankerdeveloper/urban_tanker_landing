import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { attendanceCollection, invoicesCollection, maintenanceCollection, ordersCollection, payoutsCollection, subscriptionsCollection, vehiclesCollection } from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/vendor/maintenance', async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
  const records = await maintenanceCollection.find({ client_id: req.user.clientId, vendor_uid: req.user.uid }).sort({ scheduled_at: -1 }).limit(100).toArray();
  res.json({ records });
});

router.post('/vendor/maintenance', async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
  const record = { id: randomUUID(), client_id: req.user.clientId, vendor_uid: req.user.uid, vehicle_id: String(req.body.vehicleId || ''), status: 'scheduled', scheduled_at: new Date(String(req.body.scheduledAt || '')), description: String(req.body.description || '').trim(), cost: Number(req.body.cost || 0), created_at: new Date() };
  if (!record.vehicle_id || Number.isNaN(record.scheduled_at.valueOf())) return res.status(400).json({ message: 'Vehicle and a valid maintenance date are required.' });
  await maintenanceCollection.insertOne(record);
  res.status(201).json({ record });
});

router.get('/vendor/fleet/expiring-documents', async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 30);
  const vehicles = await vehiclesCollection.find({ client_id: req.user.clientId, vendor_uid: req.user.uid, $or: [{ registration_expiry: { $lte: threshold } }, { insurance_expiry: { $lte: threshold } }, { permit_expiry: { $lte: threshold } }] }).project({ _id: 0 }).toArray();
  res.json({ vehicles });
});

router.post('/vendor/attendance', async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
  const date = String(req.body.date || '').trim();
  const driverId = String(req.body.driverId || '').trim();
  const status = ['present', 'absent', 'leave'].includes(req.body.status) ? req.body.status : 'present';
  if (!driverId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: 'Driver and date are required.' });
  const record = { id: randomUUID(), client_id: req.user.clientId, vendor_uid: req.user.uid, driver_id: driverId, date, status, notes: String(req.body.notes || '').trim(), created_at: new Date() };
  await attendanceCollection.updateOne({ client_id: record.client_id, vendor_uid: record.vendor_uid, driver_id: record.driver_id, date }, { $set: record }, { upsert: true });
  res.json({ record });
});

router.get('/vendor/payouts', async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access is required.' });
  const payouts = await payoutsCollection.find({ client_id: req.user.clientId, vendor_uid: req.user.uid }).sort({ created_at: -1 }).limit(100).toArray();
  res.json({ payouts });
});

router.get('/customer/subscriptions', async (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
  const subscriptions = await subscriptionsCollection.find({ client_id: req.user.clientId, owner_uid: req.user.uid }).sort({ created_at: -1 }).toArray();
  res.json({ subscriptions });
});

router.post('/customer/subscriptions', async (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
  const frequency = ['weekly', 'biweekly', 'monthly'].includes(req.body.frequency) ? req.body.frequency : '';
  const subscription = { id: randomUUID(), client_id: req.user.clientId, owner_uid: req.user.uid, service: String(req.body.service || '').trim(), capacity: String(req.body.capacity || '').trim(), frequency, status: 'active', next_delivery: String(req.body.nextDelivery || '').trim(), created_at: new Date() };
  if (!subscription.service || !subscription.capacity || !subscription.frequency || !subscription.next_delivery) return res.status(400).json({ message: 'Service, capacity, frequency, and next delivery are required.' });
  await subscriptionsCollection.insertOne(subscription);
  res.status(201).json({ subscription });
});

router.patch('/customer/subscriptions/:id', async (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
  const status = ['active', 'paused', 'cancelled'].includes(req.body.status) ? req.body.status : '';
  if (!status) return res.status(400).json({ message: 'A valid subscription status is required.' });
  const result = await subscriptionsCollection.updateOne({ id: req.params.id, client_id: req.user.clientId, owner_uid: req.user.uid }, { $set: { status } });
  if (!result.matchedCount) return res.status(404).json({ message: 'Subscription was not found.' });
  res.json({ id: req.params.id, status });
});

router.get('/orders/:orderId/invoice', async (req, res) => {
  const orderFilter = req.user.role === 'admin' ? { id: req.params.orderId, client_id: req.user.clientId } : { id: req.params.orderId, client_id: req.user.clientId, owner_uid: req.user.uid };
  const order = await ordersCollection.findOne(orderFilter, { projection: { _id: 0, id: 1, owner_uid: 1, amount: 1, payment: 1, status: 1, service: 1, capacity: 1, created: 1 } });
  if (!order) return res.status(404).json({ message: 'Order was not found.' });
  const invoice = await invoicesCollection.findOneAndUpdate({ client_id: req.user.clientId, order_id: order.id }, { $setOnInsert: { id: `INV-${order.id}`, client_id: req.user.clientId, order_id: order.id, owner_uid: order.owner_uid, amount: order.amount, status: order.payment === 'Refunded' ? 'refunded' : 'issued', created_at: new Date() } }, { upsert: true, returnDocument: 'after' });
  res.json({ invoice: invoice.value, order });
});

router.get('/customer/invoices', async (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer access is required.' });
  const invoices = await invoicesCollection.find({ client_id: req.user.clientId, owner_uid: req.user.uid }).sort({ created_at: -1 }).limit(100).toArray();
  res.json({ invoices });
});

export default router;
