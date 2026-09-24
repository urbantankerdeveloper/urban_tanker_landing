import {
    Check,
    IndianRupee,
    MapPin,
    Navigation,
    Package,
    Phone,
    ShieldCheck,
    Users,
    X,
} from "lucide-react";
import type { AppData, Order, OrderStatus, Vehicle, Workspace } from "../../shared/lib/types";
import { Button, PageHeader, StatCard, Status } from "../../shared/components/ui";
import { WorkspaceSkeleton } from "../../shared/components/LoadingSkeleton";
import { Pagination } from "../../shared/components/Pagination";
import { money } from "../../shared/data/demo";
import { useAppStore } from "../../app/store";
import { createSupportRequest, createVendorMaintenance, createVendorVehicle, deleteVendorVehicle, getVendorAvailability, loadVendorDashboard, loadVendorDrivers, loadVendorMaintenance, loadVendorPayouts, loadVendorVehicles, saveDriverAttendance, setVendorAvailability, setVendorVehicleActive, updateVendorLocation, updateVendorOrder } from "../../shared/lib/cloudStore";
import { useEffect, useRef, useState, type Dispatch, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../../shared/lib/apiConfig";
import { getAuthToken, getCurrentUser } from "../../features/auth/auth";
import { FleetExpiryPanel } from './FleetExpiryPanel';
import { VendorDriversWithProofView as VendorDriversFormView } from './VendorDriversWithProofView';

const stages: OrderStatus[] = [
    "Created",
    "Accepted",
    "En route",
    "Arrived",
    "Delivered",
];

async function compressImage(file: File): Promise<string> {
    if (typeof createImageBitmap !== 'function') {
        const sourceUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Unable to read the vehicle image.'));
            reader.readAsDataURL(file);
        });
        return sourceUrl;
    }
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.78);
}

function normalizeRegistrationInput(value: string): string {
    const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    const state = raw.slice(0, 2).replace(/[^A-Z]/g, '');
    const rto = raw.slice(2, 4).replace(/[^0-9]/g, '');
    const series = raw.slice(4, 6).replace(/[^A-Z]/g, '');
    const number = raw.slice(6, 10).replace(/[^0-9]/g, '');
    return [state, rto, series, number].filter(Boolean).join(' ');
}

function normalizeCapacityInput(value: string): string {
    const raw = value.toUpperCase().replace(/[^0-9KL]/g, '');
    const digits = raw.match(/^\d{0,3}/)?.[0] || '';
    const suffix = raw.slice(digits.length).replace(/[^KL]/g, '').startsWith('KL') ? ' KL' : raw.slice(digits.length).includes('K') ? ' K' : '';
    return `${digits}${suffix}`;
}
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
    const [drivers, setDrivers] = useState<Array<{ id: string; name: string; phone: string; active: boolean }>>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState("");
    const [selectedDriverId, setSelectedDriverId] = useState("");
    const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
    const [selectionOrder, setSelectionOrder] = useState<Order | null>(null);
    const [incomingOrderState, setIncomingOrderState] = useState<"pending" | "accepted" | "rejected">("pending");
    const [incomingBusy, setIncomingBusy] = useState(false);
    const [acceptSelectionOpen, setAcceptSelectionOpen] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
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
        const refreshDashboard = async () => {
            try {
                const result = await loadVendorDashboard();
                setAvailable(result.vendor?.status === "active" || result.vendor?.available === true);
                setVendorName(result.vendor?.name || data.profile?.name || "Vendor");
                setVendorOrders(result.orders || []);
                useAppStore.setState(state => ({ data: { ...state.data, orders: result.orders || [] } }));
                const activeOrder = (result.orders || []).find(item => item.status !== "Delivered");
                if (activeOrder && stages.includes(activeOrder.status)) setStage(activeOrder.status);
            } finally {
                setInitialLoading(false);
            }
        };
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
        void loadVendorDrivers().then(setDrivers).catch(() => undefined);
        return () => window.clearInterval(refreshTimer);
    }, [data.profile?.name, setStage]);
    useEffect(() => {
        const token = getAuthToken();
        if (!token) return undefined;
        const socket: Socket = io(API_BASE_URL, { auth: { token }, transports: ["websocket", "polling"] });
        socket.on("connect", () => console.info("Vendor Socket.IO connected", socket.id));
        socket.on("connect_error", error => console.error("Vendor Socket.IO connection failed", error.message));
        socket.on("disconnect", reason => console.info("Vendor Socket.IO disconnected", reason));

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
    if (initialLoading) return <WorkspaceSkeleton role="vendor" />;
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
            openStageAcceptSelection();
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
        const nextDriverId = preferredVehicle?.driverId || selectedDriverId || drivers.find(item => item.active)?.id || "";
        setAcceptVehicleId(nextVehicleId);
        setAcceptDriverId(nextDriverId);
        setAcceptSelectionOpen(true);
    };
    const openStageAcceptSelection = () => {
        if (!order || operationBusy) return;
        const preferredVehicle = vehicles.find(item => item.active && item.driverActive) ?? vehicles.find(item => item.active) ?? vehicles[0];
        setSelectionOrder(order);
        setAcceptVehicleId(preferredVehicle?.id || selectedVehicleId || "");
        setAcceptDriverId(preferredVehicle?.driverId || selectedDriverId || drivers.find(item => item.active)?.id || "");
        setAcceptSelectionOpen(true);
    };
    const acceptIncomingOrder = async () => {
        const targetOrder = incomingOrder || selectionOrder;
        if (!targetOrder || incomingBusy) return;
        const vehicleId = acceptVehicleId || selectedVehicleId;
        const driverId = acceptDriverId || selectedDriverId;
        if (!vehicleId || !driverId) { onNotify("Select an active vehicle and driver before accepting the order."); return; }
        setIncomingBusy(true);
        try {
            await updateVendorOrder({ ...targetOrder, status: "Accepted", vendorDecision: "accepted" }, { action: "accept", vehicleId, driverId });
            setSelectedVehicleId(vehicleId);
            setSelectedDriverId(driverId);
            setStage("Accepted");
            setVendorOrders(current => current.map(item => item.id === targetOrder.id ? { ...item, status: "Accepted" as OrderStatus, vendorDecision: "accepted" } : item));
            setAcceptSelectionOpen(false);
            setIncomingOrder(null);
            setSelectionOrder(null);
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
        if (view === "fleet") return <><FleetExpiryPanel onNotify={onNotify} /><VehicleFleetManagementView vehicles={vehicles} setVehicles={setVehicles} onNotify={onNotify} /></>;
        if (view === "drivers") return <VendorDriversFormView onNotify={onNotify} />;
        if (view === "maintenance") return <VendorMaintenanceView vehicles={vehicles} onNotify={onNotify} />;
        if (view === "attendance") return <VendorAttendanceView drivers={drivers} onNotify={onNotify} />;
        if (view === "payouts") return <VendorPayoutsView onNotify={onNotify} />;
        if (view === "support") return <VendorSupportView onNotify={onNotify} />;
        return <VendorBookingView onNotify={onNotify} />;
    }
    return (
        <>
            {acceptSelectionOpen && (incomingOrder || selectionOrder) && (
                <AcceptOrderSelectionModal
                    vehicles={vehicles}
                    drivers={drivers}
                    selectedVehicleId={acceptVehicleId}
                    selectedDriverId={acceptDriverId}
                    onVehicleChange={setAcceptVehicleId}
                    onDriverChange={setAcceptDriverId}
                    onCancel={() => { setAcceptSelectionOpen(false); setSelectionOrder(null); }}
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
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ vehicleId: vehicles[0]?.id || '', scheduledAt: '', description: '', cost: '0' });
    useEffect(() => { void loadVendorMaintenance().then(setRecords).catch(error => onNotify(error instanceof Error ? error.message : 'Unable to load maintenance records.')); }, [onNotify]);
    const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); try { await createVendorMaintenance({ ...form, cost: Number(form.cost) || 0 }); setRecords(await loadVendorMaintenance()); setForm({ vehicleId: vehicles[0]?.id || '', scheduledAt: '', description: '', cost: '0' }); setOpen(false); onNotify('Maintenance reminder scheduled.'); } catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to schedule maintenance.'); } };
    return <><PageHeader eyebrow="Vendor workspace · Maintenance" title="Keep the fleet ready." copy="Schedule maintenance work before it interrupts customer deliveries." action={<Button variant="primary" icon={Package} onClick={() => setOpen(true)} disabled={!vehicles.length}>Schedule maintenance</Button>} /><div className="order-list">{records.length ? records.map(record => <article className="order-row" key={String(record.id)}><div className="order-service-icon"><Package size={19} /></div><div className="order-main"><div><b>{String(record.description)}</b><Status>{String(record.status)}</Status></div><span>{String(record.scheduled_at)}</span><small>Estimated cost: {String(record.cost || 0)}</small></div></article>) : <div className="empty-state"><Package size={28} /><h3>No maintenance scheduled</h3><p>Schedule service for a vehicle in your fleet.</p></div>}</div>{open && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="maintenance-dialog-title"><button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close maintenance form">×</button><span className="eyebrow">Fleet maintenance</span><h2 id="maintenance-dialog-title">Schedule maintenance</h2><p className="modal-copy">Keep vehicles ready for the next delivery assignment.</p><form className="auth-form" onSubmit={submit}><label>Vehicle<select value={form.vehicleId} onChange={event => setForm({ ...form, vehicleId: event.target.value })}>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber} · {vehicle.capacity || 'Capacity not set'}</option>)}</select></label><label>Scheduled date<input type="date" value={form.scheduledAt} onChange={event => setForm({ ...form, scheduledAt: event.target.value })} required /></label><label>Description<input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Service, inspection, repair" required /></label><label>Estimated cost<input type="number" min="0" value={form.cost} onChange={event => setForm({ ...form, cost: event.target.value })} /></label><div className="heading-actions"><Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit">Schedule maintenance</Button></div></form></section></div>}</>;
}


function VendorAttendanceView({ drivers, onNotify }: { drivers: Array<{ id: string; name: string; phone: string; active: boolean }>; onNotify: (message: string) => void }) {
    const [form, setForm] = useState({ driverId: drivers[0]?.id || '', date: new Date().toISOString().slice(0, 10), status: 'present', notes: '' });
    const [open, setOpen] = useState(false);
    useEffect(() => { if (!form.driverId && drivers[0]?.id) setForm(current => ({ ...current, driverId: drivers[0].id })); }, [drivers, form.driverId]);
    const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); try { await saveDriverAttendance(form); onNotify('Driver attendance saved.'); } catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to save attendance.'); } };
    const openForDriver = (driverId: string) => { setForm(current => ({ ...current, driverId })); setOpen(true); };
    return <><PageHeader eyebrow="Vendor workspace · Attendance" title="Know who is ready to drive." copy="Record daily driver attendance and keep dispatch availability accurate." action={<Button variant="primary" icon={Users} onClick={() => openForDriver(drivers[0]?.id || '')} disabled={!drivers.length}>Record attendance</Button>} /><div className="order-list">{drivers.length ? drivers.map(driver => <article className="order-row" key={driver.id}><div className="order-service-icon"><Users size={19} /></div><div className="order-main"><div><b>{driver.name}</b><Status>{driver.active ? 'Active' : 'Inactive'}</Status></div><span>{driver.phone || 'No phone number'}</span><small>Attendance can be recorded for this driver.</small></div><Button variant="quiet" onClick={() => openForDriver(driver.id)}>Record attendance</Button></article>) : <div className="empty-state"><Users size={28} /><h3>No drivers yet</h3><p>Add a driver before recording attendance.</p></div>}</div>{open && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="attendance-dialog-title"><button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close attendance form">×</button><span className="eyebrow">Driver attendance</span><h2 id="attendance-dialog-title">Record attendance</h2><p className="modal-copy">Keep today’s driver availability accurate for dispatch.</p><form className="auth-form" onSubmit={submit}><label>Driver<select value={form.driverId} onChange={event => setForm({ ...form, driverId: event.target.value })}>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name} · {driver.active ? 'Active' : 'Inactive'}</option>)}</select></label><label>Date<input type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} required /></label><label>Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="present">Present</option><option value="absent">Absent</option><option value="leave">Leave</option></select></label><label>Notes<textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} rows={3} /></label><div className="heading-actions"><Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit">Save attendance</Button></div></form></section></div>}</>;
}

function VendorPayoutsView({ onNotify }: { onNotify: (message: string) => void }) {
    const [payouts, setPayouts] = useState<Array<Record<string, unknown>>>([]);
    useEffect(() => { void loadVendorPayouts().then(setPayouts).catch(error => onNotify(error instanceof Error ? error.message : 'Unable to load payouts.')); }, [onNotify]);
    return <><PageHeader eyebrow="Vendor workspace · Payouts" title="Track your earnings." copy="Review payout periods and payment status from dispatch." /><section className="data-surface"><div className="section-heading"><div><span className="eyebrow">Payout history</span><h2>{payouts.length} payouts</h2></div></div>{payouts.length ? payouts.map(payout => <article className="order-row" key={String(payout.id)}><div className="order-service-icon"><IndianRupee size={19} /></div><div className="order-main"><div><b>{String(payout.period_start || 'Payout')}</b><Status>{String(payout.status)}</Status></div><span>{String(payout.period_end || '')}</span></div><div className="order-amount"><strong>{String(payout.amount || 0)}</strong></div></article>) : <div className="empty-state"><IndianRupee size={28} /><h3>No payouts yet</h3><p>Completed delivery earnings will appear here.</p></div>}</section></>;
}

function VendorOrderAlert({ order, state, busy, onAccept, onReject, onClose }: { order: Order; state: "pending" | "accepted" | "rejected"; busy: boolean; onAccept: () => void; onReject: () => void; onClose: () => void }) {
    return <aside className="vendor-order-alert" role="dialog" aria-live="assertive" aria-label="Vendor order notification"><button className="vendor-order-alert-close" type="button" onClick={onClose} aria-label="Close order notification">X</button><span className="eyebrow">New delivery request</span><h3>{order.service}</h3><p><b>{order.customer || "Customer"}</b> · {order.address}</p><p>{order.capacity} · {order.payment}</p>{state === "pending" ? <div className="vendor-order-alert-actions"><Button variant="quiet" onClick={onReject} disabled={busy}>Reject</Button><Button variant="primary" onClick={onAccept} disabled={busy}>{busy ? "Updating..." : "Accept order"}</Button></div> : <div className="vendor-order-alert-accepted"><Status>Accepted by another vendor</Status><button type="button" onClick={onClose} aria-label="Close accepted order notification">Close</button></div>}</aside>;
}

function AcceptOrderSelectionModal({ vehicles, drivers, selectedVehicleId, selectedDriverId, onVehicleChange, onDriverChange, onCancel, onConfirm, busy }: { vehicles: Vehicle[]; drivers: Array<{ id: string; name: string; phone: string; active: boolean }>; selectedVehicleId: string; selectedDriverId: string; onVehicleChange: (vehicleId: string) => void; onDriverChange: (driverId: string) => void; onCancel: () => void; onConfirm: () => void; busy: boolean; }) {
    const selectedVehicle = vehicles.find(vehicle => vehicle.id === selectedVehicleId) ?? vehicles[0];
    const activeDrivers = drivers.filter(driver => driver.active);

    return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onCancel()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="accept-order-selection-title"><button className="modal-close" type="button" onClick={onCancel} aria-label="Close acceptance details">×</button><span className="eyebrow">Complete order acceptance</span><h2 id="accept-order-selection-title">Assign driver and vehicle</h2><p className="modal-copy">Select the vehicle and driver assigned to this delivery before confirming the order.</p><div className="auth-form"><label>Vehicle<select value={selectedVehicleId} onChange={event => {
        onVehicleChange(event.target.value);
        const nextVehicle = vehicles.find(vehicle => vehicle.id === event.target.value);
        if (nextVehicle?.driverId && activeDrivers.some(driver => driver.id === nextVehicle.driverId)) {
            onDriverChange(nextVehicle.driverId);
        } else if (!activeDrivers.some(driver => driver.id === selectedDriverId)) {
            onDriverChange(activeDrivers[0]?.id || '');
        }
    }}><option value="">Select a vehicle</option>{vehicles.filter(vehicle => vehicle.active).map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber} · {vehicle.vehicleType}</option>)}</select></label>{selectedVehicle && <label>Driver<select value={selectedDriverId} onChange={event => onDriverChange(event.target.value)}><option value="">Select a driver</option>{activeDrivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name} · {driver.phone || 'No phone'}</option>)}</select></label>}{!selectedVehicle && <p className="form-error">Add an active vehicle before accepting this order.</p>}{selectedVehicle && !activeDrivers.length && <p className="form-error">Add and activate a driver before accepting this order.</p>}<div className="heading-actions"><Button variant="quiet" onClick={onCancel} disabled={busy}>Cancel</Button><Button variant="primary" onClick={onConfirm} disabled={busy || !selectedVehicle || !selectedDriverId}>{busy ? "Updating..." : "Confirm acceptance"}</Button></div></div></section></div>;
}

function VehicleFleetManagementView({ vehicles, setVehicles, onNotify }: { vehicles: Vehicle[]; setVehicles: Dispatch<React.SetStateAction<Vehicle[]>>; onNotify: (message: string) => void }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ registrationNumber: '', vehicleType: 'Water tanker', capacity: '', imageUrl: '' });
    const registrationPattern = /^[A-Z]{2}[ -]?[0-9]{2}[ -]?[A-Z]{2}[ -]?[0-9]{4}$/;
    useEffect(() => {
        if (!open) return;
        const select = document.querySelector<HTMLSelectElement>('.modal[aria-labelledby="vehicle-dialog-title"] select');
        select?.querySelectorAll('option').forEach(option => { if (option.value === 'Tanker' || option.textContent === 'Tanker') option.remove(); });
    }, [open]);
    useEffect(() => {
        if (!open) return;
        const input = document.querySelector<HTMLInputElement>('.modal[aria-labelledby="vehicle-dialog-title"] input');
        if (!input) return;
        const normalize = () => {
            const value = normalizeRegistrationInput(input.value);
            if (input.value !== value) {
                input.value = value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        };
        input.addEventListener('input', normalize);
        return () => input.removeEventListener('input', normalize);
    }, [open]);
    useEffect(() => {
        if (!open) return;
        const inputs = document.querySelectorAll<HTMLInputElement>('.modal[aria-labelledby="vehicle-dialog-title"] input');
        const input = inputs[1];
        if (!input) return;
        const normalize = () => {
            const value = normalizeCapacityInput(input.value);
            if (input.value !== value) {
                input.value = value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        };
        input.addEventListener('input', normalize);
        return () => input.removeEventListener('input', normalize);
    }, [open]);
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const registrationNumber = form.registrationNumber.trim().toUpperCase();
        if (!registrationPattern.test(registrationNumber)) { onNotify('Use registration format: TN12 AB 9847.'); return; }
        if (!form.vehicleType) { onNotify('Select a vehicle type.'); return; }
        try { const vehicle = await createVendorVehicle({ ...form, registrationNumber, driverName: '', driverPhone: '' }); setVehicles(items => [vehicle, ...items]); setForm({ registrationNumber: '', vehicleType: 'Water tanker', capacity: '', imageUrl: '' }); setOpen(false); onNotify('Vehicle added to your fleet.'); } catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to add vehicle.'); }
    };
    const remove = async (vehicle: Vehicle) => { try { await deleteVendorVehicle(vehicle.id); setVehicles(items => items.filter(item => item.id !== vehicle.id)); onNotify('Vehicle removed from your fleet.'); } catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to delete vehicle.'); } };
    return <><PageHeader eyebrow="Vendor workspace · Fleet" title="Manage your vehicles." copy="Add vehicles independently. Assign a driver only when accepting an order." action={<Button variant="primary" icon={Package} onClick={() => setOpen(true)}>Add vehicle</Button>} /><div className="order-list">{vehicles.length ? vehicles.map(vehicle => <article className="order-row" key={vehicle.id}><div className="order-service-icon"><Package size={19} /></div><div className="order-main"><div><b>{vehicle.registrationNumber}</b><Status>{vehicle.active ? 'Active' : 'Inactive'}</Status></div><span>{vehicle.vehicleType} · {vehicle.capacity || 'Capacity not set'}</span><small>{vehicle.driverName ? `Assigned driver: ${vehicle.driverName}` : 'No driver assigned'}</small></div><Button variant={vehicle.active ? 'quiet' : 'primary'} onClick={() => void setVendorVehicleActive(vehicle.id, !vehicle.active).then(() => setVehicles(items => items.map(item => item.id === vehicle.id ? { ...item, active: !vehicle.active } : item))).catch(error => onNotify(error instanceof Error ? error.message : 'Unable to update vehicle.'))}>{vehicle.active ? 'Set inactive' : 'Set active'}</Button><Button variant="quiet" onClick={() => void remove(vehicle)}>Delete</Button></article>) : <div className="empty-state"><Package size={28} /><h3>No vehicles yet</h3><p>Add a vehicle before accepting delivery orders.</p></div>}</div>{open && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="vehicle-dialog-title"><button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close vehicle form">×</button><span className="eyebrow">Fleet management</span><h2 id="vehicle-dialog-title">Add vehicle</h2><form className="auth-form" onSubmit={submit} noValidate><label>Registration number<input value={form.registrationNumber} onChange={event => setForm({ ...form, registrationNumber: event.target.value.toUpperCase() })} placeholder="TN12 AB 9847" pattern="[A-Z]{2}[ -]?[0-9]{2}[ -]?[A-Z]{2}[ -]?[0-9]{4}" required /><small>State code (2 letters) - RTO number (2 digits) - 2 letters - vehicle number (4 digits).</small></label><label>Vehicle type<select value={form.vehicleType} onChange={event => setForm({ ...form, vehicleType: event.target.value })} required><option value="">Select vehicle type</option><option>Tanker</option><option>Water tanker</option><option>Sewage tanker</option></select></label><label>Capacity<input value={form.capacity} onChange={event => setForm({ ...form, capacity: event.target.value })} placeholder="6 KL" /></label><label>Vehicle image <small>(optional)</small><input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 2_000_000) { onNotify('Vehicle image must be smaller than 2 MB.'); return; } void compressImage(file).then(imageUrl => setForm(current => ({ ...current, imageUrl }))).catch(() => onNotify('Unable to process vehicle image.')); }} /></label><div className="heading-actions"><Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit">Add vehicle</Button></div></form></section></div>}</>;
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
    const [open, setOpen] = useState(false);
    const [subject, setSubject] = useState('Vendor support request');
    const [requestType, setRequestType] = useState('Vehicle approval');
    const [orderId, setOrderId] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true);
        try { await createSupportRequest({ subject: `${requestType}: ${subject}`, message, orderId: orderId.trim() || undefined }); setMessage(''); setOrderId(''); setOpen(false); onNotify('Support request sent to the operations team.'); } catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to send support request.'); } finally { setBusy(false); }
    };
    return <>
        <PageHeader eyebrow="Vendor workspace · Help" title="How can operations help?" copy="Contact dispatch about assignments, customer access, payments, or delivery issues." />
        <section className="data-surface support-surface"><h2>Vendor support</h2><p>Send a request to the operations team and track its resolution from dispatch.</p><Button variant="primary" icon={Phone} onClick={() => setOpen(true)}>Contact dispatch</Button></section>
        {open && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="vendor-support-title"><button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close support request">×</button><span className="eyebrow">Vendor support</span><h2 id="vendor-support-title">Open a support request.</h2><form className="auth-form" onSubmit={submit}><label>Request type<select value={requestType} onChange={event => setRequestType(event.target.value)}><option>Vehicle approval</option><option>Driver approval</option><option>Order support</option><option>General support</option></select></label><label>Order ID (optional)<input value={orderId} onChange={event => setOrderId(event.target.value)} placeholder="Order ID" /></label><label>Subject<input value={subject} onChange={event => setSubject(event.target.value)} required /></label><label>Message<textarea value={message} onChange={event => setMessage(event.target.value)} rows={5} required /></label><div className="heading-actions"><Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send request'}</Button></div></form></section></div>}
    </>;
}

function VendorBookingView({ onNotify }: { onNotify: (message: string) => void }) {
    return <>
        <PageHeader eyebrow="Vendor workspace" title="Vendor bookings" copy="Vendor accounts receive assignments from dispatch rather than creating customer bookings." />
        <section className="data-surface support-surface"><h2>Ready for assignments</h2><p>Return to Overview to manage availability and accept the next assigned order.</p><Button variant="quiet" icon={Check} onClick={() => onNotify("Bookings are assigned by dispatch")}>View dispatch status</Button></section>
    </>;
}
