import { get, onValue, ref, set, type Unsubscribe } from 'firebase/database';
import { firebaseAuth, firebaseEnabled, realtimeDatabase } from './firebase';
import type { Profile, Role } from './types';

export type CloudState = Record<string, unknown>;
export type CloudStateHandler = (state: CloudState) => void;
export type CloudErrorHandler = (error: Error) => void;

function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => withoutUndefined(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, withoutUndefined(item)])) as T;
  }
  return value;
}

interface UserProfile extends Profile {
  role: Role;
  createdAt: number;
  updatedAt: number;
}

const stateRef = () => {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('Authentication is required for cloud state.');
  return ref(realtimeDatabase!, `users/${user.uid}/state/urban-tanker`);
};
export const contentClientId = import.meta.env.VITE_CONTENT_CLIENT_ID || 'urban-tanker';
const contentRef = (clientId: string) => ref(realtimeDatabase!, `customers/${clientId}/content/config`);

export async function subscribeToContent(clientId: string, onContent: CloudStateHandler, onError: CloudErrorHandler): Promise<Unsubscribe> {
  if (!firebaseEnabled || !realtimeDatabase) { onError(new Error('Firebase Realtime Database is not configured.')); return () => {}; }
  return onValue(contentRef(clientId), snapshot => onContent(snapshot.val() || {}), onError);
}

export async function subscribeToCloudState(onState: CloudStateHandler, onError: CloudErrorHandler): Promise<Unsubscribe> {
  if (!firebaseEnabled || !firebaseAuth || !realtimeDatabase) {
    onError(new Error('Firebase Realtime Database is not configured.'));
    return () => {};
  }
  if (!firebaseAuth.currentUser) { onError(new Error('Authentication is required.')); return () => {}; }
  return onValue(stateRef(), snapshot => onState(snapshot.val() || {}), onError);
}

export async function refreshCloudState(): Promise<CloudState> {
  if (!firebaseEnabled || !firebaseAuth || !realtimeDatabase) return {};
  if (!firebaseAuth.currentUser) return {};
  const snapshot = await get(stateRef());
  return snapshot.val() || {};
}

export async function persistCloudState(state: CloudState): Promise<void> {
  if (!firebaseEnabled || !firebaseAuth || !realtimeDatabase) return;
  if (!firebaseAuth.currentUser) return;
  await set(stateRef(), { ...withoutUndefined(state), updatedAt: Date.now() });
}

export async function createUserProfile(profile: Profile, role: Role): Promise<void> {
  if (!firebaseEnabled || !firebaseAuth || !realtimeDatabase) throw new Error('Firebase Realtime Database is not configured.');
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('User must be authenticated to create a profile.');
  
  const userProfileRef = ref(realtimeDatabase, `users/${user.uid}/profile`);
  const userProfileData: UserProfile = {
    name: profile.name,
    email: profile.email || user.email || '',
    phone: profile.phone,
    role,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  await set(userProfileRef, withoutUndefined(userProfileData));
}

export async function getUserProfile(): Promise<UserProfile | null> {
  if (!firebaseEnabled || !firebaseAuth || !realtimeDatabase) return null;
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  
  const snapshot = await get(ref(realtimeDatabase, `users/${user.uid}/profile`));
  return snapshot.exists() ? (snapshot.val() as UserProfile) : null;
}

export function subscribeToUserProfile(
  onProfile: (profile: UserProfile | null) => void,
  onError: CloudErrorHandler
): Unsubscribe {
  if (!firebaseEnabled || !firebaseAuth || !realtimeDatabase) {
    onError(new Error('Firebase Realtime Database is not configured.'));
    return () => {};
  }
  
  const user = firebaseAuth.currentUser;
  if (!user) {
    onError(new Error('User must be authenticated.'));
    return () => {};
  }
  
  const userProfileRef = ref(realtimeDatabase, `users/${user.uid}/profile`);
  return onValue(userProfileRef, snapshot => {
    onProfile(snapshot.exists() ? (snapshot.val() as UserProfile) : null);
  }, onError);
}
