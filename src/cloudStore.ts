import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore';
import { firebaseAuth, firebaseEnabled, firestore } from './firebase';
import type { Profile, Role } from './types';

export type CloudState = Record<string, unknown>;
export type CloudStateHandler = (state: CloudState) => void;
export type CloudErrorHandler = (error: Error) => void;

interface UserProfile extends Profile {
  role: Role;
  createdAt: ReturnType<typeof serverTimestamp>;
  updatedAt: ReturnType<typeof serverTimestamp>;
}

const stateRef = () => {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('Authentication is required for cloud state.');
  return doc(firestore!, 'users', user.uid, 'state', 'urban-tanker');
};
export const contentClientId = import.meta.env.VITE_CONTENT_CLIENT_ID || 'urban-tanker';
const contentRef = (clientId: string) => doc(firestore!, 'content', clientId);

export async function subscribeToContent(clientId: string, onContent: CloudStateHandler, onError: CloudErrorHandler): Promise<Unsubscribe> {
  if (!firebaseEnabled || !firestore) { onError(new Error('Firebase is not configured.')); return () => {}; }
  return onSnapshot(contentRef(clientId), snapshot => onContent(snapshot.exists() ? snapshot.data() : {}), onError);
}

export async function subscribeToCloudState(onState: CloudStateHandler, onError: CloudErrorHandler): Promise<Unsubscribe> {
  if (!firebaseEnabled || !firebaseAuth || !firestore) {
    onError(new Error('Firebase is not configured.'));
    return () => {};
  }
  if (!firebaseAuth.currentUser) { onError(new Error('Authentication is required.')); return () => {}; }
  return onSnapshot(stateRef(), snapshot => {
    onState(snapshot.exists() ? snapshot.data() : {});
  }, onError);
}

export async function refreshCloudState(): Promise<CloudState> {
  if (!firebaseEnabled || !firebaseAuth || !firestore) return {};
  if (!firebaseAuth.currentUser) return {};
  const snapshot = await getDoc(stateRef());
  return snapshot.exists() ? snapshot.data() : {};
}

export async function persistCloudState(state: CloudState): Promise<void> {
  if (!firebaseEnabled || !firebaseAuth || !firestore) return;
  if (!firebaseAuth.currentUser) return;
  await setDoc(stateRef(), { ...state, updatedAt: serverTimestamp() }, { merge: true });
}

export async function createUserProfile(profile: Profile, role: Role): Promise<void> {
  if (!firebaseEnabled || !firebaseAuth || !firestore) throw new Error('Firebase is not configured.');
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('User must be authenticated to create a profile.');
  
  const userProfileRef = doc(firestore, 'users', user.uid);
  const userProfileData: UserProfile = {
    name: profile.name,
    email: profile.email || user.email || '',
    phone: profile.phone,
    role,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  await setDoc(userProfileRef, userProfileData, { merge: true });
}

export async function getUserProfile(): Promise<UserProfile | null> {
  if (!firebaseEnabled || !firebaseAuth || !firestore) return null;
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  
  const userProfileRef = doc(firestore, 'users', user.uid);
  const snapshot = await getDoc(userProfileRef);
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
}

export function subscribeToUserProfile(
  onProfile: (profile: UserProfile | null) => void,
  onError: CloudErrorHandler
): Unsubscribe {
  if (!firebaseEnabled || !firebaseAuth || !firestore) {
    onError(new Error('Firebase is not configured.'));
    return () => {};
  }
  
  const user = firebaseAuth.currentUser;
  if (!user) {
    onError(new Error('User must be authenticated.'));
    return () => {};
  }
  
  const userProfileRef = doc(firestore, 'users', user.uid);
  return onSnapshot(userProfileRef, snapshot => {
    onProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
  }, onError);
}
