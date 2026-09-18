import { useEffect } from 'react';
import { AppShell } from '../shared/components/AppShell';
import { AdminDashboard, VendorPortal } from '../features/operations';
import { AuthScreen } from '../features/auth/AuthScreen';
import { CheckoutModal } from '../features/checkout/CheckoutModal';
import { CustomerPortal, CustomerHomeShell } from '../features/customer';
import { LoadingSkeleton, Toast } from '../shared/components';
import { contentClientId, getUserProfile, refreshCloudState, subscribeToCloudState, subscribeToContent, subscribeToOperations } from '../shared/lib/cloudStore';
import { readEncryptedContent, readEncryptedState, saveEncryptedContent } from '../shared/lib/secureCache';
import { hydrateCloudState, hydrateContent, useAppStore } from './store';
import { useAuth } from './providers/AuthContext';
import type { AppContent } from '../shared/lib/content';
import type { Workspace } from '../shared/lib/types';

export function App() {
  const { data, isHydrated, active, toast, mobileNav, checkoutOpen, setActive, setMobileNav, setHydrated, notify, signOut, dismissToast } = useAppStore();
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
    subscribeToContent(contentClientId, content => {
      hydrateContent(content);
      saveEncryptedContent(contentClientId, content).catch(() => undefined);
    }, () => notify('Saved content is unavailable. Using cached or default copy.'))
      .then(stop => { unsubscribeContent = stop; })
      .catch(() => notify('Unable to load saved content.'));
    if (authLoading) return () => { if (refreshTimer) window.clearInterval(refreshTimer); };
    if (!user) {
      useAppStore.setState(state => ({ data: { ...state.data, profile: null }, isHydrated: true }));
      return () => { if (refreshTimer) window.clearInterval(refreshTimer); };
    }
    const hydrateUser = async () => {
      const cached = await readEncryptedState<typeof data>();
      const cachedData = cached.value || useAppStore.getState().data;
      const userProfile = await getUserProfile();
      const profile = userProfile || cachedData.profile;
      useAppStore.setState({ data: { ...cachedData, profile: { name: user.displayName || profile?.name || user.email?.split('@')[0] || 'Urban Tanker user', email: user.email || profile?.email || '', phone: user.phoneNumber || profile?.phone || '' }, role: userProfile?.role || user.role }, bookingDraft: cachedData.booking });
      subscribeToCloudState(cloudState => hydrateCloudState(cloudState), () => notify('Saved state is unavailable. Continuing with cached data.'))
        .then(stop => { unsubscribeCloud = stop; })
        .catch(() => notify('Unable to sync saved state.'));
      subscribeToOperations(operations => {
        useAppStore.setState(state => ({ data: { ...state.data, orders: operations.orders.length ? operations.orders : state.data.orders, vendors: operations.vendors.length ? operations.vendors : state.data.vendors } }));
      }, () => notify('Shared operations data is unavailable. Continuing with cached data.'))
        .then(stop => { unsubscribeOperations = stop; })
        .catch(() => undefined);
      refreshTimer = window.setInterval(() => {
        readEncryptedState<typeof data>().then(({ expired }) => {
          if (expired) refreshCloudState().then(hydrateCloudState).catch(() => notify('Unable to refresh saved state.'));
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
    <Toast message={toast} onClose={dismissToast} />
    {checkoutOpen && <CheckoutModal />}
  </>;
  return <>
    <AppShell role={data.role} active={active} orderCount={data.orders.length} mobileNav={mobileNav} onNavigate={id => setActive(id as Workspace)} onToggleMobileNav={() => setMobileNav(!mobileNav)} onNotify={notify} onSignOut={signOut}>
      {data.role === 'vendor' && <VendorPortal view={active} />}
      {data.role === 'admin' && <AdminDashboard view={active} />}
    </AppShell>
    <Toast message={toast} onClose={dismissToast} />
    {checkoutOpen && <CheckoutModal />}
  </>;
}
