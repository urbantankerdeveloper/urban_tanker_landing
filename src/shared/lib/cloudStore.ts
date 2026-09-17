import { getCurrentUser } from '../../features/auth/auth';
import { readEncryptedContent, readEncryptedState, saveEncryptedContent, saveEncryptedState } from './secureCache';
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

type Unsubscribe = () => void;

export async function subscribeToContent(clientId: string, onContent: CloudStateHandler, onError: CloudErrorHandler): Promise<Unsubscribe> {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  try {
    const response = await fetch(`${apiUrl}/api/content/${encodeURIComponent(clientId)}`);
    if (!response.ok) throw new Error('Content configuration request failed.');
    const content = await response.json() as CloudState;
    onContent(content);
    await saveEncryptedContent(clientId, content);
  } catch (error) {
    const cached = await readEncryptedContent<CloudState>(clientId);
    if (cached.value) onContent(cached.value);
    else onError(error instanceof Error ? error : new Error(String(error)));
  }
  return () => {};
}

export async function subscribeToCloudState(onState: CloudStateHandler, onError: CloudErrorHandler): Promise<Unsubscribe> {
  void readEncryptedState<CloudState>().then(({ value }) => onState(value || {})).catch(onError);
  return () => {};
}

export async function refreshCloudState(): Promise<CloudState> {
  const snapshot = await readEncryptedState<CloudState>();
  return snapshot.value || {};
}

export async function persistCloudState(state: CloudState): Promise<void> {
  await saveEncryptedState({ ...withoutUndefined(state), updatedAt: Date.now() });
  const user = getCurrentUser();
  if (user && Array.isArray(state.orders)) {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    await Promise.all((state.orders as AppData['orders']).map(order => fetch(`${apiUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}` },
      body: JSON.stringify({ ...withoutUndefined(order), ownerUid: user.uid }),
    }).then(response => { if (!response.ok) throw new Error('Unable to persist order.'); })));
  }
}

export async function subscribeToOperations(onOperations: (operations: Pick<AppData, 'orders' | 'vendors'>) => void, onError: CloudErrorHandler): Promise<Unsubscribe> {
  void readEncryptedState<AppData>().then(({ value }) => onOperations({ orders: value?.orders || [], vendors: value?.vendors || [] })).catch(onError);
  return () => {};
}

export async function getVendorAvailability(): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/vendor/dashboard`, { headers: { Authorization: `Bearer ${user.idToken}` } });
  if (!response.ok) throw new Error('Unable to load vendor availability.');
  const result = await response.json() as { vendor?: { available?: boolean; status?: string } };
  return result.vendor?.available ?? result.vendor?.status === 'Online';
}

export async function setVendorAvailability(available: boolean): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/vendor/availability`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}` }, body: JSON.stringify({ available }) });
  if (!response.ok) throw new Error('Unable to update vendor availability.');
}

export async function updateVendorLocation(latitude: number, longitude: number): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/vendor/location`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}` }, body: JSON.stringify({ latitude, longitude }) });
  if (!response.ok) throw new Error('Unable to update vendor location.');
}

export async function loadVendorDashboard(): Promise<{ vendor?: Vendor; orders: AppData['orders'] }> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/vendor/dashboard`, { headers: { Authorization: `Bearer ${user.idToken}` } });
  if (!response.ok) throw new Error('Unable to load vendor data.');
  return await response.json() as { vendor?: Vendor; orders: AppData['orders'] };
}

export async function updateVendorOrder(order: AppData['orders'][number], options: { action?: 'accept' | 'reject'; deliveryOtp?: string } = {}): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/vendor/orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}` }, body: JSON.stringify({ action: options.action, deliveryOtp: options.deliveryOtp, status: order.status, eta: order.eta, vendorLatitude: order.vendorLatitude, vendorLongitude: order.vendorLongitude }) });
  if (!response.ok) throw new Error('Unable to update vendor order.');
}

export async function createUserProfile(profile: Profile, role: Role): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('User must be authenticated to create a profile.');
  const userProfileData: UserProfile = {
    name: profile.name,
    email: profile.email || user.email || '',
    phone: profile.phone,
    role,
    clientId: contentClientId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  const state = await readEncryptedState<AppData>();
  const vendors = role === 'vendor' ? [...(state.value?.vendors || []), { uid: user.uid, name: profile.name, email: profile.email || user.email || '', driver: profile.name, phone: profile.phone, zone: '', vehicle: '', capacity: '', status: 'Unavailable', rating: '' }] : state.value?.vendors || [];
  await saveEncryptedState({ ...(state.value || {}), profile: userProfileData, vendors });
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const state = await readEncryptedState<AppData & { profile?: UserProfile }>();
  return state.value?.profile || null;
}

export function subscribeToUserProfile(
  onProfile: (profile: UserProfile | null) => void,
  onError: CloudErrorHandler
): Unsubscribe {
  void getUserProfile().then(onProfile).catch(onError);
  return () => {};
}
