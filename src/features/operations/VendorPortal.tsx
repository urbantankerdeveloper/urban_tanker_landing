import {
    Check,
    IndianRupee,
    MapPin,
    Navigation,
    Package,
    Phone,
    ShieldCheck,
} from "lucide-react";
import type { AppData, Order, OrderStatus, Workspace } from "../../shared/lib/types";
import { Button, PageHeader, StatCard, Status } from "../../shared/components/ui";
import { money } from "../../shared/data/demo";
import { useAppStore } from "../../app/store";
import { getVendorAvailability, loadVendorDashboard, setVendorAvailability, updateVendorLocation, updateVendorOrder } from "../../shared/lib/cloudStore";
import { useEffect, useState } from "react";

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
    const [operationBusy, setOperationBusy] = useState(false);
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                updateVendorLocation(position.coords.latitude, position.coords.longitude).catch(() => undefined);
            }, () => undefined, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
        }
        void loadVendorDashboard().then(result => {


6            setAvailable(result.vendor?.status === "active" || result.vendor?.available === true);
            setVendorName(result.vendor?.name || data.profile?.name || "Vendor");
            setVendorOrders(result.orders || []);
            useAppStore.setState(state => ({ data: { ...state.data, orders: result.orders || [] } }));
            const activeOrder = (result.orders || []).find(item => item.status !== "Delivered");
            if (activeOrder && stages.includes(activeOrder.status)) setStage(activeOrder.status);
        }).catch(() => {
            getVendorAvailability().then(setAvailable).catch(() => undefined);
        });
    }, [data.profile?.name]);
    const toggleAvailability = async () => {
        if (availabilityBusy) return;
        const next = !available;
        setAvailabilityBusy(true);
        try {
            await setVendorAvailability(next);
            setAvailable(next);
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
                const accepted = { ...order, status: "Accepted" as OrderStatus, vendorDecision: "accepted" as const };
                await updateVendorOrder(accepted, { action: "accept" });
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
                await updateVendorOrder(completed, { deliveryOtp: otp });
                onUpdate(completed);
                setVendorOrders(current => current.map(item => item.id === completed.id ? completed : item));
                setStage("Delivered");
                setOtp("");
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
        if (view === "track") return <VendorTrackingView order={activeOrder} />;
        if (view === "support") return <VendorSupportView onNotify={onNotify} />;
        return <VendorBookingView onNotify={onNotify} />;
    }
    return (
        <>
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
                                    onClick={() => onNotify("Calling customer...")}
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
                            {stage === "Arrived" && <label className="vendor-otp-field">Delivery OTP<input inputMode="numeric" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Enter 6-digit OTP" /></label>}
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

function VendorOrdersView({ orders }: { orders: AppData["orders"] }) {
    return <>
        <PageHeader eyebrow="Vendor workspace · Orders" title="Your assigned orders." copy="Review active and completed jobs assigned to your vendor account." />
        <div className="order-list">
            {orders.length ? orders.map(order => <article className="order-row" key={order.id}>
                <div className="order-service-icon"><Package size={19} /></div>
                <div className="order-main"><div><b>{order.service}</b><Status>{order.status}</Status></div><span>{order.id} · {order.capacity} · {order.address}</span><small>{order.customer}</small></div>
                <div className="order-amount"><strong>{money(order.amount)}</strong><span>{order.payment}</span></div>
            </article>) : <div className="empty-state"><Package size={28} /><h3>No assigned orders</h3><p>New assignments will appear here when dispatch assigns a job.</p></div>}
        </div>
    </>;
}

function VendorTrackingView({ order }: { order?: Order }) {
    return <>
        <PageHeader eyebrow="Vendor workspace · Live tracking" title="Share the journey." copy="Your latest location is visible to the customer while the active job is in progress." />
        <section className="tracking-surface">
            {order ? <><div className="section-heading"><div><span className="eyebrow">Active job</span><h2>{order.service} · {order.id}</h2><p>{order.address}</p></div><Status>{order.status}</Status></div><div className="tracking-details"><div><span>Customer</span><b>{order.customer}</b></div><div><span>Last location</span><b>{typeof order.vendorLatitude === "number" ? `${order.vendorLatitude.toFixed(4)}, ${order.vendorLongitude?.toFixed(4)}` : "Not shared yet"}</b></div><div><span>ETA</span><b>{order.eta}</b></div></div></> : <div className="empty-state"><Navigation size={28} /><h3>No active delivery</h3><p>Accept an order to start sharing your location.</p></div>}
        </section>
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
