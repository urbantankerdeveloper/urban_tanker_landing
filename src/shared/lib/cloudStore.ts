/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentUser } from '../../features/auth/auth';
import { API_BASE_URL } from './apiConfig';
import { readEncryptedContent, readEncryptedState, saveEncryptedContent, saveEncryptedState } from './secureCache';
import type { AppData, Profile, Role, Vehicle, Vendor } from './types';
import type { CouponContent } from './content';
import { notificationsResponseSchema, orderHistoryItemSchema, parseApiResponse } from './apiSchemas';

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

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  status: string;
  timestamp?: string | Date;
  read?: boolean;
}

export async function loadNotifications(): Promise<{ unreadCount: number; notifications: NotificationItem[] }> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/notifications`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load notifications.');
  return parseApiResponse(notificationsResponseSchema, await response.json());
}

export async function markNotificationsRead(notificationIds: string[]): Promise<void> {
  const user = getCurrentUser();
  if (!user || !notificationIds.length) return;
  await Promise.all(notificationIds.map(notificationId => fetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } })));
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
    }).then(response => { if (!response.ok) throw new Error('Unable to persist order.'); }).catch(() => enqueueOfflineMutation(order))));
  }
}

const OFFLINE_MUTATION_KEY = 'urban-tanker-offline-order-mutations';
function enqueueOfflineMutation(order: AppData['orders'][number]): void {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_MUTATION_KEY) || '[]') as AppData['orders'];
  const next = [...queue.filter(item => item.id !== order.id), order].slice(-50);
  localStorage.setItem(OFFLINE_MUTATION_KEY, JSON.stringify(next));
}

export async function flushOfflineMutations(): Promise<void> {
  const user = getCurrentUser();
  if (!user || !navigator.onLine) return;
  const queue = JSON.parse(localStorage.getItem(OFFLINE_MUTATION_KEY) || '[]') as AppData['orders'];
  if (!queue.length) return;
  const remaining: AppData['orders'] = [];
  for (const order of queue) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}` }, body: JSON.stringify({ ...withoutUndefined(order), ownerUid: user.uid }) });
      if (!response.ok) remaining.push(order);
    } catch { remaining.push(order); }
  }
  localStorage.setItem(OFFLINE_MUTATION_KEY, JSON.stringify(remaining));
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

export async function cancelCustomerOrder(orderId: string, reason?: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify({ reason }) });
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message || 'Unable to cancel the order.');
}

export async function rescheduleCustomerOrder(orderId: string, scheduledDate: string, scheduledSlot: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/orders/${encodeURIComponent(orderId)}/reschedule`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify({ scheduledDate, scheduledSlot }) });
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message || 'Unable to reschedule the order.');
}

export async function rateCustomerOrder(orderId: string, rating: number, feedback?: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/orders/${encodeURIComponent(orderId)}/rating`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify({ rating, feedback }) });
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message || 'Unable to save customer feedback.');
}

export async function loadCustomerSubscriptions(): Promise<Array<Record<string, unknown>>> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/customer/subscriptions`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  if (!response.ok) throw new Error('Unable to load subscriptions.');
  return ((await response.json()) as { subscriptions?: Array<Record<string, unknown>> }).subscriptions || [];
}

export async function loadCustomerInvoices(): Promise<Array<Record<string, unknown>>> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/customer/invoices`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load invoices.');
  return ((await response.json()) as { invoices?: Array<Record<string, unknown>> }).invoices || [];
}

export async function createCustomerSubscription(input: { service: string; capacity: string; frequency: string; nextDelivery: string }): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/customer/subscriptions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error('Unable to create subscription.');
}

export async function loadVendorMaintenance(): Promise<Array<Record<string, unknown>>> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/maintenance`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  if (!response.ok) throw new Error('Unable to load maintenance records.');
  return ((await response.json()) as { records?: Array<Record<string, unknown>> }).records || [];
}

export async function loadVendorExpiringDocuments(): Promise<Array<Record<string, unknown>>> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/fleet/expiring-documents`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  if (!response.ok) throw new Error('Unable to load document expiry alerts.');
  return ((await response.json()) as { vehicles?: Array<Record<string, unknown>> }).vehicles || [];
}

export async function createVendorMaintenance(input: { vehicleId: string; scheduledAt: string; description: string; cost: number }): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/maintenance`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error('Unable to schedule maintenance.');
}

export async function saveDriverAttendance(input: { driverId: string; date: string; status: string; notes?: string }): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/attendance`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error('Unable to save driver attendance.');
}

export async function loadVendorPayouts(): Promise<Array<Record<string, unknown>>> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/payouts`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  if (!response.ok) throw new Error('Unable to load payouts.');
  return ((await response.json()) as { payouts?: Array<Record<string, unknown>> }).payouts || [];
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
  const result = await response.json() as { vehicles: Array<{ id: string; registration_number: string; vehicle_type: string; capacity?: string; active: boolean; driver_id?: string; driver_name?: string; driver_phone?: string; driver_active?: boolean; image_url?: string; registration_expiry?: string; insurance_expiry?: string; permit_expiry?: string }> };
  return (result.vehicles || []).map(vehicle => ({ id: vehicle.id, registrationNumber: vehicle.registration_number, vehicleType: vehicle.vehicle_type, capacity: vehicle.capacity || '', active: vehicle.active, driverId: vehicle.driver_id || '', driverName: vehicle.driver_name || '', driverPhone: vehicle.driver_phone || '', driverActive: vehicle.driver_active === true, imageUrl: vehicle.image_url, registrationExpiry: vehicle.registration_expiry, insuranceExpiry: vehicle.insurance_expiry, permitExpiry: vehicle.permit_expiry }));
}

export async function loadVendorDrivers(): Promise<Array<{ id: string; name: string; phone: string; active: boolean }>> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/drivers`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  if (!response.ok) throw new Error('Unable to load drivers.');
  return ((await response.json()) as { drivers?: Array<{ id: string; name: string; phone?: string; address?: string; address_proof?: string; active: boolean }> }).drivers?.map(driver => ({ id: driver.id, name: driver.name, phone: driver.phone || '', address: driver.address || '', addressProof: driver.address_proof || '', active: driver.active })) || [];
}

export async function createVendorDriver(input: { name: string; phone: string; address?: string; addressProof?: string }): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/drivers`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify({ ...input, address: input.address || '', addressProof: input.addressProof || '' }) });
  if (!response.ok) throw new Error('Unable to create driver.');
}

export async function createAdminDriver(vendorUid: string, input: { name: string; phone: string; address: string; addressProof?: string }): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/vendors/${encodeURIComponent(vendorUid)}/drivers`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message || 'Unable to create driver.');
}

export async function loadAdminVendorDrivers(vendorUid: string): Promise<Array<{ id: string; name: string; phone: string; active: boolean }>> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/vendors/${encodeURIComponent(vendorUid)}/drivers`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  const payload = await response.json().catch(() => ({})) as { drivers?: Array<{ id: string; name: string; phone?: string; active: boolean }>; message?: string };
  if (!response.ok) throw new Error(payload.message || 'Unable to load vendor drivers.');
  return (payload.drivers || []).map(driver => ({ id: driver.id, name: driver.name, phone: driver.phone || '', active: driver.active }));
}

export async function loadAdminVehicles(): Promise<Array<{ id: string; registrationNumber: string; vehicleType: string; capacity: string; active: boolean; vendorUid: string; vendorName: string }>> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/vehicles`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  const payload = await response.json().catch(() => ({})) as { vehicles?: Array<{ id: string; registration_number: string; vehicle_type: string; capacity?: string; active: boolean; vendor_uid?: string; vendor_name?: string; image_url?: string }>; message?: string };
  if (!response.ok) throw new Error(payload.message || 'Unable to load vehicles.');
  return (payload.vehicles || []).map(vehicle => ({
    id: vehicle.id,
    registrationNumber: vehicle.registration_number,
    vehicleType: vehicle.vehicle_type,
    capacity: vehicle.capacity || '',
    active: vehicle.active,
    vendorUid: vehicle.vendor_uid || '',
    vendorName: vehicle.vendor_name || 'Unknown vendor',
  }));
}

export async function loadAdminDrivers(): Promise<Array<{ id: string; name: string; phone: string; active: boolean; vendorUid: string; vendorName: string }>> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/drivers`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  const payload = await response.json().catch(() => ({})) as { drivers?: Array<{ id: string; name: string; phone?: string; active: boolean; vendor_uid?: string; vendor_name?: string }>; message?: string };
  if (!response.ok) throw new Error(payload.message || 'Unable to load drivers.');
  return (payload.drivers || []).map(driver => ({
    id: driver.id,
    name: driver.name,
    phone: driver.phone || '',
    active: driver.active,
    vendorUid: driver.vendor_uid || '',
    vendorName: driver.vendor_name || 'Unknown vendor',
  }));
}

export async function setVendorDriverStatus(driverId: string, active: boolean): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/drivers/${encodeURIComponent(driverId)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify({ active }) });
  if (!response.ok) throw new Error('Unable to update driver status.');
}

export async function deleteVendorDriver(driverId: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/drivers/${encodeURIComponent(driverId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  if (!response.ok) throw new Error('Unable to delete driver.');
}

export async function createVendorVehicle(input: { registrationNumber: string; vehicleType: string; capacity: string; driverName: string; driverPhone: string; imageUrl?: string; registrationExpiry?: string; insuranceExpiry?: string; permitExpiry?: string }): Promise<Vehicle> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/vehicles`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify(input) });
  const payload = await response.json() as { vehicle?: { id: string; registration_number: string; vehicle_type: string; capacity?: string; active: boolean; driver_id?: string; driver_name?: string; driver_phone?: string; driver_active?: boolean; image_url?: string; registration_expiry?: string; insurance_expiry?: string; permit_expiry?: string }; message?: string };
  if (!response.ok || !payload.vehicle) throw new Error(payload.message || 'Unable to create vehicle.');
  return { id: payload.vehicle.id, registrationNumber: payload.vehicle.registration_number, vehicleType: payload.vehicle.vehicle_type, capacity: payload.vehicle.capacity || '', active: payload.vehicle.active, driverId: payload.vehicle.driver_id || '', driverName: payload.vehicle.driver_name || '', driverPhone: payload.vehicle.driver_phone || '', driverActive: payload.vehicle.driver_active === true, imageUrl: payload.vehicle.image_url, registrationExpiry: payload.vehicle.registration_expiry, insuranceExpiry: payload.vehicle.insurance_expiry, permitExpiry: payload.vehicle.permit_expiry };
}

export async function createAdminVehicle(vendorUid: string, input: { registrationNumber: string; vehicleType: string; capacity: string; imageUrl?: string; registrationExpiry?: string; insuranceExpiry?: string; permitExpiry?: string }): Promise<Vehicle> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/vendors/${encodeURIComponent(vendorUid)}/vehicles`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => ({})) as { vehicle?: { id: string; registration_number: string; vehicle_type: string; capacity?: string; active: boolean; image_url?: string }; message?: string };
  if (!response.ok || !payload.vehicle) throw new Error(payload.message || 'Unable to create vehicle.');
  return { id: payload.vehicle.id, registrationNumber: payload.vehicle.registration_number, vehicleType: payload.vehicle.vehicle_type, capacity: payload.vehicle.capacity || '', active: payload.vehicle.active, driverId: '', driverName: '', driverPhone: '', driverActive: false, imageUrl: payload.vehicle.image_url };
}

export async function loadAdminVendorVehicles(vendorUid: string): Promise<Vehicle[]> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/vendors/${encodeURIComponent(vendorUid)}/vehicles`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId } });
  const payload = await response.json().catch(() => ({})) as { vehicles?: Array<{ id: string; registration_number: string; vehicle_type: string; capacity?: string; active: boolean; image_url?: string }>; message?: string };
  if (!response.ok) throw new Error(payload.message || 'Unable to load vendor vehicles.');
  return (payload.vehicles || []).map(vehicle => ({ id: vehicle.id, registrationNumber: vehicle.registration_number, vehicleType: vehicle.vehicle_type, capacity: vehicle.capacity || '', active: vehicle.active, driverId: '', driverName: '', driverPhone: '', driverActive: false, imageUrl: vehicle.image_url }));
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

export async function assignAdminOrderToVendor(orderId: string, vendorUid: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/orders/${encodeURIComponent(orderId)}/assign`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify({ vendorUid }) });
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message || 'Unable to assign the vendor.');
}

export interface OrderHistoryItem {
  order_id: string;
  client_id: string;
  status: string;
  timestamp: string | Date;
  actor_uid?: string;
  actor_role?: string;
  vendor_uid?: string;
  rejection_reason?: string;
}

export async function loadAdminOrderHistory(orderId: string): Promise<OrderHistoryItem[]> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/orders/${encodeURIComponent(orderId)}/history`, { headers: { Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, cache: 'no-store' });
  const payload = await response.json().catch(() => ({})) as { history?: OrderHistoryItem[]; message?: string };
  if (!response.ok) throw new Error(payload.message || 'Unable to load order history.');
  return (payload.history || []).map(item => {
    const parsed = parseApiResponse(orderHistoryItemSchema, item);
    return { ...parsed, timestamp: parsed.timestamp || new Date() };
  });
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

export async function createAdminCoupon(input: { code: string; label: string; discount: number; service?: string; firstBooking?: boolean }): Promise<CouponContent> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/coupons`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => ({})) as { coupon?: CouponContent; message?: string };
  if (!response.ok || !payload.coupon) throw new Error(payload.message || 'Unable to create coupon.');
  return payload.coupon;
}

export async function updateAdminCouponStatus(code: string, active: boolean): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/admin/coupons/${encodeURIComponent(code)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify({ active }) });
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message || 'Unable to update coupon status.');
}

export async function updateVendorOrder(order: AppData['orders'][number], options: { action?: 'accept' | 'reject'; vehicleId?: string; driverId?: string; deliveryOtp?: string; rejectionReason?: string; deliveryProof?: string } = {}): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('Authentication is required.');
  const response = await fetch(`${API_BASE_URL}/api/vendor/orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'X-Client-Id': contentClientId }, body: JSON.stringify({ action: options.action, vehicleId: options.vehicleId, driverId: options.driverId, deliveryOtp: options.deliveryOtp, rejectionReason: options.rejectionReason, deliveryProof: options.deliveryProof, status: order.status, eta: order.eta, vendorLatitude: order.vendorLatitude, vendorLongitude: order.vendorLongitude }) });
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
