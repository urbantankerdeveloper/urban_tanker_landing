export type Role = 'customer' | 'vendor' | 'admin';
export type Workspace = 'overview' | 'book' | 'orders' | 'track' | 'support';
export type OrderStatus = 'Vendor assigned' | 'En route' | 'Arrived' | 'Delivered';

export interface Profile {
  name: string;
  phone: string;
  email?: string;
}

export interface BookingDraft {
  service: 'Water tanker' | 'Sewage pickup';
  waterType: string;
  capacity: string;
  date: string;
  slot: string;
  address: string;
  landmark: string;
  notes: string;
}

export interface LocationDetails {
  address: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  permission: 'prompt' | 'granted' | 'denied' | 'unavailable';
  updatedAt: string | null;
}

export interface Order {
  id: string;
  service: string;
  capacity: string;
  address: string;
  customer: string;
  amount: number;
  status: OrderStatus;
  vendor: string;
  driver: string;
  eta: string;
  payment: string;
  created: string;
}

export interface Vendor {
  name: string;
  driver: string;
  zone: string;
  vehicle: string;
  capacity: string;
  status: string;
  rating: string;
}

export interface AppData {
  role: Role;
  profile: Profile | null;
  location: LocationDetails;
  booking: BookingDraft;
  orders: Order[];
  vendors: Vendor[];
  pendingBooking?: BookingDraft & { amount: number };
}

export type AppPatch = Partial<AppData>;
