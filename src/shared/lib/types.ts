export type Role = 'customer' | 'vendor' | 'admin';
export type Workspace = 'overview' | 'book' | 'orders' | 'track' | 'support' | 'fleet' | 'customers' | 'vendors' | 'coupons';
export type OrderStatus = 'Created' | 'Pending acceptance' | 'Accepted' | 'En route' | 'Arrived' | 'Delivered' | 'Rejected' | 'Vendor assigned' | 'Vendor accepted' | 'Vendor rejected';

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
  customerPhone?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorLatitude?: number;
  vendorLongitude?: number;
  vendorDecision?: 'pending' | 'accepted' | 'rejected';
  vendorAcceptedAt?: string;
  vendorRejectedAt?: string;
  vendorRejectionReason?: string;
  rejectedVendorUids?: string[];
  customerDeliveryOtp?: string;
  otpVerifiedAt?: string;
  lastLocationUpdatedAt?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  vehicleId?: string;
  vehicleRegistrationNumber?: string;
  vehicleType?: string;
  vehicleCapacity?: string;
  driverId?: string;
  driverPhone?: string;
  driverActive?: boolean;
  statusHistory?: Array<{ status: OrderStatus; timestamp: string; actorUid?: string; actorRole?: Role; vendorUid?: string; rejectionReason?: string }>;
}

export interface Vendor {
  uid?: string;
  email?: string;
  phone?: string;
  name: string;
  driver: string;
  zone: string;
  vehicle: string;
  capacity: string;
  status: string;
  available?: boolean;
  rating: string;
  latitude?: number;
  longitude?: number;
  updated_at?: string | Date;
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  vehicleType: string;
  capacity: string;
  active: boolean;
  driverId: string;
  driverName: string;
  driverPhone: string;
  driverActive: boolean;
  imageUrl?: string;
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
