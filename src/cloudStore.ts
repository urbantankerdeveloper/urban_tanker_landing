import { get, onValue, ref, set, update, type Unsubscribe } from 'firebase/database';
import { firebaseAuth, firebaseEnabled, realtimeDatabase } from './firebase';
import type { AppData, Profile, Role, Vendor } from './types';

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

export interface UserProfile extends Profile {
  role: Role;
  clientId: string;
  createdAt: number;
  updatedAt: number;
}

export const contentClientId = import.meta.env.VITE_CONTENT_CLIENT_ID || 'urban-tanker';

const stateRef = () => {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('Authentication is required for cloud state.');
  return ref(realtimeDatabase!, `customers/${contentClientId}/users/${user.uid}/state`);
};
const contentRef = (clientId: string) => ref(realtimeDatabase!, `customers/${clientId}/content/config`);
const operationsRef = () => ref(realtimeDatabase!, `customers/${contentClientId}/operations`);

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
  const user = firebaseAuth.currentUser;
  if (Array.isArray(state.orders)) {
    await Promise.all((state.orders as AppData['orders']).map(order => set(ref(realtimeDatabase!, `customers/${contentClientId}/operations/orders/${order.id}`), withoutUndefined({ ...order, ownerUid: order.ownerUid || user.uid }))));
  }
}

export async function subscribeToOperations(onOperations: (operations: Pick<AppData, 'orders' | 'vendors'>) => void, onError: CloudErrorHandler): Promise<Unsubscribe> {
  if (!firebaseEnabled || !firebaseAuth || !realtimeDatabase) { onError(new Error('Firebase Realtime Database is not configured.')); return () => {}; }
  const profile = await getUserProfile();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'vendor')) { return () => {}; }
  return onValue(operationsRef(), snapshot => {
    const value = snapshot.val() as { orders?: AppData['orders']; vendors?: Record<string, Vendor> } | null;
    onOperations({ orders: Object.values(value?.orders || {}), vendors: Object.values(value?.vendors || {}) });
  }, onError);
}

export async function getVendorAvailability(): Promise<boolean> {
  if (!firebaseAuth?.currentUser || !realtimeDatabase) return false;
  const snapshot = await get(ref(realtimeDatabase, `customers/${contentClientId}/operations/vendors/${firebaseAuth.currentUser.uid}`));
  const vendor = snapshot.val() as {available?: boolean; status?: string} | null;
  return vendor?.available ?? vendor?.status === 'Online';
}

export async function setVendorAvailability(available: boolean): Promise<void> {
  if (!firebaseAuth?.currentUser || !realtimeDatabase) throw new Error('Firebase Realtime Database is not configured.');
  await update(ref(realtimeDatabase, `customers/${contentClientId}/operations/vendors/${firebaseAuth.currentUser.uid}`), {available, status: available ? 'Online' : 'Unavailable', updatedAt: Date.now()});
}

export async function createUserProfile(profile: Profile, role: Role): Promise<void> {
  if (!firebaseEnabled || !firebaseAuth || !realtimeDatabase) throw new Error('Firebase Realtime Database is not configured.');
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('User must be authenticated to create a profile.');
  
  const userProfileRef = ref(realtimeDatabase, `customers/${contentClientId}/users/${user.uid}/profile`);
  const userProfileData: UserProfile = {
    name: profile.name,
    email: profile.email || user.email || '',
    phone: profile.phone,
    role,
    clientId: contentClientId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  await set(userProfileRef, withoutUndefined(userProfileData));
  if (role === 'vendor') {
    await set(ref(realtimeDatabase, `customers/${contentClientId}/operations/vendors/${user.uid}`), withoutUndefined({ uid: user.uid, name: profile.name, email: profile.email || user.email || '', phone: profile.phone, status: 'Online' }));
  }
}

export async function getUserProfile(): Promise<UserProfile | null> {
  if (!firebaseEnabled || !firebaseAuth || !realtimeDatabase) return null;
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  
  const snapshot = await get(ref(realtimeDatabase, `customers/${contentClientId}/users/${user.uid}/profile`));
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
  
  const userProfileRef = ref(realtimeDatabase, `customers/${contentClientId}/users/${user.uid}/profile`);
  return onValue(userProfileRef, snapshot => {
    onProfile(snapshot.exists() ? (snapshot.val() as UserProfile) : null);
  }, onError);
}
