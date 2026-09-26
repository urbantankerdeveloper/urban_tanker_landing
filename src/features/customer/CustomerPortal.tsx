import { Activity, ArrowRight, CalendarDays, Check, Clock3, Droplets, IndianRupee, MapPin, MessageSquare, Package, Phone, Plus, RefreshCcw, ShieldCheck, Truck, X } from 'lucide-react';
import { money } from '../../shared/data/demo';
import type { AppData, BookingDraft, Order, SavedAddress, Workspace } from '../../shared/lib/types';
import { useAppStore } from '../../app/store';
import { cancelCustomerOrder, createCustomerSubscription, createSavedAddress, createSupportRequest, deleteSavedAddress, loadCustomerInvoices, loadCustomerOrders, loadCustomerSubscriptions, loadSavedAddresses, rateCustomerOrder, rescheduleCustomerOrder, updateSavedAddress } from '../../shared/lib/cloudStore';
import { Button, PageHeader, StatCard, Status } from '../../shared/components/ui';
import { Pagination } from '../../shared/components/Pagination';
import { LiveMapModal } from '../../shared/components/LiveMapModal';
import { WorkspaceSkeleton } from '../../shared/components/LoadingSkeleton';
import { CustomerLanding } from './CustomerLanding';
import { AddressVerificationModal } from '../checkout/AddressVerificationModal';
import { MapSelector } from '../checkout/MapSelector';
import { useEffect, useState, type FormEvent } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../../shared/lib/apiConfig';
import { getAuthToken } from '../../features/auth/auth';
import { withRetry, STANDARD_OPERATION_RETRY } from '../../shared/lib/retryUtils';
import { useRequestDedup } from '../../shared/hooks/useRequestDedup';

const prices: Record<string, number> = { '3 KL': 800, '6 KL': 1250, '9 KL': 1750, '12 KL': 2400, '16 KL': 3100 };
const sewagePrices: Record<string, number> = { '3 KL': 1800, '6 KL': 2300, '9 KL': 2900, '12 KL': 3600, '16 KL': 4400 };

export function CustomerPortal() {
  const { data, active, setActive: onNavigate, notify: onNotify, bookingDraft: booking, setBookingDraft: set, setCheckoutOpen, update } = useAppStore();
  const [acceptedOrder, setAcceptedOrder] = useState<{ orderId: string; vendorName: string } | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [addressForVerification, setAddressForVerification] = useState<SavedAddress | null>(null);

  // Request deduplication hooks for order operations
  const cancelDedup = useRequestDedup({ operationType: 'cancel_order' });
  const rescheduleDedup = useRequestDedup({ operationType: 'reschedule_order' });
  const rateDedup = useRequestDedup({ operationType: 'rate_order' });

  useEffect(() => {
    void loadCustomerOrders().then(orders => {
      useAppStore.setState(state => ({ data: { ...state.data, orders } }));
    }).catch(() => undefined).finally(() => setOrdersLoading(false));
  }, []);
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return undefined;
    const socket = io(API_BASE_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    const handleAccepted = (event: { orderId: string; vendorName: string }) => {
      setAcceptedOrder(event);
      void loadCustomerOrders().then(orders => useAppStore.setState(state => ({ data: { ...state.data, orders } }))).catch(() => undefined);
    };
    socket.on('order:accepted', handleAccepted);
    return () => { socket.disconnect(); };
  }, []);
  const activeOrder = data.orders.find(order => order.status !== 'Delivered');
  const lastCompletedOrder = data.orders.find(order => order.status === 'Delivered');
  
  const bookAgain = () => {
    if (!lastCompletedOrder) {
      onNotify('No previous order found');
      return;
    }
    set('service', lastCompletedOrder.service as BookingDraft['service']);
    set('capacity', lastCompletedOrder.capacity as BookingDraft['capacity']);
    set('address', lastCompletedOrder.address);
    onNavigate('book');
  };

  const submitBooking = () => {
    // First try to load from backend, fallback to localStorage
    const checkAndProceed = async () => {
      try {
        // Try to get saved addresses from backend
        let savedAddresses: SavedAddress[] = [];
        try {
          savedAddresses = await loadSavedAddresses();
        } catch {
          // Fallback to localStorage if backend fails
          const stored = localStorage.getItem('urban-tanker-saved-addresses');
          savedAddresses = stored ? JSON.parse(stored) : [];
        }
        
        const selectedAddressRecord = savedAddresses.find(a => a.address === booking.address);
        
        if (!selectedAddressRecord) {
          onNotify('Address not found. Please select a saved address.');
          return;
        }
        
        // If address doesn't have coordinates, show verification modal
        if (!selectedAddressRecord.latitude || !selectedAddressRecord.longitude) {
          setAddressForVerification(selectedAddressRecord);
          setVerificationModalOpen(true);
          return;
        }
        
        // Address has geolocation, proceed with booking
        const priceList = booking.service === 'Sewage pickup' ? sewagePrices : prices;
        const amount = priceList[booking.capacity] ?? 0;
        update({ booking, pendingBooking: { ...booking, amount } });
        setCheckoutOpen(true);
      } catch (error) {
        onNotify('Unable to verify address. Please try again.');
      }
    };
    
    void checkAndProceed();
  };

  const handleLocationCaptured = (updatedAddress: SavedAddress) => {
    setVerificationModalOpen(false);
    onNotify('Location captured successfully');
    
    // Proceed with booking
    const priceList = booking.service === 'Sewage pickup' ? sewagePrices : prices;
    const amount = priceList[booking.capacity] ?? 0;
    update({ booking, pendingBooking: { ...booking, amount } });
    setCheckoutOpen(true);
  };

  const handleContinueWithoutLocation = () => {
    setVerificationModalOpen(false);
    onNotify('Proceeding without precise location. Delivery time may vary.');
    
    // Proceed with booking without location
    const priceList = booking.service === 'Sewage pickup' ? sewagePrices : prices;
    const amount = priceList[booking.capacity] ?? 0;
    update({ booking, pendingBooking: { ...booking, amount } });
    setCheckoutOpen(true);
  };
  const cancelOrder = async (orderId: string) => {
    const key = cancelDedup.startRequest();
    if (!key) {
      onNotify('A cancel request is already in progress. Please wait.');
      return;
    }

    try {
      // Cancel order with retry logic
      await withRetry(
        () => cancelCustomerOrder(orderId, 'Cancelled from customer portal.'),
        STANDARD_OPERATION_RETRY
      );
      // Reload orders with retry
      const orders = await withRetry(
        () => loadCustomerOrders(),
        STANDARD_OPERATION_RETRY
      );
      useAppStore.setState(state => ({ data: { ...state.data, orders } }));
      onNotify('Order cancelled successfully.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to cancel the order.');
    } finally {
      cancelDedup.completeOperation();
    }
  };

  const rescheduleOrder = async (orderId: string, scheduledDate: string, scheduledSlot: string) => {
    const key = rescheduleDedup.startRequest();
    if (!key) {
      onNotify('A reschedule request is already in progress. Please wait.');
      return;
    }

    try {
      // Reschedule order with retry logic
      await withRetry(
        () => rescheduleCustomerOrder(orderId, scheduledDate, scheduledSlot),
        STANDARD_OPERATION_RETRY
      );
      // Reload orders with retry
      const orders = await withRetry(
        () => loadCustomerOrders(),
        STANDARD_OPERATION_RETRY
      );
      useAppStore.setState(state => ({ data: { ...state.data, orders } }));
      onNotify('Order rescheduled successfully.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to reschedule the order.');
    } finally {
      rescheduleDedup.completeOperation();
    }
  };

  const rateOrder = async (orderId: string) => {
    const key = rateDedup.startRequest();
    if (!key) {
      onNotify('A rating operation is already in progress. Please wait.');
      return;
    }

    const rating = Number(window.prompt('Rate this delivery from 1 to 5:'));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      rateDedup.completeOperation();
      return;
    }
    const feedback = window.prompt('Optional feedback:') || '';
    try {
      // Rate order with retry logic
      await withRetry(
        () => rateCustomerOrder(orderId, rating, feedback),
        STANDARD_OPERATION_RETRY
      );
      // Reload orders with retry
      const orders = await withRetry(
        () => loadCustomerOrders(),
        STANDARD_OPERATION_RETRY
      );
      useAppStore.setState(state => ({ data: { ...state.data, orders } }));
      onNotify('Thank you for your feedback.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to save feedback.');
    } finally {
      rateDedup.completeOperation();
    }
  };
  if (ordersLoading) return <WorkspaceSkeleton role="customer" />;
  const selectServiceAndBook = (service: BookingDraft['service']) => { set('service', service); onNavigate('book'); };
  const content = active === 'offers' ? <OffersPage onSelectService={selectServiceAndBook} /> : active === 'book' ? <BookingFormWithSavedAddresses booking={booking} set={set} onSubmit={submitBooking} /> : active === 'addresses' ? <SavedAddressesView /> : active === 'orders' ? <OrdersView orders={data.orders} onCancel={cancelOrder} onReschedule={rescheduleOrder} onRate={rateOrder} /> : active === 'track' ? <TrackingView order={activeOrder} /> : active === 'subscriptions' ? <SubscriptionsView onNotify={onNotify} /> : active === 'invoices' ? <InvoiceHistoryView onNotify={onNotify} /> : active === 'support' ? <SupportView data={data} onNotify={onNotify} /> : <CustomerLanding order={activeOrder} data={data} onNavigate={onNavigate} onSelectService={selectServiceAndBook} onBookAgain={bookAgain} />;
  return <>{content}{active === 'orders' && <DeliveryProofGallery orders={data.orders} />}{acceptedOrder && <CustomerAcceptanceModal orderId={acceptedOrder.orderId} vendorName={acceptedOrder.vendorName} onClose={() => setAcceptedOrder(null)} onTrack={() => { setAcceptedOrder(null); onNavigate('track'); }} />}{verificationModalOpen && addressForVerification && <AddressVerificationModal address={addressForVerification} onClose={() => setVerificationModalOpen(false)} onLocationCaptured={handleLocationCaptured} onContinueWithoutLocation={handleContinueWithoutLocation} />}</>;
}

function SubscriptionsView({ onNotify }: { onNotify: (message: string) => void }) {
  const [subscriptions, setSubscriptions] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({ service: 'Water tanker', capacity: '6 KL', frequency: 'monthly', nextDelivery: new Date().toISOString().slice(0, 10) });
  const subscriptionDedup = useRequestDedup({ operationType: 'create_subscription' });
  
  const refresh = () => void loadCustomerSubscriptions().then(setSubscriptions).catch(error => onNotify(error instanceof Error ? error.message : 'Unable to load subscriptions.'));
  useEffect(() => { void loadCustomerSubscriptions().then(setSubscriptions).catch(error => onNotify(error instanceof Error ? error.message : 'Unable to load subscriptions.')); }, [onNotify]);
  
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const key = subscriptionDedup.startRequest();
    if (!key) {
      onNotify('A subscription creation request is already in progress. Please wait.');
      return;
    }

    try {
      // Create subscription with retry logic
      await withRetry(
        () => createCustomerSubscription(form),
        STANDARD_OPERATION_RETRY
      );
      refresh();
      onNotify('Recurring delivery subscription created.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to create subscription.');
    } finally {
      subscriptionDedup.completeOperation();
    }
  };
  return <><PageHeader eyebrow="Customer workspace · Subscriptions" title="Keep your deliveries regular." copy="Schedule recurring tanker services for homes, sites, and facilities." /><section className="data-surface subscription-form"><form className="auth-form" onSubmit={create}><div className="field-row"><label>Service<select value={form.service} onChange={event => setForm({ ...form, service: event.target.value })}><option>Water tanker</option><option>Sewage pickup</option></select></label><label>Capacity<select value={form.capacity} onChange={event => setForm({ ...form, capacity: event.target.value })}><option>3 KL</option><option>6 KL</option><option>9 KL</option><option>12 KL</option></select></label></div><div className="field-row"><label>Frequency<select value={form.frequency} onChange={event => setForm({ ...form, frequency: event.target.value })}><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="monthly">Monthly</option></select></label><label>Next delivery<input type="date" min={new Date().toISOString().slice(0, 10)} value={form.nextDelivery} onChange={event => setForm({ ...form, nextDelivery: event.target.value })} required /></label></div><Button variant="primary" type="submit" disabled={subscriptionDedup.isLoading}>
  {subscriptionDedup.isLoading ? 'Creating...' : 'Create subscription'}
</Button></form></section><section className="data-surface subscription-list"><div className="section-heading"><div><span className="eyebrow">Your recurring services</span><h2>{subscriptions.length} subscriptions</h2></div></div>{subscriptions.length ? subscriptions.map(subscription => <article className="order-row" key={String(subscription.id)}><div className="order-service-icon"><RefreshCcw size={19} /></div><div className="order-main"><div><b>{String(subscription.service)}</b><Status>{String(subscription.status)}</Status></div><span>{String(subscription.capacity)} · {String(subscription.frequency)}</span><small>Next delivery: {String(subscription.next_delivery)}</small></div></article>) : <div className="empty-state"><RefreshCcw size={28} /><h3>No subscriptions yet</h3><p>Create a recurring delivery schedule above.</p></div>}</section></>;
}

function InvoiceHistoryView({ onNotify }: { onNotify: (message: string) => void }) {
  const [invoices, setInvoices] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => { void loadCustomerInvoices().then(setInvoices).catch(error => onNotify(error instanceof Error ? error.message : 'Unable to load invoices.')); }, [onNotify]);
  return <><PageHeader eyebrow="Customer workspace · Payments" title="Invoices and payment history." copy="Keep a clear record of every Urban Tanker booking and refund." /><section className="data-surface"><div className="section-heading"><div><span className="eyebrow">Payment history</span><h2>{invoices.length} invoices</h2></div></div>{invoices.length ? <div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Order</th><th>Amount</th><th>Status</th><th>Issued</th></tr></thead><tbody>{invoices.map(invoice => <tr key={String(invoice.id)}><td><b className="mono">{String(invoice.id)}</b></td><td>{String(invoice.order_id)}</td><td><b>{money(Number(invoice.amount || 0))}</b></td><td><Status>{String(invoice.status)}</Status></td><td>{invoice.created_at ? new Date(String(invoice.created_at)).toLocaleDateString('en-IN') : '—'}</td></tr>)}</tbody></table></div> : <div className="empty-state"><IndianRupee size={28} /><h3>No invoices yet</h3><p>Invoices will appear after your bookings are created.</p></div>}</section></>;
}

function CustomerAcceptanceModal({ orderId, vendorName, onClose, onTrack }: { orderId: string; vendorName: string; onClose: () => void; onTrack: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="customer-acceptance-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Close order acceptance notification">×</button><span className="eyebrow">Vendor update</span><h2 id="customer-acceptance-title">Your order was accepted.</h2><p className="modal-copy">{vendorName} has accepted order <b className="mono">{orderId}</b>. Your delivery is now being prepared.</p><div className="heading-actions"><Button variant="quiet" onClick={onClose}>Close</Button><Button variant="primary" icon={Truck} onClick={onTrack}>Track order</Button></div></section></div>;
}

function DeliveryProofGallery({ orders }: { orders: Order[] }) {
  const [selectedProof, setSelectedProof] = useState<Order | null>(null);
  const proofs = orders.filter(order => order.status === 'Delivered' && order.deliveryProofUrl);
  if (!proofs.length) return null;
  return <section className="data-surface delivery-proof-gallery"><div className="section-heading"><div><span className="eyebrow">Completed delivery proof</span><h2>Your delivery records</h2></div></div><div className="delivery-proof-grid">{proofs.map(order => <button type="button" key={order.id} onClick={() => setSelectedProof(order)}><img src={order.deliveryProofUrl} alt={`Delivery proof for ${order.id}`} /><span><b>{order.id}</b><small>{order.service} · {order.created}</small></span></button>)}</div>{selectedProof && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setSelectedProof(null)}><section className="modal delivery-proof-modal" role="dialog" aria-modal="true" aria-label="Delivery proof"><button className="modal-close" type="button" onClick={() => setSelectedProof(null)} aria-label="Close delivery proof">×</button><span className="eyebrow">Delivery proof · {selectedProof.id}</span><img src={selectedProof.deliveryProofUrl} alt={`Delivery proof for ${selectedProof.id}`} /><div className="heading-actions"><Button variant="primary" onClick={() => setSelectedProof(null)}>Close</Button></div></section></div>}</section>;
}

function BookingFormWithSavedAddresses({ booking, set, onSubmit }: { booking: BookingDraft; set: <K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) => void; onSubmit: () => void }) {
  const [addresses] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('urban-tanker-addresses') || '[]');
    } catch {
      return [];
    }
  });
  const [addressModalOpen, setAddressModalOpen] = useState(false);

  const selectAddress = (address: string) => {
    set('address', address);
    setAddressModalOpen(false);
  };

  return <>
    <PageHeader eyebrow="New booking" title="Plan your delivery in minutes." copy="Tell us what you need. We will surface the clearest available price before payment." />
    <div className="booking-with-addresses">
      <BookingFormContent booking={booking} set={set} onSubmit={onSubmit} addresses={addresses} onOpenAddressModal={() => setAddressModalOpen(true)} />
    </div>
    {addressModalOpen && (
      <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setAddressModalOpen(false)}>
        <section className="modal saved-addresses-modal" role="dialog" aria-modal="true" aria-labelledby="saved-addresses-title">
          <button className="modal-close" type="button" onClick={() => setAddressModalOpen(false)} aria-label="Close saved addresses">×</button>
          <span className="eyebrow">Saved Addresses</span>
          <h2 id="saved-addresses-title">Select a delivery location</h2>
          <div className="addresses-modal-list">
            {addresses.length ? (
              addresses.map(address => (
                <button 
                  key={address} 
                  type="button" 
                  className="address-modal-item"
                  onClick={() => selectAddress(address)}
                >
                  <MapPin size={18} />
                  <div>
                    <span>{address}</span>
                  </div>
                  <ArrowRight size={16} />
                </button>
              ))
            ) : (
              <div className="empty-msg">No saved addresses yet. Save addresses during checkout.</div>
            )}
          </div>
          <div className="heading-actions">
            <Button variant="quiet" onClick={() => setAddressModalOpen(false)}>Cancel</Button>
          </div>
        </section>
      </div>
    )}
  </>;
}

// Legacy overview composition retained for future customer dashboard expansion.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CustomerOverview({ order, data, onNavigate }: { order?: Order; data: AppData; onNavigate: (workspace: Workspace) => void }) {
  return <><PageHeader eyebrow="Customer workspace · ECR, Chennai" title={<>Water arrives when you <em>need it.</em></>} copy="Book verified water or sewage services, choose a slot, and follow every delivery from one calm workspace." action={<Button variant="primary" icon={Plus} onClick={() => onNavigate('book')}>New booking</Button>} /><section className="hero-grid"><article className="welcome-panel"><div><span className="eyebrow">Your next delivery</span><h2>{order?.service ?? 'Ready when you are'}</h2><p>{order?.address ?? 'Choose a service and we will match you with a nearby verified tanker.'}</p>{order && <div className="hero-meta"><Status>{order.status}</Status><span><Clock3 size={14} /> ETA {order.eta}</span></div>}</div><div className="route-illustration" aria-label="Illustrated route from tanker to your address"><div className="route-track" /><div className="route-pin pin-start"><Truck size={14} /></div><div className="route-pin pin-end"><MapPin size={14} /></div><div className="route-tanker"><Truck size={21} /></div></div></article><div className="quick-stack"><button onClick={() => onNavigate('book')}><span className="quick-icon aqua"><Droplets size={18} /></span><span><b>Book water tanker</b><small>Potable, domestic or borewell</small></span><ArrowRight size={17} /></button><button onClick={() => onNavigate('book')}><span className="quick-icon green"><Activity size={18} /></span><span><b>Book sewage tanker</b><small>Septic tank and waste removal</small></span><ArrowRight size={17} /></button><button className="dark-quick" onClick={() => onNavigate('orders')}><span className="quick-icon gold"><RefreshCcw size={18} /></span><span><b>Book again</b><small>Last order · 12 KL water tanker</small></span><ArrowRight size={17} /></button></div></section><section className="stats-grid" aria-label="Customer summary"><StatCard icon={Package} label="Total bookings" value={data.orders.length} detail="2 this month" /><StatCard icon={Truck} label="Active delivery" value={order?.eta ?? 'None'} detail={order?.vendor ?? 'Book a service'} tone="highlight" /><StatCard icon={WalletIcon} label="Total spent" value={money(data.orders.reduce((sum, item) => sum + item.amount, 0))} detail="Across all services" /><StatCard icon={ShieldCheck} label="Trust score" value="4.9 / 5" detail="Verified network" /></section><TrackingView order={order} compact /></>;
}
function WalletIcon() { return <IndianRupee size={17} />; }

function downloadInvoice(order: Order) {
  const invoice = [`Urban Tanker invoice`, `Order: ${order.id}`, `Service: ${order.service}`, `Capacity: ${order.capacity}`, `Customer: ${order.customer}`, `Address: ${order.address}`, `Amount: ${money(order.amount)}`, `Payment: ${order.payment}`, `Status: ${order.status}`, `Created: ${order.created}`].join('\n');
  const url = URL.createObjectURL(new Blob([invoice], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `urban-tanker-invoice-${order.id}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function BookingFormContent({ booking, set, onSubmit, addresses, onOpenAddressModal }: { booking: BookingDraft; set: <K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) => void; onSubmit: () => void; addresses: string[]; onOpenAddressModal: () => void }) {
  const options = booking.service === 'Water tanker' ? ['Drinking / potable', 'Domestic', 'Borewell', 'Other'] : ['Septic tank cleaning', 'Sewage removal', 'Drain cleaning'];
  const priceList = booking.service === 'Sewage pickup' ? sewagePrices : prices;
  
  return <>
    <form className="form-surface" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
      <div className="form-step"><span>01</span><div><h3>Choose your service</h3><p>We match capacity and vehicle type to your request.</p></div></div>
      <div className="choice-grid two">
        {(['Water tanker', 'Sewage pickup'] as BookingDraft['service'][]).map(service => (
          <button type="button" className={booking.service === service ? 'selected' : ''} onClick={() => set('service', service)} key={service}>
            <Droplets size={22} /><b>{service}</b><small>{service === 'Water tanker' ? 'For homes, offices and sites' : 'Septic and wastewater removal'}</small>
          </button>
        ))}
      </div>
      
      <div className="form-step"><span>02</span><div><h3>{booking.service === 'Water tanker' ? 'Water type' : 'Service requirement'}</h3><p>Help your driver arrive prepared.</p></div></div>
      <div className="pill-row" role="group" aria-label="Service detail">
        {options.map(option => (
          <button type="button" className={booking.waterType === option ? 'selected' : ''} onClick={() => set('waterType', option)} key={option}>
            {option}
          </button>
        ))}
      </div>
      
      <div className="form-step"><span>03</span><div><h3>Capacity and timing</h3><p>Select the right size for your location.</p></div></div>
      <div className="capacity-row" role="group" aria-label="Tanker capacity">
        {Object.keys(prices).map(capacity => (
          <button type="button" className={booking.capacity === capacity ? 'selected' : ''} onClick={() => set('capacity', capacity)} key={capacity}>
            <b>{capacity}</b>
            {booking.capacity === capacity && <small>{money(priceList[capacity] ?? 0)}</small>}
          </button>
        ))}
      </div>

      <div className="form-step"><span>04</span><div><h3>Schedule and location</h3><p>When and where do you need this?</p></div></div>
      <div className="field-row">
        <label>Delivery date<input type="date" min={new Date().toISOString().slice(0, 10)} value={booking.date} onChange={event => set('date', event.target.value)} required /></label>
        <label>Delivery slot<select value={booking.slot} onChange={event => set('slot', event.target.value)}><option>As soon as possible</option><option>Morning · 7 AM – 11 AM</option><option>Afternoon · 12 PM – 4 PM</option><option>Evening · 5 PM – 9 PM</option></select></label>
      </div>

      <div className="form-step"><span>05</span><div><h3>Delivery address</h3><p>Where should we deliver?</p></div></div>
      <div className="field-row">
        <label>Address<textarea value={booking.address} onChange={event => set('address', event.target.value)} placeholder="Building, street, area" rows={5} required /></label>
      </div>
      {addresses.length > 0 && <div className="address-form-actions">
        <Button variant="quiet" icon={MapPin} onClick={onOpenAddressModal}>Use saved address</Button>
      </div>}
      
      <div className="form-step"><span>06</span><div><h3>Additional details</h3><p>Help us serve you better.</p></div></div>
      <div className="field-row">
        <label>Landmark<input type="text" value={booking.landmark} onChange={event => set('landmark', event.target.value)} placeholder="e.g., Near bus stop, opposite temple" /></label>
        <label>Special notes<textarea value={booking.notes} onChange={event => set('notes', event.target.value)} placeholder="Access details" rows={2} /></label>
      </div>

      <Button type="submit" variant="primary full" icon={ArrowRight}>Continue to payment</Button>
    </form>
  </>;
}

export function TrackingView(props: { order?: Order; compact?: boolean }) { const [mapOpen, setMapOpen] = useState(false); const orders = useAppStore(state => state.data.orders); return <><TrackingViewContent {...props} onOpenMap={() => setMapOpen(true)} /><CustomerOtpNotice order={props.order} /><CustomerOrderLifecycle orders={orders} />{mapOpen && props.order && <LiveMapModal order={props.order} onClose={() => setMapOpen(false)} />}</>; }

function CustomerOtpNotice({ order }: { order?: Order }) { if (!order?.customerDeliveryOtp) return null; return <section className="data-surface customer-otp-notice"><span className="eyebrow">Private delivery OTP</span><h3>{order.customerDeliveryOtp}</h3><p>Share this code with the vendor only when the delivery is complete.</p></section>; }

function CustomerOrderLifecycle({ orders }: { orders: Order[] }) {
  const groups = [
    { label: 'Pending acceptance', statuses: ['Created', 'Pending acceptance', 'Vendor assigned'] },
    { label: 'Accepted / in progress', statuses: ['Accepted', 'Vendor accepted', 'En route', 'Arrived'] },
    { label: 'Delivered', statuses: ['Delivered'] },
    { label: 'Rejected', statuses: ['Rejected', 'Vendor rejected'] },
  ];
  return <section className="data-surface customer-order-lifecycle" aria-label="Order status history"><div className="section-heading"><div><span className="eyebrow">Order history</span><h2>Your booking statuses</h2></div></div><div className="table-scroll"><table><thead><tr><th>Order</th><th>Service</th><th>Amount</th><th>Status</th><th>Vendor</th></tr></thead><tbody>{groups.flatMap(group => orders.filter(order => group.statuses.includes(order.status)).map(order => <tr key={`${group.label}-${order.id}`}><td><b className="mono">{order.id}</b><small>{order.created}</small></td><td>{order.service}<small>{order.capacity}</small></td><td><b>{money(order.amount)}</b></td><td><Status>{group.label}</Status></td><td>{order.vendor || 'Pending assignment'}</td></tr>))}{!orders.length && <tr><td colSpan={5}>No orders have been created yet.</td></tr>}</tbody></table></div></section>;
}

function TrackingViewContent({ order, compact = false, onOpenMap }: { order?: Order; compact?: boolean; onOpenMap: () => void }) { return <section className={`tracking-surface ${compact ? 'compact' : ''}`} style={{ marginBottom: '40px' }} aria-labelledby="tracking-title"><div className="section-heading"><div><span className="eyebrow">Stay in the loop</span><h2 id="tracking-title">{order ? 'Your tanker is on the way.' : 'Track every delivery.'}</h2><p>{order ? `${order.id} · ${order.service} · ${order.capacity}` : 'Your next delivery and live updates will appear here.'}</p></div>{order && <Status>{order.status}</Status>}</div>{order ? <><div className="tracking-map" aria-label="Illustrated live route map"><div className="map-grid" /><div className="map-route" /><div className="map-marker start"><Truck size={15} /></div><div className="map-marker finish"><MapPin size={15} /></div><div className="map-vehicle"><Truck size={18} /></div><span className="map-label label-start">Vehicle · {order.eta}</span><span className="map-label label-finish">You</span></div><div className="tracking-details"><div><span>Driver</span><b>{order.driver || 'Assigned driver'}</b><small>{order.vendor || 'Vendor assignment pending'}</small></div><div><span>Vehicle</span><b>{order.vendor || 'Assignment pending'}</b><small>Vendor details will appear after assignment</small></div><div><span>Handover code</span><b>••••••</b><small>Visible at arrival</small></div><Button variant="quiet" icon={MapPin} onClick={onOpenMap}>Open live map</Button></div><ol className="timeline"><li className="done"><span><Check size={13} /></span><div><b>Booking confirmed</b><small>{order.created}</small></div></li><li className="done"><span><Check size={13} /></span><div><b>Vendor assigned</b><small>{order.vendor || 'Waiting for vendor assignment'}</small></div></li><li className="current"><span><Truck size={13} /></span><div><b>En route to you</b><small>Your driver is {order.eta} away</small></div></li><li><span>4</span><div><b>Delivered</b><small>Share OTP only after service is complete</small></div></li></ol></> : <div className="empty-state"><MapPin size={28} /><h3>No active booking yet</h3><p>Your next delivery and live updates will appear here.</p></div>}</section>; }
function OrdersView({ orders, onCancel, onReschedule, onRate }: { orders: Order[]; onCancel: (orderId: string) => Promise<void>; onReschedule: (orderId: string, date: string, slot: string) => Promise<void>; onRate: (orderId: string) => Promise<void> }) {
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered'>('all');
  const [page, setPage] = useState(1);
  const [rescheduleOrderId, setRescheduleOrderId] = useState<string | null>(null);
  const activeOrders = orders.filter(order => !['Delivered', 'Rejected', 'Vendor rejected', 'Cancelled'].includes(order.status));
  const deliveredOrders = orders.filter(order => order.status === 'Delivered');
  const visibleOrders = filter === 'active' ? activeOrders : filter === 'delivered' ? deliveredOrders : orders;
  const pagedOrders = visibleOrders.slice((page - 1) * 10, page * 10);
  const tabs = [
    { id: 'all' as const, label: 'All orders', count: orders.length },
    { id: 'active' as const, label: 'Active', count: activeOrders.length },
    { id: 'delivered' as const, label: 'Delivered', count: deliveredOrders.length }
  ];
  return <><PageHeader eyebrow="Booking history" title="Your orders, together." copy="Active, upcoming, and completed water and wastewater services." action={<Button variant="quiet" icon={CalendarDays}>All time</Button>} /><div className="filter-tabs" role="tablist" aria-label="Order filters">{tabs.map(tab => <button className={filter === tab.id ? 'active' : ''} role="tab" aria-selected={filter === tab.id} onClick={() => { setFilter(tab.id); setPage(1); }} key={tab.id}>{tab.label} <b>{tab.count}</b></button>)}</div><div className="order-list">{visibleOrders.length ? pagedOrders.map(order => { const canManage = ['Created', 'Pending acceptance', 'Vendor assigned'].includes(order.status); return <article className="order-row" key={order.id}><div className="order-service-icon"><Droplets size={19} /></div><div className="order-main"><div><b>{order.service}</b><Status>{order.status}</Status></div><span>{order.id} · {order.capacity} · {order.address}</span><small>{order.created}{order.scheduledDate ? ` · ${order.scheduledDate} · ${order.scheduledSlot || 'Scheduled'}` : ''}</small></div><div className="order-amount"><strong>{money(order.amount)}</strong><span>{order.payment}</span>{canManage && <div className="order-inline-actions"><button type="button" onClick={() => setRescheduleOrderId(order.id)}>Reschedule</button><button type="button" onClick={() => void onCancel(order.id)}>Cancel</button></div>}{order.status === 'Delivered' && <div className="order-inline-actions"><button type="button" onClick={() => downloadInvoice(order)}>Invoice</button>{!order.customerRating && <button type="button" onClick={() => void onRate(order.id)}>Rate delivery</button>}</div>}</div><ArrowRight size={17} /></article>; }) : <div className="empty-state"><h3>No orders in this filter</h3><p>New bookings will appear here when they match this status.</p></div>}</div><Pagination page={page} pageSize={10} total={visibleOrders.length} onPageChange={setPage} />{rescheduleOrderId && <CustomerRescheduleModal onClose={() => setRescheduleOrderId(null)} onSubmit={(date, slot) => { setRescheduleOrderId(null); void onReschedule(rescheduleOrderId, date, slot); }} />}</>;
}

function CustomerRescheduleModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (date: string, slot: string) => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState('As soon as possible');
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="reschedule-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Close reschedule dialog">×</button><span className="eyebrow">Booking change</span><h2 id="reschedule-title">Choose a new delivery time.</h2><p className="modal-copy">Select a date and delivery window for this pending booking.</p><div className="auth-form"><label>Delivery date<input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={event => setDate(event.target.value)} /></label><label>Delivery slot<select value={slot} onChange={event => setSlot(event.target.value)}><option>As soon as possible</option><option>Morning · 7 AM – 11 AM</option><option>Afternoon · 12 PM – 4 PM</option><option>Evening · 5 PM – 9 PM</option></select></label><div className="heading-actions"><Button variant="quiet" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onSubmit(date, slot)}>Confirm time</Button></div></div></section></div>;
}

function SavedAddressesView() {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const { notify: onNotify } = useAppStore();

  // Request deduplication hooks for address operations
  const saveDedup = useRequestDedup({ operationType: 'save_address' });
  const deleteDedup = useRequestDedup({ operationType: 'delete_address' });
  const toggleDedup = useRequestDedup({ operationType: 'toggle_address' });

  // Load addresses from backend on mount
  useEffect(() => {
    const loadAddresses = async () => {
      try {
        setLoading(true);
        const data = await loadSavedAddresses();
        setAddresses(data);
      } catch (error) {
        onNotify(error instanceof Error ? error.message : 'Failed to load addresses');
        setAddresses([]); // Do not use localStorage for sensitive address data
      } finally {
        setLoading(false);
      }
    };
    void loadAddresses();
  }, [onNotify]);

  const saveAddress = async (addr: SavedAddress) => {
    const key = saveDedup.startRequest();
    if (!key) {
      onNotify('An address save operation is already in progress. Please wait.');
      return;
    }

    try {
      const isEditing = addresses.some(a => a.id === addr.id);
      if (isEditing) {
        // Update existing address with retry logic
        await withRetry(
          () => updateSavedAddress(addr.id, addr),
          STANDARD_OPERATION_RETRY
        );
      } else {
        // Create new address with retry logic
        const result = await withRetry(
          () => createSavedAddress({
            label: addr.label,
            address: addr.address,
            city: addr.city,
            pincode: addr.pincode,
            latitude: addr.latitude,
            longitude: addr.longitude
          }),
          STANDARD_OPERATION_RETRY
        );
        addr.id = result.id;
      }
      // Reload addresses from backend with retry
      const updated = await withRetry(
        () => loadSavedAddresses(),
        STANDARD_OPERATION_RETRY
      );
      setAddresses(updated);
      setAddressDialogOpen(false);
      setEditingAddress(null);
      onNotify(isEditing ? 'Address updated successfully' : 'Address saved successfully');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Failed to save address');
    } finally {
      saveDedup.completeOperation();
    }
  };

  const deleteAddress = async (id: string) => {
    if (!window.confirm('Delete this address?')) return;
    
    const key = deleteDedup.startRequest();
    if (!key) {
      onNotify('An address delete operation is already in progress. Please wait.');
      return;
    }

    try {
      // Delete address with retry logic
      await withRetry(
        () => deleteSavedAddress(id),
        STANDARD_OPERATION_RETRY
      );
      // Reload addresses from backend with retry
      const updated = await withRetry(
        () => loadSavedAddresses(),
        STANDARD_OPERATION_RETRY
      );
      setAddresses(updated);
      onNotify('Address deleted successfully');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Failed to delete address');
    } finally {
      deleteDedup.completeOperation();
    }
  };

  const toggleActive = async (id: string) => {
    const key = toggleDedup.startRequest();
    if (!key) {
      onNotify('An address toggle operation is already in progress. Please wait.');
      return;
    }

    try {
      const address = addresses.find(a => a.id === id);
      if (!address) {
        toggleDedup.completeOperation();
        return;
      }
      // Update address active status with retry logic
      await withRetry(
        () => updateSavedAddress(id, { isActive: !address.isActive }),
        STANDARD_OPERATION_RETRY
      );
      // Reload addresses from backend with retry
      const updated = await withRetry(
        () => loadSavedAddresses(),
        STANDARD_OPERATION_RETRY
      );
      setAddresses(updated);
      onNotify(address.isActive ? 'Address deactivated' : 'Address activated');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Failed to update address');
    } finally {
      toggleDedup.completeOperation();
    }
  };

  const handleAddAddress = () => {
    setEditingAddress(null);
    setAddressDialogOpen(true);
  };

  const handleEditAddress = (addr: SavedAddress) => {
    setEditingAddress(addr);
    setAddressDialogOpen(true);
  };

  // Filter addresses
  const activeAddresses = addresses.filter(a => a.isActive);
  const inactiveAddresses = addresses.filter(a => !a.isActive);
  const visibleAddresses = filter === 'active' ? activeAddresses : filter === 'inactive' ? inactiveAddresses : addresses;

  const tabs = [
    { id: 'all' as const, label: 'All addresses', count: addresses.length },
    { id: 'active' as const, label: 'Active', count: activeAddresses.length },
    { id: 'inactive' as const, label: 'Inactive', count: inactiveAddresses.length }
  ];

  return <>
    <PageHeader eyebrow="Customer workspace · Addresses" title="Saved delivery locations." copy="Manage your frequently used addresses for quick bookings." />
    {!loading && (
      <div className="filter-tabs" role="tablist" aria-label="Address filters">
        {tabs.map(tab => (
          <button 
            className={filter === tab.id ? 'active' : ''} 
            role="tab" 
            aria-selected={filter === tab.id} 
            onClick={() => setFilter(tab.id)} 
            key={tab.id}
          >
            {tab.label} <b>{tab.count}</b>
          </button>
        ))}
      </div>
    )}
    <section className="data-surface">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Your delivery locations</span>
          <h2>{loading ? '...' : visibleAddresses.length} {visibleAddresses.length === 1 ? 'address' : 'addresses'}</h2>
        </div>
        <Button variant="primary" icon={Plus} onClick={handleAddAddress} disabled={loading}>
          {visibleAddresses.length === 0 ? 'Add Your First Address' : 'Add Address'}
        </Button>
      </div>
      {loading ? (
        <div className="empty-state">
          <p>Loading addresses...</p>
        </div>
      ) : visibleAddresses.length ? (
        <div className="address-list">
          {visibleAddresses.map(addr => (
            <article key={addr.id} className="address-row">
              <div className="address-icon">
                <MapPin size={18} />
              </div>
              <div className="address-main">
                <div className="address-header-row">
                  <div>
                    <b>{addr.label}</b>
                    <Status>{addr.isActive ? 'Active' : 'Inactive'}</Status>
                  </div>
                </div>
                <span className="address-street">{addr.address}</span>
                <small className="address-city-pin">{addr.city}, {addr.pincode}</small>
                {addr.latitude !== null && addr.longitude !== null && (
                  <small className="coords">📍 {addr.latitude.toFixed(4)}, {addr.longitude.toFixed(4)}</small>
                )}
              </div>
              <div className="address-actions">
                <button 
                  type="button" 
                  className="icon-btn" 
                  onClick={() => void toggleActive(addr.id)} 
                  title={addr.isActive ? 'Deactivate' : 'Activate'}
                >
                  {addr.isActive ? '●' : '○'}
                </button>
                <button 
                  type="button" 
                  className="icon-btn" 
                  onClick={() => handleEditAddress(addr)} 
                  title="Edit"
                >
                  ✎
                </button>
                <button 
                  type="button" 
                  className="icon-btn delete" 
                  onClick={() => void deleteAddress(addr.id)} 
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><MapPin size={48} /></div>
          <h3>No addresses found</h3>
          {filter !== 'all' ? (
            <p>No {filter} addresses yet. Try a different filter.</p>
          ) : (
            <p>Add your first address to speed up future bookings.</p>
          )}
        </div>
      )}
    </section>
    {addressDialogOpen && <AddressDialog address={editingAddress} onClose={() => { setAddressDialogOpen(false); setEditingAddress(null); }} onSave={saveAddress} />}
  </>;
}

function AddressDialog({ address, onClose, onSave }: { address: SavedAddress | null; onClose: () => void; onSave: (addr: SavedAddress) => void }) {
  const [form, setForm] = useState<SavedAddress>(address || { id: Math.random().toString(36).slice(2), label: '', address: '', city: '', pincode: '', latitude: null, longitude: null, isActive: true, createdAt: new Date().toISOString() });
  const [geoLoading, setGeoLoading] = useState(false);
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [mapSelectorOpen, setMapSelectorOpen] = useState(false);

  // Reverse geocoding to get location name from coordinates
  const getLocationName = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!response.ok) return null;
      const data = await response.json() as { address?: Record<string, string>; display_name?: string };
      // Try to build a meaningful location name
      const parts = [];
      if (data.address) {
        if (data.address.road) parts.push(data.address.road);
        if (data.address.suburb) parts.push(data.address.suburb);
        if (data.address.city) parts.push(data.address.city);
        if (data.address.district) parts.push(data.address.district);
      }
      return parts.length > 0 ? parts.join(', ') : data.display_name;
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
      return null;
    }
  };

  const getCurrentLocation = async () => {
    setGeoLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
      
      // Get location name
      const name = await getLocationName(lat, lng);
      if (name) setLocationName(name);
    } catch (error) {
      alert('Unable to get your location. Please enable location access in your browser settings.');
    } finally {
      setGeoLoading(false);
    }
  };

  const handleMapSelect = async (lat: number, lng: number) => {
    setForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
    
    // Get location name
    const name = await getLocationName(lat, lng);
    if (name) setLocationName(name);
    
    setMapSelectorOpen(false);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.label.trim() || !form.address.trim()) {
      alert('Please fill in all required fields');
      return;
    }
    onSave(form);
  };

  const hasCoordinates = form.latitude !== null && form.latitude !== 0 && form.longitude !== null && form.longitude !== 0;
  const mapUrl = hasCoordinates
    ? `https://www.openstreetmap.org/?mlat=${form.latitude}&mlon=${form.longitude}&zoom=15&layers=M`
    : null;

  return <>
    {!mapSelectorOpen ? (
      <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
        <section className="modal address-form-modal" role="dialog" aria-modal="true" aria-labelledby="address-form-title">
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close address form">×</button>
          <span className="eyebrow">Manage Address</span>
          <h2 id="address-form-title">{address ? 'Edit address' : 'Add new address'}</h2>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>Address Label<input type="text" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g., Home, Office" required /></label>
            <label>Street Address<textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Building, street, area" rows={3} required /></label>
            <div className="field-row">
              <label>City<input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="City" required /></label>
              <label>Pincode<input type="text" value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} placeholder="Postal code" required /></label>
            </div>
            
            <div className="location-controls">
              <div className="geo-buttons">
                <Button type="button" variant="quiet" icon={MapPin} onClick={getCurrentLocation} disabled={geoLoading}>
                  {geoLoading ? 'Getting location...' : 'Get current location'}
                </Button>
                <button type="button" className="manual-coords-toggle" onClick={() => setMapSelectorOpen(true)}>
                  Select on map
                </button>
              </div>
              
              {hasCoordinates && (
                <div className="location-info">
                  {locationName ? (
                    <>
                      <small>📍 {locationName}</small>
                      <small className="coords-secondary">{form.latitude!.toFixed(4)}, {form.longitude!.toFixed(4)}</small>
                    </>
                  ) : (
                    <small>📍 Location: {form.latitude!.toFixed(4)}, {form.longitude!.toFixed(4)}</small>
                  )}
                  {mapUrl && (
                    <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="map-link">
                      View on map →
                    </a>
                  )}
                </div>
              )}
              
              {showManualCoords && (
                <div className="manual-coords">
                  <div className="field-row">
                    <label>Latitude<input type="number" step="0.0001" value={form.latitude || ''} onChange={e => setForm({ ...form, latitude: parseFloat(e.target.value) || null })} placeholder="e.g., 13.0827" /></label>
                    <label>Longitude<input type="number" step="0.0001" value={form.longitude || ''} onChange={e => setForm({ ...form, longitude: parseFloat(e.target.value) || null })} placeholder="e.g., 80.2707" /></label>
                  </div>
                </div>
              )}
            </div>
            
            <div className="heading-actions">
              <Button variant="quiet" onClick={onClose}>Cancel</Button>
              <Button variant="primary" type="submit">Save address</Button>
            </div>
          </form>
        </section>
      </div>
    ) : (
      <MapSelector
        initialLat={form.latitude || 13.0827}
        initialLng={form.longitude || 80.2707}
        onLocationSelect={handleMapSelect}
        onCancel={() => setMapSelectorOpen(false)}
        title="Select delivery location on map"
      />
    )}
  </>;
}

function SupportView({ data, onNotify }: { data: AppData; onNotify: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const activeOrder = data.orders.find(order => order.status !== 'Delivered');
  const [name, setName] = useState(data.profile?.name || '');
  const [orderId, setOrderId] = useState(activeOrder?.id || '');
  const [message, setMessage] = useState('');
  const supportDedup = useRequestDedup({ operationType: 'create_support_request' });

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const key = supportDedup.startRequest();
    if (!key) {
      onNotify('A support request is already being submitted. Please wait.');
      return;
    }

    const subject = `Urban Tanker support request${orderId ? ` · ${orderId}` : ''}`;
    const body = `Name: ${name}\nOrder ID: ${orderId}\n\n${message}`;
    try {
      // Create support request with retry logic
      await withRetry(
        () => createSupportRequest({ subject, message: body, orderId: orderId || undefined }),
        STANDARD_OPERATION_RETRY
      );
      setOpen(false);
      onNotify('Support request sent to the operations team.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to send support request.');
    } finally {
      supportDedup.completeOperation();
    }
  };

  return <><PageHeader eyebrow="Customer support" title="How can we help?" copy="Our Chennai team is available for bookings, payments, tanker access, and account questions." /><div className="support-grid"><div className="support-card"><MessageSquare size={22} /><h3>Message support</h3><p>Describe the issue and include your order ID. We usually respond within 15 minutes.</p><Button variant="primary" icon={ArrowRight} onClick={() => setOpen(true)}>Start a request</Button></div><div className="support-card"><Phone size={22} /><h3>Call dispatch</h3><p>For an active delivery, connect directly with our operations desk.</p><Button variant="quiet" icon={Phone} onClick={() => onNotify('Calling dispatch is available in production mode')}>+91 44 4012 2200</Button></div></div>{open && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}><section className="modal support-dialog" role="dialog" aria-modal="true" aria-labelledby="support-title"><button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close support request"><X size={18} /></button><span className="eyebrow">Customer support</span><h2 id="support-title">Send us a message.</h2><p className="modal-copy">We will open your email client with the request details ready to send.</p><form className="support-form" onSubmit={submitRequest}><label htmlFor="support-name">Name<input id="support-name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" required /></label><label htmlFor="support-order">Order ID (optional)<input id="support-order" value={orderId} onChange={event => setOrderId(event.target.value)} placeholder="Order ID" /></label><label htmlFor="support-message">Message<textarea id="support-message" value={message} onChange={event => setMessage(event.target.value)} rows={5} placeholder="Tell us how we can help" required /></label><Button variant="primary full" type="submit" disabled={supportDedup.isLoading}>
  {supportDedup.isLoading ? 'Sending...' : 'Submit request'} <ArrowRight size={16} />
</Button></form></section></div>}</>;
}

function OffersPage({ onSelectService }: { onSelectService: (service: BookingDraft['service']) => void }) {
  const offers = [
    {
      id: 'water-10-off',
      service: 'Water tanker',
      title: '10% Off on Water Delivery',
      description: 'Save on your first water tanker booking with us.',
      discount: '10% off',
      icon: Droplets,
      color: 'aqua',
      minOrder: '3 KL or more',
      validUntil: '30 Sep 2026'
    },
    {
      id: 'sewage-discount',
      service: 'Sewage pickup',
      title: '15% Off on Sewage Services',
      description: 'Get a discount on septic tank and waste removal services.',
      discount: '15% off',
      icon: Droplets,
      color: 'green',
      minOrder: 'All capacities',
      validUntil: '30 Sep 2026'
    },
    {
      id: 'subscription-deal',
      service: 'Water tanker',
      title: 'Subscribe & Save 20%',
      description: 'Setup recurring deliveries and enjoy consistent savings.',
      discount: '20% off',
      icon: RefreshCcw,
      color: 'gold',
      minOrder: 'Monthly plans',
      validUntil: 'Ongoing'
    },
    {
      id: 'bundle-offer',
      service: 'Water tanker',
      title: 'Book 5 Get 1 Free',
      description: 'Make 5 bookings and get your 6th delivery absolutely free.',
      discount: '1 free',
      icon: Package,
      color: 'aqua',
      minOrder: '3-6 KL tanks',
      validUntil: '31 Oct 2026'
    }
  ];

  return <>
    <PageHeader eyebrow="Special offers" title="Exclusive deals just for you." copy="Save on water and sewage services with our limited-time promotions." />
    <section className="offers-grid">
      {offers.map(offer => {
        const Icon = offer.icon;
        return (
          <article key={offer.id} className={`offer-card offer-${offer.color}`}>
            <div className="offer-header">
              <div className="offer-icon"><Icon size={24} /></div>
              <span className="offer-badge">{offer.discount}</span>
            </div>
            <h3>{offer.title}</h3>
            <p>{offer.description}</p>
            <div className="offer-details">
              <small><b>Minimum:</b> {offer.minOrder}</small>
              <small><b>Valid until:</b> {offer.validUntil}</small>
            </div>
            <Button variant="primary full" icon={ArrowRight} onClick={() => onSelectService(offer.service as BookingDraft['service'])}>
              Book now
            </Button>
          </article>
        );
      })}
    </section>
  </>;
}
