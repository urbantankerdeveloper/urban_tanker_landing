/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentUser } from '../../features/auth/auth';
import { API_BASE_URL } from './apiConfig';
import { readEncryptedContent, readEncryptedState, saveEncryptedContent, saveEncryptedState } from './secureCache';
import type { AppData, Profile, Role, Vehicle, Vendor } from './types';

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
  const apiUrl = API_BASE_URL;
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

export async function loadContent(clientId: string): Promise<CloudState> {
  const response = await fetch(`${API_BASE_URL}/api/content/${encodeURIComponent(clientId)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to refresh content configuration.');
  return await response.json() as CloudState;
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
    const apiUrl = API_BASE_URL;
    await Promise.all((state.orders as AppData['orders']).map(order => fetch(`${apiUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}` },
      body: JSON.stringify({ ...withoutUndefined(order), ownerUid: user.uid }),
    }).then(response => { if (!response.ok) throw new Error('Unable to persist order.'); })));
  }
}

export async function loadCustomerOrders(): Promise<AppData['orders']> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const apiUrl = API_BASE_URL;
  const response = await fetch(`${apiUrl}/api/orders`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  if (!response.ok) throw new Error('Unable to load customer orders.');
  const result = await response.json() as { orders: AppData['orders'] };
  return result.orders || [];
}

export async function subscribeToOperations(onOperations: (operations: Pick<AppData, 'orders' | 'vendors'>) => void, onError: CloudErrorHandler): Promise<Unsubscribe> {
  void readEncryptedState<AppData>().then(({ value }) => onOperations({ orders: value?.orders || [], vendors: value?.vendors || [] })).catch(onError);
  return () => {};
}

export async function getVendorAvailability(): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;
  const response = await fetch(`${API_BASE_URL}/api/vendor/dashboard`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  if (!response.ok) throw new Error('Unable to load vendor availability.');
  const result = await response.json() as { vendor?: { available?: boolean; status?: string } };
  return result.vendor?.status === 'active' || result.vendor?.available === true;
}

export async function setVendorAvailability(available: boolean): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/availability`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify({ available, status: available ? 'active' : 'inactive' }) });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(payload.message || 'Unable to update vendor availability.');
  }
}

export async function updateVendorLocation(latitude: number, longitude: number): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/location`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify({ latitude, longitude }) });
  if (!response.ok) throw new Error('Unable to update vendor location.');
}

export async function loadVendorDashboard(): Promise<{ vendor?: Vendor; orders: AppData['orders'] }> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/dashboard`, { headers: { Authorization: `Bearer ${user.idToken}` } });
  if (!response.ok) throw new Error('Unable to load vendor data.');
  return await response.json() as { vendor?: Vendor; orders: AppData['orders'] };
}

export async function loadVendorVehicles(): Promise<Vehicle[]> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/vehicles`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  if (!response.ok) throw new Error('Unable to load vehicles.');
  const result = await response.json() as { vehicles: Array<{ id: string; registration_number: string; vehicle_type: string; capacity?: string; active: boolean; driver_id?: string; driver_name?: string; driver_phone?: string; driver_active?: boolean }> };
  return (result.vehicles || []).map(vehicle => ({ id: vehicle.id, registrationNumber: vehicle.registration_number, vehicleType: vehicle.vehicle_type, capacity: vehicle.capacity || '', active: vehicle.active, driverId: vehicle.driver_id || '', driverName: vehicle.driver_name || '', driverPhone: vehicle.driver_phone || '', driverActive: vehicle.driver_active === true, imageUrl: (vehicle as any).image_url }));
}

export async function createVendorVehicle(input: { registrationNumber: string; vehicleType: string; capacity: string; driverName: string; driverPhone: string; imageUrl?: string }): Promise<Vehicle> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/vehicles`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify(input) });
  const payload = await response.json() as { vehicle?: { id: string; registration_number: string; vehicle_type: string; capacity?: string; active: boolean; driver_id?: string; driver_name?: string; driver_phone?: string; driver_active?: boolean }; message?: string };
  if (!response.ok || !payload.vehicle) throw new Error(payload.message || 'Unable to create vehicle.');
  return { id: payload.vehicle.id, registrationNumber: payload.vehicle.registration_number, vehicleType: payload.vehicle.vehicle_type, capacity: payload.vehicle.capacity || '', active: payload.vehicle.active, driverId: payload.vehicle.driver_id || '', driverName: payload.vehicle.driver_name || '', driverPhone: payload.vehicle.driver_phone || '', driverActive: payload.vehicle.driver_active === true, imageUrl: (payload.vehicle as any).image_url };
}

export async function setVendorVehicleActive(vehicleId: string, active: boolean): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/vehicles/${encodeURIComponent(vehicleId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify({ active }) });
  if (!response.ok) throw new Error('Unable to update vehicle status.');
}

export async function setVendorDriverActive(vehicleId: string, driverActive: boolean): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/vehicles/${encodeURIComponent(vehicleId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify({ active: true, driverActive }) });
  if (!response.ok) throw new Error('Unable to update driver status.');
}

export async function deleteVendorVehicle(vehicleId: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/vehicles/${encodeURIComponent(vehicleId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  if (!response.ok) throw new Error('Unable to delete vehicle.');
}

export interface AdminDashboardData {
  orders: AppData['orders'];
  vendors: Vendor[];
  customers: AdminCustomer[];
  revenue: number;
  delivered: number;
  activeDeliveries: number;
  activeVendors: number;
  chart: Array<{ label: string; water: number; sewage: number }>;
}

export interface AdminCustomer {
  uid: string;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface AdminAccountInput {
  role: 'customer' | 'vendor';
  displayName: string;
  email: string;
  phoneNumber: string;
  password: string;
}

export async function loadAdminDashboard(): Promise<AdminDashboardData> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/dashboard`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  if (!response.ok) throw new Error('Unable to load admin dashboard data.');
  return await response.json() as AdminDashboardData;
}

export async function notifyVendorsOfOrder(orderId: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/orders/${encodeURIComponent(orderId)}/notify-vendors`, { method: 'POST', headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message || 'Unable to notify vendors.');
}

export async function createAdminAccount(input: AdminAccountInput): Promise<{ uid: string; role: AdminAccountInput['role']; name: string; email: string; phone: string; status: string; available: boolean }> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => ({})) as { uid?: string; role?: AdminAccountInput['role']; name?: string; email?: string; phone?: string; status?: string; available?: boolean; message?: string };
  if (!response.ok || !payload.uid || !payload.role) throw new Error(payload.message || 'Unable to create account.');
  return { uid: payload.uid, role: payload.role, name: payload.name || input.displayName, email: payload.email || input.email, phone: payload.phone || input.phoneNumber, status: payload.status || 'inactive', available: payload.available === true };
}

export async function deleteAdminAccount(uid: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${encodeURIComponent(uid)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  if (!response.ok) { const payload = await response.json().catch(() => ({})) as { message?: string }; throw new Error(payload.message || 'Unable to delete account.'); }
}

export async function updateAdminVendorStatus(vendorUid: string, active: boolean): Promise<{ uid: string; status: string; available: boolean }> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/vendors/${encodeURIComponent(vendorUid)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId },
    body: JSON.stringify({ active }),
  });
  const payload = await response.json().catch(() => ({})) as { uid?: string; status?: string; available?: boolean; message?: string };
  if (!response.ok || !payload.uid) throw new Error(payload.message || 'Unable to update vendor status.');
  return { uid: payload.uid, status: payload.status || (active ? 'active' : 'inactive'), available: payload.available === true };
}

export async function updateVendorOrder(order: AppData['orders'][number], options: { action?: 'accept' | 'reject'; vehicleId?: string; driverId?: string; deliveryOtp?: string; rejectionReason?: string } = {}): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify({ action: options.action, vehicleId: options.vehicleId, driverId: options.driverId, deliveryOtp: options.deliveryOtp, rejectionReason: options.rejectionReason, status: order.status, eta: order.eta, vendorLatitude: order.vendorLatitude, vendorLongitude: order.vendorLongitude }) });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(payload.message || 'Unable to update vendor order.');
  }
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
  const vendors = role === 'vendor' ? [...(state.value?.vendors || []), { uid: user.uid, name: profile.name, email: profile.email || user.email || '', driver: profile.name, phone: profile.phone, zone: '', vehicle: '', capacity: '', status: 'inactive', available: false, rating: '' }] : state.value?.vendors || [];
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
