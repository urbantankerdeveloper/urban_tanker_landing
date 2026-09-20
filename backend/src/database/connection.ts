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

export const usersCollection = (await databasePromise).collection<any>('users');
export const sessionsCollection = (await databasePromise).collection<any>('sessions');
export const ordersCollection = (await databasePromise).collection<any>('orders');
export const orderHistoryCollection = (await databasePromise).collection<any>('order_history');
export const vendorsCollection = (await databasePromise).collection<any>('vendors');
export const driversCollection = (await databasePromise).collection<any>('drivers');
export const vehiclesCollection = (await databasePromise).collection<any>('vehicles');
export const contentCollection = (await databasePromise).collection<any>('content');

export async function closeConnection() {
  await client.close();
  console.log('MongoDB connection closed');
}

export default databasePromise;
