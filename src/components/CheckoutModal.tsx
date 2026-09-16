import { useState } from 'react';
import { ArrowRight, Check, Tag, WalletCards, X } from 'lucide-react';
import { Button } from './ui';
import { money } from '../data/demo';
import { useApi } from '../hooks/useApi';
import { useAppStore } from '../store';

interface PaymentOrderResponse { orderId: string; amount: number; currency: string; keyId: string; }
interface PaymentVerificationResponse { verified: boolean; paymentId: string; orderId: string; }

interface Coupon {
  code: string;
  label: string;
  discount: number;
  service?: string;
  firstBooking?: boolean;
}

const coupons: Coupon[] = [
  { code: 'ECRFIRST50', label: '50% off your first water tanker booking', discount: 50, service: 'Water tanker', firstBooking: true },
  { code: 'WATER200', label: '₹200 off water tanker bookings', discount: 200, service: 'Water tanker' },
  { code: 'SEWAGE300', label: '₹300 off sewage pickup', discount: 300, service: 'Sewage pickup' },
  { code: 'WEEKEND15', label: '15% off weekend bookings', discount: 15 }
];

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Razorpay Checkout.'));
    document.body.appendChild(script);
  });
}

export function CheckoutModal() {
  const { data, checkoutMethod: method, setCheckoutMethod: setMethod, completeBooking: onComplete, setCheckoutOpen } = useAppStore();
  const paymentsApi = useApi('razorpay-payment');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const onClose = () => { if (!busy) setCheckoutOpen(false); };
  const details = data.pendingBooking ?? data.booking;
  const baseAmount = 'amount' in details && typeof details.amount === 'number' ? details.amount : 0;
  const discount = appliedCoupon ? Math.min(appliedCoupon.discount > 0 && appliedCoupon.discount < 100 ? Math.round(baseAmount * appliedCoupon.discount / 100) : appliedCoupon.discount, baseAmount) : 0;
  const amount = Math.max(0, baseAmount - discount);
  const complete = (payment: string) => onComplete({ id: `AF-${String(Date.now()).slice(-6)}`, service: details.service, capacity: details.capacity, address: details.address, customer: data.profile?.name || 'Urban Tanker customer', amount, discount, couponCode: appliedCoupon?.code, status: 'Vendor assigned', vendor: 'BlueDrop Tankers', driver: 'Ravi Kumar', eta: '35 min', payment, created: 'Just now' });
  const applyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    const coupon = coupons.find(item => item.code === code);
    const alreadyBooked = Boolean(coupon?.firstBooking && data.profile && data.orders.some(order => order.customer === data.profile?.name));
    if (!coupon || (coupon.service && coupon.service !== details.service) || alreadyBooked) {
      setAppliedCoupon(null);
      setError(alreadyBooked ? 'This first-booking offer has already been used.' : 'That coupon is not valid for this service.');
      return;
    }
    setAppliedCoupon(coupon);
    setCouponCode(coupon.code);
    setError('');
  };
  const pay = async () => {
    setError('');
    if (method === 'Cash') {
      complete('Due on delivery');
      return;
    }
    setBusy(true);
    try {
      const order = await paymentsApi.post<PaymentOrderResponse>('/createRazorpayOrder', { amount: Math.round(amount * 100), receipt: `urban-tanker-${Date.now()}` });
      await loadRazorpay();
      if (!window.Razorpay) throw new Error('Razorpay Checkout is unavailable.');
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Urban Tanker',
        description: `${details.service} · ${details.capacity}`,
        order_id: order.orderId,
        prefill: {name: data.profile?.name, email: data.profile?.email},
        theme: {color: '#0b8c96'},
        handler: async payment => {
          try {
            const verification = await paymentsApi.post<PaymentVerificationResponse>('/verifyRazorpayPayment', {
              razorpayOrderId: payment.razorpay_order_id,
              razorpayPaymentId: payment.razorpay_payment_id,
              razorpaySignature: payment.razorpay_signature
            });
            if (!verification.verified) throw new Error('Payment verification failed.');
            complete('Paid');
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Payment verification failed.');
          } finally {
            setBusy(false);
          }
        }
      });
      checkout.open();
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : 'Unable to start payment.');
    }
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><button className="modal-close" onClick={onClose} aria-label="Close checkout" disabled={busy}><X size={18} /></button><span className="eyebrow">Confirm booking</span><h2 id="checkout-title">Almost there.</h2><p className="modal-copy">Review your service details and choose a payment method.</p><div className="checkout-summary"><div><span>Service</span><b>{details.service}</b></div><div><span>Capacity</span><b>{details.capacity}</b></div><div><span>Delivery</span><b>{details.address}</b></div>{discount > 0 && <div><span>Discount · {appliedCoupon?.code}</span><strong className="discount-value">-{money(discount)}</strong></div>}<div className="summary-total"><span>Total</span><strong>{money(amount)}</strong></div></div><div className="coupon-entry"><label htmlFor="checkout-coupon">Coupon code</label><div><Tag size={16} /><input id="checkout-coupon" value={couponCode} onChange={event => setCouponCode(event.target.value)} placeholder="Try ECRFIRST50" disabled={busy} /><button type="button" onClick={applyCoupon} disabled={busy}>Apply</button></div><small>{appliedCoupon ? `${appliedCoupon.code} applied. You save ${money(discount)}.` : '50% off your first water tanker booking with ECRFIRST50.'}</small></div><fieldset className="payment-options"><legend>Payment method</legend>{['UPI', 'Card', 'Cash'].map(option => <button type="button" key={option} className={method === option ? 'selected' : ''} aria-pressed={method === option} onClick={() => setMethod(option)} disabled={busy}><WalletCards size={16} /><span>{option === 'Cash' ? 'Cash on delivery' : option}</span>{method === option && <Check size={15} />}</button>)}</fieldset>{error && <p className="auth-error" role="alert">{error}</p>}<Button variant="primary full" onClick={() => void pay()} disabled={busy}>{busy ? 'Processing...' : method === 'Cash' ? 'Confirm booking' : 'Pay securely'} <ArrowRight size={16} /></Button><small className="modal-note">Online payments are securely processed and verified by Razorpay.</small></section></div>;
}
