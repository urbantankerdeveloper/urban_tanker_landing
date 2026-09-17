import { getDatabase } from './connection.js';

const collections = {
  users: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['uid', 'client_id', 'email', 'password_hash', 'role', 'created_at', 'updated_at'],
      properties: {
        uid: { bsonType: 'string' },
        client_id: { bsonType: 'string' },
        email: { bsonType: 'string' },
        password_hash: { bsonType: 'string' },
        role: { enum: ['customer', 'vendor', 'admin'] },
        display_name: { bsonType: 'string' },
        phone_number: { bsonType: ['string', 'null'] },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' },
      },
    },
  },
  vendors: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['uid', 'client_id', 'name', 'available', 'status', 'updated_at'],
      properties: {
        uid: { bsonType: 'string' },
        client_id: { bsonType: 'string' },
        name: { bsonType: 'string' },
        available: { bsonType: 'bool' },
        status: { enum: ['active', 'inactive', 'Online', 'Unavailable'] },
        updated_at: { bsonType: 'date' },
      },
    },
  },
  orders: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'client_id', 'owner_uid', 'service', 'status', 'created'],
      properties: {
        id: { bsonType: 'string' },
        client_id: { bsonType: 'string' },
        owner_uid: { bsonType: 'string' },
        service: { bsonType: 'string' },
        deliveryLatitude: { bsonType: ['int', 'long', 'double', 'decimal'] },
        deliveryLongitude: { bsonType: ['int', 'long', 'double', 'decimal'] },
        status: { enum: ['Created', 'Pending acceptance', 'Accepted', 'En route', 'Arrived', 'Delivered', 'Rejected', 'Vendor assigned', 'Vendor accepted', 'Vendor rejected'] },
        vendorDecision: { enum: ['pending', 'accepted', 'rejected'] },
        deliveryOtpHash: { bsonType: 'string' },
        otpVerifiedAt: { bsonType: 'date' },
        statusHistory: { bsonType: 'array' },
        created: { bsonType: ['date', 'string'] },
      },
    },
  },
  content: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['client_id', 'config', 'coupons', 'updated_at'],
      properties: {
        client_id: { bsonType: 'string' },
        config: { bsonType: 'object' },
        coupons: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['code', 'label', 'discount'],
            properties: {
              code: { bsonType: 'string' },
              label: { bsonType: 'string' },
              discount: { bsonType: ['int', 'long', 'double', 'decimal'] },
              service: { bsonType: 'string' },
              firstBooking: { bsonType: 'bool' },
            },
          },
        },
        updated_at: { bsonType: 'date' },
        latitude: { bsonType: ['int', 'long', 'double', 'decimal'] },
        longitude: { bsonType: ['int', 'long', 'double', 'decimal'] },
      },
    },
  },
  sessions: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['token_hash', 'uid', 'client_id', 'role', 'created_at', 'expires_at'],
      properties: {
        token_hash: { bsonType: 'string' },
        uid: { bsonType: 'string' },
        client_id: { bsonType: 'string' },
        role: { enum: ['customer', 'vendor', 'admin'] },
        created_at: { bsonType: 'date' },
        expires_at: { bsonType: 'date' },
      },
    },
  },
};

const migratedCoupons = [
  { code: 'ECRFIRST50', discount: 50, firstBooking: true, label: '50% off your first water tanker booking', service: 'Water tanker' },
  { code: 'WATER200', discount: 200, label: '₹200 off water tanker bookings', service: 'Water tanker' },
  { code: 'SEWAGE300', discount: 300, label: '₹300 off sewage pickup', service: 'Sewage pickup' },
  { code: 'WEEKEND15', discount: 15, label: '15% off weekend bookings' },
];

async function ensureCollection(db, name, validator) {
  const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
  if (!exists) {
    await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' });
    return;
  }
  await db.command({
    collMod: name,
    validator,
    validationLevel: 'strict',
    validationAction: 'error',
  });
}

const initDatabase = async () => {
  try {
    const db = await getDatabase();
    console.log(`Initializing MongoDB database: ${db.databaseName}`);

    await db.command({ ping: 1 });
    for (const [name, validator] of Object.entries(collections)) await ensureCollection(db, name, validator);
    await db.collection('users').createIndex({ client_id: 1, email: 1 }, { unique: true, name: 'client_email_unique' });
    await db.collection('users').createIndex({ client_id: 1, role: 1 }, { name: 'client_role' });
    await db.collection('users').createIndex({ created_at: -1 }, { name: 'created_at_desc' });
    await db.collection('orders').createIndex({ client_id: 1, owner_uid: 1, created: -1 }, { name: 'customer_orders' });
    await db.collection('orders').createIndex({ client_id: 1, status: 1, assigned_vendor_uid: 1 }, { name: 'dispatch_queue' });
    await db.collection('vendors').createIndex({ client_id: 1, uid: 1 }, { unique: true, name: 'client_vendor_unique' });
    await db.collection('vendors').createIndex({ client_id: 1, available: 1 }, { name: 'available_vendors' });
    await db.collection('vendors').createIndex({ client_id: 1, status: 1 }, { name: 'vendor_status' });
    await db.collection('vendors').updateMany({ status: 'Online' }, { $set: { status: 'active' } });
    await db.collection('vendors').updateMany({ status: 'Unavailable' }, { $set: { status: 'inactive' } });
    await db.collection('vendors').updateMany({ status: { $exists: false } }, { $set: { status: 'inactive', available: false, updated_at: new Date() } });
    await db.collection('content').createIndex({ client_id: 1 }, { unique: true, name: 'client_content_unique' });
    await db.collection('content').updateOne(
      { client_id: 'urban-tanker' },
      { $setOnInsert: { client_id: 'urban-tanker', config: {}, coupons: migratedCoupons, updated_at: new Date() } },
      { upsert: true },
    );
    await db.collection('sessions').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0, name: 'session_expiry' });
    await db.collection('sessions').createIndex({ token_hash: 1, client_id: 1 }, { unique: true, name: 'session_token_client' });

    console.log('✅ MongoDB collections and indexes initialized');
    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB initialization error:', error);
    process.exit(1);
  }
};

initDatabase();
