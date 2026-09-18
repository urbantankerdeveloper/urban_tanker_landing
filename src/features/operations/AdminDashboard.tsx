import { Check, Gauge, IndianRupee, Package, Plus, RefreshCcw, Search, ShieldCheck, Truck, UserRound, Users, WalletCards, MapPin, MessageSquare } from 'lucide-react';
import { money } from '../../shared/data/demo';
import { useAppStore } from '../../app/store';
import { Button, PageHeader, StatCard, Status } from '../../shared/components/ui';
import type { AppData } from '../../shared/lib/types';
import { createAdminAccount, loadAdminDashboard, updateAdminVendorStatus, type AdminAccountInput, type AdminCustomer, type AdminDashboardData } from '../../shared/lib/cloudStore';
import { useState, type FormEvent } from 'react';
import { useEffect } from 'react';

export function AdminDashboard({ view = 'overview' }: { view?: string }) {
  const { data, adminQuery, setAdminQuery, notify, update } = useAppStore();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [booking, setBooking] = useState({ service: 'Water tanker', capacity: '6 KL', customer: '', address: '', amount: '0' });
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  useEffect(() => {
    void loadAdminDashboard().then(result => {
      setDashboard(result);
      useAppStore.setState(state => ({ data: { ...state.data, orders: result.orders, vendors: result.vendors } }));
    }).catch(error => notify(error instanceof Error ? error.message : 'Unable to load admin dashboard data.'));
  }, [notify]);
  const filteredOrders = data.orders.filter(order => `${order.id} ${order.customer} ${order.address}`.toLowerCase().includes(adminQuery.toLowerCase()));
  const revenue = dashboard?.revenue ?? data.orders.reduce((total, order) => total + order.amount, 0);
  const delivered = dashboard?.delivered ?? data.orders.filter(order => order.status === 'Delivered').length;
  const chart = dashboard?.chart || [];
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
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `urban-tanker-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify(`${filteredOrders.length} order${filteredOrders.length === 1 ? '' : 's'} exported.`);
  };

  if (view === 'orders') return <AdminOrdersView orders={filteredOrders} query={adminQuery} setQuery={setAdminQuery} />;
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
  if (view === 'vendors') return <AdminVendorsView vendors={dashboard?.vendors || data.vendors} onCreated={addAccountToDashboard} onUpdated={(uid, status, available) => {
    const updateVendor = (vendor: AppData['vendors'][number]) => vendor.uid === uid ? { ...vendor, status, available } : vendor;
    setDashboard(current => current ? { ...current, vendors: current.vendors.map(updateVendor) } : current);
    update({ vendors: data.vendors.map(updateVendor) });
  }} />;
  if (view === 'coupons') return <AdminCouponsView />;
  if (view === 'track') return <AdminTrackingView orders={data.orders} vendors={data.vendors} />;
  if (view === 'support') return <AdminSupportView onNotify={notify} />;
  if (view === 'book') return <AdminBookingView onNotify={notify} />;

  return <>
    <PageHeader eyebrow="Network intelligence · September 2026" title="Welcome back, Admin." copy="Monitor bookings, operations, revenue, and tanker activity across Chennai." action={<div className="heading-actions"><Button variant="quiet" icon={RefreshCcw} onClick={() => notify('Operations dashboard refreshed')}>Refresh</Button><Button variant="primary" icon={Plus} onClick={() => setBookingOpen(true)}>Create test order</Button></div>} />
    <section className="admin-kpis admin-kpis-compact" aria-label="Network performance"><StatCard icon={IndianRupee} label="Revenue this month" value={money(revenue)} detail="MongoDB orders" tone="highlight" /><StatCard icon={Check} label="Delivered" value={delivered} detail="Tenant orders" /><StatCard icon={Truck} label="Live tankers" value={dashboard?.activeDeliveries ?? 0} detail="Active deliveries" /><StatCard icon={Gauge} label="Fleet utilisation" value={`${dashboard?.activeVendors ?? 0}/${dashboard?.vendors.length ?? data.vendors.length}`} detail="Active vendors" /></section>
    <section className="admin-kpis admin-kpis-compact secondary" aria-label="Network totals"><StatCard icon={Package} label="Total orders" value={data.orders.length} detail="MongoDB orders" /><StatCard icon={Users} label="Active vendors" value={dashboard?.activeVendors ?? 0} detail="Active status" /><StatCard icon={UserRound} label="Customers" value={dashboard?.customers.length ?? 0} detail="MongoDB customers" /><StatCard icon={WalletCards} label="Platform commission" value={money(Math.round(revenue * .1))} detail="10% of revenue" /></section>
    <div className="admin-grid"><article className="data-surface chart-surface"><div className="section-heading"><div><span className="eyebrow">Order performance · daily flow</span><h2>Water vs sewage orders</h2></div><div className="segmented" role="group" aria-label="Order period"><button className="active" type="button">7 days</button><button type="button">30 days</button><button type="button">90 days</button></div></div><div className="chart" aria-label="Bar chart showing weekly orders">{chart.map((day, index) => <div className="bar-group" key={`${day.label}-${index}`}><div className="bars"><i style={{ height: `${Math.max(day.water * 20, 3)}%` }} /><i style={{ height: `${Math.max(day.sewage * 20, 3)}%` }} /></div><small>{day.label}</small></div>)}</div><div className="chart-legend"><span><i className="water" /> Water tanker</span><span><i className="sewage" /> Sewage tanker</span><b>MongoDB order activity</b></div></article><article className="data-surface"><div className="section-heading"><div><span className="eyebrow">Fleet radar · live</span><h2>Tanker movement</h2></div><Status>{liveTankers.length ? 'Live' : 'Idle'}</Status></div><div className="radar" aria-label={`${liveTankers.length} active deliveries`}>{liveTankers.slice(0, 6).map(({ order, vendor }, index) => <button className={`radar-tanker tanker-${(index % 6) + 1}`} key={order.id} title={`View ${order.id} delivery`} aria-label={`View ${order.id} delivery`} onClick={() => setSelectedTanker({ order, vendor: vendor! })}><Truck size={13} /></button>)}<span className="radar-sweep" /><span className="radar-circle c1" /><span className="radar-circle c2" /><b>UT</b></div><div className="radar-summary"><strong>{liveTankers.length}</strong><span>live deliveries in movement</span></div></article></div>
    <article className="data-surface table-surface"><div className="table-head"><div><span className="eyebrow">Orders</span><h2>Booking control</h2></div><div className="table-tools"><Button variant="quiet" icon={RefreshCcw} onClick={exportOrders}>Export report</Button><label className="input-icon" htmlFor="order-search"><Search size={15} /><input id="order-search" placeholder="Search order or customer" value={adminQuery} onChange={event => setAdminQuery(event.target.value)} /></label></div></div><div className="table-scroll"><table><caption className="sr-only">Urban Tanker booking control</caption><thead><tr><th scope="col">Booking</th><th scope="col">Service</th><th scope="col">Customer</th><th scope="col">Vendor</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead><tbody>{filteredOrders.map(order => <tr key={order.id}><td><b className="mono">{order.id}</b><small>{order.created}</small></td><td>{order.service}<small>{order.capacity}</small></td><td>{order.customer}<small>{order.address}</small></td><td>{order.vendor || 'Pending assignment'}<small>{order.driver || '—'}</small></td><td><b>{money(order.amount)}</b><small>{order.payment}</small></td><td><Status>{order.status}</Status></td></tr>)}</tbody></table></div></article>
    {bookingOpen && <AdminBookingModal booking={booking} setBooking={setBooking} onClose={() => setBookingOpen(false)} onSubmit={(event) => { event.preventDefault(); const order = { id: `ORD-${Date.now().toString().slice(-8)}`, service: booking.service, capacity: booking.capacity, address: booking.address, customer: booking.customer, amount: Number(booking.amount) || 0, status: 'Created' as const, vendor: '', driver: '', eta: 'Pending assignment', payment: 'Due on delivery', created: new Date().toLocaleString('en-IN') }; update({ orders: [order, ...data.orders] }); setBookingOpen(false); notify('Booking created and sent for vendor assignment.'); }} />}
    {selectedTanker && <TankerDeliveryModal order={selectedTanker.order} vendor={selectedTanker.vendor} onClose={() => setSelectedTanker(null)} />}
  </>;
}

function AdminCouponsView() {
  const coupons = useAppStore(state => state.content.coupons);
  return <>
    <PageHeader eyebrow="Admin workspace · Coupons" title="Coupon controls." copy="Review the offers currently available to customers." />
    <article className="data-surface table-surface"><div className="table-head"><div><span className="eyebrow">Customer offers</span><h2>{coupons.length} coupons</h2></div><Status>MongoDB content</Status></div><div className="table-scroll"><table><thead><tr><th>Code</th><th>Offer</th><th>Service</th><th>Discount</th><th>Status</th></tr></thead><tbody>{coupons.map(coupon => <tr key={coupon.code}><td><b className="mono">{coupon.code}</b></td><td>{coupon.label}<small>{coupon.firstBooking ? 'First booking only' : 'All eligible bookings'}</small></td><td>{coupon.service || 'All services'}</td><td><b>{coupon.discount}{coupon.discount < 100 ? '%' : ' off'}</b></td><td><Status>{coupon.active === false ? 'Inactive' : 'Active'}</Status></td></tr>)}</tbody></table>{!coupons.length && <div className="empty-state"><h3>No coupons configured</h3><p>Add coupons through the MongoDB content configuration.</p></div>}</div></article>
  </>;
}

function TankerDeliveryModal({ order, vendor, onClose }: { order: AppData['orders'][number]; vendor: AppData['vendors'][number]; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal tanker-delivery-modal" role="dialog" aria-modal="true" aria-labelledby="tanker-delivery-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Close tanker details">X</button><span className="eyebrow">Live tanker · {vendor.status}</span><h2 id="tanker-delivery-title">{vendor.name}</h2>{order ? <div className="tanker-delivery-details"><div><span>Order</span><b className="mono">{order.id}</b></div><div><span>Customer</span><b>{order.customer}</b></div><div><span>Service</span><b>{order.service} · {order.capacity}</b></div><div><span>Delivery address</span><b>{order.address}</b></div><div><span>Status</span><Status>{order.status}</Status></div><div><span>ETA</span><b>{order.eta || 'Not updated'}</b></div><section className="tanker-detail-group"><h3>Vehicle details</h3><div><span>Registration</span><b>{order.vehicleRegistrationNumber || vendor.vehicle || 'Not assigned'}</b></div><div><span>Type</span><b>{order.vehicleType || 'Tanker'}</b></div><div><span>Capacity</span><b>{order.vehicleCapacity || vendor.capacity || 'Not set'}</b></div></section><section className="tanker-detail-group"><h3>Driver details</h3><div><span>Name</span><b>{order.driver || vendor.driver || 'Not assigned'}</b></div><div><span>Phone</span><b>{order.driverPhone || vendor.phone || 'No phone available'}</b></div><div><span>Status</span><Status>{order.driverActive === false ? 'Inactive' : 'Active'}</Status></div></section></div> : <div className="empty-state"><Truck size={28} /><h3>Available for dispatch</h3><p>This active tanker has no assigned delivery at the moment.</p></div>}<div className="tanker-delivery-actions"><Button variant="quiet" onClick={onClose}>Close</Button></div></section></div>;
}

function AdminCustomersView({ customers, onCreated }: { customers: AdminCustomer[]; onCreated: (account: Awaited<ReturnType<typeof createAdminAccount>>) => void }) {
  const [accountOpen, setAccountOpen] = useState(false);
  return <>
    <PageHeader eyebrow="Admin workspace · Customers" title="Customer directory." copy="Create and manage customer accounts stored in MongoDB." action={<Button variant="primary" icon={Plus} onClick={() => setAccountOpen(true)}>Add customer</Button>} />
    <article className="data-surface table-surface"><div className="table-head"><div><span className="eyebrow">Customer accounts</span><h2>{customers.length} customers</h2></div><label className="input-icon" htmlFor="customer-search"><Search size={15} /><input id="customer-search" placeholder="Search customer" /></label></div><div className="table-scroll"><table><thead><tr><th>Name</th><th>Contact</th><th>Status</th><th>Created</th></tr></thead><tbody>{customers.map(customer => <tr key={customer.uid}><td><b>{customer.name}</b><small className="mono">{customer.uid}</small></td><td>{customer.email}<small>{customer.phone || 'No phone'}</small></td><td><Status>{customer.status}</Status></td><td>{customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-IN') : 'Not available'}</td></tr>)}</tbody></table>{!customers.length && <div className="empty-state"><Users size={28} /><h3>No customers yet</h3><p>Create a customer account to get started.</p></div>}</div></article>
    {accountOpen && <AdminAccountModal role="customer" onClose={() => setAccountOpen(false)} onCreated={account => { onCreated(account); setAccountOpen(false); }} />}
  </>;
}

function AdminVendorsView({ vendors, onCreated, onUpdated }: { vendors: AppData['vendors']; onCreated: (account: Awaited<ReturnType<typeof createAdminAccount>>) => void; onUpdated: (uid: string, status: string, available: boolean) => void }) {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const filteredVendors = vendors.filter(vendor => filter === 'all' || (filter === 'active' ? vendor.status === 'active' || vendor.available === true : vendor.status !== 'active' && vendor.available !== true));
  const toggleStatus = async (vendor: AppData['vendors'][number]) => {
    if (!vendor.uid || busyUid) return;
    const active = !(vendor.status === 'active' || vendor.available === true);
    setBusyUid(vendor.uid);
    try {
      const result = await updateAdminVendorStatus(vendor.uid, active);
      onUpdated(result.uid, result.status, result.available);
    } catch {
      // The parent dashboard displays the existing status until the next refresh.
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
      <div className="table-head"><div><span className="eyebrow">Vendor accounts</span><h2>{filteredVendors.length} visible vendors</h2></div><div className="segmented" role="group" aria-label="Vendor status filter">{(['all', 'active', 'inactive'] as const).map(option => <button className={filter === option ? 'active' : ''} type="button" key={option} onClick={() => setFilter(option)}>{option[0].toUpperCase() + option.slice(1)}</button>)}</div></div>
      <div className="table-scroll"><table><caption className="sr-only">MongoDB vendor directory</caption><thead><tr><th scope="col">Vendor</th><th scope="col">Contact</th><th scope="col">Availability</th><th scope="col">Service details</th><th scope="col">Location</th><th scope="col">Updated</th></tr></thead><tbody>{filteredVendors.map(vendor => { const active = vendor.status === 'active' || vendor.available === true; return <tr key={vendor.uid || vendor.email || vendor.name}><td><b>{vendor.name || 'Unnamed vendor'}</b><small className="mono">{vendor.uid || 'No UID'}</small></td><td>{vendor.email || 'No email'}<small>{vendor.phone || 'No phone'}</small></td><td><Status>{active ? 'Active' : 'Inactive'}</Status><small>{vendor.available ? 'Accepting bookings' : 'Unavailable'}</small></td><td>{vendor.vehicle || 'No vehicle'}<small>{vendor.capacity || 'Capacity not set'} · Rating {vendor.rating || '—'}</small></td><td>{vendor.zone || 'Not set'}<small>{typeof vendor.latitude === 'number' && typeof vendor.longitude === 'number' ? `${vendor.latitude.toFixed(4)}, ${vendor.longitude.toFixed(4)}` : 'Location not shared'}</small></td><td>{vendor.updated_at ? new Date(vendor.updated_at).toLocaleString('en-IN') : 'Not available'}</td></tr>; })}</tbody></table>{!filteredVendors.length && <div className="empty-state"><Users size={28} /><h3>No vendors found</h3><p>No vendor records match this status.</p></div>}</div>
    </article>
    {accountOpen && <AdminAccountModal role="vendor" onClose={() => setAccountOpen(false)} onCreated={account => { onCreated(account); setAccountOpen(false); }} />}
  </>;
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

function AdminBookingModal({ booking, setBooking, onClose, onSubmit }: { booking: { service: string; capacity: string; customer: string; address: string; amount: string }; setBooking: (value: { service: string; capacity: string; customer: string; address: string; amount: string }) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="admin-booking-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Close booking form">×</button><span className="eyebrow">Admin booking control</span><h2 id="admin-booking-title">Create a test order.</h2><p className="modal-copy">Create a booking with a pending vendor assignment.</p><form className="auth-form" onSubmit={onSubmit}><label>Service<select value={booking.service} onChange={event => setBooking({ ...booking, service: event.target.value })}><option>Water tanker</option><option>Sewage pickup</option></select></label><label>Capacity<input value={booking.capacity} onChange={event => setBooking({ ...booking, capacity: event.target.value })} required /></label><label>Customer name<input value={booking.customer} onChange={event => setBooking({ ...booking, customer: event.target.value })} required /></label><label>Delivery address<input value={booking.address} onChange={event => setBooking({ ...booking, address: event.target.value })} required /></label><label>Amount<input type="number" min="0" value={booking.amount} onChange={event => setBooking({ ...booking, amount: event.target.value })} required /></label><div className="heading-actions"><Button variant="quiet" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit">Create booking</Button></div></form></section></div>;
}

function AdminOrdersView({ orders, query, setQuery }: { orders: AppData['orders']; query: string; setQuery: (value: string) => void }) {
  return <>
    <PageHeader eyebrow="Admin workspace · Orders" title="Booking control." copy="Search and review all tenant orders and their current lifecycle status." />
    <article className="data-surface table-surface admin-orders-surface"><div className="table-head"><div><span className="eyebrow">Tenant orders</span><h2>{orders.length} visible orders</h2></div><label className="input-icon" htmlFor="admin-orders-search"><Search size={15} /><input id="admin-orders-search" placeholder="Search order or customer" value={query} onChange={event => setQuery(event.target.value)} /></label></div><div className="table-scroll"><table className="admin-orders-table"><thead><tr><th>Booking</th><th>Service</th><th>Customer</th><th>Vendor</th><th>Amount</th><th>Status</th></tr></thead><tbody>{orders.map(order => <tr key={order.id}><td data-label="Booking"><b className="mono">{order.id}</b><small>{order.created}</small></td><td data-label="Service">{order.service}<small>{order.capacity}</small></td><td data-label="Customer">{order.customer}<small>{order.address}</small></td><td data-label="Vendor">{order.vendor || 'Pending assignment'}<small>{order.driver || '—'}</small></td><td data-label="Amount"><b>{money(order.amount)}</b><small>{order.payment}</small></td><td data-label="Status"><Status>{order.status}</Status></td></tr>)}</tbody></table></div></article>
  </>;
}

function AdminTrackingView({ orders, vendors }: { orders: AppData['orders']; vendors: AppData['vendors'] }) {
  const activeOrders = orders.filter(order => order.status !== 'Delivered' && order.status !== 'Rejected');
  return <>
    <PageHeader eyebrow="Admin workspace · Live tracking" title="Network movement." copy="Monitor active deliveries and vendor locations across the tenant." />
    <section className="stats-grid"><StatCard icon={Truck} label="Active deliveries" value={activeOrders.length} detail="Current routes" /><StatCard icon={Users} label="Vendor records" value={vendors.length} detail="Tenant vendors" /><StatCard icon={MapPin} label="Shared locations" value={activeOrders.filter(order => typeof order.vendorLatitude === 'number').length} detail="Latest coordinates" /></section>
    <div className="order-list">{activeOrders.length ? activeOrders.map(order => <article className="order-row" key={order.id}><div className="order-service-icon"><Truck size={19} /></div><div className="order-main"><div><b>{order.id}</b><Status>{order.status}</Status></div><span>{order.customer} · {order.address}</span><small>{order.vendor || 'Waiting for vendor assignment'} · {order.eta}</small></div></article>) : <div className="empty-state"><MapPin size={28} /><h3>No active routes</h3><p>Live vendor routes will appear here when orders are accepted.</p></div>}</div>
  </>;
}

function AdminSupportView({ onNotify }: { onNotify: (message: string) => void }) {
  return <><PageHeader eyebrow="Admin workspace · Help" title="Operations support." copy="Coordinate dispatch, vendor access, customer escalations, and platform issues." /><section className="data-surface support-surface"><MessageSquare size={24} /><h2>Dispatch desk</h2><p>Use the operations desk for tenant-level issues and urgent delivery escalations.</p><Button variant="primary" icon={MessageSquare} onClick={() => onNotify('Operations support request opened')}>Open support request</Button></section></>;
}

function AdminBookingView({ onNotify }: { onNotify: (message: string) => void }) {
  return <><PageHeader eyebrow="Admin workspace · Booking control" title="Create an operations booking." copy="Use this workspace to coordinate a booking on behalf of a customer or dispatch team." action={<Button variant="primary" icon={Plus} onClick={() => onNotify('Admin booking form opened')}>Create booking</Button>} /><section className="data-surface support-surface"><Package size={24} /><h2>Booking intake</h2><p>Bookings created here will be stored under the active tenant and routed to eligible vendors.</p></section></>;
}
