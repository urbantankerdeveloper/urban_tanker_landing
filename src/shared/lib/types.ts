export type Role = 'customer' | 'vendor' | 'admin';
export type Workspace = 'overview' | 'book' | 'orders' | 'track' | 'support';
export type OrderStatus = 'Vendor assigned' | 'Vendor accepted' | 'Vendor rejected' | 'En route' | 'Arrived' | 'Delivered';

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
  couponCode?: string;
  discount?: number;
  ownerUid?: string;
  assignedVendorUid?: string;
  customerEmail?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorLatitude?: number;
  vendorLongitude?: number;
  vendorDecision?: 'pending' | 'accepted' | 'rejected';
  vendorAcceptedAt?: string;
  vendorRejectedAt?: string;
  deliveryOtp?: string;
  otpVerifiedAt?: string;
  lastLocationUpdatedAt?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
}

export interface Vendor {
  uid?: string;
  email?: string;
  name: string;
  driver: string;
  zone: string;
  vehicle: string;
  capacity: string;
  status: string;
  rating: string;
  latitude?: number;
  longitude?: number;
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
