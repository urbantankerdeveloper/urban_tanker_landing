import { Check, Gauge, IndianRupee, Package, Plus, RefreshCcw, Search, Truck, UserRound, Users, WalletCards, MapPin, MessageSquare } from 'lucide-react';
import { money } from '../../shared/data/demo';
import { useAppStore } from '../../app/store';
import { Button, PageHeader, StatCard, Status } from '../../shared/components/ui';
import type { AppData } from '../../shared/lib/types';
import { loadAdminDashboard, type AdminDashboardData } from '../../shared/lib/cloudStore';
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
  if (view === 'track') return <AdminTrackingView orders={data.orders} vendors={data.vendors} />;
  if (view === 'support') return <AdminSupportView onNotify={notify} />;
  if (view === 'book') return <AdminBookingView onNotify={notify} />;

  return <>
    <PageHeader eyebrow="Network intelligence · September 2026" title="Welcome back, Admin." copy="Monitor bookings, operations, revenue, and tanker activity across Chennai." action={<div className="heading-actions"><Button variant="quiet" icon={RefreshCcw} onClick={() => notify('Operations dashboard refreshed')}>Refresh</Button><Button variant="primary" icon={Plus} onClick={() => setBookingOpen(true)}>Create test order</Button></div>} />
    <section className="admin-kpis admin-kpis-compact" aria-label="Network performance"><StatCard icon={IndianRupee} label="Revenue this month" value={money(revenue)} detail="MongoDB orders" tone="highlight" /><StatCard icon={Check} label="Delivered" value={delivered} detail="Tenant orders" /><StatCard icon={Truck} label="Live tankers" value={dashboard?.activeDeliveries ?? 0} detail="Active deliveries" /><StatCard icon={Gauge} label="Fleet utilisation" value={`${dashboard?.activeVendors ?? 0}/${dashboard?.vendors.length ?? data.vendors.length}`} detail="Active vendors" /></section>
    <section className="admin-kpis admin-kpis-compact secondary" aria-label="Network totals"><StatCard icon={Package} label="Total orders" value={data.orders.length} detail="MongoDB orders" /><StatCard icon={Users} label="Active vendors" value={dashboard?.activeVendors ?? 0} detail="Active status" /><StatCard icon={UserRound} label="Customers" value={dashboard?.customers ?? 0} detail="MongoDB customers" /><StatCard icon={WalletCards} label="Platform commission" value={money(Math.round(revenue * .1))} detail="10% of revenue" /></section>
    <div className="admin-grid"><article className="data-surface chart-surface"><div className="section-heading"><div><span className="eyebrow">Order performance · daily flow</span><h2>Water vs sewage orders</h2></div><div className="segmented" role="group" aria-label="Order period"><button className="active" type="button">7 days</button><button type="button">30 days</button><button type="button">90 days</button></div></div><div className="chart" aria-label="Bar chart showing weekly orders">{chart.map((day, index) => <div className="bar-group" key={`${day.label}-${index}`}><div className="bars"><i style={{ height: `${Math.max(day.water * 20, 3)}%` }} /><i style={{ height: `${Math.max(day.sewage * 20, 3)}%` }} /></div><small>{day.label}</small></div>)}</div><div className="chart-legend"><span><i className="water" /> Water tanker</span><span><i className="sewage" /> Sewage tanker</span><b>MongoDB order activity</b></div></article><article className="data-surface"><div className="section-heading"><div><span className="eyebrow">Fleet radar · live</span><h2>Tanker movement</h2></div><Status>Online</Status></div><div className="radar"><b>UT</b><span className="radar-circle c1" /><span className="radar-circle c2" /></div>{data.vendors.map(vendor => <div className="insight" key={vendor.name}><span><Truck size={14} /></span><div><b>{vendor.name}</b><p>{vendor.vehicle} · {vendor.zone} · {vendor.status}</p></div></div>)}</article></div>
    <article className="data-surface table-surface"><div className="table-head"><div><span className="eyebrow">Orders</span><h2>Booking control</h2></div><div className="table-tools"><Button variant="quiet" icon={RefreshCcw} onClick={exportOrders}>Export report</Button><label className="input-icon" htmlFor="order-search"><Search size={15} /><input id="order-search" placeholder="Search order or customer" value={adminQuery} onChange={event => setAdminQuery(event.target.value)} /></label></div></div><div className="table-scroll"><table><caption className="sr-only">Urban Tanker booking control</caption><thead><tr><th scope="col">Booking</th><th scope="col">Service</th><th scope="col">Customer</th><th scope="col">Vendor</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead><tbody>{filteredOrders.map(order => <tr key={order.id}><td><b className="mono">{order.id}</b><small>{order.created}</small></td><td>{order.service}<small>{order.capacity}</small></td><td>{order.customer}<small>{order.address}</small></td><td>{order.vendor || 'Pending assignment'}<small>{order.driver || '—'}</small></td><td><b>{money(order.amount)}</b><small>{order.payment}</small></td><td><Status>{order.status}</Status></td></tr>)}</tbody></table></div></article>
    {bookingOpen && <AdminBookingModal booking={booking} setBooking={setBooking} onClose={() => setBookingOpen(false)} onSubmit={(event) => { event.preventDefault(); const order = { id: `ORD-${Date.now().toString().slice(-8)}`, service: booking.service, capacity: booking.capacity, address: booking.address, customer: booking.customer, amount: Number(booking.amount) || 0, status: 'Created' as const, vendor: '', driver: '', eta: 'Pending assignment', payment: 'Due on delivery', created: new Date().toLocaleString('en-IN') }; update({ orders: [order, ...data.orders] }); setBookingOpen(false); notify('Booking created and sent for vendor assignment.'); }} />}
  </>;
}

function AdminBookingModal({ booking, setBooking, onClose, onSubmit }: { booking: { service: string; capacity: string; customer: string; address: string; amount: string }; setBooking: (value: { service: string; capacity: string; customer: string; address: string; amount: string }) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="admin-booking-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Close booking form">×</button><span className="eyebrow">Admin booking control</span><h2 id="admin-booking-title">Create a test order.</h2><p className="modal-copy">Create a booking with a pending vendor assignment.</p><form className="auth-form" onSubmit={onSubmit}><label>Service<select value={booking.service} onChange={event => setBooking({ ...booking, service: event.target.value })}><option>Water tanker</option><option>Sewage pickup</option></select></label><label>Capacity<input value={booking.capacity} onChange={event => setBooking({ ...booking, capacity: event.target.value })} required /></label><label>Customer name<input value={booking.customer} onChange={event => setBooking({ ...booking, customer: event.target.value })} required /></label><label>Delivery address<input value={booking.address} onChange={event => setBooking({ ...booking, address: event.target.value })} required /></label><label>Amount<input type="number" min="0" value={booking.amount} onChange={event => setBooking({ ...booking, amount: event.target.value })} required /></label><div className="heading-actions"><Button variant="quiet" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit">Create booking</Button></div></form></section></div>;
}

function AdminOrdersView({ orders, query, setQuery }: { orders: AppData['orders']; query: string; setQuery: (value: string) => void }) {
  return <>
    <PageHeader eyebrow="Admin workspace · Orders" title="Booking control." copy="Search and review all tenant orders and their current lifecycle status." />
    <article className="data-surface table-surface"><div className="table-head"><div><span className="eyebrow">Tenant orders</span><h2>{orders.length} visible orders</h2></div><label className="input-icon" htmlFor="admin-orders-search"><Search size={15} /><input id="admin-orders-search" placeholder="Search order or customer" value={query} onChange={event => setQuery(event.target.value)} /></label></div><div className="table-scroll"><table><thead><tr><th>Booking</th><th>Service</th><th>Customer</th><th>Vendor</th><th>Amount</th><th>Status</th></tr></thead><tbody>{orders.map(order => <tr key={order.id}><td><b className="mono">{order.id}</b><small>{order.created}</small></td><td>{order.service}<small>{order.capacity}</small></td><td>{order.customer}<small>{order.address}</small></td><td>{order.vendor || 'Pending assignment'}<small>{order.driver || '—'}</small></td><td><b>{money(order.amount)}</b><small>{order.payment}</small></td><td><Status>{order.status}</Status></td></tr>)}</tbody></table></div></article>
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
