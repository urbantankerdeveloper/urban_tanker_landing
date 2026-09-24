import { Check, Gauge, History, IndianRupee, Package, Plus, RefreshCcw, Search, ShieldCheck, Truck, UserRound, Users, WalletCards, MapPin, MessageSquare, X } from 'lucide-react';
import { money } from '../../shared/data/demo';
import { useAppStore } from '../../app/store';
import { Button, PageHeader, StatCard, Status } from '../../shared/components/ui';
import { Pagination } from '../../shared/components/Pagination';
import type { AppData } from '../../shared/lib/types';
import { assignAdminOrderToVendor, contentClientId, createAdminAccount, createAdminCoupon, createAdminDriver, createAdminVehicle, loadAdminDashboard, loadAdminDrivers, loadAdminOrderHistory, loadAdminVehicles, loadContent, notifyVendorsOfOrder, updateAdminCouponStatus, updateAdminVendorStatus, type AdminAccountInput, type AdminCustomer, type AdminDashboardData, type OrderHistoryItem } from '../../shared/lib/cloudStore';
import { hydrateContent } from '../../app/store';
import { useState, type FormEvent } from 'react';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../../shared/lib/apiConfig';
import { getAuthToken } from '../../features/auth/auth';
import { DispatchBoard } from './DispatchBoard';
import { AdminFleetApprovalView } from './AdminFleetApprovalView';
import { AdminSupportRequestsView } from './AdminSupportRequestsView';

const buildCsvReport = (headers: string[], rows: Array<Array<string | number | undefined>>) =>
  [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');

type DeliveryNotification = { id: string; orderId: string; vendorName?: string; kind: 'delivered' | 'unaccepted'; service?: string; waitingMinutes?: number };

function AdminViewSkeleton({ title = 'Loading dashboard data...' }: { title?: string }) {
  return <div className="admin-skeleton-page" aria-busy="true" aria-live="polite" aria-label={title}><div className="skeleton-heading admin-skeleton-heading" /><div className="skeleton-copy admin-skeleton-copy" /><div className="admin-skeleton-list">{Array.from({ length: 4 }).map((_, index) => <div className="admin-skeleton-card" key={index}><div className="admin-skeleton-icon" /><div className="admin-skeleton-body"><div className="admin-skeleton-line admin-skeleton-line-lg" /><div className="admin-skeleton-line admin-skeleton-line-md" /><div className="admin-skeleton-line admin-skeleton-line-sm" /></div></div>)}</div></div>;
}

function AdminCustomersSkeleton() {
  return <div className="customer-directory-skeleton" aria-busy="true" aria-live="polite" aria-label="Loading customers"><div className="skeleton-heading customer-skeleton-heading" /><div className="skeleton-copy customer-skeleton-copy" /><section className="data-surface customer-skeleton-surface"><div className="customer-skeleton-toolbar"><div className="skeleton-line customer-skeleton-title" /><div className="skeleton-line customer-skeleton-search" /></div><div className="customer-skeleton-header">{Array.from({ length: 4 }).map((_, index) => <div className="skeleton-line" key={index} />)}</div>{Array.from({ length: 5 }).map((_, index) => <div className="customer-skeleton-row" key={index}>{Array.from({ length: 4 }).map((__, cellIndex) => <div className={`skeleton-line customer-skeleton-cell customer-skeleton-cell-${cellIndex + 1}`} key={cellIndex} />)}</div>)}</section></div>;
}

export function AdminDeliveryNotifications() {
  const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return undefined;
    const socket = io(API_BASE_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => console.info('Admin Socket.IO connected', socket.id));
    socket.on('connect_error', error => console.error('Admin Socket.IO connection failed', error.message));
    socket.on('disconnect', reason => console.info('Admin Socket.IO disconnected', reason));
    const handleDelivered = (event: { orderId: string; vendorName: string }) => {
      const notification = { ...event, id: `${event.orderId}-${Date.now()}`, kind: 'delivered' as const };
      setNotifications(current => [notification, ...current].slice(0, 6));
      window.setTimeout(() => setNotifications(current => current.filter(item => item.id !== notification.id)), 15_000);
    };
    const handleUnaccepted = (event: { orderId: string; service?: string; waitingMinutes: number }) => {
      const notification = { ...event, id: `${event.orderId}-unaccepted-${Date.now()}`, kind: 'unaccepted' as const };
      setNotifications(current => [notification, ...current].slice(0, 6));
      window.setTimeout(() => setNotifications(current => current.filter(item => item.id !== notification.id)), 15_000);
    };
    socket.on('order:delivered', handleDelivered);
    socket.on('order:unaccepted-alert', handleUnaccepted);
    return () => { socket.disconnect(); };
  }, []);
  const dismiss = (id: string) => setNotifications(current => current.filter(item => item.id !== id));
  return <div className="admin-delivery-notifications" aria-live="polite">{notifications.map(notification => <aside className="admin-delivery-notification" key={notification.id} role="status"><button className="admin-delivery-notification-close" type="button" onClick={() => dismiss(notification.id)} aria-label="Close delivery notification"><X size={17} /></button><span className="eyebrow">{notification.kind === 'unaccepted' ? 'Dispatch alert' : 'Delivery update'}</span><h3>{notification.kind === 'unaccepted' ? 'Order needs vendor attention' : 'Order delivered'}</h3><p><b className="mono">{notification.orderId}</b>{notification.kind === 'unaccepted' ? ` has been waiting ${notification.waitingMinutes} minutes without vendor acceptance.` : <> was delivered by <strong>{notification.vendorName}</strong>.</>}</p><Button variant="primary" onClick={() => dismiss(notification.id)}>OK</Button></aside>)}</div>;
}

export function AdminDashboard({ view = 'overview' }: { view?: string }) {
  const { data, adminQuery, setAdminQuery, notify, update } = useAppStore();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [booking, setBooking] = useState({ service: 'Water tanker', capacity: '6 KL', date: new Date().toISOString().slice(0, 10), customer: '', address: '', amount: '0' });
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [ordersPage, setOrdersPage] = useState(1);
  const [notifyingOrderId, setNotifyingOrderId] = useState<string | null>(null);
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<7 | 30 | 90>(7);
  const refreshDashboard = async (showMessage = false) => {
    setRefreshing(true);
    setInitialLoading(true);
    try {
      const result = await loadAdminDashboard();
      setDashboard(result);
      useAppStore.setState(state => ({ data: { ...state.data, orders: result.orders, vendors: result.vendors } }));
      if (showMessage) {
        const content = await loadContent(contentClientId);
        hydrateContent(content);
      }
      if (showMessage) notify('Dashboard and content refreshed.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to refresh dashboard data.');
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  };
  useEffect(() => {
    void refreshDashboard();
  }, [notify]);
  const filteredOrders = data.orders.filter(order => `${order.id} ${order.customer} ${order.address}`.toLowerCase().includes(adminQuery.toLowerCase()));
  const pagedOrders = filteredOrders.slice((ordersPage - 1) * 10, ordersPage * 10);
  const revenue = dashboard?.revenue ?? data.orders.filter(order => order.status === 'Delivered').reduce((total, order) => total + order.amount, 0);
  const delivered = dashboard?.delivered ?? data.orders.filter(order => order.status === 'Delivered').length;
  const chart = Array.from({ length: chartPeriod }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (chartPeriod - 1 - index));
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const dayOrders = data.orders.filter(order => {
      const created = new Date(order.created);
      return !Number.isNaN(created.valueOf()) && created >= day && created < nextDay;
    });
    return {
      label: chartPeriod === 7 ? day.toLocaleDateString('en-IN', { weekday: 'short' }) : day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      water: dayOrders.filter(order => order.service === 'Water tanker').length,
      sewage: dayOrders.filter(order => order.service === 'Sewage pickup').length,
    };
  });
  const liveTankers = data.orders
    .filter(order => !['Delivered', 'Rejected', 'Vendor rejected'].includes(order.status))
    .map(order => ({
      order,
      vendor: data.vendors.find(vendor => vendor.uid === order.assignedVendorUid || vendor.uid === (order as AppData['orders'][number] & { assigned_vendor_uid?: string }).assigned_vendor_uid),
    }))
    .filter(item => item.vendor);
  const [selectedTanker, setSelectedTanker] = useState<{ order: AppData['orders'][number]; vendor: AppData['vendors'][number] } | null>(null);
  const exportOrders = () => {
    const headers = ['Booking', 'Service', 'Capacity', 'Customer', 'Address', 'Vendor', 'Amount', 'Payment', 'Status', 'Created'];
    const rows = filteredOrders.map(order => [order.id, order.service, order.capacity, order.customer, order.address, order.vendor || 'Pending assignment', order.amount, order.payment, order.status, order.created]);
    const triggerDownload = (csv: string) => {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `urban-tanker-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      notify(`${filteredOrders.length} order${filteredOrders.length === 1 ? '' : 's'} exported.`);
    };

    if ('Worker' in window) {
      const worker = new Worker(new URL('../../shared/workers/orderReportWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ csv: string }>) => {
        triggerDownload(event.data.csv);
        worker.terminate();
      };
      worker.onerror = () => {
        triggerDownload(buildCsvReport(headers, rows));
        worker.terminate();
      };
      worker.postMessage({ headers, rows });
      return;
    }

    triggerDownload(buildCsvReport(headers, rows));
  };

  const retryNotification = async (orderId: string) => {
    setNotifyingOrderId(orderId);
    try { await notifyVendorsOfOrder(orderId); notify('Order notification sent to connected vendors.'); } catch (error) { notify(error instanceof Error ? error.message : 'Unable to notify vendors.'); } finally { setNotifyingOrderId(null); }
  };
  const openOrderHistory = async (orderId: string) => {
    setHistoryOrderId(orderId);
    setHistoryLoading(true);
    try { setOrderHistory(await loadAdminOrderHistory(orderId)); } catch (error) { notify(error instanceof Error ? error.message : 'Unable to load order history.'); setHistoryOrderId(null); } finally { setHistoryLoading(false); }
  };
  const assignOrder = async (orderId: string, vendorUid: string) => {
    if (!vendorUid) return;
    try { await assignAdminOrderToVendor(orderId, vendorUid); await refreshDashboard(); notify('Vendor assigned to the order.'); } catch (error) { notify(error instanceof Error ? error.message : 'Unable to assign the vendor.'); }
  };
  const submitAdminBooking = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const order = { id: `ORD-${Date.now().toString().slice(-8)}`, service: booking.service, capacity: booking.capacity, scheduledDate: booking.date, address: booking.address, customer: booking.customer, amount: Number(booking.amount) || 0, status: 'Created' as const, vendor: '', driver: '', eta: 'Pending assignment', payment: 'Due on delivery', created: new Date().toLocaleString('en-IN') };
    update({ orders: [order, ...data.orders] });
    setBookingOpen(false);
    notify('Booking created and sent for vendor assignment.');
  };
  if (initialLoading && !dashboard) return view === 'customers' ? <AdminCustomersSkeleton /> : <AdminViewSkeleton title="Loading admin dashboard" />;
  if (view === 'orders') return <><AdminOrdersView orders={filteredOrders} vendors={dashboard?.vendors || data.vendors} query={adminQuery} setQuery={setAdminQuery} notifyingOrderId={notifyingOrderId} onRetryNotification={retryNotification} onAssign={assignOrder} onCreateBooking={() => setBookingOpen(true)} />{bookingOpen && <AdminBookingModal booking={booking} setBooking={setBooking} onClose={() => setBookingOpen(false)} onSubmit={submitAdminBooking} />}</>;
  const addAccountToDashboard = (account: Awaited<ReturnType<typeof createAdminAccount>>) => {
    if (account.role === 'vendor') {
      const vendor = { uid: account.uid, name: account.name, email: account.email, phone: account.phone, driver: '', zone: '', vehicle: '', capacity: '', status: account.status, available: account.available, rating: '' };
      setDashboard(current => current ? { ...current, vendors: [vendor, ...current.vendors] } : current);
      update({ vendors: [vendor, ...data.vendors] });
    } else {
      const customer: AdminCustomer = { uid: account.uid, name: account.name, email: account.email, phone: account.phone, status: account.status };
      setDashboard(current => current ? { ...current, customers: [customer, ...current.customers] } : current);
    }
  };
  if (view === 'customers') return <AdminCustomersView customers={dashboard?.customers || []} onCreated={addAccountToDashboard} />;
  if (view === 'vendors') return <AdminVendorsView vendors={dashboard?.vendors || data.vendors} onCreated={addAccountToDashboard} onNotify={notify} onUpdated={(uid, status, available) => {
    const updateVendor = (vendor: AppData['vendors'][number]) => vendor.uid === uid ? { ...vendor, status, available } : vendor;
    setDashboard(current => current ? { ...current, vendors: current.vendors.map(updateVendor) } : current);
    update({ vendors: data.vendors.map(updateVendor) });
  }} />;
  if (view === 'fleet') return <div className="admin-fleet-page"><AdminFleetDriversView mode="fleet" vendors={dashboard?.vendors || data.vendors} onNotify={notify} /><AdminFleetApprovalView mode="fleet" onNotify={notify} /></div>;
  if (view === 'drivers') return <div className="admin-fleet-page"><AdminFleetDriversView mode="drivers" vendors={dashboard?.vendors || data.vendors} onNotify={notify} /><AdminFleetApprovalView mode="drivers" onNotify={notify} /></div>;
  if (view === 'coupons') return <AdminCouponsView />;
  if (view === 'track') return <AdminTrackingView orders={data.orders} vendors={data.vendors} />;
  if (view === 'dispatch') return <DispatchBoard orders={data.orders} vendors={data.vendors} onAssign={assignOrder} onNotify={notify} />;
  if (view === 'support') return <AdminSupportRequestsView onNotify={notify} />;
  if (view === 'book') return <AdminBookingView onNotify={notify} />;

  return <>
    <PageHeader eyebrow="Network intelligence · September 2026" title="Welcome back, Admin." copy="Monitor bookings, operations, revenue, and tanker activity across Chennai." action={<div className="heading-actions"><Button variant="quiet" icon={RefreshCcw} onClick={() => void refreshDashboard(true)} disabled={refreshing}>{refreshing ? 'Refreshing...' : 'Refresh'}</Button></div>} />
    <section className="admin-kpis admin-kpis-compact" aria-label="Network performance"><StatCard icon={IndianRupee} label="Revenue this month" value={money(revenue)} detail="MongoDB orders" tone="highlight" /><StatCard icon={Check} label="Delivered" value={delivered} detail="Tenant orders" /><StatCard icon={Truck} label="Live tankers" value={dashboard?.activeDeliveries ?? 0} detail="Active deliveries" /><StatCard icon={Gauge} label="Fleet utilisation" value={`${dashboard?.activeVendors ?? 0}/${dashboard?.vendors.length ?? data.vendors.length}`} detail="Active vendors" /></section>
    <section className="admin-kpis admin-kpis-compact secondary" aria-label="Network totals"><StatCard icon={Package} label="Total orders" value={data.orders.length} detail="MongoDB orders" /><StatCard icon={Users} label="Active vendors" value={dashboard?.activeVendors ?? 0} detail="Active status" /><StatCard icon={UserRound} label="Customers" value={dashboard?.customers.length ?? 0} detail="MongoDB customers" /><StatCard icon={WalletCards} label="Platform commission" value={money(Math.round(revenue * .1))} detail="10% of revenue" /></section>
    <div className="admin-grid"><article className="data-surface chart-surface"><div className="section-heading"><div><span className="eyebrow">Order performance · daily flow</span><h2>Water vs sewage orders</h2></div><div className="segmented" role="group" aria-label="Order period">{([7, 30, 90] as const).map(period => <button className={chartPeriod === period ? 'active' : ''} type="button" key={period} onClick={() => setChartPeriod(period)}>{period} days</button>)}</div></div><div className="chart" aria-label={`Bar chart showing orders for the last ${chartPeriod} days`}>{chart.map((day, index) => <div className="bar-group" key={`${day.label}-${index}`}><div className="bars"><i style={{ height: `${Math.max(day.water * 20, 3)}%` }} /><i style={{ height: `${Math.max(day.sewage * 20, 3)}%` }} /></div><small>{day.label}</small></div>)}</div><div className="chart-legend"><span><i className="water" /> Water tanker</span><span><i className="sewage" /> Sewage tanker</span><b>MongoDB order activity</b></div></article><article className="data-surface"><div className="section-heading"><div><span className="eyebrow">Fleet radar · live</span><h2>Tanker movement</h2></div><Status>{liveTankers.length ? 'Live' : 'Idle'}</Status></div><div className="radar" aria-label={`${liveTankers.length} active deliveries`}>{liveTankers.slice(0, 6).map(({ order, vendor }, index) => <button className={`radar-tanker tanker-${(index % 6) + 1}`} key={order.id} title={`View ${order.id} delivery`} aria-label={`View ${order.id} delivery`} onClick={() => setSelectedTanker({ order, vendor: vendor! })}><Truck size={13} /></button>)}<span className="radar-sweep" /><span className="radar-circle c1" /><span className="radar-circle c2" /><b>UT</b></div><div className="radar-summary"><strong>{liveTankers.length}</strong><span>live deliveries in movement</span></div></article></div>
    <article className="data-surface table-surface"><div className="table-head"><div><span className="eyebrow">Orders</span><h2>Booking control</h2></div><div className="table-tools"><Button variant="quiet" icon={RefreshCcw} onClick={exportOrders}>Export report</Button><label className="input-icon" htmlFor="order-search"><Search size={15} /><input id="order-search" placeholder="Search order or customer" value={adminQuery} onChange={event => { setAdminQuery(event.target.value); setOrdersPage(1); }} /></label></div></div><div className="table-scroll"><table><caption className="sr-only">Urban Tanker booking control</caption><thead><tr><th scope="col">Booking</th><th scope="col">Service</th><th scope="col">Customer</th><th scope="col">Vendor</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>{pagedOrders.map(order => <tr key={order.id}><td><button className="order-history-link mono" type="button" onClick={() => void openOrderHistory(order.id)}>{order.id}</button><small>{order.created}</small></td><td>{order.service}<small>{order.capacity}</small></td><td>{order.customer}<small>{order.address}</small></td><td>{order.vendor || 'Pending assignment'}<small>{order.driver || '—'}</small></td><td><b>{money(order.amount)}</b><small>{order.payment}</small></td><td><Status>{order.status}</Status></td><td>{['Created', 'Pending acceptance', 'Rejected', 'Vendor assigned'].includes(order.status) && !order.vendor ? <Button variant="quiet" icon={RefreshCcw} onClick={() => void retryNotification(order.id)} disabled={notifyingOrderId === order.id}>{notifyingOrderId === order.id ? 'Sending...' : order.status === 'Rejected' ? 'Re-initiate vendors' : 'Notify vendors'}</Button> : '—'}</td></tr>)}</tbody></table></div><Pagination page={ordersPage} pageSize={10} total={filteredOrders.length} onPageChange={setOrdersPage} /></article>
    {selectedTanker && <TankerDeliveryModal order={selectedTanker.order} vendor={selectedTanker.vendor} onClose={() => setSelectedTanker(null)} />}
    {historyOrderId && <AdminOrderHistoryModal orderId={historyOrderId} history={orderHistory} loading={historyLoading} onClose={() => setHistoryOrderId(null)} />}
  </>;
}

function AdminCouponsView() {
  const coupons = useAppStore(state => state.content.coupons);
  const notify = useAppStore(state => state.notify);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', label: '', discount: '', service: '', firstBooking: false });
  const visibleCoupons = coupons.slice((page - 1) * 10, page * 10);
  const toggleCoupon = async (coupon: typeof coupons[number]) => {
    setBusyCode(coupon.code);
    try { await updateAdminCouponStatus(coupon.code, coupon.active === false); useAppStore.setState(state => ({ content: { ...state.content, coupons: state.content.coupons.map(item => item.code === coupon.code ? { ...item, active: coupon.active === false } : item) } })); notify(`Coupon ${coupon.active === false ? 'enabled' : 'disabled'}.`); } catch (error) { notify(error instanceof Error ? error.message : 'Unable to update coupon.'); } finally { setBusyCode(null); }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try { const coupon = await createAdminCoupon({ code: form.code, label: form.label, discount: Number(form.discount), service: form.service || undefined, firstBooking: form.firstBooking }); useAppStore.setState(state => ({ content: { ...state.content, coupons: [coupon, ...state.content.coupons] } })); setForm({ code: '', label: '', discount: '', service: '', firstBooking: false }); setOpen(false); notify('Coupon created and enabled.'); } catch (error) { notify(error instanceof Error ? error.message : 'Unable to create coupon.'); }
  };
  return <>
    <PageHeader eyebrow="Admin workspace · Coupons" title="Coupon controls." copy="Review the offers currently available to customers." action={<Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>Add coupon</Button>} />
    <article className="data-surface table-surface"><div className="table-head"><div><span className="eyebrow">Customer offers</span><h2>{coupons.length} coupons</h2></div></div><div className="table-scroll"><table><thead><tr><th>Code</th><th>Offer</th><th>Service</th><th>Discount</th><th>Status</th></tr></thead><tbody>{visibleCoupons.map(coupon => <tr key={coupon.code}><td><b className="mono">{coupon.code}</b></td><td>{coupon.label}<small>{coupon.firstBooking ? 'First booking only' : 'All eligible bookings'}</small></td><td>{coupon.service || 'All services'}</td><td><b>{coupon.discount}{coupon.discount < 100 ? '%' : ' off'}</b></td><td><button className="coupon-status-control" type="button" onClick={() => void toggleCoupon(coupon)} disabled={busyCode === coupon.code} aria-label={`${coupon.active === false ? 'Enable' : 'Disable'} coupon ${coupon.code}`}><Status>{busyCode === coupon.code ? 'Updating...' : coupon.active === false ? 'Inactive' : 'Active'}</Status></button></td></tr>)}</tbody></table>{!coupons.length && <div className="empty-state"><h3>No coupons configured</h3><p>Create a coupon to make an offer available to customers.</p></div>}</div><Pagination page={page} pageSize={10} total={coupons.length} onPageChange={setPage} /></article>
    {open && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="coupon-dialog-title"><button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close coupon form">×</button><span className="eyebrow">Customer offer</span><h2 id="coupon-dialog-title">Add a new coupon.</h2><form className="auth-form" onSubmit={submit}><label>Coupon code<input value={form.code} onChange={event => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="WATER200" pattern="[A-Z0-9_-]{3,30}" required /></label><label>Offer label<input value={form.label} onChange={event => setForm({ ...form, label: event.target.value })} placeholder="₹200 off water bookings" required /></label><div className="field-row"><label>Discount<input type="number" min="1" step="1" value={form.discount} onChange={event => setForm({ ...form, discount: event.target.value })} required /></label><label>Service<select value={form.service} onChange={event => setForm({ ...form, service: event.target.value })}><option value="">All services</option><option>Water tanker</option><option>Sewage pickup</option></select></label></div><label className="remember-option"><input type="checkbox" checked={form.firstBooking} onChange={event => setForm({ ...form, firstBooking: event.target.checked })} /> First booking only</label><div className="heading-actions"><Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit">Create coupon</Button></div></form></section></div>}
  </>;
}

function TankerDeliveryModal({ order, vendor, onClose }: { order: AppData['orders'][number]; vendor: AppData['vendors'][number]; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal tanker-delivery-modal" role="dialog" aria-modal="true" aria-labelledby="tanker-delivery-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Close tanker details">X</button><span className="eyebrow">Live tanker · {vendor.status}</span><h2 id="tanker-delivery-title">{vendor.name}</h2>{order ? <div className="tanker-delivery-details"><div><span>Order</span><b className="mono">{order.id}</b></div><div><span>Customer</span><b>{order.customer}</b></div><div><span>Service</span><b>{order.service} · {order.capacity}</b></div><div><span>Delivery address</span><b>{order.address}</b></div><div><span>Status</span><Status>{order.status}</Status></div><div><span>ETA</span><b>{order.eta || 'Not updated'}</b></div><section className="tanker-detail-group"><h3>Vehicle details</h3><div><span>Registration</span><b>{order.vehicleRegistrationNumber || vendor.vehicle || 'Not assigned'}</b></div><div><span>Type</span><b>{order.vehicleType || 'Tanker'}</b></div><div><span>Capacity</span><b>{order.vehicleCapacity || vendor.capacity || 'Not set'}</b></div></section><section className="tanker-detail-group"><h3>Driver details</h3><div><span>Name</span><b>{order.driver || vendor.driver || 'Not assigned'}</b></div><div><span>Phone</span><b>{order.driverPhone || vendor.phone || 'No phone available'}</b></div><div><span>Status</span><Status>{order.driverActive === false ? 'Inactive' : 'Active'}</Status></div></section></div> : <div className="empty-state"><Truck size={28} /><h3>Available for dispatch</h3><p>This active tanker has no assigned delivery at the moment.</p></div>}<div className="tanker-delivery-actions"><Button variant="quiet" onClick={onClose}>Close</Button></div></section></div>;
}

function AdminCustomersView({ customers, onCreated }: { customers: AdminCustomer[]; onCreated: (account: Awaited<ReturnType<typeof createAdminAccount>>) => void }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [page, setPage] = useState(1);
  const visibleCustomers = customers.slice((page - 1) * 10, page * 10);
  return <>
    <PageHeader eyebrow="Admin workspace · Customers" title="Customer directory." copy="Create and manage customer accounts stored in MongoDB." action={<Button variant="primary" icon={Plus} onClick={() => setAccountOpen(true)}>Add customer</Button>} />
    <article className="data-surface table-surface"><div className="table-head"><div><span className="eyebrow">Customer accounts</span><h2>{customers.length} customers</h2></div><label className="input-icon" htmlFor="customer-search"><Search size={15} /><input id="customer-search" placeholder="Search customer" /></label></div><div className="table-scroll"><table><thead><tr><th>Name</th><th>Contact</th><th>Status</th><th>Created</th></tr></thead><tbody>{visibleCustomers.map(customer => <tr key={customer.uid}><td><b>{customer.name}</b><small className="mono">{customer.uid}</small></td><td>{customer.email}<small>{customer.phone || 'No phone'}</small></td><td><Status>{customer.status}</Status></td><td>{customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-IN') : 'Not available'}</td></tr>)}</tbody></table>{!customers.length && <div className="empty-state"><Users size={28} /><h3>No customers yet</h3><p>Create a customer account to get started.</p></div>}</div><Pagination page={page} pageSize={10} total={customers.length} onPageChange={setPage} /></article>
    {accountOpen && <AdminAccountModal role="customer" onClose={() => setAccountOpen(false)} onCreated={account => { onCreated(account); setAccountOpen(false); }} />}
  </>;
}

function AdminVendorsView({ vendors, onCreated, onNotify, onUpdated }: { vendors: AppData['vendors']; onCreated: (account: Awaited<ReturnType<typeof createAdminAccount>>) => void; onNotify: (message: string) => void; onUpdated: (uid: string, status: string, available: boolean) => void }) {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [page, setPage] = useState(1);
  const filteredVendors = vendors.filter(vendor => filter === 'all' || (filter === 'active' ? vendor.status === 'active' || vendor.available === true : vendor.status !== 'active' && vendor.available !== true));
  const visibleVendors = filteredVendors.slice((page - 1) * 10, page * 10);
  const activeVendorCount = vendors.filter(vendor => vendor.status === 'active' || vendor.available === true).length;
  const inactiveVendorCount = vendors.length - activeVendorCount;
  const toggleStatus = async (vendor: AppData['vendors'][number]) => {
    if (!vendor.uid || busyUid) return;
    const active = !(vendor.status === 'active' || vendor.available === true);
    setBusyUid(vendor.uid);
    try {
      const result = await updateAdminVendorStatus(vendor.uid, active);
      onUpdated(result.uid, result.status, result.available);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to update vendor status.');
    } finally {
      setBusyUid(null);
    }
  };
  return <>
    <PageHeader eyebrow="Admin workspace · Vendors" title="Vendor directory." copy="Review every tenant vendor and their current availability from MongoDB." action={<Button variant="primary" icon={Plus} onClick={() => setAccountOpen(true)}>Add vendor</Button>} />
    <section className="stats-grid">
      <StatCard icon={Users} label="All vendors" value={vendors.length} detail="MongoDB records" />
      <StatCard icon={Check} label="Active" value={vendors.filter(vendor => vendor.status === 'active' || vendor.available === true).length} detail="Available for bookings" tone="highlight" />
      <StatCard icon={ShieldCheck} label="Inactive" value={vendors.filter(vendor => vendor.status !== 'active' && vendor.available !== true).length} detail="Not accepting bookings" />
    </section>
    <article className="data-surface table-surface">
      <div className="table-head"><div><span className="eyebrow">Vendor accounts</span><h2>{filteredVendors.length} visible vendors</h2></div><div className="status-filter-tools"><div className="status-filter-stats" aria-label={`${activeVendorCount} active vendors and ${inactiveVendorCount} inactive vendors`}><span><i className="status-stat-dot active" />{activeVendorCount} active</span><span><i className="status-stat-dot inactive" />{inactiveVendorCount} inactive</span></div><div className="segmented" role="group" aria-label="Vendor status filter">{(['all', 'active', 'inactive'] as const).map(option => <button className={filter === option ? 'active' : ''} type="button" key={option} onClick={() => setFilter(option)}>{option[0].toUpperCase() + option.slice(1)}</button>)}</div></div></div>
      <div className="table-scroll"><table><caption className="sr-only">MongoDB vendor directory</caption><thead><tr><th scope="col">Vendor</th><th scope="col">Contact</th><th scope="col">Availability</th><th scope="col">Service details</th><th scope="col">Location</th><th scope="col">Updated</th></tr></thead><tbody>{visibleVendors.map(vendor => { const active = vendor.status === 'active' || vendor.available === true; const busy = busyUid === vendor.uid; return <tr key={vendor.uid || vendor.email || vendor.name}><td><b>{vendor.name || 'Unnamed vendor'}</b><small className="mono">{vendor.uid || 'No UID'}</small></td><td>{vendor.email || 'No email'}<small>{vendor.phone || 'No phone'}</small></td><td><button className={`vendor-availability-toggle ${active ? 'active' : 'inactive'}`} type="button" aria-pressed={active} aria-label={`${active ? 'Set' : 'Approve'} ${vendor.name || 'vendor'} ${active ? 'inactive' : 'vendor'}`} onClick={() => void toggleStatus(vendor)} disabled={busy || !vendor.uid}><Status>{busy ? 'Updating' : active ? 'Active' : 'Approve'}</Status></button><small>{active ? 'Accepting bookings' : 'Awaiting approval'}</small></td><td>{vendor.vehicle || 'No vehicle'}<small>{vendor.capacity || 'Capacity not set'} · Rating {vendor.rating || '—'}</small></td><td>{vendor.zone || 'Not set'}<small>{typeof vendor.latitude === 'number' && typeof vendor.longitude === 'number' ? `${vendor.latitude.toFixed(4)}, ${vendor.longitude.toFixed(4)}` : 'Location not shared'}</small></td><td>{vendor.updated_at ? new Date(vendor.updated_at).toLocaleString('en-IN') : 'Not available'}</td></tr>; })}</tbody></table>{!filteredVendors.length && <div className="empty-state"><Users size={28} /><h3>No vendors found</h3><p>No vendor records match this status.</p></div>}</div><Pagination page={page} pageSize={10} total={filteredVendors.length} onPageChange={setPage} />
    </article>
    {accountOpen && <AdminAccountModal role="vendor" onClose={() => setAccountOpen(false)} onCreated={account => { onCreated(account); setAccountOpen(false); }} />}
  </>;
}

function AdminFleetDriversView({ mode, vendors, onNotify }: { mode: 'fleet' | 'drivers'; vendors: AppData['vendors']; onNotify: (message: string) => void }) {
  const [vendorUid, setVendorUid] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Array<{ id: string; registrationNumber: string; vehicleType: string; capacity: string; active: boolean; approvalStatus: string; vendorName: string; vendorUid: string }>>([]);
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string; phone: string; active: boolean; approvalStatus: string; vendorName: string; vendorUid: string }>>([]);
  const [vehicleForm, setVehicleForm] = useState({ registrationNumber: '', vehicleType: 'Water tanker', capacity: '', imageUrl: '' });
  const [driverForm, setDriverForm] = useState({ name: '', phone: '', address: '', addressProof: '' });

  const refreshAll = async () => {
    setLoading(true);
    try {
      if (mode === 'fleet') {
        const records = await loadAdminVehicles();
        setVehicles(records.map(item => ({
          id: item.id,
          registrationNumber: item.registrationNumber,
          vehicleType: item.vehicleType,
          capacity: item.capacity,
          active: item.active,
          approvalStatus: item.approvalStatus,
          vendorUid: item.vendorUid,
          vendorName: item.vendorName,
        })));
        return;
      }

      const records = await loadAdminDrivers();
      setDrivers(records.map(item => ({
        id: item.id,
        name: item.name,
        phone: item.phone,
        active: item.active,
          approvalStatus: item.approvalStatus,
        vendorUid: item.vendorUid,
        vendorName: item.vendorName,
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll().catch(error => onNotify(error instanceof Error ? error.message : 'Unable to load vendor records.'));
  }, [mode, onNotify]);

  if (loading) return <AdminViewSkeleton title={mode === 'fleet' ? 'Loading fleet records' : 'Loading driver records'} />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!vendorUid) { onNotify('Select the vendor who owns this record.'); return; }
    setBusy(true);
    try {
      if (mode === 'fleet') {
        await createAdminVehicle(vendorUid, vehicleForm);
        await refreshAll();
        setVehicleForm({ registrationNumber: '', vehicleType: 'Water tanker', capacity: '', imageUrl: '' });
        onNotify('Vehicle created for the selected vendor.');
      } else {
        await createAdminDriver(vendorUid, driverForm);
        await refreshAll();
        setDriverForm({ name: '', phone: '', address: '', addressProof: '' });
        onNotify('Driver created for the selected vendor.');
      }
      setOpen(false);
    } catch (error) { onNotify(error instanceof Error ? error.message : `Unable to create ${mode === 'fleet' ? 'vehicle' : 'driver'}.`); }
    finally { setBusy(false); }
  };
  return <><PageHeader eyebrow={`Admin workspace · ${mode === 'fleet' ? 'Fleet' : 'Drivers'}`} title={mode === 'fleet' ? 'Manage vendor vehicles.' : 'Manage vendor drivers.'} copy="Review the full fleet and driver roster across every vendor." action={<Button variant="primary" icon={mode === 'fleet' ? Truck : Users} onClick={() => setOpen(true)}>{mode === 'fleet' ? 'Add vehicle' : 'Add driver'}</Button>} /><div className="order-list">{mode === 'fleet' ? vehicles.length ? vehicles.map(vehicle => <article className="order-row" key={vehicle.id}><div className="order-service-icon"><Truck size={19} /></div><div className="order-main"><div><b>{vehicle.registrationNumber}</b><Status>{vehicle.active ? 'Active' : 'Inactive'}</Status></div><span>{vehicle.vehicleType} · {vehicle.capacity || 'Capacity not set'}</span><small>{vehicle.vendorName}</small></div></article>) : <div className="empty-state"><Truck size={28} /><h3>No vehicles yet</h3><p>No vendor vehicles are registered in this tenant.</p></div> : drivers.length ? drivers.map(driver => <article className="order-row" key={driver.id}><div className="order-service-icon"><Users size={19} /></div><div className="order-main"><div><b>{driver.name}</b><Status>{driver.active ? 'Active' : 'Inactive'}</Status></div><span>{driver.phone || 'No phone number'}</span><small>{driver.vendorName}</small></div></article>) : <div className="empty-state"><Users size={28} /><h3>No drivers yet</h3><p>No vendor drivers are registered in this tenant.</p></div>}</div>{open && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="admin-fleet-dialog-title"><button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close form">×</button><span className="eyebrow">{mode === 'fleet' ? 'Fleet management' : 'Driver management'}</span><h2 id="admin-fleet-dialog-title">Add {mode === 'fleet' ? 'vehicle' : 'driver'}</h2><p className="modal-copy">Select the vendor owner before creating this record.</p><form className="auth-form" onSubmit={submit} noValidate><label>Owning vendor<select value={vendorUid} onChange={event => setVendorUid(event.target.value)} required><option value="">Select a vendor</option>{vendors.map(vendor => <option key={vendor.uid} value={vendor.uid}>{vendor.name} · {vendor.email}</option>)}</select></label>{mode === 'fleet' ? <><label>Registration number<input value={vehicleForm.registrationNumber} onChange={event => setVehicleForm({ ...vehicleForm, registrationNumber: event.target.value.toUpperCase() })} required /></label><label>Vehicle type<select value={vehicleForm.vehicleType} onChange={event => setVehicleForm({ ...vehicleForm, vehicleType: event.target.value })}><option>Water tanker</option><option>Sewage pickup</option></select></label><label>Capacity<input value={vehicleForm.capacity} onChange={event => setVehicleForm({ ...vehicleForm, capacity: event.target.value })} required /></label></> : <><label>Driver name<input value={driverForm.name} onChange={event => setDriverForm({ ...driverForm, name: event.target.value })} required /></label><label>Phone number<input value={driverForm.phone} onChange={event => setDriverForm({ ...driverForm, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} inputMode="numeric" required /></label><label>Driver address<textarea value={driverForm.address} onChange={event => setDriverForm({ ...driverForm, address: event.target.value })} minLength={5} required /></label></>}<div className="heading-actions"><Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit" disabled={busy || !vendorUid}>{busy ? 'Creating...' : `Create ${mode === 'fleet' ? 'vehicle' : 'driver'}`}</Button></div></form></section></div>}</>;
}

function AdminAccountModal({ role, onClose, onCreated }: { role: 'customer' | 'vendor'; onClose: () => void; onCreated: (account: Awaited<ReturnType<typeof createAdminAccount>>) => void }) {
  const [form, setForm] = useState<AdminAccountInput>({ role, displayName: '', email: '', phoneNumber: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const phone = form.phoneNumber.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(phone)) { setError('Enter a valid 10-digit Indian mobile number.'); return; }
    setBusy(true);
    setError('');
    try { onCreated(await createAdminAccount({ ...form, phoneNumber: phone })); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create account.'); } finally { setBusy(false); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal admin-account-modal" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Close account form">X</button><span className="eyebrow">Account registration</span><h2 id="account-dialog-title">Register {role}.</h2><p className="modal-copy">Create a secure {role} account with the same details used during registration.</p><p className="selected-role"><span>Registering as</span><strong>{role === 'vendor' ? 'Vendor' : 'Customer'}</strong></p><div className="auth-divider"><span>Account details</span></div><form className="auth-form" onSubmit={submit} noValidate><label>Full name<input value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} autoComplete="name" placeholder={role === 'vendor' ? 'Organisation or vendor name' : 'Customer full name'} required /></label><label>Mobile number<input value={form.phoneNumber} onChange={event => setForm({ ...form, phoneNumber: event.target.value.replace(/\D/g, '').slice(0, 10) })} type="tel" inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile number" pattern="[6-9][0-9]{9}" required /><small>Use a valid Indian mobile number.</small></label><label>Email address<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} autoComplete="email" placeholder="name@example.com" required /></label><label>Password<input type="password" minLength={8} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} autoComplete="new-password" placeholder="At least 8 characters" required /><small>Password is stored securely on the server.</small></label>{error && <p className="form-error">{error}</p>}<div className="heading-actions"><Button variant="quiet" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" disabled={busy}>{busy ? 'Creating...' : `Create ${role}`}</Button></div></form></section></div>;
}

function AdminBookingModal({ booking, setBooking, onClose, onSubmit }: { booking: { service: string; capacity: string; date: string; customer: string; address: string; amount: string }; setBooking: (value: { service: string; capacity: string; date: string; customer: string; address: string; amount: string }) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="admin-booking-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Close booking form">×</button><span className="eyebrow">Admin booking control</span><h2 id="admin-booking-title">Create a test order.</h2><p className="modal-copy">Create a booking with a pending vendor assignment.</p><form className="auth-form" onSubmit={onSubmit}><label>Service<select value={booking.service} onChange={event => setBooking({ ...booking, service: event.target.value })}><option>Water tanker</option><option>Sewage pickup</option></select></label><label>Capacity<input value={booking.capacity} onChange={event => setBooking({ ...booking, capacity: event.target.value })} required /></label><label>Delivery date<input type="date" min={new Date().toISOString().slice(0, 10)} value={booking.date} onChange={event => setBooking({ ...booking, date: event.target.value })} required /></label><label>Customer name<input value={booking.customer} onChange={event => setBooking({ ...booking, customer: event.target.value })} required /></label><label>Delivery address<input value={booking.address} onChange={event => setBooking({ ...booking, address: event.target.value })} required /></label><label>Amount<input type="number" min="0" value={booking.amount} onChange={event => setBooking({ ...booking, amount: event.target.value })} required /></label><div className="heading-actions"><Button variant="quiet" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit">Create booking</Button></div></form></section></div>;
}

function AdminOrdersView({ orders, vendors, query, setQuery, notifyingOrderId, onRetryNotification, onAssign, onCreateBooking }: { orders: AppData['orders']; vendors: AppData['vendors']; query: string; setQuery: (value: string) => void; notifyingOrderId: string | null; onRetryNotification: (orderId: string) => Promise<void>; onAssign: (orderId: string, vendorUid: string) => Promise<void>; onCreateBooking: () => void }) {
  const [page, setPage] = useState(1);
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const visibleOrders = orders.slice((page - 1) * 10, page * 10);
  const openHistory = async (orderId: string) => {
    setHistoryOrderId(orderId);
    setHistoryLoading(true);
    try { setHistory(await loadAdminOrderHistory(orderId)); } catch { setHistory([]); } finally { setHistoryLoading(false); }
  };
  useEffect(() => {
    const table = document.querySelector<HTMLTableElement>('.admin-orders-table');
    if (!table) return undefined;
    const openFromBookingCell = (event: Event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('td[data-label="Booking"] b')) return;
      const orderId = target.closest('td[data-label="Booking"]')?.querySelector('b')?.textContent?.trim();
      if (orderId) void openHistory(orderId);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') openFromBookingCell(event);
    };
    table.addEventListener('click', openFromBookingCell);
    table.addEventListener('keydown', handleKeyDown);
    table.querySelectorAll('td[data-label="Booking"] b').forEach(element => { element.setAttribute('role', 'button'); element.setAttribute('tabindex', '0'); element.setAttribute('aria-label', `View history for ${element.textContent}`); });
    return () => { table.removeEventListener('click', openFromBookingCell); table.removeEventListener('keydown', handleKeyDown); };
  }, [openHistory, visibleOrders]);
  return <>
    <PageHeader eyebrow="Admin workspace · Orders" title="Booking control." copy="Search and review all tenant orders and their current lifecycle status." action={<Button variant="primary" icon={Plus} onClick={onCreateBooking}>Create booking</Button>} />
    <article className="data-surface table-surface admin-orders-surface"><div className="table-head"><div><span className="eyebrow">Tenant orders</span><h2>{orders.length} visible orders</h2></div><label className="input-icon" htmlFor="admin-orders-search"><Search size={15} /><input id="admin-orders-search" placeholder="Search order or customer" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label></div><div className="table-scroll"><table className="admin-orders-table"><thead><tr><th>Booking</th><th>Service</th><th>Customer</th><th>Vendor</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleOrders.map(order => <tr key={order.id}><td data-label="Booking"><b className="mono">{order.id}</b><small>{order.created}</small></td><td data-label="Service">{order.service}<small>{order.capacity}</small></td><td data-label="Customer">{order.customer}<small>{order.address}</small></td><td data-label="Vendor">{order.vendor || 'Pending assignment'}<small>{order.driver || '—'}</small></td><td data-label="Amount"><b>{money(order.amount)}</b><small>{order.payment}</small></td><td data-label="Status"><Status>{order.status}</Status></td><td data-label="Actions"><div className="table-actions">{['Created', 'Pending acceptance', 'Rejected', 'Vendor assigned'].includes(order.status) && !order.vendor ? <><Button variant="quiet" icon={RefreshCcw} onClick={() => void onRetryNotification(order.id)} disabled={notifyingOrderId === order.id}>{notifyingOrderId === order.id ? 'Sending...' : order.status === 'Rejected' ? 'Re-initiate vendors' : 'Notify vendors'}</Button><select aria-label={`Assign vendor to ${order.id}`} defaultValue="" onChange={event => void onAssign(order.id, event.target.value)}><option value="">Assign vendor</option>{vendors.filter(vendor => vendor.status === 'active' || vendor.available === true).map(vendor => <option key={vendor.uid} value={vendor.uid}>{vendor.name}</option>)}</select></> : null}<Button variant="quiet" icon={History} onClick={() => void openHistory(order.id)}>History</Button></div></td></tr>)}</tbody></table></div><Pagination page={page} pageSize={10} total={orders.length} onPageChange={setPage} /></article>
    {historyOrderId && <AdminOrderHistoryModal orderId={historyOrderId} history={history} loading={historyLoading} onClose={() => setHistoryOrderId(null)} />}
  </>;
}

function AdminOrderHistoryModal({ orderId, history, loading, onClose }: { orderId: string; history: OrderHistoryItem[]; loading: boolean; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal order-history-modal" role="dialog" aria-modal="true" aria-labelledby="order-history-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Close order history">×</button><span className="eyebrow">Order timeline</span><h2 id="order-history-title">{orderId}</h2>{loading ? <p className="modal-copy">Loading history...</p> : history.length ? <ol className="order-history-timeline">{history.map((event, index) => <li key={`${event.timestamp}-${index}`}><span className="order-history-marker" /><div><b>{event.status}</b><time>{new Date(event.timestamp).toLocaleString('en-IN')}</time>{event.vendor_uid && <small>Vendor: {event.vendor_uid}</small>}{event.rejection_reason && <small>Reason: {event.rejection_reason}</small>}</div></li>)}</ol> : <p className="modal-copy">No lifecycle history has been recorded yet.</p>}<div className="heading-actions"><Button variant="primary" onClick={onClose}>Close</Button></div></section></div>;
}

function AdminTrackingView({ orders, vendors }: { orders: AppData['orders']; vendors: AppData['vendors'] }) {
  const activeOrders = orders.filter(order => order.status !== 'Delivered' && order.status !== 'Rejected');
  return <>
    <PageHeader eyebrow="Admin workspace · Live tracking" title="Network movement." copy="Monitor active deliveries and vendor locations across the tenant." />
    <section className="stats-grid"><StatCard icon={Truck} label="Active deliveries" value={activeOrders.length} detail="Current routes" /><StatCard icon={Users} label="Vendor records" value={vendors.length} detail="Tenant vendors" /><StatCard icon={MapPin} label="Shared locations" value={activeOrders.filter(order => typeof order.vendorLatitude === 'number').length} detail="Latest coordinates" /></section>
    <div className="order-list">{activeOrders.length ? activeOrders.map(order => <article className="order-row" key={order.id}><div className="order-service-icon"><Truck size={19} /></div><div className="order-main"><div><b>{order.id}</b><Status>{order.status}</Status></div><span>{order.customer} · {order.address}</span><small>{order.vendor || 'Waiting for vendor assignment'} · {order.eta}</small></div></article>) : <div className="empty-state"><MapPin size={28} /><h3>No active routes</h3><p>Live vendor routes will appear here when orders are accepted.</p></div>}</div>
  </>;
}

function AdminBookingView({ onNotify }: { onNotify: (message: string) => void }) {
  return <><PageHeader eyebrow="Admin workspace · Booking control" title="Create an operations booking." copy="Use this workspace to coordinate a booking on behalf of a customer or dispatch team." action={<Button variant="primary" icon={Plus} onClick={() => onNotify('Admin booking form opened')}>Create booking</Button>} /><section className="data-surface support-surface"><Package size={24} /><h2>Booking intake</h2><p>Bookings created here will be stored under the active tenant and routed to eligible vendors.</p></section></>;
}
