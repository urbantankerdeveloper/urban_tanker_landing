import { useState } from 'react';
import { MapPin, Package, Truck } from 'lucide-react';
import type { AppData } from '../../shared/lib/types';
import { PageHeader, Status } from '../../shared/components/ui';
import { money } from '../../shared/data/demo';

const columns = [
  { id: 'pending', label: 'Needs vendor', statuses: ['Created', 'Pending acceptance', 'Rejected', 'Vendor assigned'] },
  { id: 'accepted', label: 'Accepted', statuses: ['Accepted', 'Vendor accepted', 'En route', 'Arrived'] },
  { id: 'delivered', label: 'Delivered', statuses: ['Delivered'] },
];

export function DispatchBoard({ orders, vendors, onAssign, onNotify }: { orders: AppData['orders']; vendors: AppData['vendors']; onAssign: (orderId: string, vendorUid: string) => Promise<void>; onNotify: (message: string) => void }) {
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const assign = async (orderId: string, vendorUid: string) => {
    setBusyOrderId(orderId);
    try { await onAssign(orderId, vendorUid); } catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to assign vendor.'); } finally { setBusyOrderId(null); }
  };
  return <><PageHeader eyebrow="Admin workspace · Dispatch" title="Move every order forward." copy="Drag orders through the delivery lifecycle or assign an eligible vendor directly." /><div className="dispatch-board">{columns.map(column => <section className="dispatch-column" key={column.id} onDragOver={event => event.preventDefault()} onDrop={() => { if (draggedOrderId && column.id === 'pending') onNotify('Choose a vendor from the order card to assign it.'); setDraggedOrderId(null); }}><div className="dispatch-column-head"><div><span className="eyebrow">{column.label}</span><h2>{orders.filter(order => column.statuses.includes(order.status)).length}</h2></div><Status>{column.id === 'delivered' ? 'Complete' : column.id === 'accepted' ? 'In progress' : 'Queue'}</Status></div><div className="dispatch-card-list">{orders.filter(order => column.statuses.includes(order.status)).map(order => <article className="dispatch-card" key={order.id} draggable onDragStart={() => setDraggedOrderId(order.id)}><div className="dispatch-card-top"><Package size={17} /><b className="mono">{order.id}</b><Status>{order.status}</Status></div><h3>{order.service}</h3><p>{order.customer} · {order.address}</p><div className="dispatch-card-meta"><span><MapPin size={13} /> {order.eta || 'Pending ETA'}</span><strong>{money(order.amount)}</strong></div>{column.id === 'pending' && !order.assignedVendorUid && !order.vendor && <label className="dispatch-assign">Assign vendor<select defaultValue="" disabled={busyOrderId === order.id} onChange={event => void assign(order.id, event.target.value)}><option value="">Choose active vendor</option>{vendors.filter(vendor => vendor.status === 'active' || vendor.available === true).map(vendor => <option value={vendor.uid} key={vendor.uid}>{vendor.name}</option>)}</select></label>}{column.id === 'accepted' && <small className="dispatch-vendor"><Truck size={13} /> {order.vendor || 'Assigned vendor'}</small>}</article>)}</div></section>)}</div></>;
}
