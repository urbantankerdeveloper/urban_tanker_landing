export type Role = 'customer' | 'vendor' | 'admin';
export type Workspace = 'overview' | 'book' | 'offers' | 'orders' | 'track' | 'support' | 'addresses' | 'fleet' | 'drivers' | 'maintenance' | 'attendance' | 'payouts' | 'subscriptions' | 'invoices' | 'dispatch' | 'customers' | 'vendors' | 'coupons' | 'offers-management';
export type OrderStatus = 'Created' | 'Pending acceptance' | 'Accepted' | 'En route' | 'Arrived' | 'Delivered' | 'Rejected' | 'Cancelled' | 'Vendor assigned' | 'Vendor accepted' | 'Vendor rejected';

export interface Profile {
  name: string;
  phone: string;
  email?: string;
}

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  city: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  createdAt: string;
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
  isEmergency?: boolean;
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
  paymentId?: string;
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
  deliveryProofUrl?: string;
  scheduledDate?: string;
  scheduledSlot?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  customerRating?: number;
  customerFeedback?: string;
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
  // New fields for Phase 1 features
  isEmergency?: boolean;
  emergencySurge?: number;
  invoiceId?: string;
  invoiceUrl?: string;
  walletDeduction?: number;
  subscriptionId?: string;
  isGuestOrder?: boolean;
  guestEmail?: string;
  guestPhone?: string;
  guestOtp?: string;
  guestOtpVerified?: boolean;
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
  registrationExpiry?: string;
  insuranceExpiry?: string;
  permitExpiry?: string;
}

export interface Offer {
  id: string;
  service: 'Water tanker' | 'Sewage pickup' | 'Both';
  title: string;
  description: string;
  discount: string;
  minOrder: string;
  validFrom: string;
  validUntil: string;
  active: boolean;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

// Emergency Booking
export interface EmergencyBookingConfig {
  enabled: boolean;
  surgePricePercentage: number;
  availableServices: string[];
  maxDeliveryTime: number; // minutes
}

// Guest Checkout
export interface GuestProfile {
  name: string;
  email: string;
  phone: string;
  isGuest: true;
}

export interface GuestOrder extends Order {
  isGuestOrder: true;
  guestEmail: string;
  guestPhone: string;
  guestOtp?: string;
  guestOtpVerified: boolean;
  expiresAt: string; // 30 minutes from creation
}

// Wallet
export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit' | 'refund';
  amount: number;
  description: string;
  timestamp: string;
  orderId?: string;
  balance: number; // balance after transaction
}

export interface Wallet {
  uid: string;
  balance: number;
  currency: string;
  lastUpdated: string;
  transactions: WalletTransaction[];
  totalCredit: number;
  totalDebit: number;
}

// Subscriptions
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  price: number;
  deliveriesIncluded: number;
  discountPercentage: number;
  features: string[];
  active: boolean;
}

export interface CustomerSubscription {
  id: string;
  customerId: string;
  planId: string;
  planName: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  startDate: string;
  renewalDate: string;
  remainingDeliveries: number;
  autoRenew: boolean;
  subscriptionPrice: number;
  nextBillingDate: string;
}

// Invoice
export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  date: string;
  dueDate: string;
  amount: number;
  discount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentId: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vendorName: string;
  billItems: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  createdAt: string;
  pdfUrl?: string;
}

// Booking Wizard State
export interface BookingWizardState {
  currentStep: 1 | 2 | 3;
  isGuest: boolean;
  guestProfile?: GuestProfile;
  isEmergency: boolean;
  verificationStatus: 'pending' | 'verified' | 'failed';
  completedSteps: number[];
}

export interface AppData {
  role: Role;
  profile: Profile | null;
  location: LocationDetails;
  booking: BookingDraft;
  orders: Order[];
  vendors: Vendor[];
  savedAddresses: SavedAddress[];
  pendingBooking?: BookingDraft & { amount: number };
  wallet?: Wallet;
  subscriptions?: CustomerSubscription[];
  invoices?: Invoice[];
}

export type AppPatch = Partial<AppData>;
