import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig),
  });
}

export const db = admin.firestore();

// Collection references
export const usersCollection = db.collection('users');
export const sessionsCollection = db.collection('sessions');

export async function closeConnection() {
  // Firestore connections don't need explicit closing
  console.log('Firebase connection closed');
}

export default db;
