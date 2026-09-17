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
}

export async function subscribeToOperations(onOperations: (operations: Pick<AppData, 'orders' | 'vendors'>) => void, onError: CloudErrorHandler): Promise<Unsubscribe> {
  void readEncryptedState<AppData>().then(({ value }) => onOperations({ orders: value?.orders || [], vendors: value?.vendors || [] })).catch(onError);
  return () => {};
}

export async function getVendorAvailability(): Promise<boolean> {
  const state = await readEncryptedState<AppData>();
  const user = getCurrentUser();
  return state.value?.vendors.find(vendor => vendor.uid === user?.uid)?.status === 'Online';
}

export async function setVendorAvailability(available: boolean): Promise<void> {
  const state = await readEncryptedState<AppData>();
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const vendors = (state.value?.vendors || []).map(vendor => vendor.uid === user.uid ? { ...vendor, status: available ? 'Online' : 'Unavailable' } : vendor);
  await saveEncryptedState({ ...(state.value || {}), vendors });
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
  const vendors = role === 'vendor' ? [...(state.value?.vendors || []), { uid: user.uid, name: profile.name, email: profile.email || user.email || '', driver: profile.name, phone: profile.phone, zone: '', vehicle: '', capacity: '', status: 'Online', rating: '' }] : state.value?.vendors || [];
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
