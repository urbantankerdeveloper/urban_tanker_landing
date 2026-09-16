import { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthScreen } from './components/AuthScreen';
import { CheckoutModal } from './components/CheckoutModal';
import { CustomerPortal } from './components/CustomerPortal';
import { CustomerHomeShell } from './components/CustomerHomeShell';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { Toast } from './components/Toast';
import { VendorPortal } from './components/VendorPortal';
import { contentClientId, getUserProfile, refreshCloudState, subscribeToCloudState, subscribeToContent, subscribeToOperations } from './cloudStore';
import { readEncryptedContent, readEncryptedState, saveEncryptedContent } from './secureCache';
import { firebaseEnabled } from './firebase';
import { hydrateCloudState, hydrateContent, useAppStore } from './store';
import { useAuth } from './contexts/AuthContext';
import type { AppContent } from './content';
import type { Role, Workspace } from './types';

export function App() {
  const { data, isHydrated, active, toast, mobileNav, checkoutOpen, setRole, setActive, setMobileNav, notify, setCheckoutOpen, setHydrated, signOut } = useAppStore();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (active !== 'book') return;
    const dateInput = document.querySelector<HTMLInputElement>('.booking-layout .field-row input');
    if (!dateInput) return;
    dateInput.type = 'date';
    dateInput.min = new Date().toISOString().slice(0, 10);
    dateInput.required = true;
  }, [active]);

  useEffect(() => {
    let unsubscribeCloud = () => undefined;
    let unsubscribeContent = () => undefined;
    let unsubscribeOperations = () => undefined;
    let refreshTimer: number | undefined;
    readEncryptedContent<Partial<AppContent>>(contentClientId).then(({ value }) => {
      if (value) hydrateContent(value);
    }).catch(() => undefined);
    if (firebaseEnabled) {
      subscribeToContent(contentClientId, content => {
        hydrateContent(content);
        saveEncryptedContent(contentClientId, content).catch(() => undefined);
      }, () => notify('Remote content is unavailable. Using cached or default copy.'))
        .then(stop => { unsubscribeContent = stop; })
        .catch(() => notify('Unable to load remote content.'));
    }
    if (authLoading) return () => { if (refreshTimer) window.clearInterval(refreshTimer); };
    if (!user) {
      useAppStore.setState(state => ({ data: { ...state.data, profile: null }, isHydrated: true }));
      return () => { if (refreshTimer) window.clearInterval(refreshTimer); };
    }
    const hydrateUser = async () => {
      const cached = await readEncryptedState<typeof data>();
      const cachedData = cached.value || useAppStore.getState().data;
      const claims = await user.getIdTokenResult();
      const claimRole = claims.claims.role as Role | undefined;
      const userProfile = await getUserProfile();
      useAppStore.setState({ data: { ...cachedData, profile: { name: user.displayName || userProfile?.name || cachedData.profile?.name || user.email?.split('@')[0] || 'Urban Tanker user', email: user.email || userProfile?.email || cachedData.profile?.email || '', phone: user.phoneNumber || userProfile?.phone || cachedData.profile?.phone || '' }, role: claimRole || userProfile?.role || cachedData.role }, bookingDraft: cachedData.booking });
      subscribeToCloudState(cloudState => hydrateCloudState(cloudState), () => notify('Firebase sync is unavailable. Continuing with cached data.'))
        .then(stop => { unsubscribeCloud = stop; })
        .catch(() => notify('Unable to sync Firebase data.'));
      subscribeToOperations(operations => {
        useAppStore.setState(state => ({ data: { ...state.data, orders: operations.orders.length ? operations.orders : state.data.orders, vendors: operations.vendors.length ? operations.vendors : state.data.vendors } }));
      }, () => notify('Shared operations data is unavailable. Continuing with cached data.'))
        .then(stop => { unsubscribeOperations = stop; })
        .catch(() => undefined);
      refreshTimer = window.setInterval(() => {
        readEncryptedState<typeof data>().then(({ expired }) => {
          if (expired) refreshCloudState().then(hydrateCloudState).catch(() => notify('Unable to refresh Firebase data.'));
        });
      }, 60_000);
      setHydrated(true);
    };
    void hydrateUser();
    return () => { unsubscribeCloud(); unsubscribeContent(); unsubscribeOperations(); if (refreshTimer) window.clearInterval(refreshTimer); };
  }, [authLoading, notify, setHydrated, user]);

  if (authLoading || !isHydrated) return <LoadingSkeleton />;
  if (!data.profile) return <AuthScreen />;
  if (data.role === 'customer') return <>
    <CustomerHomeShell onNavigate={setActive} onSignOut={signOut}><CustomerPortal /></CustomerHomeShell>
    <Toast message={toast} />
    {checkoutOpen && <CheckoutModal />}
  </>;
  return <>
    <AppShell role={data.role} active={active} mobileNav={mobileNav} onRoleChange={role => setRole(role as Role)} onNavigate={id => setActive(id as Workspace)} onToggleMobileNav={() => setMobileNav(!mobileNav)} onNotify={notify} onSignOut={signOut}>
      {data.role === 'vendor' && <VendorPortal />}
      {data.role === 'admin' && <AdminDashboard />}
    </AppShell>
    <Toast message={toast} />
    {checkoutOpen && <CheckoutModal />}
  </>;
}
