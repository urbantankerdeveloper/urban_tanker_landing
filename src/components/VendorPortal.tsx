import {
    Check,
    IndianRupee,
    MapPin,
    Navigation,
    Package,
    Phone,
    ShieldCheck,
} from "lucide-react";
import type { AppData, Order, OrderStatus } from "../types";
import { Button, PageHeader, StatCard, Status } from "./ui";
import { money } from "../data/demo";
import { useAppStore } from "../store";
import { getVendorAvailability, setVendorAvailability } from "../cloudStore";
import { useEffect, useState } from "react";

const stages: OrderStatus[] = [
    "Vendor assigned",
    "Vendor accepted",
    "En route",
    "Arrived",
    "Delivered",
];
const vendorOrder = (data: AppData) =>
    data.orders.find(
        (item) =>
            item.status !== "Delivered" &&
            (item.vendor === data.profile?.name ||
                item.assignedVendorUid === data.profile?.phone),
    );
export function VendorPortal() {
    const {
        data,
        vendorStage: stage,
        setVendorStage: setStage,
        updateOrder: onUpdate,
        notify: onNotify,
    } = useAppStore();
    const [available, setAvailable] = useState(true);
    const [availabilityBusy, setAvailabilityBusy] = useState(false);
    useEffect(() => {
        getVendorAvailability().then(setAvailable).catch(() => undefined);
    }, []);
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
    const order = vendorOrder(data);
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
        const next = stages[Math.min(index + 1, stages.length - 1)];
        setStage(next);
        const location = next === "Vendor accepted" ? await readCurrentLocation() : {};
        if (order)
            onUpdate({
                ...order,
                status: next,
                eta: next === "Delivered" ? "Delivered" : order.eta,
                vendorPhone: data.profile?.phone,
                vendorLatitude: location.latitude,
                vendorLongitude: location.longitude,
            });
        onNotify(
            next === "Delivered"
                ? "Delivery completed with OTP verification."
                : `Order updated: ${next}`,
        );
    };
    return (
        <>
            <PageHeader
                eyebrow="Vendor portal · BlueDrop Tankers"
                title="Keep every delivery moving."
                copy="Accept new bookings quickly, keep the customer updated, and complete delivery with their OTP."
                action={
                    <div className="heading-actions">
                        <Button variant={available ? "primary" : "quiet"} icon={available ? Check : ShieldCheck} onClick={() => void toggleAvailability()} disabled={availabilityBusy}>
                            {availabilityBusy ? "Updating..." : available ? "Available for bookings" : "Unavailable for bookings"}
                        </Button>
                        <Button variant="quiet" icon={Navigation} onClick={() => onNotify("Live location sharing enabled for this active job")}>Share location</Button>
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
                    value="8"
                    detail="2 remaining"
                />
                <StatCard
                    icon={Check}
                    label="Completed"
                    value="6"
                    detail="75% completion rate"
                    tone="highlight"
                />
                <StatCard
                    icon={IndianRupee}
                    label="Estimated earnings"
                    value="₹9,840"
                    detail="This week"
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
                                >
                                    {stage === "Arrived"
                                        ? "Complete with OTP"
                                        : stage === "Delivered"
                                            ? "Completed"
                                            : `Mark ${stages[index + 1]}`}
                                </Button>
                            </div>
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
