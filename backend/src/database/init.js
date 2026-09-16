import { db } from './connection.js';

const initDatabase = async () => {
  try {
    console.log('Initializing Firebase Firestore connection...');

    // Test connection by pinging Firestore
    const testCollection = await db.collection('_test').limit(1).get();
    console.log('✅ Firebase Firestore connection successful');
    
    // Create metadata collection if it doesn't exist
    const metadataRef = db.collection('_metadata');
    const metadataDoc = await metadataRef.doc('system').get();
    
    if (!metadataDoc.exists) {
      await metadataRef.doc('system').set({
        initialized: new Date(),
        version: '1.0.0',
        database: 'firestore',
      });
      console.log('✅ Created system metadata');
    }

    console.log('✅ Firebase Firestore initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    process.exit(1);
  }
};

initDatabase();
