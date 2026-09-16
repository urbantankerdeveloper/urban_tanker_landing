import { useState } from 'react';
import { ArrowRight, Check, WalletCards, X } from 'lucide-react';
import { Button } from './ui';
import { money } from '../data/demo';
import { useApi } from '../hooks/useApi';
import { useAppStore } from '../store';

interface PaymentOrderResponse { orderId: string; amount: number; currency: string; keyId: string; }
interface PaymentVerificationResponse { verified: boolean; paymentId: string; orderId: string; }

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
  const onClose = () => { if (!busy) setCheckoutOpen(false); };
  const details = data.pendingBooking ?? data.booking;
  const amount: number = 'amount' in details && typeof details.amount === 'number' ? details.amount : 0;
  const complete = (payment: string) => onComplete({ id: `AF-${String(Date.now()).slice(-6)}`, service: details.service, capacity: details.capacity, address: details.address, customer: data.profile?.name || 'Urban Tanker customer', amount, status: 'Vendor assigned', vendor: 'BlueDrop Tankers', driver: 'Ravi Kumar', eta: '35 min', payment, created: 'Just now' });
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

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><button className="modal-close" onClick={onClose} aria-label="Close checkout" disabled={busy}><X size={18} /></button><span className="eyebrow">Confirm booking</span><h2 id="checkout-title">Almost there.</h2><p className="modal-copy">Review your service details and choose a payment method.</p><div className="checkout-summary"><div><span>Service</span><b>{details.service}</b></div><div><span>Capacity</span><b>{details.capacity}</b></div><div><span>Delivery</span><b>{details.address}</b></div><div className="summary-total"><span>Total</span><strong>{money(amount)}</strong></div></div><fieldset className="payment-options"><legend>Payment method</legend>{['UPI', 'Card', 'Cash'].map(option => <button type="button" key={option} className={method === option ? 'selected' : ''} aria-pressed={method === option} onClick={() => setMethod(option)} disabled={busy}><WalletCards size={16} /><span>{option === 'Cash' ? 'Cash on delivery' : option}</span>{method === option && <Check size={15} />}</button>)}</fieldset>{error && <p className="auth-error" role="alert">{error}</p>}<Button variant="primary full" onClick={() => void pay()} disabled={busy}>{busy ? 'Processing...' : method === 'Cash' ? 'Confirm booking' : 'Pay securely'} <ArrowRight size={16} /></Button><small className="modal-note">Online payments are securely processed and verified by Razorpay.</small></section></div>;
}
