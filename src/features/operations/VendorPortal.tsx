import {
    Check,
    IndianRupee,
    MapPin,
    Navigation,
    Package,
    Phone,
    ShieldCheck,
    X,
} from "lucide-react";
import type { AppData, Order, OrderStatus, Vehicle, Workspace } from "../../shared/lib/types";
import { Button, PageHeader, StatCard, Status } from "../../shared/components/ui";
import { Pagination } from "../../shared/components/Pagination";
import { money } from "../../shared/data/demo";
import { useAppStore } from "../../app/store";
import { createVendorMaintenance, createVendorVehicle, deleteVendorVehicle, getVendorAvailability, loadVendorDashboard, loadVendorExpiringDocuments, loadVendorMaintenance, loadVendorPayouts, loadVendorVehicles, saveDriverAttendance, setVendorAvailability, setVendorVehicleActive, updateVendorLocation, updateVendorOrder } from "../../shared/lib/cloudStore";
import { useEffect, useRef, useState, type Dispatch, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../../shared/lib/apiConfig";
import { getAuthToken, getCurrentUser } from "../../features/auth/auth";
import { FleetExpiryPanel } from './FleetExpiryPanel';

const stages: OrderStatus[] = [
    "Created",
    "Accepted",
    "En route",
    "Arrived",
    "Delivered",
];
export function VendorPortal({ view = "overview" }: { view?: Workspace }) {
    const {
        data,
        vendorStage: stage,
        setVendorStage: setStage,
        updateOrder: onUpdate,
        notify: onNotify,
    } = useAppStore();
    const [available, setAvailable] = useState(false);
    const [vendorName, setVendorName] = useState(data.profile?.name || "Vendor");
    const [vendorOrders, setVendorOrders] = useState<AppData["orders"]>([]);
    const [availabilityBusy, setAvailabilityBusy] = useState(false);
    const [otp, setOtp] = useState("");
    const [deliveryProof, setDeliveryProof] = useState("");
    const [operationBusy, setOperationBusy] = useState(false);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState("");
    const [selectedDriverId, setSelectedDriverId] = useState("");
    const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
    const [incomingOrderState, setIncomingOrderState] = useState<"pending" | "accepted" | "rejected">("pending");
    const [incomingBusy, setIncomingBusy] = useState(false);
    const [acceptSelectionOpen, setAcceptSelectionOpen] = useState(false);
    const [acceptVehicleId, setAcceptVehicleId] = useState("");
    const [acceptDriverId, setAcceptDriverId] = useState("");
    const [customerContactOpen, setCustomerContactOpen] = useState(false);
    const incomingOrderRef = useRef<Order | null>(null);
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                updateVendorLocation(position.coords.latitude, position.coords.longitude).catch(() => undefined);
            }, () => undefined, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
        }
        const refreshDashboard = () => loadVendorDashboard().then(result => {

            setAvailable(result.vendor?.status === "active" || result.vendor?.available === true);
            setVendorName(result.vendor?.name || data.profile?.name || "Vendor");
            setVendorOrders(result.orders || []);
            useAppStore.setState(state => ({ data: { ...state.data, orders: result.orders || [] } }));
            const activeOrder = (result.orders || []).find(item => item.status !== "Delivered");
            if (activeOrder && stages.includes(activeOrder.status)) setStage(activeOrder.status);
        });
        void refreshDashboard().catch(() => {
            getVendorAvailability().then(setAvailable).catch(() => undefined);
        });
        const refreshTimer = window.setInterval(() => { void refreshDashboard().catch(() => undefined); }, 10000);
        void loadVendorVehicles().then(items => {
            const activeVehicle = items.find(item => item.active && item.driverActive);
            setVehicles(items);
            setSelectedVehicleId(activeVehicle?.id || "");
            setSelectedDriverId(activeVehicle?.driverId || "");
            setAcceptVehicleId(activeVehicle?.id || items[0]?.id || "");
            setAcceptDriverId(activeVehicle?.driverId || items[0]?.driverId || "");
        }).catch(() => undefined);
        return () => window.clearInterval(refreshTimer);
    }, [data.profile?.name, setStage]);
    useEffect(() => {
        const token = getAuthToken();
        if (!token) return undefined;
        const socket: Socket = io(API_BASE_URL, { auth: { token }, transports: ["websocket", "polling"] });

        const created = (order: Order & { excludedVendorUids?: string[] }) => {
            const currentUser = getCurrentUser();
            if (currentUser?.uid && order.excludedVendorUids?.includes(currentUser.uid)) return;
            incomingOrderRef.current = order;
            setIncomingOrder(order);
            setIncomingOrderState("pending");
            document.title = "New order · Urban Tanker";
        };

        const accepted = (event: { orderId: string; vendorName: string }) => {
            if (incomingOrderRef.current?.id !== event.orderId) return;
            setIncomingOrderState("accepted");
            document.title = `Order accepted by ${event.vendorName}`;
        };

        const rejected = (event: { orderId: string }) => {
            if (incomingOrderRef.current?.id !== event.orderId) return;
            incomingOrderRef.current = null;
            setIncomingOrder(null);
            document.title = "Urban Tanker | Operations, simplified";
        };

        socket.on("order:created", created);
        socket.on("order:accepted", accepted);
        socket.on("order:rejected", rejected);

        return () => {
            socket.disconnect();
            document.title = "Urban Tanker | Operations, simplified";
        };
    }, []);
    const toggleAvailability = async () => {
        if (availabilityBusy) return;
        const next = !available;
        setAvailabilityBusy(true);
        try {
            await setVendorAvailability(next);
            setAvailable(next);
            if (next) {
                const refreshed = await loadVendorDashboard();
                setVendorOrders(refreshed.orders || []);
                useAppStore.setState(state => ({ data: { ...state.data, orders: refreshed.orders || [] } }));
            }
            onNotify(next ? "You are now available for new service bookings." : "You are unavailable for new service bookings.");
        } catch {
            onNotify("Unable to update your service availability.");
        } finally {
            setAvailabilityBusy(false);
        }
    };
    const order = vendorOrders.find(item => item.status !== "Delivered");
    const index = stages.indexOf(stage);
    const readCurrentLocation = () => new Promise<{ latitude?: number; longitude?: number }>((resolve) => {
        if (!navigator.geolocation) { resolve({}); return; }
        navigator.geolocation.getCurrentPosition(
            position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
            () => resolve({}),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
        );
    });
    const advance = async () => {
        if (!order) return;
        if (stage === "Created" || stage === "Pending acceptance" || stage === "Vendor assigned") {
            setOperationBusy(true);
            try {
                if (!selectedVehicleId) { onNotify("Select an active fleet vehicle before accepting the order."); setOperationBusy(false); return; }
                if (!selectedDriverId) { onNotify("Select an active driver before accepting the order."); setOperationBusy(false); return; }
                const accepted = { ...order, status: "Accepted" as OrderStatus, vendorDecision: "accepted" as const };
                await updateVendorOrder(accepted, { action: "accept", vehicleId: selectedVehicleId, driverId: selectedDriverId });
                setStage("Accepted");
                setVendorOrders(current => current.map(item => item.id === order.id ? accepted : item));
                onNotify("Order accepted. Customer tracking is now active.");
            } catch { onNotify("Unable to accept this order."); } finally { setOperationBusy(false); }
            return;
        }
        if (stage === "Arrived") {
            if (!/^\d{6}$/.test(otp)) { onNotify("Enter the customer’s 6-digit delivery OTP."); return; }
            setOperationBusy(true);
            try {
                const completed = { ...order, status: "Delivered" as OrderStatus, eta: "Delivered" };
                await updateVendorOrder(completed, { deliveryOtp: otp, deliveryProof });
                onUpdate(completed);
                setVendorOrders(current => current.map(item => item.id === completed.id ? completed : item));
                setStage("Delivered");
                setOtp("");
                setDeliveryProof("");
                onNotify("Delivery completed after OTP verification.");
            } catch (cause) { onNotify(cause instanceof Error ? cause.message : "Unable to complete delivery."); } finally { setOperationBusy(false); }
            return;
        }
        const next = stages[Math.min(index + 1, stages.length - 1)];
        setStage(next);
        const location = next === "Accepted" ? await readCurrentLocation() : {};
        if (order) {
            const updatedOrder = {
                ...order,
                status: next,
                eta: next === "Delivered" ? "Delivered" : order.eta,
                vendorPhone: data.profile?.phone,
                vendorLatitude: location.latitude,
                vendorLongitude: location.longitude,
            };
            onUpdate(updatedOrder);
            setVendorOrders(current => current.map(item => item.id === updatedOrder.id ? updatedOrder : item));
            if (typeof location.latitude === "number" && typeof location.longitude === "number") await updateVendorLocation(location.latitude, location.longitude);
            await updateVendorOrder(updatedOrder);
        }
        onNotify(
            next === "Delivered"
                ? "Delivery completed with OTP verification."
                : `Order updated: ${next}`,
        );
    };
    const rejectOrder = async () => {
        if (!order || operationBusy) return;
        setOperationBusy(true);
        try {
            await updateVendorOrder({ ...order, status: "Rejected" }, { action: "reject" });
            setVendorOrders(current => current.filter(item => item.id !== order.id));
            onNotify("Order rejected and returned to dispatch.");
        } catch { onNotify("Unable to reject this order."); } finally { setOperationBusy(false); }
    };
    const openAcceptSelection = () => {
        if (!incomingOrder) return;
        const preferredVehicle = vehicles.find(item => item.active && item.driverActive) ?? vehicles.find(item => item.active) ?? vehicles[0];
        const nextVehicleId = preferredVehicle?.id || selectedVehicleId || "";
        const nextDriverId = preferredVehicle?.driverId || selectedDriverId || "";
        setAcceptVehicleId(nextVehicleId);
        setAcceptDriverId(nextDriverId);
        setAcceptSelectionOpen(true);
    };
    const acceptIncomingOrder = async () => {
        if (!incomingOrder || incomingBusy) return;
        const vehicleId = acceptVehicleId || selectedVehicleId;
        const driverId = acceptDriverId || selectedDriverId;
        if (!vehicleId || !driverId) { onNotify("Select an active vehicle and driver before accepting the order."); return; }
        setIncomingBusy(true);
        try {
            await updateVendorOrder({ ...incomingOrder, status: "Accepted", vendorDecision: "accepted" }, { action: "accept", vehicleId, driverId });
            setSelectedVehicleId(vehicleId);
            setSelectedDriverId(driverId);
            setAcceptSelectionOpen(false);
            setIncomingOrder(null);
            setIncomingOrderState("pending");
            document.title = "Urban Tanker | Operations, simplified";
            onNotify("Order accepted. Customer tracking is now active.");
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : "Unable to accept this order.";
            if (message.toLowerCase().includes("already been accepted")) setIncomingOrderState("accepted");
            onNotify(message);
        } finally { setIncomingBusy(false); }
    };
    const rejectIncomingOrder = async () => {
        if (!incomingOrder || incomingBusy) return;
        const rejectionReason = window.prompt("Why are you rejecting this order?", "Vehicle or driver unavailable")?.trim();
        if (rejectionReason === undefined) return;
        setIncomingBusy(true);
        try {
            await updateVendorOrder({ ...incomingOrder, status: "Rejected" }, { action: "reject", rejectionReason: rejectionReason || "Vendor declined the assignment." });
            setIncomingOrder(null);
            document.title = "Urban Tanker | Operations, simplified";
        } catch { onNotify("Unable to reject this order."); } finally { setIncomingBusy(false); }
    };
    const shareLocation = async () => {
        if (!order || operationBusy) return;
        const location = await readCurrentLocation();
        if (typeof location.latitude !== "number" || typeof location.longitude !== "number") { onNotify("Unable to read your current location."); return; }
        setOperationBusy(true);
        try {
            await updateVendorLocation(location.latitude, location.longitude);
            await updateVendorOrder({ ...order, vendorLatitude: location.latitude, vendorLongitude: location.longitude }, {});
            onNotify("Current location shared with the customer.");
        } catch { onNotify("Unable to share your current location."); } finally { setOperationBusy(false); }
    };
    if (view !== "overview") {
        const activeOrder = vendorOrders.find(item => item.status !== "Delivered");
        if (view === "orders") return <VendorOrdersView orders={vendorOrders} />;
        if (view === "track") return <VendorTrackingView order={activeOrder} orders={vendorOrders} />;
        if (view === "fleet") return <><FleetExpiryPanel onNotify={onNotify} /><VehicleFleetView vehicles={vehicles} setVehicles={setVehicles} onNotify={onNotify} /></>;
        if (view === "maintenance") return <VendorMaintenanceView vehicles={vehicles} onNotify={onNotify} />;
        if (view === "attendance") return <VendorAttendanceView vehicles={vehicles} onNotify={onNotify} />;
        if (view === "payouts") return <VendorPayoutsView onNotify={onNotify} />;
        if (view === "support") return <VendorSupportView onNotify={onNotify} />;
        return <VendorBookingView onNotify={onNotify} />;
    }
    return (
        <>
            {acceptSelectionOpen && incomingOrder && (
                <AcceptOrderSelectionModal
                    vehicles={vehicles}
                    selectedVehicleId={acceptVehicleId}
                    selectedDriverId={acceptDriverId}
                    onVehicleChange={setAcceptVehicleId}
                    onDriverChange={setAcceptDriverId}
                    onCancel={() => setAcceptSelectionOpen(false)}
                    onConfirm={() => void acceptIncomingOrder()}
                    busy={incomingBusy}
                />
            )}
            {incomingOrder && <VendorOrderAlert order={incomingOrder} state={incomingOrderState} busy={incomingBusy} onAccept={openAcceptSelection} onReject={() => void rejectIncomingOrder()} onClose={() => setIncomingOrder(null)} />}
            {customerContactOpen && order && <CustomerContactModal order={order} onClose={() => setCustomerContactOpen(false)} />}
            <PageHeader
                eyebrow={`Vendor portal · ${vendorName}`}
                title="Keep every delivery moving."
                copy="Accept new bookings quickly, keep the customer updated, and complete delivery with their OTP."
                action={
                    <div className="heading-actions">
                        <Button variant={available ? "primary" : "quiet"} icon={available ? Check : ShieldCheck} onClick={() => void toggleAvailability()} disabled={availabilityBusy}>
                            {availabilityBusy ? "Updating..." : available ? "Active for bookings" : "Inactive for bookings"}
                        </Button>
                        <Button variant="quiet" icon={Navigation} onClick={() => void shareLocation()} disabled={operationBusy}>Share location</Button>
                    </div>
                }
            />
            <section
                className="stats-grid vendor-stats"
                aria-label="Vendor performance"
            >
                <StatCard
                    icon={Package}
                    label="Jobs today"
                    value={String(vendorOrders.length)}
                    detail="Active assignments"
                />
                <StatCard
                    icon={Check}
                    label="Completed"
                    value={String(vendorOrders.filter(item => item.status === "Delivered").length)}
                    detail="Completed assignments"
                    tone="highlight"
                />
                <StatCard
                    icon={IndianRupee}
                    label="Estimated earnings"
                    value={money(vendorOrders.reduce((total, item) => total + item.amount, 0))}
                    detail="Assigned orders"
                />
            </section>
            <div className="vendor-layout">
                <article className="job-surface" aria-live="polite">
                    {order ? (
                        <>
                            <div className="job-head">
                                <div>
                                    <Status>{stage}</Status>
                                    <h2>{order.service}</h2>
                                    <span className="mono">{order.id} · booked today</span>
                                </div>
                                <span className="job-price">{money(order.amount)}</span>
                            </div>
                            <div className="job-address">
                                <MapPin size={18} />
                                <div>
                                    <span>Deliver to</span>
                                    <b>{order.address}</b>
                                    <small>Gate 2 · Call on arrival</small>
                                </div>
                                <Phone size={17} />
                            </div>
                            <div className="job-meta">
                                <div>
                                    <span>Customer</span>
                                    <b>{order.customer}</b>
                                </div>
                                <div>
                                    <span>Capacity</span>
                                    <b>{order.capacity}</b>
                                </div>
                                <div>
                                    <span>Payment</span>
                                    <b>{order.payment}</b>
                                </div>
                            </div>
                            <div className="job-actions">
                                {(stage === "Created" || stage === "Pending acceptance" || stage === "Vendor assigned") && <Button variant="quiet" icon={ShieldCheck} onClick={() => void rejectOrder()} disabled={operationBusy}>Reject order</Button>}
                                <Button
                                    variant="quiet"
                                    icon={Phone}
                                    onClick={() => setCustomerContactOpen(true)}
                                >
                                    Call customer
                                </Button>
                                <Button
                                    variant="primary"
                                    icon={stage === "Arrived" ? ShieldCheck : Navigation}
                                    onClick={() => void advance()}
                                    disabled={operationBusy || stage === "Delivered"}
                                >
                                    {stage === "Arrived"
                                        ? "Complete with OTP"
                                        : stage === "Delivered"
                                            ? "Completed"
                                            : `Mark ${stages[index + 1]}`}
                                </Button>
                            </div>
                            {stage === "Arrived" && <><label className="vendor-otp-field">Delivery OTP<input inputMode="numeric" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Enter 6-digit OTP" /></label><label className="vendor-otp-field">Delivery proof photo<input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 1_500_000) { onNotify("Choose an image smaller than 1.5 MB."); event.target.value = ""; return; } const reader = new FileReader(); reader.onload = () => setDeliveryProof(typeof reader.result === "string" ? reader.result : ""); reader.readAsDataURL(file); }} /></label></>}
                        </>
                    ) : (
                        <div className="empty-state">
                            <Package size={28} />
                            <h3>No active job</h3>
                            <p>New assignments will appear here.</p>
                        </div>
                    )}
                </article>
                <aside className="protocol-card">
                    <span className="eyebrow">Delivery protocol</span>
                    <h3>Protect every handover.</h3>
                    {[
                        "Verify access before arrival",
                        "Start service after customer confirms",
                        "Ask for delivery OTP at completion",
                        "Upload receipt after handover",
                    ].map((item, step) => (
                        <div
                            className={step <= index ? "protocol-step done" : "protocol-step"}
                            key={item}
                        >
                            <span>{step <= index ? <Check size={13} /> : step + 1}</span>
                            <b>{item}</b>
                        </div>
                    ))}
                    <div className="notice">
                        <ShieldCheck size={15} /> Location is shared only while this active
                        job is in progress.
                    </div>
                </aside>
            </div>
        </>
    );
}

function CustomerContactModal({ order, onClose }: { order: Order; onClose: () => void }) {
    return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal customer-contact-modal" role="dialog" aria-modal="true" aria-labelledby="customer-contact-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Close customer information"><X size={18} /></button><span className="eyebrow">Customer details</span><h2 id="customer-contact-title">{order.customer || "Customer"}</h2><div className="customer-contact-details"><div><span>Order</span><b className="mono">{order.id}</b></div><div><span>Phone</span><b>{order.customerPhone || "No phone number available"}</b></div><div><span>Delivery address</span><b>{order.address || "No address available"}</b></div><div><span>Service</span><b>{order.service} · {order.capacity}</b></div></div><div className="heading-actions"><Button variant="primary" onClick={onClose}>OK</Button></div></section></div>;
}

function VendorMaintenanceView({ vehicles, onNotify }: { vehicles: Vehicle[]; onNotify: (message: string) => void }) {
    const [records, setRecords] = useState<Array<Record<string, unknown>>>([]);
    const [form, setForm] = useState({ vehicleId: vehicles[0]?.id || '', scheduledAt: '', description: '', cost: '0' });
    useEffect(() => { void loadVendorMaintenance().then(setRecords).catch(error => onNotify(error instanceof Error ? error.message : 'Unable to load maintenance records.')); }, []);
    const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); try { await createVendorMaintenance({ ...form, cost: Number(form.cost) || 0 }); setRecords(await loadVendorMaintenance()); onNotify('Maintenance reminder scheduled.'); } catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to schedule maintenance.'); } };
    return <><PageHeader eyebrow="Vendor workspace · Maintenance" title="Keep the fleet ready." copy="Schedule maintenance work before it interrupts customer deliveries." /><section className="data-surface"><form className="auth-form" onSubmit={submit}><div className="field-row"><label>Vehicle<select value={form.vehicleId} onChange={event => setForm({ ...form, vehicleId: event.target.value })}>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber}</option>)}</select></label><label>Scheduled date<input type="date" value={form.scheduledAt} onChange={event => setForm({ ...form, scheduledAt: event.target.value })} required /></label></div><div className="field-row"><label>Description<input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Service, inspection, repair" required /></label><label>Estimated cost<input type="number" min="0" value={form.cost} onChange={event => setForm({ ...form, cost: event.target.value })} /></label></div><Button variant="primary" type="submit" disabled={!vehicles.length}>Schedule maintenance</Button></form></section><section className="data-surface"><div className="section-heading"><div><span className="eyebrow">Maintenance calendar</span><h2>{records.length} records</h2></div></div>{records.length ? records.map(record => <article className="order-row" key={String(record.id)}><div className="order-service-icon"><Package size={19} /></div><div className="order-main"><div><b>{String(record.description)}</b><Status>{String(record.status)}</Status></div><span>{String(record.scheduled_at)}</span><small>Estimated cost: {String(record.cost || 0)}</small></div></article>) : <div className="empty-state"><Package size={28} /><h3>No maintenance scheduled</h3></div>}</section></>;
}

function VendorAttendanceView({ vehicles, onNotify }: { vehicles: Vehicle[]; onNotify: (message: string) => void }) {
    const [form, setForm] = useState({ driverId: vehicles[0]?.driverId || '', date: new Date().toISOString().slice(0, 10), status: 'present', notes: '' });
    const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); try { await saveDriverAttendance(form); onNotify('Driver attendance saved.'); } catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to save attendance.'); } };
    return <><PageHeader eyebrow="Vendor workspace · Attendance" title="Know who is ready to drive." copy="Record daily driver attendance and keep dispatch availability accurate." /><section className="data-surface"><form className="auth-form" onSubmit={submit}><label>Driver<select value={form.driverId} onChange={event => setForm({ ...form, driverId: event.target.value })}>{vehicles.map(vehicle => <option key={vehicle.driverId} value={vehicle.driverId}>{vehicle.driverName} · {vehicle.registrationNumber}</option>)}</select></label><div className="field-row"><label>Date<input type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} required /></label><label>Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="present">Present</option><option value="absent">Absent</option><option value="leave">Leave</option></select></label></div><label>Notes<textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} rows={3} /></label><Button variant="primary" type="submit" disabled={!vehicles.length}>Save attendance</Button></form></section></>;
}

function VendorPayoutsView({ onNotify }: { onNotify: (message: string) => void }) {
    const [payouts, setPayouts] = useState<Array<Record<string, unknown>>>([]);
    useEffect(() => { void loadVendorPayouts().then(setPayouts).catch(error => onNotify(error instanceof Error ? error.message : 'Unable to load payouts.')); }, []);
    return <><PageHeader eyebrow="Vendor workspace · Payouts" title="Track your earnings." copy="Review payout periods and payment status from dispatch." /><section className="data-surface"><div className="section-heading"><div><span className="eyebrow">Payout history</span><h2>{payouts.length} payouts</h2></div></div>{payouts.length ? payouts.map(payout => <article className="order-row" key={String(payout.id)}><div className="order-service-icon"><IndianRupee size={19} /></div><div className="order-main"><div><b>{String(payout.period_start || 'Payout')}</b><Status>{String(payout.status)}</Status></div><span>{String(payout.period_end || '')}</span></div><div className="order-amount"><strong>{String(payout.amount || 0)}</strong></div></article>) : <div className="empty-state"><IndianRupee size={28} /><h3>No payouts yet</h3><p>Completed delivery earnings will appear here.</p></div>}</section></>;
}

function VendorOrderAlert({ order, state, busy, onAccept, onReject, onClose }: { order: Order; state: "pending" | "accepted" | "rejected"; busy: boolean; onAccept: () => void; onReject: () => void; onClose: () => void }) {
    return <aside className="vendor-order-alert" role="dialog" aria-live="assertive" aria-label="Vendor order notification"><button className="vendor-order-alert-close" type="button" onClick={onClose} aria-label="Close order notification">X</button><span className="eyebrow">New delivery request</span><h3>{order.service}</h3><p><b>{order.customer || "Customer"}</b> · {order.address}</p><p>{order.capacity} · {order.payment}</p>{state === "pending" ? <div className="vendor-order-alert-actions"><Button variant="quiet" onClick={onReject} disabled={busy}>Reject</Button><Button variant="primary" onClick={onAccept} disabled={busy}>{busy ? "Updating..." : "Accept order"}</Button></div> : <div className="vendor-order-alert-accepted"><Status>Accepted by another vendor</Status><button type="button" onClick={onClose} aria-label="Close accepted order notification">Close</button></div>}</aside>;
}

function AcceptOrderSelectionModal({ vehicles, selectedVehicleId, selectedDriverId, onVehicleChange, onDriverChange, onCancel, onConfirm, busy }: { vehicles: Vehicle[]; selectedVehicleId: string; selectedDriverId: string; onVehicleChange: (vehicleId: string) => void; onDriverChange: (driverId: string) => void; onCancel: () => void; onConfirm: () => void; busy: boolean; }) {
    const selectedVehicle = vehicles.find(vehicle => vehicle.id === selectedVehicleId) ?? vehicles[0];
    const drivers = selectedVehicle ? [{ id: selectedVehicle.driverId, name: selectedVehicle.driverName || 'Driver', phone: selectedVehicle.driverPhone || 'No phone' }] : [];

    return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onCancel()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="accept-order-selection-title"><button className="modal-close" type="button" onClick={onCancel} aria-label="Close acceptance details">×</button><span className="eyebrow">Complete order acceptance</span><h2 id="accept-order-selection-title">Assign driver and vehicle</h2><p className="modal-copy">Select the vehicle and driver assigned to this delivery before confirming the order.</p><div className="auth-form"><label>Vehicle<select value={selectedVehicleId} onChange={event => {
        onVehicleChange(event.target.value);
        const nextVehicle = vehicles.find(vehicle => vehicle.id === event.target.value);
        if (nextVehicle && nextVehicle.driverId && !drivers.some(driver => driver.id === nextVehicle.driverId)) {
            onDriverChange(nextVehicle.driverId);
        }
    }}><option value="">Select a vehicle</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber} · {vehicle.vehicleType}</option>)}</select></label>{selectedVehicle && <label>Driver<select value={selectedDriverId} onChange={event => onDriverChange(event.target.value)}><option value="">Select a driver</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name} · {driver.phone}</option>)}</select></label>}{!selectedVehicle && <p className="form-error">Add a vehicle with an active driver before accepting this order.</p>}<div className="heading-actions"><Button variant="quiet" onClick={onCancel} disabled={busy}>Cancel</Button><Button variant="primary" onClick={onConfirm} disabled={busy || !selectedVehicle || !selectedDriverId}>{busy ? "Updating..." : "Confirm acceptance"}</Button></div></div></section></div>;
}

function VehicleFleetView({ vehicles, setVehicles, onNotify }: { vehicles: Vehicle[]; setVehicles: Dispatch<React.SetStateAction<Vehicle[]>>; onNotify: (message: string) => void }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ registrationNumber: "", vehicleType: "Tanker", capacity: "", driverName: "", driverPhone: "", imageUrl: "" });
    const addVehicle = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try { const vehicle = await createVendorVehicle(form); setVehicles(items => [vehicle, ...items]); setForm({ registrationNumber: "", vehicleType: "Tanker", capacity: "", driverName: "", driverPhone: "", imageUrl: "" }); setOpen(false); onNotify("Vehicle and driver added to your fleet."); } catch (error) { onNotify(error instanceof Error ? error.message : "Unable to add vehicle."); }
    };
    return <><PageHeader eyebrow="Vendor workspace · Fleet" title="Manage your vehicles." copy="Add, activate, deactivate, or remove the vehicles available for delivery assignments." action={<Button variant="primary" icon={Package} onClick={() => setOpen(true)}>Add vehicle</Button>} /><div className="order-list">{vehicles.length ? vehicles.map(vehicle => <article className="order-row" key={vehicle.id}>{vehicle.imageUrl ? <img className="vehicle-thumb" src={vehicle.imageUrl} alt="" /> : <div className="order-service-icon"><Package size={19} /></div>}<div className="order-main"><div><b>{vehicle.registrationNumber}</b><Status>{vehicle.active ? "Active" : "Inactive"}</Status></div><span>{vehicle.vehicleType} · {vehicle.capacity || "Capacity not set"}</span></div><Button variant={vehicle.active ? "quiet" : "primary"} onClick={() => void setVendorVehicleActive(vehicle.id, !vehicle.active).then(() => setVehicles(items => items.map(item => item.id === vehicle.id ? { ...item, active: !vehicle.active } : item))).catch(error => onNotify(error instanceof Error ? error.message : "Unable to update vehicle."))}>{vehicle.active ? "Set inactive" : "Set active"}</Button><Button variant="quiet" onClick={() => void deleteVendorVehicle(vehicle.id).then(() => setVehicles(items => items.filter(item => item.id !== vehicle.id))).catch(error => onNotify(error instanceof Error ? error.message : "Unable to delete vehicle."))}>Delete</Button></article>) : <div className="empty-state"><Package size={28} /><h3>No vehicles yet</h3><p>Add a vehicle before accepting delivery orders.</p></div>}</div>{open && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="vehicle-dialog-title"><button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close vehicle form">×</button><span className="eyebrow">Fleet management</span><h2 id="vehicle-dialog-title">Add vehicle</h2><form className="auth-form" onSubmit={addVehicle}><label>Registration number<input value={form.registrationNumber} onChange={event => setForm({ ...form, registrationNumber: event.target.value })} required /></label><label>Vehicle type<input value={form.vehicleType} onChange={event => setForm({ ...form, vehicleType: event.target.value })} required /></label><label>Capacity<input value={form.capacity} onChange={event => setForm({ ...form, capacity: event.target.value })} /></label><label>Vehicle image <small>(optional)</small><input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 2_000_000) { onNotify("Vehicle image must be smaller than 2 MB."); return; } const reader = new FileReader(); reader.onload = () => setForm(current => ({ ...current, imageUrl: String(reader.result || "") })); reader.readAsDataURL(file); }} /></label><div className="heading-actions"><Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit">Add vehicle</Button></div></form></section></div>}</>;
}

function VendorOrdersView({ orders }: { orders: AppData["orders"] }) {
    const [filter, setFilter] = useState<"all" | "accepted" | "rejected" | "delivered">("all");
    const [page, setPage] = useState(1);
    const acceptedStatuses: OrderStatus[] = ["Accepted", "Vendor accepted", "En route", "Arrived"];
    const rejectedStatuses: OrderStatus[] = ["Rejected", "Vendor rejected"];
    const filteredOrders = filter === "accepted" ? orders.filter(order => acceptedStatuses.includes(order.status)) : filter === "rejected" ? orders.filter(order => rejectedStatuses.includes(order.status)) : filter === "delivered" ? orders.filter(order => order.status === "Delivered") : orders;
    const visibleOrders = filteredOrders.slice((page - 1) * 10, page * 10);
    const changeFilter = (nextFilter: typeof filter) => { setFilter(nextFilter); setPage(1); };
    const tabs = [{ id: "all" as const, label: "All orders" }, { id: "accepted" as const, label: "Accepted" }, { id: "rejected" as const, label: "Rejected" }, { id: "delivered" as const, label: "Delivered" }];
    return <>
        <PageHeader eyebrow="Vendor workspace · Orders" title="Your assigned orders." copy="Review active and completed jobs assigned to your vendor account." />
        <div className="filter-tabs vendor-order-tabs" role="tablist" aria-label="Vendor order status filters">{tabs.map(tab => <button className={filter === tab.id ? "active" : ""} role="tab" aria-selected={filter === tab.id} type="button" key={tab.id} onClick={() => changeFilter(tab.id)}>{tab.label} <b>{tab.id === "all" ? orders.length : tab.id === "accepted" ? orders.filter(order => acceptedStatuses.includes(order.status)).length : tab.id === "rejected" ? orders.filter(order => rejectedStatuses.includes(order.status)).length : orders.filter(order => order.status === "Delivered").length}</b></button>)}</div>
        <div className="order-list">
            {filteredOrders.length ? visibleOrders.map(order => <article className="order-row" key={order.id}>
                <div className="order-service-icon"><Package size={19} /></div>
                <div className="order-main"><div><b>{order.service}</b><Status>{order.status}</Status></div><span>{order.id} · {order.capacity} · {order.address}</span><small>{order.customer}</small></div>
                <div className="order-amount"><strong>{money(order.amount)}</strong><span>{order.payment}</span></div>
            </article>) : <div className="empty-state"><Package size={28} /><h3>No {filter === "all" ? "assigned" : filter} orders</h3><p>Orders will appear here when they reach this status.</p></div>}
        </div><Pagination page={page} pageSize={10} total={filteredOrders.length} onPageChange={setPage} />
    </>;
}

function VendorTrackingView({ order, orders }: { order?: Order; orders: AppData["orders"] }) {
    return <>
        <PageHeader eyebrow="Vendor workspace · Live tracking" title="Share the journey." copy="Your latest location is visible to the customer while the active job is in progress." />
        <section className="tracking-surface">
            {order ? <><div className="section-heading"><div><span className="eyebrow">Active job</span><h2>{order.service} · {order.id}</h2><p>{order.address}</p></div><Status>{order.status}</Status></div><div className="tracking-details"><div><span>Customer</span><b>{order.customer}</b></div><div><span>Last location</span><b>{typeof order.vendorLatitude === "number" ? `${order.vendorLatitude.toFixed(4)}, ${order.vendorLongitude?.toFixed(4)}` : "Not shared yet"}</b></div><div><span>ETA</span><b>{order.eta}</b></div></div></> : <div className="empty-state"><Navigation size={28} /><h3>No active delivery</h3><p>Accept an order to start sharing your location.</p></div>}
        </section>{orders.length > 1 && <section className="data-surface route-plan"><div className="section-heading"><div><span className="eyebrow">Route plan</span><h2>Suggested delivery sequence</h2></div><Status>Optimized</Status></div><ol>{orders.filter(item => item.status !== "Delivered" && item.status !== "Rejected").map((item, index) => <li key={item.id}><span>{index + 1}</span><div><b>{item.service} · {item.id}</b><small>{item.address} · {item.eta || "ETA pending"}</small></div></li>)}</ol></section>}
    </>;
}

function VendorSupportView({ onNotify }: { onNotify: (message: string) => void }) {
    return <>
        <PageHeader eyebrow="Vendor workspace · Help" title="How can operations help?" copy="Contact dispatch about assignments, customer access, payments, or delivery issues." />
        <section className="data-surface support-surface"><h2>Vendor support</h2><p>Include the order ID when contacting dispatch so the operations team can respond quickly.</p><Button variant="primary" icon={Phone} onClick={() => onNotify("Dispatch support request opened")}>Contact dispatch</Button></section>
    </>;
}

function VendorBookingView({ onNotify }: { onNotify: (message: string) => void }) {
    return <>
        <PageHeader eyebrow="Vendor workspace" title="Vendor bookings" copy="Vendor accounts receive assignments from dispatch rather than creating customer bookings." />
        <section className="data-surface support-surface"><h2>Ready for assignments</h2><p>Return to Overview to manage availability and accept the next assigned order.</p><Button variant="quiet" icon={Check} onClick={() => onNotify("Bookings are assigned by dispatch")}>View dispatch status</Button></section>
    </>;
}
