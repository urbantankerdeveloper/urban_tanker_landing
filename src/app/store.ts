import { create } from 'zustand';
import { initialState } from '../shared/data/demo';
import { signOutUser } from '../features/auth/auth';
import { persistCloudState } from '../shared/lib/cloudStore';
import { saveEncryptedState } from '../shared/lib/secureCache';
import type { AppData, AppPatch, BookingDraft, LocationDetails, Order, Role, Workspace } from '../shared/lib/types';
import { defaultContent, type AppContent } from '../shared/lib/content';

interface AppStore {
  data: AppData;
  content: AppContent;
  isHydrated: boolean;
  active: Workspace;
  toast: string;
  mobileNav: boolean;
  checkoutOpen: boolean;
  sidebarCollapsed: boolean;
  searchQuery: string;
  searchOpen: boolean;
  online: boolean;
  notificationOpen: boolean;
  notificationCount: number;
  authRole: Role;
  authName: string;
  authEmail: string;
  authPassword: string;
  authPhone: string;
  authBusy: boolean;
  authError: string;
  authRememberMe: boolean;
  checkoutMethod: string;
  adminQuery: string;
  vendorStage: Order['status'];
  bookingDraft: BookingDraft;
  update: (patch: AppPatch) => void;
  setActive: (active: Workspace) => void;
  setRole: (role: Role) => void;
  setMobileNav: (open: boolean) => void;
  notify: (message: string) => void;
  dismissToast: () => void;
  setCheckoutOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchOpen: (open: boolean) => void;
  setOnline: (online: boolean) => void;
  setNotificationOpen: (open: boolean) => void;
  setNotificationCount: (count: number) => void;
  setAuthRole: (role: Role) => void;
  setAuthName: (name: string) => void;
  setAuthEmail: (email: string) => void;
  setAuthPassword: (password: string) => void;
  setAuthPhone: (phone: string) => void;
  setAuthBusy: (busy: boolean) => void;
  setAuthError: (error: string) => void;
  setAuthRememberMe: (remember: boolean) => void;
  setCheckoutMethod: (method: string) => void;
  setAdminQuery: (query: string) => void;
  setVendorStage: (stage: Order['status']) => void;
  setBookingDraft: <K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) => void;
  completeBooking: (order: Order) => void;
  updateOrder: (order: Order) => void;
  setHydrated: (hydrated: boolean) => void;
  signOut: () => void;
  requestLocation: () => Promise<void>;
}

let toastTimer: number | undefined;

export const useAppStore = create<AppStore>((set, get) => ({
  data: initialState, content: defaultContent, isHydrated: false, active: 'overview', toast: '', mobileNav: false, checkoutOpen: false, sidebarCollapsed: false, searchQuery: '', searchOpen: false, online: typeof navigator === 'undefined' ? true : navigator.onLine, notificationOpen: false, notificationCount: 0,
  authRole: 'customer', authName: '', authEmail: '', authPassword: '', authPhone: '', authBusy: false, authError: '', authRememberMe: true, checkoutMethod: 'UPI', adminQuery: '',
  vendorStage: 'Created', bookingDraft: initialState.booking,
  update: patch => {
    const next = { ...get().data, ...patch };
    set({ data: next });
    saveEncryptedState(next).catch(() => undefined);
    persistCloudState(next).catch(() => get().notify('Saved locally.'));
  },
  setActive: active => set({ active, mobileNav: false }),
  setRole: role => { get().update({ role }); set({ active: 'overview', mobileNav: false }); },
  setMobileNav: mobileNav => set({ mobileNav }),
  notify: message => {
    if (toastTimer) window.clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = window.setTimeout(() => {
      set({ toast: '' });
      toastTimer = undefined;
    }, 3200);
  },
  dismissToast: () => {
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = undefined;
    set({ toast: '' });
  },
  setCheckoutOpen: checkoutOpen => set({ checkoutOpen }),
  setSidebarCollapsed: sidebarCollapsed => set({ sidebarCollapsed }),
  setSearchQuery: searchQuery => set({ searchQuery }),
  setSearchOpen: searchOpen => set({ searchOpen }),
  setOnline: online => set({ online }),
  setNotificationOpen: notificationOpen => set({ notificationOpen }),
  setNotificationCount: notificationCount => set({ notificationCount }),
  setAuthRole: authRole => set({ authRole }),
  setAuthName: authName => set({ authName }),
  setAuthEmail: authEmail => set({ authEmail }),
  setAuthPassword: authPassword => set({ authPassword }),
  setAuthPhone: authPhone => set({ authPhone }),
  setAuthBusy: authBusy => set({ authBusy }),
  setAuthError: authError => set({ authError }),
  setAuthRememberMe: authRememberMe => set({ authRememberMe }),
  setCheckoutMethod: checkoutMethod => set({ checkoutMethod }),
  setAdminQuery: adminQuery => set({ adminQuery }),
  setVendorStage: vendorStage => set({ vendorStage }),
  setBookingDraft: (key, value) => set(state => ({ bookingDraft: { ...state.bookingDraft, [key]: value } })),
  completeBooking: order => { get().update({ orders: [order, ...get().data.orders], pendingBooking: undefined }); set({ checkoutOpen: false, active: 'track' }); get().notify('Booking confirmed. A vendor will be assigned shortly.'); },
  updateOrder: order => get().update({ orders: get().data.orders.map(item => item.id === order.id ? order : item) })
  ,setHydrated: isHydrated => set({ isHydrated }),
  signOut: () => { signOutUser().catch(() => undefined); get().update({ profile: null }); set({ active: 'overview', checkoutOpen: false, mobileNav: false }); get().notify('You have signed out.'); }
  ,requestLocation: () => new Promise(resolve => {
    if (!navigator.geolocation) {
      get().update({ location: { ...get().data.location, permission: 'unavailable' } });
      get().notify('Location services are not available in this browser.');
      resolve();
      return;
    }
    navigator.geolocation.getCurrentPosition(position => {
      const location: LocationDetails = { address: `Current location · ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, permission: 'granted', updatedAt: new Date().toISOString() };
      get().update({ location, booking: { ...get().data.booking, address: location.address } });
      get().notify('Your delivery location is now saved for this booking.');
      resolve();
    }, error => {
      const permission = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      get().update({ location: { ...get().data.location, permission } });
      get().notify(permission === 'denied' ? 'Location permission was denied. Enter your address manually.' : 'Unable to read your current location.');
      resolve();
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  })
}));

export const hydrateCloudState = (cloudState: Record<string, unknown>) => {
  useAppStore.setState(state => {
    const data = { ...state.data, ...cloudState } as AppData;
    saveEncryptedState(data).catch(() => undefined);
    return { data, bookingDraft: data.booking, isHydrated: true };
  });
};

export const hydrateContent = (cloudContent: Partial<AppContent>) => {
  useAppStore.setState(state => ({ content: {
    ...state.content,
    ...cloudContent,
    coupons: Array.isArray(cloudContent.coupons) ? cloudContent.coupons : [],
    brand: { ...state.content.brand, ...cloudContent.brand },
    customer: { ...state.content.customer, ...cloudContent.customer },
    auth: { ...state.content.auth, ...cloudContent.auth },
    operations: { ...state.content.operations, ...cloudContent.operations },
    checkout: { ...state.content.checkout, ...cloudContent.checkout },
    vendor: { ...state.content.vendor, ...cloudContent.vendor },
    admin: { ...state.content.admin, ...cloudContent.admin }
  } as AppContent }));
};