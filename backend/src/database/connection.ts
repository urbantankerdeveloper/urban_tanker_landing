import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config({ path: '.env.local' });
dotenv.config();

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB_NAME || 'urban_tanker';

if (!uri) {
  throw new Error('MONGODB_URI is required. Set it in backend/.env.local.');
}

const client = new MongoClient(uri, {
  maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 20),
  minPoolSize: 0,
  maxIdleTimeMS: 300000,
  maxConnecting: 4,
  waitQueueTimeoutMS: 5000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000,
});

const databasePromise = client.connect().then(() => client.db(databaseName));

export async function getDatabase() {
  return databasePromise;
}

// Initialize database and collections
const db = await databasePromise;

// Export collections as actual collection objects (not Promises)
export const usersCollection = db.collection<any>('users');
export const sessionsCollection = db.collection<any>('sessions');
export const ordersCollection = db.collection<any>('orders');
export const orderHistoryCollection = db.collection<any>('order_history');
export const notificationsCollection = db.collection<any>('notifications');
export const vendorsCollection = db.collection<any>('vendors');
export const driversCollection = db.collection<any>('drivers');
export const vehiclesCollection = db.collection<any>('vehicles');
export const contentCollection = db.collection<any>('content');
export const couponsCollection = db.collection<any>('coupons');
export const offersCollection = db.collection<any>('offers');
export const maintenanceCollection = db.collection<any>('maintenance');
export const attendanceCollection = db.collection<any>('driver_attendance');
export const payoutsCollection = db.collection<any>('payouts');
export const subscriptionsCollection = db.collection<any>('subscriptions');
export const invoicesCollection = db.collection<any>('invoices');
export const supportRequestsCollection = db.collection<any>('support_requests');
export const savedAddressesCollection = db.collection<any>('saved_addresses');

export async function closeConnection() {
  await client.close();
  console.log('MongoDB connection closed');
}

export default databasePromise;
