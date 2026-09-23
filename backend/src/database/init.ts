import { getDatabase } from './connection.js';
import { createHash, randomInt, randomUUID } from 'node:crypto';

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
        status: { enum: ['active', 'inactive'] },
        available: { bsonType: 'bool' },
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
  drivers: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'client_id', 'vendor_uid', 'name', 'active', 'updated_at'],
      properties: {
        id: { bsonType: 'string' },
        client_id: { bsonType: 'string' },
        vendor_uid: { bsonType: 'string' },
        name: { bsonType: 'string' },
        phone: { bsonType: 'string' },
        address: { bsonType: 'string' },
        address_proof: { bsonType: 'string' },
        active: { bsonType: 'bool' },
        updated_at: { bsonType: 'date' },
      },
    },
  },
  vehicles: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'client_id', 'vendor_uid', 'registration_number', 'vehicle_type', 'active', 'updated_at'],
      properties: {
        id: { bsonType: 'string' },
        client_id: { bsonType: 'string' },
        vendor_uid: { bsonType: 'string' },
        registration_number: { bsonType: 'string' },
        vehicle_type: { bsonType: 'string' },
        capacity: { bsonType: 'string' },
        driver_id: { bsonType: 'string' },
        driver_name: { bsonType: 'string' },
        driver_phone: { bsonType: 'string' },
        driver_active: { bsonType: 'bool' },
        active: { bsonType: 'bool' },
        image_url: { bsonType: 'string' },
        registration_expiry: { bsonType: 'date' },
        insurance_expiry: { bsonType: 'date' },
        permit_expiry: { bsonType: 'date' },
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
        status: { enum: ['Created', 'Pending acceptance', 'Accepted', 'En route', 'Arrived', 'Delivered', 'Rejected', 'Cancelled', 'Vendor assigned', 'Vendor accepted', 'Vendor rejected'] },
        vendorDecision: { enum: ['pending', 'accepted', 'rejected'] },
        vehicleId: { bsonType: 'string' },
        vehicleRegistrationNumber: { bsonType: 'string' },
        vehicleType: { bsonType: 'string' },
        vehicleCapacity: { bsonType: 'string' },
        driverId: { bsonType: 'string' },
        driver: { bsonType: 'string' },
        driverPhone: { bsonType: 'string' },
        driverActive: { bsonType: 'bool' },
        paymentId: { bsonType: 'string' },
        refundId: { bsonType: 'string' },
        refundAmount: { bsonType: ['int', 'long', 'double', 'decimal'] },
        refundedAt: { bsonType: 'date' },
        deliveryOtpHash: { bsonType: 'string' },
        customerDeliveryOtp: { bsonType: 'string' },
        deliveryProofUrl: { bsonType: 'string' },
        scheduledDate: { bsonType: 'string' },
        scheduledSlot: { bsonType: 'string' },
        cancellationReason: { bsonType: 'string' },
        cancelledAt: { bsonType: 'date' },
        customerRating: { bsonType: ['int', 'long', 'double'] },
        customerFeedback: { bsonType: 'string' },
        otpVerifiedAt: { bsonType: 'date' },
        statusHistory: { bsonType: 'array' },
        created: { bsonType: ['date', 'string'] },
      },
    },
  },
  order_history: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['order_id', 'client_id', 'status', 'timestamp'],
      properties: {
        order_id: { bsonType: 'string' },
        client_id: { bsonType: 'string' },
        status: { bsonType: 'string' },
        timestamp: { bsonType: 'date' },
        actor_uid: { bsonType: 'string' },
        actor_role: { enum: ['customer', 'vendor', 'admin'] },
        vendor_uid: { bsonType: 'string' },
        rejection_reason: { bsonType: 'string' },
      },
    },
  },
  notifications: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'client_id', 'recipient_role', 'title', 'detail', 'created_at'],
      properties: {
        id: { bsonType: 'string' },
        client_id: { bsonType: 'string' },
        recipient_uid: { bsonType: 'string' },
        recipient_role: { enum: ['customer', 'vendor', 'admin'] },
        order_id: { bsonType: 'string' },
        type: { bsonType: 'string' },
        title: { bsonType: 'string' },
        detail: { bsonType: 'string' },
        created_at: { bsonType: 'date' },
        read_at: { bsonType: 'date' },
      },
    },
  },
  maintenance: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'client_id', 'vendor_uid', 'vehicle_id', 'status', 'scheduled_at', 'created_at'],
      properties: {
        id: { bsonType: 'string' }, client_id: { bsonType: 'string' }, vendor_uid: { bsonType: 'string' }, vehicle_id: { bsonType: 'string' },
        status: { enum: ['scheduled', 'in-progress', 'completed', 'cancelled'] }, scheduled_at: { bsonType: 'date' }, completed_at: { bsonType: 'date' },
        description: { bsonType: 'string' }, cost: { bsonType: ['int', 'long', 'double', 'decimal'] }, created_at: { bsonType: 'date' },
      },
    },
  },
  driver_attendance: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'client_id', 'vendor_uid', 'driver_id', 'date', 'status', 'created_at'],
      properties: {
        id: { bsonType: 'string' }, client_id: { bsonType: 'string' }, vendor_uid: { bsonType: 'string' }, driver_id: { bsonType: 'string' },
        date: { bsonType: 'string' }, status: { enum: ['present', 'absent', 'leave'] }, notes: { bsonType: 'string' }, created_at: { bsonType: 'date' },
      },
    },
  },
  payouts: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'client_id', 'vendor_uid', 'amount', 'status', 'created_at'],
      properties: {
        id: { bsonType: 'string' }, client_id: { bsonType: 'string' }, vendor_uid: { bsonType: 'string' }, amount: { bsonType: ['int', 'long', 'double', 'decimal'] },
        status: { enum: ['pending', 'processing', 'paid', 'failed'] }, period_start: { bsonType: 'string' }, period_end: { bsonType: 'string' }, created_at: { bsonType: 'date' },
      },
    },
  },
  subscriptions: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'client_id', 'owner_uid', 'service', 'capacity', 'frequency', 'status', 'next_delivery', 'created_at'],
      properties: {
        id: { bsonType: 'string' }, client_id: { bsonType: 'string' }, owner_uid: { bsonType: 'string' }, service: { bsonType: 'string' }, capacity: { bsonType: 'string' },
        frequency: { enum: ['weekly', 'biweekly', 'monthly'] }, status: { enum: ['active', 'paused', 'cancelled'] }, next_delivery: { bsonType: 'string' }, created_at: { bsonType: 'date' },
      },
    },
  },
  invoices: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'client_id', 'order_id', 'owner_uid', 'amount', 'status', 'created_at'],
      properties: {
        id: { bsonType: 'string' }, client_id: { bsonType: 'string' }, order_id: { bsonType: 'string' }, owner_uid: { bsonType: 'string' }, amount: { bsonType: ['int', 'long', 'double', 'decimal'] },
        status: { enum: ['issued', 'refunded', 'void'] }, created_at: { bsonType: 'date' },
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
    await db.collection('orders').createIndex({ client_id: 1, updated_at: -1, id: 1 }, { name: 'admin_order_cursor' });
    await db.collection('orders').createIndex({ client_id: 1, assigned_vendor_uid: 1, status: 1, updated_at: -1 }, { name: 'vendor_order_cursor' });
    const duplicateOrders = await db.collection('orders').aggregate([
      { $group: { _id: { client_id: '$client_id', id: '$id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]).toArray();
    for (const duplicate of duplicateOrders) {
      const records = await db.collection('orders').find({ client_id: duplicate._id.client_id, id: duplicate._id.id }).sort({ updated_at: -1, _id: -1 }).toArray();
      const keeper = records[0];
      const statusHistory = records.flatMap(record => record.statusHistory || []).sort((first, second) => new Date(first.timestamp).valueOf() - new Date(second.timestamp).valueOf());
      const rejectedVendorUids = Array.from(new Set(records.flatMap(record => record.rejectedVendorUids || [])));
      await db.collection('orders').updateOne({ _id: keeper._id }, { $set: { statusHistory, rejectedVendorUids, updated_at: new Date() } });
      await db.collection('orders').deleteMany({ _id: { $in: records.slice(1).map(record => record._id) } });
    }
    await db.collection('orders').createIndex({ client_id: 1, id: 1 }, { unique: true, name: 'client_order_id_unique' });
    await db.collection('order_history').createIndex({ client_id: 1, order_id: 1, timestamp: 1 }, { name: 'order_history_timeline' });
    await db.collection('notifications').createIndex({ client_id: 1, recipient_role: 1, recipient_uid: 1, created_at: -1 }, { name: 'recipient_notifications' });
    await db.collection('notifications').createIndex({ client_id: 1, id: 1 }, { unique: true, name: 'notification_id_unique' });
    await db.collection('maintenance').createIndex({ client_id: 1, vendor_uid: 1, vehicle_id: 1, scheduled_at: -1 }, { name: 'vehicle_maintenance' });
    await db.collection('driver_attendance').createIndex({ client_id: 1, vendor_uid: 1, driver_id: 1, date: 1 }, { unique: true, name: 'driver_attendance_unique' });
    await db.collection('payouts').createIndex({ client_id: 1, vendor_uid: 1, created_at: -1 }, { name: 'vendor_payouts' });
    await db.collection('subscriptions').createIndex({ client_id: 1, owner_uid: 1, status: 1 }, { name: 'customer_subscriptions' });
    await db.collection('invoices').createIndex({ client_id: 1, order_id: 1 }, { unique: true, name: 'order_invoice_unique' });
    const ordersForHistory = await db.collection('orders').find({}, { projection: { _id: 0, id: 1, client_id: 1, status: 1, owner_uid: 1, statusHistory: 1, created: 1 } }).toArray();
    for (const order of ordersForHistory) {
      if (await db.collection('order_history').countDocuments({ client_id: order.client_id, order_id: order.id })) continue;
      const events = order.statusHistory?.length ? order.statusHistory : [{ status: order.status, timestamp: order.created, actorUid: order.owner_uid, actorRole: 'customer' }];
      await db.collection('order_history').insertMany(events.map(event => ({ order_id: order.id, client_id: order.client_id, status: event.status, timestamp: new Date(event.timestamp), ...(event.actorUid ? { actor_uid: event.actorUid } : {}), ...(event.actorRole ? { actor_role: event.actorRole } : {}) })));
    }
    const ordersForNotifications = await db.collection('orders').find({}, { projection: { _id: 0, id: 1, client_id: 1, owner_uid: 1, status: 1, service: 1, customer: 1, vendor: 1 } }).toArray();
    for (const order of ordersForNotifications) {
      if (await db.collection('notifications').countDocuments({ client_id: order.client_id, order_id: order.id })) continue;
      const title = order.status === 'Delivered' ? 'Order delivered' : order.status === 'Rejected' ? 'Order rejected' : order.status === 'Accepted' || order.status === 'Vendor accepted' ? 'Order accepted' : 'Order awaiting action';
      const detail = `${order.id} · ${order.service || order.customer || order.vendor || 'Booking'}`;
      const records = [
        { id: randomUUID(), client_id: order.client_id, recipient_role: 'admin', order_id: order.id, type: String(order.status).toLowerCase().replace(/\s+/g, '-'), title, detail, created_at: new Date() },
        ...(order.owner_uid ? [{ id: randomUUID(), client_id: order.client_id, recipient_uid: order.owner_uid, recipient_role: 'customer', order_id: order.id, type: String(order.status).toLowerCase().replace(/\s+/g, '-'), title, detail, created_at: new Date() }] : []),
      ];
      await db.collection('notifications').insertMany(records);
    }
    const ordersNeedingOtp = await db.collection('orders').find({
      status: { $in: ['Accepted', 'Vendor accepted', 'En route', 'Arrived'] },
      $or: [{ customerDeliveryOtp: { $exists: false } }, { deliveryOtpHash: { $exists: false } }],
    }, { projection: { _id: 1, customerDeliveryOtp: 1 } }).toArray();
    for (const order of ordersNeedingOtp) {
      const deliveryOtp = typeof order.customerDeliveryOtp === 'string' && /^\d{6}$/.test(order.customerDeliveryOtp)
        ? order.customerDeliveryOtp
        : String(randomInt(100000, 1000000));
      await db.collection('orders').updateOne(
        { _id: order._id },
        { $set: { customerDeliveryOtp: deliveryOtp, deliveryOtpHash: createHash('sha256').update(deliveryOtp).digest('hex') } },
      );
    }
    await db.collection('vendors').createIndex({ client_id: 1, uid: 1 }, { unique: true, name: 'client_vendor_unique' });
    await db.collection('vendors').createIndex({ client_id: 1, available: 1 }, { name: 'available_vendors' });
    await db.collection('vendors').createIndex({ client_id: 1, status: 1 }, { name: 'vendor_status' });
    await db.collection('drivers').createIndex({ client_id: 1, vendor_uid: 1, active: 1 }, { name: 'vendor_drivers' });
    await db.collection('drivers').createIndex({ client_id: 1, vendor_uid: 1, id: 1 }, { unique: true, name: 'vendor_driver_id_unique' });
    await db.collection('vehicles').createIndex({ client_id: 1, vendor_uid: 1, active: 1 }, { name: 'vendor_vehicles' });
    await db.collection('vehicles').createIndex({ client_id: 1, registration_number: 1 }, { unique: true, name: 'vehicle_registration_unique' });
    await db.collection('vehicles').createIndex({ client_id: 1, vendor_uid: 1, driver_id: 1 }, { name: 'vendor_vehicle_driver' });
    await db.collection('vehicles').updateMany(
      { driver_active: { $exists: false } },
      { $set: { driver_active: false } },
    );
    const legacyVehicles = await db.collection('vehicles').find({ driver_name: { $exists: true, $type: 'string' }, driver_id: { $exists: false } }, { projection: { _id: 1 } }).toArray();
    for (const vehicle of legacyVehicles) await db.collection('vehicles').updateOne({ _id: vehicle._id }, { $set: { driver_id: randomUUID() } });
    const vehiclesWithDrivers = await db.collection('vehicles').find({ driver_id: { $exists: true }, driver_name: { $exists: true } }, { projection: { _id: 0, driver_id: 1, client_id: 1, vendor_uid: 1, driver_name: 1, driver_phone: 1, driver_active: 1 } }).toArray();
    for (const vehicle of vehiclesWithDrivers) {
      await db.collection('drivers').updateOne(
        { id: vehicle.driver_id, client_id: vehicle.client_id, vendor_uid: vehicle.vendor_uid },
        { $setOnInsert: { id: vehicle.driver_id, client_id: vehicle.client_id, vendor_uid: vehicle.vendor_uid, name: vehicle.driver_name, phone: vehicle.driver_phone || '', active: vehicle.driver_active === true, updated_at: new Date() } },
        { upsert: true },
      );
    }
    await db.collection('vendors').updateMany({ status: 'Online' }, { $set: { status: 'active' } });
    await db.collection('vendors').updateMany({ status: 'Unavailable' }, { $set: { status: 'inactive' } });
    await db.collection('vendors').updateMany({ status: { $exists: false } }, { $set: { status: 'inactive', available: false, updated_at: new Date() } });
    await db.collection('users').updateMany({ client_id: { $exists: true }, role: 'vendor', status: { $exists: false } }, { $set: { status: 'inactive', available: false, updated_at: new Date() } });
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
