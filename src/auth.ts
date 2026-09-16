import { browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut, type Unsubscribe, type User } from 'firebase/auth';
import { firebaseAuth, firebaseEnabled } from './firebase';

async function configurePersistence(rememberMe: boolean): Promise<void> {
  if (!firebaseAuth) throw new Error('Firebase Authentication is not configured.');
  await setPersistence(firebaseAuth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
}

export async function signInWithGoogle(rememberMe = true): Promise<User> {
  if (!firebaseEnabled || !firebaseAuth) throw new Error('Firebase Authentication is not configured.');
  await configurePersistence(rememberMe);
  return (await signInWithPopup(firebaseAuth, new GoogleAuthProvider())).user;
}

export async function signInWithPassword(email: string, password: string, rememberMe = true): Promise<User> {
  if (!firebaseEnabled || !firebaseAuth) throw new Error('Firebase Authentication is not configured.');
  await configurePersistence(rememberMe);
  return (await signInWithEmailAndPassword(firebaseAuth, email, password)).user;
}

export async function registerWithPassword(email: string, password: string, rememberMe = true): Promise<User> {
  if (!firebaseEnabled || !firebaseAuth) throw new Error('Firebase Authentication is not configured.');
  await configurePersistence(rememberMe);
  return (await createUserWithEmailAndPassword(firebaseAuth, email, password)).user;
}

export async function signOutUser(): Promise<void> {
  if (firebaseAuth) await firebaseSignOut(firebaseAuth);
}

export function subscribeToAuthState(onUser: (user: User | null) => void): Unsubscribe {
  if (!firebaseEnabled || !firebaseAuth) {
    onUser(null);
    return () => {};
  }
  return onAuthStateChanged(firebaseAuth, onUser);
}
