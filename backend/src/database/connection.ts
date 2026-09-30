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

// Phase 1.5: Database-backed collections (replacing in-memory storage)
export const guestOrdersCollection = db.collection<any>('guest_orders');
export const walletsCollection = db.collection<any>('wallets');
export const subscriptionsDbCollection = db.collection<any>('subscriptions_v2');
export const invoicesDbCollection = db.collection<any>('invoices_v2');
export const configsCollection = db.collection<any>('configs');

export async function closeConnection() {
  await client.close();
  console.log('MongoDB connection closed');
}

/**
 * Initialize collections with indexes and validation
 * Call this on application startup
 */
export async function initializeCollections() {
  const database = await getDatabase();
  
  try {
    // Initialize guest_orders collection
    await database.collection('guest_orders').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await database.collection('guest_orders').createIndex({ id: 1 }, { unique: true });
    await database.collection('guest_orders').createIndex({ guestEmail: 1 });
    await database.collection('guest_orders').createIndex({ status: 1 });
    console.log('✅ guest_orders collection initialized');

    // Initialize wallets collection
    await database.collection('wallets').createIndex({ uid: 1 }, { unique: true });
    await database.collection('wallets').createIndex({ createdAt: -1 });
    console.log('✅ wallets collection initialized');

    // Initialize subscriptions_v2 collection
    await database.collection('subscriptions_v2').createIndex({ id: 1 }, { unique: true });
    await database.collection('subscriptions_v2').createIndex({ customerId: 1 });
    await database.collection('subscriptions_v2').createIndex({ status: 1 });
    console.log('✅ subscriptions_v2 collection initialized');

    // Initialize invoices_v2 collection
    await database.collection('invoices_v2').createIndex({ invoiceNumber: 1 }, { unique: true });
    await database.collection('invoices_v2').createIndex({ orderId: 1 });
    await database.collection('invoices_v2').createIndex({ customerId: 1 });
    console.log('✅ invoices_v2 collection initialized');

    // Initialize configs collection
    await database.collection('configs').createIndex({ configType: 1 }, { unique: true });
    console.log('✅ configs collection initialized');

  } catch (error: any) {
    if (error.message?.includes('IndexKeySpecsConflict')) {
      console.log('ℹ️  Indexes already exist, skipping creation');
    } else if (!error.message?.includes('exists')) {
      console.warn('⚠️  Warning initializing collections:', error.message);
    }
  }
}

export default databasePromise;
